import { loadAllScores, getScoresPerTrait, getScoresPerCategory } from "https://lorenasandoval88.github.io/get-pgscatalog-scores/dist/sdk.mjs";

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
const scoresPerTrait = (data && data.scoresPerTrait) ? data.scoresPerTrait : {};
const VARIANT_MIN = 3;
const VARIANT_MAX = 1000;
const ALL_TRAITS_VALUE = "__all_traits__";
const ROWS_PER_PAGE = 50;

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

// Flatten values, filter by variant count, sort, and expose trait keys.
const allTraitScores = Array.from(traitScoresMap.values()).flat();
const filteredScores = allTraitScores
	.filter((score) => {
		const variantCount = Number(score?.variants_number ?? score?.score?.variants_number ?? 0);
		return Number.isFinite(variantCount) && variantCount >= VARIANT_MIN && variantCount <= VARIANT_MAX;
	})
	.sort(compareScores);

const traits = Array.from(traitScoresMap.keys()).sort((a, b) => a.localeCompare(b));
console.log(`displayScores.js: Loaded ${filteredScores.length} PGS entries across ${traits.length} traits`);

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
	const selectedIds = new Set();

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
				<div id="selectedPgsSummary_${key}" class="small text-muted">Selected: ${selectedIds.size}</div>
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
					scores.forEach((score) => selectedIds.add((score?.id ?? "").toString()));
				} else {
					selectedIds.clear();
				}
				renderPage();
			});
		}

		rowCheckboxes.forEach((cb) => {
			cb.addEventListener("change", () => {
				if (cb.checked) {
					selectedIds.add(cb.value);
				} else {
					selectedIds.delete(cb.value);
				}
				if (selectAll) {
					selectAll.checked = scores.length > 0 && selectedIds.size === scores.length;
				}
				const selectedPgsSummary = document.getElementById(`selectedPgsSummary_${key}`);
				if (selectedPgsSummary) {
					selectedPgsSummary.textContent = `Selected: ${selectedIds.size}`;
				}
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
 * Render the table for a specific trait category.
 * If `trait` equals the special ALL_TRAITS_VALUE, all scores are shown.
 * @param {string} trait - Trait name or special value to indicate all traits.
 */
function renderTrait(trait) {
	//console.log(`Rendering trait: ${trait}`);
	const isAllTraits = trait === ALL_TRAITS_VALUE;
	//console.log(`Is "All Traits" selected? ${isAllTraits}`);
	const scoresForTrait = isAllTraits ? filteredScores : (traitScoresMap.get(trait) ?? []);
	const key = isAllTraits ? "all_traits" : (sanitizeKey(trait) || "trait");
	const title = isAllTraits
		? `All Scoring files (${VARIANT_MIN}-${VARIANT_MAX} variants)`
		: `${trait} Scoring files (${VARIANT_MIN}-${VARIANT_MAX} variants)`;

	renderPgsTable(scoresForTrait, "scoresDiv", title, key);
}

/**
 * Global handler wired to the trait select control.
 * Validates the selection and triggers rendering for the chosen trait.
 * @param {string} selectedTrait - Value of the selected trait option.
 */
window.onPgsTraitChange = function onPgsTraitChange(selectedTrait) {
	if (!selectedTrait) return;
	if (selectedTrait !== ALL_TRAITS_VALUE && !traitScoresMap.has(selectedTrait)) return;
	renderTrait(selectedTrait);
};


// The DOM select element used for the trait/category dropdown.
const pgsSelect = document.getElementById("pgsDropDown");

if (pgsSelect) {
	// Prefer populating the dropdown from `scoresPerTrait` when available.
	if (Array.isArray(scoresPerTrait) && scoresPerTrait.length) {
		const allTraitsOption = `<option value="${ALL_TRAITS_VALUE}">All Scoring Files (${filteredScores.length}) of ${traitScoresMap.size}</option>`;
		const traitOptions = scoresPerTrait
			.map((entry) => {
				// support multiple entry shapes: string, { trait, count, scores }
				const traitName = typeof entry === 'string' ? entry : (entry.trait ?? entry.name ?? entry.category ?? '');
				const count = entry.count ?? (Array.isArray(entry.scores) ? entry.scores.length : (traitScoresMap.get(traitName)?.length ?? 0));
				return `<option value="${escapeHtml(traitName)}">${escapeHtml(traitName)} (${count})</option>`;
			})
			.join("");

		pgsSelect.innerHTML = `${allTraitsOption}${traitOptions}`;
		pgsSelect.value = ALL_TRAITS_VALUE;
		renderTrait(ALL_TRAITS_VALUE);
	} else if (!traits.length) {
		pgsSelect.innerHTML = `<option value="">No traits found (${VARIANT_MIN}-${VARIANT_MAX} variants)</option>`;
	} else {
		const allTraitsOption = `<option value="${ALL_TRAITS_VALUE}">Scoring Files (${filteredScores.length}) for all ${traitScoresMap.size} Traits</option>`;
		const traitOptions = traits
			.map((trait) => {
				const count = traitScoresMap.get(trait)?.length ?? 0;
				return `<option value="${escapeHtml(trait)}">${escapeHtml(trait)} (${count})</option>`;
			})
			.join("");

		pgsSelect.innerHTML = `${allTraitsOption}${traitOptions}`;
		pgsSelect.value = ALL_TRAITS_VALUE;
		renderTrait(ALL_TRAITS_VALUE);
	}
}
