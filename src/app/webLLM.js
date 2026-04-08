/**
 * WebLLM Module - Local AI inference using WebLLM with Phi-3 Mini
 * Runs Phi-3 Mini language model in the browser via WebGPU
 */

import * as webllm from "https://esm.run/@mlc-ai/web-llm";

// Model state
let engine = null;
let isModelLoading = false;
let modelLoaded = false;

// Use Phi-3 Mini model
const MODEL_ID = "Phi-3-mini-4k-instruct-q4f16_1-MLC";

/**
 * Initialize the WebLLM engine with Phi-3 Mini
 */
async function initModel(progressCallback) {
    if (modelLoaded && engine) return engine;
    if (isModelLoading) return null;
    
    isModelLoading = true;
    
    try {
        engine = await webllm.CreateMLCEngine(MODEL_ID, {
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
        isModelLoading = false;
        return engine;
    } catch (err) {
        isModelLoading = false;
        throw err;
    }
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
    
    // Summarize PRS results
    const summaries = results.slice(0, 5).map(r => {
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
    
    container.innerHTML = `
        ${!hasResults ? `
            <div class="alert alert-info">
                <strong>No PRS results available.</strong><br>
                Please go to the <strong>Calculate PRS</strong> tab first and run a PRS calculation.
            </div>
        ` : ''}
        
        <div class="mb-3">
            <div id="webllmStatusDiv" class="alert alert-secondary">
                <strong>Model Status:</strong> <span id="webllmStatusText">Not loaded</span>
                <div id="webllmProgressDiv" class="progress mt-2" style="display:none; height: 20px;">
                    <div id="webllmProgressBar" class="progress-bar progress-bar-striped progress-bar-animated" 
                         role="progressbar" style="width: 0%"></div>
                </div>
                <div id="webllmProgressText" class="small text-muted mt-1" style="display:none;"></div>
            </div>
            <button id="loadWebLLMBtn" class="btn btn-primary btn-sm">
                <span id="loadWebLLMSpinner" class="spinner-border spinner-border-sm me-1" style="display:none;"></span>
                Load Phi-3 Mini
            </button>
            <small class="text-muted ms-2">~2GB download, requires WebGPU-enabled browser</small>
        </div>
        
        <div class="alert alert-warning small">
            <strong>Requirements:</strong> WebGPU support (Chrome 113+, Edge 113+). 
            The model runs entirely on your GPU - no data leaves your browser.
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
                        <strong>Tip:</strong> Visit the <strong>Plot PRS</strong> tab first to give the AI detailed variant analysis.
                    </div>
                `}
            </div>
        ` : ''}
        
        <div class="mb-3">
            <label for="webllmQuestionInput" class="form-label"><strong>Ask Phi-3 Mini about your PRS results:</strong></label>
            <textarea id="webllmQuestionInput" class="form-control" rows="3" 
                placeholder="Enter your question here..."
                ${!hasResults ? 'disabled' : ''}>What do these PRS results suggest about genetic risk? Please explain the significance of the beta values and allele distributions.</textarea>
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
                Ask Phi-3 Mini
            </button>
            <button id="clearWebLLMResponseBtn" class="btn btn-outline-secondary ms-2" style="display:none;">Clear</button>
        </div>
        
        <div id="webllmResponseDiv" class="mt-3" style="display:none;">
            <div class="card">
                <div class="card-header"><strong>Phi-3 Mini Response</strong></div>
                <div class="card-body">
                    <div id="webllmResponseText"></div>
                </div>
            </div>
        </div>
        
        <div class="mt-4 small text-muted">
            <strong>Note:</strong> This uses <a href="https://github.com/mlc-ai/web-llm" target="_blank">WebLLM</a> 
            to run Microsoft's Phi-3 Mini model locally in your browser via WebGPU. 
            No data is sent to external servers. The model provides general information and should not 
            be considered medical advice.
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
    
    if (modelLoaded) {
        statusText.textContent = 'Already loaded!';
        return;
    }
    
    // Check for WebGPU support
    if (!navigator.gpu) {
        statusText.textContent = 'WebGPU not supported in this browser';
        statusDiv.className = 'alert alert-danger';
        return;
    }
    
    loadWebLLMBtn.disabled = true;
    loadWebLLMSpinner.style.display = '';
    statusText.textContent = 'Initializing WebGPU...';
    progressDiv.style.display = '';
    progressText.style.display = '';
    statusDiv.className = 'alert alert-warning';
    
    try {
        await initModel((progress) => {
            const pct = Math.round(progress.progress * 100);
            progressBar.style.width = `${pct}%`;
            progressBar.textContent = `${pct}%`;
            statusText.textContent = 'Loading model...';
            progressText.textContent = progress.text;
        });
        
        statusText.textContent = 'Phi-3 Mini loaded and ready!';
        statusDiv.className = 'alert alert-success';
        progressDiv.style.display = 'none';
        progressText.style.display = 'none';
        loadWebLLMBtn.textContent = 'Model Loaded ✓';
        loadWebLLMBtn.className = 'btn btn-success btn-sm';
        
    } catch (err) {
        console.error('Error loading WebLLM model:', err);
        statusText.textContent = `Error: ${err.message}`;
        statusDiv.className = 'alert alert-danger';
        loadWebLLMBtn.disabled = false;
    }
    
    loadWebLLMSpinner.style.display = 'none';
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
    
    const question = questionInput?.value?.trim();
    if (!question) {
        alert('Please enter a question.');
        return;
    }
    
    if (!modelLoaded) {
        alert('Please load the Phi-3 Mini model first.');
        return;
    }
    
    askWebLLMBtn.disabled = true;
    askWebLLMSpinner.style.display = '';
    responseDiv.style.display = '';
    responseText.innerHTML = '<div class="text-muted"><em>Generating response...</em></div>';
    
    try {
        const prsResults = window.prsResults ?? [];
        const prompt = buildPRSPrompt(prsResults, question);
        
        console.log('WebLLM Prompt:', prompt);
        
        if (streamingCheckbox?.checked) {
            // Streaming response
            responseText.innerHTML = '';
            for await (const chunk of generateStreamingResponse(prompt)) {
                responseText.innerHTML += chunk.replace(/\n/g, '<br>');
            }
        } else {
            // Non-streaming response
            const response = await generateResponse(prompt);
            console.log('WebLLM Response:', response);
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

export {
    renderWebLLM,
    initModel,
    generateResponse,
    generateStreamingResponse,
    buildPRSPrompt
};
