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

async function callOpenAI(apiKey, prompt) {
	const res = await fetch("https://api.openai.com/v1/responses", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: "gpt-4.1-mini",
			input: prompt
		})
	});

	if (!res.ok) throw new Error(await res.text());
	const data = await res.json();
	return data.output_text ?? JSON.stringify(data, null, 2);
}

async function callClaude(apiKey, prompt) {
	const res = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
			"anthropic-dangerous-allow-browser": "true"
		},
		body: JSON.stringify({
			model: "claude-sonnet-4-5",
			max_tokens: 1200,
			messages: [{ role: "user", content: prompt }]
		})
	});

	if (!res.ok) throw new Error(await res.text());
	const data = await res.json();
	return data.content?.map(x => x.text).join("\n") ?? JSON.stringify(data, null, 2);
}

document.getElementById("runAIInterpretBtn")?.addEventListener("click", async () => {
	const output = document.getElementById("aiInterpretOutput");
	const provider = document.getElementById("aiProvider").value;
	const apiKey = document.getElementById("aiApiKey").value.trim();
	const question = document.getElementById("aiQuestion").value.trim();

	if (!apiKey) {
		output.innerHTML = `<div class="alert alert-warning">Please enter your API key.</div>`;
		return;
	}

	output.innerHTML = `<div class="alert alert-info">Interpreting results...</div>`;

	try {
		const prompt = buildAIPrompt(question);
		const text = provider === "anthropic"
			? await callClaude(apiKey, prompt)
			: await callOpenAI(apiKey, prompt);

		output.innerHTML = `
			<div class="card">
				<div class="card-header"><strong>AI Interpretation</strong></div>
				<div class="card-body">
					<pre style="white-space:pre-wrap">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
				</div>
			</div>`;
	} catch (err) {
		output.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
	}
});
