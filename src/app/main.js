// import {get23,get23meUrls} from "../sdk/get23me.js"
// import { getPGSTxtsHm,getPGSTxts2, getPGSIds} from "../sdk/getPgs.js"
// import {Match2 } from "../sdk/prs.js"

// //-------------------------------------------------------------------------
// // 23andme data
// let users = await get23meUrls()
// let userUrls = users
//     .flatMap(user => (user.genotypes ?? []).filter(genotype => genotype.filetype == "23andme"))
//     .map(genotype => (genotype.download_url ?? "").replace("http", "https"))
//     .filter(Boolean)
//     //console.log("userUrls",userUrls)

// //---------------------------------------------------------------
// // pgs catalog data
// let varMin = 5
// let varMax = 7
// let results = await getPGSIds("traitCategories", "Cancer",  varMin, varMax)
// let PGStextsHm = await getPGSTxtsHm(results.map(x=>x.id))

// console.log("results",results)
// console.log("PGStextsHm",PGStextsHm)

// let PGS = PGStextsHm.slice(2,4)
// let my23Txts = await get23(userUrls)
// console.log("my23Txts",my23Txts)

// // //----------------------------------------------------------------------
// // // testing one trait, "type 2 diabetes mellitus"

// function PRS_fun(matrix){
//     let PRS =[]
//     for (let i=0; i<matrix.my23.length; i++){
//         console.log("---------------------------")
//         console.log("processing user #...",i)

//         for(let j=0; j<matrix.PGS.length; j++){
//             let input = { "pgs":matrix.PGS[j], "my23":matrix.my23[i]}
//             let res = Match2(input)
//                 PRS.push(res)
//                 console.log("processing PGS model: ",matrix.PGS[j].id)
//         }
//     }

//     return PRS
// }
// // data object defined here ----------------------------
// let data = {}

// data["PGS"] = PGS
// data["my23"] = my23Txts
// let PRS = PRS_fun(data)
// data["PRS"] = PRS

// console.log("data",data )

// // export{PRS_fun}

//############################################
/**
 * Parse a 23andMe genome text file into structured data.
 * @param {string} txt - Raw text content of the 23andMe file
 * @param {string} url - Source URL/path of the file
 * @returns {Object} Parsed genome data with cols and dt arrays
 */
// function parse23(txt, url) {
// 	const obj = {};
// 	const rows = String(txt ?? "").split(/[\r\n]+/g).filter(Boolean);
// 	obj.txt = txt;
// 	obj.url = url;

// 	const n = rows.filter(r => r && r[0] === '#').length;
// 	if (n === 0) {
// 		throw new Error(`Invalid 23andMe file format: missing header in ${url}`);
// 	}

// 	obj.meta = rows.slice(0, n - 1).join('\r\n');
// 	obj.cols = rows[n - 1].replace(/^#\s*/, '').split(/\t/);
// 	obj.dt = rows.slice(n).map((r, i) => {
// 		const parts = r.split('\t');
// 		parts[2] = parseInt(parts[2]); // position as integer
// 		parts[4] = i; // row index
// 		return parts;
// 	});
// 	return obj;
// }

// /**
//  * Parse a PGS scoring file text into structured data.
//  * @param {string} id - PGS ID
//  * @param {string} txt - Raw text content of the PGS file
//  * @returns {Object} Parsed PGS data with meta, cols, dt
//  */
// function parsePGS(id, txt) {
// 	const obj = { id };
// 	obj.txt = txt;
// 	const rows = txt.split(/[\r\n]/g);
// 	const metaL = rows.filter(r => r[0] === '#').length;
	
// 	obj.meta = { txt: rows.slice(0, metaL) };
// 	obj.cols = rows[metaL].split(/\t/g);
// 	obj.dt = rows.slice(metaL + 1)
// 		.map(r => r.split(/\t/g))
// 		.filter(r => r.length > 1); // Remove empty rows

// 	// Parse numerical types
// 	const indInt = [obj.cols.indexOf('chr_position'), obj.cols.indexOf('hm_pos')];
// 	const indFloat = [obj.cols.indexOf('effect_weight'), obj.cols.indexOf('allelefrequency_effect')];

// 	obj.dt = obj.dt.map(r => {
// 		indFloat.forEach(ind => {
// 			if (ind >= 0) r[ind] = parseFloat(r[ind]);
// 		});
// 		indInt.forEach(ind => {
// 			if (ind >= 0) r[ind] = parseInt(r[ind]);
// 		});
// 		return r;
// 	});

// 	// Parse metadata
// 	obj.meta.txt.filter(r => r[1] !== '#').forEach(aa => {
// 		const parts = aa.slice(1).split('=');
// 		obj.meta[parts[0]] = parts[1];
// 	});
	
// 	return obj;
// }

// /**
//  * Match PGS variants to 23andMe data using rsID.
//  * This version works with non-harmonized PGS files.
//  * @param {Object} data - { pgs: parsed PGS, my23: parsed 23andMe }
//  * @returns {Object} Match results with PRS score
//  */
// function Match2ByRsid(data) {
// 	const data2 = {};
	
// 	// Get column indices
// 	const indRsid_pgs = data.pgs.cols.indexOf('rsID');
// 	const indEffectAllele = data.pgs.cols.indexOf('effect_allele');
// 	const indOtherAllele = data.pgs.cols.indexOf('other_allele');
// 	const indEffectWeight = data.pgs.cols.indexOf('effect_weight');
// 	const indGenotype = data.my23.cols.indexOf('genotype');
// 	const indRsid_23 = data.my23.cols.indexOf('rsid');
	
// 	// Create a Map of 23andMe data by rsID for fast lookup
// 	const my23Map = new Map();
// 	data.my23.dt.forEach(row => {
// 		my23Map.set(row[indRsid_23], row);
// 	});
	
// 	const dtMatch = [];
// 	const n = data.pgs.dt.length;
	
// 	for (let i = 0; i < n; i++) {
// 		const pgsRow = data.pgs.dt[i];
// 		const rsid = pgsRow[indRsid_pgs];
// 		const effectAllele = pgsRow[indEffectAllele];
// 		const otherAllele = pgsRow[indOtherAllele];
		
// 		const my23Row = my23Map.get(rsid);
// 		if (my23Row) {
// 			const genotype = my23Row[indGenotype];
// 			// Check if genotype contains effect or other allele
// 			const regexPattern = new RegExp([effectAllele, otherAllele].join('|'));
// 			if (regexPattern.test(genotype)) {
// 				dtMatch.push([my23Row, pgsRow]);
// 			}
// 		}
// 	}
	
// 	data2.pgsMatchMy23 = dtMatch;
	
// 	// Calculate risk score
// 	const calcRiskScore = [];
// 	const alleles = [];
	
// 	dtMatch.forEach((m, i) => {
// 		calcRiskScore[i] = 0;
// 		alleles[i] = 0;
		
// 		const my23Row = m[0];
// 		const pgsRow = m[1];
// 		const genotype = my23Row[indGenotype];
// 		const match = genotype.match(/^[ACGT]{2}$/);
		
// 		if (match) {
// 			const effectAllele = pgsRow[indEffectAllele];
// 			const L = genotype.match(new RegExp(effectAllele, 'g'));
// 			if (L) {
// 				const count = L.length;
// 				calcRiskScore[i] = count * pgsRow[indEffectWeight];
// 				alleles[i] = count;
// 			}
// 		}
// 	});
	
// 	data2.pgs_id = data.pgs.meta.pgs_id ?? data.pgs.id;
// 	data2.alleles = alleles;
// 	data2.calcRiskScore = calcRiskScore;
// 	data2.matchCount = dtMatch.length;
// 	data2.totalVariants = n;
	
// 	// Calculate final PRS
// 	if (calcRiskScore.length === 0) {
// 		data2.PRS = null;
// 		data2.QC = false;
// 		data2.QCtext = 'No matching variants found';
// 	} else {
// 		const sumScore = calcRiskScore.reduce((a, b) => a + b, 0);
// 		data2.PRS = Math.exp(sumScore);
// 		data2.rawScore = sumScore;
// 		data2.QC = true;
// 		data2.QCtext = '';
// 	}
	
// 	return data2;
// }

// /**
//  * Load and parse a local 23andMe file.
//  * @param {string} path - Path to the file
//  * @returns {Promise<Object>} Parsed genome data
//  */
// async function load23andMeFile(path) {
// 	const response = await fetch(path);
// 	if (!response.ok) {
// 		throw new Error(`Failed to load ${path}: ${response.status}`);
// 	}
// 	const txt = await response.text();
// 	return parse23(txt, path);
// }

// /**
//  * Load and parse a local PGS scoring file.
//  * @param {string} path - Path to the file (e.g., "data/PGS000001.txt")
//  * @param {string} id - PGS ID
//  * @returns {Promise<Object>} Parsed PGS data
//  */
// async function loadPgsFile(path, id) {
// 	const response = await fetch(path);
// 	if (!response.ok) {
// 		throw new Error(`Failed to load ${path}: ${response.status}`);
// 	}
// 	const txt = await response.text();
// 	return parsePGS(id, txt);
// }

// /**
//  * Calculate PRS for all user/score combinations.
//  * @param {string[]} userPaths - Array of paths to 23andMe files
//  * @param {Array<{id: string, path: string}>} pgsFiles - Array of PGS file info
//  * @returns {Promise<Array>} Array of PRS results
//  */
// async function calculateAllPRS(userPaths, pgsFiles) {
// 	const results = [];
	
// 	// Load all 23andMe files
// 	console.log("Loading 23andMe files...");
// 	const my23Data = [];
// 	for (const path of userPaths) {
// 		try {
// 			const parsed = await load23andMeFile(path);
// 			my23Data.push({ path, data: parsed });
// 			console.log(`Loaded: ${path} (${parsed.dt.length} variants)`);
// 		} catch (err) {
// 			console.error(`Failed to load ${path}:`, err);
// 		}
// 	}
	
// 	// Load all PGS files
// 	console.log("Loading PGS scoring files...");
// 	const pgsData = [];
// 	for (const pgs of pgsFiles) {
// 		try {
// 			const parsed = await loadPgsFile(pgs.path, pgs.id);
// 			pgsData.push({ id: pgs.id, path: pgs.path, data: parsed });
// 			console.log(`Loaded: ${pgs.id} (${parsed.dt.length} variants)`);
// 		} catch (err) {
// 			console.error(`Failed to load ${pgs.id}:`, err);
// 		}
// 	}
	
// 	// Calculate PRS for each combination
// 	console.log("Calculating PRS...");
// 	for (const user of my23Data) {
// 		for (const pgs of pgsData) {
// 			try {
// 				const input = { pgs: pgs.data, my23: user.data };
// 				const result = Match2ByRsid(input);
// 				result.userName = user.path.split('/').pop().replace('.txt', '');
// 				result.pgsName = pgs.id;
// 				results.push(result);
// 				console.log(`PRS for ${result.userName} x ${result.pgsName}: ${result.PRS?.toFixed(4) ?? 'N/A'} (${result.matchCount}/${result.totalVariants} matches)`);
// 			} catch (err) {
// 				console.error(`Error calculating PRS for ${user.path} x ${pgs.id}:`, err);
// 			}
// 		}
// 	}
	
// 	return results;
// }

// /**
//  * Run PRS calculation with fallback data and display results.
//  */
// async function runFallbackPRS() {
// 	const statusEl = document.getElementById("prsResultsStatus");
// 	const resultsDiv = document.getElementById("prsResultsDiv");
	
// 	if (statusEl) statusEl.textContent = "Calculating PRS with fallback data...";
	
// 	try {
// 		const userPaths = FALLBACK_USERS.map(u => u.genotypes[0]?.download_url).filter(Boolean);
// 		const pgsFiles = FALLBACK_SCORES.map(s => ({
// 			id: s.id,
// 			path: `data/${s.id}.txt`
// 		}));
		
// 		const results = await calculateAllPRS(userPaths, pgsFiles);
		
// 		if (statusEl) statusEl.textContent = `Calculated ${results.length} PRS result(s).`;
		
// 		// Render results table
// 		if (resultsDiv && results.length > 0) {
// 			const rows = results.map((r, idx) => `
// 				<tr>
// 					<td>${idx + 1}</td>
// 					<td>${escapeHtml(r.userName)}</td>
// 					<td>${escapeHtml(r.pgsName)}</td>
// 					<td>${r.PRS?.toFixed(6) ?? 'N/A'}</td>
// 					<td>${r.rawScore?.toFixed(6) ?? 'N/A'}</td>
// 					<td>${r.matchCount} / ${r.totalVariants}</td>
// 					<td>${r.QC ? '✓' : '✗'} ${r.QCtext}</td>
// 				</tr>
// 			`).join("");
			
// 			resultsDiv.innerHTML = `
// 				<table class="table table-striped table-sm mt-3">
// 					<thead class="table-dark">
// 						<tr>
// 							<th>#</th>
// 							<th>Participant</th>
// 							<th>PGS Model</th>
// 							<th>PRS (exp)</th>
// 							<th>Raw Score</th>
// 							<th>Matches</th>
// 							<th>QC</th>
// 						</tr>
// 					</thead>
// 					<tbody>${rows}</tbody>
// 				</table>
// 			`;
// 		} else if (resultsDiv) {
// 			resultsDiv.innerHTML = '<p class="text-muted">No results to display.</p>';
// 		}
		
// 		console.log("PRS Results:", results);
// 		return results;
		
// 	} catch (err) {
// 		console.error("runFallbackPRS error:", err);
// 		if (statusEl) statusEl.textContent = `Error: ${err.message}`;
// 		return [];
// 	}
// }

// // Wire up Calculate PRS button
// const calculatePrsBtn = document.getElementById("calculatePrsBtn");
// if (calculatePrsBtn) {
// 	calculatePrsBtn.addEventListener("click", runFallbackPRS);
// }

// window.runFallbackPRS = runFallbackPRS;
// window.calculateAllPRS = calculateAllPRS;
// window.parse23 = parse23;
// window.parsePGS = parsePGS;
// window.Match2ByRsid = Match2ByRsid;