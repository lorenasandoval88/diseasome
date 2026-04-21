import localforage from "localforage";
import * as clustjs from "./src/sdk/clustSdk.js";
import {
	fetch23andMeParticipants, fetchProfile,load23andMeFile
} from "./src/sdk/pgpSdk.js";
// import { loadAllScores as pgs_scores_list } from "https://lorenasandoval88.github.io/get-pgscatalog-scores/dist/sdk.mjs";
import {
	loadTraitStats,
	getScoresPerTrait,
	getScoresPerCategory,
	getTxts,
} from "./src/sdk/pgsSdk.js";

import {
	Match2,
	Match3		
}
from "./src/sdk/prs.js";

export const pgp = {
	data: fetch23andMeParticipants,
	txt: load23andMeFile,
	profile: fetchProfile,
};

export const pgs = {
	data: {
		summary: loadTraitStats,
		traits: getScoresPerTrait,
		categories: getScoresPerCategory,
	},
	txts: getTxts
};

export const prs = {
	calc: Match2, // pgsTxt, my23Txt
	calc2: Match3 // pgsTxt, my23Txt
};

export {clustjs}

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