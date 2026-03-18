import {  getScoresPerTrait,getScoresPerCategory} from "https://lorenasandoval88.github.io/get-pgscatalog-scores/dist/sdk.mjs";

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

const data = await getScoresPerTrait();
const data2 = await getScoresPerCategory()

// Dynamic variant filter state
let variantMin = 1;
let variantMax = 1000;
const ALL_VALUE = "__all_traits__";
const ROWS_PER_PAGE = 50;
const MAX_SELECTION = 6;

// Module-level selected PGS IDs and scores (shared across renders)
const selectedPgsIds = new Set([]);
const selectedScoresMap = new Map(); // Map<id, scoreObject>

/** Get the currently selected PGS IDs. */
window.getSelectedPgsIds = () => Array.from(selectedPgsIds);

/** Get the currently selected scores with full metadata. */
window.getSelectedScores = () => Array.from(selectedScoresMap.values());

/** Update the global selection count display. */
function updateGlobalSelectionCount() {
	const el = document.getElementById("globalSelectionCount");
	if (el) el.textContent = `Selected: ${selectedPgsIds.size} / ${MAX_SELECTION}`;
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
console.log((" CATEGORY SCORES -------------------------------------------"));
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
console.log(`displayScores.js: Deduplicated category scores from ${allCategoryScoresRaw.length} to ${allCategoryScores.length}`,allCategoryScores.slice(0,10));
//console.log(`displayScores.js: Loaded ${allCategoryScores.length} PGS entries across ${categoryScoresMap.size} categories`,allCategoryScores);

/** Get category scores filtered by current variant range. */
function getFilteredCategoryScores() {
	return allCategoryScores.filter(passesVariantFilter).sort(compareScores);
}

// TRAIT SCORES -------------------------------------------
console.log((" TRAIT SCORES -------------------------------------------"));
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
console.log(`displayScores.js: Deduplicated trait scores from ${allTraitScoresRaw.length} to ${allTraitScores.length}`,allTraitScores.slice(0,10));
// console.log(`displayScores.js: Loaded ${allTraitScores.length} PGS entries across ${traits.length} traits`,allTraitScores);

/** Get trait scores filtered by current variant range. */
function getFilteredTraitScores() {
	return allTraitScores.filter(passesVariantFilter).sort(compareScores);
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
	const selectedIds = selectedPgsIds; // Use module-level set

	const renderPage = () => {
		const totalPages = Math.max(1, Math.ceil(scores.length / ROWS_PER_PAGE));
		currentPage = Math.min(Math.max(1, currentPage), totalPages);
		const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
		const pageScores = scores.slice(startIndex, startIndex + ROWS_PER_PAGE);

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
			<div class="d-flex justify-content-between align-items-center my-2">
				<h5 class="mb-0">${escapeHtml(title)}</h5>
				<div>
					<label class="form-check-label me-2" for="selectAllPgs_${key}">Select all</label>
					<input class="form-check-input" id="selectAllPgs_${key}" type="checkbox" ${scores.length > 0 && selectedIds.size === scores.length ? "checked" : ""} />
				</div>
			</div>
			<div class="table-responsive">
				<table class="table table-sm table-striped table-bordered align-middle">
					<thead>
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
			<div class="d-flex justify-content-between align-items-center mt-2">
				<div id="selectedPgsSummary_${key}" class="small text-muted">Selected: ${selectedIds.size} / ${MAX_SELECTION}</div>
				<div class="d-flex align-items-center gap-2">
					<button id="prevPage_${key}" class="btn btn-sm btn-outline-secondary" ${currentPage === 1 ? "disabled" : ""}>Previous</button>
					<span id="pageInfo_${key}" class="small text-muted">Page ${currentPage} of ${totalPages}</span>
					<button id="nextPage_${key}" class="btn btn-sm btn-outline-secondary" ${currentPage >= totalPages ? "disabled" : ""}>Next</button>
				</div>
			</div>
		`;

		const selectAll = document.getElementById(`selectAllPgs_${key}`);
		const rowCheckboxes = Array.from(scoresDiv.querySelectorAll(".pgs-select"));
		const prevPageBtn = document.getElementById(`prevPage_${key}`);
		const nextPageBtn = document.getElementById(`nextPage_${key}`);

		if (selectAll) {
			selectAll.addEventListener("change", () => {
				if (selectAll.checked) {
					// Limit to first MAX_SELECTION items
					scores.slice(0, MAX_SELECTION).forEach((score) => {
						const id = (score?.id ?? "").toString();
						selectedIds.add(id);
						selectedScoresMap.set(id, score);
					});
					if (scores.length > MAX_SELECTION) {
						alert(`Selection limited to ${MAX_SELECTION} items.`);
					}
				} else {
					selectedIds.clear();
					selectedScoresMap.clear();
				}
				renderPage();
				updateGlobalSelectionCount();
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
					selectAll.checked = scores.length > 0 && selectedIds.size === Math.min(scores.length, MAX_SELECTION);
				}
				const selectedPgsSummary = document.getElementById(`selectedPgsSummary_${key}`);
				if (selectedPgsSummary) {
					selectedPgsSummary.textContent = `Selected: ${selectedIds.size} / ${MAX_SELECTION}`;
				}
				updateGlobalSelectionCount();
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


// --- Helpers for dropdown management ---

/** Default onchange handler for trait selection. */
function setDefaultTraitOnChange(select) {
	select.onchange = (e) => {
		try { window.onPgsTraitChange(e.target.value); } catch (err) { console.error('onPgsTraitChange error', err); }
	};
}

/** Build options HTML from a Map of name → scores[]. */
function buildOptionsHtml(map, keys, allLabel, filteredCount) {
	const allOption = `<option value="${ALL_VALUE}"> ${filteredCount} scoring files for all ${map.size} ${allLabel}</option>`;
	const itemOptions = keys
		.map((key) => {
			const filtered = (map.get(key) ?? []).filter(passesVariantFilter);
			return `<option value="${escapeHtml(key)}">${escapeHtml(key)} (${filtered.length})</option>`;
		})
		.join("");
	return allOption + itemOptions;
}

/** Populate dropdown with traits and wire default handler. */
function populateTraitDropdown(select) {
	select.innerHTML = buildOptionsHtml(traitScoresMap, traits, "traits", getFilteredTraitScores().length);
	select.value = ALL_VALUE;
	renderScores(ALL_VALUE, "Trait");
	setDefaultTraitOnChange(select);
}

/** Populate dropdown with categories and wire category handler. */
function populateCategoryDropdown(select) {
	select.innerHTML = buildOptionsHtml(categoryScoresMap, categories, "categories", getFilteredCategoryScores().length);
	select.value = ALL_VALUE;
	renderScores(ALL_VALUE, "Category");

	select.onchange = (e) => {
		const val = e.target.value;
		if (!val) return;
		if (val === ALL_VALUE) {
			setDefaultTraitOnChange(select);
			renderScores(ALL_VALUE, "Category");
			return;
		}
		renderScores(val, "Category");
	};
}

// --- Initialize dropdown and wire buttons ---

const pgsSelect = document.getElementById("pgsDropDown");

if (pgsSelect) {
	if (!traits.length) {
		pgsSelect.innerHTML = `<option value="">No traits found (${variantMin}-${variantMax} variants)</option>`;
	} else {
		populateTraitDropdown(pgsSelect);
	}
}

const traitBtn = document.getElementById("traitBtn");
const categoryBtn = document.getElementById("categoryBtn");

/** Set the active button styling (blue) and reset the other. */
function setActiveButton(activeBtn) {
	[traitBtn, categoryBtn].forEach((btn) => {
		if (!btn) return;
		if (btn === activeBtn) {
			btn.classList.remove("btn-outline-primary");
			btn.classList.add("btn-primary");
		} else {
			btn.classList.remove("btn-primary");
			btn.classList.add("btn-outline-primary");
		}
	});
}

if (traitBtn && pgsSelect) {
	setActiveButton(traitBtn); // default active on load
	traitBtn.addEventListener("click", () => {
		console.log("Load Traits button clicked");
		try {
			populateTraitDropdown(pgsSelect);
			setActiveButton(traitBtn);
		} catch (err) { console.error('traitBtn click error', err); }
	});
}

if (categoryBtn && pgsSelect) {
	categoryBtn.addEventListener("click", () => {
		console.log("Load Categories button clicked");
		try {
			populateCategoryDropdown(pgsSelect);
			setActiveButton(categoryBtn);
		} catch (err) { console.error('categoryBtn click error', err); }
	});
}

// --- Variant range slider ---

const variantMinSlider = document.getElementById("variantMinSlider");
const variantMaxSlider = document.getElementById("variantMaxSlider");
const variantRangeLabel = document.getElementById("variantRangeLabel");
const variantMinInput = document.getElementById("variantMinInput");
const variantMaxInput = document.getElementById("variantMaxInput");
const variantProgressBar = document.getElementById("variantProgressBar");

/** Track current mode to know which dropdown to refresh on slider change. */
let currentMode = "Trait";

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

/** Refresh the current view after slider change. */
function refreshCurrentView() {
	if (!pgsSelect) return;
	const currentValue = pgsSelect.value; // Preserve current selection
	if (currentMode === "Category") {
		// Rebuild dropdown but preserve selection
		pgsSelect.innerHTML = buildOptionsHtml(categoryScoresMap, categories, "categories", getFilteredCategoryScores().length);
		// Restore selection if it still exists
		if (currentValue && Array.from(pgsSelect.options).some(opt => opt.value === currentValue)) {
			pgsSelect.value = currentValue;
		} else {
			pgsSelect.value = ALL_VALUE;
		}
		renderScores(pgsSelect.value, "Category");
	} else {
		// Rebuild dropdown but preserve selection
		pgsSelect.innerHTML = buildOptionsHtml(traitScoresMap, traits, "traits", getFilteredTraitScores().length);
		// Restore selection if it still exists
		if (currentValue && Array.from(pgsSelect.options).some(opt => opt.value === currentValue)) {
			pgsSelect.value = currentValue;
		} else {
			pgsSelect.value = ALL_VALUE;
		}
		renderScores(pgsSelect.value, "Trait");
	}
	setDefaultTraitOnChange(pgsSelect);
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

// Update mode tracking when buttons are clicked
if (traitBtn) {
	traitBtn.addEventListener("click", () => { currentMode = "Trait"; });
}
if (categoryBtn) {
	categoryBtn.addEventListener("click", () => { currentMode = "Category"; });
}