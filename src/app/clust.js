import * as clust from "../sdk/clustSdk.js";


const clusterContainerId = "clusterDiv";

// Caching mechanism to avoid redundant computations
// This is not persistent - it only lasts for the current browser session
let clusterCache = {
  prsResultsHash: null,      // Hash of prsResults to detect changes
  selectedPgsId: null,       // Last selected PGS ID
  selectedUserId: null,      // Last selected user ID
  pivoted: null,
  pgsIds: null,
  userIds: null,
  alleleMatrices: null,      // Cached allele matrices for selected PGS
  pgsVsSnpsMatrices: null,   // Cached PGS vs SNPs matrices for selected user
  effectMatrices: null,      // Cached effect weight matrices
  snpLists: null,            // Cached SNP lists
};

/**
 * Generate a simple hash of prsResults to detect changes
 */
function hashPrsResults(results) {
  if (!Array.isArray(results) || results.length === 0) return null;
  // Use length + sum of PRS values as a quick hash
  let hash = results.length;
  for (const r of results) {
    if (r.PRS != null && Number.isFinite(r.PRS)) {
      hash += r.PRS;
    }
  }
  return `${hash}-${results.length}`;
}

/**
 * Check if cache is valid for current data
 */
function isCacheValid(currentHash, selectedPgsId, selectedUserId) {
  return clusterCache.prsResultsHash === currentHash && 
         clusterCache.pivoted !== null;
}

/**
 * Invalidate the cluster cache (call when data changes)
 */
function invalidateClusterCache() {
  clusterCache = {
    prsResultsHash: null,
    selectedPgsId: null,
    selectedUserId: null,
    pivoted: null,
    pgsIds: null,
    userIds: null,
    alleleMatrices: null,
    pgsVsSnpsMatrices: null,
    effectMatrices: null,
    snpLists: null,
  };
  // console.log("Cluster cache invalidated");
}

// Expose cache invalidation globally so it can be called when PRS is recalculated
window.invalidateClusterCache = invalidateClusterCache;


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

  // console.log(`buildAlleleMatrix (${mode}):`, userVariantMap.length, "users,", allVariants.length, "variants, missingValue:", missingValue);

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
 * @param {Object} options - { missingValue: -1, mode: 'all' }
 * @param {string} mode - "all" (union of SNPs), "overlapping" (in ≥2 PGS), "shared" (in ALL PGS)
 */
function buildPgsVsSnpsMatrix(rawResults, targetUserId, { missingValue = -1, mode = 'all' } = {}) {
  const userResults = rawResults.filter(r => r.userId === targetUserId);

  if (!userResults.length || userResults.length < 2) return null;

  // First pass: collect SNPs per PGS entry and count occurrences
  const snpCounts = new Map(); // snpId -> count of PGS entries containing it
  const pgsSnpMaps = new Map(); // pgsId -> snpMap: Map<snpId, alleleCount> (deduplicated)

  for (const r of userResults) {
    if (!r.pgsMatchMy23 || !r.pgs?.cols) continue;
    if (pgsSnpMaps.has(r.pgsId)) continue; // Skip duplicates

    const pgsData = r.pgs;
    const indChr = pgsData.cols.indexOf('hm_chr');
    const indPos = pgsData.cols.indexOf('hm_pos');
    const indRsid = pgsData.cols.indexOf('rsID');

    const snpMap = new Map();
    const seenSnps = new Set();

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

      const val = r.alleles ? Number(r.alleles[idx]) : missingValue;
      snpMap.set(snpId, Number.isFinite(val) ? val : missingValue);

      if (!seenSnps.has(snpId)) {
        seenSnps.add(snpId);
        snpCounts.set(snpId, (snpCounts.get(snpId) || 0) + 1);
      }
    });

    pgsSnpMaps.set(r.pgsId, snpMap);
    //console.log(`Processed PGS ${r.pgsId} for user ${targetUserId}: ${snpMap.size} SNPs matched.`);
  }

  if (pgsSnpMaps.size < 2) return null;

  // Determine which SNPs to include based on mode
  const numPgs = pgsSnpMaps.size;
  let targetSnps;

  if (mode === 'shared') {
    // SNPs in ALL PGS entries
    targetSnps = [...snpCounts.entries()]
      .filter(([, count]) => count === numPgs)
      .map(([snp]) => snp);
  } else if (mode === 'overlapping') {
    // SNPs in ≥2 PGS entries
    targetSnps = [...snpCounts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([snp]) => snp);
  } else {
    // 'all' - union of all SNPs
    targetSnps = Array.from(snpCounts.keys());
  }

  if (targetSnps.length === 0) return null;

  // Build matrix
  const matrix = Array.from(pgsSnpMaps.entries()).map(([pgsId, snpMap]) => {
    const row = { label: pgsId };
    for (const snp of targetSnps) {
      row[snp] = snpMap.has(snp) ? snpMap.get(snp) : missingValue;
    }
    return row;
  });

  // console.log(`buildPgsVsSnpsMatrix (${mode}): ${matrix.length} PGS entries × ${targetSnps.length} SNPs for user ${targetUserId}`);
  return matrix;
}

// /** PGS x PGS matrix builder for clustering PGS entries by their SNP effect weights 
//  * Extract SNP data from a PGS entry.
//  * Returns a Map of snpId -> effect_weight
//  */
// function extractPgsSnpWeights(pgs) {
//   if (!pgs?.dt || !pgs?.cols) return new Map();
  
//   const indChr = pgs.cols.indexOf('hm_chr');
//   const indPos = pgs.cols.indexOf('hm_pos');
//   const indRsid = pgs.cols.indexOf('rsID');
//   const indWeight = pgs.cols.indexOf('effect_weight');
  
//   const snpData = new Map();
  
//   for (const variant of pgs.dt) {
//     let snpId;
//     if (indRsid >= 0 && variant[indRsid]) {
//       snpId = variant[indRsid];
//     } else if (indChr >= 0 && indPos >= 0) {
//       snpId = `${variant[indChr]}:${variant[indPos]}`;
//     }
//     if (!snpId) continue;
    
//     const weight = indWeight >= 0 ? parseFloat(variant[indWeight]) : 0;
//     if (Number.isFinite(weight)) {
//       snpData.set(snpId, weight);
//     }
//   }
  
//   return snpData;
// }
/** PGS x PGS matrix builder for clustering PGS entries by their SNP effect weights
 * Extract SNP effect weights from one PGS entry.
 * Returns Map<snpId, effect_weight>
 */
function extractPgsSnpWeights(pgs) {
  if (!pgs || !Array.isArray(pgs.dt) || !Array.isArray(pgs.cols)) {
    return new Map();
  }

  const indChr = pgs.cols.indexOf("hm_chr");
  const indPos = pgs.cols.indexOf("hm_pos");
  const indRsid = pgs.cols.indexOf("rsID");
  const indWeight = pgs.cols.indexOf("effect_weight");

  const snpData = new Map();

  for (const variant of pgs.dt) {
    if (!Array.isArray(variant)) continue;

    let snpId = null;

    if (indRsid >= 0) {
      const rawRsid = variant[indRsid];
      if (rawRsid != null) {
        const rsid = String(rawRsid).trim();
        if (rsid && rsid !== "." && rsid.toUpperCase() !== "NA") {
          snpId = rsid;
        }
      }
    }

    if (!snpId && indChr >= 0 && indPos >= 0) {
      const chr = variant[indChr];
      const pos = variant[indPos];

      if (chr != null && pos != null && String(chr).trim() && String(pos).trim()) {
        snpId = `${String(chr).trim()}:${String(pos).trim()}`;
      }
    }

    if (!snpId) continue;

    if (indWeight < 0) continue;

    const weight = parseFloat(variant[indWeight]);
    if (!Number.isFinite(weight)) continue;

    snpData.set(snpId, weight);
  }

  return snpData;
}


/**
 * Count how many PGS entries contain each SNP
 */
function countSnpsAcrossPgs(rawResults) {
  const counts = new Map();
  const seenPgs = new Set();
  
  for (const r of rawResults) {
    if (!r.pgsId || !r.pgs?.dt || seenPgs.has(r.pgsId)) continue;
    seenPgs.add(r.pgsId);
    
    const snpWeights = extractPgsSnpWeights(r.pgs);
    for (const snp of snpWeights.keys()) {
      counts.set(snp, (counts.get(snp) || 0) + 1);
    }
  }
  
  return counts;
}

/**
 * Get all unique SNPs across all PGS entries (union)
 */
function getAllSnpsFromPgs(rawResults) {
  const counts = countSnpsAcrossPgs(rawResults);
  return Array.from(counts.keys());
}

/**
 * Get SNPs that appear in at least 2 PGS entries
 */
function getOverlappingSnpsFromPgs(rawResults) {
  const counts = countSnpsAcrossPgs(rawResults);
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([snp]) => snp);
}

/**
 * Get SNPs that appear in ALL PGS entries
 */
function getSharedSnpsFromPgs(rawResults) {
  const counts = countSnpsAcrossPgs(rawResults);
  const pgsCount = getUniquePgsIds(rawResults).length;
  return [...counts.entries()]
    .filter(([, count]) => count === pgsCount)
    .map(([snp]) => snp);
}

/**
 * Z-score normalize rows of a matrix
 */
function zscoreRows(matrix) {
  return matrix.map(row => {
    if (!row.length) return row;
    const mean = row.reduce((a, b) => a + b, 0) / row.length;
    const std = Math.sqrt(row.reduce((a, b) => a + (b - mean) ** 2, 0) / row.length);
    return row.map(v => (v - mean) / (std || 1));
  });
}

/**
 * Build PGS × SNP effect weight matrix.
 * Rows = PGS entries, Columns = SNPs, Values = effect_weight (z-scored)
 * Returns object with { data, displayData, snpCount, pgsCount } for hclust_plot
 * - data: z-scored values with 0 for missing (for clustering)
 * - displayData: raw values with -1 for missing (for display, shows as black)
 */
function buildPgsEffectWeightMatrix(rawResults, snpList) {
  if (!snpList || snpList.length === 0) return null;
  
  // Get unique PGS entries
  const pgsMap = new Map();
  for (const r of rawResults) {
    if (r.pgsId && r.pgs?.dt && !pgsMap.has(r.pgsId)) {
      pgsMap.set(r.pgsId, r.pgs);
    }
  }
  
  const pgsIds = Array.from(pgsMap.keys());
  if (pgsIds.length < 2) return null;
  
  // Build raw matrix (rows = PGS, cols = SNPs)
  // Track which cells are missing (SNP not in that PGS)
  const rawMatrix = [];
  const missingMask = []; // true if missing
  for (const pgsId of pgsIds) {
    const pgs = pgsMap.get(pgsId);
    const snpWeights = extractPgsSnpWeights(pgs);
    const row = [];
    const maskRow = [];
    for (const snp of snpList) {
      if (snpWeights.has(snp)) {
        row.push(snpWeights.get(snp));
        maskRow.push(false);
      } else {
        row.push(0); // Use 0 for clustering
        maskRow.push(true);
      }
    }
    rawMatrix.push(row);
    missingMask.push(maskRow);
  }
  
  // Remove constant columns (all same value)
  const keepCols = [];
  for (let j = 0; j < snpList.length; j++) {
    const col = rawMatrix.map(row => row[j]);
    const mean = col.reduce((a, b) => a + b, 0) / col.length;
    const variance = col.reduce((a, b) => a + (b - mean) ** 2, 0) / col.length;
    if (variance > 1e-10) keepCols.push(j);
  }
  
  const filteredSnps = keepCols.map(j => snpList[j]);
  const filteredMatrix = rawMatrix.map(row => keepCols.map(j => row[j]));
  const filteredMask = missingMask.map(row => keepCols.map(j => row[j]));
  
  if (filteredSnps.length === 0) return null;
  
  // Z-score normalize rows
  const zMatrix = zscoreRows(filteredMatrix);
  
  // Convert to hclust_plot format: [{label, snp1: val, snp2: val, ...}, ...]
  const data = pgsIds.map((pgsId, i) => {
    const row = { label: pgsId };
    filteredSnps.forEach((snp, j) => {
      row[snp] = zMatrix[i][j];
    });
    return row;
  });
  
  // Build display data with -1 for missing (shows as black)
  const displayData = pgsIds.map((pgsId, i) => {
    const row = { label: pgsId };
    filteredSnps.forEach((snp, j) => {
      row[snp] = filteredMask[i][j] ? -1 : filteredMatrix[i][j];
    });
    return row;
  });
  
  // console.log(`buildPgsEffectWeightMatrix: ${pgsIds.length} PGS × ${filteredSnps.length} SNPs (from ${snpList.length} input)`);
  
  return { data, displayData, snpCount: filteredSnps.length, pgsCount: pgsIds.length };
}


async function renderCluster() {
  const clusterContainer = document.getElementById(clusterContainerId);
  if (!clusterContainer) return;

  // Check cache validity
  const currentHash = hashPrsResults(window.prsResults);
  const cacheValid = isCacheValid(currentHash);
  
  // Show loading state immediately if we need to compute (not cached)
  const needsCompute = !cacheValid || !clusterCache.pivoted;
  if (needsCompute) {
    clusterContainer.innerHTML = `
      <div class="d-flex flex-column align-items-center justify-content-center py-5">
        <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="text-muted loading-message">Loading cluster analysis...</p>
      </div>
    `;
    // Allow the loading UI to render before heavy computation
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 10)));
  }
  
  // Use cached or compute fresh data
  let pivoted, pgsIds, userIds;
  if (cacheValid && clusterCache.pivoted) {
    pivoted = clusterCache.pivoted;
    pgsIds = clusterCache.pgsIds;
    userIds = clusterCache.userIds;
    // console.log("Using cached base data for cluster tab");
  } else {
    // console.log("Computing fresh base data for cluster tab");
    pivoted = pivotPrsResults(window.prsResults);
    pgsIds = getUniquePgsIds(window.prsResults);
    userIds = getUniqueUserIds(window.prsResults);
    // Update cache
    clusterCache.prsResultsHash = currentHash;
    clusterCache.pivoted = pivoted;
    clusterCache.pgsIds = pgsIds;
    clusterCache.userIds = userIds;
    // Invalidate dependent caches when base data changes
    clusterCache.alleleMatrices = null;
    clusterCache.pgsVsSnpsMatrices = null;
    clusterCache.effectMatrices = null;
    clusterCache.snpLists = null;
  }
  
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

  // PGS × SNP Effect Weight clustering options
  const effectClusterRows = window.clusterOptions?.effectClusterRows ?? true;
  const effectClusterCols = window.clusterOptions?.effectClusterCols ?? false;

  // Helper to update loading message
  const updateLoading = async (message) => {
    const loadingEl = clusterContainer.querySelector('.loading-message');
    if (loadingEl) loadingEl.textContent = message;
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  };

  // Build allele matrices for selected PGS - three views (with caching)
  let allMatrix, allMatrixDisplay, overlapMatrix, overlapMatrixDisplay, sharedMatrix, sharedMatrixDisplay;
  
  const allelesCacheKey = `${currentHash}-${selectedPgsId}`;
  if (clusterCache.alleleMatrices?.cacheKey === allelesCacheKey) {
    // console.log("Using cached allele matrices");
    ({ allMatrix, allMatrixDisplay, overlapMatrix, overlapMatrixDisplay, sharedMatrix, sharedMatrixDisplay } = clusterCache.alleleMatrices);
  } else if (selectedPgsId) {
    await updateLoading("Building allele matrices...");
    // console.log("Computing fresh allele matrices for", selectedPgsId);
    allMatrix = buildAlleleMatrix(window.prsResults, selectedPgsId, { mode: 'all', missingValue: 0 });
    allMatrixDisplay = buildAlleleMatrix(window.prsResults, selectedPgsId, { mode: 'all', missingValue: -1 });
    overlapMatrix = buildAlleleMatrix(window.prsResults, selectedPgsId, { mode: 'overlapping', missingValue: 0 });
    overlapMatrixDisplay = buildAlleleMatrix(window.prsResults, selectedPgsId, { mode: 'overlapping', missingValue: -1 });
    sharedMatrix = buildAlleleMatrix(window.prsResults, selectedPgsId, { mode: 'shared', missingValue: 0 });
    sharedMatrixDisplay = buildAlleleMatrix(window.prsResults, selectedPgsId, { mode: 'shared', missingValue: -1 });
    clusterCache.alleleMatrices = { cacheKey: allelesCacheKey, allMatrix, allMatrixDisplay, overlapMatrix, overlapMatrixDisplay, sharedMatrix, sharedMatrixDisplay };
  }

  const totalVariants = getTotalVariants(window.prsResults, selectedPgsId);
  const allCount = allMatrix ? Object.keys(allMatrix[0]).length - 1 : 0;
  const overlapCount = overlapMatrix ? Object.keys(overlapMatrix[0]).length - 1 : 0;
  const sharedCount = sharedMatrix ? Object.keys(sharedMatrix[0]).length - 1 : 0;
  const sharedPct = totalVariants > 0 ? ((sharedCount / totalVariants) * 100).toFixed(1) : '0.0';
  const overlapPct = totalVariants > 0 ? ((overlapCount / totalVariants) * 100).toFixed(1) : '0.0';

  // Build PGS vs SNPs matrices for selected user - three views (with caching)
  let pgsVsSnpsAllMatrix, pgsVsSnpsAllMatrixDisplay, pgsVsSnpsOverlapMatrix, pgsVsSnpsOverlapMatrixDisplay, pgsVsSnpsSharedMatrix, pgsVsSnpsSharedMatrixDisplay;
  
  const pgsVsSnpsCacheKey = `${currentHash}-${selectedUserId}`;
  if (clusterCache.pgsVsSnpsMatrices?.cacheKey === pgsVsSnpsCacheKey) {
    // console.log("Using cached PGS vs SNPs matrices");
    ({ pgsVsSnpsAllMatrix, pgsVsSnpsAllMatrixDisplay, pgsVsSnpsOverlapMatrix, pgsVsSnpsOverlapMatrixDisplay, pgsVsSnpsSharedMatrix, pgsVsSnpsSharedMatrixDisplay } = clusterCache.pgsVsSnpsMatrices);
  } else if (selectedUserId) {
    await updateLoading("Building PGS vs SNPs matrices...");
    // console.log("Computing fresh PGS vs SNPs matrices for", selectedUserId);
    pgsVsSnpsAllMatrix = buildPgsVsSnpsMatrix(window.prsResults, selectedUserId, { missingValue: 0, mode: 'all' });
    pgsVsSnpsAllMatrixDisplay = buildPgsVsSnpsMatrix(window.prsResults, selectedUserId, { missingValue: -1, mode: 'all' });
    pgsVsSnpsOverlapMatrix = buildPgsVsSnpsMatrix(window.prsResults, selectedUserId, { missingValue: 0, mode: 'overlapping' });
    pgsVsSnpsOverlapMatrixDisplay = buildPgsVsSnpsMatrix(window.prsResults, selectedUserId, { missingValue: -1, mode: 'overlapping' });
    pgsVsSnpsSharedMatrix = buildPgsVsSnpsMatrix(window.prsResults, selectedUserId, { missingValue: 0, mode: 'shared' });
    pgsVsSnpsSharedMatrixDisplay = buildPgsVsSnpsMatrix(window.prsResults, selectedUserId, { missingValue: -1, mode: 'shared' });
    clusterCache.pgsVsSnpsMatrices = { cacheKey: pgsVsSnpsCacheKey, pgsVsSnpsAllMatrix, pgsVsSnpsAllMatrixDisplay, pgsVsSnpsOverlapMatrix, pgsVsSnpsOverlapMatrixDisplay, pgsVsSnpsSharedMatrix, pgsVsSnpsSharedMatrixDisplay };
  }
  
  const pgsVsSnpsAllCount = pgsVsSnpsAllMatrix ? Object.keys(pgsVsSnpsAllMatrix[0]).length - 1 : 0;
  const pgsVsSnpsOverlapCount = pgsVsSnpsOverlapMatrix ? Object.keys(pgsVsSnpsOverlapMatrix[0]).length - 1 : 0;
  const pgsVsSnpsSharedCount = pgsVsSnpsSharedMatrix ? Object.keys(pgsVsSnpsSharedMatrix[0]).length - 1 : 0;
  const pgsVsSnpsPgsCount = pgsVsSnpsAllMatrix ? pgsVsSnpsAllMatrix.length : 0;
  const selectedUserName = userIds.find(u => u.id === selectedUserId)?.name ?? selectedUserId;

  // Build PGS × SNP effect weight matrices (three views) - with caching
  let allSnpsList, overlapSnpsList, sharedSnpsList, pgsEffectAll, pgsEffectOverlap, pgsEffectShared;
  
  const effectCacheKey = currentHash;
  if (clusterCache.effectMatrices?.cacheKey === effectCacheKey) {
    // console.log("Using cached effect weight matrices");
    ({ allSnpsList, overlapSnpsList, sharedSnpsList } = clusterCache.snpLists);
    ({ pgsEffectAll, pgsEffectOverlap, pgsEffectShared } = clusterCache.effectMatrices);
  } else {
    await updateLoading("Building effect weight matrices...");
    // console.log("Computing fresh effect weight matrices");
    allSnpsList = getAllSnpsFromPgs(window.prsResults);
    overlapSnpsList = getOverlappingSnpsFromPgs(window.prsResults);
    sharedSnpsList = getSharedSnpsFromPgs(window.prsResults);
    pgsEffectAll = buildPgsEffectWeightMatrix(window.prsResults, allSnpsList);
    pgsEffectOverlap = buildPgsEffectWeightMatrix(window.prsResults, overlapSnpsList);
    pgsEffectShared = buildPgsEffectWeightMatrix(window.prsResults, sharedSnpsList);
    clusterCache.snpLists = { allSnpsList, overlapSnpsList, sharedSnpsList };
    clusterCache.effectMatrices = { cacheKey: effectCacheKey, pgsEffectAll, pgsEffectOverlap, pgsEffectShared };
  }
  
  const pgsEffectPgsCount = pgsEffectAll?.pgsCount ?? 0;

//  console.log("window.prsResults",window.prsResults)

  // Update loading message before rendering
  await updateLoading("Rendering clusters...");

  clusterContainer.innerHTML = `
    <h5>A. PRS Clustering (${pivoted.length} Users × ${Object.keys(pivoted[0]).length - 1} PGS Entries)</h5>
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

    <h5>B. Users x one PGS, allele counts (${pivoted.length} Users × ${totalVariants} Variants for ${selectedPgsId})</h5>
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

    <h5>C. PGS vs One user, allele counts(${pgsVsSnpsPgsCount} PGS Entries for ${selectedUserName})</h5>
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

    <div class="mb-3">
      <p class="small">
        <strong>All SNPs:</strong> ${pgsVsSnpsAllCount} | 
        <strong>Overlapping (≥2 PGS):</strong> ${pgsVsSnpsOverlapCount} | 
        <strong>Shared (all PGS):</strong> ${pgsVsSnpsSharedCount}
      </p>
    </div>

    <!-- 1. All SNPs -->
    <div class="card mb-4">
      <div class="card-header"><strong>1. All SNPs</strong> <span class="text-muted small">— Union of all matched SNPs across PGS entries</span></div>
      <div class="card-body">
        ${pgsVsSnpsAllMatrix ? `
          <p class="text-muted small mb-2">${pgsVsSnpsPgsCount} PGS entries × ${pgsVsSnpsAllCount} SNPs</p>
          <div id="pgsVsSnpsAllPlot"></div>
        ` : `<div class="alert alert-warning mb-0">Not enough PGS entries (need ≥2) or no matched SNPs for this user.</div>`}
      </div>
    </div>

    <!-- 2. Overlapping SNPs -->
    <div class="card mb-4">
      <div class="card-header"><strong>2. Overlapping SNPs</strong> <span class="text-muted small">— SNPs matched in ≥2 PGS entries</span></div>
      <div class="card-body">
        ${pgsVsSnpsOverlapMatrix ? `
          <p class="text-muted small mb-2">${pgsVsSnpsPgsCount} PGS entries × ${pgsVsSnpsOverlapCount} SNPs</p>
          <div id="pgsVsSnpsOverlapPlot"></div>
        ` : `<div class="alert alert-warning mb-0">No overlapping SNPs found across PGS entries for this user.</div>`}
      </div>
    </div>

    <!-- 3. Shared SNPs -->
    <div class="card mb-4">
      <div class="card-header"><strong>3. Shared SNPs (All PGS)</strong> <span class="text-muted small">— SNPs matched in ALL PGS entries</span></div>
      <div class="card-body">
        ${pgsVsSnpsSharedMatrix ? `
          <p class="text-muted small mb-2">${pgsVsSnpsPgsCount} PGS entries × ${pgsVsSnpsSharedCount} SNPs</p>
          <div id="pgsVsSnpsSharedPlot"></div>
        ` : `<div class="alert alert-warning mb-0">No SNPs shared across all PGS entries for this user.</div>`}
      </div>
    </div>

    <hr class="my-4" />

    <h5>D. PGS × PGS effect wirghts (${pgsEffectPgsCount} PGS Entries)</h5>
    <p class="text-muted small mb-2">
      Cluster PGS entries by their SNP effect weights (z-scored). Rows = PGS, Columns = SNPs, Values = effect_weight.
    </p>

    <div class="mb-3">
      <strong>Cluster by:</strong>
      <div class="btn-group ms-2" role="group">
        <button id="effectClusterRowsBtn" class="btn btn-sm ${effectClusterRows ? 'btn-primary' : 'btn-outline-primary'}">Rows (PGS)</button>
        <button id="effectClusterColsBtn" class="btn btn-sm ${effectClusterCols ? 'btn-primary' : 'btn-outline-primary'}">Columns (SNPs)</button>
        <button id="effectClusterBothBtn" class="btn btn-sm ${effectClusterRows && effectClusterCols ? 'btn-success' : 'btn-outline-success'}">Both</button>
      </div>
      <span class="text-muted small ms-2">(Column clustering may be slow with many SNPs)</span>
    </div>

    <div class="mb-3">
      <p class="small">
        <strong>All SNPs:</strong> ${allSnpsList.length} | 
        <strong>Overlapping (≥2 PGS):</strong> ${overlapSnpsList.length} | 
        <strong>Shared (all PGS):</strong> ${sharedSnpsList.length}
      </p>
    </div>

    <!-- 1. All SNPs Effect Weight -->
    <div class="card mb-4">
      <div class="card-header"><strong>1. All SNPs</strong> <span class="text-muted small">— Union of all SNPs across PGS entries</span></div>
      <div class="card-body">
        ${pgsEffectAll ? `
          <p class="text-muted small mb-2">${pgsEffectAll.pgsCount} PGS × ${pgsEffectAll.snpCount} SNPs (after removing constant columns)</p>
          <div id="pgsEffectAllPlot"></div>
        ` : `<div class="alert alert-warning mb-0">Not enough PGS entries or no variable SNPs.</div>`}
      </div>
    </div>

    <!-- 2. Overlapping SNPs Effect Weight -->
    <div class="card mb-4">
      <div class="card-header"><strong>2. Overlapping SNPs</strong> <span class="text-muted small">— SNPs found in ≥2 PGS entries</span></div>
      <div class="card-body">
        ${pgsEffectOverlap ? `
          <p class="text-muted small mb-2">${pgsEffectOverlap.pgsCount} PGS × ${pgsEffectOverlap.snpCount} SNPs</p>
          <div id="pgsEffectOverlapPlot"></div>
        ` : `<div class="alert alert-warning mb-0">No overlapping SNPs found across PGS entries.</div>`}
      </div>
    </div>

    <!-- 3. Shared SNPs Effect Weight -->
    <div class="card mb-4">
      <div class="card-header"><strong>3. Shared SNPs (All PGS)</strong> <span class="text-muted small">— SNPs found in every PGS entry</span></div>
      <div class="card-body">
        ${pgsEffectShared ? `
          <p class="text-muted small mb-2">${pgsEffectShared.pgsCount} PGS × ${pgsEffectShared.snpCount} SNPs</p>
          <div id="pgsEffectSharedPlot"></div>
        ` : `<div class="alert alert-warning mb-0">No SNPs shared across all PGS entries.</div>`}
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

  // PGS × SNP Effect Weight clustering button handlers
  document.getElementById('effectClusterRowsBtn').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, effectClusterRows: !effectClusterRows, effectClusterCols };
    renderCluster();
  };
  document.getElementById('effectClusterColsBtn').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, effectClusterRows, effectClusterCols: !effectClusterCols };
    renderCluster();
  };
  document.getElementById('effectClusterBothBtn').onclick = () => {
    const bothOn = effectClusterRows && effectClusterCols;
    window.clusterOptions = { ...window.clusterOptions, effectClusterRows: !bothOn, effectClusterCols: !bothOn };
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
  const greenColorScale = clust.d3.scaleLinear().domain([0, 1, 2]).range(["#f7fcf5", "#74c476", "#006d2c"]);

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

  // Render PGS vs SNPs plots (three views)
  if (pgsVsSnpsAllMatrix && pgsVsSnpsAllMatrix.length >= 2) {
    await clust.hclust_plot({
      divid: "pgsVsSnpsAllPlot",
      data: pgsVsSnpsAllMatrix,
      displayData: pgsVsSnpsAllMatrixDisplay,
      width: 900,
      height: 350,
      clusterRows: pgsVsSnpsClusterRows,
      clusterCols: pgsVsSnpsClusterCols,
      heatmapColorScale: greenColorScale,
      clusteringMethodRows: alleleClusterMethod,
      clusteringMethodCols: alleleClusterMethod,
      clusteringDistanceRows: alleleClusterDistance,
      clusteringDistanceCols: alleleClusterDistance
    });
  }

  if (pgsVsSnpsOverlapMatrix && pgsVsSnpsOverlapMatrix.length >= 2) {
    await clust.hclust_plot({
      divid: "pgsVsSnpsOverlapPlot",
      data: pgsVsSnpsOverlapMatrix,
      displayData: pgsVsSnpsOverlapMatrixDisplay,
      width: 900,
      height: 350,
      clusterRows: pgsVsSnpsClusterRows,
      clusterCols: pgsVsSnpsClusterCols,
      heatmapColorScale: greenColorScale,
      clusteringMethodRows: alleleClusterMethod,
      clusteringMethodCols: alleleClusterMethod,
      clusteringDistanceRows: alleleClusterDistance,
      clusteringDistanceCols: alleleClusterDistance
    });
  }

  if (pgsVsSnpsSharedMatrix && pgsVsSnpsSharedMatrix.length >= 2 && Object.keys(pgsVsSnpsSharedMatrix[0]).length > 1) {
    await clust.hclust_plot({
      divid: "pgsVsSnpsSharedPlot",
      data: pgsVsSnpsSharedMatrix,
      displayData: pgsVsSnpsSharedMatrixDisplay,
      width: 900,
      height: 350,
      clusterRows: pgsVsSnpsClusterRows,
      clusterCols: pgsVsSnpsClusterCols,
      heatmapColorScale: greenColorScale,
      clusteringMethodRows: alleleClusterMethod,
      clusteringMethodCols: alleleClusterMethod,
      clusteringDistanceRows: alleleClusterDistance,
      clusteringDistanceCols: alleleClusterDistance
    });
  }

  // Color scale for effect weights (diverging: negative = blue, zero = white, positive = red)
  // Dynamically calculate domain based on actual data range
  const extractValues = (dataArr) => {
    if (!dataArr) return [];
    return dataArr.flatMap(row => 
      Object.entries(row).filter(([k]) => k !== 'label').map(([, v]) => v)
    );
  };
  const allEffectValues = [
    ...extractValues(pgsEffectAll?.data),
    ...extractValues(pgsEffectOverlap?.data),
    ...extractValues(pgsEffectShared?.data)
  ].filter(Number.isFinite);
  

  // max absolute effect size across your data (using tighter percentiles for better contrast)
  const percentile = (arr, p) => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.min(Math.floor(p * sorted.length), sorted.length - 1);
    return sorted[idx];
  };

  const effectExtent = allEffectValues.length > 0
    ? Math.max(
        Math.abs(percentile(allEffectValues, 0.15)),
        Math.abs(percentile(allEffectValues, 0.85)),
        0.1
      )
    : 2;

  const effectColorScale = clust.d3.scaleLinear()
    .domain([-effectExtent, 0, effectExtent])
    .range(["#2166ac", "#f7f7f7", "#b2182b"]);
    
  // Render PGS Effect Weight plots (All, Overlapping, Shared)
  if (pgsEffectAll && pgsEffectAll.data.length >= 2) {
    await clust.hclust_plot({
      divid: "pgsEffectAllPlot",
      data: pgsEffectAll.data,
      displayData: pgsEffectAll.displayData,
      width: 900,
      height: 350,
      clusterRows: effectClusterRows,
      clusterCols: effectClusterCols,
      heatmapColorScale: effectColorScale,
      clusteringMethodRows: clusterMethod,
      clusteringMethodCols: clusterMethod,
      clusteringDistanceRows: clusterDistance,
      clusteringDistanceCols: clusterDistance
    });
  }

  if (pgsEffectOverlap && pgsEffectOverlap.data.length >= 2) {
    await clust.hclust_plot({
      divid: "pgsEffectOverlapPlot",
      data: pgsEffectOverlap.data,
      displayData: pgsEffectOverlap.displayData,
      width: 900,
      height: 350,
      clusterRows: effectClusterRows,
      clusterCols: effectClusterCols,
      heatmapColorScale: effectColorScale,
      clusteringMethodRows: clusterMethod,
      clusteringMethodCols: clusterMethod,
      clusteringDistanceRows: clusterDistance,
      clusteringDistanceCols: clusterDistance
    });
  }

  if (pgsEffectShared && pgsEffectShared.data.length >= 2) {
    await clust.hclust_plot({
      divid: "pgsEffectSharedPlot",
      data: pgsEffectShared.data,
      displayData: pgsEffectShared.displayData,
      width: 900,
      height: 350,
      clusterRows: effectClusterRows,
      clusterCols: effectClusterCols,
      heatmapColorScale: effectColorScale,
      clusteringMethodRows: clusterMethod,
      clusteringMethodCols: clusterMethod,
      clusteringDistanceRows: clusterDistance,
      clusteringDistanceCols: clusterDistance
    });
  }
}

window.renderCluster = renderCluster;

Object.defineProperty(window, "pivoted", {
  get() {
    return clusterCache.pivoted;
  },
  configurable: true,
});

Object.defineProperty(window, "clusterCache", {
  get() {
    return clusterCache;
  },
  configurable: true,
});