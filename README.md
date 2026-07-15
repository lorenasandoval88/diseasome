
# Diseasome SDK

We present the Diseasome SDK, a JavaScript library and web application for computing polygenic risk scores from consumer genotype data (23andMe) and PGS Catalog score models. The SDK operates in both browser and Node.js environments, supporting programmatic use by developers and interactive exploration by end users.
live at: https://lorenasandoval88.github.io/diseasome/



<img width="416" height="580" alt="image" src="https://github.com/user-attachments/assets/181e43f3-e9f2-4146-acbe-2e8f43def16e" />


---

## Overview

This project combines a programmable SDK (toolkit functionalities) with an interactive web app (UI exploration tabs).

Toolkit functionalities
- Automated retrieval and parsing of 23andMe and PGS Catalog data
- Calculation of polygenic risk scores (PRS) for local or public genomes
- Browser-based and Node.js/Cloud Run compatible workflows
- Simple developer APIs for PRS research and visualization

## UI exploration tabs
- PGP Tab: Explore public genome profiles and participant metadata, and load available genotype records for analysis.
- PGS Catalog Tab: Browse polygenic score models by trait/category, inspect model metadata, and select scores to analyze.
- PRS Tab: Run score matching between genotype inputs and selected PGS models, then review comparative PRS outputs.
- Cluster Tab: Interactively visualize and group samples/scores to identify similarity patterns and trait-level structure.
- AI Interpretation – Score Insight: Convert PRS outputs into plain-language summaries with context and interpretation caveats.
- AI Interpretation – Research Assistant: Generate follow-up insights, comparison prompts, and research-oriented notes from selected results.
---

## Quick Start


### Browser SDK

```js
// ESM direct import (browser)
const sdk = await import("https://lorenasandoval88.github.io/polygenic_risk_scores/dist/sdk.mjs");
// or via npm: import { fetchAllScores, fetchTraits, getTxts } from "polygenic_risk_scores";
```

### Node/Cloud Run SDK

```js
// ESM direct import (Node/Cloud Run)
const sdk = await import("https://lorenasandoval88.github.io/polygenic_risk_scores/dist/cloud_sdk.mjs");
// or via npm: import { fetchAllScores, ... } from "polygenic_risk_scores/cloud_sdk.mjs";
```

---

## Architecture

```
polygenic_risk_scores/
├── src/
│   ├── app/           # Browser app entry and UI wiring
│   ├── sdk/           # Reusable SDK modules (PGP, PGS, PRS)
│   └── css/           # App styles
├── data/              # Local 23andMe-compatible genome files
├── dist/              # Rollup build outputs
│   ├── sdk.mjs        # Browser SDK
│   └── cloud_sdk.mjs  # Node-safe SDK
├── sdk.js             # Public SDK entrypoint
├── index.html         # Web interface
├── rollup.config.js   # Build configuration
├── package.json       # Project dependencies and scripts
└── README.md          # Documentation
```

| Directory/File       | Purpose                                                  |
| -------------------- | -------------------------------------------------------- |
| **src/app/**         | Browser app entry and UI logic                           |
| **src/sdk/**         | SDK modules for PGP, PGS, PRS                            |
| **src/css/**         | Stylesheets                                              |
| **data/**            | Local genome files                                       |
| **dist/**            | Compiled SDK outputs (browser & node)                    |
| **sdk.js**           | Public API entry point                                   |
| **index.html**       | Web interface                                            |
| **rollup.config.js** | Bundler configuration                                    |
| **package.json**     | Project dependencies and scripts                         |
| **README.md**        | Documentation                                            |

---

## Core Functions

### Public API Functions

| Function | Description |
|---|---|
| `fetchAllScores()` | Fetch all PGS Catalog scores |
| `fetchSomeScores(ids)` | Fetch specific PGS scores by ID |
| `fetchTraits()` | Fetch trait metadata |
| `getScoresPerTrait()` | Get scores grouped by trait |
| `getScoresPerCategory()` | Get scores grouped by category |
| `getTxts(ids)` | Fetch and parse PGS text files |
| `estimateLocalForageSizeKB()` | Estimate LocalForage storage size (Browser only) |
| `checkStorageKB()` | Check storage usage and quota (Browser only) |
| `getTextSizeKB(text)` | Calculate text size in KB (Browser only) |
| `fetchAvailableDataTypes()` | List available data types |
| `allUsersMetaDataByType_fast()` | Get user metadata by type |
| `fetchProfile(id)` | Fetch a user profile |
| `load23andMeFile(path, id, cache)` | Load and parse a 23andMe file |
| `Match2(pgsTxt, my23Txt)` | Calculate PRS (2-input) |
| `Match3(pgsTxt, my23Txt)` | Calculate PRS (3-input) |

**SDK Availability:**
- **Browser SDK (`sdk.mjs`)**: All functions above
- **Node SDK (`cloud_sdk.mjs`)**: All functions except browser-only storage utilities (`estimateLocalForageSizeKB`, `checkStorageKB`, `getTextSizeKB`)

---

## Usage Example

```js
import { fetchAllScores, fetchTraits, getTxts } from "polygenic_risk_scores";

const scores = await fetchAllScores();
const traits = await fetchTraits();
const txts = await getTxts(["PGS000001"]);
```

---

## Build

Run `npm run build` to generate:
- `dist/sdk.mjs` (browser SDK)
- `dist/cloud_sdk.mjs` (Node-safe SDK)

---

## Run

- Open `index.html` with a local static server (e.g. VS Code Live Server)
- For API calls, use the browser or Node SDK as shown above

---

## License

MIT
