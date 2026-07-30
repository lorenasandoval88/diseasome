import { hclust_plot } from "../sdk/clustSdk.js";
import d3ToPng from "d3-svg-to-png";

// clust.js adds the PRS Clustering tab for your PRS app.
//
// PRS-level clustering
// Converts PRS results into a user × PGS matrix.
// Rows = users.
// Columns = PGS entries.
// Values = PRS scores.
// Clusters users and/or PGS entries.
//
// It also includes:
// a caching system to avoid recomputing the pivoted matrix every time the tab rerenders
// buttons for row/column clustering
// linkage choices: complete, single, average, ward
// distance choices: euclidean, manhattan, cosine
// calls to hclust_plot() to render heatmap + dendrogram plots

const clusterContainerId = "clusterDiv";

// Caching mechanism to avoid redundant computations
// This is not persistent - it only lasts for the current browser session
let clusterCache = {
  prsResultsHash: null,      // Hash of prsResults to detect changes
  pivoted: null,
  pgsIds: null,
  userIds: null,
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
function isCacheValid(currentHash) {
  return clusterCache.prsResultsHash === currentHash &&
         clusterCache.pivoted !== null;
}

/**
 * Invalidate the cluster cache (call when data changes)
 */
function invalidateClusterCache() {
  clusterCache = {
    prsResultsHash: null,
    pivoted: null,
    pgsIds: null,
    userIds: null,
  };
  // console.log("Cluster cache invalidated");
}

// Expose cache invalidation globally so it can be called when PRS is recalculated
window.invalidateClusterCache = invalidateClusterCache;

// Expose cluster cache via getter so AI Interpret tab can summarize clustering results.
// Uses a getter because invalidateClusterCache() reassigns the clusterCache variable.
window.getClusterCache = () => clusterCache;


/**
 * Find the user/participant object behind a PRS result id, looking in the users
 * loaded for the PRS calculation and in the Genomic Data tab selection.
 * @param {string} userId
 * @returns {Object|null}
 */
function findUserById(userId) {
  const matches = (id) => id != null && id === userId;
  const loaded = (window.loadedUsers ?? []).find(d => matches(d?.user?.id) || matches(d?.user?.participant_id));
  if (loaded?.user) return loaded.user;
  const selected = (window.getSelectedUsers?.() ?? []).find(u => matches(u?.id) || matches(u?.participant_id));
  return selected ?? null;
}

/**
 * Build the 23andMe array-version prefix for a user, e.g. "v5" or "v4_v5" when the
 * participant has files from more than one chip version. Versions come from the
 * curated metadata (user.version / genotypes[].version) or, failing that, are
 * inferred from the filename/URL (…_v5_Full_….txt).
 * @param {string} userId
 * @returns {string} "v5", "v4_v5", or "" when no version is known
 */
function getUserVersionPrefix(userId) {
  const user = findUserById(userId);
  if (!user) return '';

  const genos = Array.isArray(user.genotypes) ? user.genotypes : [];
  const versions = new Set();

  const addVersion = (value) => {
    const m = String(value ?? '').match(/^v?(\d+)$/i);
    if (m) versions.add(Number(m[1]));
  };
  const addFromFilename = (value) => {
    const m = String(value ?? '').match(/[_-]v(\d+)[_.-]/i);
    if (m) versions.add(Number(m[1]));
  };

  addVersion(user.version);
  addFromFilename(user.fileName ?? user.filename);
  addFromFilename(user.downloadUrl ?? user.download_url ?? user.url ?? user.finalUrl);
  for (const g of genos) {
    addVersion(g?.version);
    addFromFilename(g?.filename ?? g?.file ?? g?.download_url);
  }

  if (versions.size === 0) return '';
  return Array.from(versions).sort((a, b) => a - b).map(v => `v${v}`).join('_');
}

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
      const name = r.userName ?? r.userId;
      const version = getUserVersionPrefix(r.userId);
      byUser.set(r.userId, { label: version ? `${version} ${name}` : name });
    }
    byUser.get(r.userId)[r.pgsId] = r.PRS;
  }

  const rows = Array.from(byUser.values());
  return rows.length >= 2 ? rows : null;
}

/**
 * Standardize (z-score) each PGS column across users so that no single model
 * dominates the clustering distance purely because of its scale.
 * For each PGS: z = (value - mean) / sd, computed across all users that have a
 * finite value. Columns with fewer than 2 finite values (or zero variance) are
 * left effectively unscaled (sd defaults to 1). Missing values stay missing.
 * @param {Array<Object>} pivoted - Row objects: { label, <pgsId>: value, ... }
 * @param {string[]} pgsIds - PGS column ids to standardize
 * @returns {Array<Object>} New row objects with z-scored values.
 */
function standardizePivot(pivoted, pgsIds) {
  if (!Array.isArray(pivoted) || pivoted.length === 0) return pivoted;
  const round = v => (Number.isFinite(v) ? Number(v.toFixed(4)) : null);

  // Per-PGS mean/sd across users.
  const stats = {};
  for (const pgsId of pgsIds) {
    const vals = pivoted.map(row => row[pgsId]).filter(v => Number.isFinite(v));
    if (vals.length < 2) continue;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
    stats[pgsId] = { mean, sd };
  }

  return pivoted.map(row => {
    const out = { label: row.label };
    for (const pgsId of pgsIds) {
      const v = row[pgsId];
      if (!Number.isFinite(v)) continue;
      const s = stats[pgsId];
      out[pgsId] = s ? round((v - s.mean) / s.sd) : round(v);
    }
    return out;
  });
}

/**
 * Build a { pgsId -> reported trait } lookup from the raw PRS results.
 * @param {Array<Object>} rawResults - window.prsResults entries
 * @returns {Object<string,string>} Map of PGS id to its trait name.
 */
function getPgsTraitMap(rawResults) {
  const map = {};
  if (!Array.isArray(rawResults)) return map;
  for (const r of rawResults) {
    const pgsId = r?.pgsId;
    if (!pgsId || map[pgsId]) continue;
    const trait =
      r.pgs?.meta?.trait_reported ??
      r.pgs?.meta?.trait_mapped ??
      r.organized?.summary?.trait ??
      '';
    if (trait) map[pgsId] = String(trait);
  }
  return map;
}

/**
 * Return a copy of the pivoted matrix with each PGS column key relabeled as
 * "<pgsId> — <trait>" for display. The `label` (user name) key is preserved.
 * Used only for the plot so cached data and CSV/JSON downloads keep raw PGS ids.
 * Note: ClustJS truncates axis labels to 12 chars, but hover tooltips show the
 * full relabeled text.
 * @param {Array<Object>} matrix - Row objects: { label, <pgsId>: value, ... }
 * @param {Object<string,string>} traitMap - { pgsId -> trait }
 * @returns {Array<Object>} New rows with trait-augmented column keys.
 */
function relabelPgsColumns(matrix, traitMap) {
  if (!Array.isArray(matrix) || !traitMap) return matrix;
  return matrix.map(row => {
    const out = {};
    for (const key of Object.keys(row)) {
      if (key === 'label') { out.label = row.label; continue; }
      const trait = traitMap[key];
      out[trait ? `${key} — ${trait}` : key] = row[key];
    }
    return out;
  });
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
 * Serialise a hclust_plot matrix (array of row-objects with a `label` key) to CSV
 * and trigger a browser download.
 * @param {Array<Object>} matrix - e.g. [{label:'user1', PGS000001: 0.2, ...}, ...]
 * @param {string} filename     - suggested download filename
 */
function downloadMatrixAsCsv(matrix, filename = 'matrix.csv') {
  if (!Array.isArray(matrix) || matrix.length === 0) return;
  const cols = Object.keys(matrix[0]).filter(k => k !== 'label');
  const header = ['label', ...cols].join(',');
  const rows = matrix.map(row =>
    [row.label, ...cols.map(c => row[c] ?? '')].join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
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
  } else {
    pivoted = pivotPrsResults(window.prsResults);
    pgsIds = getUniquePgsIds(window.prsResults);
    userIds = getUniqueUserIds(window.prsResults);
    // Update cache
    clusterCache.prsResultsHash = currentHash;
    clusterCache.pivoted = pivoted;
    clusterCache.pgsIds = pgsIds;
    clusterCache.userIds = userIds;
  }

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

  // Clustering algorithm options
  const clusterMethod = window.clusterOptions?.clusterMethod ?? 'complete';
  const clusterDistance = window.clusterOptions?.clusterDistance ?? 'euclidean';

  // Scale mode: raw PRS vs. per-PGS z-scored (normalized) values.
  const normalize = window.clusterOptions?.normalize ?? false;

  clusterContainer.innerHTML = `
    <div id="clusterSectionA">
    <h5>PRS Clustering (${pivoted.length} Users × ${Object.keys(pivoted[0]).length - 1} PGS Entries)</h5>
    <p class="text-muted small mb-2">
      Hierarchical clustering of PRS results (${pivoted.length} users × ${Object.keys(pivoted[0]).length - 1} PGS entries).
    </p>
    <div class="mb-3">
      <button id="downloadPrsMatrixBtn" class="btn btn-outline-secondary btn-sm">
        ⬇ Download JSON
      </button>
      <button id="downloadPrsCsvBtn" class="btn btn-outline-secondary btn-sm ms-2">
        ⬇ Download CSV
      </button>
      <span class="text-muted small ms-2">ClustJS-compatible format: array of row objects with a <code>label</code> field and one field per PGS ID.</span>
    </div>
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
    <div class="mb-3">
      <strong>Scale:</strong>
      <div class="btn-group ms-2" role="group">
        <button id="clusterScaleRaw" class="btn btn-sm ${!normalize ? 'btn-dark' : 'btn-outline-dark'}">Raw PRS</button>
        <button id="clusterScaleZ" class="btn btn-sm ${normalize ? 'btn-dark' : 'btn-outline-dark'}">Z-score (per PGS)</button>
      </div>
      <span class="text-muted small ms-2">Z-score standardizes each PGS column across users so no single model dominates the distance by scale.</span>
    </div>
    <div id="clusterPlotBox" style="position:relative;">
      <div style="position:sticky; top:8px; z-index:5; height:0; text-align:right; pointer-events:none;">
        <button id="downloadHeatmapPngBtn" class="btn btn-outline-secondary btn-sm" style="pointer-events:auto; margin-right:8px;">⬇ Download PNG</button>
      </div>
      <div id="clusterPlotScroll" style="overflow:auto; max-width:100%;">
        <div id="clusterPlotMount"></div>
      </div>
    </div>
    </div>
  `;

  // Download PRS matrix as JSON (ClustJS-compatible)
  document.getElementById('downloadPrsMatrixBtn').onclick = () => {
    const data = clusterCache.pivoted ?? pivotPrsResults(window.prsResults);
    if (!data) { alert('No PRS matrix available. Run a PRS calculation first.'); return; }
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prs_matrix.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download the rendered heatmap (the SVG inside the mount) as a PNG.
  document.getElementById('downloadHeatmapPngBtn').onclick = () => {
    const svg = document.querySelector('#clusterPlotMount svg');
    if (!svg) { alert('No plot available yet. Render the clustering heatmap first.'); return; }
    d3ToPng(svg, 'prs_clustering_heatmap', { scale: 2, background: 'white' })
      .catch(err => { console.error('[PRS Clustering] PNG export error:', err); alert('Could not export the plot as PNG.'); });
  };

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

  // PRS clustering scale (normalization) handlers
  document.getElementById('clusterScaleRaw').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, normalize: false };
    renderCluster();
  };
  document.getElementById('clusterScaleZ').onclick = () => {
    window.clusterOptions = { ...window.clusterOptions, normalize: true };
    renderCluster();
  };

  // Wire PRS matrix CSV download
  const downloadPrsCsvBtn = document.getElementById('downloadPrsCsvBtn');
  if (downloadPrsCsvBtn) {
    downloadPrsCsvBtn.onclick = () => {
      const data = clusterCache.pivoted ?? pivotPrsResults(window.prsResults);
      if (!data) { alert('No PRS matrix available.'); return; }
      downloadMatrixAsCsv(data, `prs_matrix_${data.length}users.csv`);
    };
  }

  // Apply per-PGS z-score standardization when the Z-score scale is selected.
  const plotData = normalize ? standardizePivot(pivoted, pgsIds) : pivoted;

  // Append the reported trait to each PGS column label (plot only; downloads
  // keep raw PGS ids). Full label shows on hover; axis text is capped at 12 chars.
  const plotDataLabeled = relabelPgsColumns(plotData, getPgsTraitMap(window.prsResults));

  // Grow the canvas with the matrix so dendrograms and axis labels have room
  // and aren't clipped at the plot edges.
  const colCount = Object.keys(pivoted[0]).length - 1;
  const fullWidth = Math.max(1500, 150 * colCount + 500);
  const fullHeight = Math.max(760, 46 * pivoted.length + 320);
  // Render the plot smaller while keeping the reserved area (box) unchanged, so
  // the surrounding layout and the top-right download button stay put.
  const plotScale = 0.8;
  const plotWidth = Math.round(fullWidth * plotScale);
  const plotHeight = Math.round(fullHeight * plotScale);

  // Preserve the original footprint even though the plot is drawn smaller, and
  // bound the scroll area so wide/tall matrices scroll inside the box while the
  // top-right download button stays pinned to the visible corner.
  const plotBox = document.getElementById('clusterPlotBox');
  if (plotBox) plotBox.style.minHeight = fullHeight + 'px';
  const plotScroll = document.getElementById('clusterPlotScroll');
  if (plotScroll) plotScroll.style.maxHeight = fullHeight + 'px';

  // Render PRS cluster plot
  try {
    await hclust_plot({
       divId:  "clusterPlotMount",
      data: plotDataLabeled,
      width: plotWidth,
      height: plotHeight,
      marginBottom: 180,
     // marginRight: 240,
         // Pull the color legend + "Missing" swatch left so they aren't clipped at
      // the right edge. hclust_plot auto-computes the right margin (marginRight
      // is ignored), so legendOffsetX is the lever for legend position.
      legendOffsetX: 38,
      clusterRows: clusterRows,
      clusterCols: clusterCols,
      clusteringMethodRows: clusterMethod,
      clusteringMethodCols: clusterMethod,
      clusteringDistanceRows: clusterDistance,
      clusteringDistanceCols: clusterDistance
    });
  } catch(e) { console.error('[PRS Clustering] hclust_plot error:', e); }
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

// --- window.sdk namespace (cluster) ---
window.sdk = Object.assign(window.sdk ?? {}, {
    renderCluster,
    invalidateClusterCache,
    getClusterCache: () => clusterCache,
});

// Add live getters for pivoted and clusterCache into window.sdk
Object.defineProperty(window.sdk, "pivoted", {
    get() { return clusterCache.pivoted; },
    configurable: true,
});
Object.defineProperty(window.sdk, "clusterCache", {
    get() { return clusterCache; },
    configurable: true,
});
