import { getTxts} from "https://lorenasandoval88.github.io/get-pgscatalog-scores/dist/sdk.mjs";

// Get scoring files filtered by selected PGS IDs from displayScores
const selectedIds = window.getSelectedPgsIds?.() ?? [];
    console.log("Selected PGS IDs:", selectedIds);

const allTxts = await getTxts();
const pgsTxts = selectedIds.length > 0
	? allTxts.filter((txt) => selectedIds.includes(txt.id ?? txt.pgs_id))
	: allTxts;

    console.log("All PGS txts:", allTxts);
    console.log("Filtered PGS txts:", pgsTxts);