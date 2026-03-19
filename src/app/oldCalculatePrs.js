import { getTxts } from "https://lorenasandoval88.github.io/get-pgscatalog-scores/dist/sdk.mjs";
import {Match2 } from "../sdk/prs.js"
// import { parsePGP23, load23andMeFile } from "../sdk/get23me.js";
import { parse23Txt, load23andMeFile } from  "https://lorenasandoval88.github.io/get-23andme-data/dist/sdk.mjs";

import localforage from "localforage";
console.log("calculatePrs.js loaded");

// Track what has been loaded
let loadedUsers = [];
let loadedScores = [];
let loadedUserData = []; // Parsed 23andMe genome data

/**
 * Fetch and parse multiple 23andMe files from paths/URLs.
 * @param {string[]} paths - Array of file paths or URLs
 * @returns {Promise<Object[]>} Array of parsed 23andMe genome data
 */
async function fetch23andMeFiles(paths) {
	const results = await Promise.all(
		paths.map(async (path) => {
			try {
				const parsed = await load23andMeFile(path);
				console.log(`Loaded 23andMe file: ${path}`, parsed);
				return parsed;
			} catch (err) {
				console.error(`Failed to load 23andMe file ${path}:`, err);
				return null;
			}
		})
	);
	return results.filter(Boolean);
}

window.fetch23andMeFiles = fetch23andMeFiles;


/**
 * Get cached PRS result for a user+PGS combination.
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

/**
 * Store PRS result in cache.
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

/**
 * Clear all cached PRS results (keys starting with "PRS:").
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

/**
 * Parse a PGS scoring file into structured data.
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

/**
 * Load and parse a local PGS scoring file.
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

/** * Calculate PRS using the currently selected PGS IDs.
 * Called when the user clicks the "Fetch Files" button.
 * Uses fallback data when offline. */
async function fetchScores() {
	const statusEl = document.getElementById("prsScoresDiv");
	const resultsDiv = document.getElementById("prsScoresAction");

	try {
		let selectedIds = window.getSelectedPgsIds?.() ?? [];
        console.log("Selected PGS IDs from window.getSelectedPgsIds():", selectedIds);
		let selectedScores = window.getSelectedScores?.() ?? [];
		console.log("Selected PGS IDs from window.getSelectedScores():",  selectedScores);

		// Use fallback if offline or no selection
		const offline = !isOnline();
		if (offline || selectedIds.length === 0) {
			if (offline) {
				console.log("Offline mode: using fallback scores");
				selectedScores = FALLBACK_SCORES;
				selectedIds = FALLBACK_SCORES.map(s => s.id);
				if (statusEl) statusEl.textContent = "Offline mode: using fallback scores.";
			} else {
				//if (statusEl) statusEl.textContent = "Please select at least one scoring file.";
				if (resultsDiv) resultsDiv.innerHTML = "";
				return;
			}
		} else {
			if (statusEl) statusEl.textContent = `Loaded ${pgsTxts.length} scoring file(s).`;
			// if (statusEl) statusEl.textContent = "Loading scoring files...";
			// try {
			// 	const pgsTxts = await getTxts(selectedIds);
			// 	console.log("fetchScores() await getTxts(selectedIds) PGS txts:", pgsTxts);
			// 	if (statusEl) statusEl.textContent = `Loaded ${pgsTxts.length} scoring file(s).`;
				
			// 	// Run PRS calculation using standalone function
			// 	if (pgsTxts.length > 0) {
			// 		//await runPRS(pgsTxts);
			// 		console.log("PGS txts ready for PRS calculation:", pgsTxts);
			// 	}
			// } catch (fetchErr) {
			// 	console.warn("Failed to fetch scores, using fallback:", fetchErr);
			// 	selectedScores = FALLBACK_SCORES;
			// 	selectedIds = FALLBACK_SCORES.map(s => s.id);
			// 	if (statusEl) statusEl.textContent = "Network error: using fallback scores.";
			// }
		}

		console.log(`calculatePrs.js: ${selectedIds.length} Selected PGS IDs..`, selectedIds);

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
				</table>`;
		}

		// TODO: Add actual PRS calculation logic here

	} catch (err) {
		console.error("fetchScores error:", err);
		if (statusEl) statusEl.textContent = `Error: ${err.message}`;
	}
}

// Wire up the fetch scores button
const fetchScoresBtn = document.getElementById("fetchScoresBtn");
if (fetchScoresBtn) {
	fetchScoresBtn.addEventListener("click", fetchScores);
}

window.fetchScores = fetchScores;

// Wire up the fetch users button
const fetchUsersBtn = document.getElementById("fetchUsersBtn");
if (fetchUsersBtn) {
	fetchUsersBtn.addEventListener("click", fetchUsers);
}


/** * Fetch selected users and display them in a table.
 * Called when the user clicks a "Fetch Users" button.
 * Uses fallback data when offline. */
async function fetchUsers() {
	const statusEl = document.getElementById("prsUsersdiv");
	const resultsDiv = document.getElementById("prsUsersAction");

	try {
		let selectedIds = window.getSelectedUserIds?.() ?? [];
		let selectedUsers = window.getSelectedUsers?.() ?? [];
		
		// Use fallback if offline or no selection
		const offline = !isOnline();
		if (offline || selectedIds.length === 0) {
			if (offline) {
				console.log("Offline mode: using fallback users");
				selectedUsers = FALLBACK_USERS;
				selectedIds = FALLBACK_USERS.map(u => u.id);
				if (statusEl) statusEl.textContent = "Offline mode: using fallback users.";
			} else {
				if (statusEl) statusEl.textContent = "Please select at least one participant.";
				if (resultsDiv) resultsDiv.innerHTML = "";
				return;
			}
		} else {
			if (statusEl) statusEl.textContent = `Loaded ${selectedUsers.length} participant(s).`;
		}

		console.log(`calculatePrs.js: ${selectedIds.length} Selected User IDs..`, selectedIds);

		// Render table of selected users
		if (resultsDiv) {
			const rows = selectedUsers.map((user, idx) => {
				const id = escapeHtml(user?.id ?? user?.participant_id ?? "");
				const name = escapeHtml(user?.name ?? "");
				const published = escapeHtml(user?.publishedDate ?? user?.published_date ?? user?.date ?? "");
				const genos = user?.genotypes ?? [];
				const genoCount = genos.length;
				const downloadUrl = user?.downloadUrl ?? user?.download_url ?? (genos[0]?.download_url ?? genos[0]?.file) ?? "";
				const downloadHtml = downloadUrl ? `<a href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener">Download</a>` : "-";
				return `
					<tr>
						<td>${idx + 1}</td>
						<td><input type="checkbox" class="form-check-input prs-user-select-cb" value="${id}" checked /></td>
						<td>${id}</td>
						<td>${name}</td>
						<td>${published}</td>
						<td>${genoCount}</td>
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
							<th>Download</th>
						</tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>`;
		}

	} catch (err) {
		console.error("fetchUsers error:", err);
		if (statusEl) statusEl.textContent = `Error: ${err.message}`;
	}
}
window.fetchUsers = fetchUsers;

/** * Load fallback users directly into the users table. */
async function loadFallbackUsers() {
	const statusEl = document.getElementById("prsUsersdiv");
	const resultsDiv = document.getElementById("prsUsersAction");
	const prsStatus = document.getElementById("prsResultsStatus");
	
	const selectedUsers = FALLBACK_USERS;
	loadedUsers = selectedUsers; // Store for calculatePRS
	loadedUserData = []; // Clear previous parsed data
	
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
	loadedUserData = results.filter(Boolean);
	
	if (statusEl) statusEl.textContent = `Loaded ${loadedUserData.length} of ${selectedUsers.length} fallback participant(s).`;
	
	if (resultsDiv) {
		const rows = selectedUsers.map((user, idx) => {
			const id = escapeHtml(user?.id ?? user?.participant_id ?? "");
			const name = escapeHtml(user?.name ?? "");
			const published = escapeHtml(user?.publishedDate ?? user?.published_date ?? user?.date ?? "");
			const genos = user?.genotypes ?? [];
			const genoCount = genos.length;
			const downloadUrl = user?.downloadUrl ?? user?.download_url ?? (genos[0]?.download_url ?? genos[0]?.file) ?? "";
			const downloadHtml = downloadUrl ? `<a href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener">Download</a>` : "-";
			const loadedData = loadedUserData.find(d => d.user.id === user.id);
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
			</table>`;
	}
	
	console.log("Loaded fallback users with parsed data:", loadedUserData);
}

/** * Load fallback scores directly into the PRS table. */
function loadFallbackScores() {
	const statusEl = document.getElementById("prsScoresDiv");
	const resultsDiv = document.getElementById("prsScoresAction");
	const prsStatus = document.getElementById("prsResultsStatus"); // check if users selected before allowing score load
	
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
			</table>`;
	}
	
	console.log("Loaded fallback scores:", FALLBACK_SCORES);
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


// function prs(userTxts, pgsTxts) {
//     let PRS = [];
//     console.log("STARTING CALCULATION! prs called with:", userTxts.length, "users,", pgsTxts.length, "PGS models");

//     for (let i = 0; i < pgsTxts.length; i++) {
//         console.log("---------------------------");
//         console.log("Processing PGS model #", i, pgsTxts[i]?.id ?? pgsTxts[i]);

//         for (let j = 0; j < userTxts.length; j++) {
//             console.log("Processing user #", j, userTxts[j]);
//             // TODO: Load and parse user genome data, then call Match2
//             // let input = { "pgs": pgsTxts[i], "my23": parsedUserData }
//             let res = Match2(userTxts, pgsTxts)
//             PRS.push(res)
//         }
//     }

//     return PRS;
// }

// window.prs = prs;

/**
 * Standalone PRS calculation function.
 * Fetches selected users' 23andMe files and runs PRS against provided PGS models.
 * @param {Object[]} pgsTxts - Array of parsed PGS scoring files
 * @returns {Promise<Object[]>} Array of PRS results
 */
// async function runPRS(pgsTxts) {
// 	console.log("runPRS called with", pgsTxts.length, "PGS models");
	
// 	// Get user file paths from selected users
// 	const userPaths = window.getSelectedUsers?.()?.map(u => 
// 		u.downloadUrl ?? u.download_url ?? u.url ?? 
// 		u.genotypes?.[0]?.download_url ?? u.genotypes?.[0]?.file
// 	).filter(Boolean) ?? [];
// 	console.log("#####################runPRS: User paths to fetch:", userPaths);
// 	if (userPaths.length === 0) {
// 		console.warn("runPRS: No users selected");
// 		return [];
// 	}
	
// 	console.log("runPRS: Fetching", userPaths.length, "user files:", userPaths);
	
// 	// Fetch and parse 23andMe files
// 	const userTxts = await fetch23andMeFiles(userPaths);
// 	console.log("runPRS: Parsed", userTxts.length, "user files");
	
// 	if (userTxts.length === 0) {
// 		console.warn("runPRS: Failed to load any user files");
// 		return [];
// 	}
	
// 	// Run PRS calculation
// 	const prsResults = prs(userTxts, pgsTxts);
// 	console.log("runPRS results:", prsResults);
// 	return prsResults;
// }

// window.runPRS = runPRS;

/**
 * Calculate PRS using loaded scores and users.
 * Triggered by the "Calculate PRS" button.
 */
async function calculatePRS() {
    console.log("calculatePRS()")
    const statusEl = document.getElementById("prsResultsStatus");
    const resultsDiv = document.getElementById("prsResultsDiv");
    if (statusEl) statusEl.textContent = "Calculating PRS...";
    
    try {
        // GET USERS: first check loadedUserData, then fetch selected users from 23andMe tab
        let userDataForCalc = loadedUserData;
        console.log("userDataForCalc",userDataForCalc)
        if (userDataForCalc.length === 0) {
            // Try to get selected users from the 23andMe tab
            const selectedUsers = window.getSelectedUsers?.() ?? [];
			console.log("Selected users for PRS calculation:", selectedUsers);
            if (selectedUsers.length === 0) {
                if (statusEl) statusEl.textContent = "No users loaded. Select users from '23andMe Data' tab or click 'Load Fallback Users'.";
                return;
            }
            
            // Fetch and parse 23andMe files for selected users
            if (statusEl) statusEl.textContent = `Loading ${selectedUsers.length} user genome file(s)...`;
            console.log("Selected users:", selectedUsers);
            
            // Extract download URLs - check multiple possible property paths
            const userPaths = selectedUsers.map(u => {
                const path = u.downloadUrl ?? u.download_url ?? u.url ?? 
                    u.genotypes?.[0]?.download_url ?? u.genotypes?.[0]?.file ?? null;
                return path;
            }).filter(Boolean);
            
            console.log("User paths to fetch:", userPaths);
            const parsedUsers = await fetch23andMeFiles(userPaths);
            console.log("Parsed users result:", parsedUsers);
            
            // Map parsed data back to user info (use index-based matching since paths are in same order)
            userDataForCalc = selectedUsers.map((user, idx) => {
                const parsed = parsedUsers[idx];
                if (parsed) {
                    return { user, parsed };
                }
                return null;
            }).filter(Boolean);
            
            console.log("userDataForCalc:", userDataForCalc);
            
            if (userDataForCalc.length === 0) {
                if (statusEl) statusEl.textContent = "Failed to load user genome files.";
                return;
            }
        }

        // GET SCORES: first check loadedScores, then selected *****
        let selectedScoresList = loadedScores.length > 0 ? loadedScores : (window.getSelectedScores?.() ?? []);
        console.log("Selected scores for PRS calculation:", selectedScoresList);
        const selectedIds = selectedScoresList.map(s => s.id);

        if (selectedIds.length === 0) {
            if (statusEl) statusEl.textContent = "No PGS scores loaded. Click 'Load Fallback Scores' first.";
            return;
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
            console.log(`Calculating PRS for user ${userId} (${userData.user.name}) with ${my23.dt.length} variants...`,userData);
            for (const mypgs of pgsTxts) {
                const pgsId = mypgs.id ?? mypgs.meta?.pgs_id ?? mypgs.url;
                
                // Check cache first
                const cached = await getCachedPRS(userId, pgsId);
                if (cached) {
                    // console.log(`Cache hit for user ${userId} and PGS ${pgsId}`);
                    prsResults.push({
                        ...cached,
                        fromCache: true
                    });
                    cachedCount++;
                    continue;
                }
                
                // Calculate if not cached
                const result = Match2(mypgs, my23);
                const prsResult = {
                    userId,
                    userName: userData.user.name,
                    userDate: userData.user.publishedDate ?? userData.user.published_date ?? "",
                    pgsId,
                    totalVariants: mypgs.dt.length,
                    ...result
                };
                
                // Store in cache
                await setCachedPRS(userId, pgsId, prsResult);
                prsResults.push(prsResult);
                calculatedCount++;
            }
        }
        
        console.log("PRS results:", prsResults);
        
        if (statusEl) statusEl.textContent = `Completed! ${prsResults.length} result(s) (${cachedCount} from cache, ${calculatedCount} calculated).`;
        
        // Display results
        if (resultsDiv) {
            if (prsResults.length > 0) {
                const rows = prsResults.map((r, idx) => `
                    <tr${r.fromCache ? ' class="table-secondary"' : ''}>
                        <td>${idx + 1}</td>
                        <td>${escapeHtml(r.userId)}</td>
                        <td>${escapeHtml(r.userName ?? "")}</td>
                        <td>${escapeHtml(r.userDate ?? "")}</td>
                        <td>${escapeHtml(r.pgsId)}</td>
                        <td>${typeof r.PRS === 'number' ? r.PRS.toFixed(6) : (r.PRS ?? "-")}</td>
                        <td>${r.alleles?.length ?? 0}</td>
                        <td>${r.totalVariants ?? "-"}</td>
                        <td>${r.QC ? "✓" : r.QCtext ?? "-"}</td>
                        <td>${r.fromCache ? "📦" : "🔄"}</td>
                    </tr>
                `).join("");
                
                resultsDiv.innerHTML = `
                    <table class="table table-striped table-sm mt-3">
                        <thead class="table-dark">
                            <tr>
                                <th>#</th>
                                <th>User ID</th>
                                <th>Name</th>
                                <th>Date</th>
                                <th>PGS ID</th>
                                <th>PRS Score</th>
                                <th>Matched</th>
                                <th>Total</th>
                                <th>QC</th>
                                <th title="📦 = cached, 🔄 = calculated">Src</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <button class="btn btn-outline-secondary btn-sm" onclick="clearPRSCache().then(() => location.reload());">Clear Cache</button>
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