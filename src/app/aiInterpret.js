// AI Interpret tab — sends only a compact summary (no raw genotype data)
// Users supply their own API key (OpenAI or Anthropic)

function summarizePrsForAI() {
	const results = window.prsResults || [];

	const users = [...new Set(results.map(r => r.userName ?? r.userId).filter(Boolean))];
	const pgsIds = [...new Set(results.map(r => r.pgsId).filter(Boolean))];

	const prsSummary = results.map(r => ({
		user: r.userName ?? r.userId,
		pgsId: r.pgsId,
		PRS: r.PRS,
		matchedVariants: r.organized?.matched?.dt?.length ?? r.pgsMatchMy23?.length ?? null,
		totalVariants: r.pgs?.dt?.length ?? null,
		trait: r.pgs?.meta?.trait_reported ?? r.pgs?.meta?.trait ?? null
	}));

	// --- Clustering-oriented derived structure ---
	// Build a user × PGS pivot of PRS values so the model can see relative patterns.
	const round = v => (Number.isFinite(v) ? Number(v.toFixed(4)) : null);
	const pivot = {};
	for (const r of results) {
		if (!r.userId || !Number.isFinite(r.PRS)) continue;
		const label = r.userName ?? r.userId;
		if (!pivot[label]) pivot[label] = {};
		pivot[label][r.pgsId] = round(r.PRS);
	}

	// Per-PGS z-scores across users → highlights who is high/low for each trait.
	const zPivot = {};
	for (const pgsId of pgsIds) {
		const vals = Object.values(pivot)
			.map(row => row[pgsId])
			.filter(v => Number.isFinite(v));
		if (vals.length < 2) continue;
		const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
		const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
		for (const label of Object.keys(pivot)) {
			const v = pivot[label][pgsId];
			if (!Number.isFinite(v)) continue;
			zPivot[label] = zPivot[label] || {};
			zPivot[label][pgsId] = round((v - mean) / sd);
		}
	}

	// Pairwise Euclidean distances between users on z-scored PRS profiles.
	// Compact representation of clustering "shape" without sending raw genotypes.
	const userLabels = Object.keys(zPivot);
	const distances = [];
	for (let i = 0; i < userLabels.length; i++) {
		for (let j = i + 1; j < userLabels.length; j++) {
			const a = zPivot[userLabels[i]];
			const b = zPivot[userLabels[j]];
			let sumSq = 0, n = 0;
			for (const pgsId of pgsIds) {
				if (Number.isFinite(a[pgsId]) && Number.isFinite(b[pgsId])) {
					sumSq += (a[pgsId] - b[pgsId]) ** 2;
					n++;
				}
			}
			if (n > 0) {
				distances.push({
					a: userLabels[i],
					b: userLabels[j],
					sharedPgs: n,
					euclidean: round(Math.sqrt(sumSq))
				});
			}
		}
	}

	// Per-PGS missingness rate across users (fraction of users missing this PGS score).
	const missingnessPerPgs = pgsIds.map(pgsId => {
		const total = users.length || 1;
		const present = Object.values(pivot).filter(row => Number.isFinite(row[pgsId])).length;
		return { pgsId, present, total, missingFraction: round(1 - present / total) };
	});

	// --- Section A–F clustering summaries (compact, no raw matrices) ---
	const opts = window.clusterOptions || {};
	const cache = (typeof window.getClusterCache === 'function') ? window.getClusterCache() : null;

	const matrixDims = m => (Array.isArray(m) && m.length > 0)
		? { rows: m.length, cols: Math.max(0, Object.keys(m[0]).length - 1) }
		: null;

	const sectionsRun = {};
	if (cache) {
		// A. PRS Clustering (users × PGS pivot)
		if (cache.pivoted) {
			sectionsRun.A = {
				title: 'A. PRS Clustering (Users × PGS)',
				dims: matrixDims(cache.pivoted),
				options: {
					clusterRows: opts.clusterRows ?? true,
					clusterCols: opts.clusterCols ?? true,
					linkage: opts.clusterMethod ?? 'complete',
					distance: opts.clusterDistance ?? 'euclidean'
				}
			};
		}
		// B. Users × One PGS (allele/risk matrices)
		if (cache.alleleMatrices) {
			sectionsRun.B = {
				title: 'B. Users × One PGS (allele matrices)',
				selectedPgsId: opts.selectedPgsId ?? null,
				valueMode: opts.alleleValueMode ?? 'allele',
				dims: {
					all: matrixDims(cache.alleleMatrices.allMatrix),
					overlapping: matrixDims(cache.alleleMatrices.overlapMatrix),
					shared: matrixDims(cache.alleleMatrices.sharedMatrix)
				},
				options: {
					clusterRows: opts.clusterAlleleRows ?? true,
					clusterCols: opts.clusterAlleleCols ?? true,
					linkage: opts.alleleClusterMethod ?? 'complete',
					distance: opts.alleleClusterDistance ?? 'euclidean'
				}
			};
		}
		// C. PGS × One User
		if (cache.pgsVsSnpsMatrices) {
			sectionsRun.C = {
				title: 'C. PGS × One User (PGS rows × SNP cols)',
				selectedUserId: opts.selectedUserId ?? null,
				dims: {
					all: matrixDims(cache.pgsVsSnpsMatrices.pgsVsSnpsAllMatrix),
					overlapping: matrixDims(cache.pgsVsSnpsMatrices.pgsVsSnpsOverlapMatrix),
					shared: matrixDims(cache.pgsVsSnpsMatrices.pgsVsSnpsSharedMatrix)
				},
				options: {
					clusterRows: opts.pgsVsSnpsClusterRows ?? true,
					clusterCols: opts.pgsVsSnpsClusterCols ?? false
				}
			};
		}
		// D. PGS × PGS effect weights
		if (cache.effectMatrices) {
			const e = cache.effectMatrices;
			sectionsRun.D = {
				title: 'D. PGS × SNP effect-weight clustering',
				pgsCount: e.pgsEffectAll?.pgsCount ?? null,
				snpCounts: {
					all: cache.snpLists?.allSnpsList?.length ?? null,
					overlapping: cache.snpLists?.overlapSnpsList?.length ?? null,
					shared: cache.snpLists?.sharedSnpsList?.length ?? null
				},
				options: {
					clusterRows: opts.effectClusterRows ?? true,
					clusterCols: opts.effectClusterCols ?? false
				}
			};
		}
		// E. Genotype-level clustering (users × shared SNPs encoded genotype)
		if (cache.genotypeDistData) {
			const g = cache.genotypeDistData.result;
			sectionsRun.E = {
				title: 'E. Genotype-level Clustering (Users × shared SNPs)',
				dims: matrixDims(cache.genotypeDistData.plotData),
				snpCount: g?.snpCount ?? null,
				userCount: g?.userCount ?? null,
				options: {
					clusterRows: opts.genotypeClusterRows ?? true,
					clusterCols: opts.genotypeClusterCols ?? false,
					linkage: opts.genotypeClusterMethod ?? 'complete',
					distance: opts.genotypeClusterDistance ?? 'euclidean'
				}
			};
		}
		// F. Genome-wide raw genotype matrix
		if (cache.rawGenoMatrix) {
			sectionsRun.F = {
				title: 'F. Genome-wide Genotypes',
				dims: matrixDims(cache.rawGenoMatrix)
			};
		}
	}

	const activeSection = opts.activeClusterSection ?? null;

	return {
		context: "Browser-native PRS and clustering SDK. Interpret results as exploratory, not clinical.",
		users,
		pgsIds,
		resultCount: results.length,
		prsSummary,
		clustering: {
			note: "PRS pivot, per-PGS z-scores, and pairwise Euclidean distances between users computed from the z-scored user × PGS matrix. Use these to discuss which users group together and which PGS scores drive the separation.",
			prsPivot: pivot,
			zScorePivot: zPivot,
			pairwiseUserDistances: distances,
			missingnessPerPgs,
			sectionsRun,
			activeSection,
			sectionsNote: "sectionsRun lists which clustering views (A–F) the user has computed in the Cluster tab, with matrix dimensions and the linkage/distance/cluster-axis options chosen for each. Reference these explicitly when interpreting results."
		}
	};
}

function buildAIPrompt(question) {
	console.log("Building AI prompt with question:", question);
	const summary = summarizePrsForAI();

	return `You are helping interpret exploratory polygenic risk score clustering results.

Important constraints:
- Do not give medical diagnosis or clinical advice.
- Explain that PRS/clustering results are exploratory.
- Discuss missing variants, matched variant counts, clustering patterns, and technical limitations.
- Mention possible platform/genotyping overlap effects.
- Write in language suitable for a Bioinformatics application note.

Clustering sections present in the data summary (clustering.sectionsRun):
- A: PRS Clustering (Users × PGS)
- B: Users × One PGS (allele or risk × allele matrices)
- C: PGS × One User (PGS rows × SNP columns)
- D: PGS × SNP effect-weight clustering
- E: Genotype-level clustering (Users × shared SNPs)
- F: Genome-wide raw genotype matrix
Only comment on sections that actually appear in clustering.sectionsRun. For each present
section, reference its dimensions and chosen linkage/distance/cluster-axis options.

User question:
${question}

Data summary:
${JSON.stringify(summary, null, 2)}`;
}

async function callOpenAI(apiKey, prompt, model = "gpt-4.1-mini") {
	console.log("Calling OpenAI with prompt:", prompt, "model:", model);
	const res = await fetch("https://api.openai.com/v1/responses", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model,
			input: prompt
		})
	});

	if (!res.ok) throw new Error(await res.text());
	const data = await res.json();
	//Now aiInterpret.js shows just output_text (or Claude's joined content[].text) in the main pane, with a "View full JSON" button (Bootstrap collapse) that reveals the raw response below.
	const text = data.output_text
		?? data.output?.flatMap(o => o.content ?? []).map(c => c.text).filter(Boolean).join("\n")
		?? "(no output_text returned)";
	return { text, raw: data };
}

async function callClaude(apiKey, prompt, model = "claude-sonnet-4-5") {
	const res = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
			"anthropic-dangerous-allow-browser": "true"
		},
		body: JSON.stringify({
			model,
			max_tokens: 1200,
			messages: [{ role: "user", content: prompt }]
		})
	});

	if (!res.ok) throw new Error(await res.text());
	const data = await res.json();
	//Now aiInterpret.js shows just output_text (or Claude's joined content[].text) in the main pane, with a "View full JSON" button (Bootstrap collapse) that reveals the raw response below.
	const text = data.content?.map(x => x.text).join("\n") ?? "(no content returned)";
	return { text, raw: data };
}

document.getElementById("runAIInterpretBtn")?.addEventListener("click", async () => {
	const output = document.getElementById("aiInterpretOutput");
	const provider = document.getElementById("aiProvider").value;
	const model = document.getElementById("aiModel")?.value;
	const apiKey = document.getElementById("aiApiKey").value.trim();
	const question = document.getElementById("aiQuestion").value.trim();

	if (!apiKey) {
		output.innerHTML = `<div class="alert alert-warning">Please enter your API key.</div>`;
		return;
	}

	output.innerHTML = `<div class="alert alert-info">Interpreting results...</div>`;

	try {
		const prompt = buildAIPrompt(question);
		const { text, raw } = provider === "anthropic"
			? await callClaude(apiKey, prompt, model)
			: await callOpenAI(apiKey, prompt, model);

		const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
		output.innerHTML = `
			<div class="card">
				<div class="card-header d-flex justify-content-between align-items-center">
					<strong>AI Interpretation</strong>
					<button type="button" class="btn btn-sm btn-outline-secondary" data-bs-toggle="collapse" data-bs-target="#aiRawJson" aria-expanded="false">View full JSON</button>
				</div>
				<div class="card-body">
					<pre style="white-space:pre-wrap">${esc(text)}</pre>
					<div id="aiRawJson" class="collapse mt-3">
						<pre style="white-space:pre-wrap;max-height:400px;overflow:auto;background:#f8f9fa;padding:.5rem;border:1px solid #dee2e6;border-radius:.25rem">${esc(JSON.stringify(raw, null, 2))}</pre>
					</div>
				</div>
			</div>`;
	} catch (err) {
		output.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
	}
});

// Auto-filter model dropdown to only show models matching the selected provider.
(function setupAIModelFilter() {
	const providerEl = document.getElementById("aiProvider");
	const modelEl = document.getElementById("aiModel");
	if (!providerEl || !modelEl) return;

	const defaults = { openai: "gpt-4.1-mini", anthropic: "claude-sonnet-4-5" };

	function syncModels() {
		const provider = providerEl.value;
		let firstVisible = null;
		Array.from(modelEl.querySelectorAll("optgroup")).forEach(group => {
			const isOpenAI = /openai/i.test(group.label);
			const isAnthropic = /anthropic|claude/i.test(group.label);
			const show = (provider === "openai" && isOpenAI) || (provider === "anthropic" && isAnthropic);
			group.hidden = !show;
			Array.from(group.children).forEach(opt => {
				opt.hidden = !show;
				opt.disabled = !show;
				if (show && !firstVisible) firstVisible = opt;
			});
		});
		const current = modelEl.options[modelEl.selectedIndex];
		if (!current || current.hidden) {
			modelEl.value = defaults[provider] || (firstVisible && firstVisible.value) || "";
		}
	}

	providerEl.addEventListener("change", syncModels);
	syncModels();
})();

// Initialize Bootstrap popovers (e.g., the "?" help button next to API Key).
(function initAIPopovers() {
	if (typeof bootstrap === "undefined" || !bootstrap.Popover) return;
	document.querySelectorAll('[data-bs-toggle="popover"]').forEach(el => {
		if (!bootstrap.Popover.getInstance(el)) new bootstrap.Popover(el);
	});
})();
