
import localforage from "localforage";


// load all traits (paginated) and log stats about them to console  
const BASE = "https://www.pgscatalog.org/rest";
const TRAIT_SUMMARY_KEY = "PGS_Catalog:trait-summary";

// ---- small helpers ----

export async function rawTraitArrayFromAPI({ pageSize = 50, maxPages = Infinity } = {}) {
  let offset = 0;
  let page = 0;
  const all = [];
  while (page < maxPages) {
	// console.log("rawTraitArrayFromAPI(), Fetching traits with pageSize:", pageSize, "maxPages:", maxPages);

    const url = `${BASE}/trait/all?format=json&limit=${pageSize}&offset=${offset}`;
	// console.log("rawTraitArrayFromAPI(), Requesting traits from URL:", url);
    // console.log(`traits****Requesting: ${url}`);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
    const data = await r.json();

    const results = Array.isArray(data) ? data : (data.results ?? []);
    if (!Array.isArray(results)) throw new Error("Unexpected trait response shape.");

    all.push(...results);
    page += 1;

    if (results.length === 0) break;
    if (!Array.isArray(data) && data.next == null && results.length < pageSize) break;

    offset += results.length;
	}
// console.log(`rawTraitArrayFromAPI(), Completed fetching traits. Total fetched: ${all.length}, all:`, all);
  return all;
}


async function saveTraitSummary(summary) {
	await localforage.setItem(TRAIT_SUMMARY_KEY, 
		//savedAt: new Date().toISOString(),
		summary
	);
}

async function getStoredTraitSummary() {
    // console.log("checking local cache for trait summary...");
	return localforage.getItem(TRAIT_SUMMARY_KEY);
}

function isCacheWithinMonths(savedAt, months = 3) {
	if (!savedAt) return false;
	const savedDate = new Date(savedAt);
	if (Number.isNaN(savedDate.getTime())) return false;

	const cutoff = new Date();
	cutoff.setMonth(cutoff.getMonth() - months);

	return savedDate >= cutoff;
}


// ---- main function to load trait stats, with caching ----

function computeSummary(traits) {//used in fetchDataAndRenderPlots()
	//const traits = await rawTraitArrayFromAPI({ pageSize: 200 });
	// console.log(" computeSummary(traits), Computing trait summary for traits:", traits.length);	
	const byCategory = new Map();
	const traitDataByCategory = new Map();
	const pgsIdsByCategory = new Map();

	const getAssociatedPgsIds = (trait) => {
		if (!trait || typeof trait !== "object") return [];

		if (Array.isArray(trait.associated_pgs_ids)) return trait.associated_pgs_ids;
		if (Array.isArray(trait.pgs_ids)) return trait.pgs_ids;

		if (Array.isArray(trait.associated_pgs)) {
			return trait.associated_pgs
				.map((item) => (typeof item === "string" ? item : item?.id ?? item?.pgs_id))
				.filter(Boolean);
		}
		if (Array.isArray(trait.scores)) {
			return trait.scores
				.map((item) => (typeof item === "string" ? item : item?.id ?? item?.pgs_id))
				.filter(Boolean);
		}

		return [];
	};

	for (const trait of traits) {
		// console.log("Processing trait:", trait);
		const categories = Array.isArray(trait?.trait_categories) && trait.trait_categories.length
			? trait.trait_categories
			: ["NR"];
		const associatedPgsIds = getAssociatedPgsIds(trait);
		// console.log(`Trait "${trait?.label ?? trait?.name ?? trait?.id}" categories:`, categories, "associated PGS IDs:", associatedPgsIds);
		for (const category of categories) {
			//console.log(`Incrementing category count for: ${category}`);	
			byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
			if (!traitDataByCategory.has(category)) {
				traitDataByCategory.set(category, []);
			}
			if (!pgsIdsByCategory.has(category)) {
				pgsIdsByCategory.set(category, new Set());
			}
			const categoryPgsSet = pgsIdsByCategory.get(category);
			for (const pgsId of associatedPgsIds) {
				categoryPgsSet.add(pgsId);
			}
			traitDataByCategory.get(category).push({
				id: trait?.id ?? trait?.efo_id ?? null,
				// label: trait?.label ?? trait?.trait_label ?? trait?.name ?? "NR",
				// efo_id: trait?.efo_id ?? null,
				data: trait, // include full traits for potential drill-down use
				// add other relevant fields as needed
			});
			//console.log(`Category "${category}" count is now: ${byCategory.get(category)}`);	
		}
	}

	const categories = [...byCategory.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([categoryName, count]) => ({
			category: categoryName,
			"traits_count": count,
			"pgs_ids": [...(pgsIdsByCategory.get(categoryName) ?? new Set())],
			"pgs_ids_count": pgsIdsByCategory.get(categoryName)?.size ?? 0,
			"traits": traitDataByCategory.get(categoryName) ?? [],
		}));
		//.slice(0, 10);

	// const totalAssociatedPgsIdsPerCategory = Object.fromEntries(
	// 	[...pgsIdsByCategory.entries()].map(([categoryName, pgsIdsSet]) => [
	// 		categoryName,
	// 		pgsIdsSet.size,
	// 	])
	// );

	return {
        traits: traits,
		// totaltraits: traits.length,
		// totalCategories: byCategory.size,
		// totalAssociatedPgsIdsPerCategory,
		categories,
	};
}
export async function fetchTraits() {
	// console.log("fetchTraits(), Loading fetchTraits()...");

	const cached = await getStoredTraitSummary();
	// console.log("fetchTraits(), Cached trait data available???", cached);

	try {
		if (cached?.summary && isCacheWithinMonths(cached.savedAt, 3)) {
			return {
				summary: cached.summary,
				source: "cache",
				savedAt: cached.savedAt,
			};
		}

		const traits = await rawTraitArrayFromAPI({ pageSize: 200 });
		// console.log("###############fetchTraits(), Raw traits fetched:", traits.length, traits);
		const summary = await computeSummary(traits);
		// console.log('------------------------------');
		// console.log("Total traits fetched:", traits.length);
		// console.log("Summary:", summary);

		const res = {
			summary: summary,
			source: "live",
			savedAt: new Date().toISOString(),
		};
		await saveTraitSummary(res);
		return res;
	} catch (error) {
		if (cached?.summary) {
			console.error(error);
			return {
				summary: cached.summary,
				source: "cache-fallback",
				savedAt: cached.savedAt,
				error,
			};
		}

		throw error;
	}
}

// Expose for dev console
if (typeof window !== "undefined") {
	//window.rawTraitArrayFromAPI = rawTraitArrayFromAPI;
	window.fetchTraits = fetchTraits;
}