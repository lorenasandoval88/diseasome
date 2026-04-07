import localforage from "localforage";
import {
	fetch23andMeParticipants as _23andme
} from "https://lorenasandoval88.github.io/get-23andme-data/dist/sdk.mjs";
// import { loadAllScores as pgs_scores_list } from "https://lorenasandoval88.github.io/get-pgscatalog-scores/dist/sdk.mjs";
import {
	loadTraitStats,
	getScoresPerTrait,
	getScoresPerCategory
} from "https://lorenasandoval88.github.io/get-pgscatalog-scores/dist/sdk.mjs";

import {
	Match2
}
from "./src/sdk/prs.js";

export const data = {
	pgp: {
		users:_23andme
	},
	pgs: {
		summary: loadTraitStats,
		traits: getScoresPerTrait,
		categories: getScoresPerCategory
	},
	prs: {
		match:Match2
	},
	storage: localforage
};



// export {
// 	get23meUrls,
// 	parse23,
// 	get23
// } from "./src/sdk/get23me.js";

// export {
// 	searchTraits,
// 	getPGSTxts,
// 	getPGSTxts2,
// 	getPGSTxtsHm,
// 	parsePGS,
// 	loadScore,
// 	loadScore2,
// 	fetchAll2,
// 	getAllCategories,
// 	getPGSidsForOneTraitCategory,
// 	getPGSidsForOneTraitLabel,
// 	getPGSIds
// } from "./src/sdk/getPgs.js";