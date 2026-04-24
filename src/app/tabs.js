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
        if (openTab === 'LocalData') {
            try { await ensureLocalDataModuleLoaded(); } catch (e) { console.error('LocalData module load error', e); }
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
        if (openTab === 'transformersjs' && typeof window.rendertransformersjs === 'function') {
            try { window.rendertransformersjs(); } catch (e) { console.error('rendertransformersjs error', e); }
        }
        if (openTab === 'WebLLM' && typeof window.renderWebLLM === 'function') {
            try { window.renderWebLLM(); } catch (e) { console.error('renderWebLLM error', e); }
        }

}

window.tabFunction = tabFunction;

export {
    tabFunction
}



