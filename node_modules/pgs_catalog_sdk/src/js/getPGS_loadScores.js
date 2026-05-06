import localforage from "localforage";

const PGS_BASE = "https://www.pgscatalog.org/rest";

const ALL_SCORE_SUMMARY_KEY = "PGS_Catalog:all-score-summary"; //fetchAllScores() & fetchSomeScores() uses this key to cache the full list of scores and their summary, which fetchSomeScores() can then use to source individual scores by ID without needing to fetch from network if cache is valid. Also used as source for getScoresPerTrait() / getScoresPerCategory() to link traits or categories to their specific scores and variants info, rather than relying on the more limited topTraits from the all-scores summary.
const TRAIT_SUMMARY_KEY = "PGS_Catalog:trait-summary"; // needed in getScoresPerTrait() and getScoresPerCategory()
const SCORES_PER_TRAIT_SUMMARY_KEY = "PGS_Catalog:scores-per-trait-summary"; // needed in getScoresPerTrait()
const SCORES_PER_CATEGORY_SUMMARY_KEY = "PGS_Catalog:scores-per-category-summary"; // needed in getScoresPerCategory()

function quantile(sorted, q) {
	if (!sorted.length) return null;
	const pos = (sorted.length - 1) * q;
	const base = Math.floor(pos);
	const rest = pos - base;
	if (sorted[base + 1] === undefined) return sorted[base];
	return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

async function saveScoreSummary(results, key = ALL_SCORE_SUMMARY_KEY) {
	if (!localforage) return;
	await localforage.setItem(key, {
		savedAt: new Date().toISOString(),
		summary: results.summary,
		scores: results.scores,
	});
}

async function getStoredScoreSummary(key = ALL_SCORE_SUMMARY_KEY) {
    // console.log("checking local cache for score summary...");
	if (!localforage) return null;
	return localforage.getItem(key);
}

function isCacheWithinMonths(savedAt, months = 3) {
	if (!savedAt) return false;
	const savedDate = new Date(savedAt);
	if (Number.isNaN(savedDate.getTime())) return false;

	const cutoff = new Date();
	cutoff.setMonth(cutoff.getMonth() - months);
	return savedDate >= cutoff;
}

function getFetchAllScoresErrorMessage(error, context = {}) {
	const { page, offset, pageSize, url, status } = context;
	const locationParts = [];
	if (page != null) locationParts.push(`page ${page}`);
	if (offset != null) locationParts.push(`offset ${offset}`);
	if (pageSize != null) locationParts.push(`page size ${pageSize}`);
	const locationText = locationParts.length ? ` PGS API failed at ${locationParts.join(" / ")}.` : "";
	const urlText = url ? ` Request URL: ${url}` : "";
	const retryText = " Try a smaller page size or use a server-side proxy.";

	if (!error) {
		return `Unable to load all PGS scores from the PGS Catalog.${locationText}${retryText}${urlText}`;
	}

	const message = String(error?.message ?? error);
	if (
		error?.name === "TypeError"
		|| /failed to fetch/i.test(message)
		|| /networkerror/i.test(message)
		|| /load failed/i.test(message)
		|| /cors/i.test(message)
	) {
		return `Unable to load all PGS scores from the PGS Catalog.${locationText} This may be due to a network issue, a CORS restriction, or the PGS API being temporarily unavailable.${retryText}${urlText}`;
	}

	if (status != null) {
		return `Unable to load all PGS scores from the PGS Catalog.${locationText} The PGS API returned HTTP ${status}.${retryText}${urlText}`;
	}

	return `Unable to load all PGS scores from the PGS Catalog.${locationText} ${message}.${retryText}${urlText}`;
}

function computeSummary(scores) {//Total scores fetched: 5296,Unique traits: 1,727
	/**
	 * Build aggregate score summary metrics and trait-level mappings.
	 * @param {object[]} scores
	 * @returns {{
	 * totalScores:number,
	 * uniqueTraits:number,
	 * variants:{min:number|null,max:number|null,mean:number|null,median:number|null},
	 * topTraits:Array,
	 * traitToPgsIds:Object,
	 * traitVariantRange:Object,
	 * releaseYears:Array
	 * }}
	 */
	const byTrait = new Map();
	const byTraitPgsIds = new Map();
	const byTraitVariants = new Map();
	const byReleaseYear = new Map();

	const variants = scores
		.map((item) => Number(item.variants_number))
		.filter((v) => Number.isFinite(v))
		.sort((a, b) => a - b);

	for (const score of scores) {
		const trait = score.trait_reported ?? "NR";
		const scoreVariants = Number(score?.variants_number);
		// console.log(`Processing score ID ${score.id}, trait_reported: ${trait}`);
		byTrait.set(trait, (byTrait.get(trait) ?? 0) + 1);
		if (!byTraitPgsIds.has(trait)) {
			byTraitPgsIds.set(trait, new Set());
		}
		if (score?.id) {
			byTraitPgsIds.get(trait).add(score.id);
		}
		if (Number.isFinite(scoreVariants)) {
			if (!byTraitVariants.has(trait)) {
				byTraitVariants.set(trait, {
					min: scoreVariants,
					max: scoreVariants,
				});
			} else {
				const current = byTraitVariants.get(trait);
				current.min = Math.min(current.min, scoreVariants);
				current.max = Math.max(current.max, scoreVariants);
			}
		}

		const yearMatch = (score.date_release ?? "").match(/^(\d{4})/);
		if (yearMatch) {
			const y = yearMatch[1];
			byReleaseYear.set(y, (byReleaseYear.get(y) ?? 0) + 1);
		}
	}

	const topTraits = [...byTrait.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 50);

	const traitToPgsIds = Object.fromEntries(
		[...byTrait.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([trait]) => [trait, [...(byTraitPgsIds.get(trait) ?? new Set())]])
	);

	const releaseYears = [...byReleaseYear.entries()]
		.sort((a, b) => Number(a[0]) - Number(b[0]));

	const traitVariantRange = Object.fromEntries(
		[...byTraitVariants.entries()].map(([trait, range]) => [
			trait,
			{ min: range.min, max: range.max },
		])
	);

	// console.log("topTraits:", [...byTrait.entries()].sort((a, b) => b[1] - a[1]));
	//console.log("traitToPgsIds:", traitToPgsIds);
	
		return {
		totalScores: scores.length,
		uniqueTraits: byTrait.size,
		variants: {
			min: variants[0] ?? null,
			max: variants[variants.length - 1] ?? null,
			mean: variants.length ? variants.reduce((sum, n) => sum + n, 0) / variants.length : null,
			median: quantile(variants, 0.5),
		},
		topTraits,
		traitToPgsIds,
		traitVariantRange,
		releaseYears,
	};
}
function computeSummary2(scores) {
	/**
	 * Build aggregate score summary metrics and trait-level mappings.
	 * Includes traitToPgsData for full score objects keyed by PGS ID.
	 * @param {object[]} scores
	 * @returns {{
	 *   totalScores: number,
	 *   uniqueTraits: number,
	 *   variants: {min: number|null, max: number|null, mean: number|null, median: number|null},
	 *   top10Traits: Array,
	 *   pgs_ids: Object,
	 *   traitToPgsData: Object,
	 *   traitVariantRange: Object,
	 *   releaseYears: Array
	 * }}
	 */
	//console.log("computeSummary2(): Computing summary for scores...");
	const byTrait = new Map();
	const byTraitPgsIds = new Map();
	const byTraitPgsData = new Map();
	const byTraitVariants = new Map();
	const byReleaseYear = new Map();

	const variants = scores
		.map((item) => Number(item.variants_number))
		.filter((v) => Number.isFinite(v))
		.sort((a, b) => a - b);

	for (const score of scores) {
		const trait = score.trait_reported ?? "NR";
		const scoreVariants = Number(score?.variants_number);
		const scoreId = score?.id;

		// Count scores per trait
		byTrait.set(trait, (byTrait.get(trait) ?? 0) + 1);

		// Track PGS IDs and full score data per trait
		if (scoreId != null && scoreId !== "") {
			if (!byTraitPgsIds.has(trait)) {
				byTraitPgsIds.set(trait, new Set());
			}
			byTraitPgsIds.get(trait).add(String(scoreId));

			if (!byTraitPgsData.has(trait)) {
				byTraitPgsData.set(trait, {});
			}
			byTraitPgsData.get(trait)[String(scoreId)] = score;
		}

		// Track variant ranges per trait
		if (Number.isFinite(scoreVariants)) {
			if (!byTraitVariants.has(trait)) {
				byTraitVariants.set(trait, {
					min: scoreVariants,
					max: scoreVariants,
				});
			} else {
				const current = byTraitVariants.get(trait);
				current.min = Math.min(current.min, scoreVariants);
				current.max = Math.max(current.max, scoreVariants);
			}
		}

		// Track release years
		const yearMatch = (score.date_release ?? "").match(/^(\d{4})/);
		if (yearMatch) {
			const y = yearMatch[1];
			byReleaseYear.set(y, (byReleaseYear.get(y) ?? 0) + 1);
		}
	}

	// Sort traits by score count (descending)
	const sortedTraitEntries = [...byTrait.entries()].sort((a, b) => b[1] - a[1]);

	const top10Traits = sortedTraitEntries.slice(0, 10);

	const pgs_ids = Object.fromEntries(
		sortedTraitEntries.map(([trait]) => [
			trait,
			[...(byTraitPgsIds.get(trait) ?? new Set())]
		])
	);

	const traitToPgsData = Object.fromEntries(
		sortedTraitEntries.map(([trait]) => [
			trait,
			byTraitPgsData.get(trait) ?? {}
		])
	);

	const releaseYears = [...byReleaseYear.entries()]
		.sort((a, b) => Number(a[0]) - Number(b[0]));

	const traitVariantRange = Object.fromEntries(
		[...byTraitVariants.entries()].map(([trait, range]) => [
			trait,
			{ min: range.min, max: range.max },
		])
	);

	return traitToPgsData
}


function getVariantsRangeFromScores(scores = []) {
	const variants = scores
		.map((score) => Number(score?.variants_number))
		.filter((value) => Number.isFinite(value));

	if (!variants.length) {
		return { min: "NR", max: "NR" };
	}

	return {
		min: Math.min(...variants),
		max: Math.max(...variants),
	};
}

export function buildTopTraitsFromScoresPerTrait(scoresPerTraitPayload, maxTraits = 50) {
	/**
	 * Convert scores-per-trait payload into sorted plotting tuples.
	 * @param {object} scoresPerTraitPayload
	 * @param {number} [maxTraits=50]
	 * @returns {Array<[string, number, number|string, number|string]>}
	 */
	const entries = Object.entries(scoresPerTraitPayload?.scoresPerTrait ?? {});
	return entries
		.map(([traitName, traitValue]) => {
			const scoreCount = Array.isArray(traitValue?.scores)
				? traitValue.scores.length
				: (Array.isArray(traitValue?.pgs_ids) ? traitValue.pgs_ids.length : 0);
			const variantsRange = getVariantsRangeFromScores(traitValue?.scores ?? []);
			return [traitName, scoreCount, variantsRange.min, variantsRange.max];
		})
		.sort((a, b) => b[1] - a[1])
		.slice(0, maxTraits);
}

export function buildTopCategoriesFromScoresPerCategory(scoresPerCategoryPayload) {
	/**
	 * Convert scores-per-category payload into sorted plotting tuples.
	 * No category limit is applied.
	 * @param {object} scoresPerCategoryPayload
	 * @returns {Array<[string, number, number|string, number|string]>}
	 */
	const entries = Object.entries(scoresPerCategoryPayload?.scoresPerCategory ?? {});
	return entries
		.map(([categoryName, categoryValue]) => {
			const scoreCount = Array.isArray(categoryValue?.scores)
				? categoryValue.scores.length
				: (Array.isArray(categoryValue?.pgs_ids) ? categoryValue.pgs_ids.length : 0);
			const variantsRange = getVariantsRangeFromScores(categoryValue?.scores ?? []);
			return [categoryName, scoreCount, variantsRange.min, variantsRange.max];
		})
		.sort((a, b) => b[1] - a[1]);
}



// ---- core: fetch all scores (paginated) ---- total: 5298 as of 2024-06-20
// Rate-limited - Includes a 200ms delay between requests for safety
  // REST docs indicate paginated responses; default is 50 per page. :contentReference[oaicite:4]{index=4}
export async function fetchAllApiScores({ pageSize = 200 } = {}) {
	/**
	 * Fetch all PGS scoring files from the paginated API.
	 * @param {{ pageSize?: number }} [options]
	 * @returns {Promise<object[]>}
	 */
	let offset = 0;
	const all = [];
	let page = 0;

	console.log(`loading all scores from paginated API with page size ${pageSize}...`);

	while (true) {
		page += 1;
		const url = `${PGS_BASE}/score/all?format=json&limit=${pageSize}&offset=${offset}`;
		// console.log(`[fetchAllScores] page ${page} request: ${url}`);
		let response;
		try {
			response = await fetch(url);
		} catch (error) {
			throw new Error(getFetchAllScoresErrorMessage(error, {
				page,
				offset,
				pageSize,
				url,
			}));
		}
		if (!response.ok) {
			throw new Error(getFetchAllScoresErrorMessage(null, {
				page,
				offset,
				pageSize,
				url,
				status: response.status,
			}));
		}
		const data = await response.json();

		const results = Array.isArray(data) ? data : (data.results ?? []);
		if (!Array.isArray(results)) throw new Error("Unexpected response format from PGS API.");

		// console.log(	`[fetchAllApiScores] page ${page} received=${results.length} total_so_far=${all.length + results.length}`
		//);

		all.push(...results);

		if (results.length === 0) {
			// console.log(`[fetchAllApiScores] stop: empty page at page ${page}`);
			break;
		}
		if (!Array.isArray(data) && data.next == null && results.length < pageSize) {
			// console.log(`[fetchAllApiScores] stop: last page reached at page ${page}`);
			break;
		}

		offset += results.length;
		// console.log(`[fetchAllApiScores] next offset=${offset}`);
		await new Promise((r) => setTimeout(r, 100)); // rate safety
	}
	// console.log(`[fetchAllApiScores] done total=${all.length}`);
	return all;
}

// ES6 MODULE: fetchAllScores() is the main function to get scores data and summary,
// using cache if available and valid, and falling back to cache if fetch fails.
// Higher-level app function
// Checks LocalForage cache first (3-month validity)
// If needed, calls fetchAllScores(), computes summary, caches result
// Returns { scores, summary } (not just raw array)
export async function fetchAllScores({ cache = true, pageSize = 200 } = {}) {
	/**
	 * Load full score dataset and summary.
	 * Uses all-score LocalForage cache when valid, otherwise fetches and refreshes cache.
	 * @param {{ cache?: boolean, pageSize?: number }} [options]
	 * @returns {Promise<{scores: object[], summary: object|null}>}
	 */
	// console.log("fetchAllScores():Loading scores function...");
	const results = {
		scores: [],
		summary: null,
		errorMessage: null,
		source: null,
		savedAt: null,
	};

	const cached = cache ? await getStoredScoreSummary(ALL_SCORE_SUMMARY_KEY) : null;

	try {
		if (cache && cached?.summary && isCacheWithinMonths(cached.savedAt, 3)) {
			results.summary = cached.summary;
			results.scores = cached.scores ?? [];
			results.source = "cache";
			results.savedAt = cached.savedAt ?? null;
	
			return results;
		}

		const scores = await fetchAllApiScores({ pageSize });

		const summary = computeSummary(scores);
		results.scores = scores;
		results.summary = summary;
		if (cache) {
			await saveScoreSummary(results, ALL_SCORE_SUMMARY_KEY);
		}
		results.source = "live";
		results.savedAt = new Date().toISOString();

		// console.log("Fetched scores data:", scores);
		return results;
	} catch (error) {
		results.errorMessage = getFetchAllScoresErrorMessage(error);
		if (cache && cached?.summary) {
			results.summary = cached.summary;
			results.scores = cached.scores ?? [];
			results.source = "cache-fallback";
			results.savedAt = cached.savedAt ?? null;
		} else {
			results.source = "unavailable";
		}
		console.error(error);
		return results;
	}
	//console.log("fetchAllScores():Final results:", results);
}


// ---- core: fetch some scores by ID (cache-aware) ----
// What it does:
// Accepts flexible input - Takes a single ID, an array of IDs, or multiple ID arguments
// Optional cache usage - Uses the all-score cache first when { cache: true }
// Fills cache misses - Fetches only missing IDs via fetchSomeAPIScores()
// Returns results - { scores, summary } for the requested IDs only
export async function fetchSomeScores(ids, ...args) {
	/**
	 * Load specific scores by ID.
	 * Prefers all-score cache and fetches only missing IDs when needed.
	 * @param {string|string[]} ids
	 * @param {...(string|{cache?: boolean})} args
	 * @returns {Promise<{scores: object[], summary: object|null}>}
	 */
	// console.log("fetchSomeScores():Loading scores function...");
	const results = {
		scores: [],
		summary: null,
	};

	let options = {};
	let moreIds = args;
	const maybeOptions = args.at(-1);
	if (
		maybeOptions
		&& typeof maybeOptions === "object"
		&& !Array.isArray(maybeOptions)
	) {
		options = maybeOptions;
		moreIds = args.slice(0, -1);
	}

	const { cache = true } = options;
	const rawIds = moreIds.length ? [ids, ...moreIds] : ids;
	const inputIds = Array.isArray(rawIds) ? rawIds : [rawIds];
	const requestedIds = [...new Set(
		inputIds
			.map((id) => String(id ?? "").trim())
			.filter(Boolean)
	)];
	const allScoresCached = cache ? await getStoredScoreSummary(ALL_SCORE_SUMMARY_KEY) : null;
	// console.log("fetchSomeScores():all-score cache present:", Boolean(allScoresCached?.scores?.length));

	try {
		if (cache && allScoresCached?.scores && isCacheWithinMonths(allScoresCached.savedAt, 3)) {
			const scoreById = new Map(
				allScoresCached.scores
					.filter((score) => score?.id != null)
					.map((score) => [String(score.id), score])
			);
			const scoresFromAllCache = requestedIds
				.map((id) => scoreById.get(id))
				.filter(Boolean);

			if (scoresFromAllCache.length === requestedIds.length) {
				results.scores = scoresFromAllCache;
				results.summary = computeSummary(scoresFromAllCache);
				return results;
			}

			const missingIds = requestedIds.filter((id) => !scoreById.has(id));
			console.warn("fetchSomeScores(): missing IDs in all-score cache, fetching:", missingIds);
			const fetchedMissingScores = await fetchSomeAPIScores(missingIds);
			const fetchedById = new Map(
				fetchedMissingScores
					.filter((score) => score?.id != null)
					.map((score) => [String(score.id), score])
			);

			results.scores = requestedIds
				.map((id) => scoreById.get(id) ?? fetchedById.get(id))
				.filter(Boolean);
			results.summary = computeSummary(results.scores);
			return results;
		}

		const scores = await fetchSomeAPIScores(requestedIds);
		const summary = computeSummary(scores);
		results.scores = scores;
		results.summary = summary;
		// console.log("------------------------------");
		// console.log("Total scores fetched:", scores.length);
		// console.log("Fetched scores data:", scores);
		// console.log("Summary:", summary);

		return results;
	} catch (error) {
		console.error(error);
		return results;
	}
}

// ---- core: fetch some scores by ID from the API ----
// What it does:
// Accepts flexible input - Takes a single ID or an array of IDs
// Normalizes & deduplicates - Converts inputs to strings, trims whitespace, and removes duplicates
// Fetches directly from the API - Calls https://www.pgscatalog.org/rest/score/{id} for each requested ID
// Rate-limited - Includes a 200ms delay between requests for safety
// Returns results - Array of fetched score objects; skips IDs that fail to fetch (with warnings)
export async function fetchSomeAPIScores(ids = []) {
	/**
	 * Fetch one or more PGS scoring files by ID.
	 * Accepts a single ID or array; normalizes and de-duplicates IDs.
	 * @param {string|string[]} ids
	 * @returns {Promise<object[]>}
	 */
	const inputIds = Array.isArray(ids) ? ids : [ids];
	const normalizedIds = [...new Set(
		inputIds
			.map((id) => String(id ?? "").trim())
			.filter(Boolean)
	)];
	const results = [];

	for (const id of normalizedIds) {
		const url = `${PGS_BASE}/score/${id}`;

		const response = await fetch(url);

		if (!response.ok) {
			console.warn(`Skipping ${id} (status ${response.status})`);
			continue;
		}

		const data = await response.json();
		results.push(data);
		await new Promise((r) => setTimeout(r, 200)); // rate safety
	}

	return results;
}
//---------------START OF TRAIT-SCORE AND CATEGORY-SCORE LINKING LOGIC------------------

function getAssociatedPgsIdsFromTrait(trait) {
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
}

function getTraitName(trait, index) {
	return trait?.label
		?? trait?.trait_label
		?? trait?.name
		?? trait?.trait_reported
		?? trait?.id
		?? `trait-${index + 1}`;
}

function normalizeCategoryEntries(entries) {
	if (!Array.isArray(entries)) return [];

	return entries.map((entry) => {
		if (Array.isArray(entry)) {
			return {
				category: entry[0],
				pgs_ids: Array.isArray(entry[2]) ? entry[2] : [],
			};
		}
		return entry;
	});
}

function getCategoryToPgsIdsFromTraitSummary(traitSummary) {
	const summary = traitSummary?.summary ?? traitSummary;
	const categoryToPgsIds = new Map();
	const categories = normalizeCategoryEntries(summary?.categories ?? summary?.topCategories);

	for (const entry of categories) {
		const categoryName = entry?.category ?? "NR";
		if (!categoryToPgsIds.has(categoryName)) {
			categoryToPgsIds.set(categoryName, new Set());
		}
		const idSet = categoryToPgsIds.get(categoryName);
		for (const pgsId of (entry?.pgs_ids ?? [])) {
			idSet.add(pgsId);
		}
	}

	return [...categoryToPgsIds.entries()]
		.map(([categoryName, idSet]) => [categoryName, [...idSet]])
		.filter(([, ids]) => ids.length > 0);
}

function getTraitToPgsIdsFromTraitSummary(traitSummary) {
	const summary = traitSummary?.summary ?? traitSummary;
	const traitToPgsIds = new Map();

	const traits = Array.isArray(summary?.traits) ? summary.traits : [];
	if (traits.length) {
		traits.forEach((trait, index) => {
			const traitName = getTraitName(trait, index);
			if (!traitToPgsIds.has(traitName)) {
				traitToPgsIds.set(traitName, new Set());
			}
			const idSet = traitToPgsIds.get(traitName);
			for (const pgsId of getAssociatedPgsIdsFromTrait(trait)) {
				idSet.add(pgsId);
			}
		});
	}

	if (!traitToPgsIds.size) {
		const categories = normalizeCategoryEntries(summary?.categories ?? summary?.topCategories);
		for (const entry of categories) {
			const traitName = entry?.category ?? "NR";
			if (!traitToPgsIds.has(traitName)) {
				traitToPgsIds.set(traitName, new Set());
			}
			const idSet = traitToPgsIds.get(traitName);
			for (const pgsId of (entry?.pgs_ids ?? [])) {
				idSet.add(pgsId);
			}
		}
	}

	return [...traitToPgsIds.entries()]
		.map(([traitName, idSet]) => [traitName, [...idSet]])
		.filter(([, ids]) => ids.length > 0);
}


// TRAITS/CATEGORIES are linked indirectly through the cached traitSummary object, using PGS IDs as the bridge.
export async function getScoresPerTrait({ forceRefresh = false, maxTraits = Infinity } = {}) {
	/**
	 * Build and cache trait -> scores mapping using trait-summary-linked PGS IDs.
	 * Optimized: loads all scores once and builds a Map lookup instead of calling fetchSomeScores() per trait.
	 * @param {{ forceRefresh?: boolean, maxTraits?: number }} [options]
	 * @returns {Promise<object>}
	 */
	// console.log("getScoresPerTrait():Loading scores per trait...");
	const cached = await getStoredScoreSummary(SCORES_PER_TRAIT_SUMMARY_KEY);
	if (!forceRefresh && cached?.scoresPerTrait) {
		return cached;
	}

	const traitSummary = await getStoredScoreSummary(TRAIT_SUMMARY_KEY);
	if (!traitSummary?.summary && !traitSummary?.categories) {
		throw new Error("Missing trait summary cache (TRAIT_SUMMARY_KEY). Call fetchTraits() first, or run fetchDataAndRenderPlots() to fetch and render trait data.");
	}

	// Load all scores once and build a Map for fast lookup
	const { scores: allScores } = await fetchAllScores();
	const scoreById = new Map(
		allScores
			.filter((score) => score?.id != null)
			.map((score) => [String(score.id), score])
	);

	const traitEntries = getTraitToPgsIdsFromTraitSummary(traitSummary);
	const scoresPerTrait = {};
	let processedTraits = 0;

	for (const [traitName, pgsIds] of traitEntries) {
		if (processedTraits >= maxTraits) break;
		// console.log(`Building getScoresPerTrait for trait ${traitName} with ${pgsIds.length} associated PGS IDs...`);
		const traitScores = pgsIds.map((id) => scoreById.get(String(id))).filter(Boolean);
		scoresPerTrait[traitName] = {
			pgs_ids: pgsIds,
			scores: traitScores,
			summary: computeSummary(traitScores),
		};
		processedTraits += 1;
	}

	const payload = {
		savedAt: new Date().toISOString(),
		sourceTraitSavedAt: traitSummary?.savedAt ?? null,
		processedTraits,
		totalTraitEntries: traitEntries.length,
		scoresPerTrait,
	};

	await localforage.setItem(SCORES_PER_TRAIT_SUMMARY_KEY, payload);
	return payload;
}

//---------------START OF CATEGORY-SCORE LINKING LOGIC------------------

// TODO error: 1700 traits vs 669. 
export async function getScoresPerCategory({ forceRefresh = false, maxCategories = Infinity } = {}) {
	/**
	 * Build and cache category -> scores mapping using trait-summary-linked PGS IDs.
	 * Optimized: loads all scores once and builds a Map lookup instead of calling fetchSomeScores() per category.
	 * @param {{ forceRefresh?: boolean, maxCategories?: number }} [options]
	 * @returns {Promise<object>}
	 */
	// console.log("getScoresPerCategory():Loading scores per category...");
	const cached = await getStoredScoreSummary(SCORES_PER_CATEGORY_SUMMARY_KEY);
	if (!forceRefresh && cached?.scoresPerCategory) {
		return cached;
	}

	const traitSummary = await getStoredScoreSummary(TRAIT_SUMMARY_KEY);
	if (!traitSummary?.summary && !traitSummary?.categories) {
		throw new Error("Missing trait summary cache (TRAIT_SUMMARY_KEY). Call fetchTraits() first, or run fetchDataAndRenderPlots() to fetch and render trait data.");
	}

	// Load all scores once and build a Map for fast lookup
	const { scores: allScores } = await fetchAllScores();
	const scoreById = new Map(
		allScores
			.filter((score) => score?.id != null)
			.map((score) => [String(score.id), score])
	);

	const categoryEntries = getCategoryToPgsIdsFromTraitSummary(traitSummary);
	const scoresPerCategory = {};
	let processedCategories = 0;

	for (const [categoryName, pgsIds] of categoryEntries) {
		if (processedCategories >= maxCategories) break;
		// console.log(`Building getScoresPerCategory for category: "${categoryName}" with ${pgsIds.length} associated PGS IDs...`);
		const categoryScores = pgsIds.map((id) => scoreById.get(String(id))).filter(Boolean);
		scoresPerCategory[categoryName] = {
			pgs_ids: pgsIds,
			scores: categoryScores,
			summary: computeSummary(categoryScores),
		};
		processedCategories += 1;
	}

	const payload = {
		savedAt: new Date().toISOString(),
		sourceTraitSavedAt: traitSummary?.savedAt ?? null,
		processedCategories,
		totalCategoryEntries: categoryEntries.length,
		scoresPerCategory,
	};

	await localforage.setItem(SCORES_PER_CATEGORY_SUMMARY_KEY, payload);
	return payload;
}
export async function getScoresPerCategory2({ forceRefresh = false } = {}) {
	/**
	 * Build and cache category -> scores mapping using trait-summary-linked PGS IDs.
	 * Optimized: loads all scores once and builds a Map lookup instead of calling fetchSomeScores() per category.
	 * @param {{ forceRefresh?: boolean }} [options]
	 * @returns {Promise<object>}
	 */
	// console.log("getScoresPerCategory2():Loading scores per category...");
	const cached = await getStoredScoreSummary("SCORES_PER_CATEGORY_SUMMARY_KEY_2");
	if (!forceRefresh && cached?.categories) {
		return cached;
	}

	const traitSummary = await getStoredScoreSummary(TRAIT_SUMMARY_KEY);
	if (!traitSummary?.summary && !traitSummary?.categories) {
		throw new Error("Missing trait summary cache (TRAIT_SUMMARY_KEY). Call fetchTraits() first, or run fetchDataAndRenderPlots() to fetch and render trait data.");
	}

	// Load all scores once and build a Map for fast lookup
	const { scores: allScores } = await fetchAllScores();
	const scoreById = new Map(
		allScores
			.filter((score) => score?.id != null)
			.map((score) => [String(score.id), score])
	);

	const categoryEntries = getCategoryToPgsIdsFromTraitSummary(traitSummary);
	const categories = {};

	for (const [categoryName, pgsIds] of categoryEntries) {
		// console.log(`Building getcategories for category: "${categoryName}" with ${pgsIds.length} associated PGS IDs...`);
		const categoryScores = pgsIds.map((id) => scoreById.get(String(id))).filter(Boolean);
		categories[categoryName] = {
			pgs_ids: pgsIds,
			totalScores: pgsIds.length,
			//scores: categoryScores,
			traits: computeSummary2(categoryScores),
		};
	}

	const payload = {
		savedAt: new Date().toISOString(),
		sourceTraitSavedAt: traitSummary?.savedAt ?? null,
		totalCategoryEntries: categoryEntries.length,
		categories,
	};

	await localforage.setItem("SCORES_PER_CATEGORY_SUMMARY_KEY_2", payload);
	return payload;
}
//---------------END OF CATEGORY-SCORE LINKING LOGIC------------------

// Expose for dev console
if (typeof window !== "undefined") {
	window.fetchSomeScores = fetchSomeScores;
	//window.fetchSomeAPIScores = fetchSomeAPIScores;
	window.fetchAllScores = fetchAllScores;
	window.getScoresPerTrait = getScoresPerTrait;
	window.getScoresPerCategory = getScoresPerCategory;
	//window.getScoresPerCategory2 = getScoresPerCategory2;
}