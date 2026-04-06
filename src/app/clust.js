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

async function renderCluster() {
  const clusterContainer = document.getElementById(clusterContainerId);
  if (!clusterContainer) return;

  const pivoted = pivotPrsResults(window.prsResults);
  
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

  clusterContainer.innerHTML = `
    <p class="text-muted small mb-3">
      Hierarchical clustering of PRS results (${pivoted.length} users).
    </p>
    <div id="clusterPlotMount"></div>
  `;

  console.log("cluster plot data:", pivoted);
  await clust.hclust_plot({
    divid: "clusterPlotMount",
    data: pivoted,
    width: 700,
    height: 520
  });
}

window.renderCluster = renderCluster;