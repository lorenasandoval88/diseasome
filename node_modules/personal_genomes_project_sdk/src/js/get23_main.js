import { loadStats } from "./get23_loadStats.js";
import { displayProfiles } from "./get23_loadProfiles.js";

export async function init() {
  try {
    await Promise.allSettled([
      loadStats(),
      displayProfiles()
    ]);
  } catch (err) {
    console.error("Failed to initialize:", err);
  }
}

if (typeof window !== "undefined") {
  window.init = init;
  window.loadStats = loadStats;
  window.displayProfiles = displayProfiles;
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", init);
}
