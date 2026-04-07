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

// export { pgs_scores_list };
export {
	localforage
};
export {
	pgs_summary
};
// export const data = {
//   list_23andme,
//   pgs_summary,
// };


export const data = {
	pgp: {
		users:_23andme
	},
	pgs: {
		summary: loadTraitStats,
		traits: getScoresPerTrait,
		categories: getScoresPerCategory
	},
	storage: localforage
};

export {
	Match2
}
from "./src/sdk/prs.js";

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