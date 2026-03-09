# polygenic_risk_scores (diseasome)
Calculating risk scores from 23andme data using a local-only dataset of 5 users for now .

live at: https://lorenasandoval88.github.io/polygenic_risk_scores/


[<img width="760" height="937" alt="image" src="https://github.com/user-attachments/assets/a44d8760-ac86-4efd-9d7f-e3cf7e1496c2" />](https://lorenasandoval88.github.io/polygenic_risk_scores/)

## Architecture

- `src/app/`: browser app entry and UI wiring (`main.js`, `tabs.js`, `displayScores.js`, `index.js`).
- `src/sdk/`: reusable SDK modules for 23andMe parsing/loading, PGS fetching/parsing, and PRS matching.
- `src/css/`: app styles.
- `data/`: local 23andMe-compatible genome files (currently 5 users).
- `dist/`: Rollup build outputs:
	- `dist/app.mjs` for the bundled browser app.
	- `dist/sdk.mjs` for the bundled SDK entry.

## Build

- Run `npm run build` to generate `dist/app.mjs` and `dist/sdk.mjs`.
