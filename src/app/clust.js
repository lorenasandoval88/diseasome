import * as clust from "https://lorenasandoval88.github.io/clustjs/dist/sdk.mjs";

console.log("clustjs version:", clust.version);

const clusterContainerId = "clusterDiv";

const sampleClusterData = [
  { prs_breast_cancer: 1.2, prs_diabetes: 0.8, prs_cad: 1.1, label: "User A" },
  { prs_breast_cancer: 1.1, prs_diabetes: 0.9, prs_cad: 1.0, label: "User B" },
  { prs_breast_cancer: 2.4, prs_diabetes: 1.9, prs_cad: 2.1, label: "User C" },
  { prs_breast_cancer: 2.5, prs_diabetes: 2.0, prs_cad: 2.2, label: "User D" }
];
console.log("sample cluster data:", sampleClusterData)
const clusterContainer = document.getElementById(clusterContainerId);

if (clusterContainer) {
  clusterContainer.innerHTML = `
    <p class="text-muted small mb-3">Sample hierarchical clustering from the remote \`clustjs\` module.</p>
    <div id="clusterPlotMount"></div>
  `;
await clust.hclust_plot({
    divid: "clusterPlotMount",
    width: 700,
    height: 520
  });
//   await clust.hclust_plot({
//     divid: "clusterPlotMount",
//     data: sampleClusterData,
//     width: 700,
//     height: 520
//   });
}