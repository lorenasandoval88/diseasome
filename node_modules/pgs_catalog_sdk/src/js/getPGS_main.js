

import localforage from "localforage";
import { fetchDataAndRenderPlots, loadScoreStats } from "./landingPage.js";

export async function initStats() {
  try {
    await Promise.allSettled([
      fetchDataAndRenderPlots(),
      loadScoreStats({ includeAllScoreStats: true, includeTraitStats: true, includeCategoryStats: true })
    ]);
  } catch (err) {
    console.error("Failed to initialize stats:", err);
  }
}

if (typeof window !== "undefined") {
  window.localforage = localforage;
  window.initStats = initStats;
  window.fetchDataAndRenderPlots = fetchDataAndRenderPlots;
  window.loadScoreStats = loadScoreStats;
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initStats);
}

