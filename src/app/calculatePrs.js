import { getTxts } from "https://lorenasandoval88.github.io/get-pgscatalog-scores/dist/sdk.mjs";

/**
 * Calculate PRS using the currently selected PGS IDs.
 * Called when the user clicks the "Fetch Files" button.
 */
async function fetchScores() {
	const statusEl = document.getElementById("prsStatus");
	const resultsDiv = document.getElementById("scoreTxtsDiv");

	try {
		const selectedIds = window.getSelectedPgsIds?.() ?? [];
		console.log("Selected PGS IDs:", selectedIds);

		if (selectedIds.length === 0) {
			if (statusEl) statusEl.textContent = "Please select at least one scoring file.";
			return;
		}

		if (statusEl) statusEl.textContent = "Loading scoring files...";

		const pgsTxts = await getTxts(selectedIds);

		console.log("PGS txts:", pgsTxts);

		if (statusEl) statusEl.textContent = `Loaded ${pgsTxts.length} scoring file(s).`;

		if (resultsDiv) {
			resultsDiv.style.display = "block";
			resultsDiv.innerHTML = `<p class="text-success">Loaded ${pgsTxts.length} scoring file(s) for: ${selectedIds.join(", ")}</p>`;
		}

		// TODO: Add actual PRS calculation logic here

	} catch (err) {
		console.error("fetchScores error:", err);
		if (statusEl) statusEl.textContent = `Error: ${err.message}`;
	}
}

// Wire up the button
const calculateBtn = document.getElementById("fetchScoresBtn");
if (calculateBtn) {
	calculateBtn.addEventListener("click", fetchScores);
}

window.fetchScores = fetchScores;