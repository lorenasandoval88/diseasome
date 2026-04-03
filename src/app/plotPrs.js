/**
 * PRS Visualization Functions
 * Plotly-based visualizations for PRS calculation results
 */
import localforage from "localforage";

/**
 * Clear PGS scoring file cache (pgs:PGS* keys only, not trait/category summaries)
 */
async function clearPGSCache() {
    const keys = await localforage.keys();
    // Only clear keys like "pgs:id-PGS000001", not "pgs:trait-summary" or "pgs:all-score-summary"
    const pgsKeys = keys.filter(k => k.startsWith('pgs:id-PGS'));
    for (const key of pgsKeys) {
        await localforage.removeItem(key);
    }
    console.log(`PGS scoring cache cleared: removed ${pgsKeys.length} item(s)`);
    return pgsKeys.length;
}
window.clearPGSCache = clearPGSCache;

/**
 * Clear genome/23andMe cache (Genome:id-* keys only, not metadata)
 */
async function clearGenomeCache() {
    const keys = await localforage.keys();
    // Only clear keys like "Genome:id-hu09B28E", not metadata keys
    const genomeKeys = keys.filter(k => k.startsWith('Genome:id-'));
    for (const key of genomeKeys) {
        await localforage.removeItem(key);
    }
    console.log(`Genome cache cleared: removed ${genomeKeys.length} item(s)`);
    return genomeKeys.length;
}
window.clearGenomeCache = clearGenomeCache;

/**
 * Display file inspection links for the selected result
 * @param {Object} result - The PRS result object
 */
function inspectFiles(result) {
    const div = document.getElementById('inspectFilesDiv');
    if (!div) return;
    
    const userId = result.userId ?? 'Unknown';
    const userName = result.userName ? ` (${result.userName})` : '';
    const pgsId = result.pgsId ?? 'Unknown';
    const pgsNum = pgsId.replace(/^PGS0*/, '');
    
    // Build PGS Catalog link
    const pgsCatalogUrl = `https://www.pgscatalog.org/score/${pgsId}/`;
    const pgsDownloadUrl = `https://ftp.ebi.ac.uk/pub/databases/spot/pgs/scores/${pgsId}/ScoringFiles/${pgsId}.txt.gz`;
    
    div.style.display = '';
    div.innerHTML = `
        <div class="card">
            <div class="card-body py-2">
                <div class="row">
                    <div class="col-md-6">
                        <strong>23andMe Genome:</strong> ${userId}${userName}<br>
                        <button class="btn btn-sm btn-outline-primary mt-1" onclick="window.inspect23File('${userId}')">
                            <i class="bi bi-file-text"></i> Inspect Genome
                        </button>
                    </div>
                    <div class="col-md-6">
                        <strong>PGS File:</strong> <a href="${pgsCatalogUrl}" target="_blank">${pgsId}</a><br>
                        <button class="btn btn-sm btn-outline-primary mt-1" onclick="window.inspectPGSFile('${pgsId}')">
                            <i class="bi bi-file-text"></i> Inspect PGS
                        </button>
                        <a href="${pgsDownloadUrl}" target="_blank" class="btn btn-sm btn-outline-secondary mt-1">
                            <i class="bi bi-download"></i> Download
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Inspect 23andMe genome file from cache - raw text with pagination
 */
window.inspect23File = async function(userId) {
    const modal = createInspectModal();
    modal.title.textContent = `23andMe Genome: ${userId}`;
    modal.body.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div><br>Loading...</div>';
    modal.show();
    
    try {
        const cacheKey = `Genome:id-${userId}`;
        const cached = await localforage.getItem(cacheKey);
        
        // SDK caches under .data, local caching uses .dt
        const genomeData = cached?.data ?? cached;
        if (genomeData && genomeData.dt) {
            window._inspectData = { data: genomeData, type: '23andMe', id: userId };
            renderInspectPage(0);
        } else {
            modal.body.innerHTML = `<div class="alert alert-warning">
                <strong>Genome data not found in cache.</strong><br>
                This can happen if PRS was calculated before genome caching was enabled.<br><br>
                <strong>To fix:</strong>
                <ol>
                    <li>Go to the <strong>Calculate PRS</strong> tab</li>
                    <li>Click <strong>Clear PRS Cache</strong></li>
                    <li>Recalculate PRS</li>
                </ol>
            </div>`;
        }
    } catch (err) {
        modal.body.innerHTML = `<div class="alert alert-danger">Error loading genome: ${err.message}</div>`;
    }
};

/**
 * Inspect PGS scoring file from cache - raw text with pagination
 */
window.inspectPGSFile = async function(pgsId) {
    const modal = createInspectModal();
    modal.title.textContent = `PGS Scoring File: ${pgsId}`;
    modal.body.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div><br>Loading...</div>';
    modal.show();
    
    try {
        const cacheKey = `pgs:id-${pgsId}`;
        const cached = await localforage.getItem(cacheKey);
        
        if (cached && cached.dt) {
            window._inspectData = { data: cached, type: 'PGS', id: pgsId };
            renderInspectPage(0);
        } else {
            modal.body.innerHTML = '<div class="alert alert-warning">PGS data not found in cache. Try recalculating PRS.</div>';
        }
    } catch (err) {
        modal.body.innerHTML = `<div class="alert alert-danger">Error loading PGS: ${err.message}</div>`;
    }
};

/**
 * Render a page of raw text data with pagination
 */
function renderInspectPage(page) {
    const body = document.getElementById('inspectModalBody');
    const { data, type, id } = window._inspectData;
    const pageSize = 100;
    const totalRows = data.dt.length;
    const totalPages = Math.ceil(totalRows / pageSize);
    const start = page * pageSize;
    const end = Math.min(start + pageSize, totalRows);
    const cols = data.cols || (type === '23andMe' ? ['rsid', 'chromosome', 'position', 'genotype'] : ['rsID', 'hm_chr', 'hm_pos', 'effect_allele', 'effect_weight']);
    
    // Build header info
    let html = '<div class="mb-2">';
    html += `<strong>Total rows:</strong> ${totalRows} | `;
    html += `<strong>Showing:</strong> ${start + 1} - ${end} | `;
    html += `<strong>Page:</strong> ${page + 1} of ${totalPages}`;
    html += '</div>';
    
    // Show metadata for PGS files (only on first page)
    // PGS files store meta.txt as array of raw header lines
    if (type === 'PGS' && data.meta && page === 0) {
        let metaText = '';
        if (data.meta.txt && Array.isArray(data.meta.txt)) {
            // Display raw header lines from the file
            metaText = data.meta.txt.join('\n');
        } else {
            // Fallback: build from key=value pairs
            metaText = '###PGS CATALOG SCORING FILE\n##METADATA\n';
            for (const [key, value] of Object.entries(data.meta)) {
                if (key !== 'txt' && value !== null && value !== undefined && value !== '') {
                    metaText += `#${key}=${value}\n`;
                }
            }
        }
        html += '<details open class="mb-2"><summary><strong>File Metadata</strong></summary>';
        html += `<pre style="max-height:200px; overflow-y:auto; background:#e9ecef; padding:10px; font-size:11px; white-space:pre; overflow-x:auto; margin-top:5px;">${metaText}</pre>`;
        html += '</details>';
    }
    
    // Show metadata for 23andMe files (only on first page)
    // SDK stores meta as a raw string of all comment lines joined by \r\n
    if (type === '23andMe' && page === 0) {
        let metaText = '';
        if (data.meta && typeof data.meta === 'string') {
            // Raw header lines from the file
            metaText = data.meta;
        } else if (data.meta && typeof data.meta === 'object') {
            // Fallback if meta is an object
            for (const [key, value] of Object.entries(data.meta)) {
                if (value !== null && value !== undefined && value !== '') {
                    metaText += `# ${key}: ${value}\n`;
                }
            }
        }
        metaText += `\n# Total variants: ${totalRows}`;
        metaText += `\n# Columns: ${cols.join(', ')}`;
        html += '<details open class="mb-2"><summary><strong>File Metadata</strong></summary>';
        html += `<pre style="max-height:200px; overflow-y:auto; background:#e9ecef; padding:10px; font-size:11px; white-space:pre; overflow-x:auto; margin-top:5px;">${metaText}</pre>`;
        html += '</details>';
    }
    
    // Pagination controls
    html += '<div class="btn-group mb-2">';
    html += `<button class="btn btn-sm btn-outline-primary" ${page === 0 ? 'disabled' : ''} onclick="renderInspectPage(0)">First</button>`;
    html += `<button class="btn btn-sm btn-outline-primary" ${page === 0 ? 'disabled' : ''} onclick="renderInspectPage(${page - 1})">Previous 100</button>`;
    html += `<button class="btn btn-sm btn-outline-primary" ${page >= totalPages - 1 ? 'disabled' : ''} onclick="renderInspectPage(${page + 1})">Next 100</button>`;
    html += `<button class="btn btn-sm btn-outline-primary" ${page >= totalPages - 1 ? 'disabled' : ''} onclick="renderInspectPage(${totalPages - 1})">Last</button>`;
    html += '</div>';
    
    // Raw text content
    const rows = data.dt.slice(start, end);
    const header = cols.join('\t');
    const text = rows.map(row => row.join('\t')).join('\n');
    
    html += `<pre style="max-height:400px; overflow-y:auto; background:#f8f9fa; padding:10px; font-size:11px; white-space:pre; overflow-x:auto;">${header}\n${text}</pre>`;
    
    // Bottom pagination
    html += '<div class="btn-group mt-2">';
    html += `<button class="btn btn-sm btn-outline-primary" ${page === 0 ? 'disabled' : ''} onclick="renderInspectPage(${page - 1})">Previous 100</button>`;
    html += `<button class="btn btn-sm btn-outline-primary" ${page >= totalPages - 1 ? 'disabled' : ''} onclick="renderInspectPage(${page + 1})">Next 100</button>`;
    html += '</div>';
    
    body.innerHTML = html;
}
window.renderInspectPage = renderInspectPage;

/**
 * Create or get the inspect modal
 */
function createInspectModal() {
    let modal = document.getElementById('inspectModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'inspectModal';
        modal.className = 'modal fade';
        modal.tabIndex = -1;
        modal.innerHTML = `
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="inspectModalTitle">Inspect File</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="inspectModalBody"></div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    const bsModal = new bootstrap.Modal(modal);
    return {
        title: document.getElementById('inspectModalTitle'),
        body: document.getElementById('inspectModalBody'),
        show: () => bsModal.show()
    };
}

/**
 * Plot pie chart showing total beta contribution for matched vs unmatched variants
 * @param {Object} data - PGS23.data object containing pgs and 23andMe match data
 */
function pieChart(data = PGS23.data) {
    const pieChartDiv = document.getElementById('pieChartDiv');
    if (!pieChartDiv) {
        console.warn('pieChartDiv not found');
        return;
    }
    pieChartDiv.style.height = 19 + 'em';

    // Show the heading when results are available
    const heading = document.getElementById('pieChartHeading');
    if (heading) heading.style.display = '';

    /* Plot percent of matched and not matched betas */
    const risk_composition = {};
    const risk1 = data.plot.matched.risk.reduce((partialSum, a) => partialSum + a, 0);
    const risk2 = data.plot.not_matched.risk.reduce((partialSum, a) => partialSum + a, 0);
    risk_composition[`total β for ${data.plot.matched.risk.length} <br>matched variants`] = risk1;
    risk_composition[`total β for ${data.plot.not_matched.risk.length} <br>unmatched variants`] = risk2;
    var y = Object.values(risk_composition);
    var x = Object.keys(risk_composition);
    var piePlotData = [{
        values: y,
        labels: x,
        insidetextorientation: "horizontal",
        textinfo: "percent",
        textposition: "inside",
        type: 'pie',
        marker: {
            colors: ["#2ca02c", "grey"],
            size: 19,
            line: {
                color: 'black'
            }
        },
        textfont: {
            color: 'black',
            size: 19
        },
        hoverlabel: {
            bgcolor: 'black',
            bordercolor: 'black',
            font: {
                color: 'white',
                size: 18
            }
        }
    }];
    var layout = {
        title: {
            text: ` PGS#${data.pgs.meta.pgs_id.replace(/^.*0+/, '')}: total β contribution for ${data.pgsMatchMy23.length} matched <br>and ${data.pgs.dt.length - data.pgsMatchMy23.length} unmatched variants`,
            font: {
                size: 19
            }
        },
        width: '20em',
        legend: {
            xanchor: "right",
            font: {
                size: 16
            }
        },
    };
    var config = {
        responsive: true
    };

    Plotly.newPlot('pieChartDiv', piePlotData, layout, config);
}

/**
 * Plot all matched variants by effect weight (beta)
 * Creates a scatter plot showing matched and unmatched variants sorted by effect
 * @param {Object} data - PGS23.data object containing pgs and 23andMe match data
 * @param {HTMLElement} dv2 - Error/alert div element
 * @param {HTMLElement} dv - Main plot div element
 */
function plotAllMatchByEffect4(data = PGS23.data, dv2 = document.getElementById('errorDiv'), dv = document.getElementById('plotAllMatchByEffectDiv')) {
    //https://community.plotly.com/t/fill-shade-a-chart-above-a-specific-y-value-in-plotlyjs/5133
console.log("plotAllMatchByEffect4 called with data", data)
    const obj = {}
    const indChr = data.pgs.cols.indexOf('hm_chr')
    const indPos = data.pgs.cols.indexOf('hm_pos')
    const indBeta = data.pgs.cols.indexOf('effect_weight')

    // QC to check when two or more 23andMe variants mapped to pgs variant
    if (!dv2) {
        dv2 = document.createElement('div')
        document.body.appendChild(dv2)
    }
    dv2.innerHTML = ''
    let duplicate = ''
    
    const matched = data.pgsMatchMy23.map(function (v) {
        //console.log("data.pgsMatchMy23",v)
        if (v.length == 2) {
            return v[1]

        } else if (v.length == 3) {
            console.log("two 23andme SNPS mapped to one pgs variant", v)
            duplicate += `<span style="font-size:small; color: blue">Alert : two 23andMe variants mapped to pgs variant : chr.position ${v[2][indChr] + "." + v[2][indPos]}<br>Only the first 23andMe variant is used: ${v[0]}</span><br>`
            dv2.innerHTML = duplicate
            return v[2]
        } else if (v.length > 3) {
            duplicate += `<span style="font-size:small; color: blue">Alert : more than two 23andMe variants mapped to a pgs variant<br>please check 23andMe file for duplicate chromosome.position</span><br>`
            dv2.innerHTML = duplicate
            console.log("more than 2 23andme SNPS mapped to one pgs variant", v)
            return v[2]
        }
    })
    console.log("matched variants", matched)
    // separate pgs.dt into 2 (matches and non matches) arrays and then sort by effect  
    // " matched" data

    const matched_risk = matched.map((j) => {
        return j[indBeta]
    })

    const matched_chrPos = matched.map(j => {
        return `Chr${j[indChr]}.${j[indPos]}`
    })
    obj['matched'] = {}
    obj.matched.chrPos = matched_chrPos
    obj.matched.dt = matched
    obj.matched.alleles = data.alleles
    obj.matched.risk = matched_risk
    obj.matched.category = Array(matched.length).fill("matched")

    //     // NON-MATCHED --------------------------------------------------------------------------------------------
    const notMatchData = data.pgs.dt.filter(element => !matched.includes(element)); // "not matched" data

    // sort by effect
    let not_matched_idx = [...Array(notMatchData.length)]
        .map((_, i) => i).sort((a, b) => (notMatchData[a][4] - notMatchData[b][4])) //match indexes
    const not_matched = not_matched_idx.map(j => {
        let xi = notMatchData[j]
        return xi
    })
    const not_matched_chrPos = not_matched.map(j => {
        return `Chr${j[indChr]}.${j[indPos]}`
    })

    const not_matched_risk = not_matched.map((yi, i) => yi[indBeta])

    obj['not_matched'] = {}
    obj.not_matched.chrPos = not_matched_chrPos
    obj.not_matched.dt = not_matched
    obj.not_matched.risk = not_matched_risk
    const fill_no_match = `${not_matched.length} not matched`
    obj.not_matched.category = Array(not_matched.length).fill(fill_no_match)
    obj.not_matched.size = Array(not_matched.length).fill("9")
    obj.not_matched.color = Array(not_matched.length).fill("rgb(140, 140, 140)")
    obj.not_matched.opacity = Array(not_matched.length).fill("0.5")
    obj.not_matched.symbol = Array(not_matched.length).fill("x")
    obj.not_matched.hoverinfo = Array(not_matched.length).fill("all")
    // ALL VARIANTS -------------------------------------------------------------------------------------
    const allData = data.pgs.dt

    let allData_idx = [...Array(allData.length)].map((_, i) => i).sort((a, b) => (allData[a][4] - allData[b][4])) //match indexes
    const allData_sorted = allData_idx.map(j => {
        let xi = allData[j]
        return xi
    })
    const allData_chrPos = allData.map(j => {
        return `Chr${j[indChr]}.${j[indPos]}`
    })

    const allData_risk = allData.map((yi, i) => yi[indBeta])

    obj['all'] = {}
    obj.all.chrPos = allData_chrPos
    obj.all.dt = allData_sorted
    obj.all.risk = allData_risk
    obj.all.category = Array(allData_sorted.length).fill(" ")
    obj.all.size = Array(allData_sorted.length).fill("10")
    obj.all.color = Array(allData_sorted.length).fill("green")
    obj.all.opacity = Array(allData_sorted.length).fill("0")
    obj.all.symbol = Array(allData_sorted.length).fill("square")
    obj.all.hoverinfo = Array(allData_sorted.length).fill("none")
    // MATCHED BY alleles---------------------------
    // separate data.pgsMatchMy23 into 3 (dosage #) arrays

    //https://stackoverflow.com/questions/40415231/how-to-get-an-array-of-values-based-on-an-array-of-indexes
    const zero_allele = matched.filter((ele, idx) => data.alleles[idx] == 0);
    const zero_allele_idx = data.alleles.map((elm, idx) => elm == 0 ? idx : '')
        .filter(String);
    const one_allele = matched.filter((ele, idx) => data.alleles[idx] == 1);
    const one_allele_idx = data.alleles.map((elm, idx) => elm == 1 ? idx : '')
        .filter(String);
    const two_allele = matched.filter((ele, idx) => data.alleles[idx] == 2);
    const two_allele_idx = data.alleles.map((elm, idx) => elm == 2 ? idx : '')
        .filter(String);

    // x (chr pos)  y (betas or betas*dosage) plot data
    const zero_allele_chrpos = zero_allele_idx.map(i => `Chr${matched[i][indChr]}.${matched[i][indPos]}`)
    const one_allele_chrpos = one_allele_idx.map(i => `Chr${matched[i][indChr]}.${matched[i][indPos]}`)
    const two_allele_chrpos = two_allele_idx.map(i => `Chr${matched[i][indChr]}.${matched[i][indPos]}`)

    obj['matched_by_alleles'] = {}
    obj.matched_by_alleles.zero_allele = {}
    obj.matched_by_alleles.one_allele = {}
    obj.matched_by_alleles.two_allele = {}

    obj.matched_by_alleles.zero_allele.chrPos = zero_allele_chrpos
    obj.matched_by_alleles.one_allele.chrPos = one_allele_chrpos
    obj.matched_by_alleles.two_allele.chrPos = two_allele_chrpos
    obj.matched_by_alleles.zero_allele.dt = zero_allele
    obj.matched_by_alleles.one_allele.dt = one_allele
    obj.matched_by_alleles.two_allele.dt = two_allele
    obj.matched_by_alleles.zero_allele.risk = zero_allele_idx.map(i => matched[i][indBeta]);
    obj.matched_by_alleles.one_allele.risk = one_allele_idx.map(i => matched[i][indBeta]);
    obj.matched_by_alleles.two_allele.risk = two_allele_idx.map(i => matched[i][indBeta]);
    obj.matched_by_alleles.zero_allele.category = Array(zero_allele.length).fill(`${zero_allele.length} matched, zero alleles`)
    obj.matched_by_alleles.one_allele.category = Array(one_allele.length).fill(`${one_allele.length} matched, one allele`)
    obj.matched_by_alleles.two_allele.category = Array(two_allele.length).fill(`${two_allele.length} matched, two alleles`)
    obj.matched_by_alleles.zero_allele.size = Array(zero_allele.length).fill("8")
    obj.matched_by_alleles.one_allele.size = Array(one_allele.length).fill("8")
    obj.matched_by_alleles.two_allele.size = Array(two_allele.length).fill("10")
    obj.matched_by_alleles.zero_allele.color = Array(zero_allele.length).fill("#17becf")
    obj.matched_by_alleles.one_allele.color = Array(one_allele.length).fill("navy")
    obj.matched_by_alleles.two_allele.color = Array(two_allele.length).fill("#d62728")
    obj.matched_by_alleles.zero_allele.opacity = Array(zero_allele.length).fill("1")
    obj.matched_by_alleles.one_allele.opacity = Array(one_allele.length).fill("1")
    obj.matched_by_alleles.two_allele.opacity = Array(two_allele.length).fill("1")
    obj.matched_by_alleles.zero_allele.symbol = Array(zero_allele.length).fill("0")
    obj.matched_by_alleles.one_allele.symbol = Array(one_allele.length).fill("diamond")
    obj.matched_by_alleles.two_allele.symbol = Array(two_allele.length).fill("square")
    obj.matched_by_alleles.zero_allele.symbol = Array(zero_allele.length).fill("0")
    obj.matched_by_alleles.one_allele.symbol = Array(one_allele.length).fill("diamond")
    obj.matched_by_alleles.two_allele.symbol = Array(two_allele.length).fill("square")
    obj.matched_by_alleles.zero_allele.hoverinfo = Array(zero_allele.length).fill("all")
    obj.matched_by_alleles.one_allele.hoverinfo = Array(one_allele.length).fill("all")
    obj.matched_by_alleles.two_allele.hoverinfo = Array(two_allele.length).fill("all")


    // add matched,all, zero, one and two allele into new array
    //https://stackoverflow.com/questions/64055094/push-multiple-arrays-with-keys-into-single-array
    function Push(data, subdata) {
        return subdata.map((_, i) => {
            return Object.entries(data).reduce((a, [k, arr]) => (a[k] = arr[i], a), {})
        })
    }
    const items = Push(obj.all, obj.all.risk).concat(
        Push(obj.not_matched, obj.not_matched.risk)).concat(
        Push(obj.matched_by_alleles.zero_allele, obj.matched_by_alleles.zero_allele.risk)).concat(
        Push(obj.matched_by_alleles.one_allele, obj.matched_by_alleles.one_allele.risk)).concat(
        Push(obj.matched_by_alleles.two_allele, obj.matched_by_alleles.two_allele.risk))

    const plotAllMatchByEffectDiv = document.getElementById('plotAllMatchByEffectDiv')
    // Height will be set in layout instead of container

    // make new objects with id, all mapped to one condition sorted by value
    const cache = []
    const chooseData = [" ", `${zero_allele.length} matched, zero alleles`, `${one_allele.length} matched, one allele`, `${two_allele.length} matched, two alleles`, `${not_matched.length} not matched`]

    const plotData = items
        .filter(function (item) {
            if (chooseData.indexOf(item.category) === -1) {
                cache.push(item);
                return false;
            } else {
                return true;
            }
        })
        .sort((a, b) => parseFloat(a.risk) - parseFloat(b.risk))

    // re-order plot legend manually, order conditions list by regex 
    const conditions_arr = Array.from(new Set(plotData.map(a => a.category)))

    var rx_not = new RegExp(/\bnot?(?!S)/);
    var rx_zero = new RegExp(/\bzero?(?!S)/);
    var rx_one = new RegExp(/\bone?(?!S)/);
    var rx_two = new RegExp(/\btwo?(?!S)/);
    function getSortingKey(value) {
        if (rx_not.test(value)) {
            return 2
        }
        if (rx_zero.test(value)) {
            return 3
        }
        if (rx_one.test(value)) {
            return 4
        }
        if (rx_two.test(value)) {
            return 5
        }
        return 1;
    }
    const conditions = conditions_arr.sort(function (x, y) {
        return getSortingKey(x) - getSortingKey(y);
    });
    const traces = [];
    conditions.forEach(function (category) {
        var newArray = plotData.filter(function (el) {
            return el.category == category;
        });
        traces.push({
            y: newArray.map(a => a.chrPos),
            x: newArray.map(a => a.risk),
            name: category,
            hoverinfo: newArray[0].hoverinfo,
            mode: 'markers',
            type: 'scatter',
            opacity: newArray[0].opacity,
            marker: {
                color: newArray[0].color,
                symbol: newArray[0].symbol,
                size: newArray[0].size,
            }
        })
    })


    var layout = {
        title: {
            text: `<span >PGS#${data.pgs.meta.pgs_id.replace(/^.*0+/, '')}: β's for ${data.pgs.dt.length} ${data.pgs.meta.trait_mapped} variants, PRS ${Math.round(data.PRS * 1000) / 1000}</span>`,
            font: {
                size: 19
            }
        },
        height: Math.max(400, 50 + data.pgs.dt.length * 8), // Dynamic height based on number of variants
        margin: {
            l: 140,
        },

        showlegend: true,
        legend: {
            orientation: 'v',
            font: {
                size: 16
            }
        },
        yaxis: {
            // remove white space at top and bottom of y axis caused by using "markers"
            range: [-1, data.pgs.dt.length],
            showgrid: true,
            showline: true,
            mirror: 'ticks',
            gridcolor: '#bdbdbd',
            gridwidth: 1,
            linecolor: '#636363',
            title: {
                text: '<span style="font-size:large">Chromosome and Position</span>',
                font: {
                    size: 24
                },
                standoff: 10
            },
            tickfont: {
                size: 10.5
            },
        },
        xaxis: {
            font: {
                size: 18
            },
            tickfont: {
                size: 16
            },
            title: '<span style="font-size:large">β</span>',
            linewidth: 1,
            mirror: true,
        }
    }

    dv.innerHTML = ''

    var config = {
        responsive: true
    }
    data.plot = obj
    data.plot.traces = traces

    Plotly.newPlot(dv, traces, layout, config)
    pieChart(data)
    tabulateAllMatchByEffect()
}

/**
 * Create a table showing matched variants with their effect weights and allele counts
 * @param {Object} data - PGS23.data object containing match data and risk scores
 * @param {HTMLElement} div - Target div element for the table
 */
function tabulateAllMatchByEffect(data = PGS23.data, div = document.getElementById('tabulateAllMatchByEffectDiv')) {

    if (!div) {
        div = document.createElement('div')
        document.body.appendChild(div)
    }
    div.innerHTML = `<span style="font-size:x-large">PRS = exp( ∑ (𝛽*z)) = ${Math.round(data.PRS * 1000) / 1000}</span><br><hr><div>Top 20 contributing variants</div><hr>`
    // sort by absolute value
    let jj = [...Array(data.calcRiskScore.length)].map((_, i) => i) // match indexes
    // remove zero effect
    jj = jj.filter(x => data.calcRiskScore[x] != 0)
    jj.sort((a, b) => (data.calcRiskScore[b] - data.calcRiskScore[a])) // indexes sorted by absolute value
    jj = jj.slice(0, 20) // Limit to top 20

    // tabulate
    let tb = document.createElement('table')
    div.appendChild(tb)
    let thead = document.createElement('thead')
    tb.appendChild(thead)
    thead.innerHTML = `<tr><th align="left">#</th><th>β</th><th align="left">z</th><th align="right"> β*z</th><th align="center">variant</th><th align="center">dbSNP</th><th align="left">SNPedia </th></tr>`
    let tbody = document.createElement('tbody')
    tb.appendChild(tbody)
    const indChr = data.pgs.cols.indexOf('hm_chr')
    const indPos = data.pgs.cols.indexOf('hm_pos')

    let indOther_allele = data.pgs.cols.indexOf('other_allele')
    if (indOther_allele == -1) {
        indOther_allele = data.pgs.cols.indexOf('hm_inferOtherAllele')
    }
    const indEffect_allele = data.pgs.cols.indexOf('effect_allele')
    const indEffect_weight = data.pgs.cols.indexOf('effect_weight')

    let n = jj.length

    jj.forEach((ind, i) => {
        //let jnd=n-ind

        let row = document.createElement('tr')
        tbody.appendChild(row)

        let xi = data.pgsMatchMy23[ind]
        let my_23idx = 1
        if (xi.length > 2) { my_23idx = 2 }
        row.innerHTML = `<tr><td align="left">${i + 1})</td><td align="center">${Math.round(xi[my_23idx][indEffect_weight] * 1000) / 1000}</td><td align="center">${data.alleles[ind]}</td><td align="left">${Math.round(data.calcRiskScore[ind] * 1000) / 1000}</td><td align="left" style="font-size:small;color:darkgreen"><a href="https://myvariant.info/v1/variant/chr${xi.at(-1)[indChr]}:g.${xi.at(-1)[indPos]}${xi.at(-1)[indOther_allele]}>${xi.at(-1)[indEffect_allele]}" target="_blank">Chr${xi.at(-1)[indChr]}.${xi.at(-1)[indPos]}:g.${xi.at(-1)[indOther_allele]}>${xi.at(-1)[indEffect_allele]}</a></td><td align="left"><a href="https://www.ncbi.nlm.nih.gov/snp/${xi[0][0]}" target="_blank">${xi[0][0]}</a><td align="left"><a href="https://www.snpedia.com/index.php/${xi[0][0]}" target="_blank">  wiki   </a></td></tr>`
    })
}

/**
 * Render Plot PRS tab content.
 * Called when the PlotPRS tab is opened.
 * Uses window.prsResults from calculatePrs.js if available.
 */
/**
 * Plot a specific PRS result by index.
 * @param {number} index - Index of the result in the valid results array
 * @param {Array} validResults - Array of results with plotting data
 */
function plotResultByIndex(index, validResults) {
    const errorDiv = document.getElementById('errorDiv');
    const plotDiv = document.getElementById('plotAllMatchByEffectDiv');
    
    const resultWithData = validResults[index];
    if (!resultWithData) return;
    
    // Default cols array if not stored in result
    const defaultCols = ['rsID', 'hm_chr', 'hm_pos', 'effect_allele', 'effect_weight', 'other_allele', 'hm_inferOtherAllele'];
    
    // Build PGS23.data-like object for plotting functions
    const pgsData = {
        pgs: {
            cols: resultWithData.pgs?.cols ?? defaultCols,
            dt: resultWithData.organized?.all?.dt ?? [],
            meta: {
                pgs_id: resultWithData.pgsId,
                trait_mapped: resultWithData.organized?.summary?.trait ?? ''
            }
        },
        pgsMatchMy23: resultWithData.pgsMatchMy23,
        alleles: resultWithData.alleles,
        calcRiskScore: resultWithData.calcRiskScore,
        PRS: resultWithData.PRS
    };
    
    // Set global PGS23 for the plotting functions
    window.PGS23 = window.PGS23 || {};
    window.PGS23.data = pgsData;
    
    try {
        inspectFiles(resultWithData);
        plotAllMatchByEffect4(pgsData, errorDiv, plotDiv);
        // Show the hr separator when results are rendered
        const plotPrsHr = document.getElementById('plotPrsHr');
        if (plotPrsHr) plotPrsHr.style.display = '';
    } catch (err) {
        console.error('Error rendering PRS plot:', err);
        if (plotDiv) {
            plotDiv.innerHTML = `<div class="alert alert-danger">
                <strong>Error rendering plot:</strong> ${err.message}
            </div>`;
        }
    }
}

function renderPlotPRS() {
    const errorDiv = document.getElementById('errorDiv');
    const plotDiv = document.getElementById('plotAllMatchByEffectDiv');
    const tableDiv = document.getElementById('tabulateAllMatchByEffectDiv');
    const pieChartDiv = document.getElementById('pieChartDiv');
    const pieChartHeading = document.getElementById('pieChartHeading');
    const plotPrsHr = document.getElementById('plotPrsHr');
    const inspectFilesDiv = document.getElementById('inspectFilesDiv');
    
    // Check if we have PRS results from calculatePrs.js
    const prsResults = window.prsResults ?? [];
    
    if (prsResults.length === 0) {
        if (errorDiv) {
            errorDiv.innerHTML = `<div class="alert alert-info">
                <strong>No PRS results available.</strong><br>
                Please go to the <strong>Calculate PRS</strong> tab first and run a PRS calculation.
            </div>`;
        }
        if (plotDiv) {
            plotDiv.innerHTML = '';
            plotDiv.style.minHeight = '0';
            plotDiv.style.height = 'auto';
        }
        if (tableDiv) tableDiv.innerHTML = '';
        if (pieChartDiv) {
            pieChartDiv.innerHTML = '';
            pieChartDiv.style.minHeight = '0';
            pieChartDiv.style.height = 'auto';
        }
        if (pieChartHeading) pieChartHeading.style.display = 'none';
        if (plotPrsHr) plotPrsHr.style.display = 'none';
        if (inspectFilesDiv) inspectFilesDiv.style.display = 'none';
        return;
    }
    
    // Filter to results with plotting data
    const validResults = prsResults.filter(r => r.organized && r.pgsMatchMy23);
    
    if (validResults.length === 0) {
        if (plotDiv) {
            plotDiv.innerHTML = `<div class="alert alert-warning">
                <strong>PRS results found but no detailed match data available.</strong><br>
                The results may have been loaded from cache. Try clearing the cache and recalculating.
            </div>`;
        }
        return;
    }
    
    // Store valid results globally for the dropdown handler
    window._plotPrsValidResults = validResults;
    
    // Create or update dropdown selector
    let selectorDiv = document.getElementById('plotPrsSelectorDiv');
    if (!selectorDiv) {
        selectorDiv = document.createElement('div');
        selectorDiv.id = 'plotPrsSelectorDiv';
        selectorDiv.className = 'mb-3';
        // Insert at top, before errorDiv (below the description paragraph)
        errorDiv?.parentNode?.insertBefore(selectorDiv, errorDiv);
    }
    
    // Build dropdown options
    const options = validResults.map((r, idx) => {
        const userId = r.userId ?? 'Unknown';
        const userName = r.userName ? ` (${r.userName})` : '';
        const pgsId = r.pgsId ?? 'Unknown';
        const prs = typeof r.PRS === 'number' ? ` | PRS: ${r.PRS.toFixed(4)}` : '';
        return `<option value="${idx}">${userId}${userName} - ${pgsId}${prs}</option>`;
    }).join('');
    
    selectorDiv.innerHTML = `
        <label for="plotPrsSelect" class="form-label"><strong>Select Result:</strong></label>
        <select id="plotPrsSelect" class="form-select form-select-sm" style="max-width: 400px;">
            ${options}
        </select>
    `;
    
    // Add change handler
    const selectEl = document.getElementById('plotPrsSelect');
    selectEl.onchange = function() {
        const idx = parseInt(this.value, 10);
        plotResultByIndex(idx, window._plotPrsValidResults);
    };
    
    // Plot the first result by default
    plotResultByIndex(0, validResults);
}

// Expose functions globally for use in HTML
window.plotAllMatchByEffect4 = plotAllMatchByEffect4;
window.tabulateAllMatchByEffect = tabulateAllMatchByEffect;
window.renderPlotPRS = renderPlotPRS;

export {
    plotAllMatchByEffect4,
    tabulateAllMatchByEffect,
    renderPlotPRS
}
