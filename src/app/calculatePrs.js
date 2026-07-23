import { getPgsTxt } from "../sdk/pgsSdk.js";
import { MatchOptimized } from "../sdk/prs.js";
// import { parsePGP23, get23Txt } from "../sdk/get23me.js";
import { get23Txt } from "../sdk/pgpSdk.js";
import localforage from "localforage";
console.log("calculatePrs.js loaded");



// Calculate PRS for a given PGS and 23andMe genome data.
//
// Workflow (driven by buttons in the PRS tab):
//   1. LOAD SCORES â€” fetchScores() (selected in the Polygenic Scores tab) or
//      loadExampleScores() (selection + EXAMPLE_SCORES). Both call
//      loadScoresFromList(), which loads each PGS id one at a time via getPgsTxt()
//      (fetch + parse + cache). Results populate loadedScores + window.loadedPgsTxts.
//   2. LOAD USERS â€” fetchUsers() (selected in the 23andMe Data tab) or
//      loadExampleUsers() (EXAMPLE_USERS). Both call loadUsersFromList(), which
//      loads each genome one file at a time via get23Txt() (fetch + parse +
//      cache). Results populate loadedUsers + window.loadedUsers.
//   3. CALCULATE â€” calculatePRS() takes the checked users x checked scores, then for
//      each pair calls calculateAndCachePRS() â†’ MatchOptimized() (the actual PRS math) and
//      organizeResultsByAllele() (groups matches by 0/1/2 effect alleles for plots).
//      Results are cached (getCachedPRS/setCachedPRS), exposed on window.prsResults,
//      and rendered as a table.
//
// Helpers:
//   - Caching: getCachedPRS/setCachedPRS (per user+PGS); clearPRSCache /
//     clearPGSCache / clearGenomeCache wipe each localforage namespace.
//   - Rendering: renderScoresTable, renderUsersTable, escapeHtml, getCheckedIds.
//   - User metadata: resolveUserFilePath, resolveUserName, nameFromFilename.
//   - Public API mirrored under window.sdk at the bottom of the file.
//
// Track what has been loaded
let loadedScores = []; // parsed PGS scoring files (metadata objects)
let loadedUsers = []; // parsed 23andMe genome data ({ user, parsed })

const prsProgressBars = new Map();

function ensureProgressBar(key, statusEl) {
	if (!statusEl) return null;
	if (prsProgressBars.has(key)) return prsProgressBars.get(key);

	const wrap = document.createElement("div");
	wrap.className = "progress mt-2";
	wrap.style.height = "8px";

	const bar = document.createElement("div");
	bar.className = "progress-bar progress-bar-striped";
	bar.setAttribute("role", "progressbar");
	bar.setAttribute("aria-valuemin", "0");
	bar.setAttribute("aria-valuemax", "100");
	bar.setAttribute("aria-valuenow", "0");
	bar.style.width = "0%";

	wrap.appendChild(bar);
	statusEl.insertAdjacentElement("afterend", wrap);

	const entry = { wrap, bar };
	prsProgressBars.set(key, entry);
	return entry;
}

function setProgressBar(key, statusEl, percent) {
	const entry = ensureProgressBar(key, statusEl);
	if (!entry) return;
	const p = Math.max(0, Math.min(100, Math.round(percent)));
	entry.bar.style.width = `${p}%`;
	entry.bar.setAttribute("aria-valuenow", String(p));
}

/*** Get cached PRS result for a user+PGS combination.
 * @param {string} userId - User ID
 * @param {string} pgsId - PGS ID
 * @returns {Promise<Object|null>} Cached result or null if not found
 */
async function getCachedPRS(userId, pgsId) {
	try {
		const key = `PRS: ${userId}_${pgsId}`;
		const cache = await localforage.getItem(key) || {};
		const result = cache[key] ?? null;

		if (result) {
			console.log(`Cache hit for ${userId}_${pgsId}`);
		}

		return result;
	} catch (err) {
		console.warn('Failed to read PRS cache:', err);
		return null;
	}
}

/*** Store PRS result in cache.
 * @param {string} userId - User ID
 * @param {string} pgsId - PGS ID
 * @param {Object} result - PRS calculation result
 */
async function setCachedPRS(userId, pgsId, result) {
	console.log(`Caching PRS result for key ${userId}_${pgsId}`);
	try {
		const key = `PRS: ${userId}_${pgsId}`;
		const cache = await localforage.getItem(key) || {};

		cache[key] = { ...result, cachedAt: new Date().toISOString() };
		await localforage.setItem(key, cache);
	} catch (err) {
		console.warn('Failed to write PRS cache:', err);
	}
}

/*** Clear all cached PRS results (keys starting with "PRS:").
 */
async function clearPRSCache() {
	const keys = await localforage.keys();
	const prsKeys = keys.filter(k => k.startsWith('PRS:'));
	for (const key of prsKeys) {
		await localforage.removeItem(key);
	}
	console.log(`PRS cache cleared: removed ${prsKeys.length} item(s)`);

	// Reset the Calculate PRS results table and status.
	window.prsResults = [];
	if (window.sdk) window.sdk.prsResults = [];
	if (typeof window.invalidateClusterCache === "function") window.invalidateClusterCache();
	const resultsDiv = document.getElementById("prsResultsDiv");
	if (resultsDiv) resultsDiv.innerHTML = "";
	const statusEl = document.getElementById("prsResultsStatus");
	if (statusEl) statusEl.textContent = "";
}
window.clearPRSCache = clearPRSCache;

/*** Clear PGS scoring file cache (pgs:PGS* keys only, not trait/category summaries)
 */
async function clearPGSCache() {
	console.log("Clearing PGS scoring cache...");
	const keys = await localforage.keys();
	// Only clear keys like "pgs:PGS000001", not "pgs:trait-summary" or "pgs:all-score-summary"
	const pgsKeys = keys.filter(k => k.startsWith('PGS_Catalog:id-PGS'));
	for (const key of pgsKeys) {
		await localforage.removeItem(key);
	}
	console.log(`PGS scoring cache cleared: removed ${pgsKeys.length} item(s)`);

	// Reset the loaded risk models table and status.
	loadedScores = [];
	window.loadedPgsTxts = [];
	const scoresAction = document.getElementById("prsScoresAction");
	if (scoresAction) scoresAction.innerHTML = "";
	const scoresStatus = document.getElementById("prsScoresDiv");
	if (scoresStatus) scoresStatus.textContent = "Choose a risk model from the PGS Catalog, or load example scores below to get started.";

	return pgsKeys.length;
}
window.clearPGSCache = clearPGSCache;

/*** Clear genome/23andMe cache (Genome:23andMe-txt-* keys only, not metadata)
 */
async function clearGenomeCache() {
	const keys = await localforage.keys();
	// Only clear keys like "Genome:23andMe-txt-hu09B28E", not metadata keys
	const genomeKeys = keys.filter(k => k.startsWith('Genome:23andMe-txt-'));
	for (const key of genomeKeys) {
		await localforage.removeItem(key);
	}
	console.log(`Genome cache cleared: removed ${genomeKeys.length} item(s)`);

	// Reset the loaded participants table and status.
	loadedUsers = [];
	window.loadedUsers = [];
	const usersAction = document.getElementById("prsUsersAction");
	if (usersAction) usersAction.innerHTML = "";
	const usersStatus = document.getElementById("prsUsersdiv");
	if (usersStatus) usersStatus.textContent = "Choose a 23andMe file from your data, or load example users below to get started.";

	return genomeKeys.length;
}
window.clearGenomeCache = clearGenomeCache;


/**
 * Organize PRS match results by allele count (0, 1, or 2).
 * Returns structured data suitable for plotting or analysis.
 * @param {Object} matchResult - Result from MatchOptimized function (contains pgsMatchMy23, alleles, calcRiskScore, PRS, etc.)
 * @param {Object} pgsData - Parsed PGS scoring file (contains cols, dt, meta)
 * @returns {Object} Organized data with matched/not_matched/matched_by_alleles breakdown
 */
function organizeResultsByAllele(matchResult, pgsData) {
	const obj = {};
	const indChr = pgsData.cols.indexOf('hm_chr');
	const indPos = pgsData.cols.indexOf('hm_pos');
	const indBeta = pgsData.cols.indexOf('effect_weight');

	// Extract matched PGS variants from pgsMatchMy23
	// Each element in pgsMatchMy23 is [23andMe variant(s), ..., PGS variant]
	const matched = matchResult.pgsMatchMy23.map(v => {
		if (v.length === 2) {
			return v[1]; // [23andMe, PGS]
		} else if (v.length >= 3) {
			return v[v.length - 1]; // Last element is PGS variant
		}
		return null;
	}).filter(Boolean);

	// Helper function to combine arrays into array of objects
	function Push(data, subdata) {
		return subdata.map((_, i) => {
			return Object.entries(data).reduce((a, [k, arr]) => (a[k] = arr[i], a), {});
		});
	}

	// --- MATCHED (all) ---
	const matched_risk = matched.map(j => j[indBeta]);
	const matched_chrPos = matched.map(j => `Chr${j[indChr]}.${j[indPos]}`);

	obj.matched = {
		chrPos: matched_chrPos,
		dt: matched,
		alleles: matchResult.alleles,
		risk: matched_risk,
		allele: matchResult.alleles,
		risk_x_allele: matched_risk.map((r, i) => r * (matchResult.alleles[i] ?? 0)),
		category: Array(matched.length).fill("matched"),
		count: matched.length
	};

	// --- NOT MATCHED ---
	const notMatchData = pgsData.dt.filter(element => !matched.includes(element));
	const not_matched_chrPos = notMatchData.map(j => `Chr${j[indChr]}.${j[indPos]}`);
	const not_matched_risk = notMatchData.map(j => j[indBeta]);

	obj.not_matched = {
		chrPos: not_matched_chrPos,
		dt: notMatchData,
		risk: not_matched_risk,
		category: Array(notMatchData.length).fill(`${notMatchData.length} not matched`),
		count: notMatchData.length,
		size: Array(notMatchData.length).fill("9"),
		color: Array(notMatchData.length).fill("rgb(140, 140, 140)"),
		opacity: Array(notMatchData.length).fill("0.5"),
		symbol: Array(notMatchData.length).fill("x"),
		hoverinfo: Array(notMatchData.length).fill("all")
	};

	// --- ALL VARIANTS ---
	const allData = pgsData.dt;
	const allData_chrPos = allData.map(j => `Chr${j[indChr]}.${j[indPos]}`);
	const allData_risk = allData.map(j => j[indBeta]);

	obj.all = {
		chrPos: allData_chrPos,
		dt: allData,
		risk: allData_risk,
		category: Array(allData.length).fill(" "),
		count: allData.length,
		size: Array(allData.length).fill("10"),
		color: Array(allData.length).fill("green"),
		opacity: Array(allData.length).fill("0"),
		symbol: Array(allData.length).fill("square"),
		hoverinfo: Array(allData.length).fill("none")
	};

	// --- MATCHED BY ALLELE COUNT (0, 1, 2) ---
	const alleles = matchResult.alleles;

	// Filter indices by allele count
	const zero_allele_idx = alleles.map((elm, idx) => elm === 0 ? idx : '').filter(x => x !== '');
	const one_allele_idx = alleles.map((elm, idx) => elm === 1 ? idx : '').filter(x => x !== '');
	const two_allele_idx = alleles.map((elm, idx) => elm === 2 ? idx : '').filter(x => x !== '');

	// Filter matched variants by allele count
	const zero_allele = matched.filter((_, idx) => alleles[idx] === 0);
	const one_allele = matched.filter((_, idx) => alleles[idx] === 1);
	const two_allele = matched.filter((_, idx) => alleles[idx] === 2);

	// Build chr.pos arrays
	const zero_allele_chrpos = zero_allele_idx.map(i => `Chr${matched[i][indChr]}.${matched[i][indPos]}`);
	const one_allele_chrpos = one_allele_idx.map(i => `Chr${matched[i][indChr]}.${matched[i][indPos]}`);
	const two_allele_chrpos = two_allele_idx.map(i => `Chr${matched[i][indChr]}.${matched[i][indPos]}`);

	obj.matched_by_alleles = {
		zero_allele: {
			chrPos: zero_allele_chrpos,
			dt: zero_allele,
			risk: zero_allele_idx.map(i => matched[i][indBeta]),
			allele: Array(zero_allele.length).fill(0),
			risk_x_allele: Array(zero_allele.length).fill(0),
			riskScores: zero_allele_idx.map(i => matchResult.calcRiskScore[i]),
			category: Array(zero_allele.length).fill(`${zero_allele.length} matched, zero alleles`),
			count: zero_allele.length,
			size: Array(zero_allele.length).fill("8"),
			color: Array(zero_allele.length).fill("#17becf"),
			opacity: Array(zero_allele.length).fill("1"),
			symbol: Array(zero_allele.length).fill("circle"),
			hoverinfo: Array(zero_allele.length).fill("all")
		},
		one_allele: {
			chrPos: one_allele_chrpos,
			dt: one_allele,
			risk: one_allele_idx.map(i => matched[i][indBeta]),
			allele: Array(one_allele.length).fill(1),
			risk_x_allele: one_allele_idx.map(i => matched[i][indBeta] * 1),
			riskScores: one_allele_idx.map(i => matchResult.calcRiskScore[i]),
			category: Array(one_allele.length).fill(`${one_allele.length} matched, one allele`),
			count: one_allele.length,
			size: Array(one_allele.length).fill("8"),
			color: Array(one_allele.length).fill("navy"),
			opacity: Array(one_allele.length).fill("1"),
			symbol: Array(one_allele.length).fill("diamond"),
			hoverinfo: Array(one_allele.length).fill("all")
		},
		two_allele: {
			chrPos: two_allele_chrpos,
			dt: two_allele,
			risk: two_allele_idx.map(i => matched[i][indBeta]),
			allele: Array(two_allele.length).fill(2),
			risk_x_allele: two_allele_idx.map(i => matched[i][indBeta] * 2),
			riskScores: two_allele_idx.map(i => matchResult.calcRiskScore[i]),
			category: Array(two_allele.length).fill(`${two_allele.length} matched, two alleles`),
			count: two_allele.length,
			size: Array(two_allele.length).fill("10"),
			color: Array(two_allele.length).fill("#d62728"),
			opacity: Array(two_allele.length).fill("1"),
			symbol: Array(two_allele.length).fill("square"),
			hoverinfo: Array(two_allele.length).fill("all")
		}
	};

	// --- COMBINED ITEMS for plotting (like plotAllMatchByEffect4) ---
	const items = Push(obj.all, obj.all.risk).concat(
		Push(obj.not_matched, obj.not_matched.risk)).concat(
		Push(obj.matched_by_alleles.zero_allele, obj.matched_by_alleles.zero_allele.risk)).concat(
		Push(obj.matched_by_alleles.one_allele, obj.matched_by_alleles.one_allele.risk)).concat(
		Push(obj.matched_by_alleles.two_allele, obj.matched_by_alleles.two_allele.risk));

	obj.items = items;

	// Summary stats
	obj.summary = {
		totalPgsVariants: pgsData.dt.length,
		totalMatched: matched.length,
		totalNotMatched: notMatchData.length,
		zeroAlleleCount: zero_allele.length,
		oneAlleleCount: one_allele.length,
		twoAlleleCount: two_allele.length,
		matchRate: (matched.length / pgsData.dt.length * 100).toFixed(2) + "%",
		PRS: matchResult.PRS,
		pgsId: matchResult.pgs_id ?? pgsData.meta?.pgs_id,
		trait: pgsData.meta?.trait_mapped ?? pgsData.meta?.trait_reported ?? ""
	};

	return obj;
}
window.organizeResultsByAllele = organizeResultsByAllele;


/** Example local users (all 10 from data folder) */
const EXAMPLE_USERS = [
	{
		id: "hu09B28E",
		name: "Joshua Yoakem",
		participant_id: "hu09B28E",
		publishedDate: "2025-01-27",
		gender: null,
		ethnicity: null,
		race: null,
		version: "v5",
		build: 37,
		genotypes: [{
			filename: "PGP_hu09B28E_genome_Joshua_Yoakem_v5_Full_20250127054538.txt",
			filetype: "23andme",
			download_url: "data/PGP_hu09B28E_genome_Joshua_Yoakem_v5_Full_20250127054538.txt"
		}]
	},
	{
		id: "hu0F2E0D",
		name: "Cajun",
		participant_id: "hu0F2E0D",
		publishedDate: "2023-11-21",
		gender: null,
		ethnicity: null,
		race: null,
		version: "v5",
		build: 37,
		genotypes: [{
			filename: "PGP_hu0F2E0D_genome_Cajun_v5_Full_20231121192441.txt",
			filetype: "23andme",
			download_url: "data/PGP_hu0F2E0D_genome_Cajun_v5_Full_20231121192441.txt"
		}]
	},
	{
		id: "hu50801B",
		name: "Melinda Chaperlo",
		participant_id: "hu50801B",
		publishedDate: "2024-07-28",
		gender: "Female",
		ethnicity: "Not Hispanic or Latino",
		race: "White",
		version: "v5",
		build: 37,
		genotypes: [{
			filename: "PGP_hu50801B_genome_Melinda_Chaperlo_v5_Full_20240728204807_(1).txt",
			filetype: "23andme",
			download_url: "data/PGP_hu50801B_genome_Melinda_Chaperlo_v5_Full_20240728204807_(1).txt"
		}]
	},
	{
		id: "huAE4518",
		name: "Marika Forsythe",
		participant_id: "huAE4518",
		publishedDate: "2024-08-26",
		gender: null,
		ethnicity: null,
		race: null,
		version: "v4",
		build: 37,
		genotypes: [{
			filename: "PGP_huAE4518_genome_Marika_Forsythe_v4_Full_20240826181111.txt",
			filetype: "23andme",
			download_url: "data/PGP_huAE4518_genome_Marika_Forsythe_v4_Full_20240826181111.txt"
		}]
	},
	{
		id: "huBE0518",
		name: "Christopher Smith",
		participant_id: "huBE0518",
		publishedDate: "2023-09-26",
		gender: null,
		ethnicity: null,
		race: null,
		version: "v5",
		build: 37,
		genotypes: [{
			filename: "PGP_huBE0518_genome_Christopher_Smith_v5_Full_20230926164611.txt",
			filetype: "23andme",
			download_url: "data/PGP_huBE0518_genome_Christopher_Smith_v5_Full_20230926164611.txt"
		}]
	},
	{
		id: "angela_prochazka",
		name: "Angela Prochazka",
		participant_id: "angela_prochazka",
		publishedDate: "2018-02-16",
		gender: "Female",
		ethnicity: "Hispanic or Latino",
		race: "American Indian / Alaska Native, Hispanic or Latino, White",
		version: "v5",
		build: 37,
		genotypes: [{
			filename: "genome_Angela_Prochazka_v5_Full_20180216181631.txt",
			filetype: "23andme",
			download_url: "data/genome_Angela_Prochazka_v5_Full_20180216181631.txt"
		}]
	},
	{
		id: "burnetta_hood",
		name: "Burnetta Hood",
		participant_id: "burnetta_hood",
		publishedDate: "2017-06-16",
		gender: "Female",
		ethnicity: "Black or African American",
		race: "Other",
		version: "v4",
		build: 37,
		genotypes: [{
			filename: "genome_Burnetta_Hood_v4_Full_20170616141234.txt",
			filetype: "23andme",
			download_url: "data/genome_Burnetta_Hood_v4_Full_20170616141234.txt"
		}]
	},
	{
		id: "lw",
		name: "LW",
		participant_id: "lw",
		publishedDate: "2017-09-24",
		gender: "Female",
		ethnicity: "Other",
		race: "Black or African American",
		version: "v5",
		build: 37,
		genotypes: [{
			filename: "genome_LW_v5_Full_20170924182428.txt",
			filetype: "23andme",
			download_url: "data/genome_LW_v5_Full_20170924182428.txt"
		}]
	},
	{
		id: "ritaann_valencia",
		name: "RitaAnn Valencia",
		participant_id: "ritaann_valencia",
		publishedDate: "2017-10-11",
		gender: "Female",
		ethnicity: "Hispanic or Latino",
		race: "Hispanic or Latino",
		version: "v5",
		build: 37,
		genotypes: [{
			filename: "genome_RitaAnn_Valencia_v5_Full_20171011005432.txt",
			filetype: "23andme",
			download_url: "data/genome_RitaAnn_Valencia_v5_Full_20171011005432.txt"
		}]
	},
	{
		id: "terrence_pinder",
		name: "Terrence Pinder",
		participant_id: "terrence_pinder",
		publishedDate: "2016-08-22",
		gender: "Male",
		ethnicity: "Other",
		race: "Black or African American",
		version: "v4",
		build: 37,
		genotypes: [{
			filename: "genome_Terrence_Pinder_v4_Full_20160822064115.txt",
			filetype: "23andme",
			download_url: "data/genome_Terrence_Pinder_v4_Full_20160822064115.txt"
		}]
	}
];

/** Example PGS scores (sample entries) */
const EXAMPLE_SCORES = [
	{
		id: "PGS000001",
		name: "PRS77_BC",
		trait_reported: "Breast cancer",
		variants_number: 77,
		date_release: "2019-10-14",
		local_file: "data/PGS000001_hmPOS_GRCh37.txt"
	},
	{
		id: "PGS000004",
		name: "PRS313_BC",
		trait_reported: "Breast carcinoma",
		variants_number: 313,
		date_release: "2019-10-14",
		local_file: "data/PGS000004_hmPOS_GRCh37.txt"
	},
	{
		id: "PGS000055",
		name: "PRS_CRC",
		trait_reported: "Colorectal cancer",
		variants_number: 76,
		date_release: "2019-07-01",
		local_file: "data/PGS000055_hmPOS_GRCh37.txt"
	},
	{
		id: "PGS000740",
		name: "PRS128_LC",
		trait_reported: "Lung cancer",
		variants_number: 128,
		date_release: "2021-01-01",
		local_file: "data/PGS000740_hmPOS_GRCh37.txt"
	},
	{
		id: "PGS001808",
		name: "portability-PLR_191.11",
		trait_reported: "Brain cancer",
		variants_number: 117,
		date_release: "2022-07-28",
		local_file: "data/PGS001808_hmPOS_GRCh37.txt"
	}
];


/** Escape HTML special characters */
function escapeHtml(str) {
	const div = document.createElement("div");
	div.textContent = str ?? "";
	return div.innerHTML;
}

/** Collect the values of all checked checkboxes matching a selector into a Set. */
function getCheckedIds(selector) {
	return new Set(Array.from(document.querySelectorAll(selector + ":checked")).map(cb => cb.value));
}

/*** Resolve the genome file path for a user, checking the various shapes a user object can take.
 * @param {Object} user - User/participant object
 * @returns {string|null} File path/URL or null if none found
 */
function resolveUserFilePath(user) {
	const genos = user?.genotypes ?? [];
	return user?.downloadUrl
		?? user?.download_url
		?? user?.url
		?? genos[0]?.download_url
		?? genos[0]?.file
		?? null;
}

/*** Build the inner HTML for the PGS scores table.
 * @param {Object[]} scores - Score metadata objects
 * @param {Object[]} [txts=[]] - Parsed PGS txt objects (used for the "Variants Loaded" column)
 * @returns {string} Table HTML
 */
function renderScoresTable(scores, txts = []) {
	const rows = scores.map((score, idx) => {
		const id = escapeHtml(score?.id ?? "");
		const name = escapeHtml(score?.name ?? "");
		const trait = escapeHtml(score?.trait_reported ?? "");
		const variants = escapeHtml(score?.variants_number ?? "");
		const date = escapeHtml(score?.date_release ?? "");
		const loadedTxt = txts.find(t => (t?.id ?? t?.meta?.pgs_id) === score.id);
		const variantsLoaded = loadedTxt?.dt?.length ?? 0;
		return `
			<tr>
				<td>${idx + 1}</td>
				<td><input type="checkbox" class="form-check-input prs-select-cb" value="${id}" checked /></td>
				<td>${id}</td>
				<td>${name}</td>
				<td>${trait}</td>
				<td>${variants}</td>
				<td>${variantsLoaded.toLocaleString()}</td>
				<td>${date}</td>
			</tr>`;
	}).join("");

	return `
		<table class="table table-striped table-sm mt-3">
			<thead class="table-dark">
				<tr>
					<th>#</th>
					<th>Select</th>
					<th>PGS ID</th>
					<th>Name</th>
					<th>Trait</th>
					<th>Variants #</th>
					<th>Variants Loaded</th>
					<th>Date</th>
				</tr>
			</thead>
			<tbody>${rows}</tbody>
		</table>`;
}

/*** Build the inner HTML for the users/participants table.
 * @param {Object[]} users - User/participant objects to display
 * @param {Object[]} loaded - Loaded { user, parsed } entries (used for "Variants Loaded")
 * @returns {string} Table HTML
 */
function renderUsersTable(users, loaded) {
	const rows = users.map((user, idx) => {
		const id = escapeHtml(user?.id ?? user?.participant_id ?? "");
		const displayId = escapeHtml(user?.participant_id ?? user?.id ?? "");
		const fileTag = (user?.participant_id != null && user?.id !== user?.participant_id && user?._fileIndex != null)
			? ` <span class="badge bg-secondary rounded-pill">file ${user._fileIndex + 1}</span>`
			: "";
		const name = escapeHtml(user?.name ?? "");
		const ethnicity = escapeHtml(user?.ethnicity ?? "");
		const race = escapeHtml(user?.race ?? "");
		const gender = escapeHtml(user?.gender ?? "");
		const published = escapeHtml(user?.publishedDate ?? user?.published_date ?? user?.date ?? "");
		const genos = user?.genotypes ?? [];
		const filename = user?.fileName ?? user?.filename ?? genos?.[0]?.filename ?? "";
		const inferredVersion = (() => {
			const m = String(filename).match(/_v(\d+)_/i);
			return m ? `v${m[1]}` : "";
		})();
		const version = escapeHtml(user?.version ?? genos?.[0]?.version ?? inferredVersion ?? "");
		const build = escapeHtml(user?.build ?? genos?.[0]?.build ?? "");
		const genoCount = genos.length;
		const downloadUrl = resolveUserFilePath(user) ?? "";
		const downloadHtml = downloadUrl ? `<a href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener">Download</a>` : "-";
		const loadedData = loaded.find(d => d.user.id === user.id);
		const variantCount = loadedData?.parsed?.dt?.length ?? 0;
		return `
			<tr>
				<td>${idx + 1}</td>
				<td><input type="checkbox" class="form-check-input prs-user-select-cb" value="${id}" checked /></td>
				<td>${displayId}${fileTag}</td>
				<td>${name}</td>
				<td>${ethnicity || "-"}</td>
				<td>${race || "-"}</td>
				<td>${gender || "-"}</td>
				<td>${version || "-"}</td>
				<td>${build || "-"}</td>
				<td>${published}</td>
				<td>${genoCount}</td>
				<td>${variantCount.toLocaleString()}</td>
				<td>${downloadHtml}</td>
			</tr>`;
	}).join("");

	return `
		<table class="table table-striped table-sm mt-3">
			<thead class="table-dark">
				<tr>
					<th>#</th>
					<th>Select</th>
					<th>Participant ID</th>
					<th>Name</th>
					<th>Ethnicity</th>
					<th>Race</th>
					<th>Gender</th>
					<th>Version</th>
					<th>Build</th>
					<th>Published Date</th>
					<th>Genotypes #</th>
					<th>Variants Loaded</th>
					<th>Download</th>
				</tr>
			</thead>
			<tbody>${rows}</tbody>
		</table>`;
}

/*** Load and parse a list of PGS scoring files.
 * Reuses each score's pre-parsed data when present; the rest are fetched one id
 * at a time via getPgsTxt() (fetch + parse + cache).
 * Returns { score, parsed } entries, skipping any that fail to parse.
 * @param {Object[]} scores - Score metadata objects (each with an .id)
 * @returns {Promise<Object[]>} Array of { score, parsed }
 */
async function loadScoresFromList(scores, onProgress = null) {
	const results = [];
	const toFetch = [];
	let completed = 0;
	const total = scores.length;
	const reportProgress = () => {
		if (typeof onProgress === "function") onProgress(completed, total);
	};
	reportProgress();
	for (const score of scores) {
		// Reuse pre-parsed data if present (e.g., pre-loaded elsewhere)
		if (score?._parsed && score._parsed.dt && score._parsed.dt.length > 0) {
			console.log(`Using pre-parsed data for ${score.id}: ${score._parsed.dt.length} variants`);
			results.push({ score, parsed: score._parsed });
			completed += 1;
			reportProgress();
		} else {
			toFetch.push(score);
		}
	}

	if (toFetch.length > 0) {
		// Load one score at a time so progress can be updated per score.
		for (const score of toFetch) {
			try {
				const result = await getPgsTxt(score.id);
				const parsed = Array.isArray(result) ? result[0] : result;
				if (!parsed) {
					console.warn(`No parseable file for score ${score?.id}`);
				} else {
					results.push({ score, parsed });
				}
			} catch (err) {
				console.error(`Failed to load scoring file ${score?.id}:`, err);
			}
			completed += 1;
			reportProgress();
			}
	}

	return results;
}

/*** Fetch selected PGS scoring files, parse them, and display them in a table.
 * Called when the user clicks the "Fetch Files" button.
 * Mirrors fetchUsers(): resolves selection (or example), parses each file
 * (with caching + pre-parsed reuse), and populates loadedScores + window.loadedPgsTxts.
 * Uses example data when offline or nothing is selected. */
async function fetchScores() {
	const statusEl = document.getElementById("prsScoresDiv");
	const resultsDiv = document.getElementById("prsScoresAction");
	const loadStartMs = performance.now();
	setProgressBar("scores", statusEl, 0);


	try {
		// Get selected scores from the Polygenic Scores tab (if available), defined in displayScores.js
		const selectedScores = window.getSelectedScores?.() ?? [];
		console.log(`fetchScores(): Selected scores from window.getSelectedScores():`, selectedScores);

		if (selectedScores.length === 0) {
			if (statusEl) statusEl.textContent = "Please select at least one scoring file.";
			if (resultsDiv) resultsDiv.innerHTML = "";
			setProgressBar("scores", statusEl, 0);
			return;
		}
		if (statusEl) statusEl.textContent = `Fetching and parsing ${selectedScores.length} scoring file(s)...`;
		setProgressBar("scores", statusEl, 10);

		// Parse scoring files for all selected scores (getPgsTxt handles fetch, parse, and caching)
		const added = await loadScoresFromList(selectedScores, (done, total) => {
			const pct = total > 0 ? 10 + (done / total) * 80 : 90;
			setProgressBar("scores", statusEl, pct);
		});

		// Populate loadedScores (metadata) so calculatePRS builds selectedIds correctly
		loadedScores = added.map(a => a.score);

		// Populate window.loadedPgsTxts (parsed) so calculatePRS reuses them without refetching
		window.loadedPgsTxts = added.map(a => a.parsed);

		const elapsedSec = ((performance.now() - loadStartMs) / 1000).toFixed(2);
		if (statusEl) statusEl.textContent = `Loaded ${loadedScores.length} of ${selectedScores.length} scoring file(s) in ${elapsedSec}s.`;
		setProgressBar("scores", statusEl, 100);

		// Render table
		if (resultsDiv) {
			resultsDiv.innerHTML = renderScoresTable(loadedScores, window.loadedPgsTxts);
		}

		console.log("fetchScores() loadedScores:", loadedScores);

		// Update cluster page
		if (typeof window.renderCluster === "function") {
			window.renderCluster();
		}
	} catch (err) {
		console.error("fetchScores error:", err);
		if (statusEl) statusEl.textContent = `Error: ${err.message}`;
		setProgressBar("scores", statusEl, 100);
	}
}
window.fetchScores = fetchScores;





/*** Load and parse a list of user genome files.
 * For each user: reuses pre-parsed data if present, otherwise resolves the file
 * path and loads it via get23Txt (which caches internally under
 * "Genome:23andMe-txt-*"). Returns { user, parsed } entries, skipping failures.
 *
 * Like loadScoresFromList, genomes are loaded one file at a time â€” get23Txt
 * fetches, parses, and cache-checks each file individually.
 * @param {Object[]} users - User/participant objects
 * @returns {Promise<Object[]>} Array of { user, parsed }
 */
async function loadUsersFromList(users, onProgress = null) {
	const results = [];
	let completed = 0;
	const total = users.length;
	const reportProgress = () => {
		if (typeof onProgress === "function") onProgress(completed, total);
	};
	reportProgress();

	for (const user of users) {
		// Check if user already has parsed data (e.g., from uploaded file)
		if (user?._parsed && user._parsed.dt && user._parsed.dt.length > 0) {
			console.log(`Using pre-parsed data for ${user.id}: ${user._parsed.dt.length} variants`);
			results.push({ user, parsed: user._parsed });
			completed += 1;
			reportProgress();
			continue;
		}

		const filePath = resolveUserFilePath(user);
		if (!filePath) {
			console.warn(`No file path or pre-parsed data for user ${user?.id}`);
			completed += 1;
			reportProgress();
			continue;
		}
		try {
			const parsed = await get23Txt(filePath, user.id);
			results.push({ user, parsed });
		} catch (err) {
			console.error(`Failed to load genome for ${user.id}:`, err);
		}
		completed += 1;
		reportProgress();
	}

	return results;
}

/*** Fetch selected users, display them in a table, and parse their genome files.
 * Called when the user clicks the "Fetch Users" button in the PRS tab.
 * Uses example data when offline or nothing is selected. */
async function fetchUsers() {
    console.log("fetchUsers() called");
	const statusEl = document.getElementById("prsUsersdiv");
	const resultsDiv = document.getElementById("prsUsersAction");
	const loadStartMs = performance.now();
	setProgressBar("users", statusEl, 0);


	try {
		// Get selected users from the 23andMe Data tab
		const selectedUsers = window.getSelectedUsers?.() ?? [];
		console.log(`fetchUsers(): Selected users from window.getSelectedUsers():`, selectedUsers);

		if (selectedUsers.length === 0) {
			if (statusEl) statusEl.textContent = "Please select at least one participant in the 23andMe Data tab.";
			if (resultsDiv) resultsDiv.innerHTML = "";
			setProgressBar("users", statusEl, 0);
			return;
		}
		if (statusEl) statusEl.textContent = `Fetching and parsing ${selectedUsers.length} participant genome file(s)...`;
		setProgressBar("users", statusEl, 10);

		// Parse genome files for all selected users
		loadedUsers = await loadUsersFromList(selectedUsers, (done, total) => {
			const pct = total > 0 ? 10 + (done / total) * 80 : 90;
			setProgressBar("users", statusEl, pct);
		});
		window.loadedUsers = loadedUsers; // expose for cluster tab

		const loadedFilesCount = document.getElementById('loadedFilesCount');
		if (loadedFilesCount) {
			loadedFilesCount.textContent = `Loaded Data: ${loadedUsers.length} / ${selectedUsers.length}`;
			loadedFilesCount.style.display = '';
		}

		const elapsedSec = ((performance.now() - loadStartMs) / 1000).toFixed(2);
		if (statusEl) statusEl.textContent = `Loaded ${loadedUsers.length} of ${selectedUsers.length} participant(s) in ${elapsedSec}s.`;
		setProgressBar("users", statusEl, 100);

		// Render table
		if (resultsDiv) {
			resultsDiv.innerHTML = renderUsersTable(selectedUsers, loadedUsers);
		}

		console.log("fetchUsers() loadedUsers:", loadedUsers);
	} catch (err) {
		console.error("fetchUsers error:", err);
		if (statusEl) statusEl.textContent = `Error: ${err.message}`;
		setProgressBar("users", statusEl, 100);
	}
}
window.fetchUsers = fetchUsers;

// Wire up the fetch users button
const fetchUsersBtn = document.getElementById("fetchUsersBtn");
if (fetchUsersBtn) {
	fetchUsersBtn.addEventListener("click", fetchUsers);
}

/** * Load example scores directly into the PRS table.
 * Appends to any already-loaded scores instead of replacing them. */
async function loadExampleScores() {
	console.log("loadExampleScores() called");
	const statusEl = document.getElementById("prsScoresDiv");
	const resultsDiv = document.getElementById("prsScoresAction");
	const prsStatus = document.getElementById("prsResultsStatus");
	const loadStartMs = performance.now();
	setProgressBar("scores", statusEl, 0);

	// Preserve existing loaded scores; only add scores not already loaded (by id).
	const existing = Array.isArray(loadedScores) ? loadedScores.slice() : [];
	const existingIds = new Set(existing.map(s => s?.id).filter(Boolean));

	// Include any risk models the user selected in the Polygenic Scores tab (tab 2),
	// so a pending selection is loaded alongside the example set instead of being ignored.
	const selectedScores = (window.getSelectedScores?.() ?? []).filter(s => s?.id);
	const selectedIdSet = new Set(selectedScores.map(s => s.id));

	// Candidate list: user-selected scores first, then example scores. Dedup by id, skip already loaded.
	const candidateMap = new Map();
	for (const s of [...selectedScores, ...EXAMPLE_SCORES]) {
		if (s?.id && !existingIds.has(s.id) && !candidateMap.has(s.id)) {
			candidateMap.set(s.id, s);
		}
	}
	const toLoad = Array.from(candidateMap.values());

	if (toLoad.length === 0) {
		if (statusEl) statusEl.textContent = `All ${EXAMPLE_SCORES.length} example risk model(s) are already loaded.`;
		setProgressBar("scores", statusEl, 100);
		return;
	}

	if (statusEl) statusEl.textContent = `Adding ${toLoad.length} example risk model(s) to ${existing.length} already loaded...`;
	if (prsStatus) prsStatus.textContent = "";

	// Fetch and parse each score (getPgsTxt handles fetch, parse, and caching)
	const added = await loadScoresFromList(toLoad, (done, total) => {
		const pct = total > 0 ? 10 + (done / total) * 80 : 90;
		setProgressBar("scores", statusEl, pct);
	});

	// Append metadata to loadedScores (dedup by id) so calculatePRS builds selectedIds correctly
	loadedScores = existing.concat(added.map(a => a.score));

	// Append parsed txts to window.loadedPgsTxts (dedup by id) so calculatePRS reuses them without refetching
	const existingTxts = Array.isArray(window.loadedPgsTxts) ? window.loadedPgsTxts.slice() : [];
	const existingTxtIds = new Set(existingTxts.map(t => t?.id ?? t?.meta?.pgs_id).filter(Boolean));
	const addedTxts = added.map(a => a.parsed).filter(p => !existingTxtIds.has(p?.id ?? p?.meta?.pgs_id));
	window.loadedPgsTxts = existingTxts.concat(addedTxts);

	const elapsedSec = ((performance.now() - loadStartMs) / 1000).toFixed(2);
	if (statusEl) statusEl.textContent = `Loaded ${loadedScores.length} risk model(s) total: ${existing.length} previously + ${added.length} example in ${elapsedSec}s.`;
	setProgressBar("scores", statusEl, 100);

	if (resultsDiv) {
		resultsDiv.innerHTML = renderScoresTable(loadedScores, window.loadedPgsTxts);
	}

	console.log("Loaded example scores with parsed data:", loadedScores);

	// Update cluster page
	if (typeof window.renderCluster === "function") {
		window.renderCluster();
	}
}

/** * Load example users directly into the users table.
 * Appends to any already-loaded users (from the Genomic Data tab selection) instead of replacing them. */
async function loadExampleUsers() {
	console.log("775 loadExampleUsers() called");
	const statusEl = document.getElementById("prsUsersdiv");
	const resultsDiv = document.getElementById("prsUsersAction");
	const prsStatus = document.getElementById("prsResultsStatus");
	const loadStartMs = performance.now();
	setProgressBar("users", statusEl, 0);

	// Preserve existing loaded users; only add example users not already loaded (by id).
	const existing = Array.isArray(loadedUsers) ? loadedUsers.slice() : [];
	const existingIds = new Set(existing.map(entry => entry?.user?.id).filter(Boolean));
	const toLoad = EXAMPLE_USERS.filter(u => !existingIds.has(u.id));

	if (toLoad.length === 0) {
		if (statusEl) statusEl.textContent = `All ${EXAMPLE_USERS.length} example participant(s) are already loaded.`;
		setProgressBar("users", statusEl, 100);
		return;
	}

	if (statusEl) statusEl.textContent = `Adding ${toLoad.length} example participant(s) to ${existing.length} already loaded...`;
	if (prsStatus) prsStatus.textContent = "";

	// Fetch and parse each user's genome file (get23Txt caches internally)
	if (statusEl) statusEl.textContent = `Adding ${toLoad.length} example participant(s) to ${existing.length} already loaded...`;
	const added = await loadUsersFromList(toLoad, (done, total) => {
		const pct = total > 0 ? 10 + (done / total) * 80 : 90;
		setProgressBar("users", statusEl, pct);
	});

	loadedUsers = existing.concat(added);
	window.loadedUsers = loadedUsers; // expose for cluster tab

	const elapsedSec = ((performance.now() - loadStartMs) / 1000).toFixed(2);
	if (statusEl) statusEl.textContent = `Loaded ${loadedUsers.length} participant(s) total: ${existing.length} previously + ${added.length} example in ${elapsedSec}s.`;
	setProgressBar("users", statusEl, 100);

	if (resultsDiv) {
		const displayUsers = loadedUsers.map(entry => entry.user);
		resultsDiv.innerHTML = renderUsersTable(displayUsers, loadedUsers);
	}

	console.log("Loaded example users with parsed data:", loadedUsers);

	// Update cluster page with loaded users
	if (typeof window.renderCluster === "function") {
		window.renderCluster();
	}

	// Update the PRS results section to show users are ready
	const prsResultsDiv = document.getElementById("prsResultsDiv");
	if (prsResultsDiv && loadedUsers.length > 0) {
		const userRows = loadedUsers.map((d, idx) => {
			const id = escapeHtml(d.user?.id ?? "");
			const name = escapeHtml(d.user?.name ?? "");
			const variants = d.parsed?.dt?.length ?? 0;
			return `<tr><td>${idx + 1}</td><td>${id}</td><td>${name}</td><td>${variants.toLocaleString()}</td><td><span class="text-muted">Ready</span></td></tr>`;
		}).join("");

		prsResultsDiv.innerHTML = `
			<p class="text-muted small">Users loaded and ready for PRS calculation. Click "Calculate PRS" to compute scores.</p>
			<table class="table table-striped table-sm">
				<thead class="table-dark">
					<tr>
						<th>#</th>
						<th>User ID</th>
						<th>Name</th>
						<th>Variants</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>${userRows}</tbody>
			</table>`;
	}
}

function setupClickBlueButton(btn) {
	if (!btn) return;
	btn.classList.remove("btn-primary", "btn-success", "btn-info", "btn-warning", "btn-danger", "btn-dark");
	btn.classList.add("btn-secondary");
	btn.addEventListener("click", () => {
		btn.classList.remove("btn-secondary");
		btn.classList.add("btn-primary");
	});
}

// Wire up example buttons
const loadExampleScoresBtn = document.getElementById("loadExampleScoresBtn");
setupClickBlueButton(loadExampleScoresBtn);
if (loadExampleScoresBtn) {
	loadExampleScoresBtn.addEventListener("click", loadExampleScores);
}

const loadExampleUsersBtn = document.getElementById("loadExampleUsersBtn");
setupClickBlueButton(loadExampleUsersBtn);
if (loadExampleUsersBtn) {
	loadExampleUsersBtn.addEventListener("click", loadExampleUsers);
}

// Wire up the fetch scores button
const fetchScoresBtn = document.getElementById("fetchScoresBtn");
if (fetchScoresBtn) {
	fetchScoresBtn.addEventListener("click", fetchScores);
}

window.loadExampleScores = loadExampleScores;
window.loadExampleUsers = loadExampleUsers;

// Expose example data for manual use
window.EXAMPLE_USERS = EXAMPLE_USERS;
window.EXAMPLE_SCORES = EXAMPLE_SCORES;

/** Return browser storage usage statistics via the Storage Estimation API. */
async function getBrowserStorageInfo() {
	const storageEstimate = await navigator.storage.estimate();
	return {
		usageGB: (storageEstimate.usage / 1024 ** 3).toFixed(2),
		quotaGB: (storageEstimate.quota / 1024 ** 3).toFixed(2),
		percentUsed: ((storageEstimate.usage / storageEstimate.quota) * 100).toFixed(1) + "%"
	};
}
window.getBrowserStorageInfo = getBrowserStorageInfo;

/**
 * Derive a human-readable name from a 23andMe / PGP genome filename.
 * Extracts the portion between "genome_" and the version marker "_v\d+_" / "_V\d+_".
 * e.g. "genome_James_Jones_v5_full_20171221.txt" â†’ "James Jones"
 *      "PGP_hu09B28E_genome_Joshua_Yoakem_v5_Full_20250127.txt" â†’ "Joshua Yoakem"
 * Returns null if the pattern is not found.
 */
function nameFromFilename(filename) {
	if (!filename) return null;
	// Extract just the basename (handles full URLs like finalUrl)
	const base = String(filename).replace(/.*\//, '');
	const m = base.match(/(?:^|_)genome_(.+?)_[vV]\d+_/i);
	if (!m) return null;
	return m[1]
		.replace(/_/g, ' ')
		.replace(/\b\w/g, c => c.toUpperCase())
		.trim() || null;
}

/*** Resolve the best display name for a user (upload filename, filename-derived, or stored name).
 * @param {Object} user - User object
 * @returns {string} Display name
 */
function resolveUserName(user) {
	if (user?.dataSource === 'file Upload' && user?.fileName) {
		return user.fileName;
	}
	return nameFromFilename(
		user?.fileName ??
		user?.finalUrl ??
		user?.downloadUrl ??
		user?.genotypes?.[0]?.filename
	) || user?.name;
}

/*** Helper: Calculate PRS with automatic caching
 * Checks cache first, calculates if not found, then stores result.
 * @param {Object} mypgs - Parsed PGS data
 * @param {Object} my23 - Parsed 23andMe genome
 * @param {string} userId - User ID (for cache key)
 * @param {string} pgsId - PGS ID (for cache key)
 * @param {Object} userData - Full user data (for result enrichment)
 * @returns {Promise<Object>} PRS result with metadata { result, organized, fromCache }
 */
async function calculateAndCachePRS(mypgs, my23, userId, pgsId, userData) {
	const userName = resolveUserName(userData.user);

	// Check cache first
	const cached = await getCachedPRS(userId, pgsId);
	if (cached) {
		let organizedData = cached.organized;
		if (!organizedData && cached.pgsMatchMy23 && cached.alleles) {
			organizedData = organizeResultsByAllele(cached, mypgs);
		}
		console.log('[nameFromFilename] cache hit:', userData.user?.id, 'src:', userData.user?.fileName ?? userData.user?.finalUrl, 'â†’', userName);
		return {
			...cached,
			userName,
			organized: organizedData,
			pgs: cached.pgs ?? { cols: mypgs.cols, dt: mypgs.dt, meta: mypgs.meta },
			fromCache: true
		};
	}

	// Calculate if not cached
	const result = MatchOptimized(mypgs, my23);
	//console.log("Calculated PRS result:", result);
	const organizedData = organizeResultsByAllele(result, mypgs);

	const prsResult = {
		userId,
		userName,
		userDate: userData.user.publishedDate ?? userData.user.published_date ?? "",
		pgsId,
		totalVariants: mypgs.dt.length,
		...result,
		organized: organizedData,
		pgs: { cols: mypgs.cols, dt: mypgs.dt, meta: mypgs.meta },
		genome: { cols: my23.cols, variantCount: my23.dt.length },
		fromCache: false
	};

	// Store in cache
	await setCachedPRS(userId, pgsId, prsResult);
	return prsResult;
}

/*** Calculate PRS using loaded scores and users.
 * Triggered by the "Calculate PRS" button.
 */
async function calculatePRS() {
	console.log("calculatePRS()");
	const timerStartMs = performance.now();
	const statusEl = document.getElementById("prsResultsStatus");
	const resultsDiv = document.getElementById("prsResultsDiv");
	if (statusEl) statusEl.textContent = "Calculating PRS...";
	setProgressBar("calculate", statusEl, 0);

	try {
		//// GET USERS: use loadedUsers (from fetchUsers / loadExampleUsers),
		//  filtered to only those whose checkbox is still checked in the PRS users table.
		//  If loadedUsers is empty, fall back to window.getSelectedUsers() from the LocalData tab.
		let userDataForCalc = loadedUsers;
		console.log("loadedUsers", userDataForCalc);

		// Filter by checkboxes in the PRS users table (if rendered)
		const checkedUserIds = getCheckedIds(".prs-user-select-cb");
		if (checkedUserIds.size > 0 && userDataForCalc.length > 0) {
			userDataForCalc = userDataForCalc.filter(d => checkedUserIds.has(d.user.id ?? d.user.participant_id));
			console.log(`Filtered to ${userDataForCalc.length} checked user(s):`, Array.from(checkedUserIds));
		}

		if (userDataForCalc.length === 0) {
			// Try to get selected users from the 23andMe Data tab
			const selectedUsers = window.getSelectedUsers?.() ?? [];
			console.log("No loadedUsers â€” falling back to LocalData tab selection:", selectedUsers);
			if (selectedUsers.length === 0) {
				if (statusEl) statusEl.textContent = "No users loaded. Use 'Fetch Users' or 'Load Example Users' in the PRS tab, or select users in the 23andMe Data tab.";
				return;
			}

			if (statusEl) statusEl.textContent = `Loading ${selectedUsers.length} user genome file(s)...`;

			// Process each user - use pre-parsed data if available, otherwise fetch from URL
			userDataForCalc = await loadUsersFromList(selectedUsers);

			console.log("userDataForCalc (from LocalData tab):", userDataForCalc);

			if (userDataForCalc.length === 0) {
				if (statusEl) statusEl.textContent = "Failed to load user genome files.";
				return;
			}
		}

		//// GET SCORES: prefer dynamically selected scores, else loadedScores
		const dynamicScores = window.getSelectedScores?.() ?? [];
		let selectedScoresList = dynamicScores.length > 0 ? dynamicScores : loadedScores;
		const usingExample = dynamicScores.length === 0 && loadedScores.length > 0;
		console.log("Selected scores for PRS calculation:", selectedScoresList, usingExample ? "(example)" : "(selected)");

		// Filter by checkboxes in the PRS scores table (mirrors .prs-user-select-cb behavior for users)
		const checkedScoreIds = getCheckedIds(".prs-select-cb");
		if (checkedScoreIds.size > 0 && selectedScoresList.length > 0) {
			selectedScoresList = selectedScoresList.filter(s => checkedScoreIds.has(s.id));
			console.log(`Filtered to ${selectedScoresList.length} checked score(s):`, Array.from(checkedScoreIds));
		}

		const selectedIds = selectedScoresList.map(s => s.id);

		if (selectedIds.length === 0) {
			if (statusEl) statusEl.textContent = "No PGS scores loaded. Click 'Load Example Scores' first.";
			return;
		}

		// Update scores table display
		const scoresDiv = document.getElementById("prsScoresDiv");
		const scoresAction = document.getElementById("prsScoresAction");
		if (scoresDiv) scoresDiv.textContent = `Using ${selectedScoresList.length} ${usingExample ? "example" : "selected"} scoring file(s).`;
		if (scoresAction) {
			scoresAction.innerHTML = renderScoresTable(selectedScoresList, window.loadedPgsTxts ?? []);
		}

		// Load PGS txt files (use pre-loaded from Polygenic Scores tab, or fetch)
		if (statusEl) statusEl.textContent = `Calculating PRS....`;

		let pgsTxts = [];

		// Check if PGS files were pre-loaded in the Polygenic Scores tab
		const preloadedTxts = window.loadedPgsTxts ?? [];
		if (preloadedTxts.length > 0) {
			// Filter to only selected IDs
			pgsTxts = preloadedTxts.filter(pgs => {
				const pgsId = pgs?.id ?? pgs?.meta?.pgs_id;
				return selectedIds.includes(pgsId);
			});
			console.log(`Using ${pgsTxts.length} pre-loaded PGS files from Polygenic Scores tab`);
		}

		// If not enough pre-loaded files, fetch missing ones
		if (pgsTxts.length < selectedIds.length) {
			const loadedIds = new Set(pgsTxts.map(p => p?.id ?? p?.meta?.pgs_id));
			const missingScores = selectedScoresList.filter(s => !loadedIds.has(s.id));

			if (missingScores.length > 0) {
				console.log(`Fetching ${missingScores.length} missing PGS files...`);
				if (statusEl) statusEl.textContent = `Fetching ${missingScores.length} missing PGS file(s)...`;
				const added = await loadScoresFromList(missingScores);
				pgsTxts.push(...added.map(a => a.parsed));
			}
		}

		console.log("PGS txts for calculation:", pgsTxts);

		// Run PRS calculation for each user x score combination
		if (statusEl) statusEl.textContent = `Calculating PRS for ${userDataForCalc.length} user(s) x ${pgsTxts.length} model(s)...`;

		const prsResults = [];
		let cachedCount = 0;
		let calculatedCount = 0;
		const totalPairs = userDataForCalc.length * pgsTxts.length;
		let completedPairs = 0;

		for (const userData of userDataForCalc) {
			const my23 = userData.parsed;
			const userId = userData.user.id;

			for (const mypgs of pgsTxts) {
				const pgsId = mypgs.id ?? mypgs.meta?.pgs_id ?? mypgs.url;

				const prsResult = await calculateAndCachePRS(mypgs, my23, userId, pgsId, userData);
				prsResults.push(prsResult);
				completedPairs += 1;
				setProgressBar("calculate", statusEl, totalPairs > 0 ? (completedPairs / totalPairs) * 100 : 100);

				if (prsResult.fromCache) cachedCount++;
				else calculatedCount++;
			}
		}

		console.log("PRS results:", prsResults);
		window.prsResults = prsResults;  // expose for cluster tab
		if (window.sdk) window.sdk.prsResults = prsResults;  // mirror into namespace

		// Invalidate cluster cache when PRS results change
		if (typeof window.invalidateClusterCache === 'function') {
			window.invalidateClusterCache();
		}

		const elapsedSec = ((performance.now() - timerStartMs) / 1000).toFixed(2);
		if (statusEl) statusEl.textContent = `Completed! ${elapsedSec}s. ${prsResults.length} result(s) (${cachedCount} from cache, ${calculatedCount} calculated).`;
		setProgressBar("calculate", statusEl, 100);

		// Display results
		if (resultsDiv) {
			if (prsResults.length > 0) {
				const rows = prsResults.map((r, idx) => {
					const org = r.organized?.summary ?? {};
					return `
					<tr${r.fromCache ? ' class="table-secondary"' : ''}>
						<td>${idx + 1}</td>
						<td>${escapeHtml(r.userId)}</td>
						<td>${escapeHtml(r.userName ?? "")}</td>
						<td>${escapeHtml(r.pgsId)}</td>
						<td>${typeof r.PRS === 'number' ? r.PRS.toFixed(6) : (r.PRS ?? "-")}</td>
						<td>${r.alleles?.length ?? 0}</td>
						<td title="Zero alleles">${org.zeroAlleleCount ?? "-"}</td>
						<td title="One allele">${org.oneAlleleCount ?? "-"}</td>
						<td title="Two alleles">${org.twoAlleleCount ?? "-"}</td>
						<td>${r.totalVariants ?? "-"}</td>
						<td>${org.matchRate ?? "-"}</td>
						<td>${r.QC ? "âœ“" : r.QCtext ?? "-"}</td>
						<td>${r.fromCache ? "ðŸ“¦" : "ðŸ”„"}</td>
					</tr>
				`;
				}).join("");

				resultsDiv.innerHTML = `
					<table class="table table-striped table-sm mt-3">
						<thead class="table-dark">
							<tr>
								<th>#</th>
								<th>User ID</th>
								<th>Name</th>
								<th>PGS ID</th>
								<th>PRS Score</th>
								<th>Matched</th>
								<th title="Matched with 0 effect alleles">0</th>
								<th title="Matched with 1 effect allele">1</th>
								<th title="Matched with 2 effect alleles">2</th>
								<th>Total</th>
								<th>Match %</th>
								<th>QC</th>
								<th title="ðŸ“¦ = cached, ðŸ”„ = calculated">Src</th>
							</tr>
						</thead>
						<tbody>${rows}</tbody>
					</table>
					<details class="mt-2">
						<summary>Raw JSON</summary>
						<pre class="small">${JSON.stringify(prsResults, null, 2)}</pre>
					</details>`;
			} else {
				resultsDiv.innerHTML = `<p class="text-muted">PRS calculation completed. Check console for details.</p>`;
			}
		}

	} catch (err) {
		console.error("calculatePRS error:", err);
		if (statusEl) statusEl.textContent = `Error: ${err.message}`;
		setProgressBar("calculate", statusEl, 100);
	}
}

// Wire up Calculate PRS button
const calculatePrsBtn = document.getElementById("calculatePrsBtn");
setupClickBlueButton(calculatePrsBtn);
if (calculatePrsBtn) {
	calculatePrsBtn.addEventListener("click", calculatePRS);
}

// window.calculatePRS = calculatePRS;

// --- window.sdk namespace ---
// Collect all public functions under window.sdk so they are accessible as
// window.sdk.getBrowserStorageInfo(), window.sdk.clearPRSCache(), etc.
// Object.assign merges with any entries already added by other modules.
window.sdk = Object.assign(window.sdk ?? {}, {
	// Storage utilities
	getBrowserStorageInfo,
	clearPRSCache,
	clearPGSCache,
	clearGenomeCache,

	// PRS calculation
	calculatePRS,
	organizeResultsByAllele,

	// Score / user loading
	fetchScores,
	fetchUsers,
	loadExampleScores,
	loadExampleUsers,

	// Example data
	EXAMPLE_SCORES,
	EXAMPLE_USERS,
});
