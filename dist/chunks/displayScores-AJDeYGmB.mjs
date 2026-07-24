import { fetchTraits, fetchAllScores, getScoresPerTrait, getScoresPerCategory, getPgsTxt, fetchSomeScores } from 'https://lorenasandoval88.github.io/pgs_catalog_sdk/dist/sdk.mjs';
import { l as localforage } from '../app.mjs';
import 'https://lorenasandoval88.github.io/personal_genomes_project_sdk/dist/sdk.mjs';
import 'https://lorenasandoval88.github.io/clustjs/dist/sdk.mjs';
import 'https://esm.run/@mlc-ai/web-llm';

// Persistent reference to the PGS selection status bar so it can be relocated
// below the search box on every re-render (innerHTML resets would detach it).
let _pgsStickyBar = null;

/*
 Module: displayScores.js
 Purpose: fetch PGS Catalog scores (prefer per-trait), normalize common
					SDK shapes, and render a paginated table of score entries.

 Data shapes handled:
 - `data.scoresPerTrait` may be an object-of-objects whose values are:
	 - arrays (direct lists),
	 - objects with `.scores` or `.items` arrays,
	 - wrapper objects with `.score` containing a single score or array.

 The code below builds a `traitScoresMap` keyed by trait name where each
 value is an array of plain score objects, then flattens and filters by
 `variants_number` before rendering.
*/

const pgsLoadingStatusEl = document.getElementById("pgsLoadingStatus");
const pgsProgressBar = document.getElementById("pgsProgressBar");

function setPgsLoadingStatus(message, isError = false, progress = 0) {
	if (pgsLoadingStatusEl) {
		pgsLoadingStatusEl.textContent = message;
		pgsLoadingStatusEl.classList.toggle("text-danger", isError);
		pgsLoadingStatusEl.classList.toggle("text-muted", !isError);
	}
	if (pgsProgressBar) {
		pgsProgressBar.style.width = `${progress}%`;
	}
}

let data = { scoresPerTrait: {} };
let data2 = { scoresPerCategory: {} };

// Total distinct scoring files available in the PGS Catalog. Sourced from the
// cached all-score summary ("PGS_Catalog:all-score-summary") via fetchAllScores();
// falls back to the trait+category union count below if the summary is unavailable.
let totalAvailableScores = 0;


/**
 * Describe where an SDK loader sourced its data based on its `source` field.
 * @param {string|undefined} source - "cache", "cache-example", or "live".
 * @returns {string} Human-readable source description.
 */
function describePgsSource(source) {
	switch (source) {
		case "cache":
			return "from cache";
		case "cache-example":
			return "from cache (API unavailable)";
		case "live":
			return "from API and stored";
		default:
			return source ? `(${source})` : "";
	}
}

// TODO combine all 3 steps below in pgs sdk!
try {
	// fetchTraits() must run first — it populates the pgs:trait-summary cache
	// that getScoresPerTrait() and getScoresPerCategory() depend on.
	setPgsLoadingStatus("Step 1/3 - Loading trait summary cache...", false, 10);
	const traitsResult = await fetchTraits();

	// fetchAllScores() must run second — it populates pgs:all-score-summary cache.
	setPgsLoadingStatus("Step 2/3 - Loading all-score summary cache...", false, 40);
	const allScoresResult = await fetchAllScores();

	setPgsLoadingStatus("Step 3/3 - Loading scores per trait and category...", false, 70);
	const [scoresPerTrait, scoresPerCategory] = await Promise.all([
		getScoresPerTrait(),
		getScoresPerCategory(),
	]);

	data = scoresPerTrait ?? { scoresPerTrait: {} };
	data2 = scoresPerCategory ?? { scoresPerCategory: {} };

	// Total scores available comes from the cached all-score summary.
	totalAvailableScores = allScoresResult?.summary?.totalScores ?? allScoresResult?.scores?.length ?? 0;

	const traitsSrc = describePgsSource(traitsResult?.source);
	const scoresSrc = describePgsSource(allScoresResult?.source);
	console.log(`displayScores.js: PGS data loaded — traits ${traitsSrc}, scores ${scoresSrc}`);
	setPgsLoadingStatus(
		`PGS data loaded successfully. Traits ${traitsSrc}; scores ${scoresSrc}.`,
		false,
		100
	);
} catch (error) {
	console.error("displayScores.js: failed to load/cache PGS scores", error);
	setPgsLoadingStatus(`Failed to load PGS scores: ${error.message}`, true, 0);
}

// --- PGS scoring file cache tools -------------------------------------------
// Scoring .txt files fetched via getPgsTxt() are cached in LocalForage under the
// "PGS_Catalog:id-" prefix (older builds used "pgs:id-PGS"). These helpers report
// how many scoring files are cached and how much space they use, and clear them.
const PGS_TXT_KEY_PREFIXES = ["PGS_Catalog:id-", "pgs:id-PGS"];

/** True if a LocalForage key holds a cached PGS scoring file. */
function isPgsTxtKey(key) {
	return PGS_TXT_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Strip the cache prefix to recover the bare PGS ID. */
function pgsIdFromKey(key) {
	return key.replace(/^(PGS_Catalog:id-|pgs:id-)/, "");
}

/** Rough byte size of a cached value (UTF-16 approximation). */
function estimateValueBytes(value) {
	try {
		if (value == null) return 0;
		const str = typeof value === "string" ? value : JSON.stringify(value);
		return str.length * 2;
	} catch {
		return 0;
	}
}

/** Human-readable byte size. */
function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Count cached PGS scoring files and the space they use, and show it in #pgsCacheInfo.
 * @returns {Promise<{count:number,totalBytes:number,ids:string[]}|null>}
 */
async function showPgsCacheInfo() {
	const el = document.getElementById("pgsCacheInfo");
	try {
		const keys = await localforage.keys();
		const pgsKeys = keys.filter(isPgsTxtKey);
		let totalBytes = 0;
		const ids = [];
		for (const key of pgsKeys) {
			const value = await localforage.getItem(key);
			totalBytes += estimateValueBytes(value);
			ids.push(pgsIdFromKey(key));
		}
		ids.sort();
		const msg = pgsKeys.length === 0
			? "No PGS scoring files cached."
			: `${pgsKeys.length} PGS scoring file(s) cached · ${formatBytes(totalBytes)} · ${ids.join(", ")}`;
		if (el) el.textContent = msg;
		console.log("PGS scoring cache:", { count: pgsKeys.length, totalBytes, ids });
		return { count: pgsKeys.length, totalBytes, ids };
	} catch (err) {
		console.warn("showPgsCacheInfo error:", err);
		if (el) el.textContent = `Error reading PGS cache: ${err.message}`;
		return null;
	}
}
window.showPgsCacheInfo = showPgsCacheInfo;

/**
 * Clear all cached PGS scoring files and refresh the info line.
 * @returns {Promise<number>} Number of cache items removed.
 */
async function clearPgsTxtCache() {
	const el = document.getElementById("pgsCacheInfo");
	try {
		const keys = await localforage.keys();
		const pgsKeys = keys.filter(isPgsTxtKey);
		for (const key of pgsKeys) {
			await localforage.removeItem(key);
		}
		console.log(`Cleared ${pgsKeys.length} PGS scoring file cache item(s)`);
		if (el) el.textContent = `Cleared ${pgsKeys.length} PGS scoring file(s) from cache.`;
		return pgsKeys.length;
	} catch (err) {
		console.warn("clearPgsTxtCache error:", err);
		if (el) el.textContent = `Error clearing PGS cache: ${err.message}`;
		throw err;
	}
}
window.clearPgsTxtCache = clearPgsTxtCache;

// Dynamic variant filter state
let variantMin = 1;
let variantMax = 1000;
const ALL_VALUE = "__all_categories__";
const ROWS_PER_PAGE = 50;
const MAX_SELECTION = 10; // Max number of scores that can be selected at once for PRS calculation

// Module-level selected PGS IDs and scores (shared across renders)
const selectedPgsIds = new Set([]);
const selectedScoresMap = new Map(); // Map<id, scoreObject>

/** Get the currently selected PGS IDs. */
window.getSelectedPgsIds = () => Array.from(selectedPgsIds);

/** Get the currently selected scores with full metadata. */
window.getSelectedScores = () => Array.from(selectedScoresMap.values());

/** Clear all selected scores. */
window.clearSelectedScores = () => {
	selectedPgsIds.clear();
	selectedScoresMap.clear();
	updateGlobalSelectionCount();
	console.log("Cleared all selected scores");
	// Notify participants table of PGS selection change
	window.onPgsSelectionChange?.();
};

/** Update the global selection count display. */
function updateGlobalSelectionCount() {
	const count = selectedPgsIds.size;
	const atLimit = count >= MAX_SELECTION;

	// Prominent sticky bar: label + filled progress indicator (mirrors tab 1)
	const el = document.getElementById("globalSelectionCount");
	if (el) el.textContent = `${count} of ${MAX_SELECTION} models selected`;
	const bar = document.getElementById("pgsSelectionProgressBar");
	if (bar) {
		const pct = Math.min(100, Math.round((count / MAX_SELECTION) * 100));
		bar.style.width = `${pct}%`;
		bar.setAttribute("aria-valuenow", String(count));
		bar.classList.toggle("bg-success", !atLimit);
		bar.classList.toggle("bg-danger", atLimit);
	}
	const limitMsg = document.getElementById("pgsSelectionLimitMsg");
	if (limitMsg) limitMsg.style.display = atLimit ? "" : "none";

	// Show/hide the contextual "Fetch PGS Files" button
	const fetchPgsFilesBtn = document.getElementById("fetchPgsFilesBtn");
	if (fetchPgsFilesBtn) {
		fetchPgsFilesBtn.style.display = selectedPgsIds.size > 0 ? "" : "none";
	}

	// Show/hide the "Unselect All" button
	const unselectAllModelsBtn = document.getElementById("unselectAllModelsBtn");
	if (unselectAllModelsBtn) {
		unselectAllModelsBtn.style.display = selectedPgsIds.size > 0 ? "" : "none";
	}

	// Also update PRS tab scores section (mirrors displayUsers.js behavior for prsUsersdiv/prsUsersAction)
	const prsScoresDiv = document.getElementById("prsScoresDiv");
	if (prsScoresDiv && selectedPgsIds.size > 0) {
		const scoreList = Array.from(selectedScoresMap.values())
			.map(s => s.id)
			.join(", ");
		prsScoresDiv.textContent = `${selectedPgsIds.size} model(s) selected: ${scoreList}`;
	}

	const prsScoresAction = document.getElementById("prsScoresAction");
	if (prsScoresAction && selectedPgsIds.size > 0) {
		const selectedArr = Array.from(selectedScoresMap.values());
		const rows = selectedArr.map((score, idx) => {
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
		prsScoresAction.innerHTML = `
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
}

/** Check if a score passes the current variant filter. */
function passesVariantFilter(score) {
	const v = Number(score?.variants_number ?? score?.score?.variants_number ?? 0);
	return Number.isFinite(v) && v >= variantMin && v <= variantMax;
}
/**
 * Compare two score objects for stable sorting.
 * First compares the `trait_reported` string, then falls back to `id`.
 * @param {Object} a - First score object.
 * @param {Object} b - Second score object.
 * @returns {number} Negative if a < b, positive if a > b, zero if equal.
 */
function compareScores(a, b) {
	const traitA = (a?.trait_reported ?? "").toString();
	const traitB = (b?.trait_reported ?? "").toString();
	const traitCompare = traitA.localeCompare(traitB);
	if (traitCompare !== 0) return traitCompare;
	const idA = (a?.id ?? "").toString();
	const idB = (b?.id ?? "").toString();
	return idA.localeCompare(idB);
}

// CATEGORY SCORES -------------------------------------------
console.log((" CATEGORY SCORES --------------------------------"));
const categoryScoresMap = new Map(Object.entries(data2.scoresPerCategory ?? {}).map(([category, entry]) => {
	const scores = Array.isArray(entry?.scores)
		? entry.scores
		: Array.isArray(entry?.items)
		? entry.items
		: Array.isArray(entry)
		? entry
		: (entry?.score ? (Array.isArray(entry.score) ? entry.score : [entry.score]) : []);
	return [category, scores];
}));
const categories = Array.from(categoryScoresMap.keys()).sort((a, b) => a.localeCompare(b));

// Flatten values and expose category keys.
const allCategoryScoresRaw = Array.from(categoryScoresMap.values()).flat();

console.log(`displayScores.js: Loaded ${allCategoryScoresRaw.length} raw category scores across ${categoryScoresMap.size} categories`);
// Deduplicate by PGS ID (keep first occurrence)
const seenCategoryIds = new Set();
const allCategoryScores = allCategoryScoresRaw.filter((score) => {
	const id = score?.id ?? "";
	if (seenCategoryIds.has(id)) return false;
	seenCategoryIds.add(id);
	return true;
});
// console.log(`displayScores.js: Deduplicated category scores from ${allCategoryScoresRaw.length} to ${allCategoryScores.length}`,allCategoryScores.slice(0,10));
//console.log(`displayScores.js: Loaded ${allCategoryScores.length} PGS entries across ${categoryScoresMap.size} categories`,allCategoryScores);

/** Get category scores filtered by current variant range. */
function getFilteredCategoryScores() {
	return allCategoryScores.filter(passesVariantFilter).sort(compareScores);
}

// TRAIT SCORES -------------------------------------------
console.log((" TRAIT SCORES --------------------------------"));
const traitScoresMap = new Map(Object.entries(data.scoresPerTrait ?? {}).map(([trait, entry]) => {
	const scores = Array.isArray(entry?.scores)
		? entry.scores
		: Array.isArray(entry?.items)
		? entry.items
		: Array.isArray(entry)
		? entry
		: (entry?.score ? (Array.isArray(entry.score) ? entry.score : [entry.score]) : []);
	return [trait, scores];
}));
const traits = Array.from(traitScoresMap.keys()).sort((a, b) => a.localeCompare(b));

// Flatten values and expose trait keys.
const allTraitScoresRaw = Array.from(traitScoresMap.values()).flat();

console.log(`displayScores.js: Loaded ${allTraitScoresRaw.length} raw trait scores across ${traitScoresMap.size} traits`);
// Deduplicate by PGS ID (keep first occurrence)
const seenTraitIds = new Set();
const allTraitScores = allTraitScoresRaw.filter((score) => {
	const id = score?.id ?? "";
	if (seenTraitIds.has(id)) return false;
	seenTraitIds.add(id);
	return true;
});
// console.log(`displayScores.js: Deduplicated trait scores from ${allTraitScoresRaw.length} to ${allTraitScores.length}`,allTraitScores.slice(0,10));
// console.log(`displayScores.js: Loaded ${allTraitScores.length} PGS entries across ${traits.length} traits`,allTraitScores);

// Example: if the cached all-score summary wasn't available, derive the total
// from the union of trait + category scores (deduplicated by PGS ID).
if (!totalAvailableScores) {
	const totalAvailableIds = new Set();
	[...allTraitScores, ...allCategoryScores].forEach((s) => {
		const id = s?.id ?? "";
		if (id) totalAvailableIds.add(id);
	});
	totalAvailableScores = totalAvailableIds.size;
}
console.log(`displayScores.js: ${totalAvailableScores} total scoring files available`);

/** Get trait scores filtered by current variant range. */
function getFilteredTraitScores() {
	return allTraitScores.filter(passesVariantFilter).sort(compareScores);
}

// --- Separate Category + Trait filters --------------------------------------
// Map each category to the sorted list of distinct traits it contains, so the
// user can pick a category and then narrow to traits within that category.
const categoryTraitsMap = new Map();
for (const [cat, scores] of categoryScoresMap) {
	const set = new Set();
	(scores ?? []).forEach((s) => {
		const t = s?.trait_reported;
		if (t) set.add(String(t));
	});
	categoryTraitsMap.set(cat, Array.from(set).sort((a, b) => a.localeCompare(b)));
}

// Selection state for the category/trait filters.
const selectedCategories = new Set(); // checked category names (empty = all)
const selectedTraits = new Set(); // checked trait names within the category
let traitSearchQuery = ""; // free-text filter for the trait checkbox list

/** Base score list for the current category selection (before trait/variant filtering). */
function getCategoryBaseScores() {
	if (!selectedCategories.size) return allTraitScores;
	const seen = new Set();
	const out = [];
	for (const cat of selectedCategories) {
		for (const s of categoryScoresMap.get(cat) ?? []) {
			const id = s?.id ?? "";
			if (seen.has(id)) continue;
			seen.add(id);
			out.push(s);
		}
	}
	return out;
}

/** Compute the scores matching the current category + trait + variant selection. */
function getSelectionScores() {
	let scores = getCategoryBaseScores();
	if (selectedTraits.size) {
		scores = scores.filter((s) => selectedTraits.has(String(s?.trait_reported ?? "")));
	}
	const seen = new Set();
	return scores
		.filter(passesVariantFilter)
		.filter((s) => {
			const id = s?.id ?? "";
			if (seen.has(id)) return false;
			seen.add(id);
			return true;
		})
		.sort(compareScores);
}

/** Render the score table for the current category/trait/variant selection. */
function renderPgsFromSelection() {
	const scores = getSelectionScores();
	selectedCategories.size
		? `${selectedCategories.size} categor${selectedCategories.size === 1 ? "y" : "ies"}`
		: "All categories";
	selectedTraits.size ? ` · ${selectedTraits.size} trait(s)` : "";
	const title = `PGS Catalog Scoring Files - ${scores.length} of ${totalAvailableScores}`;
	const key = sanitizeKey(`sel_${Array.from(selectedCategories).join("_")}_${Array.from(selectedTraits).join("_")}`) || "sel";
	renderPgsTable(scores, "scoresDiv", title, key);
	renderActiveFilterChips();
}

/** Render the category checkboxes with variant-filtered counts. */
function renderCategoryChecks() {
	const container = document.getElementById("pgsCategoryChecks");
	if (!container) return;

	if (!categories.length) {
		container.innerHTML = `<div class="small text-muted p-1">No categories found.</div>`;
		return;
	}

	container.innerHTML = categories
		.map((cat) => {
			const count = (categoryScoresMap.get(cat) ?? []).filter(passesVariantFilter).length;
			const checked = selectedCategories.has(cat) ? "checked" : "";
			return (
				`<label class="filter-chip"><input type="checkbox" value="${escapeHtml(cat)}" ${checked}/>` +
				`<span class="filter-chip-label" title="${escapeHtml(cat)}">${escapeHtml(cat)}</span>` +
				`<span class="filter-chip-count">${count}</span></label>`
			);
		})
		.join("");

	container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
		cb.addEventListener("change", () => {
			if (cb.checked) selectedCategories.add(cb.value);
			else selectedCategories.delete(cb.value);
			pruneSelectedTraits();
			renderTraitChecks();
			renderPgsFromSelection();
		});
	});
}

/** Drop any checked traits that are no longer present in the current category base. */
function pruneSelectedTraits() {
	if (!selectedTraits.size) return;
	const available = new Set(
		getCategoryBaseScores().map((s) => String(s?.trait_reported ?? "")).filter(Boolean)
	);
	for (const t of Array.from(selectedTraits)) {
		if (!available.has(t)) selectedTraits.delete(t);
	}
}

/** Render the trait checkboxes for the current category (or all categories). */
function renderTraitChecks() {
	const container = document.getElementById("pgsTraitChecks");
	if (!container) return;

	// Count scores per trait (by trait_reported) within the current base + variant range.
	// Base is the whole catalog when no category is selected, else the category's scores.
	const counts = new Map();
	getCategoryBaseScores()
		.filter(passesVariantFilter)
		.forEach((s) => {
			const t = String(s?.trait_reported ?? "");
			if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
		});

	let universe = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b));
	const total = universe.length;

	// Optional free-text search to keep the (large) trait list findable.
	const q = traitSearchQuery.trim().toLowerCase();
	if (q) universe = universe.filter((t) => t.toLowerCase().includes(q));

	if (!total) {
		container.innerHTML = `<div class="small text-muted p-1">No traits within the variant range.</div>`;
		return;
	}
	if (!universe.length) {
		container.innerHTML = `<div class="small text-muted p-1">No traits match “${escapeHtml(traitSearchQuery)}”.</div>`;
		return;
	}

	container.innerHTML = universe
		.map((t) => {
			const checked = selectedTraits.has(t) ? "checked" : "";
			return (
				`<label class="filter-chip"><input type="checkbox" value="${escapeHtml(t)}" ${checked}/>` +
				`<span class="filter-chip-label" title="${escapeHtml(t)}">${escapeHtml(t)}</span>` +
				`<span class="filter-chip-count">${counts.get(t) ?? 0}</span></label>`
			);
		})
		.join("");

	container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
		cb.addEventListener("change", () => {
			if (cb.checked) selectedTraits.add(cb.value);
			else selectedTraits.delete(cb.value);
			renderPgsFromSelection();
		});
	});
}


/**
 * Escape a string for safe insertion into HTML.
 * Replaces special characters with their HTML entities.
 * @param {any} value - Value to escape; will be coerced to string.
 * @returns {string} Escaped string safe for HTML contexts.
 */
function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

/**
 * Render a paginated PGS table into the DOM.
 * Shows `ROWS_PER_PAGE` rows per page, supports select-all and per-row selection,
 * and renders pagination controls. The function mutates the `innerHTML` of
 * the element identified by `targetId`.
 * @param {Array<Object>} scores - Array of PGS score objects to display.
 * @param {string} targetId - ID of the container element for the table.
 * @param {string} title - Title text displayed above the table.
 * @param {string} key - Unique key used to build element IDs for controls.
 */
function renderPgsTable(scores, targetId, title, key) {
	const scoresDiv = document.getElementById(targetId);
	if (!scoresDiv) return;
	scoresDiv.style.display = "block";

	let currentPage = 1;
	let searchQuery = "";
	const selectedIds = selectedPgsIds; // Use module-level set

	// Filter scores by the free-text search box (matches PGS ID, name, or trait)
	const getFilteredScores = () => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return scores;
		return scores.filter((s) => {
			const id = (s?.id ?? "").toString().toLowerCase();
			const name = (s?.name ?? "").toString().toLowerCase();
			const trait = (s?.trait_reported ?? "").toString().toLowerCase();
			return id.includes(q) || name.includes(q) || trait.includes(q);
		});
	};

	const renderPage = () => {
		const filtered = getFilteredScores();
		const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
		currentPage = Math.min(Math.max(1, currentPage), totalPages);
		const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
		const pageScores = filtered.slice(startIndex, startIndex + ROWS_PER_PAGE);

		const rowsHtml = pageScores
			.map((score, index) => {
				const rawPgsId = (score?.id ?? "").toString();
				const pgsId = escapeHtml(rawPgsId);
				const rawName = (score?.name ?? "").toString();
				const displayNameRaw = rawName.length > 15 ? rawName.slice(0, 15) + "..." : rawName;
				const pgsName = escapeHtml(displayNameRaw);
				const pgsNameTitle = escapeHtml(rawName);
				const rawTrait = (score?.trait_reported ?? "").toString();
				const displayTraitRaw = rawTrait.length > 20 ? rawTrait.slice(0, 20) + "..." : rawTrait;
				const trait = escapeHtml(displayTraitRaw);
				const traitTitle = escapeHtml(rawTrait);
				const variants = escapeHtml(score?.variants_number ?? "");
				const date = escapeHtml(score?.date_release ?? "");
				const checked = selectedIds.has(rawPgsId) ? "checked" : "";

				return `
					<tr>
						<td>${startIndex + index + 1}</td>
						<td><input class="pgs-select" type="checkbox" value="${pgsId}" ${checked} /></td>
						<td>${pgsId}</td>
						<td title="${pgsNameTitle}">${pgsName}</td>
						<td title="${traitTitle}">${trait}</td>
						<td>${variants}</td>
						<td>${date}</td>
					</tr>
				`;
			})
			.join("");

		scoresDiv.innerHTML = `
			<div class="d-flex justify-content-between align-items-center my-2 flex-wrap gap-2">
				<h5 class="mb-0">${escapeHtml(title)}</h5>
				<div class="d-flex align-items-center gap-2 flex-wrap">
					<button id="downloadJsonBtn_${key}" class="btn btn-outline-secondary btn-sm" style="font-size:0.7rem;padding:2px 6px;" title="Download the currently filtered list as JSON">Download JSON</button>
					<button id="downloadCsvBtn_${key}" class="btn btn-outline-secondary btn-sm" style="font-size:0.7rem;padding:2px 6px;" title="Download the currently filtered list as CSV">Download CSV</button>
					<label class="form-check-label me-2" for="selectAllPgs_${key}">Select all</label>
					<input class="form-check-input" id="selectAllPgs_${key}" type="checkbox" ${filtered.length > 0 && selectedIds.size === filtered.length ? "checked" : ""} />
				</div>
			</div>
			<div class="mb-2">
				<input id="pgsSearch_${key}" type="search" class="form-control form-control-sm" style="max-width: 420px;" placeholder="Search by PGS ID, name, or trait…" value="${escapeHtml(searchQuery)}" />
			</div>
			<div id="pgsStickyBarSlot_${key}" class="mb-2"></div>
			<div class="table-responsive sticky-scroll">
				<table class="table table-sm table-striped table-bordered align-middle">
					<thead  class="table-dark">
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
					<tbody>
						${rowsHtml}
					</tbody>
				</table>
			</div>
			<div class="d-flex justify-content-end align-items-center mt-2">
				<div class="d-flex align-items-center gap-2">
					<button id="prevPage_${key}" class="btn btn-sm btn-outline-secondary" ${currentPage === 1 ? "disabled" : ""}>Previous</button>
					<span id="pageInfo_${key}" class="small text-muted">Page ${currentPage} of ${totalPages}</span>
					<button id="nextPage_${key}" class="btn btn-sm btn-outline-secondary" ${currentPage >= totalPages ? "disabled" : ""}>Next</button>
				</div>
			</div>
		`;

		// Move the PGS selection status bar to sit directly below the search box.
		const pgsStickyBarSlot = document.getElementById(`pgsStickyBarSlot_${key}`);
		if (!_pgsStickyBar) _pgsStickyBar = document.getElementById('pgsSelectionStickyBar');
		if (pgsStickyBarSlot && _pgsStickyBar) {
			_pgsStickyBar.classList.remove('sticky-top');
			_pgsStickyBar.style.top = '';
			pgsStickyBarSlot.appendChild(_pgsStickyBar);
		}

		const selectAll = document.getElementById(`selectAllPgs_${key}`);
		const searchInput = document.getElementById(`pgsSearch_${key}`);
		const rowCheckboxes = Array.from(scoresDiv.querySelectorAll(".pgs-select"));
		const prevPageBtn = document.getElementById(`prevPage_${key}`);
		const nextPageBtn = document.getElementById(`nextPage_${key}`);
		const downloadJsonBtn = document.getElementById(`downloadJsonBtn_${key}`);
		const downloadCsvBtn = document.getElementById(`downloadCsvBtn_${key}`);

		if (downloadJsonBtn) {
			downloadJsonBtn.addEventListener("click", () => {
				downloadAsFile(
					JSON.stringify(getFilteredScores(), null, 2),
					`PGS_scores.json`,
					"application/json"
				);
			});
		}
		if (downloadCsvBtn) {
			downloadCsvBtn.addEventListener("click", () => {
				downloadAsFile(
					scoresToCsv(getFilteredScores()),
					`PGS_scores.csv`,
					"text/csv"
				);
			});
		}

		if (searchInput) {
			searchInput.addEventListener("input", () => {
				searchQuery = searchInput.value;
				currentPage = 1;
				renderPage();
				// Restore focus/caret after the re-render replaces the input
				const again = document.getElementById(`pgsSearch_${key}`);
				if (again) { again.focus(); const v = again.value; again.value = ""; again.value = v; }
			});
		}

		if (selectAll) {
			selectAll.addEventListener("change", () => {
				if (selectAll.checked) {
					// Limit to first MAX_SELECTION items
					filtered.slice(0, MAX_SELECTION).forEach((score) => {
						const id = (score?.id ?? "").toString();
						selectedIds.add(id);
						selectedScoresMap.set(id, score);
					});
					if (filtered.length > MAX_SELECTION) {
						alert(`Selection limited to ${MAX_SELECTION} items.`);
					}
				} else {
					selectedIds.clear();
					selectedScoresMap.clear();
				}
				renderPage();
				updateGlobalSelectionCount();
				// Notify participants table of PGS selection change
				window.onPgsSelectionChange?.();
			});
		}

		rowCheckboxes.forEach((cb) => {
			const score = scores.find(s => (s?.id ?? "").toString() === cb.value);
			cb.addEventListener("change", () => {
				if (cb.checked) {
					if (selectedIds.size >= MAX_SELECTION) {
						cb.checked = false;
						alert(`Maximum ${MAX_SELECTION} selections allowed.`);
						return;
					}
					selectedIds.add(cb.value);
					if (score) selectedScoresMap.set(cb.value, score);
				} else {
					selectedIds.delete(cb.value);
					selectedScoresMap.delete(cb.value);
				}
				if (selectAll) {
					selectAll.checked = filtered.length > 0 && selectedIds.size === Math.min(filtered.length, MAX_SELECTION);
				}
				updateGlobalSelectionCount();
				// Notify participants table of PGS selection change
				window.onPgsSelectionChange?.();
			});
		});

		if (prevPageBtn) {
			prevPageBtn.addEventListener("click", () => {
				currentPage -= 1;
				renderPage();
			});
		}

		if (nextPageBtn) {
			nextPageBtn.addEventListener("click", () => {
				currentPage += 1;
				renderPage();
			});
		}
	};

	renderPage();
	updateGlobalSelectionCount();
}

/** Trigger a browser download of `content` as a file. */
function downloadAsFile(content, filename, mime = "text/plain") {
	const blob = new Blob([content], { type: `${mime};charset=utf-8` });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Escape a single CSV field per RFC 4180. */
function csvEscape(value) {
	if (value == null) return "";
	const s = String(value);
	return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** Convert a PGS scores list to CSV using a curated, human-friendly column set. */
function scoresToCsv(list) {
	const cols = ["id", "name", "trait_reported", "variants_number", "date_release"];
	const header = cols.join(",");
	const rows = (list ?? []).map((s) => cols.map((c) => csvEscape(s?.[c])).join(","));
	return [header, ...rows].join("\r\n");
}

/**
 * Sanitize an arbitrary string into a safe key suitable for IDs or storage.
 * Lowercases the string, replaces non-alphanumeric sequences with underscores,
 * and trims leading/trailing underscores.
 * @param {any} value - The value to sanitize.
 * @returns {string} Sanitized key string.
 */
function sanitizeKey(value) {
	return String(value ?? "")
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "_")
		.replaceAll(/^_+|_+$/g, "");
}


/**
 * Render the table for a specific trait or category.
 * If `value` equals ALL_VALUE, all scores for that type are shown.
 * @param {string} value - Trait/category name or special value for all.
 * @param {"Trait"|"Category"} [type="Trait"] - Whether rendering traits or categories.
 */
function renderScores(value, type = "Trait") {
	const isCategory = type === "Category";
	const map = isCategory ? categoryScoresMap : traitScoresMap;
	const getFiltered = isCategory ? getFilteredCategoryScores : getFilteredTraitScores;

	//console.log(`Rendering ${type}: ${value}`);
	const isAll = value === ALL_VALUE;

	// Use filtered getter for "all", otherwise filter individual entry
	const scores = isAll
		? getFiltered()
		: (map.get(value) ?? []).filter(passesVariantFilter).sort(compareScores);

	const key = isAll ? `all_${type}s` : (sanitizeKey(value) || type);
	//console.log(key,`Found ${scores.length} scores for ${type} "${value}" after filtering by variant count`, scores);
	const typeLabel = type === "Category" ? "categories" : "traits";
	const title = isAll
		? `All Scoring files (${scores.length} entries across ${map.size} ${typeLabel})`
		: `${type}: ${value} (${scores.length} scoring files)`;

	renderPgsTable(scores, "scoresDiv", title, key);
	renderActiveFilterChips();
}

/**
 * Render removable chips for the currently active filters (category, traits, and
 * variant-count range). Clicking a chip's ✕ clears that filter.
 */
function renderActiveFilterChips() {
	const el = document.getElementById("pgsActiveFilters");
	if (!el) return;

	const chips = [];

	Array.from(selectedCategories)
		.sort((a, b) => a.localeCompare(b))
		.forEach((c) => chips.push({ label: `Category: ${c}`, clear: `category:${c}` }));
	Array.from(selectedTraits)
		.sort((a, b) => a.localeCompare(b))
		.forEach((t) => chips.push({ label: `Trait: ${t}`, clear: `trait:${t}` }));

	if (variantMin > 1 || variantMax < 1000) {
		chips.push({ label: `Variants: ${variantMin}–${variantMax}`, clear: "variants" });
	}

	// Update the "N active" badge on the Filters toggle button.
	const badge = document.getElementById("pgsActiveFilterBadge");
	if (badge) {
		if (chips.length) {
			badge.textContent = `${chips.length} active`;
			badge.style.display = "";
		} else {
			badge.style.display = "none";
		}
	}

	if (!chips.length) {
		el.innerHTML = `<span class="small text-muted">No active filters</span>`;
		return;
	}

	el.innerHTML =
		chips
			.map(
				(c) =>
					`<span class="active-filter-chip">${escapeHtml(c.label)}` +
					`<button type="button" class="chip-remove" data-clear="${escapeHtml(c.clear)}" aria-label="Remove filter" title="Remove filter">&times;</button></span>`
			)
			.join("") +
		`<button type="button" id="clearAllPgsFilters" class="btn btn-link btn-sm p-0 ms-1" style="font-size:0.78rem;">Clear all</button>`;

	el.querySelectorAll(".chip-remove").forEach((btn) => {
		btn.addEventListener("click", () => clearPgsFilter(btn.dataset.clear));
	});
	const clearAll = el.querySelector("#clearAllPgsFilters");
	if (clearAll) clearAll.addEventListener("click", () => clearPgsFilter("all"));
}

/**
 * Clear one active filter (or all) and refresh the view.
 * @param {string} which - "variants", "all", "category:<name>", or "trait:<name>".
 */
function clearPgsFilter(which) {
	if (which === "variants" || which === "all") {
		variantMin = 1;
		variantMax = 1000;
		if (typeof updateSliderLabels === "function") updateSliderLabels();
	}
	if (which === "all") {
		selectedCategories.clear();
		selectedTraits.clear();
	}
	if (typeof which === "string" && which.startsWith("category:")) {
		selectedCategories.delete(which.slice("category:".length));
		pruneSelectedTraits();
	}
	if (typeof which === "string" && which.startsWith("trait:")) {
		selectedTraits.delete(which.slice("trait:".length));
	}
	refreshCurrentView();
}


/**
 * Global handler wired to the trait select control.
 * Validates the selection and triggers rendering for the chosen trait.
 * @param {string} selectedTrait - Value of the selected trait option.
 */
window.onPgsTraitChange = function onPgsTraitChange(selectedTrait) {
	if (!selectedTrait) return;

	// Special: show all scoring files
	if (selectedTrait === ALL_VALUE) {
		renderScores(ALL_VALUE, "Trait");
		return;
	}

	// If a trait name was selected, render that trait
	if (traitScoresMap.has(selectedTrait)) {
		renderScores(selectedTrait, "Trait");
		return;
	}

	// Otherwise assume the selection is a PGS id and render that single file
	const pgsId = selectedTrait;
	const match = getFilteredTraitScores().find((s) => String(s?.id ?? "") === String(pgsId));
	if (!match) return;
	const title = `${match.id} - ${match.name ?? match.trait_reported ?? "PGS"}`;
	renderPgsTable([match], "scoresDiv", title, sanitizeKey(pgsId));
};

// --- Initialize category + trait filters ---

if (!traits.length && !categories.length) {
	const catBox = document.getElementById("pgsCategoryChecks");
	if (catBox) catBox.innerHTML = `<div class="small text-muted p-1">No scores found.</div>`;
} else {
	renderCategoryChecks();
	renderTraitChecks();
	renderPgsFromSelection();
}

// "Clear" link resets the category selection.
const pgsClearCategoriesBtn = document.getElementById("pgsClearCategoriesBtn");
if (pgsClearCategoriesBtn) {
	pgsClearCategoriesBtn.addEventListener("click", () => {
		selectedCategories.clear();
		pruneSelectedTraits();
		renderCategoryChecks();
		renderTraitChecks();
		renderPgsFromSelection();
	});
}

// "Clear" link resets the trait selection within the current category.
const pgsClearTraitsBtn = document.getElementById("pgsClearTraitsBtn");
if (pgsClearTraitsBtn) {
	pgsClearTraitsBtn.addEventListener("click", () => {
		selectedTraits.clear();
		renderTraitChecks();
		renderPgsFromSelection();
	});
}

// Free-text search that filters the trait checkbox list (keeps ~800 traits findable).
const pgsTraitSearch = document.getElementById("pgsTraitSearch");
if (pgsTraitSearch) {
	pgsTraitSearch.addEventListener("input", () => {
		traitSearchQuery = pgsTraitSearch.value;
		renderTraitChecks();
	});
}

// --- Variant range slider ---

const variantMinSlider = document.getElementById("variantMinSlider");
const variantMaxSlider = document.getElementById("variantMaxSlider");
const variantRangeLabel = document.getElementById("variantRangeLabel");
const variantMinInput = document.getElementById("variantMinInput");
const variantMaxInput = document.getElementById("variantMaxInput");
const variantProgressBar = document.getElementById("variantProgressBar");

/** Update the slider UI labels and progress bar. */
function updateSliderLabels() {
	if (variantRangeLabel) variantRangeLabel.textContent = `${variantMin} - ${variantMax}`;
	if (variantMinInput) variantMinInput.value = variantMin;
	if (variantMaxInput) variantMaxInput.value = variantMax;
	if (variantMinSlider) variantMinSlider.value = variantMin;
	if (variantMaxSlider) variantMaxSlider.value = variantMax;
	// Update progress bar position
	if (variantProgressBar) {
		const minPercent = ((variantMin - 1) / 999) * 100;
		const maxPercent = ((variantMax - 1) / 999) * 100;
		variantProgressBar.style.left = minPercent + "%";
		variantProgressBar.style.right = (100 - maxPercent) + "%";
	}
}

/** Refresh the whole filter UI (category boxes, trait boxes, and table). */
function refreshCurrentView() {
	renderCategoryChecks();
	renderTraitChecks();
	renderPgsFromSelection();
}

/** Debounce timer for slider input. */
let sliderDebounce = null;

/** Debounced refresh to avoid too many updates while dragging. */
function debouncedRefresh() {
	clearTimeout(sliderDebounce);
	sliderDebounce = setTimeout(refreshCurrentView, 150);
}

if (variantMinSlider) {
	variantMinSlider.addEventListener("input", () => {
		variantMin = Math.min(parseInt(variantMinSlider.value, 10), variantMax - 1);
		updateSliderLabels();
		debouncedRefresh();
	});
}

if (variantMaxSlider) {
	variantMaxSlider.addEventListener("input", () => {
		variantMax = Math.max(parseInt(variantMaxSlider.value, 10), variantMin + 1);
		updateSliderLabels();
		debouncedRefresh();
	});
}

// Number input event listeners
if (variantMinInput) {
	variantMinInput.addEventListener("input", () => {
		let val = parseInt(variantMinInput.value, 10) || 1;
		val = Math.max(1, Math.min(val, variantMax - 1));
		variantMin = val;
		updateSliderLabels();
		debouncedRefresh();
	});
}

if (variantMaxInput) {
	variantMaxInput.addEventListener("input", () => {
		let val = parseInt(variantMaxInput.value, 10) || 1000;
		val = Math.max(variantMin + 1, Math.min(val, 1000));
		variantMax = val;
		updateSliderLabels();
		debouncedRefresh();
	});
}

// Initialize progress bar on load
updateSliderLabels();

// --- Fetch and parse PGS scoring files (text files with variants) ---

// Store loaded PGS text files globally for PRS calculation
window.loadedPgsTxts = [];

/**
 * Fetch and parse selected PGS scoring files.
 * The parsed files are stored in window.loadedPgsTxts for use by calculatePRS.
 */
async function fetchScoresTxts() {
	const statusEl = document.getElementById("fetchScoresStatus");
	const txtsDiv = document.getElementById("scoreTxtsDiv");
	
	try {
		const selectedIds = window.getSelectedPgsIds?.() ?? [];
		const selectedScores = window.getSelectedScores?.() ?? [];
		
		if (selectedIds.length === 0) {
			if (statusEl) statusEl.textContent = "Please select at least one scoring file from the table.";
			return;
		}
		
		if (statusEl) statusEl.textContent = `Fetching ${selectedIds.length} PGS file(s)...`;
		if (txtsDiv) txtsDiv.style.display = "block";
		
		// Fetch PGS text files using the SDK (getPgsTxt loads one id at a time,
		// returning an array each; flatten into a single list of parsed scores)
		//console.log(`Fetching ${selectedIds.length} PGS files:`, selectedIds);
		const pgsTxts = (await Promise.all(selectedIds.map(id => getPgsTxt(id)))).flat();
		
		window.loadedPgsTxts = pgsTxts;
		console.log(`\n=== Results saved to window.loadedPgsTxts ===`);


		if (statusEl) statusEl.textContent = `Loaded ${pgsTxts.length} of ${selectedIds.length} PGS file(s).`;

		const nextToPrsBtn = document.getElementById('nextToPrsBtn');
		if (nextToPrsBtn) nextToPrsBtn.style.display = '';
		
		// Ensure the v4/v5 SNP sets are ready before computing overlap percentages
		if (window._v4v5OverlapReady) await window._v4v5OverlapReady;
		
		// Compare loaded PGS files with 23andMe SNPs (v4, v5, both)
		const pgsMatchStats = compareSnpOverlap(pgsTxts);
		
		// Show summary of loaded files with match percentages
		renderLoadedPgsTable(txtsDiv, pgsTxts, selectedScores, pgsMatchStats);
		
		// Also update the Calculate PRS tab's "1.) Select Weight Files" section
		updatePrsScoresDisplay(pgsTxts, selectedScores);
		
		console.log("Loaded PGS files:", pgsTxts);
		
	} catch (err) {
		console.error("fetchScoresTxts error:", err);
		if (statusEl) statusEl.textContent = `Error: ${err.message}`;
	}
}

// Current filter settings for PGS match percentage
let pgsMatchFilter = { type: 'both', metric: 'weight', minPercent: 0 };

/**
 * Render loaded PGS table with match percentages and filter controls.
 */
function renderLoadedPgsTable(txtsDiv, pgsTxts, selectedScores, pgsMatchStats) {
	if (!txtsDiv) return;
	
	// Filter PGS files based on current filter settings
	const filteredPgs = pgsTxts.filter(pgs => {
		const pgsId = pgs?.id ?? pgs?.meta?.pgs_id ?? "";
		const stats = pgsMatchStats[pgsId];
		if (!stats) return true;
		
		let matchPercent;
		const useWeight = pgsMatchFilter.metric === 'weight';
		
		if (pgsMatchFilter.type === 'v4') {
			matchPercent = useWeight ? stats.v4WeightPercent : stats.v4Percent;
		} else if (pgsMatchFilter.type === 'v5') {
			matchPercent = useWeight ? stats.v5WeightPercent : stats.v5Percent;
		} else {
			matchPercent = useWeight ? stats.bothWeightPercent : stats.bothPercent;
		}
		
		return matchPercent >= pgsMatchFilter.minPercent;
	});
	
	const rows = filteredPgs.map((pgs, idx) => {
		const id = escapeHtml(pgs?.id ?? pgs?.meta?.pgs_id ?? "");
		const variantCount = pgs?.dt?.length ?? 0;
		const score = selectedScores.find(s => s.id === pgs.id);
		const trait = escapeHtml(score?.trait_reported ?? "");
		const stats = pgsMatchStats[id] ?? {};
		
		return `
			<tr>
				<td>${idx + 1}</td>
				<td>${id}</td>
				<td title="${escapeHtml(score?.trait_reported ?? '')}">${trait.length > 20 ? trait.slice(0,20) + '...' : trait}</td>
				<td>${variantCount.toLocaleString()}</td>
				<td>${stats.v4Percent?.toFixed(1) ?? '-'}%</td>
				<td>${stats.v5Percent?.toFixed(1) ?? '-'}%</td>
				<td>${stats.bothPercent?.toFixed(1) ?? '-'}%</td>
				<td>${stats.v4WeightPercent?.toFixed(1) ?? '-'}%</td>
				<td>${stats.v5WeightPercent?.toFixed(1) ?? '-'}%</td>
				<td>${stats.bothWeightPercent?.toFixed(1) ?? '-'}%</td>
			</tr>`;
	}).join("");
	
	txtsDiv.innerHTML = `
		<h6 class="mt-3">Loaded PGS Scoring Files</h6>
		<div class="mb-2 d-flex flex-wrap align-items-center gap-2">
			<label class="form-label mb-0 small"><b>Filter by:</b></label>
			<select id="pgsMatchMetricFilter" class="form-select form-select-sm" style="width: auto;">
				<option value="weight" ${pgsMatchFilter.metric === 'weight' ? 'selected' : ''}>Effect Weight %</option>
				<option value="snp" ${pgsMatchFilter.metric === 'snp' ? 'selected' : ''}>SNP Count %</option>
			</select>
			<select id="pgsMatchTypeFilter" class="form-select form-select-sm" style="width: auto;">
				<option value="both" ${pgsMatchFilter.type === 'both' ? 'selected' : ''}>Both (v4 ∩ v5)</option>
				<option value="v4" ${pgsMatchFilter.type === 'v4' ? 'selected' : ''}>v4 only</option>
				<option value="v5" ${pgsMatchFilter.type === 'v5' ? 'selected' : ''}>v5 only</option>
			</select>
			<label class="form-label mb-0 small">Min %:</label>
			<input type="number" id="pgsMatchMinPercent" class="form-control form-control-sm" style="width: 80px;" 
				   value="${pgsMatchFilter.minPercent}" min="0" max="100" step="5" />
			<button id="applyPgsMatchFilter" class="btn btn-sm btn-primary">Apply</button>
			<span class="small text-muted">(${filteredPgs.length} of ${pgsTxts.length} shown)</span>
		</div>
		<div class="table-responsive">
			<table class="table table-sm table-striped">
				<thead class="table-dark">
					<tr>
						<th rowspan="2">#</th>
						<th rowspan="2">PGS ID</th>
						<th rowspan="2">Trait</th>
						<th rowspan="2">Variants</th>
						<th colspan="3" class="text-center">SNP Count %</th>
						<th colspan="3" class="text-center">Effect Weight %</th>
					</tr>
					<tr>
						<th>v4_chip</th>
						<th>v5_chip</th>
						<th>Both</th>
						<th>v4_chip</th>
						<th>v5_chip</th>
						<th>Both</th>
					</tr>
				</thead>
				<tbody>${rows}</tbody>
			</table>
		</div>
		<p class="small text-muted">Files ready for PRS calculation. Go to Calculate PRS tab and click "Calculate PRS".</p>`;
	
	// Wire up filter controls
	const metricSelect = document.getElementById('pgsMatchMetricFilter');
	const typeSelect = document.getElementById('pgsMatchTypeFilter');
	const minInput = document.getElementById('pgsMatchMinPercent');
	const applyBtn = document.getElementById('applyPgsMatchFilter');
	
	if (applyBtn) {
		applyBtn.addEventListener('click', () => {
			pgsMatchFilter.metric = metricSelect?.value ?? 'weight';
			pgsMatchFilter.type = typeSelect?.value ?? 'both';
			pgsMatchFilter.minPercent = parseFloat(minInput?.value ?? 0);
			renderLoadedPgsTable(txtsDiv, pgsTxts, selectedScores, pgsMatchStats);
		});
	}
}

/**
 * Compare loaded PGS files with 23andMe SNPs (v4, v5, and overlap).
 * Returns match statistics for each PGS file including effect weight percentages.
 * @param {Array} pgsTxts - Loaded PGS text files
 * @returns {Object} Map of pgsId -> { v4Percent, v5Percent, bothPercent, v4WeightPercent, v5WeightPercent, bothWeightPercent, ... }
 */
function compareSnpOverlap(pgsTxts) {
	console.log("compareSnpOverlap called with", pgsTxts?.length, "PGS files");
	
	const v4Array = window.v4_23andme ?? [];
	const v5Array = window.v5_23andme ?? [];
	const bothArray = window.v4_v5_23andme ?? [];
	
	const v4Set = new Set(v4Array);
	const v5Set = new Set(v5Array);
	const bothSet = new Set(bothArray);
	
	console.log(`23andMe SNP sets: v4=${v4Set.size}, v5=${v5Set.size}, both=${bothSet.size}`);
	
	if (v4Set.size === 0 && v5Set.size === 0) {
		console.warn("23andMe SNP sets not computed yet. Run computeV4V5Overlap() first.");
		return {};
	}
	
	// Store results globally
	window.pgsOverlapResults = {};
	const stats = {};
	
	//console.log(`\n=== PGS vs 23andMe SNP Match Analysis ===`);
	
	for (const pgs of pgsTxts) {
		const pgsId = pgs?.id ?? pgs?.meta?.pgs_id ?? "unknown";
		const cols = pgs?.cols ?? [];
		const dt = pgs?.dt ?? [];
		
		// Find column indices
		const hmChrIdx = cols.indexOf('hm_chr');
		const hmPosIdx = cols.indexOf('hm_pos');
		const effectWeightIdx = cols.indexOf('effect_weight');
		
		if (hmChrIdx < 0 || hmPosIdx < 0) {
			console.warn(`${pgsId}: Missing hm_chr or hm_pos columns.`);
			stats[pgsId] = { 
				v4Percent: 0, v5Percent: 0, bothPercent: 0, 
				v4WeightPercent: 0, v5WeightPercent: 0, bothWeightPercent: 0,
				v4Rows: [], v5Rows: [], bothRows: [] 
			};
			continue;
		}
		
		// Calculate total effect weight (use absolute values)
		let totalWeight = 0;
		let v4Weight = 0;
		let v5Weight = 0;
		let bothWeight = 0;
		
		// Find matching rows for each set
		const v4Rows = [];
		const v5Rows = [];
		const bothRows = [];
		
		for (const row of dt) {
			const chr = row[hmChrIdx];
			const pos = row[hmPosIdx];
			const key = `${chr}:${pos}`;
			const weight = effectWeightIdx >= 0 ? Math.abs(parseFloat(row[effectWeightIdx]) || 0) : 0;
			
			totalWeight += weight;
			
			// Build row object with column names
			const rowObj = {};
			cols.forEach((col, i) => {
				rowObj[col] = row[i];
			});
			rowObj._chrPosKey = key;
			rowObj._absWeight = weight;
			
			if (v4Set.has(key)) {
				v4Rows.push(rowObj);
				v4Weight += weight;
			}
			if (v5Set.has(key)) {
				v5Rows.push(rowObj);
				v5Weight += weight;
			}
			if (bothSet.has(key)) {
				bothRows.push(rowObj);
				bothWeight += weight;
			}
		}
		
		const totalVariants = dt.length;
		
		// SNP count percentages
		const v4Percent = totalVariants > 0 ? (v4Rows.length / totalVariants) * 100 : 0;
		const v5Percent = totalVariants > 0 ? (v5Rows.length / totalVariants) * 100 : 0;
		const bothPercent = totalVariants > 0 ? (bothRows.length / totalVariants) * 100 : 0;
		
		// Effect weight percentages
		const v4WeightPercent = totalWeight > 0 ? (v4Weight / totalWeight) * 100 : 0;
		const v5WeightPercent = totalWeight > 0 ? (v5Weight / totalWeight) * 100 : 0;
		const bothWeightPercent = totalWeight > 0 ? (bothWeight / totalWeight) * 100 : 0;
		
		stats[pgsId] = { 
			v4Percent, v5Percent, bothPercent, 
			v4WeightPercent, v5WeightPercent, bothWeightPercent,
			v4Rows, v5Rows, bothRows, 
			totalVariants, totalWeight,
			v4Weight, v5Weight, bothWeight
		};
		
		// Store in global results (keep bothRows for backward compatibility)
		window.pgsOverlapResults[pgsId] = bothRows;
		
		//console.log(`${pgsId}: ${totalVariants} variants | SNP%: v4=${v4Percent.toFixed(1)}%, v5=${v5Percent.toFixed(1)}%, both=${bothPercent.toFixed(1)}% | Weight%: v4=${v4WeightPercent.toFixed(1)}%, v5=${v5WeightPercent.toFixed(1)}%, both=${bothWeightPercent.toFixed(1)}%`);
	}
	
	// Store full stats globally
	window.pgsMatchStats = stats;
	
	console.log(`\n=== Results saved to window.pgsMatchStats ===`);
	return stats;
}

window.compareSnpOverlap = compareSnpOverlap;

/**
 * Update the Calculate PRS tab's weight files display.
 * @param {Array} pgsTxts - Loaded PGS text files
 * @param {Array} selectedScores - Selected score metadata
 */
function updatePrsScoresDisplay(pgsTxts, selectedScores) {
	const prsScoresDiv = document.getElementById("prsScoresDiv");
	const prsScoresAction = document.getElementById("prsScoresAction");
	
	if (prsScoresDiv) {
		prsScoresDiv.textContent = `Loaded ${pgsTxts.length} scoring file(s) from Polygenic Scores tab.`;
	}
	
	if (prsScoresAction && pgsTxts.length > 0) {
		const rows = pgsTxts.map((pgs, idx) => {
			const id = escapeHtml(pgs?.id ?? pgs?.meta?.pgs_id ?? "");
			const variantCount = pgs?.dt?.length ?? 0;
			const score = selectedScores?.find(s => s.id === pgs.id) ?? {};
			const name = escapeHtml(score?.name ?? "");
			const trait = escapeHtml(score?.trait_reported ?? "");
			const date = escapeHtml(score?.date_release ?? "");
			return `
				<tr>
					<td>${idx + 1}</td>
					<td><input type="checkbox" class="form-check-input prs-select-cb" value="${id}" checked /></td>
					<td>${id}</td>
					<td>${name}</td>
					<td>${trait}</td>
					<td>${variantCount.toLocaleString()}</td>
					<td>${date}</td>
				</tr>`;
		}).join("");
		
		prsScoresAction.innerHTML = `
			<table class="table table-striped table-sm mt-3">
				<thead class="table-dark">
					<tr>
						<th>#</th>
						<th>Select</th>
						<th>PGS ID</th>
						<th>Name</th>
						<th>Trait</th>
						<th>Variants</th>
						<th>Date</th>
					</tr>
				</thead>
				<tbody>${rows}</tbody>
			</table>`;
	}
}

window.updatePrsScoresDisplay = updatePrsScoresDisplay;
window.fetchScoresTxts = fetchScoresTxts;

// Wire up the Fetch Files button in the Polygenic Scores tab
const fetchScoresBtn = document.getElementById("fetchScoresBtn");
if (fetchScoresBtn) {
	fetchScoresBtn.addEventListener("click", fetchScoresTxts);
}

const fetchPgsFilesBtn = document.getElementById("fetchPgsFilesBtn");
if (fetchPgsFilesBtn) {
	fetchPgsFilesBtn.addEventListener("click", fetchScoresTxts);
}

// --- Direct PGS ID entry ---

/**
 * Parse a free-text string of PGS IDs into a validated array of uppercase IDs.
 * Accepts comma, space, semicolon, or newline as delimiters.
 * Returns only strings matching the PGS + digits pattern.
 */
function parsePgsIdInput(raw) {
	return raw
		.split(/[\s,;]+/)
		.map(s => s.trim().toUpperCase())
		.filter(s => /^PGS\d+$/.test(s));
}

/**
 * Add PGS IDs typed directly into the text input to the current selection.
 * Looks up metadata from already-loaded catalog data first; falls back to
 * fetching from the PGS Catalog REST API for unknown IDs.
 */
async function addPgsByDirectInput() {
	const inputEl = document.getElementById("directPgsInput");
	const statusEl = document.getElementById("directPgsStatus");

	if (!inputEl) return;

	const ids = parsePgsIdInput(inputEl.value);
	if (ids.length === 0) {
		if (statusEl) statusEl.textContent = "No valid PGS IDs found. Use format: PGS000001";
		return;
	}

	// Enforce global selection cap
	const remaining = MAX_SELECTION - selectedPgsIds.size;
	if (remaining <= 0) {
		if (statusEl) statusEl.textContent = `Selection is already at the maximum of ${MAX_SELECTION}. Deselect some entries first.`;
		return;
	}
	const idsToAdd = ids.slice(0, remaining);
	if (ids.length > remaining) {
		if (statusEl) statusEl.textContent = `Only ${remaining} slot(s) remaining — adding first ${remaining} of ${ids.length} IDs.`;
	}

	if (statusEl) statusEl.textContent = `Looking up ${idsToAdd.length} ID(s)...`;

	// Build a lookup from already-loaded catalog entries
	const catalogLookup = new Map(
		[...allTraitScores, ...allCategoryScores].map(s => [s?.id ?? "", s])
	);

	const toFetch = [];
	for (const id of idsToAdd) {
		if (selectedPgsIds.has(id)) continue; // already selected
		const known = catalogLookup.get(id);
		if (known) {
			selectedPgsIds.add(id);
			selectedScoresMap.set(id, known);
		} else {
			toFetch.push(id);
		}
	}

	// Fetch metadata for IDs not in local cache
	if (toFetch.length > 0) {
		if (statusEl) statusEl.textContent = `Fetching metadata for ${toFetch.length} unknown ID(s)...`;
		try {
			const result = await fetchSomeScores(toFetch);
			const fetched = result?.scores ?? [];
			const fetchedMap = new Map(fetched.map(s => [s?.id ?? "", s]));
			for (const id of toFetch) {
				const score = fetchedMap.get(id) ?? { id }; // stub if not found
				selectedPgsIds.add(id);
				selectedScoresMap.set(id, score);
			}
		} catch (err) {
			console.error("addPgsByDirectInput: fetchSomeScores error", err);
			// Add stubs so the IDs are still selectable
			for (const id of toFetch) {
				selectedPgsIds.add(id);
				selectedScoresMap.set(id, { id });
			}
		}
	}

	updateGlobalSelectionCount();
	window.onPgsSelectionChange?.();

	const addedCount = idsToAdd.filter(id => selectedPgsIds.has(id)).length;
	if (statusEl) {
		statusEl.textContent = `Added ${addedCount} ID(s). Total selected: ${selectedPgsIds.size} / ${MAX_SELECTION}.`;
		statusEl.classList.remove("text-danger");
		statusEl.classList.add("text-success");
		setTimeout(() => {
			statusEl.classList.remove("text-success");
			statusEl.classList.add("text-muted");
		}, 3000);
	}
	inputEl.value = "";
}

const addPgsByIdBtn = document.getElementById("addPgsByIdBtn");
if (addPgsByIdBtn) {
	addPgsByIdBtn.addEventListener("click", addPgsByDirectInput);
}

// Also allow pressing Enter in the textarea to trigger the add
const directPgsInput = document.getElementById("directPgsInput");
if (directPgsInput) {
	directPgsInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			addPgsByDirectInput();
		}
	});
}

// --- window.sdk namespace (scores/catalog) ---
window.sdk = Object.assign(window.sdk ?? {}, {
	// PGS selection
	getSelectedPgsIds: () => Array.from(selectedPgsIds),
	getSelectedScores: () => Array.from(selectedScoresMap.values()),
	clearSelectedScores: window.clearSelectedScores,

	// Catalog UI
	onPgsTraitChange: window.onPgsTraitChange,
	compareSnpOverlap,
	fetchScoresTxts,
	updatePrsScoresDisplay,
});
//# sourceMappingURL=displayScores-AJDeYGmB.mjs.map
