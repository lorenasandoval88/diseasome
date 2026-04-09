import * as clust from "https://lorenasandoval88.github.io/clustjs/dist/sdk.mjs";

console.log("clustjs version:", clust.version);

const clusterContainerId = "clusterDiv";

// const sampleClusterData = [
//   { prs_breast_cancer: 1.2, prs_diabetes: 0.8, prs_cad: 1.1, label: "User A" },
//   { prs_breast_cancer: 1.1, prs_diabetes: 0.9, prs_cad: 1.0, label: "User B" },
//   { prs_breast_cancer: 2.4, prs_diabetes: 1.9, prs_cad: 2.1, label: "User C" },
//   { prs_breast_cancer: 2.5, prs_diabetes: 2.0, prs_cad: 2.2, label: "User D" }
// ];

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
 * Build allele matrix for clustering users by variants for a specific PGS entry.
 * Each row is a user, each column is a variant (rsid or chr:pos), values are allele counts (0, 1, 2).
 * Returns array of objects suitable for hclust_plot: [{label, variant1: alleleCount, variant2: alleleCount, ...}, ...]
 */
function buildAlleleMatrix(rawResults, targetPgsId) {
  if (!Array.isArray(rawResults) || rawResults.length === 0) return null;

  const variantSet = new Set();
  const userVariantMap = [];

  // Collect all variants and user data for the target PGS
  for (const result of rawResults) {
    if (result.pgsId !== targetPgsId) continue;
    if (!result.pgsMatchMy23 || !result.alleles) continue;

    const label = result.userName ?? result.userId ?? 'Unknown';
    const row = { label };

    // Get column indices from PGS data
    const pgsData = result.pgs;
    if (!pgsData || !pgsData.cols) continue;

    const indChr = pgsData.cols.indexOf('hm_chr');
    const indPos = pgsData.cols.indexOf('hm_pos');
    const indRsid = pgsData.cols.indexOf('rsID');

    // Map matched variants to allele counts
    result.pgsMatchMy23.forEach((matchEntry, idx) => {
      // Extract the PGS variant (last element in the match array)
      const pgsVariant = matchEntry.length >= 2 ? matchEntry[matchEntry.length - 1] : null;
      if (!pgsVariant) return;

      // Create variant identifier (prefer rsid, fallback to chr:pos)
      let variantId;
      if (indRsid >= 0 && pgsVariant[indRsid]) {
        variantId = pgsVariant[indRsid];
      } else if (indChr >= 0 && indPos >= 0) {
        variantId = `${pgsVariant[indChr]}:${pgsVariant[indPos]}`;
      } else {
        variantId = `var_${idx}`;
      }

      variantSet.add(variantId);
      row[variantId] = result.alleles[idx] ?? 0;
    });

    if (Object.keys(row).length > 1) {
      userVariantMap.push(row);
    }
  }

  if (userVariantMap.length < 2) return null;

  return userVariantMap;
}

async function renderCluster() {
  const clusterContainer = document.getElementById(clusterContainerId);
  if (!clusterContainer) return;

  const pivoted = pivotPrsResults(window.prsResults);
  const pgsIds = getUniquePgsIds(window.prsResults);
  
  // Show message if no PRS results available
  if (pivoted === null) {
    clusterContainer.innerHTML = `
      <div class="alert alert-info">
        <strong>No PRS results available.</strong><br>
        Please go to the <strong>Calculate PRS</strong> tab first and run a PRS calculation.
      </div>
    `;
    return;
  }

  // Get current clustering options (preserve state across re-renders)
  const clusterRows = window.clusterOptions?.clusterRows ?? true;
  const clusterCols = window.clusterOptions?.clusterCols ?? true;
  const selectedPgsId = window.clusterOptions?.selectedPgsId ?? pgsIds[0] ?? '';
  const clusterAlleleRows = window.clusterOptions?.clusterAlleleRows ?? true;
  const clusterAlleleCols = window.clusterOptions?.clusterAlleleCols ?? true;

  // Build allele matrix for selected PGS
  const alleleMatrix = selectedPgsId ? buildAlleleMatrix(window.prsResults, selectedPgsId) : null;

  clusterContainer.innerHTML = `
    <h5>PRS Clustering (Users × PGS Scores)</h5>
    <p class="text-muted small mb-3">
      Hierarchical clustering of PRS results (${pivoted.length} users × ${Object.keys(pivoted[0]).length - 1} PGS entries).
    </p>
    <div class="mb-3">
      <strong>Cluster by:</strong>
      <div class="btn-group ms-2" role="group">
        <button id="clusterRowsBtn" class="btn btn-sm ${clusterRows ? 'btn-primary' : 'btn-outline-primary'}">Rows (Users)</button>
        <button id="clusterColsBtn" class="btn btn-sm ${clusterCols ? 'btn-primary' : 'btn-outline-primary'}">Columns (PGS)</button>
        <button id="clusterBothBtn" class="btn btn-sm ${clusterRows && clusterCols ? 'btn-success' : 'btn-outline-success'}">Both</button>
      </div>
    </div>
    <div id="clusterPlotMount"></div>

    <hr class="my-4" />

    <h5>Allele Clustering (Users × Variants for Single PGS)</h5>
    <p class="text-muted small mb-2">
      Cluster users by allele counts (0, 1, 2) for variants in a single PGS entry.
    </p>
    <div class="mb-3">
      <label for="pgsSelectDropdown" class="form-label"><strong>Select PGS Entry:</strong></label>
      <select id="pgsSelectDropdown" class="form-select" style="max-width: 300px;">
        ${pgsIds.map(id => `<option value="${id}" ${id === selectedPgsId ? 'selected' : ''}>${id}</option>`).join('')}
      </select>
    </div>
    ${alleleMatrix ? `
      <p class="text-muted small mb-3">
        Clustering ${alleleMatrix.length} users × ${Object.keys(alleleMatrix[0]).length - 1} variants.
      </p>
      <div class="mb-3">
        <strong>Cluster by:</strong>
        <div class="btn-group ms-2" role="group">
          <button id="clusterAlleleRowsBtn" class="btn btn-sm ${clusterAlleleRows ? 'btn-primary' : 'btn-outline-primary'}">Rows (Users)</button>
          <button id="clusterAlleleColsBtn" class="btn btn-sm ${clusterAlleleCols ? 'btn-primary' : 'btn-outline-primary'}">Columns (Variants)</button>
          <button id="clusterAlleleBothBtn" class="btn btn-sm ${clusterAlleleRows && clusterAlleleCols ? 'btn-success' : 'btn-outline-success'}">Both</button>
        </div>
      </div>
      <div id="allelePlotMount"></div>
    ` : `
      <div class="alert alert-warning">
        ${selectedPgsId ? `Not enough data to cluster for ${selectedPgsId}. Need at least 2 users with matched variants.` : 'Select a PGS entry to view allele clustering.'}
      </div>
    `}
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

  // Attach dropdown handler
  document.getElementById('pgsSelectDropdown').onchange = (e) => {
    window.clusterOptions = { ...window.clusterOptions, selectedPgsId: e.target.value };
    renderCluster();
  };

  // Attach allele clustering button handlers
  if (alleleMatrix) {
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
  }

  // Render PRS cluster plot
  console.log("cluster plot data:", pivoted, "clusterRows:", clusterRows, "clusterCols:", clusterCols);
  await clust.hclust_plot({
    divid: "clusterPlotMount",
    data: pivoted,
    width: 700,
    height: 520,
    clusterRows: clusterRows,
    clusterCols: clusterCols
  });

  // Render allele cluster plot if data available
  if (alleleMatrix) {
    console.log("allele cluster data:", alleleMatrix, "clusterRows:", clusterAlleleRows, "clusterCols:", clusterAlleleCols);
    await clust.hclust_plot({
      divid: "allelePlotMount",
      data: alleleMatrix,
      width: 900,
      height: 520,
      clusterRows: clusterAlleleRows,
      clusterCols: clusterAlleleCols
    });
  }
}

window.renderCluster = renderCluster;