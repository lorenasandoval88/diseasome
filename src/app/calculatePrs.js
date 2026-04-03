import { getTxts } from "https://lorenasandoval88.github.io/get-pgscatalog-scores/dist/sdk.mjs";
import {Match2 } from "../sdk/prs.js"
// import { parsePGP23, load23andMeFile } from "../sdk/get23me.js";
import { parse23Txt, load23andMeFile } from  "https://lorenasandoval88.github.io/get-23andme-data/dist/sdk.mjs";
import localforage from "localforage";
console.log("calculatePrs.js loaded");

// Track what has been loaded
let loadedScores = []; // parsed PGS scoring files
let loadedUsers = []; // parsed 23andMe genome data

/*** Fetch and parse multiple 23andMe files from paths/URLs.
 * @param {string[]} paths - Array of file paths or URLs
 * @param {string[]} userIds - Array of user IDs corresponding to each path
 * @returns {Promise<Object[]>} Array of objects with { userId, parsed } data
 */
async function fetch23andMeFiles(paths, userIds = []) {
	const results = await Promise.all(
		paths.map(async (path, idx) => {
			try {
				const userId = userIds[idx] ?? null;
				const parsed = await load23andMeFile(path, userId);
				console.log(`Loaded 23andMe file: ${path} (userId: ${userId})`);
				return { userId, parsed };
			} catch (err) {
				console.error(`Failed to load 23andMe file ${path}:`, err);
				return null;
			}
		})
	);
	return results.filter(Boolean);
}
window.fetch23andMeFiles = fetch23andMeFiles;


/*** Get cached PRS result for a user+PGS combination.
 * @param {string} userId - User ID
 * @param {string} pgsId - PGS ID
 * @returns {Promise<Object|null>} Cached result or null if not found
 */
async function getCachedPRS(userId, pgsId) {
	try {
		const key = `PRS: ${userId}_${pgsId}`;
		const cache = await localforage.getItem(key) || {};
		console.log(`Found cache for key ${userId}_${pgsId}`);

		return cache[key] ?? null;
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
}
window.clearPRSCache = clearPRSCache;

/*** Clear PGS scoring file cache (pgs:PGS* keys only, not trait/category summaries)
 */
async function clearPGSCache() {
	const keys = await localforage.keys();
	// Only clear keys like "pgs:PGS000001", not "pgs:trait-summary" or "pgs:all-score-summary"
	const pgsKeys = keys.filter(k => k.startsWith('pgs:PGS'));
	for (const key of pgsKeys) {
		await localforage.removeItem(key);
	}
	console.log(`PGS scoring cache cleared: removed ${pgsKeys.length} item(s)`);
	return pgsKeys.length;
}
window.clearPGSCache = clearPGSCache;

/*** Clear genome/23andMe cache (Genome:id-* keys only, not metadata)
 */
async function clearGenomeCache() {
	const keys = await localforage.keys();
	// Only clear keys like "Genome:id-hu09B28E", not metadata keys
	const genomeKeys = keys.filter(k => k.startsWith('Genome:id-'));
	for (const key of genomeKeys) {
		await localforage.removeItem(key);
	}
	console.log(`Genome cache cleared: removed ${genomeKeys.length} item(s)`);
	return genomeKeys.length;
}
window.clearGenomeCache = clearGenomeCache;


/**
 * Organize PRS match results by allele count (0, 1, or 2).
 * Returns structured data suitable for plotting or analysis.
 * @param {Object} matchResult - Result from Match2 function (contains pgsMatchMy23, alleles, calcRiskScore, PRS, etc.)
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


/** Check if online */
function isOnline() {
	return navigator.onLine;
}

/** Fallback local users (all 5 from data folder) */
const FALLBACK_USERS = [
	{
		id: "hu09B28E",
		name: "Joshua Yoakem",
		participant_id: "hu09B28E",
		publishedDate: "2025-01-27",
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
		genotypes: [{
			filename: "PGP_huBE0518_genome_Christopher_Smith_v5_Full_20230926164611.txt",
			filetype: "23andme",
			download_url: "data/PGP_huBE0518_genome_Christopher_Smith_v5_Full_20230926164611.txt"
		}]
	}
];

/** Fallback PGS scores (sample entries) */
const FALLBACK_SCORES = [
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
	}
];

/*** Parse a PGS scoring file into structured data.
 * @param {string} id - PGS ID
 * @param {string} txt - Raw text content
 * @returns {Object} Parsed PGS data with cols and dt arrays
 */
function parsePGS(id, txt) {
	const obj = { id };
	obj.txt = txt;
	const rows = txt.split(/[\r\n]/g);
	const metaL = rows.filter(r => r[0] === '#').length;
	obj.meta = { txt: rows.slice(0, metaL) };
	obj.cols = rows[metaL].split(/\t/g);
	obj.dt = rows.slice(metaL + 1).map(r => r.split(/\t/g)).filter(r => r.length > 1);
	
	// Parse numerical types
	const indInt = [obj.cols.indexOf('chr_position'), obj.cols.indexOf('hm_pos')];
	const indFloat = [obj.cols.indexOf('effect_weight'), obj.cols.indexOf('allelefrequency_effect')];
	
	obj.dt = obj.dt.map(r => {
		indFloat.forEach(ind => { if (ind >= 0) r[ind] = parseFloat(r[ind]); });
		indInt.forEach(ind => { if (ind >= 0) r[ind] = parseInt(r[ind]); });
		return r;
	});
	
	// Parse metadata
	obj.meta.txt.filter(r => r[1] !== '#').forEach(aa => {
		aa = aa.slice(1).split('=');
		obj.meta[aa[0]] = aa[1];
	});
	return obj;
}

/*** Load and parse a local PGS scoring file.
 * @param {string} id - PGS ID
 * @param {string} path - Path to the file
 * @returns {Promise<Object>} Parsed PGS data
 */
async function loadLocalPGSFile(id, path) {
	const response = await fetch(path);
	if (!response.ok) {
		throw new Error(`Failed to load ${path}: ${response.status}`);
	}
	const txt = await response.text();
	return parsePGS(id, txt);
}

/** Escape HTML special characters */
function escapeHtml(str) {
	const div = document.createElement("div");
	div.textContent = str ?? "";
	return div.innerHTML;
}

/*** Calculate PRS using the currently selected PGS IDs.
 * Called when the user clicks the "Fetch Files" button.
 * Uses fallback data when offline. */
async function fetchScores() {
	const statusEl = document.getElementById("prsScoresDiv");
	const resultsDiv = document.getElementById("prsScoresAction");

	// Clear previously loaded scores so dynamically selected scores take priority
	loadedScores = [];

	try {
		// Get selected PGS IDs and scores from the Polygenic Scores tab (if available) defined in displayScores.js
		let selectedIds = window.getSelectedPgsIds?.() ?? [];
		let selectedScores = window.getSelectedScores?.() ?? [];
		console.log( `${selectedIds.length} fetchScores(): Table** Selected PGSIDs from window.getSelectedScores():`, selectedIds, selectedScores);

		// Use fallback if offline or no selection
		const offline = !isOnline();
		if (offline || selectedIds.length === 0) {
			if (offline) {
				console.log("Offline mode: using fallback scores");
				selectedScores = FALLBACK_SCORES;
				selectedIds = FALLBACK_SCORES.map(s => s.id);
				if (statusEl) statusEl.textContent = "Offline mode: using fallback scores.";
			} else {
				if (statusEl) statusEl.textContent = "Please select at least one scoring file.";
				if (resultsDiv) resultsDiv.innerHTML = "";
				return;
			}
		} else {
			if (statusEl) statusEl.textContent = `Loaded ${selectedIds.length} scoring file(s).`;
		}
		// Render table of selected scores
		if (resultsDiv) {
			const rows = selectedScores.map((score, idx) => {
				const id = escapeHtml(score?.id ?? "");
				const name = escapeHtml(score?.name ?? "");
				const trait = escapeHtml(score?.trait_reported ?? "");
				const variants = escapeHtml(score?.variants_number ?? "");
				const date = escapeHtml(score?.date_release ?? "");
				return `
					<tr>
						<td>${idx + 1}</td>
						<td><input type="checkbox" class="form-check-input prs-select-cb" value="${id}" checked /></td>
						<td>${id}</td>
						<td>${name}</td>
						<td>${trait}</td>
						<td>${variants}</td>
						<td>${date}</td>
					</tr>`;
			}).join("");

			resultsDiv.innerHTML = `
				<table class="table table-striped table-sm mt-3">
					<thead class="table-dark">
						<tr>
							<th>#</th>
							<th>Select</th>
							<th>PGS ID</th>
							<th>Name</th>
							<th>Trait</th>
							<th>Variants #</th>
							<th>Date</th>
						</tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
				<button class="btn btn-outline-secondary btn-sm mt-2" onclick="clearPGSCache().then(n => alert('Cleared ' + n + ' PGS cache item(s)')).catch(e => alert('Error: ' + e.message))">
					Clear PGS Cache
				</button>`;
		}

		// TODO: Add actual PRS calculation logic here

	} catch (err) {
		console.error("fetchScores error:", err);
		if (statusEl) statusEl.textContent = `Error: ${err.message}`;
	}
}
window.fetchScores = fetchScores;

/*** Fetch selected users, display them in a table, and parse their genome files.
 * Called when the user clicks the "Fetch Users" button in the PRS tab.
 * Uses fallback data when offline or nothing is selected. */
async function fetchUsers() {
	const statusEl = document.getElementById("prsUsersdiv");
	const resultsDiv = document.getElementById("prsUsersAction");

	try {
		// Get selected user IDs and users from the 23andMe Data tab or fallback
		let selectedIds = window.getSelectedUserIds?.() ?? [];
		let selectedUsers = window.getSelectedUsers?.() ?? [];
console.log(`fetchUsers(): Selected user IDs from window.getSelectedUserIds():`, selectedIds);
// console.log(`fetchUsers(): Selected users from window.getSelectedUsers():`, selectedUsers);
		const offline = !isOnline();
		if (offline || selectedIds.length === 0) {
			if (offline) {
				console.log("Offline mode: using fallback users");
				selectedUsers = FALLBACK_USERS;
				selectedIds = FALLBACK_USERS.map(u => u.id);
				if (statusEl) statusEl.textContent = "Offline mode: using fallback users.";
			} else {
				if (statusEl) statusEl.textContent = "Please select at least one participant in the 23andMe Data tab.";
				if (resultsDiv) resultsDiv.innerHTML = "";
				return;
			}
		} else {
			if (statusEl) statusEl.textContent = `Fetching and parsing ${selectedUsers.length} participant genome file(s)...`;
		}

		console.log(`fetchUsers(): ${selectedIds.length} users selected:`, selectedIds, selectedUsers);

		// Parse genome files for all selected users
		loadedUsers = [];
		const parsePromises = selectedUsers.map(async (user) => {
			//console.log(`Processing user ${user.id} for PRS calculation...`);
			// Check if user already has parsed data (e.g., from uploaded file)
			if (user?._parsed && user._parsed.dt && user._parsed.dt.length > 0) {
				console.log(`Using pre-parsed data for ${user.id}: ${user._parsed.dt.length} variants`);
				return { user, parsed: user._parsed };
			}

			const genos = user?.genotypes ?? [];
			const filePath = user?.downloadUrl ?? user?.download_url ?? user?.id
				genos[0]?.download_url ?? genos[0]?.file ?? null;
			console.log("filePath:", user, filePath);
			
			if (!filePath) {
				console.warn(`No file path or pre-parsed data for user ${user?.id}`);
				return null;
			}
			try {
				const parsed = await load23andMeFile(filePath, user.id);
				// const parsed = await load23andMeFile(filePath, user.id);
				console.log(`Parsed genome filePath:`, filePath, `for user:`, user.id);
				return { user, parsed };
			} catch (err) {
				console.error(`Failed to load genome for ${user.id}:`, err);
				return null;
			}
		});
		const results = await Promise.all(parsePromises);
		loadedUsers = results.filter(Boolean);

		if (statusEl) statusEl.textContent = `Loaded ${loadedUsers.length} of ${selectedUsers.length} participant(s).`;

		// Render table
		if (resultsDiv) {
			const rows = selectedUsers.map((user, idx) => {
				const id = escapeHtml(user?.id ?? user?.participant_id ?? "");
				const name = escapeHtml(user?.name ?? "");
				const published = escapeHtml(user?.publishedDate ?? user?.published_date ?? user?.date ?? "");
				const genos = user?.genotypes ?? [];
				const genoCount = genos.length;
				const downloadUrl = user?.downloadUrl ?? user?.download_url ?? (genos[0]?.download_url ?? genos[0]?.file) ?? "";
				const downloadHtml = downloadUrl ? `<a href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener">Download</a>` : "-";
				const loadedData = loadedUsers.find(d => d.user.id === user.id);
				const variantCount = loadedData?.parsed?.dt?.length ?? 0;
				return `
					<tr>
						<td>${idx + 1}</td>
						<td><input type="checkbox" class="form-check-input prs-user-select-cb" value="${id}" checked /></td>
						<td>${id}</td>
						<td>${name}</td>
						<td>${published}</td>
						<td>${genoCount}</td>
						<td>${variantCount.toLocaleString()}</td>
						<td>${downloadHtml}</td>
					</tr>`;
			}).join("");

			resultsDiv.innerHTML = `
				<table class="table table-striped table-sm mt-3">
					<thead class="table-dark">
						<tr>
							<th>#</th>
							<th>Select</th>
							<th>Participant ID</th>
							<th>Name</th>
							<th>Published Date</th>
							<th>Genotypes #</th>
							<th>Variants Loaded</th>
							<th>Download</th>
						</tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
				<button class="btn btn-outline-secondary btn-sm mt-2" onclick="clearGenomeCache().then(n => alert('Cleared ' + n + ' genome cache item(s)')).catch(e => alert('Error: ' + e.message))">
					Clear Genome Cache
				</button>`;
		}

		console.log("fetchUsers() loadedUsers:", loadedUsers);
	} catch (err) {
		console.error("fetchUsers error:", err);
		if (statusEl) statusEl.textContent = `Error: ${err.message}`;
	}
}
window.fetchUsers = fetchUsers;

// Wire up the fetch scores button
const fetchScoresBtn = document.getElementById("fetchScoresBtn");
if (fetchScoresBtn) {
	fetchScoresBtn.addEventListener("click", fetchScores);
}

// Wire up the fetch users button
const fetchUsersBtn = document.getElementById("fetchUsersBtn");
if (fetchUsersBtn) {
	fetchUsersBtn.addEventListener("click", fetchUsers);
}

/** * Load fallback scores directly into the PRS table. */
function loadFallbackScores() {
	const statusEl = document.getElementById("prsScoresDiv");
	const resultsDiv = document.getElementById("prsScoresAction");
	const prsStatus = document.getElementById("prsResultsStatus"); // check if users selected before allowing score load
	
	// Clear any dynamically selected scores so fallback takes priority
	window.clearSelectedScores?.();
	
	const selectedScores = FALLBACK_SCORES;
	loadedScores = selectedScores; // Store for calculatePRS
	if (statusEl) statusEl.textContent = `Loaded ${selectedScores.length} fallback scoring file(s).`;
	if (prsStatus) prsStatus.textContent = ""; // Clear "No scores loaded" message
	
	if (resultsDiv) {
		const rows = selectedScores.map((score, idx) => {
			const id = escapeHtml(score?.id ?? "");
			const name = escapeHtml(score?.name ?? "");
			const trait = escapeHtml(score?.trait_reported ?? "");
			const variants = escapeHtml(score?.variants_number ?? "");
			const date = escapeHtml(score?.date_release ?? "");
			return `
				<tr>
					<td>${idx + 1}</td>
					<td><input type="checkbox" class="form-check-input prs-select-cb" value="${id}" checked /></td>
					<td>${id}</td>
					<td>${name}</td>
					<td>${trait}</td>
					<td>${variants}</td>
					<td>${date}</td>
				</tr>`;
		}).join("");

		resultsDiv.innerHTML = `
			<table class="table table-striped table-sm mt-3">
				<thead class="table-dark">
					<tr>
						<th>#</th>
						<th>Select</th>
						<th>PGS ID</th>
						<th>Name</th>
						<th>Trait</th>
						<th>Variants #</th>
						<th>Date</th>
					</tr>
				</thead>
				<tbody>${rows}</tbody>
			</table>
			<button class="btn btn-outline-secondary btn-sm mt-2" onclick="clearPGSCache().then(n => alert('Cleared ' + n + ' PGS cache item(s)')).catch(e => alert('Error: ' + e.message))">
				Clear PGS Cache
			</button>`;
	}
	
	console.log("Loaded fallback scores:", FALLBACK_SCORES);
	
	// Update cluster page
	if (typeof window.renderCluster === "function") {
		window.renderCluster();
	}
}

/** * Load fallback users directly into the users table. */
async function loadFallbackUsers() {
	const statusEl = document.getElementById("prsUsersdiv");
	const resultsDiv = document.getElementById("prsUsersAction");
	const prsStatus = document.getElementById("prsResultsStatus");
	
	const selectedUsers = FALLBACK_USERS;
	loadedUsers = selectedUsers; // Store for calculatePRS
	loadedUsers = []; // Clear previous parsed data
	
	if (statusEl) statusEl.textContent = `Loading ${selectedUsers.length} fallback participant(s)...`;
	if (prsStatus) prsStatus.textContent = "";
	
	// Fetch and parse each user's genome file
	const parsePromises = selectedUsers.map(async (user) => {
		const genos = user?.genotypes ?? [];
		const filePath = genos[0]?.download_url ?? genos[0]?.file;
		if (!filePath) return null;
		
		try {
			const parsed = await load23andMeFile(filePath);
			console.log(`Parsed genome filePath:`, filePath);
			console.log(`Parsed genome for ${user.id}:`, parsed);
			return { user, parsed };
		} catch (err) {
			console.error(`Failed to load genome for ${user.id}:`, err);
			return null;
		}
	});
	
	const results = await Promise.all(parsePromises);
	loadedUsers = results.filter(Boolean);
	
	if (statusEl) statusEl.textContent = `Loaded ${loadedUsers.length} of ${selectedUsers.length} fallback participant(s).`;
	
	if (resultsDiv) {
		const rows = selectedUsers.map((user, idx) => {
			const id = escapeHtml(user?.id ?? user?.participant_id ?? "");
			const name = escapeHtml(user?.name ?? "");
			const published = escapeHtml(user?.publishedDate ?? user?.published_date ?? user?.date ?? "");
			const genos = user?.genotypes ?? [];
			const genoCount = genos.length;
			const downloadUrl = user?.downloadUrl ?? user?.download_url ?? (genos[0]?.download_url ?? genos[0]?.file) ?? "";
			const downloadHtml = downloadUrl ? `<a href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener">Download</a>` : "-";
			const loadedData = loadedUsers.find(d => d.user.id === user.id);
			const variantCount = loadedData?.parsed?.dt?.length ?? 0;
			return `
				<tr>
					<td>${idx + 1}</td>
					<td><input type="checkbox" class="form-check-input prs-user-select-cb" value="${id}" checked /></td>
					<td>${id}</td>
					<td>${name}</td>
					<td>${published}</td>
					<td>${genoCount}</td>
					<td>${variantCount.toLocaleString()}</td>
					<td>${downloadHtml}</td>
				</tr>`;
		}).join("");

		resultsDiv.innerHTML = `
			<table class="table table-striped table-sm mt-3">
				<thead class="table-dark">
					<tr>
						<th>#</th>
						<th>Select</th>
						<th>Participant ID</th>
						<th>Name</th>
						<th>Published Date</th>
						<th>Genotypes #</th>
						<th>Variants Loaded</th>
						<th>Download</th>
					</tr>
				</thead>
				<tbody>${rows}</tbody>
			</table>
			<button class="btn btn-outline-secondary btn-sm mt-2" onclick="clearGenomeCache().then(n => alert('Cleared ' + n + ' genome cache item(s)')).catch(e => alert('Error: ' + e.message))">
				Clear Genome Cache
			</button>`;
	}
	
	console.log("Loaded fallback users with parsed data:", loadedUsers);
	
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

// Wire up fallback buttons
const loadFallbackScoresBtn = document.getElementById("loadFallbackScoresBtn");
if (loadFallbackScoresBtn) {
	loadFallbackScoresBtn.addEventListener("click", loadFallbackScores);
}

const loadFallbackUsersBtn = document.getElementById("loadFallbackUsersBtn");
if (loadFallbackUsersBtn) {
	loadFallbackUsersBtn.addEventListener("click", loadFallbackUsers);
}

window.loadFallbackScores = loadFallbackScores;
window.loadFallbackUsers = loadFallbackUsers;

// Expose fallback data for manual use
window.FALLBACK_USERS = FALLBACK_USERS;
window.FALLBACK_SCORES = FALLBACK_SCORES;
window.isOnline = isOnline;

/*** Calculate PRS using loaded scores and users.
 * Triggered by the "Calculate PRS" button.
 */
async function calculatePRS() {
    console.log("calculatePRS()")
    const statusEl = document.getElementById("prsResultsStatus");
    const resultsDiv = document.getElementById("prsResultsDiv");
    if (statusEl) statusEl.textContent = "Calculating PRS...";
    
    try {
        //// GET USERS: use loadedUsers (from fetchUsers / loadFallbackUsers),
        //  filtered to only those whose checkbox is still checked in the PRS users table.
        //  If loadedUsers is empty, fall back to window.getSelectedUsers() from the LocalData tab.
        let userDataForCalc = loadedUsers;
        console.log("loadedUsers", userDataForCalc);

        // Filter by checkboxes in the PRS users table (if rendered)
        const checkedUserIds = new Set(
            Array.from(document.querySelectorAll(".prs-user-select-cb:checked")).map(cb => cb.value)
        );
        if (checkedUserIds.size > 0 && userDataForCalc.length > 0) {
            userDataForCalc = userDataForCalc.filter(d => checkedUserIds.has(d.user.id ?? d.user.participant_id));
            console.log(`Filtered to ${userDataForCalc.length} checked user(s):`, Array.from(checkedUserIds));
        }

        if (userDataForCalc.length === 0) {
            // Try to get selected users from the 23andMe Data tab
            const selectedUsers = window.getSelectedUsers?.() ?? [];
            console.log("No loadedUsers — falling back to LocalData tab selection:", selectedUsers);
            if (selectedUsers.length === 0) {
                if (statusEl) statusEl.textContent = "No users loaded. Use 'Fetch Users' or 'Load Fallback Users' in the PRS tab, or select users in the 23andMe Data tab.";
                return;
            }

            if (statusEl) statusEl.textContent = `Loading ${selectedUsers.length} user genome file(s)...`;

            // Process each user - use pre-parsed data if available, otherwise fetch from URL
            const parsePromises = selectedUsers.map(async (user) => {
                // Check if user already has parsed data (e.g., from uploaded file)
                if (user?._parsed && user._parsed.dt && user._parsed.dt.length > 0) {
                    console.log(`Using pre-parsed data for ${user.id}: ${user._parsed.dt.length} variants`);
                    return { user, parsed: user._parsed };
                }

                const filePath = user.downloadUrl ?? user.download_url ?? user.url ??
                    user.genotypes?.[0]?.download_url ?? user.genotypes?.[0]?.file ?? null;
                
                if (!filePath) {
                    console.warn(`No file path or pre-parsed data for user ${user?.id}`);
                    return null;
                }

                try {
                    const parsed = await load23andMeFile(filePath, user.id);
                    return { user, parsed };
                } catch (err) {
                    console.error(`Failed to load genome for ${user.id}:`, err);
                    return null;
                }
            });

            const results = await Promise.all(parsePromises);
            userDataForCalc = results.filter(Boolean);

            console.log("userDataForCalc (from LocalData tab):", userDataForCalc);

            if (userDataForCalc.length === 0) {
                if (statusEl) statusEl.textContent = "Failed to load user genome files.";
                return;
            }
        }

        //// GET SCORES: prefer dynamically selected scores, fallback to loadedScores
        const dynamicScores = window.getSelectedScores?.() ?? [];
        let selectedScoresList = dynamicScores.length > 0 ? dynamicScores : loadedScores;
        const usingFallback = dynamicScores.length === 0 && loadedScores.length > 0;
        console.log("Selected scores for PRS calculation:", selectedScoresList, usingFallback ? "(fallback)" : "(selected)");
        const selectedIds = selectedScoresList.map(s => s.id);

        if (selectedIds.length === 0) {
            if (statusEl) statusEl.textContent = "No PGS scores loaded. Click 'Load Fallback Scores' first.";
            return;
        }
        
        // Update scores table display
        const scoresDiv = document.getElementById("prsScoresDiv");
        const scoresAction = document.getElementById("prsScoresAction");
        if (scoresDiv) scoresDiv.textContent = `Using ${selectedScoresList.length} ${usingFallback ? "fallback" : "selected"} scoring file(s).`;
        if (scoresAction) {
            const rows = selectedScoresList.map((score, idx) => {
                const id = escapeHtml(score?.id ?? "");
                const name = escapeHtml(score?.name ?? "");
                const trait = escapeHtml(score?.trait_reported ?? "");
                const variants = escapeHtml(score?.variants_number ?? "");
                const date = escapeHtml(score?.date_release ?? "");
                return `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${id}</td>
                        <td>${name}</td>
                        <td>${trait}</td>
                        <td>${variants}</td>
                        <td>${date}</td>
                    </tr>`;
            }).join("");
            scoresAction.innerHTML = `
                <table class="table table-striped table-sm mt-3">
                    <thead class="table-dark">
                        <tr>
                            <th>#</th>
                            <th>PGS ID</th>
                            <th>Name</th>
                            <th>Trait</th>
                            <th>Variants #</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <button class="btn btn-outline-secondary btn-sm mt-2" onclick="clearPGSCache().then(n => alert('Cleared ' + n + ' PGS cache item(s)')).catch(e => alert('Error: ' + e.message))">
                    Clear PGS Cache
                </button>`;
        }

        // Load PGS txt files (try local first, then remote)
        // if (statusEl) statusEl.textContent = `Loading ${selectedIds.length} PGS file(s)...`;
        if (statusEl) statusEl.textContent = `Calculating PRS....`;

        const pgsTxts = [];
        for (const score of selectedScoresList) {
            try {
                if (score.local_file) {
                    // Load from local file
                    const parsed = await loadLocalPGSFile(score.id, score.local_file);
                    pgsTxts.push(parsed);
                    console.log(`Loaded local PGS file: ${score.local_file}`);
                } else {
                    // Fetch from remote
                    const remote = await getTxts([score.id]);
                    pgsTxts.push(...remote);
                }
            } catch (err) {
                console.error(`Failed to load ${score.id}:`, err);
            }
        }
        console.log("PGS txts for calculation:", pgsTxts);
        
        // Run PRS calculation for each user x score combination
        if (statusEl) statusEl.textContent = `Calculating PRS for ${userDataForCalc.length} user(s) x ${pgsTxts.length} model(s)...`;
        
        const prsResults = [];
        let cachedCount = 0;
        let calculatedCount = 0;
        
        for (const userData of userDataForCalc) {
            const my23 = userData.parsed;
            const userId = userData.user.id;
            //console.log(`Calculating PRS for user ${userId} (${userData.user.name}) with ${my23.dt.length} variants...`,userData);
            for (const mypgs of pgsTxts) {
                const pgsId = mypgs.id ?? mypgs.meta?.pgs_id ?? mypgs.url;
                
                // Check cache first
                const cached = await getCachedPRS(userId, pgsId);
                if (cached) {
                    // console.log(`Cache hit for user ${userId} and PGS ${pgsId}`);
                    // If cached result doesn't have organized data, add it now
                    let organizedData = cached.organized;
                    if (!organizedData && cached.pgsMatchMy23 && cached.alleles) {
                        organizedData = organizeResultsByAllele(cached, mypgs);
                    }
                    prsResults.push({
                        ...cached,
                        organized: organizedData,
                        pgs: cached.pgs ?? { cols: mypgs.cols, dt: mypgs.dt, meta: mypgs.meta }, // Ensure pgs structure exists
                        fromCache: true
                    });
                    cachedCount++;
                    continue;
                }
                
                // Calculate if not cached
                const result = Match2(mypgs, my23);
                
                // Organize results by allele count (0, 1, 2)
                const organizedData = organizeResultsByAllele(result, mypgs);
                
                const prsResult = {
                    userId,
                    userName: userData.user.name,
                    userDate: userData.user.publishedDate ?? userData.user.published_date ?? "",
                    pgsId,
                    totalVariants: mypgs.dt.length,
                    ...result,
                    organized: organizedData, // Add organized data for plotting/analysis
                    pgs: { cols: mypgs.cols, dt: mypgs.dt, meta: mypgs.meta } // Store PGS structure for plotting
                };
                
                // Store in cache
                await setCachedPRS(userId, pgsId, prsResult);
                prsResults.push(prsResult);
                calculatedCount++;
            }
        }
        
        console.log("PRS results:", prsResults);
        window.prsResults = prsResults;  // expose for cluster tab
        
        if (statusEl) statusEl.textContent = `Completed! ${prsResults.length} result(s) (${cachedCount} from cache, ${calculatedCount} calculated).`;
        
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
                        <td>${r.QC ? "✓" : r.QCtext ?? "-"}</td>
                        <td>${r.fromCache ? "📦" : "🔄"}</td>
                    </tr>
                `}).join("");
                
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
                                <th title="📦 = cached, 🔄 = calculated">Src</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <button class="btn btn-outline-danger btn-sm mt-2" onclick="clearPRSCache().then(() => alert('PRS cache cleared')).catch(e => alert('Error: ' + e.message))">
                        Clear PRS Cache
                    </button>
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
    }
}

// Wire up Calculate PRS button
const calculatePrsBtn = document.getElementById("calculatePrsBtn");
if (calculatePrsBtn) {
    calculatePrsBtn.addEventListener("click", calculatePRS);
}

// window.calculatePRS = calculatePRS;