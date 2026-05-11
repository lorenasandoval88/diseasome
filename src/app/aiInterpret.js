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

	return {
		context: "Browser-native PRS and clustering SDK. Interpret results as exploratory, not clinical.",
		users,
		pgsIds,
		resultCount: results.length,
		prsSummary
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
