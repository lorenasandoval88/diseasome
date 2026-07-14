/**
 * WebLLM Module - Local AI inference using WebLLM with multiple model options
 * Runs LLMs in the browser via WebGPU
 */

import * as webllm from "https://esm.run/@mlc-ai/web-llm";

// Model state
let engine = null;
let isModelLoading = false;
let modelLoaded = false;
let currentModelId = null;

// Available models configuration
const AVAILABLE_MODELS = [
    {
        id: "Phi-3-mini-4k-instruct-q4f16_1-MLC",
        name: "Phi-3 Mini (Default)",
        description: "Microsoft's compact model. Fast, lightweight, good for quick analysis.",
        size: "~2GB",
        badge: "⚡ Fast",
        badgeClass: "bg-success"
    },
    {
        id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
        name: "Llama 3.2 (1B)",
        description: "Meta's smallest Llama 3. Good balance of speed and quality.",
        size: "~1GB",
        badge: "🥇 Balanced",
        badgeClass: "bg-primary"
    },
    {
        id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
        name: "Llama 3.2 (3B)",
        description: "Stronger reasoning than 1B. Better explanations, slower load.",
        size: "~2.5GB",
        badge: "🥇 Best Quality",
        badgeClass: "bg-primary"
    },
    {
        id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
        name: "Qwen 2.5 (1.5B)",
        description: "Alibaba's model. Great for structured outputs and multilingual.",
        size: "~1.5GB",
        badge: "🥈 Flexible",
        badgeClass: "bg-info"
    },
    {
        id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
        name: "Qwen 2.5 (3B)",
        description: "Larger Qwen with better reasoning. Good explanations.",
        size: "~2.5GB",
        badge: "🥈 Smart",
        badgeClass: "bg-info"
    },
    {
        id: "gemma-2-2b-it-q4f16_1-MLC",
        name: "Gemma 2 (2B)",
        description: "Google's model. Clean outputs, consistent tone, safe responses.",
        size: "~2GB",
        badge: "🥉 Clean",
        badgeClass: "bg-warning text-dark"
    },
    {
        id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
        name: "Mistral 7B (Large)",
        description: "Strong reasoning, high quality. Requires more memory/time.",
        size: "~4GB",
        badge: "⚡ Powerful",
        badgeClass: "bg-danger"
    }
];

// Default model
const DEFAULT_MODEL_ID = "Phi-3-mini-4k-instruct-q4f16_1-MLC";

/**
 * Initialize the WebLLM engine with specified model
 * @param {string} modelId - The model ID to load
 * @param {function} progressCallback - Progress callback function
 */
async function initModel(modelId, progressCallback) {
    const targetModelId = modelId || DEFAULT_MODEL_ID;
    
    // If same model already loaded, return existing engine
    if (modelLoaded && engine && currentModelId === targetModelId) return engine;
    
    // If different model requested, unload current first
    if (engine && currentModelId !== targetModelId) {
        // console.log(`Switching from ${currentModelId} to ${targetModelId}`);
        await unloadModel();
    }
    
    if (isModelLoading) return null;
    
    isModelLoading = true;
    
    try {
        engine = await webllm.CreateMLCEngine(targetModelId, {
            initProgressCallback: (progress) => {
                if (progressCallback) {
                    progressCallback({
                        status: 'progress',
                        text: progress.text,
                        progress: progress.progress
                    });
                }
            }
        });
        modelLoaded = true;
        currentModelId = targetModelId;
        isModelLoading = false;
        return engine;
    } catch (err) {
        isModelLoading = false;
        throw err;
    }
}

/**
 * Unload the current model to free memory
 */
async function unloadModel() {
    if (engine) {
        try {
            await engine.unload();
        } catch (e) {
            console.warn('Error unloading model:', e);
        }
        engine = null;
    }
    modelLoaded = false;
    currentModelId = null;
}

/**
 * Clear cached models from browser storage
 * WebLLM stores models in Cache Storage API
 */
async function clearModelCache() {
    try {
        // Unload current model first
        await unloadModel();
        
        // Clear WebLLM caches
        const cacheNames = await caches.keys();
        let clearedCount = 0;
        
        for (const name of cacheNames) {
            // WebLLM caches typically have 'webllm' or 'mlc' in their names
            if (name.toLowerCase().includes('webllm') || 
                name.toLowerCase().includes('mlc') || 
                name.toLowerCase().includes('model') ||
                name.toLowerCase().includes('wasm')) {
                await caches.delete(name);
                clearedCount++;
                // console.log(`Cleared cache: ${name}`);
            }
        }
        
        // Also try to clear IndexedDB entries that WebLLM might use
        const databases = await indexedDB.databases();
        for (const db of databases) {
            if (db.name && (db.name.toLowerCase().includes('webllm') || 
                           db.name.toLowerCase().includes('mlc') ||
                           db.name.toLowerCase().includes('model'))) {
                indexedDB.deleteDatabase(db.name);
                clearedCount++;
                // console.log(`Deleted IndexedDB: ${db.name}`);
            }
        }
        
        return clearedCount;
    } catch (err) {
        console.error('Error clearing model cache:', err);
        throw err;
    }
}

/**
 * Get information about currently loaded model
 */
function getCurrentModelInfo() {
    if (!currentModelId) return null;
    return AVAILABLE_MODELS.find(m => m.id === currentModelId);
}

/**
 * Generate AI response based on PRS results using WebLLM
 */
async function generateResponse(prompt, maxTokens = 256) {//512
    if (!engine) {
        throw new Error('Model not initialized. Please load the model first.');
    }
    
    const messages = [
        { role: "system", content: "You are an expert genomics assistant specializing in polygenic risk scores. Provide clear, helpful explanations about PRS results. Be concise but thorough." },
        { role: "user", content: prompt }
    ];
    
    const response = await engine.chat.completions.create({
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
        top_p: 0.9
    });
    
    return response.choices[0].message.content;
}

/**
 * Generate streaming AI response
 */
async function* generateStreamingResponse(prompt, maxTokens = 512) {
    if (!engine) {
        throw new Error('Model not initialized. Please load the model first.');
    }
    
    const messages = [
        { role: "system", content: "You are an expert genomics assistant specializing in polygenic risk scores. Provide clear, helpful explanations about PRS results. Be concise but thorough." },
        { role: "user", content: prompt }
    ];
    
    const chunks = await engine.chat.completions.create({
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
        top_p: 0.9,
        stream: true
    });
    
    for await (const chunk of chunks) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
            yield content;
        }
    }
}

/**
 * Build a prompt from PRS results for AI analysis
 */
function buildPRSPrompt(results, question) {
    if (!results || results.length === 0) {
        return `Question about polygenic risk scores: ${question}`;
    }
    
    // Check for detailed matched data from window.matchedResults
    const matchedResults = window.matchedResults ?? {};
    const hasMatchedResults = Object.keys(matchedResults).length > 0;
    
    let detailedAnalysis = '';
    
    if (hasMatchedResults) {
        detailedAnalysis = '\n\nDetailed variant analysis:\n';
        
        Object.entries(matchedResults).forEach(([key, data]) => {
            const md = data.matchedData;
            if (!md) return;
            
            const totalVariants = (md.matched?.dt?.length ?? 0) + (md.not_matched?.dt?.length ?? 0);
            const matchedCount = md.matched?.dt?.length ?? 0;
            const matchRate = totalVariants > 0 ? ((matchedCount / totalVariants) * 100).toFixed(1) : 0;
            
            const zeroAlleles = md.matched_by_alleles?.zero_allele?.count ?? 0;
            const oneAllele = md.matched_by_alleles?.one_allele?.count ?? 0;
            const twoAlleles = md.matched_by_alleles?.two_allele?.count ?? 0;
            
            const betaSums = md.betaSums ?? {};
            
            detailedAnalysis += `${data.userId}${data.userName ? ` (${data.userName})` : ''} - ${data.pgsId} (${data.trait || 'trait unknown'}):
  PRS: ${typeof data.PRS === 'number' ? data.PRS.toFixed(4) : 'N/A'}
  Variants: ${matchedCount}/${totalVariants} matched (${matchRate}%)
  Allele distribution: 0-allele=${zeroAlleles}, 1-allele=${oneAllele}, 2-allele=${twoAlleles}
  Beta sums: positive=${(betaSums.matchedPositive ?? 0).toFixed(4)}, negative=${(betaSums.matchedNegative ?? 0).toFixed(4)}
`;
        });
    }
    
    // Summarize PRS results - sample from multiple users when available
    // Group results by userId
    const resultsByUser = {};
    results.forEach(r => {
        const userId = r.userId ?? 'Unknown';
        if (!resultsByUser[userId]) {
            resultsByUser[userId] = [];
        }
        resultsByUser[userId].push(r);
    });
    
    // Take up to 2 results per user, max 10 total results
    const userIds = Object.keys(resultsByUser);
    const sampledResults = [];
    const maxPerUser = Math.max(1, Math.floor(10 / userIds.length));
    
    for (const userId of userIds) {
        const userResults = resultsByUser[userId].slice(0, maxPerUser);
        sampledResults.push(...userResults);
    }
    
    // Limit to 10 total
    const finalResults = sampledResults.slice(0, 10);
    
    const summaries = finalResults.map(r => {
        const userId = r.userId ?? 'Unknown';
        const userName = r.userName ? ` (${r.userName})` : '';
        const pgsId = r.pgsId ?? 'Unknown';
        const trait = r.organized?.summary?.trait ?? r.pgs?.meta?.trait_reported ?? 'Unknown trait';
        const prs = typeof r.PRS === 'number' ? r.PRS.toFixed(4) : 'N/A';
        const matched = r.pgsMatchMy23?.length ?? 0;
        const total = r.organized?.all?.dt?.length ?? r.pgs?.dt?.length ?? 0;
        
        return `- ${userId}${userName}: ${trait} (${pgsId}), PRS=${prs}, matched ${matched}/${total} variants`;
    }).join('\n');
    
    return `Analyze these Polygenic Risk Score (PRS) results:

${summaries}
${detailedAnalysis}
Question: ${question}`;
}

/**
 * Render the WebLLM tab content
 */
function renderWebLLM() {
    const container = document.getElementById('webLLMDiv');
    if (!container) return;
    
    const prsResults = window.prsResults ?? [];
    const hasResults = prsResults.length > 0;
    const matchedResults = window.matchedResults ?? {};
    const hasMatchedResults = Object.keys(matchedResults).length > 0;
    const currentModel = getCurrentModelInfo();
    const selectedModelId = currentModelId || DEFAULT_MODEL_ID;
    
    // Build model options HTML
    const modelOptionsHtml = AVAILABLE_MODELS.map(model => `
        <option value="${model.id}" ${model.id === selectedModelId ? 'selected' : ''}>
            ${model.badge} ${model.name} (${model.size})
        </option>
    `).join('');
    
    // Get selected model info for display
    const selectedModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0];
    
    container.innerHTML = `
        ${!hasResults ? `
            <div class="alert alert-info">
                <strong>No PRS results available.</strong><br>
                Please go to the <strong>Calculate PRS</strong> tab first and run a PRS calculation. <a href="#" onclick="document.querySelector('.tablinks[onclick*=PRS]').click(); return false;">Go to Calculate PRS →</a>
            </div>
        ` : ''}
        
        <!-- Model Selection -->
        <div class="card mb-3">
            <div class="card-header d-flex justify-content-between align-items-center">
                <strong>🤖 Model Selection</strong>
                <button id="clearCacheBtn" class="btn btn-outline-danger btn-sm" title="Clear all cached models to free storage">
                    <i class="fa fa-trash me-1"></i>Clear Model Cache
                </button>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <label for="modelSelect" class="form-label"><strong>Select AI Model:</strong></label>
                        <select id="modelSelect" class="form-select">
                            ${modelOptionsHtml}
                        </select>
                    </div>
                    <div class="col-md-6">
                        <div id="modelInfoDiv" class="mt-md-4 pt-md-1">
                            <span class="badge ${selectedModel.badgeClass} me-2">${selectedModel.badge}</span>
                            <small class="text-muted">${selectedModel.description}</small>
                        </div>
                    </div>
                </div>
                
                <div class="alert alert-secondary small mt-3 mb-0">
                    <strong>Model Guide:</strong><br>
                    🥇 <strong>Llama 3</strong> - Best overall quality, stronger reasoning<br>
                    🥈 <strong>Qwen 2.5</strong> - Good for structured outputs and multilingual<br>
                    🥉 <strong>Gemma 2</strong> - Clean, consistent outputs<br>
                    ⚡ <strong>Phi-3 / Mistral</strong> - Fast (Phi-3) or Powerful (Mistral)
                </div>
            </div>
        </div>
        
        <div class="mb-3">
            <div id="webllmStatusDiv" class="alert alert-secondary">
                <strong>Model Status:</strong> <span id="webllmStatusText">${modelLoaded ? `${currentModel?.name || 'Model'} loaded!` : 'Not loaded'}</span>
                <div id="webllmProgressDiv" class="progress mt-2" style="display:none; height: 20px;">
                    <div id="webllmProgressBar" class="progress-bar progress-bar-striped progress-bar-animated" 
                         role="progressbar" style="width: 0%"></div>
                </div>
                <div id="webllmProgressText" class="small text-muted mt-1" style="display:none;"></div>
            </div>
            <button id="loadWebLLMBtn" class="btn ${modelLoaded ? 'btn-success' : 'btn-primary'} btn-sm">
                <span id="loadWebLLMSpinner" class="spinner-border spinner-border-sm me-1" style="display:none;"></span>
                ${modelLoaded ? `✓ ${currentModel?.name || 'Model'} Loaded` : `Load ${selectedModel.name}`}
            </button>
            <button id="unloadModelBtn" class="btn btn-outline-warning btn-sm ms-2" ${!modelLoaded ? 'style="display:none;"' : ''}>
                Unload Model
            </button>
            <small class="text-muted ms-2">Size: ${selectedModel.size}, requires WebGPU-enabled browser</small>
        </div>
        
        <div class="alert alert-warning small">
            <strong>Requirements:</strong> WebGPU support (Chrome 113+, Edge 113+). 
            Models run entirely on your GPU - no data leaves your browser.
            <br><strong>Tip:</strong> Clear model cache to free disk space after use.
        </div>
        
        <hr />
        
        ${hasResults ? `
            <div class="mb-3">
                <strong>Available Results:</strong>
                <ul class="small mb-2">
                    ${prsResults.slice(0, 5).map(r => {
                        const userId = r.userId ?? 'Unknown';
                        const trait = r.organized?.summary?.trait ?? r.pgs?.meta?.trait_reported ?? '';
                        const prs = typeof r.PRS === 'number' ? r.PRS.toFixed(4) : 'N/A';
                        return `<li>${userId}: ${trait} - PRS: ${prs}</li>`;
                    }).join('')}
                    ${prsResults.length > 5 ? `<li>...and ${prsResults.length - 5} more</li>` : ''}
                </ul>
                ${hasMatchedResults ? `
                    <div class="alert alert-success py-2 small">
                        <strong>✓ Detailed variant analysis available for ${Object.keys(matchedResults).length} result(s)</strong>
                    </div>
                ` : `
                    <div class="alert alert-warning py-2 small">
                        <strong>Tip:</strong> Visit the <strong>Inspect Individual PRS Results</strong> tab first to give the AI detailed variant analysis.
                    </div>
                `}
            </div>
        ` : ''}
        
        <div class="mb-3">
            <label for="webllmQuestionInput" class="form-label"><strong>Ask <span id="modelNameLabel">${currentModel?.name || selectedModel.name}</span> about your PRS results:</strong></label>
            <textarea id="webllmQuestionInput" class="form-control" rows="3" 
                placeholder="Enter your question here..."
                ${!hasResults ? 'disabled' : ''}>What is the highest risk or important variant in my PRS results?</textarea>
        </div>
        
        <div class="mb-3">
            <div class="form-check form-check-inline">
                <input class="form-check-input" type="checkbox" id="streamingCheckbox" checked>
                <label class="form-check-label" for="streamingCheckbox">Enable streaming response</label>
            </div>
        </div>
        
        <div class="mb-3">
            <button id="askWebLLMBtn" class="btn btn-success" ${!hasResults ? 'disabled' : ''}>
                <span id="askWebLLMSpinner" class="spinner-border spinner-border-sm me-1" style="display:none;"></span>
                Ask <span id="askModelNameLabel">${currentModel?.name || selectedModel.name}</span>
            </button>
            <button id="clearWebLLMResponseBtn" class="btn btn-outline-secondary ms-2" style="display:none;">Clear</button>
        </div>
        
        <div id="webllmResponseDiv" class="mt-3" style="display:none;">
            <div class="card">
                <div class="card-header"><strong><span id="responseModelName">${currentModel?.name || selectedModel.name}</span> Response</strong></div>
                <div class="card-body">
                    <div id="webllmResponseText"></div>
                </div>
            </div>
        </div>
        
        <div class="mt-4 small text-muted">
            <strong>Note:</strong> This uses <a href="https://github.com/mlc-ai/web-llm" target="_blank">WebLLM</a> 
            to run LLMs locally in your browser via WebGPU. 
            No data is sent to external servers. The model provides general information and should not 
            be considered medical advice.
        </div>

        <hr class="my-4" />
        <div class="card">
            <div class="card-header"><strong>Pipeline: PRS Analysis with WebLLM</strong></div>
            <div class="card-body text-center">
                <div class="d-flex flex-column align-items-center" style="font-family: monospace; font-size: 0.9rem;">
                    <div class="badge bg-primary px-3 py-2">PRS Results + Variant Data</div>
                    <div class="text-muted my-1">↓</div>
                    <div class="badge bg-secondary px-3 py-2">buildPRSPrompt()</div>
                    <div class="text-muted my-1">↓</div>
                    <div class="badge bg-info px-3 py-2">Natural language prompt</div>
                    <div class="text-muted my-1">↓</div>
                    <div class="badge bg-purple px-3 py-2" style="background-color: #6f42c1 !important;">Chat message format (system + user)</div>
                    <div class="text-muted my-1">↓</div>
                    <div id="pipelineModelBadge" class="badge bg-warning text-dark px-3 py-2">WebLLM (${currentModel?.name || selectedModel.name} via WebGPU)</div>
                    <div class="text-muted my-1">↓</div>
                    <div class="badge bg-success px-3 py-2">Streaming or full response</div>
                    <div class="text-muted my-1">↓</div>
                    <div class="badge bg-dark px-3 py-2">UI display</div>
                </div>
            </div>
        </div>
    `;
    
    // Attach event handlers
    attachWebLLMEventHandlers();
}

/**
 * Attach event handlers for the WebLLM tab
 */
function attachWebLLMEventHandlers() {
    const loadWebLLMBtn = document.getElementById('loadWebLLMBtn');
    const askWebLLMBtn = document.getElementById('askWebLLMBtn');
    const clearResponseBtn = document.getElementById('clearWebLLMResponseBtn');
    const modelSelect = document.getElementById('modelSelect');
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    const unloadModelBtn = document.getElementById('unloadModelBtn');
    
    if (loadWebLLMBtn) {
        loadWebLLMBtn.onclick = handleLoadWebLLM;
    }
    
    if (askWebLLMBtn) {
        askWebLLMBtn.onclick = handleAskWebLLM;
    }
    
    if (clearResponseBtn) {
        clearResponseBtn.onclick = () => {
            const responseDiv = document.getElementById('webllmResponseDiv');
            if (responseDiv) responseDiv.style.display = 'none';
            clearResponseBtn.style.display = 'none';
        };
    }
    
    if (modelSelect) {
        modelSelect.onchange = handleModelSelectionChange;
    }
    
    if (clearCacheBtn) {
        clearCacheBtn.onclick = handleClearCache;
    }
    
    if (unloadModelBtn) {
        unloadModelBtn.onclick = handleUnloadModel;
    }
}

/**
 * Handle model selection change
 */
function handleModelSelectionChange(event) {
    const selectedId = event.target.value;
    const model = AVAILABLE_MODELS.find(m => m.id === selectedId);
    
    if (!model) return;
    
    // Update model info display
    const modelInfoDiv = document.getElementById('modelInfoDiv');
    if (modelInfoDiv) {
        modelInfoDiv.innerHTML = `
            <span class="badge ${model.badgeClass} me-2">${model.badge}</span>
            <small class="text-muted">${model.description}</small>
        `;
    }
    
    // Update load button text
    const loadBtn = document.getElementById('loadWebLLMBtn');
    if (loadBtn && !modelLoaded) {
        loadBtn.innerHTML = `
            <span id="loadWebLLMSpinner" class="spinner-border spinner-border-sm me-1" style="display:none;"></span>
            Load ${model.name}
        `;
    }
    
    // Update size text
    const sizeText = loadBtn?.nextElementSibling?.nextElementSibling;
    if (sizeText && sizeText.classList.contains('text-muted')) {
        sizeText.textContent = `Size: ${model.size}, requires WebGPU-enabled browser`;
    }
    
    // Update model name labels
    const modelNameLabel = document.getElementById('modelNameLabel');
    const askModelNameLabel = document.getElementById('askModelNameLabel');
    const pipelineModelBadge = document.getElementById('pipelineModelBadge');
    
    if (modelNameLabel) modelNameLabel.textContent = model.name;
    if (askModelNameLabel) askModelNameLabel.textContent = model.name;
    if (pipelineModelBadge) pipelineModelBadge.textContent = `WebLLM (${model.name} via WebGPU)`;
}

/**
 * Handle clearing the model cache
 */
async function handleClearCache() {
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    const statusText = document.getElementById('webllmStatusText');
    const statusDiv = document.getElementById('webllmStatusDiv');
    
    if (!confirm('This will delete all cached WebLLM models from your browser storage. You will need to re-download models to use them again.\n\nContinue?')) {
        return;
    }
    
    clearCacheBtn.disabled = true;
    clearCacheBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Clearing...';
    
    try {
        const clearedCount = await clearModelCache();
        
        statusText.textContent = `Cache cleared! Removed ${clearedCount} item(s).`;
        statusDiv.className = 'alert alert-info';
        
        // Reset UI
        const loadBtn = document.getElementById('loadWebLLMBtn');
        const unloadBtn = document.getElementById('unloadModelBtn');
        const modelSelect = document.getElementById('modelSelect');
        
        if (loadBtn) {
            const selectedModel = AVAILABLE_MODELS.find(m => m.id === modelSelect?.value) || AVAILABLE_MODELS[0];
            loadBtn.className = 'btn btn-primary btn-sm';
            loadBtn.innerHTML = `
                <span id="loadWebLLMSpinner" class="spinner-border spinner-border-sm me-1" style="display:none;"></span>
                Load ${selectedModel.name}
            `;
            loadBtn.disabled = false;
        }
        
        if (unloadBtn) {
            unloadBtn.style.display = 'none';
        }
        
        alert(`Successfully cleared ${clearedCount} cached item(s). You can now load a fresh model.`);
        
    } catch (err) {
        console.error('Error clearing cache:', err);
        statusText.textContent = `Error clearing cache: ${err.message}`;
        statusDiv.className = 'alert alert-danger';
    }
    
    clearCacheBtn.disabled = false;
    clearCacheBtn.innerHTML = '<i class="fa fa-trash me-1"></i>Clear Model Cache';
}

/**
 * Handle unloading the current model
 */
async function handleUnloadModel() {
    const unloadBtn = document.getElementById('unloadModelBtn');
    const loadBtn = document.getElementById('loadWebLLMBtn');
    const statusText = document.getElementById('webllmStatusText');
    const statusDiv = document.getElementById('webllmStatusDiv');
    const modelSelect = document.getElementById('modelSelect');
    
    unloadBtn.disabled = true;
    unloadBtn.textContent = 'Unloading...';
    
    try {
        await unloadModel();
        
        statusText.textContent = 'Model unloaded. Select a model and click Load.';
        statusDiv.className = 'alert alert-secondary';
        
        const selectedModel = AVAILABLE_MODELS.find(m => m.id === modelSelect?.value) || AVAILABLE_MODELS[0];
        
        if (loadBtn) {
            loadBtn.className = 'btn btn-primary btn-sm';
            loadBtn.innerHTML = `
                <span id="loadWebLLMSpinner" class="spinner-border spinner-border-sm me-1" style="display:none;"></span>
                Load ${selectedModel.name}
            `;
            loadBtn.disabled = false;
        }
        
        unloadBtn.style.display = 'none';
        
    } catch (err) {
        console.error('Error unloading model:', err);
        statusText.textContent = `Error unloading: ${err.message}`;
    }
    
    unloadBtn.disabled = false;
    unloadBtn.textContent = 'Unload Model';
}

/**
 * Handle loading the WebLLM model
 */
async function handleLoadWebLLM() {
    const loadWebLLMBtn = document.getElementById('loadWebLLMBtn');
    const loadWebLLMSpinner = document.getElementById('loadWebLLMSpinner');
    const statusText = document.getElementById('webllmStatusText');
    const progressDiv = document.getElementById('webllmProgressDiv');
    const progressBar = document.getElementById('webllmProgressBar');
    const progressText = document.getElementById('webllmProgressText');
    const statusDiv = document.getElementById('webllmStatusDiv');
    const modelSelect = document.getElementById('modelSelect');
    const unloadBtn = document.getElementById('unloadModelBtn');
    
    // Get selected model
    const selectedModelId = modelSelect?.value || DEFAULT_MODEL_ID;
    const selectedModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0];
    
    // If same model already loaded, return
    if (modelLoaded && currentModelId === selectedModelId) {
        statusText.textContent = `${selectedModel.name} already loaded!`;
        return;
    }
    
    // Check for WebGPU support
    if (!navigator.gpu) {
        statusText.textContent = 'WebGPU not supported in this browser';
        statusDiv.className = 'alert alert-danger';
        return;
    }
    
    loadWebLLMBtn.disabled = true;
    if (loadWebLLMSpinner) loadWebLLMSpinner.style.display = '';
    statusText.textContent = 'Initializing WebGPU...';
    progressDiv.style.display = '';
    progressText.style.display = '';
    statusDiv.className = 'alert alert-warning';
    
    // Disable model selection during loading
    if (modelSelect) modelSelect.disabled = true;
    
    try {
        await initModel(selectedModelId, (progress) => {
            const pct = Math.round(progress.progress * 100);
            progressBar.style.width = `${pct}%`;
            progressBar.textContent = `${pct}%`;
            statusText.textContent = `Loading ${selectedModel.name}...`;
            progressText.textContent = progress.text;
        });
        
        statusText.textContent = `${selectedModel.name} loaded and ready!`;
        statusDiv.className = 'alert alert-success';
        progressDiv.style.display = 'none';
        progressText.style.display = 'none';
        loadWebLLMBtn.innerHTML = `✓ ${selectedModel.name} Loaded`;
        loadWebLLMBtn.className = 'btn btn-success btn-sm';
        
        // Show unload button
        if (unloadBtn) unloadBtn.style.display = '';
        
        // Update model name labels
        const modelNameLabel = document.getElementById('modelNameLabel');
        const askModelNameLabel = document.getElementById('askModelNameLabel');
        const responseModelName = document.getElementById('responseModelName');
        const pipelineModelBadge = document.getElementById('pipelineModelBadge');
        
        if (modelNameLabel) modelNameLabel.textContent = selectedModel.name;
        if (askModelNameLabel) askModelNameLabel.textContent = selectedModel.name;
        if (responseModelName) responseModelName.textContent = selectedModel.name;
        if (pipelineModelBadge) pipelineModelBadge.textContent = `WebLLM (${selectedModel.name} via WebGPU)`;
        
    } catch (err) {
        console.error('Error loading WebLLM model:', err);
        statusText.textContent = `Error loading ${selectedModel.name}: ${err.message}`;
        statusDiv.className = 'alert alert-danger';
        loadWebLLMBtn.disabled = false;
        loadWebLLMBtn.innerHTML = `
            <span id="loadWebLLMSpinner" class="spinner-border spinner-border-sm me-1" style="display:none;"></span>
            Load ${selectedModel.name}
        `;
    }
    
    if (loadWebLLMSpinner) loadWebLLMSpinner.style.display = 'none';
    if (modelSelect) modelSelect.disabled = false;
}

/**
 * Handle asking WebLLM a question
 */
async function handleAskWebLLM() {
    const questionInput = document.getElementById('webllmQuestionInput');
    const askWebLLMBtn = document.getElementById('askWebLLMBtn');
    const askWebLLMSpinner = document.getElementById('askWebLLMSpinner');
    const responseDiv = document.getElementById('webllmResponseDiv');
    const responseText = document.getElementById('webllmResponseText');
    const clearResponseBtn = document.getElementById('clearWebLLMResponseBtn');
    const streamingCheckbox = document.getElementById('streamingCheckbox');
    
    const currentModel = getCurrentModelInfo();
    const modelName = currentModel?.name || 'the model';
    
    const question = questionInput?.value?.trim();
    if (!question) {
        alert('Please enter a question.');
        return;
    }
    
    if (!modelLoaded) {
        alert(`Please load ${modelName} first.`);
        return;
    }
    
    askWebLLMBtn.disabled = true;
    askWebLLMSpinner.style.display = '';
    responseDiv.style.display = '';
    responseText.innerHTML = '<div class="text-muted"><em>Generating response...</em></div>';
    
    try {
        const prsResults = window.prsResults ?? [];
        const prompt = buildPRSPrompt(prsResults, question);
        
        // console.log('WebLLM Prompt:', prompt);
        
        if (streamingCheckbox?.checked) {
            // Streaming response
            responseText.innerHTML = '';
            for await (const chunk of generateStreamingResponse(prompt)) {
                responseText.innerHTML += chunk.replace(/\n/g, '<br>');
            }
        } else {
            // Non-streaming response
            const response = await generateResponse(prompt);
            // console.log('WebLLM Response:', response);
            responseText.innerHTML = `<p>${response.replace(/\n/g, '<br>')}</p>`;
        }
        
        clearResponseBtn.style.display = '';
        
    } catch (err) {
        console.error('Error generating WebLLM response:', err);
        responseText.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
    
    askWebLLMBtn.disabled = false;
    askWebLLMSpinner.style.display = 'none';
}

// Expose functions globally
window.renderWebLLM = renderWebLLM;
window.initWebLLMModel = initModel;
window.clearWebLLMCache = clearModelCache;
window.unloadWebLLMModel = unloadModel;

export {
    renderWebLLM,
    initModel,
    unloadModel,
    clearModelCache,
    generateResponse,
    generateStreamingResponse,
    buildPRSPrompt,
    AVAILABLE_MODELS,
    getCurrentModelInfo
};
