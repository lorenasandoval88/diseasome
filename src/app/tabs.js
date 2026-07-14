// logic in tabs.js to show only the selected category panel 
let pgsModuleLoaded = false;
let localDataModuleLoaded = false;


// the PGS and 23andMe tables lazy-load on first tab click by moving their initialization 
// code into separate modules and importing them here on demand. 
// This keeps the initial load faster and avoids unnecessary fetches until the user actually clicks those tabs. 
// The try/catch blocks ensure that any errors during dynamic import or rendering are logged without breaking 
// the tab functionality.
async function ensurePgsModuleLoaded() {
    if (!pgsModuleLoaded) {
        await import("./displayScores.js");
        pgsModuleLoaded = true;
    }
}

async function ensureLocalDataModuleLoaded() {
    if (!localDataModuleLoaded) {
        await import("./displayUsers.js");
        localDataModuleLoaded = true;
    }
}

async function tabFunction(evt, openTab, subTab) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");

    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    if(subTab) {
      var parent = evt.currentTarget.closest('.tabcontent');
      parent.style.display = "block";
      parent.className += " active";
    }
    document.getElementById(openTab).style.display = "block";
    evt.currentTarget.className += " active";

        if (openTab === 'PGSCatalog') {
            try { await ensurePgsModuleLoaded(); } catch (e) { console.error('PGS module load error', e); }
        }
        if (openTab === 'GenomicData') {
            try { await ensureLocalDataModuleLoaded(); } catch (e) { console.error('GenomicData module load error', e); }
            if (typeof window.renderLocalUsers === 'function') {
                try { window.renderLocalUsers(); } catch (e) { console.error('renderLocalUsers error', e); }
            }
        }
        if (openTab === 'PlotPRS' && typeof window.renderPlotPRS === 'function') {
            try { window.renderPlotPRS(); } catch (e) { console.error('renderPlotPRS error', e); }
        }
        if (openTab === 'Cluster' && typeof window.renderCluster === 'function') {
            try { window.renderCluster(); } catch (e) { console.error('renderCluster error', e); }
        }
        if (openTab === 'AIInterpret') {
            try { selectAIMode(window.currentAIMode || 'cloud'); } catch (e) { console.error('selectAIMode error', e); }
        }

}

// Switch between the three AI interpretation modes inside the unified AI Interpret tab.
// Local model UIs are rendered lazily the first time their mode is shown so the heavy
// WebLLM / Transformers.js models are not loaded until the user asks for them.
function selectAIMode(mode) {
    const panels = { cloud: 'aiModeCloud', webllm: 'aiModeWebLLM', transformers: 'aiModeTransformers' };
    const buttons = { cloud: 'aiModeCloudBtn', webllm: 'aiModeWebLLMBtn', transformers: 'aiModeTransformersBtn' };

    if (!panels[mode]) mode = 'cloud';

    Object.values(panels).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    Object.values(buttons).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });

    const panel = document.getElementById(panels[mode]);
    const btn = document.getElementById(buttons[mode]);
    if (panel) panel.style.display = 'block';
    if (btn) btn.classList.add('active');
    window.currentAIMode = mode;

    if (mode === 'webllm' && typeof window.renderWebLLM === 'function') {
        try { window.renderWebLLM(); } catch (e) { console.error('renderWebLLM error', e); }
    }
    if (mode === 'transformers' && typeof window.rendertransformersjs === 'function') {
        try { window.rendertransformersjs(); } catch (e) { console.error('rendertransformersjs error', e); }
    }
}

window.tabFunction = tabFunction;
window.selectAIMode = selectAIMode;

export {
    tabFunction
}



