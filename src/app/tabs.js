// logic in tabs.js to show only the selected category panel 
function tabFunction(evt, openTab, subTab) {
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
        if (openTab === 'LocalData' && typeof window.renderLocalUsers === 'function') {
            try { window.renderLocalUsers(); } catch (e) { console.error('renderLocalUsers error', e); }
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



