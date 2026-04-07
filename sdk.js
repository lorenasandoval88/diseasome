import localforage from "localforage";
import {
	fetch23andMeParticipants, fetchProfile,load23andMeFile
} from "https://lorenasandoval88.github.io/get-23andme-data/dist/sdk.mjs";
// import { loadAllScores as pgs_scores_list } from "https://lorenasandoval88.github.io/get-pgscatalog-scores/dist/sdk.mjs";
import {
	loadTraitStats,
	getScoresPerTrait,
	getScoresPerCategory,
	getTxts,
} from "https://lorenasandoval88.github.io/get-pgscatalog-scores/dist/sdk.mjs";

import {
	Match2
}
from "./src/sdk/prs.js";

export const data = {
	pgp: {
		profile: fetchProfile,
		users:fetch23andMeParticipants,
		txt: load23andMeFile
	},
	pgs: {
		summary: loadTraitStats,
		traits: getScoresPerTrait,
		categories: getScoresPerCategory,
		txts: getTxts
	},
	prs: {
		calc:Match2 // pgsTxt, my23Txt
	}
};

export {
	localforage
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