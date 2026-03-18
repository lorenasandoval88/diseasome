import localforage from "localforage";
import jszip from 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.esm.mjs'

// 5 built in 23andme files loaded to localforage, and used by get23meUrls() and get23().
let all23meURLS = localforage.createInstance({
    name: "all23meURLS",
    storeName: "all23meURLS"
})
let all23meFiles = localforage.createInstance({
    name: "all23meFiles",
    storeName: "all23meFiles"
})

const LOCAL_23ME_FILES = [
    "data/PGP_hu09B28E_genome_Joshua_Yoakem_v5_Full_20250127054538.txt",
    "data/PGP_hu0F2E0D_genome_Cajun_v5_Full_20231121192441.txt",
    "data/PGP_hu50801B_genome_Melinda_Chaperlo_v5_Full_20240728204807_(1).txt",
    "data/PGP_huAE4518_genome_Marika_Forsythe_v4_Full_20240826181111.txt",
    "data/PGP_huBE0518_genome_Christopher_Smith_v5_Full_20230926164611.txt"
]


// get all users with genotype data from local data folder-------------------------------
async function get23meUrls() {
    const newLocal = 'usersFull';
    let dt = await all23meURLS.getItem(newLocal); // check for users in localstorage
    if (dt == null) {
        const localUsers = LOCAL_23ME_FILES.map((file, index) => ({
            id: index + 1,
            name: file,
            genotypes: [
                {
                    id: index + 1,
                    filetype: "23andme",
                    download_url: file
                }
            ]
        }))
        dt = await all23meURLS.setItem(newLocal, localUsers)
    }
    return dt
}

/**
 * Parse a 23andMe genome text file into structured data.
 * @param {string} txt - Raw text content
 * @param {string} url - Source URL/path
 * @returns {Object} Parsed genome data with cols and dt arrays
 */
function parsePgp23(txt, url) {
	const obj = {};
	const rows = String(txt ?? "").split(/[\r\n]+/g).filter(Boolean);
	obj.txt = txt;
	obj.url = url;

	const n = rows.filter(r => r && r[0] === '#').length;
	if (n === 0) {
		throw new Error(`Invalid 23andMe file format: missing header in ${url}`);
	}

	obj.meta = rows.slice(0, n - 1).join('\r\n');
	obj.cols = rows[n - 1].replace(/^#\s*/, '').split(/\t/);
	obj.dt = rows.slice(n).map((r, i) => {
		const parts = r.split('\t');
		parts[2] = parseInt(parts[2]); // position as integer
		parts[4] = i; // row index
		return parts;
	});
	return obj;
}

/**
 * Load and parse a local 23andMe file.
 * @param {string} path - Path to the file
 * @returns {Promise<Object>} Parsed genome data
 */
async function load23andMeFile(path) {
//     const res = await fetch(pgpUrl, { credentials: "include" });
// const zipRes = await fetch(res.url);
// const buffer = await zipRes.arrayBuffer();
// const zip = await jszip.loadAsync(buffer);
// const fileName = Object.keys(zip.files)[0];

  // Step 1: hit PGP endpoint (handles redirect)
	const response = await fetch(path);
	if (!response.ok) {
		throw new Error(`Failed to load ${path}: ${response.status}`);
	}
      // Step 2: download ZIP from redirected URL
    const zipRes = await fetch(response.url);
     if (!zipRes.ok) {
    throw new Error(`Failed to download ZIP: ${zipRes.status}`);
  }

    const buffer = await zipRes.arrayBuffer();

    // Step 3: unzip and parse the 23andMe text file
    const zip = await jszip.loadAsync(buffer);


    // Step 4: find genotype file
    let targetFile = null;

    for (const name of Object.keys(zip.files)) {
        const file = zip.files[name];

        if (!file.dir && (
        name.endsWith(".txt") ||
        name.includes("23andme") ||
        name.toLowerCase().includes("genome")
        )) {
        targetFile = file;
        break;
        }
    }

  if (!targetFile) {
    throw new Error("No genotype file found in ZIP");
  }

  // Step 5: extract text
  const txt = await targetFile.async("string");

  // Step 6: parse (your existing function)
  return parsePgp23(txt, path);
  
    // // Step 4: find genotype file (assuming it's the first file in the ZIP)
	// const txt = await response.text();
	// return parsePgp23(txt, path);
}


// get 23andme text file from user url----------------------------
async function parse23(txt, url) {
    let obj = {}
    let rows = String(txt ?? "").split(/[\r\n]+/g).filter(Boolean)
    obj.txt = txt
    obj.url = url

    let n = rows.filter(r => r && r[0] == '#').length
    if (n === 0) {
        throw new Error(`Invalid 23andMe file format: missing header in ${url}`)
    }

    obj.meta = rows.slice(0, n - 1).join('\r\n')
    obj.cols = rows[n - 1].replace(/^#\s*/, '').split(/\t/)
    obj.dt = rows.slice(n)
    obj.dt = obj.dt.map((r, i) => {
        r = r.split('\t')
        r[2] = parseInt(r[2])
        // position in the chr
        r[4] = i
        return r
    })
    return obj
}

// load and parse 23andme files into SNP data
async function get23(urls) {
    console.log('urls',urls)

    let arr23Txts = []
    //console.log("getting all23me data from", urls.length, "23andMe urls:", urls)
    for (let i = 0; i < urls.length; i++) {
        const sourceUrl = urls[i]
        let user = await all23meFiles.getItem(sourceUrl);
        console.log('checking 23andMe file #', i + 1, " ...  ", sourceUrl, " (cached:", Boolean(user), ")")
        if (user == null) {
            let url2 = /^https?:\/\//.test(sourceUrl) ? 'https://corsproxy.io/?' + sourceUrl : sourceUrl
            console.log('url2',url2)

            const response = await fetch(url2)
            if (!response.ok) {
                continue
            }
            user = await response.text()

            await all23meFiles.setItem(sourceUrl, user);
        }
        //console.log('checking 23andMe file #', i, " ...  ", urls[i], )

        const userTxt = String(user ?? "")
        if (userTxt.startsWith('# This data file generated by 23andMe')) {
            let parsedUser = await parse23(userTxt, sourceUrl)
            arr23Txts.push(parsedUser)
            //console.log('parsedUser:',parsedUser)
        } else {
            //console.log("ERROR:This is NOT a valid 23andMe file:", user.substring(0, 37))
        }
    }
    // data["my23Txts"]  =  arr23Txts
    // data["my23Urls"]  =arrUrls
    // return data
    return arr23Txts
}


export {
    get23meUrls,
    get23,
    parse23,
    parsePgp23 as parsePGP23,
    load23andMeFile
}