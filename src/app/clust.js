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

/**
 * Get unique user IDs from prsResults
 */
function getUniqueUserIds(rawResults) {
  if (!Array.isArray(rawResults)) return [];
  const users = new Map();
  for (const r of rawResults) {
    if (r.userId && !users.has(r.userId)) {
      users.set(r.userId, r.userName ?? r.userId);
    }
  }
  return Array.from(users.entries()).map(([id, name]) => ({ id, name }));
}

/**
 * Build matrix for clustering PGS entries (rows) by SNPs (columns) for a single user.
 * Each row is a PGS entry, each column is a SNP (rsid or chr:pos), values are allele counts.
 * @param {Array} rawResults - window.prsResults
 * @param {string} targetUserId - The user ID to filter by
 * @param {Object} options - { missingValue: -1 }
 */
function buildPgsVsSnpsMatrix(rawResults, targetUserId, { missingValue = -1 } = {}) {
  const userResults = rawResults.filter(r => r.userId === targetUserId);

  if (!userResults.length || userResults.length < 2) return null;

  const allSnps = new Set();

  // Collect all SNPs across all PGS entries for this user
  for (const r of userResults) {
    if (!r.pgsMatchMy23 || !r.pgs?.cols) continue;

    const pgsData = r.pgs;
    const indChr = pgsData.cols.indexOf('hm_chr');
    const indPos = pgsData.cols.indexOf('hm_pos');
    const indRsid = pgsData.cols.indexOf('rsID');

    r.pgsMatchMy23.forEach((matchEntry, idx) => {
      const pgsVariant = matchEntry.length >= 2 ? matchEntry[matchEntry.length - 1] : null;
      if (!pgsVariant) return;

      let snpId;
      if (indRsid >= 0 && pgsVariant[indRsid]) {
        snpId = pgsVariant[indRsid];
      } else if (indChr >= 0 && indPos >= 0) {
        snpId = `${pgsVariant[indChr]}:${pgsVariant[indPos]}`;
      } else {
        snpId = `var_${idx}`;
      }
      allSnps.add(snpId);
    });
  }

  if (allSnps.size === 0) return null;

  const snpList = Array.from(allSnps);
  const matrix = [];

  for (const r of userResults) {
    const row = { label: r.pgsId };
    const snpMap = new Map();

    if (r.pgsMatchMy23 && r.alleles && r.pgs?.cols) {
      const pgsData = r.pgs;
      const indChr = pgsData.cols.indexOf('hm_chr');
      const indPos = pgsData.cols.indexOf('hm_pos');
      const indRsid = pgsData.cols.indexOf('rsID');

      r.pgsMatchMy23.forEach((matchEntry, idx) => {
        const pgsVariant = matchEntry.length >= 2 ? matchEntry[matchEntry.length - 1] : null;
        if (!pgsVariant) return;

        let snpId;
        if (indRsid >= 0 && pgsVariant[indRsid]) {
          snpId = pgsVariant[indRsid];
        } else if (indChr >= 0 && indPos >= 0) {
          snpId = `${pgsVariant[indChr]}:${pgsVariant[indPos]}`;
        } else {
          snpId = `var_${idx}`;
        }

        const val = Number(r.alleles[idx]);
        snpMap.set(snpId, Number.isFinite(val) ? val : missingValue);
      });
    }

    for (const snp of snpList) {
      row[snp] = snpMap.has(snp) ? snpMap.get(snp) : missingValue;
    }

    matrix.push(row);
  }

  console.log(`buildPgsVsSnpsMatrix: ${matrix.length} PGS entries × ${snpList.length} SNPs for user ${targetUserId}`);
  return matrix;
}

/** PGS x PGS similarity matrices *
 * Extract SNP data from a PGS entry.
 * Returns a Map of snpId -> { weight, effectAllele }
 */
function extractPgsSnpData(pgs) {
  if (!pgs?.dt || !pgs?.cols) return new Map();
  
  const indChr = pgs.cols.indexOf('hm_chr');
  const indPos = pgs.cols.indexOf('hm_pos');
  const indRsid = pgs.cols.indexOf('rsID');
  const indWeight = pgs.cols.indexOf('effect_weight');
  const indEffectAllele = pgs.cols.indexOf('effect_allele');
  
  const snpData = new Map();
  
  for (const variant of pgs.dt) {
    let snpId;
    if (indRsid >= 0 && variant[indRsid]) {
      snpId = variant[indRsid];
    } else if (indChr >= 0 && indPos >= 0) {
      snpId = `${variant[indChr]}:${variant[indPos]}`;
    }
    if (!snpId) continue;
    
    const weight = indWeight >= 0 ? parseFloat(variant[indWeight]) : 0;
    const effectAllele = indEffectAllele >= 0 ? variant[indEffectAllele] : '';
    
    snpData.set(snpId, { weight, effectAllele });
  }
  
  return snpData;
}

/**
 * Build PGS-to-PGS Jaccard similarity matrix based on SNP overlap only.
 * Jaccard = |intersection| / |union|
 * Ignores effect weights - just checks if SNPs are shared.
 */
function buildPgsJaccardMatrix(rawResults) {
  // Get unique PGS entries (one per pgsId)
  const pgsMap = new Map();
  for (const r of rawResults) {
    if (r.pgsId && r.pgs?.dt && !pgsMap.has(r.pgsId)) {
      pgsMap.set(r.pgsId, r.pgs);
    }
  }
  
  const pgsIds = Array.from(pgsMap.keys());
  if (pgsIds.length < 2) return null;
  
  // Extract SNP sets for each PGS
  const snpSets = new Map();
  for (const [pgsId, pgs] of pgsMap) {
    const snpData = extractPgsSnpData(pgs);
    snpSets.set(pgsId, new Set(snpData.keys()));
  }
  
  // Build similarity matrix
  const matrix = [];
  for (const pgsI of pgsIds) {
    const row = { label: pgsI };
    const setI = snpSets.get(pgsI);
    
    for (const pgsJ of pgsIds) {
      const setJ = snpSets.get(pgsJ);
      const intersection = new Set([...setI].filter(x => setJ.has(x)));
      const union = new Set([...setI, ...setJ]);
      const jaccard = union.size > 0 ? intersection.size / union.size : 0;
      row[pgsJ] = jaccard; // similarity 0-1
    }
    matrix.push(row);
  }
  
  console.log(`buildPgsJaccardMatrix: ${matrix.length} PGS entries`);
  return matrix;
}

/**
 * Build PGS-to-PGS similarity matrix based on SNP overlap + effect direction.
 * Considers: shared SNPs AND whether effect weights have the same sign.
 * Score = (same_direction_count) / (shared_snps_count)
 */
function buildPgsDirectionMatrix(rawResults) {
  const pgsMap = new Map();
  for (const r of rawResults) {
    if (r.pgsId && r.pgs?.dt && !pgsMap.has(r.pgsId)) {
      pgsMap.set(r.pgsId, r.pgs);
    }
  }
  
  const pgsIds = Array.from(pgsMap.keys());
  if (pgsIds.length < 2) return null;
  
  // Extract SNP data (id -> {weight, effectAllele}) for each PGS
  const snpDataMap = new Map();
  for (const [pgsId, pgs] of pgsMap) {
    snpDataMap.set(pgsId, extractPgsSnpData(pgs));
  }
  
  // Build similarity matrix
  const matrix = [];
  for (const pgsI of pgsIds) {
    const row = { label: pgsI };
    const dataI = snpDataMap.get(pgsI);
    
    for (const pgsJ of pgsIds) {
      if (pgsI === pgsJ) {
        row[pgsJ] = 1; // perfect similarity with self
        continue;
      }
      
      const dataJ = snpDataMap.get(pgsJ);
      
      // Find shared SNPs
      const sharedSnps = [...dataI.keys()].filter(snp => dataJ.has(snp));
      
      if (sharedSnps.length === 0) {
        row[pgsJ] = 0;
        continue;
      }
      
      // Count SNPs with same direction (same sign of weight)
      let sameDirection = 0;
      for (const snp of sharedSnps) {
        const wI = dataI.get(snp).weight;
        const wJ = dataJ.get(snp).weight;
        if ((wI >= 0 && wJ >= 0) || (wI < 0 && wJ < 0)) {
          sameDirection++;
        }
      }
      
      // Similarity = fraction of shared SNPs with same direction
      // Weighted by overlap fraction
      const directionAgreement = sameDirection / sharedSnps.length;
      const overlapFraction = sharedSnps.length / Math.max(dataI.size, dataJ.size);
      row[pgsJ] = directionAgreement * overlapFraction;
    }
    matrix.push(row);
  }
  
  console.log(`buildPgsDirectionMatrix: ${matrix.length} PGS entries`);
  return matrix;
}

/**
 * Build PGS-to-PGS similarity matrix using effect weights as feature vectors.
 * Uses cosine similarity over the union of SNPs.
 * SNP not in a score → 0; SNP in score → effect weight
 */
function buildPgsWeightedMatrix(rawResults) {
  const pgsMap = new Map();
  for (const r of rawResults) {
    if (r.pgsId && r.pgs?.dt && !pgsMap.has(r.pgsId)) {
      pgsMap.set(r.pgsId, r.pgs);
    }
  }
  
  const pgsIds = Array.from(pgsMap.keys());
  if (pgsIds.length < 2) return null;
  
  // Extract SNP data for each PGS
  const snpDataMap = new Map();
  const allSnps = new Set();
  
  for (const [pgsId, pgs] of pgsMap) {
    const data = extractPgsSnpData(pgs);
    snpDataMap.set(pgsId, data);
    for (const snp of data.keys()) {
      allSnps.add(snp);
    }
  }
  
  const snpList = Array.from(allSnps);
  
  // Build weight vectors for each PGS
  const vectors = new Map();
  for (const pgsId of pgsIds) {
    const data = snpDataMap.get(pgsId);
    const vec = snpList.map(snp => data.has(snp) ? data.get(snp).weight : 0);
    vectors.set(pgsId, vec);
  }
  
  // Cosine similarity helper
  function cosineSim(a, b) {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);
    if (magA === 0 || magB === 0) return 0;
    return dot / (magA * magB);
  }
  
  // Build similarity matrix
  const matrix = [];
  for (const pgsI of pgsIds) {
    const row = { label: pgsI };
    const vecI = vectors.get(pgsI);
    
    for (const pgsJ of pgsIds) {
      const vecJ = vectors.get(pgsJ);
      const sim = cosineSim(vecI, vecJ);
      // Normalize to 0-1 range (cosine can be -1 to 1)
      row[pgsJ] = (sim + 1) / 2;
    }
    matrix.push(row);
  }
  
  console.log(`buildPgsWeightedMatrix: ${matrix.length} PGS entries, ${snpList.length} total SNPs`);
  return matrix;
}


async function renderCluster() {
  const clusterContainer = document.getElementById(clusterContainerId);
  if (!clusterContainer) return;

  const pivoted = pivotPrsResults(window.prsResults);
  const pgsIds = getUniquePgsIds(window.prsResults);
  const userIds = getUniqueUserIds(window.prsResults);
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
  
  // PGS vs SNPs clustering options (single user view)
  const selectedUserId = window.clusterOptions?.selectedUserId ?? (userIds[0]?.id ?? '');
  const pgsVsSnpsClusterRows = window.clusterOptions?.pgsVsSnpsClusterRows ?? true;
  const pgsVsSnpsClusterCols = window.clusterOptions?.pgsVsSnpsClusterCols ?? false;

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

  // Build PGS vs SNPs matrix for selected user
  const pgsVsSnpsMatrix = selectedUserId ? buildPgsVsSnpsMatrix(window.prsResults, selectedUserId, { missingValue: 0 }) : null;
  const pgsVsSnpsMatrixDisplay = selectedUserId ? buildPgsVsSnpsMatrix(window.prsResults, selectedUserId, { missingValue: -1 }) : null;
  const pgsVsSnpsCount = pgsVsSnpsMatrix ? Object.keys(pgsVsSnpsMatrix[0]).length - 1 : 0;
  const pgsVsSnpsPgsCount = pgsVsSnpsMatrix ? pgsVsSnpsMatrix.length : 0;
  const selectedUserName = userIds.find(u => u.id === selectedUserId)?.name ?? selectedUserId;

  // Build PGS-to-PGS similarity matrices
  const jaccardMatrix = buildPgsJaccardMatrix(window.prsResults);
  const directionMatrix = buildPgsDirectionMatrix(window.prsResults);
  const weightedMatrix = buildPgsWeightedMatrix(window.prsResults);
  const pgsSimilarityCount = jaccardMatrix ? jaccardMatrix.length : 0;

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

    <hr class="my-4" />

    <h5>PGS vs SNPs Clustering (${pgsVsSnpsPgsCount} PGS Entries × ${pgsVsSnpsCount} SNPs for ${selectedUserName})</h5>
    <p class="text-muted small mb-2">
      Cluster PGS entries by their matched SNP allele patterns for a single user. Rows = PGS entries, Columns = SNPs.
    </p>
    <div class="mb-3">
      <label for="userSelectDropdown" class="form-label"><strong>Select User:</strong></label>
      <select id="userSelectDropdown" class="form-select" style="max-width: 400px;">
        ${userIds.map(u => {
          const displayName = u.name !== u.id ? `${u.id} (${u.name})` : u.id;
          return `<option value="${u.id}" ${u.id === selectedUserId ? 'selected' : ''}>${displayName}</option>`;
        }).join('')}
      </select>
    </div>

    <div class="mb-3">
      <strong>Cluster by:</strong>
      <div class="btn-group ms-2" role="group">
        <button id="pgsVsSnpsRowsBtn" class="btn btn-sm ${pgsVsSnpsClusterRows ? 'btn-primary' : 'btn-outline-primary'}">Rows (PGS)</button>
        <button id="pgsVsSnpsColsBtn" class="btn btn-sm ${pgsVsSnpsClusterCols ? 'btn-primary' : 'btn-outline-primary'}">Columns (SNPs)</button>
        <button id="pgsVsSnpsBothBtn" class="btn btn-sm ${pgsVsSnpsClusterRows && pgsVsSnpsClusterCols ? 'btn-success' : 'btn-outline-success'}">Both</button>
      </div>
      <span class="text-muted small ms-2">(Note: Column clustering may be slow with many SNPs)</span>
    </div>

    <!-- PGS vs SNPs Plot -->
    <div class="card mb-4">
      <div class="card-header"><strong>PGS Entry Similarity by SNPs</strong> <span class="text-muted small">— How similar are PGS entries based on matched variants?</span></div>
      <div class="card-body">
        ${pgsVsSnpsMatrix ? `
          <p class="text-muted small mb-2">${pgsVsSnpsPgsCount} PGS entries × ${pgsVsSnpsCount} SNPs for user ${selectedUserName}</p>
          <div id="pgsVsSnpsPlot"></div>
        ` : `<div class="alert alert-warning mb-0">Not enough PGS entries (need ≥2) or no matched SNPs for this user.</div>`}
      </div>
    </div>

    <hr class="my-4" />

    <h5>PGS-to-PGS Similarity Network (${pgsSimilarityCount} × ${pgsSimilarityCount})</h5>
    <p class="text-muted small mb-2">
      Compare PGS entries to each other based on their SNP composition. Higher values (darker) = more similar.
    </p>

    <!-- 1. Jaccard Similarity -->
    <div class="card mb-4">
      <div class="card-header"><strong>1. Jaccard Similarity (SNP Overlap)</strong> <span class="text-muted small">— Simple overlap: shared SNPs / total unique SNPs</span></div>
      <div class="card-body">
        ${jaccardMatrix ? `
          <p class="text-muted small mb-2">Ignores effect weights. Good for checking redundancy between PGS entries.</p>
          <div id="jaccardPlot"></div>
        ` : `<div class="alert alert-warning mb-0">Need at least 2 PGS entries.</div>`}
      </div>
    </div>

    <!-- 2. Direction Similarity -->
    <div class="card mb-4">
      <div class="card-header"><strong>2. Effect Direction Agreement</strong> <span class="text-muted small">— Shared SNPs × same effect direction</span></div>
      <div class="card-body">
        ${directionMatrix ? `
          <p class="text-muted small mb-2">Considers both overlap AND whether effect weights point in the same direction (+ or -).</p>
          <div id="directionPlot"></div>
        ` : `<div class="alert alert-warning mb-0">Need at least 2 PGS entries.</div>`}
      </div>
    </div>

    <!-- 3. Weighted Cosine Similarity -->
    <div class="card mb-4">
      <div class="card-header"><strong>3. Weighted Similarity (Cosine)</strong> <span class="text-muted small">— Effect weight vectors over union of SNPs</span></div>
      <div class="card-body">
        ${weightedMatrix ? `
          <p class="text-muted small mb-2">Cosine similarity of effect weight vectors. SNP not in score = 0, otherwise = effect weight.</p>
          <div id="weightedPlot"></div>
        ` : `<div class="alert alert-warning mb-0">Need at least 2 PGS entries.</div>`}
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

  // Attach dropdown handler for PGS selection
  document.getElementById('pgsSelectDropdown').onchange = (e) => {
    window.clusterOptions = { ...window.clusterOptions, selectedPgsId: e.target.value };
    renderCluster();
  };

  // Attach dropdown handler for user selection (PGS vs SNPs)
  document.getElementById('userSelectDropdown').onchange = (e) => {
    window.clusterOptions = { ...window.clusterOptions, selectedUserId: e.target.value };
    renderCluster();
  };

  // PGS vs SNPs clustering button handlers
  document.getElementById('pgsVsSnpsRowsBtn').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, pgsVsSnpsClusterRows: !pgsVsSnpsClusterRows, pgsVsSnpsClusterCols };
    renderCluster();
  };
  document.getElementById('pgsVsSnpsColsBtn').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, pgsVsSnpsClusterRows, pgsVsSnpsClusterCols: !pgsVsSnpsClusterCols };
    renderCluster();
  };
  document.getElementById('pgsVsSnpsBothBtn').onclick = () => {
    const bothOn = pgsVsSnpsClusterRows && pgsVsSnpsClusterCols;
    window.clusterOptions = { ...window.clusterOptions, pgsVsSnpsClusterRows: !bothOn, pgsVsSnpsClusterCols: !bothOn };
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

  // Render PGS vs SNPs plot
  if (pgsVsSnpsMatrix && pgsVsSnpsMatrix.length >= 2) {
    await clust.hclust_plot({
      divid: "pgsVsSnpsPlot",
      data: pgsVsSnpsMatrix,
      displayData: pgsVsSnpsMatrixDisplay,
      width: 900,
      height: 350,
      clusterRows: pgsVsSnpsClusterRows,
      clusterCols: pgsVsSnpsClusterCols,
      heatmapColorScale: colorScale,
      clusteringMethodRows: alleleClusterMethod,
      clusteringMethodCols: alleleClusterMethod,
      clusteringDistanceRows: alleleClusterDistance,
      clusteringDistanceCols: alleleClusterDistance
    });
  }

  // Color scale for similarity matrices (0-1 range, blue gradient)
  const simColorScale = clust.d3.scaleLinear().domain([0, 0.5, 1]).range(["#f7fbff", "#6baed6", "#08306b"]);

  // Render 1. Jaccard Similarity plot
  if (jaccardMatrix && jaccardMatrix.length >= 2) {
    await clust.hclust_plot({
      divid: "jaccardPlot",
      data: jaccardMatrix,
      width: 500,
      height: 350,
      clusterRows: true,
      clusterCols: true,
      heatmapColorScale: simColorScale,
      clusteringMethodRows: clusterMethod,
      clusteringMethodCols: clusterMethod,
      clusteringDistanceRows: clusterDistance,
      clusteringDistanceCols: clusterDistance
    });
  }

  // Render 2. Direction Agreement plot
  if (directionMatrix && directionMatrix.length >= 2) {
    await clust.hclust_plot({
      divid: "directionPlot",
      data: directionMatrix,
      width: 500,
      height: 350,
      clusterRows: true,
      clusterCols: true,
      heatmapColorScale: simColorScale,
      clusteringMethodRows: clusterMethod,
      clusteringMethodCols: clusterMethod,
      clusteringDistanceRows: clusterDistance,
      clusteringDistanceCols: clusterDistance
    });
  }

  // Render 3. Weighted Cosine Similarity plot
  if (weightedMatrix && weightedMatrix.length >= 2) {
    await clust.hclust_plot({
      divid: "weightedPlot",
      data: weightedMatrix,
      width: 500,
      height: 350,
      clusterRows: true,
      clusterCols: true,
      heatmapColorScale: simColorScale,
      clusteringMethodRows: clusterMethod,
      clusteringMethodCols: clusterMethod,
      clusteringDistanceRows: clusterDistance,
      clusteringDistanceCols: clusterDistance
    });
  }
}

window.renderCluster = renderCluster;