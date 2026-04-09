/**
 * Transformers.js Module - Local AI inference using Transformers.js
 * Runs Flan-T5 language model in the browser for PRS result analysis
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
const MODEL_ID = 'Xenova/flan-t5-base';

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
 * Uses detailed matched data from window.matchedResults when available
 */
function buildPRSPrompt(results, question) {
    if (!results || results.length === 0) {
        return `Question about polygenic risk scores: ${question}\n\nAnswer:`;
    }
    
    // Check for detailed matched data from window.matchedResults (processed all results)
    const matchedResults = window.matchedResults ?? {};
    const hasMatchedResults = Object.keys(matchedResults).length > 0;
    
    let detailedAnalysis = '';
    
    if (hasMatchedResults) {
        detailedAnalysis = '\nDetailed variant analysis for all results:\n';
        
        Object.entries(matchedResults).forEach(([key, data]) => {
            const md = data.matchedData;
            if (!md) return;
            
            const totalVariants = (md.matched?.dt?.length ?? 0) + (md.not_matched?.dt?.length ?? 0);
            const matchedCount = md.matched?.dt?.length ?? 0;
            const matchRate = totalVariants > 0 ? ((matchedCount / totalVariants) * 100).toFixed(1) : 0;
            
            // Allele distribution
            const zeroAlleles = md.matched_by_alleles?.zero_allele?.count ?? 0;
            const oneAllele = md.matched_by_alleles?.one_allele?.count ?? 0;
            const twoAlleles = md.matched_by_alleles?.two_allele?.count ?? 0;
            
            // Beta sums
            const betaSums = md.betaSums ?? {};
            
            detailedAnalysis += `
${data.userId}${data.userName ? ` (${data.userName})` : ''} - ${data.pgsId} (${data.trait || 'trait unknown'}):
  PRS: ${typeof data.PRS === 'number' ? data.PRS.toFixed(4) : 'N/A'}
  Variants: ${matchedCount}/${totalVariants} matched (${matchRate}%)
  Allele distribution: 0-allele=${zeroAlleles}, 1-allele=${oneAllele}, 2-allele=${twoAlleles}
  Beta sums: matched(+)=${(betaSums.matchedPositive ?? 0).toFixed(4)}, matched(-)=${(betaSums.matchedNegative ?? 0).toFixed(4)}`;
            
            // Top contributors
            if (md.topContributors && md.topContributors.length > 0) {
                detailedAnalysis += '\n  Top contributors: ';
                detailedAnalysis += md.topContributors.slice(0, 3).map(c => 
                    `${c.chrPos}(β×z=${c.score.toFixed(3)})`
                ).join(', ');
            }
            detailedAnalysis += '\n';
        });
    } else {
        // Fallback to window.PGS23.data for single selected result
        const plotData = window.PGS23?.data;
        
        if (plotData && plotData.plot) {
            const matched = plotData.plot.matched;
            const notMatched = plotData.plot.not_matched;
            const matchedByAlleles = plotData.plot.matched_by_alleles;
            
            const totalVariants = (matched?.dt?.length ?? 0) + (notMatched?.dt?.length ?? 0);
            const matchedCount = matched?.dt?.length ?? 0;
            const matchRate = totalVariants > 0 ? ((matchedCount / totalVariants) * 100).toFixed(1) : 0;
            
            const matchedBetaSum = matched?.risk?.reduce((a, b) => a + b, 0) ?? 0;
            const unmatchedBetaSum = notMatched?.risk?.reduce((a, b) => a + b, 0) ?? 0;
            
            const zeroAlleles = matchedByAlleles?.zero_allele?.dt?.length ?? 0;
            const oneAllele = matchedByAlleles?.one_allele?.dt?.length ?? 0;
            const twoAlleles = matchedByAlleles?.two_allele?.dt?.length ?? 0;
            
            detailedAnalysis = `
Detailed variant analysis (selected result only):
- Total variants in score: ${totalVariants}
- Matched to genome: ${matchedCount} (${matchRate}%)
- Unmatched: ${notMatched?.dt?.length ?? 0}
- Sum of matched betas: ${matchedBetaSum.toFixed(4)}
- Sum of unmatched betas: ${unmatchedBetaSum.toFixed(4)}
- Allele distribution: 0-allele=${zeroAlleles}, 1-allele=${oneAllele}, 2-allele=${twoAlleles}
`;
        }
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
${detailedAnalysis}
Question: ${question}

Provide a brief, helpful response:`;
    
    return prompt;
}

/**
 * Render the Ask AI tab content
 */
function rendertransformersjs() {
    const container = document.getElementById('transformersjsDiv');
    if (!container) return;
    
    const prsResults = window.prsResults ?? [];
    console.log("Rendering Ask AI tab with PRS results:", prsResults);
    const hasResults = prsResults.length > 0;
    const matchedResults = window.matchedResults ?? {};
    const hasMatchedResults = Object.keys(matchedResults).length > 0;
    
    container.innerHTML = `
        ${!hasResults ? `
            <div class="alert alert-info">
                <strong>No PRS results available.</strong><br>
                Please go to the <strong>Calculate PRS</strong> tab first and run a PRS calculation. <a href="#" onclick="document.querySelector('.tablinks[onclick*=PRS]').click(); return false;">Go to Calculate PRS →</a>
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
                Load Flan-T5 Model
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
                ${hasMatchedResults ? `
                    <div class="alert alert-success py-2 small">
                        <strong>✓ Detailed variant analysis available for ${Object.keys(matchedResults).length} result(s)</strong> - 
                        The AI has access to allele distributions, top contributing variants, and beta values for all results.
                    </div>
                ` : `
                    <div class="alert alert-warning py-2 small">
                        <strong>Tip:</strong> Visit the <strong>Plot PRS</strong> tab first to give the AI detailed 
                        variant analysis (allele distributions, top contributors, beta values) for all results.
                    </div>
                `}
            </div>
        ` : ''}
        
        <div class="mb-3">
            <label for="aiQuestionInput" class="form-label"><strong>Ask Flan-T5 about your PRS results:</strong></label>
            <textarea id="aiQuestionInput" class="form-control" rows="3" 
                placeholder="Enter your question here..."
                ${!hasResults ? 'disabled' : ''}>What do these PRS results suggest about genetic risk? Which variants contribute most to the score?</textarea>
        </div>
        
        <div class="mb-3">
            <button id="transformersjsBtn" class="btn btn-success" ${!hasResults ? 'disabled' : ''}>
                <span id="transformersjsSpinner" class="spinner-border spinner-border-sm me-1" style="display:none;"></span>
                Ask Flan-T5
            </button>
            <button id="clearResponseBtn" class="btn btn-outline-secondary ms-2" style="display:none;">Clear</button>
        </div>
        
        <div id="aiResponseDiv" class="mt-3" style="display:none;">
            <div class="card">
                <div class="card-header"><strong>Flan-T5 Response</strong></div>
                <div class="card-body">
                    <div id="aiResponseText"></div>
                </div>
            </div>
        </div>
        
        <div class="mt-4 small text-muted">
            <strong>Note:</strong> This uses 
            <a href="https://huggingface.co/docs/transformers.js" target="_blank">Transformers.js</a> 
            to run Google's Flan-T5 model locally in your browser.
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
    const transformersjsBtn = document.getElementById('transformersjsBtn');
    const clearResponseBtn = document.getElementById('clearResponseBtn');
    
    if (loadModelBtn) {
        loadModelBtn.onclick = handleLoadModel;
    }
    
    if (transformersjsBtn) {
        transformersjsBtn.onclick = handletransformersjs;
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
async function handletransformersjs() {
    const questionInput = document.getElementById('aiQuestionInput');
    const transformersjsBtn = document.getElementById('transformersjsBtn');
    const transformersjsSpinner = document.getElementById('transformersjsSpinner');
    const responseDiv = document.getElementById('aiResponseDiv');
    const responseText = document.getElementById('aiResponseText');
    const clearResponseBtn = document.getElementById('clearResponseBtn');
    
    const question = questionInput?.value?.trim();
    if (!question) {
        alert('Please enter a question.');
        return;
    }
    
    if (!modelLoaded) {
        alert('Please load the Flan-T5 model first.');
        return;
    }
    
    transformersjsBtn.disabled = true;
    transformersjsSpinner.style.display = '';
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
    
    transformersjsBtn.disabled = false;
    transformersjsSpinner.style.display = 'none';
}

// Expose functions globally
window.rendertransformersjs = rendertransformersjs;
window.initAIModel = initModel;

export {
    rendertransformersjs,
    initModel,
    generateResponse,
    buildPRSPrompt
};
