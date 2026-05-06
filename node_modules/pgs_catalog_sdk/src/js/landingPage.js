import { fetchTraits } from "./getPGS_loadTraits.js";
import {
	buildTopCategoriesFromScoresPerCategory,
	buildTopTraitsFromScoresPerTrait,
	fetchAllScores,
	getScoresPerCategory,
	getScoresPerTrait,
} from "./getPGS_loadScores.js";

export function formatNumber(value, decimals = 0) {
	if (value == null || Number.isNaN(value)) return "NR";
	return Number(value).toLocaleString(undefined, {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	});
}

function setTextContent(id, text) {
	const element = document.getElementById(id);
	if (!element) return;
	element.textContent = text;
}

export function renderTraitStatus({ sourceStatus, output } = {}) {
	if (sourceStatus !== undefined) {
		setTextContent("traitSourceStatus", sourceStatus);
	}
	if (output !== undefined) {
		setTextContent("traitOutput", output);
	}
}

export function renderScoreTraitStatus({ sourceStatus, output } = {}) {
	if (sourceStatus !== undefined) {
		setTextContent("scoreSourceStatusTrait", sourceStatus);
	}
	if (output !== undefined) {
		setTextContent("scoreTraitOutput", output);
	}
}

export function renderScoreCategoryStatus({ sourceStatus, output } = {}) {
	if (sourceStatus !== undefined) {
		setTextContent("scoreSourceStatusCategory", sourceStatus);
	}
	if (output !== undefined) {
		setTextContent("scoreCategoryOutput", output);
	}
}

function getTraitCategoryEntries(summary) {
	const entries = Array.isArray(summary?.categories)
		? summary.categories
		: (Array.isArray(summary?.topCategories) ? summary.topCategories : []);

	return entries.map((entry) => {
		if (Array.isArray(entry)) {
			const pgsIds = Array.isArray(entry[2]) ? entry[2] : [];
			return {
				category: entry[0],
				"traits_count": entry[1],
				"pgs_ids": pgsIds,
				"pgs_ids_count": pgsIds.length,
				"traits": entry[3] ?? [],
			};
		}
		if (entry && typeof entry === "object" && Array.isArray(entry["pgs_ids"])) {
			return {
				...entry,
				"pgs_ids_count": entry["pgs_ids"].length,
			};
		}
		return entry;
	});
}

export function renderTraitStats(summary) {
	const statsDiv = document.getElementById("traitDiv");
	if (!statsDiv) return;

	const topCategory = getTraitCategoryEntries(summary)[0];
	const topCategoryLabel = topCategory
		? `${topCategory.category} (${formatNumber(topCategory["traits_count"])})`
		: "NR";

	statsDiv.innerHTML = `
		<div class="small text-muted">
			<div><strong>Total traits:</strong> ${formatNumber(summary.traits.length)}</div>
			<div><strong>Total categories:</strong> ${formatNumber(summary.categories.length)}</div>
			<div><strong>Top category:</strong> ${topCategoryLabel}</div>
		</div>
	`;
}

export function renderTraitPlot(summary) {
	if (typeof Plotly === "undefined") return;

	const chartDiv = document.getElementById("traitChart");
	if (!chartDiv) return;

	const categoryEntries = getTraitCategoryEntries(summary);
	const categories = categoryEntries.map((entry) => entry.category);
	const counts = categoryEntries.map((entry) => entry["traits_count"]);
	const data = [
		{
			type: "bar",
			x: counts,
			y: categories,
			orientation: "h",
			marker: { color: "#0d6efd" },
		},
	];

	const layout = {
		title: {
			text: "Traits per Category",
			x: 0.5,
			xanchor: "center",
		},
		margin: { l: 260, r: 20, t: 80, b: 90 },
		xaxis: {
			title: {
				text: "Trait count",
				standoff: 10,
			},
			side: "bottom",
			automargin: true,
		},
		yaxis: { automargin: true },
	};

	Plotly.newPlot(chartDiv, data, layout, { responsive: true });
}

export function renderScoreStats(summary) {
	const statsDiv = document.getElementById("scoreTraitDiv");
	if (!statsDiv) return;

	statsDiv.innerHTML = `
		<div class="small text-muted">
			<div><strong>Total scores:</strong> ${formatNumber(summary.totalScores)}</div>
			<div><strong>Unique traits:</strong> ${formatNumber(summary.uniqueTraits)}</div>
			<div><strong>Variants (median):</strong> ${formatNumber(summary.variants.median)}</div>
			<div><strong>Variants (mean):</strong> ${formatNumber(summary.variants.mean, 2)}</div>
			<div><strong>Variants range:</strong> ${formatNumber(summary.variants.min)} - ${formatNumber(summary.variants.max)}</div>
		</div>
	`;
}

export function renderScorePlot(summary) {
	if (typeof Plotly === "undefined") return;

	const chartDiv = document.getElementById("scoreTraitChart");
	if (!chartDiv) return;

	const topTraits = Array.isArray(summary?.topTraits) ? summary.topTraits : [];
	const traits = topTraits.map((t) => t[0]);
	const counts = topTraits.map((t) => t[1]);
	const customData = topTraits.map((entry) => {
		const min = entry?.[2] ?? "NR";
		const max = entry?.[3] ?? "NR";
		return [min, max];
	});

	const data = [
		{
			type: "bar",
			x: counts,
			y: traits,
			customdata: customData,
			hovertemplate: "Trait: %{y}<br>Score count: %{x}<br>Variants range: %{customdata[0]} - %{customdata[1]}<extra></extra>",
			orientation: "h",
			marker: { color: "#7c1707" },
		},
	];

	const chartHeight = Math.max(200, traits.length * 35 + 100);

	const layout = {
		title: {
			text: "Scoring files per Trait for Top 10 Reported Traits",
			x: 0.5,
			xanchor: "center",
		},
		height: chartHeight,
		margin: { l: 260, r: 20, t: 90, b: 120 },
		xaxis: {
			title: {
				text: "Scoring files count ",
				standoff: 24,
			},
			side: "bottom",
			automargin: true,
		},
		yaxis: { automargin: true },
	};

	Plotly.newPlot(chartDiv, data, layout, { responsive: true });
}

export function renderScorePerCategoryStats(topCategories) {
	const statsDiv = document.getElementById("scoreCategoryDiv");
	if (!statsDiv) return;

	const topCategory = topCategories[0] ?? null;
	const topCategoryLabel = topCategory
		? `${topCategory[0]} (${formatNumber(topCategory[1])})`
		: "NR";

	statsDiv.innerHTML = `
		<div class="small text-muted">
			<div><strong>Total categories:</strong> ${formatNumber(topCategories.length)}</div>
			<div><strong>Top category:</strong> ${topCategoryLabel}</div>
		</div>
	`;
}

export function renderScorePerCategoryPlot(topCategories) {
	if (typeof Plotly === "undefined") return;

	const chartDiv = document.getElementById("scoreCategoryChart");
	if (!chartDiv) return;

	const categories = topCategories.map((entry) => entry[0]);
	const counts = topCategories.map((entry) => entry[1]);
	const customData = topCategories.map((entry) => {
		const min = entry?.[2] ?? "NR";
		const max = entry?.[3] ?? "NR";
		return [min, max];
	});
	const chartHeight = Math.max(500, categories.length * 28 + 160);

	const data = [
		{
			type: "bar",
			x: counts,
			y: categories,
			customdata: customData,
			hovertemplate: "Category: %{y}<br>Score count: %{x}<br>Variants range: %{customdata[0]} - %{customdata[1]}<extra></extra>",
			orientation: "h",
			marker: { color: "#198754" },
		},
	];

	const layout = {
		title: {
			text: "Scoring Files per Category",
			x: 0.5,
			xanchor: "center",
		},
		height: chartHeight,
		margin: { l: 260, r: 20, t: 90, b: 120 },
		xaxis: {
			title: {
				text: "Scoring files count",
				standoff: 24,
			},
			side: "bottom",
			automargin: true,
		},
		yaxis: { automargin: true },
	};

	Plotly.newPlot(chartDiv, data, layout, { responsive: true });
}

export async function fetchDataAndRenderPlots() {
	try {
		renderTraitStatus({ sourceStatus: "Source: loading PGS trait metadata..." });

		const results = await fetchTraits();
		const summary = results?.summary ?? null;
		if (!summary) {
			renderTraitStatus({
				sourceStatus: "Source: unavailable",
				output: "Error loading stats: missing trait summary data.",
			});
			return null;
		}

		renderTraitStats(summary);
		renderTraitPlot(summary);

		if (results.source === "cache") {
			renderTraitStatus({
				sourceStatus: "Source: local cache (LocalForage, < 3 months)",
				output: `Loaded ${formatNumber(summary.traits.length)} cached traits summary (${results.savedAt}).`,
			});
		} else if (results.source === "cache-fallback") {
			renderTraitStatus({
				sourceStatus: "Source: local cache (LocalForage fallback)",
				output: `Loaded ${formatNumber(summary.traits.length)} cached traits summary (${results.savedAt}).`,
			});
			if (results.error) {
				console.error(results.error);
			}
		} else {
			renderTraitStatus({
				sourceStatus: "Source: PGS Catalog REST API (live)",
				output: `Loaded ${formatNumber(summary.traits.length)} traits from PGS Catalog.`,
			});
		}

		return summary;
	} catch (error) {
		renderTraitStatus({
			sourceStatus: "Source: unavailable",
			output: `Error loading stats: ${error.message}`,
		});
		console.error(error);
		return null;
	}
}

export async function loadScoreStats({ includeAllScoreStats = false, includeTraitStats = false, includeCategoryStats = false } = {}) {
	let plotTopTraits = null;
	let scoresPerCategoryPayload = null;
	let plotTopCategories = null;
	let results = { scores: [], summary: null };

	try {
		renderScoreTraitStatus({
			sourceStatus: includeAllScoreStats
				? (includeTraitStats
					? "Source: loading PGS score metadata..."
					: "Source: loading PGS score metadata (trait-linked stats not requested)...")
				: (includeTraitStats ? "Source: loading trait-linked score metadata..." : "Source: not requested"),
			output: !includeAllScoreStats && !includeTraitStats ? "Score stats not loaded." : undefined,
		});
		renderScoreCategoryStatus({
			sourceStatus: includeCategoryStats ? "Source: loading linked category score metadata..." : "Source: not requested",
			output: !includeCategoryStats ? "Category-linked score stats not loaded." : undefined,
		});

		if (includeTraitStats || includeCategoryStats) {
			await fetchTraits();
		}
		if (includeAllScoreStats || includeTraitStats || includeCategoryStats) {
			results = await fetchAllScores();
		}

		const summary = results.summary;
		const scoreSource = results.source;
		const scoreSavedAt = results.savedAt;
		const fetchAllScoresErrorMessage = results.errorMessage;

		if (includeTraitStats) {
			try {
				const scoresPerTrait = await getScoresPerTrait();
				plotTopTraits = buildTopTraitsFromScoresPerTrait(scoresPerTrait, 10);
			} catch (error) {
				console.warn("loadScoreStats(): unable to build topTraits from getScoresPerTrait", error);
			}
		}
		if (includeCategoryStats) {
			try {
				scoresPerCategoryPayload = await getScoresPerCategory();
				plotTopCategories = buildTopCategoriesFromScoresPerCategory(scoresPerCategoryPayload);
			} catch (error) {
				console.warn("loadScoreStats(): unable to build categories from getScoresPerCategory", error);
			}
		}

		if (includeAllScoreStats && !summary) {
			renderScoreTraitStatus({
				sourceStatus: "Source: unavailable",
				output: fetchAllScoresErrorMessage ?? "Error loading stats: missing summary data.",
			});
			if (includeCategoryStats) {
				renderScoreCategoryStatus({
					sourceStatus: "Source: unavailable",
					output: fetchAllScoresErrorMessage ?? "Error loading category-linked stats: missing summary data.",
				});
			}
			return results;
		}

		if (includeAllScoreStats && summary && scoreSource === "cache") {
			const summaryForPlot = {
				...summary,
				topTraits: plotTopTraits ?? summary.topTraits,
			};
			renderScoreStats(summary);
			renderScorePlot(summaryForPlot);
			renderScoreTraitStatus({
				sourceStatus: includeTraitStats
					? "Source: local cache (all-score-summary + scores-per-trait-summary, < 3 months)"
					: "Source: local cache (all-score-summary, < 3 months)",
				output: includeTraitStats
					? `Loaded ${formatNumber(summary.totalScores)} cached scores summary + trait-linked score cache (${scoreSavedAt}).`
					: `Loaded ${formatNumber(summary.totalScores)} cached scores summary (${scoreSavedAt}).`,
			});
		} else if (includeAllScoreStats && summary && scoreSource === "cache-fallback") {
			const summaryForPlot = {
				...summary,
				topTraits: plotTopTraits ?? summary.topTraits,
			};
			renderScoreStats(summary);
			renderScorePlot(summaryForPlot);
			renderScoreTraitStatus({
				sourceStatus: includeTraitStats
					? "Source: local cache fallback (all-score-summary + scores-per-trait-summary)"
					: "Source: local cache fallback (all-score-summary)",
				output: includeTraitStats
					? `Loaded ${formatNumber(summary.totalScores)} cached scores summary + trait-linked score cache (${scoreSavedAt}).`
					: `Loaded ${formatNumber(summary.totalScores)} cached scores summary (${scoreSavedAt}).`,
			});
		} else if (includeAllScoreStats && summary) {
			const summaryForPlot = {
				...summary,
				topTraits: plotTopTraits ?? summary.topTraits,
			};
			renderScoreStats(summary);
			renderScorePlot(summaryForPlot);
			renderScoreTraitStatus({
				sourceStatus: includeTraitStats
					? "Source: PGS Catalog REST API (live; refreshed all-score-summary + scores-per-trait-summary)"
					: "Source: PGS Catalog REST API (live; refreshed all-score-summary)",
				output: includeTraitStats
					? `Loaded ${formatNumber(summary.totalScores)} scores from PGS Catalog and built trait-linked score cache.`
					: `Loaded ${formatNumber(summary.totalScores)} scores from PGS Catalog.`,
			});
		} else if (includeTraitStats && plotTopTraits?.length) {
			renderScorePlot({ topTraits: plotTopTraits });
			renderScoreTraitStatus({
				sourceStatus: "Source: trait-linked score cache",
				output: `Loaded ${formatNumber(plotTopTraits.length)} trait-linked scoring summaries.`,
			});
		} else if (includeTraitStats) {
			renderScoreTraitStatus({
				sourceStatus: "Source: unavailable",
				output: "Error loading trait-linked stats: no trait data.",
			});
		}

		if (includeCategoryStats && plotTopCategories?.length) {
			renderScorePerCategoryStats(plotTopCategories);
			renderScorePerCategoryPlot(plotTopCategories);
			const categorySavedAt = scoresPerCategoryPayload?.savedAt;
			renderScoreCategoryStatus({
				sourceStatus: categorySavedAt
					? "Source: local cache (scores-per-category-summary, < 3 months)"
					: "Source: category-linked score cache",
				output: `Loaded ${formatNumber(plotTopCategories.length)} category-linked scoring summaries.`,
			});
		} else if (includeCategoryStats) {
			renderScoreCategoryStatus({
				sourceStatus: "Source: unavailable",
				output: "Error loading category-linked stats: no category data.",
			});
		}

		return results;
	} catch (error) {
		if (includeAllScoreStats && results?.summary) {
			renderScoreStats(results.summary);
			renderScorePlot(results.summary);
			renderScoreTraitStatus({
				sourceStatus: results.source === "cache-fallback"
					? (includeTraitStats
						? "Source: local cache fallback (all-score-summary + scores-per-trait-summary)"
						: "Source: local cache fallback (all-score-summary)")
					: "Source: unavailable",
				output: includeTraitStats
					? `Loaded ${formatNumber(results.summary.totalScores)} cached scores summary + trait-linked score cache (${results.savedAt}).`
					: `Loaded ${formatNumber(results.summary.totalScores)} cached scores summary (${results.savedAt}).`,
			});
		} else if (includeTraitStats) {
			renderScoreTraitStatus({
				sourceStatus: "Source: unavailable",
				output: `Error loading trait-linked stats: ${error.message}`,
			});
		} else {
			renderScoreTraitStatus({
				sourceStatus: "Source: unavailable",
				output: `Error loading stats: ${error.message}`,
			});
		}

		if (includeCategoryStats && scoresPerCategoryPayload?.scoresPerCategory) {
			const categoryTop = buildTopCategoriesFromScoresPerCategory(scoresPerCategoryPayload);
			renderScorePerCategoryStats(categoryTop);
			renderScorePerCategoryPlot(categoryTop);
			renderScoreCategoryStatus({
				sourceStatus: "Source: local cache fallback (scores-per-category-summary)",
				output: `Loaded ${formatNumber(categoryTop.length)} cached category-linked scoring summaries (${scoresPerCategoryPayload.savedAt}).`,
			});
		} else if (includeCategoryStats) {
			renderScoreCategoryStatus({
				sourceStatus: "Source: unavailable",
				output: `Error loading category-linked stats: ${error.message}`,
			});
		}

		console.error(error);
		return results;
	}
}
