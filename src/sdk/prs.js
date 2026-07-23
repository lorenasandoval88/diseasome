function Match2(mypgs, my23){
  // Defensive checks
  if (!mypgs || !mypgs.cols || !Array.isArray(mypgs.cols)) {
    console.error("Match2 error: invalid mypgs structure", mypgs);
    return { pgs_id: mypgs && mypgs.meta && mypgs.meta.pgs_id, PRS: "error", QC: false, QCtext: "Invalid PGS data structure" };
  }
  if (!my23 || !my23.cols || !Array.isArray(my23.cols)) {
    console.error("Match2 error: invalid my23 structure", my23);
    return { pgs_id: mypgs && mypgs.meta && mypgs.meta.pgs_id, PRS: "error", QC: false, QCtext: "Invalid genome data structure" };
  }
	
  let data2 = {}
  // extract harmonized data from PGS entry first
  const indChr = mypgs.cols.indexOf('hm_chr')
  const indPos = mypgs.cols.indexOf('hm_pos')
  const indOther_allele = mypgs.cols.indexOf('other_allele')
  const indEffect_allele = mypgs.cols.indexOf('effect_allele')
  const indGenotype = my23.cols.indexOf('genotype')
	// match
	let dtMatch = []
	const n = mypgs.dt.length
		for (let i=0; i<n; i++){
			let matchFloor = 0
			  let r = mypgs.dt[i]
			//also filter 23 and me variants if they don't match pgs alt or effect allele 
			let regexPattern = new RegExp([r[indEffect_allele], r[indOther_allele]].join('|'))
  
			if (dtMatch.length > 0) {
				matchFloor = dtMatch.at(-1)[0][4]
			}
		   // console.log("dtmacch i",r, my23.dt.filter(myr => (myr[2] == r[indPos])))
			let dtMatch_i = my23.dt.filter(myr => (myr[2] == r[indPos]))
			   .filter(myr => (myr[1] == r[indChr]))
			// remove 23 variants that don't match pgs effect or other allele    
			   .filter(myr => regexPattern.test(myr[indGenotype])) 
    
			if (dtMatch_i.length > 0) {
				dtMatch.push(dtMatch_i.concat([r]))
			}
		} 
			data2.pgsMatchMy23 = dtMatch
			let calcRiskScore = []
			let alleles = []
			// calculate Risk
			let logR = 0
			// log(0)=1
			let ind_effect_weight = mypgs.cols.indexOf('effect_weight')
			dtMatch.forEach((m, i) => {
				calcRiskScore[i] = 0
				// default no risk
				alleles[i] = 0
				// default no alele
				let mi = m[0][3].match(/^[ACGT]{2}$/)
				// we'll only consider duplets in the 23adme report
				if (mi) {
					//'effect_allele', 'other_allele', 'effect_weight'
					mi = mi[0]
					// 23andme match
					let pi = m.at(-1)
					//pgs match
					let alele = pi[indEffect_allele]
					let L = mi.match(RegExp(alele, 'g'))
					// how many, 0,1, or 2
					if (L) {
						L = L.length
						calcRiskScore[i] = L * pi[ind_effect_weight]
						alleles[i] = L
					}
				}
			})
			data2.pgs_id = mypgs.meta.pgs_id
			data2.alleles = alleles
			data2.calcRiskScore = calcRiskScore
			let weight_idx = mypgs.cols.indexOf('effect_weight')
			let weights = mypgs.dt.map(row => row[weight_idx])
			// warning: no matches found!
			if (calcRiskScore.length == 0) { 
				data2.PRS = "there are no matches :-("
				data2.QC = false
				data2.QCtext = 'there are no matches :-('
				//console.log('there are no matches :-(',data.PRS)
			}else if (calcRiskScore.reduce((a, b) => Math.max(a, b)) > 100) { //&&(calcRiskScore.reduce((a,b)=>Math.max(a,b))<=1)){ // hazard ratios?
				data2.PRS = Math.exp(calcRiskScore.reduce((a, b) => a + b))
			data2.QC = false
				data2.QCtext = 'these are large betas :-('
				//console.log('these are large betas :-(',weights)
			} else if (weights.reduce((a, b) => Math.min(a, b)) > -0.00002 ) {
				data2.PRS = Math.exp(calcRiskScore.reduce((a, b) => a + b))
				data2.QC = false
				data2.QCtext = 'these are not betas :-('
				//console.log('these are not betas :-(',weights) 
			}  else{
				data2.PRS = Math.exp(calcRiskScore.reduce((a, b) => a + b))
				data2.QC = true
				data2.QCtext = ''
			}
  
  return data2
  }
  
function MatchOptimized(mypgs, my23) {
  // Defensive checks
  if (!mypgs || !mypgs.cols || !Array.isArray(mypgs.cols)) {
    console.error("MatchOptimized error: invalid mypgs structure", mypgs);
    return { pgs_id: mypgs && mypgs.meta && mypgs.meta.pgs_id, PRS: "error", QC: false, QCtext: "Invalid PGS data structure" };
  }
  if (!my23 || !my23.cols || !Array.isArray(my23.cols)) {
    console.error("MatchOptimized error: invalid my23 structure", my23);
    return { pgs_id: mypgs && mypgs.meta && mypgs.meta.pgs_id, PRS: "error", QC: false, QCtext: "Invalid genome data structure" };
  }

  const indChr = mypgs.cols.indexOf('hm_chr');
  const indPos = mypgs.cols.indexOf('hm_pos');
  const indOtherAllele = mypgs.cols.indexOf('other_allele');
  const indEffectAllele = mypgs.cols.indexOf('effect_allele');
  const indEffectWeight = mypgs.cols.indexOf('effect_weight');

  const ind23Chr = my23.cols.indexOf('chromosome') !== -1 ? my23.cols.indexOf('chromosome') : 1;
  const ind23Pos = my23.cols.indexOf('position') !== -1 ? my23.cols.indexOf('position') : 2;
  const ind23Genotype = my23.cols.indexOf('genotype');

  let data2 = {};
  let dtMatch = [];

  // Build a lookup index once: key = "chr:pos" -> all genome rows at that locus.
  const genomeIndex = new Map();
  const genomeRowCount = Array.isArray(my23.dt) ? my23.dt.length : 0;
  for (const row of my23.dt) {
    const key = `${row[ind23Chr]}:${row[ind23Pos]}`;
    if (!genomeIndex.has(key)) {
      genomeIndex.set(key, []);
    }
    genomeIndex.get(key).push(row);
  }

  // For each PGS row, do O(1) key lookup and filter only local candidates.
  const pgsRowCount = Array.isArray(mypgs.dt) ? mypgs.dt.length : 0;
  for (let i = 0; i < pgsRowCount; i++) {
    const r = mypgs.dt[i];
    const key = `${r[indChr]}:${r[indPos]}`;
    const locusRows = genomeIndex.get(key) || [];
    if (locusRows.length === 0) continue;

    const regexPattern = new RegExp([r[indEffectAllele], r[indOtherAllele]].join('|'));
    const dtMatch_i = locusRows.filter(myr => regexPattern.test(myr[ind23Genotype]));

    if (dtMatch_i.length > 0) {
      dtMatch.push(dtMatch_i.concat([r]));
    }
  }

  data2.pgsMatchMy23 = dtMatch;

  let calcRiskScore = [];
  let alleles = [];

  dtMatch.forEach((m, i) => {
    calcRiskScore[i] = 0;
    alleles[i] = 0;

    const genotype = m[0]?.[ind23Genotype];
    let mi = typeof genotype === 'string' ? genotype.match(/^[ACGT]{2}$/) : null;

    if (mi) {
      mi = mi[0];
      const pi = m.at(-1);
      const allele = pi[indEffectAllele];
      let L = mi.match(RegExp(allele, 'g'));
      if (L) {
        L = L.length;
        calcRiskScore[i] = L * pi[indEffectWeight];
        alleles[i] = L;
      }
    }
  });

  data2.pgs_id = mypgs.meta?.pgs_id;
  data2.alleles = alleles;
  data2.calcRiskScore = calcRiskScore;

  const weights = mypgs.dt.map(row => row[indEffectWeight]);
  if (calcRiskScore.length == 0) {
    data2.PRS = "there are no matches :-(";
    data2.QC = false;
    data2.QCtext = 'there are no matches :-(';
  } else if (calcRiskScore.reduce((a, b) => Math.max(a, b)) > 100) {
    data2.PRS = Math.exp(calcRiskScore.reduce((a, b) => a + b));
    data2.QC = false;
    data2.QCtext = 'these are large betas :-(';
  } else if (weights.reduce((a, b) => Math.min(a, b)) > -0.00002) {
    data2.PRS = Math.exp(calcRiskScore.reduce((a, b) => a + b));
    data2.QC = false;
    data2.QCtext = 'these are not betas :-(';
  } else {
    data2.PRS = Math.exp(calcRiskScore.reduce((a, b) => a + b));
    data2.QC = true;
    data2.QCtext = '';
  }

  data2.complexity = {
    bigO: 'O(n + m)',
    hashIndexOps: genomeRowCount + pgsRowCount,
    nestedScanOps: genomeRowCount * pgsRowCount,
    genomeRows: genomeRowCount,
    pgsRows: pgsRowCount
  };

  return data2;
}


export {
	Match2,
	MatchOptimized
}
