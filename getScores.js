// const data = await loadScores();
// const variantSubset30to40 = (data.scores ?? []).filter((score) => {
// 	const variants = Number(score?.variants_number);
// 	return Number.isFinite(variants) && variants >= 30 && variants <= 40;
// });
// console.log("Scores with variants_number between 30 and 40:", variantSubset30to40.length);
// console.log("Subset sample (first 20):", variantSubset30to40.slice(0, 20));
import { loadScores } from "https://lorenasandoval88.github.io/get-pgscatalog-polygenic-scores/dist/sdk.mjs";
const data = await loadScores();
const variantSubset30to40 = (data.scores ?? []).filter((score) => {
	const variants = Number(score?.variants_number);
	return Number.isFinite(variants) && variants >= 30 && variants <= 40;
}).sort((a, b) => {
	const traitA = (a?.trait_reported ?? "").toString();
	const traitB = (b?.trait_reported ?? "").toString();
	const traitCompare = traitA.localeCompare(traitB);
	if (traitCompare !== 0) return traitCompare;
	const idA = (a?.id ?? "").toString();
	const idB = (b?.id ?? "").toString();
	return idA.localeCompare(idB);
});
const variantSubset30to315BreastCancer = (data.scores ?? []).filter((score) => {
	const variants = Number(score?.variants_number);
	const trait = (score?.trait_reported ?? "").toString().toLowerCase();
	return Number.isFinite(variants) && variants >= 30 && variants <= 315 && trait.includes("breast cancer");
}).sort((a, b) => {
	const traitA = (a?.trait_reported ?? "").toString();
	const traitB = (b?.trait_reported ?? "").toString();
	const traitCompare = traitA.localeCompare(traitB);
	if (traitCompare !== 0) return traitCompare;
	const idA = (a?.id ?? "").toString();
	const idB = (b?.id ?? "").toString();
	return idA.localeCompare(idB);
});
console.log("Scores with variants_number between 30 and 40:", variantSubset30to40.length);
console.log("Subset sample (first 20):", variantSubset30to40.slice(0, 20));
console.log("Breast Cancer scores with variants_number between 30 and 315:", variantSubset30to315BreastCancer.length);

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

	const rowsHtml = scores
		.map((score, index) => {
			const pgsId = escapeHtml(score?.id ?? "");
			const pgsName = escapeHtml(score?.name ?? "");
			const trait = escapeHtml(score?.trait_reported ?? "");
			const variants = escapeHtml(score?.variants_number ?? "");
			const date = escapeHtml(score?.date_release ?? "");

			return `
				<tr>
					<td>${index + 1}</td>
					<td><input class="pgs-select" type="checkbox" value="${pgsId}" /></td>
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
				<input class="form-check-input" id="selectAllPgs_${key}" type="checkbox" />
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
		<div id="selectedPgsSummary_${key}" class="small text-muted">Selected: 0</div>
	`;

	const selectAll = document.getElementById(`selectAllPgs_${key}`);
	const rowCheckboxes = Array.from(scoresDiv.querySelectorAll(".pgs-select"));
	const selectedPgsSummary = document.getElementById(`selectedPgsSummary_${key}`);

	const updateSelectedSummary = () => {
		const selectedIds = rowCheckboxes.filter((x) => x.checked).map((x) => x.value);
		if (selectedPgsSummary) {
			selectedPgsSummary.textContent = `Selected: ${selectedIds.length}`;
		}
	};

	if (selectAll) {
		selectAll.addEventListener("change", () => {
			rowCheckboxes.forEach((cb) => {
				cb.checked = selectAll.checked;
			});
			updateSelectedSummary();
		});
	}

	rowCheckboxes.forEach((cb) => {
		cb.addEventListener("change", () => {
			if (selectAll) {
				selectAll.checked = rowCheckboxes.length > 0 && rowCheckboxes.every((x) => x.checked);
			}
			updateSelectedSummary();
		});
	});
}

renderPgsTable(variantSubset30to40, "scoresDiv", "PGS files (30-40 variants)", "3040");
renderPgsTable(variantSubset30to315BreastCancer, "scoresDiv2", "PGS files (30-315 variants) Breast Cancer", "30315bc");
