import { loadTraits } from "https://lorenasandoval88.github.io/get-pgscatalog-polygenic-scores/dist/sdk.mjs";
const data = await loadTraits();

const VARIANT_MIN = 30;
const VARIANT_MAX = 60;
const ALL_TRAITS_VALUE = "__all_traits__";
const ROWS_PER_PAGE = 50;

function compareScores(a, b) {
	const traitA = (a?.trait_reported ?? "").toString();
	const traitB = (b?.trait_reported ?? "").toString();
	const traitCompare = traitA.localeCompare(traitB);
	if (traitCompare !== 0) return traitCompare;
	const idA = (a?.id ?? "").toString();
	const idB = (b?.id ?? "").toString();
	return idA.localeCompare(idB);
}

function getTraitName(score) {
	const trait = (score?.trait_reported ?? "").toString().trim();
	return trait || "Unspecified Trait";
}

const filteredScores = (data.scores ?? []).filter((score) => {
	const variants = Number(score?.variants_number);
	return Number.isFinite(variants) && variants >= VARIANT_MIN && variants <= VARIANT_MAX;
}).sort(compareScores);

const traitScoresMap = new Map();
filteredScores.forEach((score) => {
	const trait = getTraitName(score);
	if (!traitScoresMap.has(trait)) {
		traitScoresMap.set(trait, []);
	}
	traitScoresMap.get(trait).push(score);
});

const traits = Array.from(traitScoresMap.keys()).sort((a, b) => a.localeCompare(b));
// console.log(`Traits (${traits.length}) with variants ${VARIANT_MIN}-${VARIANT_MAX}:`, traits);

function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

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
				const pgsName = escapeHtml(score?.name ?? "");
				const trait = escapeHtml(score?.trait_reported ?? "");
				const variants = escapeHtml(score?.variants_number ?? "");
				const date = escapeHtml(score?.date_release ?? "");
				const checked = selectedIds.has(rawPgsId) ? "checked" : "";

				return `
					<tr>
						<td>${startIndex + index + 1}</td>
						<td><input class="pgs-select" type="checkbox" value="${pgsId}" ${checked} /></td>
						<td>${pgsId}</td>
						<td>${pgsName}</td>
						<td>${trait}</td>
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

function sanitizeKey(value) {
	return String(value ?? "")
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "_")
		.replaceAll(/^_+|_+$/g, "");
}

const categorySelect = document.getElementById("pgsCategorySelect");

function renderTrait(trait) {
	const isAllTraits = trait === ALL_TRAITS_VALUE;
	const scoresForTrait = isAllTraits ? filteredScores : (traitScoresMap.get(trait) ?? []);
	const key = isAllTraits ? "all_traits" : (sanitizeKey(trait) || "trait");
	const title = isAllTraits
		? `All Traits PGS files (${VARIANT_MIN}-${VARIANT_MAX} variants)`
		: `${trait} PGS files (${VARIANT_MIN}-${VARIANT_MAX} variants)`;

	renderPgsTable(scoresForTrait, "scoresDiv", title, key);
}

window.onPgsTraitChange = function onPgsTraitChange(selectedTrait) {
	if (!selectedTrait) return;
	if (selectedTrait !== ALL_TRAITS_VALUE && !traitScoresMap.has(selectedTrait)) return;
	renderTrait(selectedTrait);
};

if (categorySelect) {
	if (!traits.length) {
		categorySelect.innerHTML = `<option value="">No traits found (${VARIANT_MIN}-${VARIANT_MAX} variants)</option>`;
	} else {
		const allTraitsOption = `<option value="${ALL_TRAITS_VALUE}">All Traits (${filteredScores.length})</option>`;
		const traitOptions = traits
			.map((trait) => {
				const count = traitScoresMap.get(trait)?.length ?? 0;
				return `<option value="${escapeHtml(trait)}">${escapeHtml(trait)} (${count})</option>`;
			})
			.join("");

		categorySelect.innerHTML = `${allTraitsOption}${traitOptions}`;
		categorySelect.value = ALL_TRAITS_VALUE;
		renderTrait(ALL_TRAITS_VALUE);
	}
}
