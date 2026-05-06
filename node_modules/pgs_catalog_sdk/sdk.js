import localforage from "localforage";

export { localforage };
export { fetchAllScores,fetchSomeScores } from "./src/js/getPGS_loadScores.js"; // re-export for external use
export { loadScoreStats } from "./src/js/landingPage.js";
export { getScoresPerTrait, getScoresPerCategory } from "./src/js/getPGS_loadScores.js";
export { getTxts } from "./src/js/getPGS_loadTxts.js"; // re-export for external use
export { fetchTraits } from "./src/js/getPGS_loadTraits.js";
export { fetchDataAndRenderPlots } from "./src/js/landingPage.js";
export { estimateLocalForageSizeKB, checkStorageKB, getTextSizeKB } from "./src/js/storage.js";

