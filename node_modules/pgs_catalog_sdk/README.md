# pgs_catalog_sdk

Browser-first JavaScript SDK for retrieving **PGS Catalog** score and trait data, caching it with `localforage`, and powering the included demo dashboard.

## Live demo

https://lorenasandoval88.github.io/pgs_catalog_sdk/

## Documentation

Additional usage notes are available in the [project wiki](https://github.com/lorenasandoval88/pgs_catalog_sdk/wiki).

## Quick start

Test the published bundle directly in a browser console:

```javascript
const sdk = await import("https://lorenasandoval88.github.io/pgs_catalog_sdk/dist/sdk.mjs");

const scores = await sdk.fetchAllScores();
const categories = await sdk.getScoresPerCategory();

console.log({ scores, categories });
```

<img width="1005" height="405" alt="image" src="https://github.com/user-attachments/assets/f72a2125-3b67-4fb2-b79c-9fee62b83345" />

## Project structure

- `sdk.js`: public SDK entry point.
- `src/js/getPGS_loadScores.js`: score loading, caching, summaries, and category/trait aggregations.
- `src/js/getPGS_loadTraits.js`: trait loading, caching, and summary generation.
- `src/js/getPGS_loadTxts.js`: scoring file download and cache management.
- `src/js/landingPage.js`: dashboard rendering helpers and high-level stats loaders.
- `src/js/storage.js`: storage inspection utilities.
- `src/js/getPGS_main.js`: demo-page bootstrap.
- `src/css/styles.css`: demo-page styles.
- `dist/`: generated browser bundles.

## Build and run

Install dependencies and build the bundles:

```bash
npm install
npm run build
```

The build generates:

- `dist/loadScores.bundle.mjs`
- `dist/loadTraits.bundle.mjs`
- `dist/main.mjs`
- `dist/sdk.mjs`

To try the demo locally, serve the repository root with any static file server and open `index.html`.

## Public SDK API

Current exports from `sdk.js`:

- `localforage`
- `fetchAllScores`
- `fetchSomeScores`
- `getScoresPerTrait`
- `getScoresPerCategory`
- `loadScoreStats`
- `getTxts`
- `fetchTraits`
- `estimateLocalForageSizeKB`
- `checkStorageKB`
- `getTextSizeKB`

### getTxts

`getTxts(ids, optionalArg, cache = true)`

- `cache` defaults to `true` (current behavior).
- Set `cache` to `false` to skip both cache reads and cache writes for that call.

Examples:

```javascript
await sdk.getTxts(ids); // default: uses cache
await sdk.getTxts(ids, undefined, false); // bypass cache for this call
```

---

## Cloud SDK (Node.js)

A separate, Node-safe bundle (`cloud_sdk.mjs`, **4.4 KB**) for Cloud Run and server deployment.

### Features
- Exposes core PGS SDK loaders for Node/Cloud environments
- No browser UI dependencies in the cloud entry surface
- Lean bundle size optimized for containerized environments
- Ready for Google Cloud Run, AWS Lambda, or any Node.js host

### Installation

```bash
npm install pgs_catalog_sdk
```

### Cloud SDK Exports

- `fetchAllScores()`
- `fetchSomeScores(ids)`
- `loadScoreStats()`
- `getScoresPerTrait()`
- `getScoresPerCategory()`
- `getTxts(ids, optionalArg, cache = true)`
- `fetchTraits()`

### Cloud SDK Usage

```javascript
import {
  fetchAllScores,
  fetchSomeScores,
  fetchTraits,
  getScoresPerTrait,
  getScoresPerCategory,
  getTxts,
  loadScoreStats,
} from "pgs_catalog_sdk/cloud_sdk.mjs";

const scores = await fetchSomeScores(["PGS000001", "PGS000050"]);
console.log(scores.length);

const traits = await fetchTraits();
console.log(traits?.length ?? 0);
```

### Build Details

- **Source:** `src/js/getPGS_loadScores.js`, `src/js/getPGS_loadTxts.js`, `src/js/getPGS_loadTraits.js`, `src/js/landingPage.js`
- **Entry:** `cloudNodeEntry.js` (exports the cloud-safe SDK surface)
- **Build:** `npm run build` generates both `dist/sdk.mjs` (browser) and `dist/cloud_sdk.mjs` (Node)
- **Critical Fix:** Rollup `intro` shim `var self = globalThis;` prevents jszip runtime crash from bundled `self` reference
