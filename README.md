# polygenic_risk_scores (diseasome)
Calculating risk scores from 23andme data using a local-only dataset of 5 users for now .

live at: https://lorenasandoval88.github.io/polygenic_risk_scores/


[<img width="755" height="778" alt="image" src="https://github.com/user-attachments/assets/24506e93-3aef-4e5d-9402-32686acf056d" />
](https://lorenasandoval88.github.io/polygenic_risk_scores/)

## Architecture

### External helper sdks: 
- https://lorenasandoval88.github.io/get-23andme-data/
- https://lorenasandoval88.github.io/get-pgscatalog-scores/
- https://lorenasandoval88.github.io/clustjs/


### Internal sdk:
- `src/app/`: browser app entry and UI wiring (`main.js`, `tabs.js`, `displayScores.js`, `index.js`).
- `src/sdk/`: reusable SDK modules (`get23me.js`, `getPgs.js`, `prs.js`).
- `sdk.js`: public SDK entrypoint (exports the SDK API used for `dist/sdk.mjs`).
- `src/css/`: app styles.
- `data/`: local 23andMe-compatible genome files (currently 5 users).
- `dist/`: Rollup build outputs:
	- `dist/app.mjs` for the bundled browser app.
	- `dist/sdk.mjs` for the bundled SDK entry.

## Build

- Run `npm run build` to generate `dist/app.mjs` and `dist/sdk.mjs`.

## Run

- Open `index.html` with a local static server (for example VS Code Live Server).

## SDK API

Public exports from `sdk.js`:

- 23andMe
	- `get23meUrls`
	- `parse23`
	- `get23`
- PGS
	- `searchTraits`
	- `getPGSTxts`
	- `getPGSTxts2`
	- `getPGSTxtsHm`
	- `parsePGS`
	- `loadScore`
	- `loadScore2`
	- `fetchAll2`
	- `getAllCategories`
	- `getPGSidsForOneTraitCategory`
	- `getPGSidsForOneTraitLabel`
	- `getPGSIds`
- PRS
	- `Match2`
