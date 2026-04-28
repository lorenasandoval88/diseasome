import localforage from "localforage";
import * as clustjs from "./src/sdk/clustSdk.js";
import {
	fetch23andMeParticipants, fetchProfile, load23andMeFile
} from "./src/sdk/pgpSdk.js";

import {
	fetchAllScores,
	fetchSomeScores,
	fetchTraits,
	getScoresPerTrait,
	getScoresPerCategory,
	getTxts,
	estimateLocalForageSizeKB, checkStorageKB, getTextSizeKB
} from "./src/sdk/pgsSdk.js";

import {
	Match2,
	Match3,
} from "./src/sdk/prs.js";

export const pgp = {
	fetch23andMeParticipants,
	allUsersMetaDataByType_fast,
	fetchAvailableDataTypes,
	load23andMeFile,
	fetchProfile,
};

export const pgs = {
	fetchAllScores,
	fetchSomeScores,
	fetchTraits,
	getScoresPerTrait,
	getScoresPerCategory,
	getTxts,
	estimateLocalForageSizeKB, checkStorageKB, getTextSizeKB
};

export const prs = {
	Match2, // pgsTxt, my23Txt
	Match3,  // pgsTxt, my23Txt
};

export { clustjs };

export { localforage };

