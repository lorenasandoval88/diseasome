// Single wrapper at pgsSdk.js that re-exports 
// from the remote SDK URL so all PGS imports are centralized.
export {
	fetchAllScores,
	getScoresPerTrait,
	getScoresPerCategory,
	fetchTraits,
	getTxts,
} from "https://lorenasandoval88.github.io/pgs_catalog_sdk/dist/sdk.mjs";
