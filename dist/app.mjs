import { getScoresPerTrait, getScoresPerCategory, getTxts } from 'https://lorenasandoval88.github.io/get-pgscatalog-scores/dist/sdk.mjs';
import { fetch23andMeParticipants } from 'https://lorenasandoval88.github.io/get-23andme-data/dist/sdk.mjs';

// logic in tabs.js to show only the selected category panel 
function tabFunction(evt, openTab, subTab) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");

    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    if(subTab) {
      var parent = evt.currentTarget.closest('.tabcontent');
      parent.style.display = "block";
      parent.className += " active";
    }
    document.getElementById(openTab).style.display = "block";
    evt.currentTarget.className += " active";
        if (openTab === 'LocalData' && typeof window.renderLocalUsers === 'function') {
            try { window.renderLocalUsers(); } catch (e) { console.error('renderLocalUsers error', e); }
        }

}

window.tabFunction = tabFunction;

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

const data$1 = await getScoresPerTrait();
const data2 = await getScoresPerCategory();

// Dynamic variant filter state
let variantMin = 1;
let variantMax = 1000;
const ALL_VALUE = "__all_traits__";
const ROWS_PER_PAGE$1 = 50;
const MAX_SELECTION$1 = 6;

// Module-level selected PGS IDs and scores (shared across renders)
const selectedPgsIds = new Set([]);
const selectedScoresMap = new Map(); // Map<id, scoreObject>

/** Get the currently selected PGS IDs. */
window.getSelectedPgsIds = () => Array.from(selectedPgsIds);

/** Get the currently selected scores with full metadata. */
window.getSelectedScores = () => Array.from(selectedScoresMap.values());

/** Update the global selection count display. */
function updateGlobalSelectionCount$1() {
	const el = document.getElementById("globalSelectionCount");
	if (el) el.textContent = `Selected: ${selectedPgsIds.size} / ${MAX_SELECTION$1}`;
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
console.log(`displayScores.js: Deduplicated category scores from ${allCategoryScoresRaw.length} to ${allCategoryScores.length}`,allCategoryScores.slice(0,10));
//console.log(`displayScores.js: Loaded ${allCategoryScores.length} PGS entries across ${categoryScoresMap.size} categories`,allCategoryScores);

/** Get category scores filtered by current variant range. */
function getFilteredCategoryScores() {
	return allCategoryScores.filter(passesVariantFilter).sort(compareScores);
}

// TRAIT SCORES -------------------------------------------
console.log((" TRAIT SCORES --------------------------------"));
const traitScoresMap = new Map(Object.entries(data$1.scoresPerTrait ?? {}).map(([trait, entry]) => {
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
function escapeHtml$2(value) {
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
		const totalPages = Math.max(1, Math.ceil(scores.length / ROWS_PER_PAGE$1));
		currentPage = Math.min(Math.max(1, currentPage), totalPages);
		const startIndex = (currentPage - 1) * ROWS_PER_PAGE$1;
		const pageScores = scores.slice(startIndex, startIndex + ROWS_PER_PAGE$1);

		const rowsHtml = pageScores
			.map((score, index) => {
				const rawPgsId = (score?.id ?? "").toString();
				const pgsId = escapeHtml$2(rawPgsId);
				const rawName = (score?.name ?? "").toString();
				const displayNameRaw = rawName.length > 15 ? rawName.slice(0, 15) + "..." : rawName;
				const pgsName = escapeHtml$2(displayNameRaw);
				const pgsNameTitle = escapeHtml$2(rawName);
				const rawTrait = (score?.trait_reported ?? "").toString();
				const displayTraitRaw = rawTrait.length > 20 ? rawTrait.slice(0, 20) + "..." : rawTrait;
				const trait = escapeHtml$2(displayTraitRaw);
				const traitTitle = escapeHtml$2(rawTrait);
				const variants = escapeHtml$2(score?.variants_number ?? "");
				const date = escapeHtml$2(score?.date_release ?? "");
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
				<h5 class="mb-0">${escapeHtml$2(title)}</h5>
				<div>
					<label class="form-check-label me-2" for="selectAllPgs_${key}">Select all</label>
					<input class="form-check-input" id="selectAllPgs_${key}" type="checkbox" ${scores.length > 0 && selectedIds.size === scores.length ? "checked" : ""} />
				</div>
			</div>
			<div class="table-responsive">
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
			<div class="d-flex justify-content-between align-items-center mt-2">
				<div id="selectedPgsSummary_${key}" class="small text-muted">Selected: ${selectedIds.size} / ${MAX_SELECTION$1}</div>
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
					scores.slice(0, MAX_SELECTION$1).forEach((score) => {
						const id = (score?.id ?? "").toString();
						selectedIds.add(id);
						selectedScoresMap.set(id, score);
					});
					if (scores.length > MAX_SELECTION$1) {
						alert(`Selection limited to ${MAX_SELECTION$1} items.`);
					}
				} else {
					selectedIds.clear();
					selectedScoresMap.clear();
				}
				renderPage();
				updateGlobalSelectionCount$1();
			});
		}

		rowCheckboxes.forEach((cb) => {
			const score = scores.find(s => (s?.id ?? "").toString() === cb.value);
			cb.addEventListener("change", () => {
				if (cb.checked) {
					if (selectedIds.size >= MAX_SELECTION$1) {
						cb.checked = false;
						alert(`Maximum ${MAX_SELECTION$1} selections allowed.`);
						return;
					}
					selectedIds.add(cb.value);
					if (score) selectedScoresMap.set(cb.value, score);
				} else {
					selectedIds.delete(cb.value);
					selectedScoresMap.delete(cb.value);
				}
				if (selectAll) {
					selectAll.checked = scores.length > 0 && selectedIds.size === Math.min(scores.length, MAX_SELECTION$1);
				}
				const selectedPgsSummary = document.getElementById(`selectedPgsSummary_${key}`);
				if (selectedPgsSummary) {
					selectedPgsSummary.textContent = `Selected: ${selectedIds.size} / ${MAX_SELECTION$1}`;
				}
				updateGlobalSelectionCount$1();
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
	updateGlobalSelectionCount$1();
}

/**
 * Sanitize an arbitrary string into a safe key suitable for IDs or storage.
 * Lowercases the string, replaces non-alphanumeric sequences with underscores,
 * and trims leading/trailing underscores.
 * @param {any} value - The value to sanitize.
 * @returns {string} Sanitized key string.
 */
function sanitizeKey$1(value) {
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

	const key = isAll ? `all_${type}s` : (sanitizeKey$1(value) || type);
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
	renderPgsTable([match], "scoresDiv", title, sanitizeKey$1(pgsId));
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
			return `<option value="${escapeHtml$2(key)}">${escapeHtml$2(key)} (${filtered.length})</option>`;
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

const data = await fetch23andMeParticipants();
// console.log("Fetched 23andMe participants:", data);
const participants = data ?? [];

const ROWS_PER_PAGE = 50;
const MAX_SELECTION = 6;

// Module-level selected users (shared across renders)
const selectedUserIds = new Set();
const selectedUsersMap = new Map(); // Map<id, userObject>

/** Get the currently selected user IDs. */
window.getSelectedUserIds = () => Array.from(selectedUserIds);

/** Get the currently selected users with full metadata. */
window.getSelectedUsers = () => Array.from(selectedUsersMap.values());


/** Update the global selection count display. */
function updateGlobalSelectionCount() {
	const el = document.getElementById("globalSelectionCount2");
	if (el) el.textContent = `Selected: ${selectedUserIds.size} / ${MAX_SELECTION}`;
}
/**
 * escapeHtml(value)
 * Escape HTML special characters to prevent injection when inserting text into the DOM.
 * @param {any} value
 * @returns {string}
 */
function escapeHtml$1(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

/**
 * formatGenotypes(genotypes)
 * Format an array of genotype/file objects into an HTML string for display.
 * @param {Array} genotypes
 * @returns {string}
 */
function formatGenotypes(genotypes) {
	if (!Array.isArray(genotypes) || !genotypes.length) return "-";
	return genotypes
		.map((g) => {
			const name = g.filename ?? g.file ?? g.download_url ?? g.filetype ?? "(file)";
			const type = g.filetype ?? "";
			return `${escapeHtml$1(name)} ${type ? `(${escapeHtml$1(type)})` : ""}`;
		})
		.join("<br>");
}

/**
 * sanitizeKey(value)
 * Produce a lowercase alphanumeric underscore-only key suitable for element IDs.
 * @param {string} value
 * @returns {string}
 */
function sanitizeKey(value) {
	return String(value)
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "_")
		.replaceAll(/^_+|_+$/g, "");
}

/**
 * extractYear(item)
 * Extract a 4-digit year from common published/date fields on a participant.
 * @param {Object} item
 * @returns {string|null}
 */
function extractYear(item) {
	const pub = item.publishedDate ?? item.published_date ?? item.date ?? item.created ?? "";
	const s = String(pub ?? "");
	const m = s.match(/^(\d{4})/);
	if (m) return m[1];
	const d = new Date(s);
	if (!Number.isNaN(d.getFullYear()) && d.getFullYear() > 0) return String(d.getFullYear());
	return null;
}

/**
 * Populate the `participantsYearSelect` dropdown with available years.
 * @returns {void}
 */
function populateYearSelect() {
	const sel = document.getElementById('participantsYearSelect');
	if (!sel) return;
	const counts = new Map();
	participants.forEach((p) => {
		const y = extractYear(p);
		const key = y ?? 'Unknown';
		counts.set(key, (counts.get(key) || 0) + 1);
	});
	const years = Array.from(counts.keys()).filter(k => k !== 'Unknown').sort((a, b) => Number(b) - Number(a));
	const opts = [`<option value="">All Years (${participants.length} rows)</option>`].concat(years.map(y => `<option value="${y}">${y} (${counts.get(y)} rows)</option>`));
	if (counts.has('Unknown')) opts.push(`<option value="Unknown">Unknown (${counts.get('Unknown')} rows)</option>`);
	sel.innerHTML = opts.join('');
}

/**
 * Handler invoked when the year dropdown changes; filters participants and re-renders the table.
 * @param {string} selectedYear
 * @returns {void}
 */
window.onParticipantsYearChange = function onParticipantsYearChange(selectedYear) {
	const sel = document.getElementById('participantsYearSelect');
	const year = selectedYear ?? (sel && sel.value) ?? '';
	const list = year && year !== ''
		? participants.filter(p => (extractYear(p) ?? 'Unknown') === year)
		: participants;
	const key = sanitizeKey('participants') || 'participants';
	const yearLabel = year && year !== '' ? year : 'All Years';
	renderParticipantsTable(list, 'localUsersDiv', `Personal Genome Project Participants (${list.length}) - ${yearLabel}`, key);
};

/**
 * Render a paginated participants table with selection and pagination controls.
 * @param {Array<Object>} list - Array of participant objects to display.
 * @param {string} targetId - DOM element ID to render the table into.
 * @param {string} title - Title text to display above the table.
 * @param {string} key - Unique key used to construct control IDs.
 * @returns {void}
 */
function renderParticipantsTable(list, targetId, title, key) {
	const container = document.getElementById(targetId);
	if (!container) return;
	container.style.display = 'block';

	let currentPage = 1;
	const selectedIds = selectedUserIds; // Use module-level set

	const renderPage = () => {
		const totalPages = Math.max(1, Math.ceil(list.length / ROWS_PER_PAGE));
		currentPage = Math.min(Math.max(1, currentPage), totalPages);
		const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
		const pageItems = list.slice(startIndex, startIndex + ROWS_PER_PAGE);

		const rowsHtml = pageItems.map((p, i) => {
			const rawId = p.id ?? p.participant_id ?? p.name ?? `user_${startIndex + i + 1}`;
			const pid = escapeHtml$1(String(rawId));
			const rawName = String(p.name ?? "");
			const name = escapeHtml$1(rawName);
			const displayName = escapeHtml$1(rawName.length > 14 ? rawName.slice(0, 14) + '...' : rawName);
			const genos = p.genotypes ?? [];
			genos.length;
			formatGenotypes(genos);

			/**
			 * getPublishedDate(item)
			 * Return a published/date string from an item using common property names.
			 * @param {Object} item
			 * @returns {string}
			 */
			function getPublishedDate(item) {
				return item.publishedDate ?? item.published_date ?? item.date ?? item.created ?? "-";
			}

			/**
			 * getDownloadUrl(item)
			 * Prefer known download URL fields (downloadUrl, download_url, url, profileUrl)
			 * and fall back to genotype file locations.
			 * @param {Object} item
			 * @returns {string|null}
			 */
			function getDownloadUrl(item) {
				return item.downloadUrl ?? item.download_url ?? item.url ?? (item.genotypes && item.genotypes[0] && (item.genotypes[0].download_url ?? item.genotypes[0].file)) ?? item.profileUrl ?? null;
			}

			const published = escapeHtml$1(String(getPublishedDate(p)));

			/**
			 * getProfileUrl(item)
			 * Extract a profile URL from common candidate properties.
			 * @param {Object} item
			 * @returns {string|null}
			 */
			function getProfileUrl(item) {
				return item.profileUrl ?? item.profile_url ?? null;
			}

			const profileUrl = getProfileUrl(p);
			const profileHtml = profileUrl ? `<a href="${escapeHtml$1(profileUrl)}" target="_blank" rel="noopener">View</a>` : "-";

			const downloadUrl = getDownloadUrl(p);
			const downloadHtml = downloadUrl ? `<a href="${escapeHtml$1(downloadUrl)}" target="_blank" rel="noopener">${escapeHtml$1(downloadUrl)}</a>` : "-";
			const checked = selectedIds.has(String(rawId)) ? 'checked' : '';

			return `
				<tr>
					<td>${startIndex + i + 1}</td>
					<td><input class="participant-select" type="checkbox" value="${escapeHtml$1(String(rawId))}" ${checked} /></td>
					<td>${pid}</td>
					<td title="${name}">${displayName}</td>
					<td>${published}</td>
					<td>${profileHtml}</td>
					<td>${downloadHtml}</td>
				</tr>
			`;
		}).join('');

		container.innerHTML = `
			<div class="d-flex justify-content-between align-items-center my-2">
				<h5 class="mb-0">${escapeHtml$1(title)}</h5>
				<div>
					<label class="form-check-label me-2" for="selectAllParticipants_${key}">Select all</label>
					<input class="form-check-input" id="selectAllParticipants_${key}" type="checkbox" ${list.length > 0 && selectedIds.size === list.length ? 'checked' : ''} />
				</div>
			</div>
			<div class="table-responsive">
				<table class="table table-sm table-striped table-bordered align-middle">
					<thead class="table-dark">
						<tr>
							<th>#</th>
							<th>Select</th>
							<th>Participant ID</th>
							<th>Name</th>
							<th>Published Date</th>
							<th>Profile</th>
							<th>Download URL</th>
						</tr>
					</thead>
					<tbody>
						${rowsHtml}
					</tbody>
				</table>
			</div>
			<div class="d-flex justify-content-between align-items-center mt-2">
			<div id="selectedParticipantsSummary_${key}" class="small text-muted">Selected: ${selectedIds.size} / ${MAX_SELECTION}</div>
				<div class="d-flex align-items-center gap-2">
					<button id="prevPage_${key}" class="btn btn-sm btn-outline-secondary" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
					<span id="pageInfo_${key}" class="small text-muted">Page ${currentPage} of ${totalPages}</span>
					<button id="nextPage_${key}" class="btn btn-sm btn-outline-secondary" ${currentPage >= totalPages ? 'disabled' : ''}>Next</button>
				</div>
			</div>
		`;

		const selectAll = document.getElementById(`selectAllParticipants_${key}`);
		// update external title element (placed above the dropdown)
		const titleEl = document.getElementById('participantsTitle');
		if (titleEl) titleEl.textContent = title;
		const rowCheckboxes = Array.from(container.querySelectorAll('.participant-select'));
		const prevPageBtn = document.getElementById(`prevPage_${key}`);
		const nextPageBtn = document.getElementById(`nextPage_${key}`);

		if (selectAll) {
			selectAll.addEventListener('change', () => {
				if (selectAll.checked) {
					// Limit to first MAX_SELECTION items
					list.slice(0, MAX_SELECTION).forEach((it) => {
						const id = String(it.id ?? it.participant_id ?? it.name);
						selectedIds.add(id);
						selectedUsersMap.set(id, it);
					});
					if (list.length > MAX_SELECTION) {
						alert(`Selection limited to ${MAX_SELECTION} items.`);
					}
				} else {
					selectedIds.clear();
					selectedUsersMap.clear();
				}
				renderPage();
				updateGlobalSelectionCount();
			});
		}

		rowCheckboxes.forEach((cb) => {
			const user = list.find(it => String(it.id ?? it.participant_id ?? it.name) === cb.value);
			cb.addEventListener('change', () => {
				if (cb.checked) {
					if (selectedIds.size >= MAX_SELECTION) {
						cb.checked = false;
						alert(`Maximum ${MAX_SELECTION} selections allowed.`);
						return;
					}
					selectedIds.add(cb.value);
					if (user) selectedUsersMap.set(cb.value, user);
				} else {
					selectedIds.delete(cb.value);
					selectedUsersMap.delete(cb.value);
				}
				if (selectAll) selectAll.checked = list.length > 0 && selectedIds.size === Math.min(list.length, MAX_SELECTION);
				const summary = document.getElementById(`selectedParticipantsSummary_${key}`);
				if (summary) summary.textContent = `Selected: ${selectedIds.size} / ${MAX_SELECTION}`;
				updateGlobalSelectionCount();

			});
		});

		if (prevPageBtn) prevPageBtn.addEventListener('click', () => { currentPage -= 1; renderPage(); });
		if (nextPageBtn) nextPageBtn.addEventListener('click', () => { currentPage += 1; renderPage(); });
	};

	renderPage();
}

/**
 * renderLocalUsers()
 * Public entry point that renders the participants table (honoring any active year filter).
 */
window.renderLocalUsers = () => {
	const key = sanitizeKey('participants') || 'participants';
	const sel = document.getElementById('participantsYearSelect');
	const year = sel?.value ?? '';
	const list = year && year !== '' ? participants.filter(p => (extractYear(p) ?? 'Unknown') === year) : participants;
	const yearLabel = year && year !== '' ? year : 'All Years';
	renderParticipantsTable(list, 'localUsersDiv', `Personal Genome Project Participants (${list.length}) - ${yearLabel}`, key);
};

// If the LocalData tab is already visible on load, render immediately
if (document.getElementById("LocalData")?.style.display === "block") {
	window.renderLocalUsers();
}

// populate year select after definitions
populateYearSelect();

console.log("calculatePrs.js loaded");

/** Check if online */
function isOnline() {
	return navigator.onLine;
}

/** Fallback local users (first 2 from data folder) */
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
	}
];

/** Fallback PGS scores (sample entries) */
const FALLBACK_SCORES = [
	{
		id: "PGS000001",
		name: "PRS77_BC",
		trait_reported: "Breast cancer",
		variants_number: 77,
		date_release: "2019-10-14"
	},
	{
		id: "PGS000004",
		name: "PRS313_BC",
		trait_reported: "breast canrcinoma",
		variants_number: 313,
		date_release: "2019-10-14"
	}
];

/** Escape HTML special characters */
function escapeHtml(str) {
	const div = document.createElement("div");
	div.textContent = str ?? "";
	return div.innerHTML;
}

/**
 * Calculate PRS using the currently selected PGS IDs.
 * Called when the user clicks the "Fetch Files" button.
 * Uses fallback data when offline.
 */
async function fetchScores() {
	const statusEl = document.getElementById("prsDiv");
	const resultsDiv = document.getElementById("prsAction");

	try {
		let selectedIds = window.getSelectedPgsIds?.() ?? [];
		let selectedScores = window.getSelectedScores?.() ?? [];
		
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
			if (statusEl) statusEl.textContent = "Loading scoring files...";
			try {
				const pgsTxts = await getTxts(selectedIds);
				console.log("PGS txts:", pgsTxts);
				if (statusEl) statusEl.textContent = `Loaded ${pgsTxts.length} scoring file(s).`;
				
				// Get user file paths and call PRS_fun
				const userTxts = window.getSelectedUsers?.()?.map(u => u.genotypes?.[0]?.download_url ?? u.genotypes?.[0]?.file).filter(Boolean) ?? [];
				if (userTxts.length > 0 && pgsTxts.length > 0) {
					const prsResults = PRS_fun(userTxts, pgsTxts);
					console.log("PRS results:", prsResults);
				}
			} catch (fetchErr) {
				console.warn("Failed to fetch scores, using fallback:", fetchErr);
				selectedScores = FALLBACK_SCORES;
				selectedIds = FALLBACK_SCORES.map(s => s.id);
				if (statusEl) statusEl.textContent = "Network error: using fallback scores.";
			}
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


/**
 * Fetch selected users and display them in a table.
 * Called when the user clicks a "Fetch Users" button.
 * Uses fallback data when offline.
 */
async function fetchUsers() {
	const statusEl = document.getElementById("prsDiv2");
	const resultsDiv = document.getElementById("prsAction2");

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

/**
 * Load fallback scores directly into the PRS table.
 */
function loadFallbackScores() {
	const statusEl = document.getElementById("prsDiv");
	const resultsDiv = document.getElementById("prsAction");
	
	const selectedScores = FALLBACK_SCORES;
	if (statusEl) statusEl.textContent = `Loaded ${selectedScores.length} fallback scoring file(s).`;
	
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

/**
 * Load fallback users directly into the users table.
 */
function loadFallbackUsers() {
	const statusEl = document.getElementById("prsDiv2");
	const resultsDiv = document.getElementById("prsAction2");
	
	const selectedUsers = FALLBACK_USERS;
	if (statusEl) statusEl.textContent = `Loaded ${selectedUsers.length} fallback participant(s).`;
	
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
	
	console.log("Loaded fallback users:", FALLBACK_USERS);
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

// Default fallback paths (used when calling prs directly)
FALLBACK_USERS.map(u => u.genotypes[0]?.download_url ?? u.genotypes[0]?.file).filter(Boolean);

function prs(userTxts, pgsTxts) {
    let PRS = [];
    console.log("prs called with:", userTxts.length, "users,", pgsTxts.length, "PGS models");

    for (let i = 0; i < pgsTxts.length; i++) {
        console.log("---------------------------");
        console.log("Processing PGS model #", i, pgsTxts[i]?.id ?? pgsTxts[i]);

        for (let j = 0; j < userTxts.length; j++) {
            console.log("Processing user #", j, userTxts[j]);
            // TODO: Load and parse user genome data, then call Match2
            // let input = { "pgs": pgsTxts[i], "my23": parsedUserData }
            // let res = Match2(input)
            // PRS.push(res)
        }
    }

    return PRS;
}

window.prs = prs;

/**
 * Calculate PRS using loaded scores and users.
 * Triggered by the "Calculate PRS" button.
 */
// async function calculatePRS() {
//     const statusEl = document.getElementById("prsResultsStatus");
//     const resultsDiv = document.getElementById("prsResultsDiv");
    
//     if (statusEl) statusEl.textContent = "Calculating PRS...";
    
//     try {
//         // Get selected users
//         const selectedUsers = window.getSelectedUsers?.() ?? FALLBACK_USERS;
//         const userTxts = selectedUsers.map(u => u.genotypes?.[0]?.download_url ?? u.genotypes?.[0]?.file).filter(Boolean);
        
//         // Get selected PGS IDs
//         const selectedIds = window.getSelectedPgsIds?.() ?? FALLBACK_SCORES.map(s => s.id);
        
//         if (userTxts.length === 0) {
//             if (statusEl) statusEl.textContent = "No users loaded. Click 'Load Fallback Users' first.";
//             return;
//         }
//         if (selectedIds.length === 0) {
//             if (statusEl) statusEl.textContent = "No PGS scores loaded. Click 'Load Fallback Scores' first.";
//             return;
//         }
        
//         // Fetch PGS txt files
//         if (statusEl) statusEl.textContent = `Loading ${selectedIds.length} PGS file(s)...`;
//         const pgsTxts = await getTxts(selectedIds);
//         console.log("PGS txts for calculation:", pgsTxts);
        
//         // Run PRS calculation
//         if (statusEl) statusEl.textContent = `Calculating PRS for ${userTxts.length} user(s) x ${pgsTxts.length} model(s)...`;
//         const prsResults = PRS_fun(userTxts, pgsTxts);
//         console.log("PRS results:", prsResults);
        
//         if (statusEl) statusEl.textContent = `Completed! ${prsResults.length} result(s).`;
        
//         // Display results (placeholder for now)
//         if (resultsDiv) {
//             if (prsResults.length > 0) {
//                 resultsDiv.innerHTML = `<pre>${JSON.stringify(prsResults, null, 2)}</pre>`;
//             } else {
//                 resultsDiv.innerHTML = `<p class="text-muted">PRS calculation completed. Check console for details.</p>`;
//             }
//         }
        
//     } catch (err) {
//         console.error("calculatePRS error:", err);
//         if (statusEl) statusEl.textContent = `Error: ${err.message}`;
//     }
// }

// // Wire up Calculate PRS button
// const calculatePrsBtn = document.getElementById("calculatePrsBtn");
// if (calculatePrsBtn) {
//     calculatePrsBtn.addEventListener("click", calculatePRS);
// }

// window.calculatePRS = calculatePRS;
//# sourceMappingURL=app.mjs.map
