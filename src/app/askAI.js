/**
 * Ask AI Module - Local AI inference using Transformers.js
 * Runs a small language model in the browser for PRS result analysis
 */

import { pipeline, env } from '@xenova/transformers';

// Configure Transformers.js for browser use
env.allowLocalModels = false;
env.useBrowserCache = true;

// Model state
let generator = null;
let isModelLoading = false;
let modelLoaded = false;

// Use a small, efficient model for browser inference
const MODEL_ID = 'Xenova/LaMini-Flan-T5-248M';

/**
 * Initialize the text generation pipeline
 */
async function initModel(progressCallback) {
    if (modelLoaded && generator) return generator;
    if (isModelLoading) return null;
    
    isModelLoading = true;
    
    try {
        generator = await pipeline('text2text-generation', MODEL_ID, {
            progress_callback: progressCallback
        });
        modelLoaded = true;
        isModelLoading = false;
        return generator;
    } catch (err) {
        isModelLoading = false;
        throw err;
    }
}

/**
 * Generate AI response based on PRS results
 */
async function generateResponse(prompt, maxLength = 256) {
    if (!generator) {
        throw new Error('Model not initialized. Please load the model first.');
    }
    
    const result = await generator(prompt, {
        max_new_tokens: maxLength,
        temperature: 0.7,
        do_sample: true,
        top_p: 0.9
    });
    
    return result[0].generated_text;
}

/**
 * Build a prompt from PRS results for AI analysis
 */
function buildPRSPrompt(results, question) {
    if (!results || results.length === 0) {
        return `Question about polygenic risk scores: ${question}\n\nAnswer:`;
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
    
    const prompt = `You are an expert in genomics and polygenic risk scores. Analyze these PRS results:

${summaries}

Question: ${question}

Provide a brief, helpful response:`;
    
    return prompt;
}

/**
 * Render the Ask AI tab content
 */
function renderAskAI() {
    const container = document.getElementById('askAIDiv');
    if (!container) return;
    
    const prsResults = window.prsResults ?? [];
    const hasResults = prsResults.length > 0;
    
    container.innerHTML = `
        ${!hasResults ? `
            <div class="alert alert-info">
                <strong>No PRS results available.</strong><br>
                Please go to the <strong>Calculate PRS</strong> tab first and run a PRS calculation.
            </div>
        ` : ''}
        
        <div class="mb-3">
            <div id="modelStatusDiv" class="alert alert-secondary">
                <strong>Model Status:</strong> <span id="modelStatusText">Not loaded</span>
                <div id="modelProgressDiv" class="progress mt-2" style="display:none; height: 20px;">
                    <div id="modelProgressBar" class="progress-bar progress-bar-striped progress-bar-animated" 
                         role="progressbar" style="width: 0%"></div>
                </div>
            </div>
            <button id="loadModelBtn" class="btn btn-primary btn-sm">
                <span id="loadModelSpinner" class="spinner-border spinner-border-sm me-1" style="display:none;"></span>
                Load AI Model
            </button>
            <small class="text-muted ms-2">~250MB download, runs locally in browser</small>
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
            </div>
        ` : ''}
        
        <div class="mb-3">
            <label for="aiQuestionInput" class="form-label"><strong>Ask a question about your PRS results:</strong></label>
            <textarea id="aiQuestionInput" class="form-control" rows="3" 
                placeholder="Example: What do these PRS results suggest about genetic risk? Which variants contribute most to the score?"
                ${!hasResults ? 'disabled' : ''}></textarea>
        </div>
        
        <div class="mb-3">
            <button id="askAIBtn" class="btn btn-success" ${!hasResults ? 'disabled' : ''}>
                <span id="askAISpinner" class="spinner-border spinner-border-sm me-1" style="display:none;"></span>
                Ask AI
            </button>
            <button id="clearResponseBtn" class="btn btn-outline-secondary ms-2" style="display:none;">Clear</button>
        </div>
        
        <div id="aiResponseDiv" class="mt-3" style="display:none;">
            <div class="card">
                <div class="card-header"><strong>AI Response</strong></div>
                <div class="card-body">
                    <div id="aiResponseText"></div>
                </div>
            </div>
        </div>
        
        <div class="mt-4 small text-muted">
            <strong>Note:</strong> This AI runs entirely in your browser using 
            <a href="https://huggingface.co/docs/transformers.js" target="_blank">Transformers.js</a>. 
            No data is sent to external servers. The model provides general information and should not 
            be considered medical advice.
        </div>
    `;
    
    // Attach event handlers
    attachAIEventHandlers();
}

/**
 * Attach event handlers for the AI tab
 */
function attachAIEventHandlers() {
    const loadModelBtn = document.getElementById('loadModelBtn');
    const askAIBtn = document.getElementById('askAIBtn');
    const clearResponseBtn = document.getElementById('clearResponseBtn');
    
    if (loadModelBtn) {
        loadModelBtn.onclick = handleLoadModel;
    }
    
    if (askAIBtn) {
        askAIBtn.onclick = handleAskAI;
    }
    
    if (clearResponseBtn) {
        clearResponseBtn.onclick = () => {
            const responseDiv = document.getElementById('aiResponseDiv');
            if (responseDiv) responseDiv.style.display = 'none';
            clearResponseBtn.style.display = 'none';
        };
    }
}

/**
 * Handle loading the AI model
 */
async function handleLoadModel() {
    const loadModelBtn = document.getElementById('loadModelBtn');
    const loadModelSpinner = document.getElementById('loadModelSpinner');
    const modelStatusText = document.getElementById('modelStatusText');
    const modelProgressDiv = document.getElementById('modelProgressDiv');
    const modelProgressBar = document.getElementById('modelProgressBar');
    const modelStatusDiv = document.getElementById('modelStatusDiv');
    
    if (modelLoaded) {
        modelStatusText.textContent = 'Already loaded!';
        return;
    }
    
    loadModelBtn.disabled = true;
    loadModelSpinner.style.display = '';
    modelStatusText.textContent = 'Loading model...';
    modelProgressDiv.style.display = '';
    modelStatusDiv.className = 'alert alert-warning';
    
    try {
        await initModel((progress) => {
            if (progress.status === 'progress') {
                const pct = Math.round((progress.loaded / progress.total) * 100);
                modelProgressBar.style.width = `${pct}%`;
                modelProgressBar.textContent = `${pct}%`;
                modelStatusText.textContent = `Downloading ${progress.file}... ${pct}%`;
            } else if (progress.status === 'done') {
                modelStatusText.textContent = `Loaded ${progress.file}`;
            } else if (progress.status === 'ready') {
                modelStatusText.textContent = 'Model ready!';
            }
        });
        
        modelStatusText.textContent = 'Model loaded and ready!';
        modelStatusDiv.className = 'alert alert-success';
        modelProgressDiv.style.display = 'none';
        loadModelBtn.textContent = 'Model Loaded ✓';
        loadModelBtn.className = 'btn btn-success btn-sm';
        
    } catch (err) {
        console.error('Error loading model:', err);
        modelStatusText.textContent = `Error: ${err.message}`;
        modelStatusDiv.className = 'alert alert-danger';
        loadModelBtn.disabled = false;
    }
    
    loadModelSpinner.style.display = 'none';
}

/**
 * Handle asking AI a question
 */
async function handleAskAI() {
    const questionInput = document.getElementById('aiQuestionInput');
    const askAIBtn = document.getElementById('askAIBtn');
    const askAISpinner = document.getElementById('askAISpinner');
    const responseDiv = document.getElementById('aiResponseDiv');
    const responseText = document.getElementById('aiResponseText');
    const clearResponseBtn = document.getElementById('clearResponseBtn');
    
    const question = questionInput?.value?.trim();
    if (!question) {
        alert('Please enter a question.');
        return;
    }
    
    if (!modelLoaded) {
        alert('Please load the AI model first.');
        return;
    }
    
    askAIBtn.disabled = true;
    askAISpinner.style.display = '';
    responseDiv.style.display = '';
    responseText.innerHTML = '<div class="text-muted"><em>Generating response...</em></div>';
    
    try {
        const prsResults = window.prsResults ?? [];
        const prompt = buildPRSPrompt(prsResults, question);
        
        console.log('AI Prompt:', prompt);
        const response = await generateResponse(prompt);
        console.log('AI Response:', response);
        
        responseText.innerHTML = `<p>${response.replace(/\n/g, '<br>')}</p>`;
        clearResponseBtn.style.display = '';
        
    } catch (err) {
        console.error('Error generating response:', err);
        responseText.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
    
    askAIBtn.disabled = false;
    askAISpinner.style.display = 'none';
}

// Expose functions globally
window.renderAskAI = renderAskAI;
window.initAIModel = initModel;

export {
    renderAskAI,
    initModel,
    generateResponse,
    buildPRSPrompt
};
