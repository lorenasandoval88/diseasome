import * as clust from "https://lorenasandoval88.github.io/clustjs/dist/sdk.mjs";

console.log("clustjs version:", clust.version);

const clusterContainerId = "clusterDiv";


/**
 * Pivot window.prsResults (flat array of {userId, pgsId, PRS}) into
 * one object per user where each key is a pgsId and the value is PRS.
 * Returns null if no usable results exist.
 */
function pivotPrsResults(rawResults) {
  if (!Array.isArray(rawResults) || rawResults.length === 0) return null;

  const byUser = new Map();
  for (const r of rawResults) {
    if (!r.userId || r.PRS == null || !Number.isFinite(r.PRS)) continue;
    if (!byUser.has(r.userId)) {
      byUser.set(r.userId, { label: r.userName ?? r.userId });
    }
    byUser.get(r.userId)[r.pgsId] = r.PRS;
  }

  const rows = Array.from(byUser.values());
  return rows.length >= 2 ? rows : null;
}

/**
 * Get unique PGS IDs from prsResults
 */
function getUniquePgsIds(rawResults) {
  if (!Array.isArray(rawResults)) return [];
  const ids = new Set();
  for (const r of rawResults) {
    if (r.pgsId) ids.add(r.pgsId);
  }
  return Array.from(ids);
}

/**
 * Get total variant count for a PGS ID
 */
function getTotalVariants(rawResults, pgsId) {
  const result = rawResults?.find(r => r.pgsId === pgsId);
  return result?.pgs?.dt?.length ?? 0;
}

/**
 * Get publication year for a PGS ID from citation metadata
 */
function getPublicationYear(rawResults, pgsId) {
  const result = rawResults?.find(r => r.pgsId === pgsId);
  const citation = result?.pgs?.meta?.citation ?? '';
  // Extract year from citation format "Author et al. Journal (YYYY). doi:..."
  const match = citation.match(/\((\d{4})\)/);
  return match ? match[1] : '';
}

/**
 * Build allele matrix for clustering users by variants for a specific PGS entry.
 * Each row is a user, each column is a variant (rsid or chr:pos), values are allele counts (0, 1, 2).
 * For non-matches, uses missingValue as a marker.
 * Returns array of objects suitable for hclust_plot: [{label, variant1: alleleCount, variant2: alleleCount, ...}, ...]
 * @param {string} mode - "all" (all PGS variants), "overlapping" (matched in ≥1 user), "shared" (matched in ALL users)
 * @param {number} missingValue - Value to use for missing/non-matched variants (default: -1)
 */
function buildAlleleMatrix(rawResults, targetPgsId, { mode = 'overlapping', missingValue = -1 } = {}) {
  if (!Array.isArray(rawResults) || rawResults.length === 0) return null;

  // First pass: collect all user data and per-user matched variants
  const usersData = [];
  let pgsDataRef = null;

  for (const result of rawResults) {
    if (result.pgsId !== targetPgsId) continue;
    if (!result.pgsMatchMy23 || !result.alleles) continue;

    const label = result.userName ?? result.userId ?? 'Unknown';
    const pgsData = result.pgs;
    if (!pgsData || !pgsData.cols) continue;

    pgsDataRef = pgsDataRef || pgsData;

    const indChr = pgsData.cols.indexOf('hm_chr');
    const indPos = pgsData.cols.indexOf('hm_pos');
    const indRsid = pgsData.cols.indexOf('rsID');

    const getVariantId = (variant, idx) => {
      if (indRsid >= 0 && variant[indRsid]) return variant[indRsid];
      if (indChr >= 0 && indPos >= 0) return `${variant[indChr]}:${variant[indPos]}`;
      return `var_${idx}`;
    };

    const matchedVariants = new Map(); // variantId -> alleleCount

    result.pgsMatchMy23.forEach((matchEntry, idx) => {
      const pgsVariant = matchEntry.length >= 2 ? matchEntry[matchEntry.length - 1] : null;
      if (!pgsVariant) return;

      const variantId = getVariantId(pgsVariant, idx);
      const val = Number(result.alleles[idx]);
      const alleleCount = Number.isFinite(val) ? val : missingValue;
      matchedVariants.set(variantId, alleleCount);
    });

    usersData.push({ label, matchedVariants, pgsData, getVariantId });
  }

  if (usersData.length < 2) return null;

  // Determine which variants to include based on mode
  let targetVariants;

  if (mode === 'all') {
    // All variants in PGS file
    targetVariants = new Set();
    if (pgsDataRef?.dt) {
      const indChr = pgsDataRef.cols.indexOf('hm_chr');
      const indPos = pgsDataRef.cols.indexOf('hm_pos');
      const indRsid = pgsDataRef.cols.indexOf('rsID');
      pgsDataRef.dt.forEach((variant, idx) => {
        if (indRsid >= 0 && variant[indRsid]) {
          targetVariants.add(variant[indRsid]);
        } else if (indChr >= 0 && indPos >= 0) {
          targetVariants.add(`${variant[indChr]}:${variant[indPos]}`);
        } else {
          targetVariants.add(`var_${idx}`);
        }
      });
    }
  } else if (mode === 'shared') {
    // Only variants matched in ALL users
    targetVariants = null;
    for (const user of usersData) {
      const userVariants = new Set(user.matchedVariants.keys());
      if (targetVariants === null) {
        targetVariants = userVariants;
      } else {
        targetVariants = new Set([...targetVariants].filter(v => userVariants.has(v)));
      }
    }
    targetVariants = targetVariants || new Set();
  } else {
    // 'overlapping' - variants matched in at least one user (union)
    targetVariants = new Set();
    for (const user of usersData) {
      for (const v of user.matchedVariants.keys()) {
        targetVariants.add(v);
      }
    }
  }

  if (targetVariants.size === 0) return null;

  // Build final matrix
  const allVariants = Array.from(targetVariants);
  const userVariantMap = usersData.map(user => {
    const row = { label: user.label };
    for (const v of allVariants) {
      row[v] = user.matchedVariants.has(v) ? user.matchedVariants.get(v) : missingValue;
    }
    return row;
  });

  console.log(`buildAlleleMatrix (${mode}):`, userVariantMap.length, "users,", allVariants.length, "variants, missingValue:", missingValue);

  return userVariantMap;
}


async function renderCluster() {
  const clusterContainer = document.getElementById(clusterContainerId);
  if (!clusterContainer) return;

  const pivoted = pivotPrsResults(window.prsResults);
  const pgsIds = getUniquePgsIds(window.prsResults);
  //console.log("Pivoted PRS results for clustering:", pivoted);
  // Show message if no PRS results available
  if (pivoted === null) {
    clusterContainer.innerHTML = `<div class="alert alert-info">
        <strong>No PRS results available.</strong><br>
        Please go to the <strong>Calculate PRS</strong> tab first and run a PRS calculation. <a href="#" onclick="document.querySelector('.tablinks[onclick*=PRS]').click(); return false;">Go to Calculate PRS →</a>
    </div>`;
    return;
  }

  // Get current clustering options (preserve state across re-renders)
  const clusterRows = window.clusterOptions?.clusterRows ?? true;
  const clusterCols = window.clusterOptions?.clusterCols ?? true;
  const selectedPgsId = window.clusterOptions?.selectedPgsId ?? pgsIds[0] ?? '';
  const clusterAlleleRows = window.clusterOptions?.clusterAlleleRows ?? true;
  const clusterAlleleCols = window.clusterOptions?.clusterAlleleCols ?? true;
  
  // Clustering algorithm options
  const clusterMethod = window.clusterOptions?.clusterMethod ?? 'complete';
  const clusterDistance = window.clusterOptions?.clusterDistance ?? 'euclidean';
  const alleleClusterMethod = window.clusterOptions?.alleleClusterMethod ?? 'complete';
  const alleleClusterDistance = window.clusterOptions?.alleleClusterDistance ?? 'euclidean';

  // Build allele matrices for selected PGS - three views
  const allMatrix = selectedPgsId ? buildAlleleMatrix(window.prsResults, selectedPgsId, { mode: 'all', missingValue: 0 }) : null;
  const allMatrixDisplay = selectedPgsId ? buildAlleleMatrix(window.prsResults, selectedPgsId, { mode: 'all', missingValue: -1 }) : null;
  
  const overlapMatrix = selectedPgsId ? buildAlleleMatrix(window.prsResults, selectedPgsId, { mode: 'overlapping', missingValue: 0 }) : null;
  const overlapMatrixDisplay = selectedPgsId ? buildAlleleMatrix(window.prsResults, selectedPgsId, { mode: 'overlapping', missingValue: -1 }) : null;
  
  const sharedMatrix = selectedPgsId ? buildAlleleMatrix(window.prsResults, selectedPgsId, { mode: 'shared', missingValue: 0 }) : null;
  const sharedMatrixDisplay = selectedPgsId ? buildAlleleMatrix(window.prsResults, selectedPgsId, { mode: 'shared', missingValue: -1 }) : null;

  const totalVariants = getTotalVariants(window.prsResults, selectedPgsId);
  const allCount = allMatrix ? Object.keys(allMatrix[0]).length - 1 : 0;
  const overlapCount = overlapMatrix ? Object.keys(overlapMatrix[0]).length - 1 : 0;
  const sharedCount = sharedMatrix ? Object.keys(sharedMatrix[0]).length - 1 : 0;
  const sharedPct = totalVariants > 0 ? ((sharedCount / totalVariants) * 100).toFixed(1) : '0.0';
  const overlapPct = totalVariants > 0 ? ((overlapCount / totalVariants) * 100).toFixed(1) : '0.0';

//  console.log("window.prsResults",window.prsResults)

  clusterContainer.innerHTML = `
    <h5>PRS Clustering (${pivoted.length} Users × ${Object.keys(pivoted[0]).length - 1} PGS Entries)</h5>
    <p class="text-muted small mb-3">
      Hierarchical clustering of PRS results (${pivoted.length} users × ${Object.keys(pivoted[0]).length - 1} PGS entries).
    </p>
    <div class="mb-2">
      <strong>Cluster by:</strong>
      <div class="btn-group ms-2" role="group">
        <button id="clusterRowsBtn" class="btn btn-sm ${clusterRows ? 'btn-primary' : 'btn-outline-primary'}">Rows (Users)</button>
        <button id="clusterColsBtn" class="btn btn-sm ${clusterCols ? 'btn-primary' : 'btn-outline-primary'}">Columns (PGS)</button>
        <button id="clusterBothBtn" class="btn btn-sm ${clusterRows && clusterCols ? 'btn-success' : 'btn-outline-success'}">Both</button>
      </div>
    </div>
    <div class="mb-2">
      <strong>Linkage:</strong>
      <div class="btn-group ms-2" role="group">
        <button id="clusterMethodComplete" class="btn btn-sm ${clusterMethod === 'complete' ? 'btn-secondary' : 'btn-outline-secondary'}">Complete</button>
        <button id="clusterMethodSingle" class="btn btn-sm ${clusterMethod === 'single' ? 'btn-secondary' : 'btn-outline-secondary'}">Single</button>
        <button id="clusterMethodAverage" class="btn btn-sm ${clusterMethod === 'average' ? 'btn-secondary' : 'btn-outline-secondary'}">Average</button>
        <button id="clusterMethodWard" class="btn btn-sm ${clusterMethod === 'ward' ? 'btn-secondary' : 'btn-outline-secondary'}">Ward</button>
      </div>
    </div>
    <div class="mb-3">
      <strong>Distance:</strong>
      <div class="btn-group ms-2" role="group">
        <button id="clusterDistEuclidean" class="btn btn-sm ${clusterDistance === 'euclidean' ? 'btn-info' : 'btn-outline-info'}">Euclidean</button>
        <button id="clusterDistManhattan" class="btn btn-sm ${clusterDistance === 'manhattan' ? 'btn-info' : 'btn-outline-info'}">Manhattan</button>
        <button id="clusterDistCosine" class="btn btn-sm ${clusterDistance === 'cosine' ? 'btn-info' : 'btn-outline-info'}">Cosine</button>
      </div>
    </div>
    <div id="clusterPlotMount"></div>

    <hr class="my-4" />

    <h5>Allele Clustering (${pivoted.length} Users × ${totalVariants} Variants for ${selectedPgsId})</h5>
    <p class="text-muted small mb-2">
      Cluster users by allele counts (0, 1, 2) for variants in a single PGS entry. Non-matched variants shown in black.
    </p>
    <div class="mb-3">
      <label for="pgsSelectDropdown" class="form-label"><strong>Select PGS Entry:</strong></label>
      <select id="pgsSelectDropdown" class="form-select" style="max-width: 400px;">
        ${pgsIds.map(id => {
          const year = getPublicationYear(window.prsResults, id);
          const yearStr = year ? ` (${year})` : '';
          return `<option value="${id}" ${id === selectedPgsId ? 'selected' : ''}>${id}${yearStr} — ${getTotalVariants(window.prsResults, id)} variants</option>`;
        }).join('')}
      </select>
    </div>

    <div class="mb-2">
      <strong>Cluster by:</strong>
      <div class="btn-group ms-2" role="group">
        <button id="clusterAlleleRowsBtn" class="btn btn-sm ${clusterAlleleRows ? 'btn-primary' : 'btn-outline-primary'}">Rows (Users)</button>
        <button id="clusterAlleleColsBtn" class="btn btn-sm ${clusterAlleleCols ? 'btn-primary' : 'btn-outline-primary'}">Columns (Variants)</button>
        <button id="clusterAlleleBothBtn" class="btn btn-sm ${clusterAlleleRows && clusterAlleleCols ? 'btn-success' : 'btn-outline-success'}">Both</button>
      </div>
    </div>
    <div class="mb-2">
      <strong>Linkage:</strong>
      <div class="btn-group ms-2" role="group">
        <button id="alleleMethodComplete" class="btn btn-sm ${alleleClusterMethod === 'complete' ? 'btn-secondary' : 'btn-outline-secondary'}">Complete</button>
        <button id="alleleMethodSingle" class="btn btn-sm ${alleleClusterMethod === 'single' ? 'btn-secondary' : 'btn-outline-secondary'}">Single</button>
        <button id="alleleMethodAverage" class="btn btn-sm ${alleleClusterMethod === 'average' ? 'btn-secondary' : 'btn-outline-secondary'}">Average</button>
        <button id="alleleMethodWard" class="btn btn-sm ${alleleClusterMethod === 'ward' ? 'btn-secondary' : 'btn-outline-secondary'}">Ward</button>
      </div>
    </div>
    <div class="mb-3">
      <strong>Distance:</strong>
      <div class="btn-group ms-2" role="group">
        <button id="alleleDistEuclidean" class="btn btn-sm ${alleleClusterDistance === 'euclidean' ? 'btn-info' : 'btn-outline-info'}">Euclidean</button>
        <button id="alleleDistManhattan" class="btn btn-sm ${alleleClusterDistance === 'manhattan' ? 'btn-info' : 'btn-outline-info'}">Manhattan</button>
        <button id="alleleDistCosine" class="btn btn-sm ${alleleClusterDistance === 'cosine' ? 'btn-info' : 'btn-outline-info'}">Cosine</button>
      </div>
    </div>

    <!-- 1. All Variants -->
    <div class="card mb-4">
      <div class="card-header"><strong>1. All Variants</strong> <span class="text-muted small">— Broad view, includes non-matches (black = missing)</span></div>
      <div class="card-body">
        ${allMatrix ? `
          <p class="text-muted small mb-2">${allMatrix.length} users × ${allCount} variants (of ${totalVariants} total in PGS)</p>
          <div id="allVariantsPlot"></div>
        ` : `<div class="alert alert-warning mb-0">Not enough data for all-variants view.</div>`}
      </div>
    </div>

    <!-- 2. Overlapping Matches -->
    <div class="card mb-4">
      <div class="card-header"><strong>2. Overlapping Matches</strong> <span class="text-muted small">— SNPs matched in ≥1 user (cleaner view)</span></div>
      <div class="card-body">
        ${overlapMatrix ? `
          <p class="text-muted small mb-2">${overlapMatrix.length} users × ${overlapCount} variants (${overlapPct}% of total)</p>
          <div id="overlapPlot"></div>
        ` : `<div class="alert alert-warning mb-0">Not enough overlapping matches.</div>`}
      </div>
    </div>

    <!-- 3. Shared Matched SNPs -->
    <div class="card mb-4">
      <div class="card-header"><strong>3. Shared Matched SNPs</strong> <span class="text-muted small">— SNPs matched in ALL users (best for direct comparison)</span></div>
      <div class="card-body">
        ${sharedMatrix ? `
          <p class="text-muted small mb-2">${sharedMatrix.length} users × ${sharedCount} variants (${sharedPct}% of total)</p>
          <div id="sharedPlot"></div>
        ` : `<div class="alert alert-warning mb-0">No variants shared across all users.</div>`}
      </div>
    </div>
  `;

  // Attach button handlers for PRS clustering
  document.getElementById('clusterRowsBtn').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, clusterRows: !clusterRows, clusterCols };
    renderCluster();
  };
  document.getElementById('clusterColsBtn').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, clusterRows, clusterCols: !clusterCols };
    renderCluster();
  };
  document.getElementById('clusterBothBtn').onclick = () => {
    const bothOn = clusterRows && clusterCols;
    window.clusterOptions = { ...window.clusterOptions, clusterRows: !bothOn, clusterCols: !bothOn };
    renderCluster();
  };

  // PRS clustering method handlers
  document.getElementById('clusterMethodComplete').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, clusterMethod: 'complete' };
    renderCluster();
  };
  document.getElementById('clusterMethodSingle').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, clusterMethod: 'single' };
    renderCluster();
  };
  document.getElementById('clusterMethodAverage').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, clusterMethod: 'average' };
    renderCluster();
  };
  document.getElementById('clusterMethodWard').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, clusterMethod: 'ward' };
    renderCluster();
  };

  // PRS clustering distance handlers
  document.getElementById('clusterDistEuclidean').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, clusterDistance: 'euclidean' };
    renderCluster();
  };
  document.getElementById('clusterDistManhattan').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, clusterDistance: 'manhattan' };
    renderCluster();
  };
  document.getElementById('clusterDistCosine').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, clusterDistance: 'cosine' };
    renderCluster();
  };

  // Attach dropdown handler
  document.getElementById('pgsSelectDropdown').onchange = (e) => {
    window.clusterOptions = { ...window.clusterOptions, selectedPgsId: e.target.value };
    renderCluster();
  };

  // Attach allele clustering button handlers
  document.getElementById('clusterAlleleRowsBtn').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, clusterAlleleRows: !clusterAlleleRows, clusterAlleleCols };
    renderCluster();
  };
  document.getElementById('clusterAlleleColsBtn').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, clusterAlleleRows, clusterAlleleCols: !clusterAlleleCols };
    renderCluster();
  };
  document.getElementById('clusterAlleleBothBtn').onclick = () => {
    const bothOn = clusterAlleleRows && clusterAlleleCols;
    window.clusterOptions = { ...window.clusterOptions, clusterAlleleRows: !bothOn, clusterAlleleCols: !bothOn };
    renderCluster();
  };

  // Allele clustering method handlers
  document.getElementById('alleleMethodComplete').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, alleleClusterMethod: 'complete' };
    renderCluster();
  };
  document.getElementById('alleleMethodSingle').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, alleleClusterMethod: 'single' };
    renderCluster();
  };
  document.getElementById('alleleMethodAverage').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, alleleClusterMethod: 'average' };
    renderCluster();
  };
  document.getElementById('alleleMethodWard').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, alleleClusterMethod: 'ward' };
    renderCluster();
  };

  // Allele clustering distance handlers
  document.getElementById('alleleDistEuclidean').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, alleleClusterDistance: 'euclidean' };
    renderCluster();
  };
  document.getElementById('alleleDistManhattan').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, alleleClusterDistance: 'manhattan' };
    renderCluster();
  };
  document.getElementById('alleleDistCosine').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, alleleClusterDistance: 'cosine' };
    renderCluster();
  };

  // Render PRS cluster plot
  // console.log("cluster plot data:", pivoted, "clusterRows:", clusterRows, "clusterCols:", clusterCols);
  await clust.hclust_plot({
    divid: "clusterPlotMount",
    data: pivoted,
   // width: 500,
    height: 350,
    clusterRows: clusterRows,
    clusterCols: clusterCols,
    clusteringMethodRows: clusterMethod,
    clusteringMethodCols: clusterMethod,
    clusteringDistanceRows: clusterDistance,
    clusteringDistanceCols: clusterDistance
  });

  const colorScale = clust.d3.scaleLinear().domain([0, 1, 2]).range(["#f7fbff", "#6baed6", "#103a79"]);

  // Render 1. All Variants plot
  if (allMatrix) {
    await clust.hclust_plot({
      divid: "allVariantsPlot",
      data: allMatrix,
      displayData: allMatrixDisplay,
      width: 900,
      height: 350,
      clusterRows: clusterAlleleRows,
      clusterCols: clusterAlleleCols,
      heatmapColorScale: colorScale,
      clusteringMethodRows: alleleClusterMethod,
      clusteringMethodCols: alleleClusterMethod,
      clusteringDistanceRows: alleleClusterDistance,
      clusteringDistanceCols: alleleClusterDistance
    });
  }

  // Render 2. Overlapping Matches plot
  if (overlapMatrix) {
    await clust.hclust_plot({
      divid: "overlapPlot",
      data: overlapMatrix,
      displayData: overlapMatrixDisplay,
      width: 900,
      height: 350,
      clusterRows: clusterAlleleRows,
      clusterCols: clusterAlleleCols,
      heatmapColorScale: colorScale,
      clusteringMethodRows: alleleClusterMethod,
      clusteringMethodCols: alleleClusterMethod,
      clusteringDistanceRows: alleleClusterDistance,
      clusteringDistanceCols: alleleClusterDistance
    });
  }

  // Render 3. Shared Matched SNPs plot
  if (sharedMatrix && Object.keys(sharedMatrix[0]).length > 1) {
    await clust.hclust_plot({
      divid: "sharedPlot",
      data: sharedMatrix,
      displayData: sharedMatrixDisplay,
      width: 900,
      height: 350,
      clusterRows: clusterAlleleRows,
      clusterCols: clusterAlleleCols,
      heatmapColorScale: colorScale,
      clusteringMethodRows: alleleClusterMethod,
      clusteringMethodCols: alleleClusterMethod,
      clusteringDistanceRows: alleleClusterDistance,
      clusteringDistanceCols: alleleClusterDistance
    });
  } else if (document.getElementById("sharedPlot")) {
    document.getElementById("sharedPlot").innerHTML =
      `<div class="alert alert-info">No SNPs shared across all users.</div>`;
  }
}

window.renderCluster = renderCluster;