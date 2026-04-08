function Match2(mypgs, my23){
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
  

  function Match3(mypgs, my23) {
  let data2 = {};

  // PGS column indexes
  const indChr = mypgs.cols.indexOf('hm_chr');
  const indPos = mypgs.cols.indexOf('hm_pos');
  const indOtherAllele = mypgs.cols.indexOf('other_allele');
  const indEffectAllele = mypgs.cols.indexOf('effect_allele');
  const indEffectWeight = mypgs.cols.indexOf('effect_weight');

  // 23andMe column indexes
  const ind23Chr = my23.cols.indexOf('chromosome') !== -1 ? my23.cols.indexOf('chromosome') : 1;
  const ind23Pos = my23.cols.indexOf('position') !== -1 ? my23.cols.indexOf('position') : 2;
  const ind23Genotype = my23.cols.indexOf('genotype');

  // Store all rows: matched and unmatched
  let allResults = [];
  let matchedOnly = [];

  // Risk arrays
  let calcRiskScore = [];
  let alleles = [];

  for (let i = 0; i < mypgs.dt.length; i++) {
    const pgsRow = mypgs.dt[i];

    const chr = pgsRow[indChr];
    const pos = pgsRow[indPos];
    const effectAllele = pgsRow[indEffectAllele];
    const otherAllele = pgsRow[indOtherAllele];
    const effectWeight = Number(pgsRow[indEffectWeight]);

    // Match only genotypes containing the effect or other allele
    const regexPattern = new RegExp(`${effectAllele}|${otherAllele}`);

    let dtMatch_i = my23.dt
      .filter(myr => myr[ind23Pos] == pos)
      .filter(myr => myr[ind23Chr] == chr)
      .filter(myr => regexPattern.test(myr[ind23Genotype]));

    if (dtMatch_i.length > 0) {
      // Use first valid 23andMe match for scoring
      const my23Row = dtMatch_i[0];
      let score = 0;
      let alleleCount = 0;

      const genotype = my23Row[ind23Genotype];
      const mi = genotype && genotype.match(/^[ACGT]{2}$/);

      if (mi) {
        const L = mi[0].match(new RegExp(effectAllele, 'g'));
        if (L) {
          alleleCount = L.length;
          score = alleleCount * effectWeight;
        }
      }

      calcRiskScore.push(score);
      alleles.push(alleleCount);

      const matchedRecord = {
        match: true,
        status: "match",
        pgs: pgsRow,
        my23: dtMatch_i,   // keep all matching 23andMe rows
        alleleCount,
        riskScore: score
      };

      allResults.push(matchedRecord);
      matchedOnly.push(matchedRecord);

    } else {
      // No match found
      allResults.push({
        match: false,
        status: "nomatch",
        pgs: pgsRow,
        my23: "nomatch",
        alleleCount: "-",
        riskScore: 0
      });

      // optional: keep unmatched rows in score arrays too
      calcRiskScore.push(0);
      alleles.push(0);
    }
  }

  data2.pgs_id = mypgs.meta?.pgs_id;
  data2.results = allResults;          // all PGS rows, including nomatch
  data2.pgsMatchMy23 = matchedOnly;    // only matched rows
  data2.alleles = alleles;
  data2.calcRiskScore = calcRiskScore;

  const weights = mypgs.dt.map(row => Number(row[indEffectWeight]));

  if (matchedOnly.length === 0) {
    data2.PRS = "there are no matches :-(";
    data2.QC = false;
    data2.QCtext = 'there are no matches :-(';
  } else if (calcRiskScore.reduce((a, b) => Math.max(a, b), -Infinity) > 100) {
    data2.PRS = Math.exp(calcRiskScore.reduce((a, b) => a + b, 0));
    data2.QC = false;
    data2.QCtext = 'these are large betas :-(';
  } else if (weights.reduce((a, b) => Math.min(a, b), Infinity) > -0.00002) {
    data2.PRS = Math.exp(calcRiskScore.reduce((a, b) => a + b, 0));
    data2.QC = false;
    data2.QCtext = 'these are not betas :-(';
  } else {
    data2.PRS = Math.exp(calcRiskScore.reduce((a, b) => a + b, 0));
    data2.QC = true;
    data2.QCtext = '';
  }

  return data2;
}
  export{
	Match2,
	Match3
  }
