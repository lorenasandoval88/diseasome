// const data = await loadScores();
// const variantSubset30to70 = (data.scores ?? []).filter((score) => {
// 	const variants = Number(score?.variants_number);
// 	return Number.isFinite(variants) && variants >= 30 && variants <= 70;
// });
// console.log("Scores with variants_number between 30 and 70:", variantSubset30to70.length);
// console.log("Subset sample (first 20):", variantSubset30to70.slice(0, 20));
import { loadScores,localforage } from "https://lorenasandoval88.github.io/get-pgscatalog-polygenic-scores/sdk.js";
const data = await loadScores();
const variantSubset30to70 = (data.scores ?? []).filter((score) => {
	const variants = Number(score?.variants_number);
	return Number.isFinite(variants) && variants >= 30 && variants <= 70;
});
console.log("Scores with variants_number between 30 and 70:", variantSubset30to70.length);
console.log("Subset sample (first 20):", variantSubset30to70.slice(0, 20));
