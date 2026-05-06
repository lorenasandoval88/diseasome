var self = globalThis;

// pgs_node.js - Node-safe ingestion functions for Cloud Run deployment
// Zero browser dependencies: no window, document, localforage, or plotly.js
// Pure data fetching and parsing with multi-proxy fallback

const PGS_API_BASE = "https://www.pgscatalog.org/api/v2";

const PROXY_URLS = [
  // Primary
  (url) => url,
  // Fallback proxies
  (url) => `https://cors-anywhere.herokuapp.com/${url}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

async function fetchWithFallback(url, maxRetries = PROXY_URLS.length) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const proxyUrl = PROXY_URLS[i % PROXY_URLS.length](url);
      const response = await fetch(proxyUrl, {
        headers: { "User-Agent": "pgp-cloud-sdk/1.0" },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Fetch failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Fetch available data types from PGS Catalog
 * @returns {Promise<Array>} Array of available data type objects
 */
async function fetchAvailableDataTypes() {
  try {
    const data = await fetchWithFallback(`${PGS_API_BASE}/metadata/`);
    return data?.results || [];
  } catch (err) {
    console.error("fetchAvailableDataTypes error:", err.message);
    return [];
  }
}

/**
 * Fetch all user metadata by type (fast cached route)
 * @param {string} dataType - Type of data to fetch
 * @returns {Promise<Object>} Metadata indexed by type
 */
async function allUsersMetaDataByType_fast(dataType = "scores") {
  try {
    const url =
      dataType === "scores"
        ? `${PGS_API_BASE}/scores/?limit=1000`
        : `${PGS_API_BASE}/traits/?limit=1000`;

    const data = await fetchWithFallback(url);
    return {
      type: dataType,
      count: data?.count || 0,
      results: data?.results || [],
      nextUrl: data?.next || null,
    };
  } catch (err) {
    console.error(`allUsersMetaDataByType_fast(${dataType}) error:`, err.message);
    return { type: dataType, count: 0, results: [], nextUrl: null };
  }
}

/**
 * Fetch a specific user or profile by ID
 * @param {string} id - Profile ID
 * @param {string} type - Profile type (score, trait, etc.)
 * @returns {Promise<Object>} Profile data
 */
async function fetchProfile(id, type = "score") {
  try {
    const endpoint = type === "trait" ? "traits" : "scores";
    const url = `${PGS_API_BASE}/${endpoint}/${id}/`;
    const data = await fetchWithFallback(url);
    return data;
  } catch (err) {
    console.error(`fetchProfile(${id}) error:`, err.message);
    return null;
  }
}

/**
 * Load and parse a 23andMe-format file (tab-delimited)
 * @param {string|Buffer} fileContent - File content as string or Buffer
 * @returns {Promise<Object>} Parsed 23andMe data
 */
async function load23andMeFile(fileContent) {
  try {
    const text =
      typeof fileContent === "string"
        ? fileContent
        : fileContent.toString("utf-8");

    const lines = text.split(/[\r\n]+/).filter((line) => line.trim());
    const header = lines
      .filter((line) => line.startsWith("#"))
      .map((line) => line.slice(1));

    const data = lines
      .filter((line) => !line.startsWith("#"))
      .map((line) => parse23Line(line));

    return {
      header,
      variantCount: data.length,
      variants: data,
    };
  } catch (err) {
    console.error("load23andMeFile error:", err.message);
    return { header: [], variantCount: 0, variants: [] };
  }
}

/**
 * Parse a single 23andMe variant line
 * @param {string} line - Tab-delimited line
 * @returns {Object} Parsed variant
 */
function parse23Line(line) {
  const [rsid, chr, pos, genotype] = line.split(/\t/);
  return {
    rsid: rsid || null,
    chromosome: chr || null,
    position: parseInt(pos) || 0,
    genotype: genotype || null,
  };
}

/**
 * Parse 23andMe-format text data (convenience wrapper)
 * @param {string} txtData - Raw 23andMe text
 * @returns {Object} Parsed data structure
 */
async function parse23Txt(txtData) {
  return load23andMeFile(txtData);
}

export { allUsersMetaDataByType_fast, fetchAvailableDataTypes, fetchProfile, load23andMeFile, parse23Txt };
//# sourceMappingURL=cloud_sdk.mjs.map
