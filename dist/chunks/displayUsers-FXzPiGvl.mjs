import { allUsersMetaDataByType_fast, get23Txt } from 'https://lorenasandoval88.github.io/personal_genomes_project_sdk/dist/sdk.mjs';
import { l as localforage } from '../app.mjs';
import 'https://lorenasandoval88.github.io/pgs_catalog_sdk/dist/sdk.mjs';
import 'https://lorenasandoval88.github.io/clustjs/dist/sdk.mjs';
import 'https://esm.run/@mlc-ai/web-llm';

// console.log("displayUsers.js loaded")

/**
 * Extract a human-readable full name from a genome filename.
 * e.g. "PGP_hu09B28E_genome_Joshua_Yoakem_v5_Full_...txt" → "Joshua Yoakem"
 */
function nameFromFilename(filename) {
	if (!filename) return null;
	const base = String(filename).replace(/.*\//, '');
	const m = base.match(/(?:^|_)genome_(.+?)_[vV]\d+_/i);
	if (!m) return null;
	return m[1]
		.replace(/_/g, ' ')
		.replace(/\b\w/g, c => c.toUpperCase())
		.trim() || null;
}

/**
 * Truncate a URL for compact display: keep scheme + host prefix and the last path
 * segment, e.g. "https://my.pgp-hms.org/user_file/download/4215" -> "https:// ... /4215".
 */
function truncateUrlForDisplay(url) {
	if (!url) return '';
	try {
		const u = new URL(url);
		const last = u.pathname.split('/').filter(Boolean).pop() || u.hostname;
		return `${u.protocol}// ... /${last}`;
	} catch {
		const s = String(url);
		const last = s.split('/').filter(Boolean).pop() || s;
		return `https:// ... /${last}`;
	}
}

/**
 * Extract age, gender, race, and ethnicity from a PGP profile's Google survey results.
 * `google_survey_results` is an array of surveys; each survey is an array of
 * [question, answer] pairs. We scan all pairs across all surveys.
 * Age is taken from "What is your age (in years)?" or computed from "Year of birth".
 * Race/ethnicity fallbacks use the combined "Race/ethnicity" field only when the
 * dedicated questions are missing. Grandparent race/ethnicity questions are ignored.
 */
function extractDemographics(profile) {
	const out = { age: null, gender: null, race: null, ethnicity: null };
	const surveys = profile?.google_survey_results;
	if (!Array.isArray(surveys)) return out;

	let birthYear = null;
	let raceEthnicityCombined = null;
	const currentYear = new Date().getFullYear();

	for (const survey of surveys) {
		if (!Array.isArray(survey)) continue;
		for (const pair of survey) {
			if (!Array.isArray(pair) || pair.length < 2) continue;
			const q = String(pair[0] ?? '').toLowerCase();
			const a = pair[1];
			if (a == null || a === '') continue;

			// Skip grandparent race/ethnicity questions (self only)
			const isGrandparent = q.includes('grandmother') || q.includes('grandfather');

			if (out.age == null && q.includes('what is your age')) {
				const n = parseInt(String(a), 10);
				if (Number.isFinite(n)) out.age = n;
			} else if (birthYear == null && q.includes('year of birth')) {
				const n = parseInt(String(a), 10);
				if (Number.isFinite(n) && n > 1900 && n <= currentYear) birthYear = n;
			}

			if (out.gender == null) {
				if (q === 'what is your gender?' || q.includes('sex/gender') || q.includes('anatomical sex at birth')) {
					if (!isGrandparent) out.gender = String(a).trim();
				}
			}

			if (out.race == null && !isGrandparent && q.includes('what is your race')) {
				out.race = String(a).trim();
			}
			if (out.ethnicity == null && !isGrandparent && q === 'what is your ethnicity?') {
				out.ethnicity = String(a).trim();
			}
			if (raceEthnicityCombined == null && !isGrandparent && q === 'race/ethnicity') {
				raceEthnicityCombined = String(a).trim();
			}
		}
	}

	if (out.age == null && birthYear != null) {
		out.age = currentYear - birthYear;
	}
	// Fall back to the combined field if the dedicated ones were absent
	if (out.race == null && raceEthnicityCombined) out.race = raceEthnicityCombined;
	if (out.ethnicity == null && raceEthnicityCombined) out.ethnicity = raceEthnicityCombined;
	return out;
}

/**
 * Map a single raw race token to a clean canonical category.
 * Returns null for non-informative answers (no response / prefer not to answer).
 */
function normalizeRaceToken(token) {
	const l = String(token ?? '').trim().toLowerCase();
	if (!l) return null;
	if (l.includes('american indian') || l.includes('alaska native')) return 'American Indian / Alaska Native';
	if (l.includes('african american') || l.includes('black')) return 'Black or African American';
	if (l.includes('native hawaiian') || l.includes('pacific islander')) return 'Native Hawaiian or Other Pacific Islander';
	if (l.includes('hispanic') || l.includes('latino')) return 'Hispanic or Latino';
	if (l.includes('caucasian') || l === 'white' || l.startsWith('white')) return 'White';
	if (l.includes('asian')) return 'Asian';
	if (l.includes('prefer not') || l === 'no response' || l === 'unknown' || l === 'n/a') return null;
	return 'Other';
}

/**
 * Normalize a raw race answer (often a comma-joined multi-select or free text)
 * into an array of clean, de-duplicated canonical categories.
 * @param {string|null} raw
 * @returns {string[]}
 */
function normalizeRaceCategories(raw) {
	if (raw == null || raw === '') return ['Unknown'];
	const set = new Set();
	for (const tok of String(raw).split(/[,;/]|\band\b/i)) {
		const cat = normalizeRaceToken(tok);
		if (cat) set.add(cat);
	}
	return set.size ? Array.from(set) : ['Unknown'];
}

/**
 * Normalize a raw ethnicity answer into a single clean canonical category.
 * @param {string|null} raw
 * @returns {string[]}
 */
function normalizeEthnicityCategories(raw) {
	if (raw == null || raw === '') return ['Unknown'];
	const l = String(raw).toLowerCase();
	if (l.includes('not hispanic')) return ['Not Hispanic or Latino'];
	if (l.includes('hispanic') || l.includes('latino') || l.includes('spanish')) return ['Hispanic or Latino'];
	if (l.includes('prefer not') || l === 'no response' || l === 'unknown' || l === 'n/a') return ['Unknown'];
	return ['Other'];
}

/**
 * Flatten a curated participant record from `pgp_participants_1017_with_profiles.json`
 * into the shape expected by the rest of this module. The new schema nests file-level
 * fields under `files[]`; the old code reads them at the top level.
 * We pick a primary file (prefer the first valid 23andMe file) and copy its fields up.
 * We also derive `age`, `gender`, and `valid23File` (any file is valid).
 */
function flattenCuratedRecord(rec) {
	if (!rec || typeof rec !== 'object') return rec;
	const files = Array.isArray(rec.files) ? rec.files : [];
	const anyValid23 = files.some(f => f?.valid23File === true);
	const { age, gender, race, ethnicity } = extractDemographics(rec.profile);
	const flat = {
		id: rec.id,
		profileUrl: rec.profileUrl ?? null,
		number_of_files: rec.number_of_files ?? files.length,
		files,
		// Derived fields
		valid23File: anyValid23,
		age,
		gender,
		race,
		ethnicity,
		raceCategories: normalizeRaceCategories(race),
		ethnicityCategories: normalizeEthnicityCategories(ethnicity),
		// Preserve original profile for downstream use if needed
		profile: rec.profile ?? null,
	};
	// Copy the primary file's fields (publishedDate, filename, build, size, download, …) up.
	applyActiveFile(flat, defaultFileIndex(flat));
	return flat;
}

/** Fetch the curated participants JSON and flatten each record. */
async function fetchCuratedParticipants() {
	const res = await fetch('data/pgp_participants_1017_with_profiles.json');
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const raw = await res.json();
	return Array.isArray(raw) ? raw.map(flattenCuratedRecord) : [];
}

// Update loading progress indicator
const participantsProgressBar = document.getElementById('participantsProgressBar');
function setParticipantsLoadingProgress(progress) {
	if (participantsProgressBar) {
		participantsProgressBar.style.width = `${progress}%`;
	}
}

// Show initial loading state
setParticipantsLoadingProgress(20);

setParticipantsLoadingProgress(50);
// Default to 'json' mode — curated pre-validated list (fast, includes filename/build/size)
let curatedJsonParticipants = null;
try {
	curatedJsonParticipants = await fetchCuratedParticipants();
} catch (err) {
	console.error('Failed to load curated JSON:', err);
	curatedJsonParticipants = [];
}
setParticipantsLoadingProgress(100);

let participants = curatedJsonParticipants ?? [];
let allParticipantsFast = null; // fetched lazily when user switches to 'all' mode
let allParticipantsFetchedAt = null; // ISO date string of last successful fetch
const ALL_PARTICIPANTS_CACHE_KEY = 'PGP:AllParticipantsFast';
let participantLoadMode = 'json'; // 'all' | 'json' — sorting is only enabled in 'json' mode
let sortState = { key: null, dir: 'asc' }; // key: 'version' | 'build' | 'size' | null

// Restore any prior cached "All Participants" fetch from localforage
try {
	const cached = await localforage.getItem(ALL_PARTICIPANTS_CACHE_KEY);
	if (cached && Array.isArray(cached.data)) {
		allParticipantsFast = cached.data;
		allParticipantsFetchedAt = cached.fetchedAt ?? null;
	}
} catch (err) {
	console.warn('Failed to read cached All Participants:', err);
}

/** Format an ISO date string as a short human-readable local date/time. */
function formatFetchedAt(iso) {
	if (!iso) return '';
	const d = new Date(iso);
	if (isNaN(d.getTime())) return '';
	return d.toLocaleString();
}

/** Update the "cached since <date>" info line under the Fetch All Participants button. */
function updateAllParticipantsCacheInfoUI() {
	const wrap = document.getElementById('allParticipantsCacheInfo');
	const dateEl = document.getElementById('allParticipantsCacheDate');
	if (!wrap || !dateEl) return;
	const showLine = participantLoadMode === 'all' && !!allParticipantsFetchedAt;
	if (showLine) {
		dateEl.textContent = `Cached: ${formatFetchedAt(allParticipantsFetchedAt)}${allParticipantsFast ? ` (${allParticipantsFast.length})` : ''}`;
		wrap.style.display = '';
	} else {
		wrap.style.display = 'none';
	}
}
updateAllParticipantsCacheInfoUI();

// Reflect count on the curated JSON button now that it's loaded
{
	const jsonBtn = document.getElementById('modeJsonBtn');
	if (jsonBtn) jsonBtn.textContent = `From Curated List`;
}

const ROWS_PER_PAGE = 200;
const MAX_SELECTION = 10;

// Module-level selected users (shared across renders)
const selectedUserIds = new Set();
const selectedUsersMap = new Map(); // Map<id, userObject>

// Active file-level filters (version/build/valid/size). Null when none are active.
// Used to gray out / disable individual files that don't match on multi-file rows.
let activeFileFilters = null;

/** Get the currently selected user IDs. */
window.getSelectedUserIds = () => Array.from(selectedUserIds);

/** Get the currently selected users with full metadata. */
window.getSelectedUsers = () => Array.from(selectedUsersMap.values());

/** Clear only PGP participant selections (leaves uploaded files intact). */
window.clearPGPSelections = function () {
	for (const [id, user] of selectedUsersMap) {
		if (user.dataSource !== "file Upload") {
			selectedUsersMap.delete(id);
			selectedUserIds.delete(id);
		}
	}
	// Uncheck all PGP checkboxes in the participant table
	document.querySelectorAll('#localUsersDiv input[type="checkbox"]').forEach(cb => { cb.checked = false; cb.indeterminate = false; });
	updateGlobalSelectionCount();
};

/** Clear only uploaded local file selections (leaves PGP participants intact). */
window.clearUploadedFiles = function () {
	for (const [id, user] of selectedUsersMap) {
		if (user.dataSource === "file Upload") {
			selectedUsersMap.delete(id);
			selectedUserIds.delete(id);
		}
	}
	const statusEl = document.getElementById("my23Status");
	if (statusEl) statusEl.textContent = "";
	updateGlobalSelectionCount();
};


/**
 * Disable unchecked participant checkboxes once the selection limit is reached,
 * so clicks are visibly blocked (with an explanatory tooltip) rather than silently ignored.
 */
function updateSelectionAvailability() {
	const atLimit = selectedUserIds.size >= MAX_SELECTION;
	// Parent (tri-state) checkboxes and filter-excluded file checkboxes are skipped —
	// parents must always allow deselecting, and filtered-out files stay disabled.
	document.querySelectorAll('#localUsersDiv .participant-select:not(.participant-parent):not(.file-filtered-out)').forEach((cb) => {
		if (cb.checked) {
			cb.disabled = false;
			cb.title = '';
		} else {
			cb.disabled = atLimit;
			cb.title = atLimit ? `Limit of ${MAX_SELECTION} reached — deselect one to add another.` : '';
		}
	});
}

/** Update the global selection count display. */
function updateGlobalSelectionCount() {
	const count = selectedUserIds.size;
	const atLimit = count >= MAX_SELECTION;

	// Prominent sticky bar: label + filled progress indicator
	const el = document.getElementById("globalSelectionCount2");
	if (el) el.textContent = `${count} of ${MAX_SELECTION} files selected`;
	const bar = document.getElementById("selectionProgressBar");
	if (bar) {
		const pct = Math.min(100, Math.round((count / MAX_SELECTION) * 100));
		bar.style.width = `${pct}%`;
		bar.setAttribute('aria-valuenow', String(count));
		bar.classList.toggle('bg-success', !atLimit);
		bar.classList.toggle('bg-danger', atLimit);
	}
	const limitMsg = document.getElementById("selectionLimitMsg");
	if (limitMsg) limitMsg.style.display = atLimit ? '' : 'none';

	// Block further selection when the limit is reached
	updateSelectionAvailability();

	// Update loaded count: uploaded files are already parsed, show them immediately
	const loadedCount = document.getElementById("loadedFilesCount");
	if (loadedCount) {
		const alreadyLoaded = Array.from(selectedUsersMap.values()).filter(u => u._parsed && u._parsed.dt && u._parsed.dt.length > 0);
		if (alreadyLoaded.length > 0) {
			loadedCount.textContent = `Loaded Data: ${alreadyLoaded.length} / ${selectedUserIds.size}`;
			loadedCount.style.display = '';
		} else {
			loadedCount.style.display = 'none';
		}
	}

	// Show/hide Fetch button based on whether any users are selected
	const fetchBtn = document.getElementById("fetchUsersBtn");
	if (fetchBtn) {
		fetchBtn.style.display = selectedUserIds.size > 0 ? '' : 'none';
		// Reset to red whenever selection changes (new upload or PGP selection)
		fetchBtn.classList.remove('btn-secondary');
		fetchBtn.classList.add('btn-danger');
	}


	// Show/hide unselect buttons based on what is selected
	const hasUploaded = Array.from(selectedUsersMap.values()).some(u => u.dataSource === 'file Upload');
	const clearUploadedBtn = document.getElementById('clearUploadedBtn');
	if (clearUploadedBtn) clearUploadedBtn.style.display = hasUploaded ? '' : 'none';

	// Also update PRS tab user section to reflect selection
	const prsUsersdiv = document.getElementById("prsUsersdiv");
	if (prsUsersdiv && selectedUserIds.size > 0) {
		const users = Array.from(selectedUsersMap.values());
		const nameCounts = new Map();
		users.forEach(u => {
			const n = u.name || u.id;
			nameCounts.set(n, (nameCounts.get(n) || 0) + 1);
		});
		const userList = users
			.map(u => {
				const n = u.name || u.id;
				return nameCounts.get(n) > 1 ? `${n} (${u.id})` : n;
			})
			.join(", ");
		prsUsersdiv.textContent = `${selectedUserIds.size} user(s) selected: ${userList}`;
	}

	// Mirror the fallback-users table for the current selection in the PRS tab
	renderSelectedUsersTable();

	// console.log(`Selection updated: ${selectedUserIds.size} user(s)`, Array.from(selectedUserIds));
}

/**
 * Render the current selection into #prsUsersAction using the same columns/style
 * as loadFallbackUsers / fetchUsers, so users see a table in the PRS tab immediately
 * after uploading or selecting participants (without having to click Load Fallback Users).
 */
function renderSelectedUsersTable() {
	const container = document.getElementById('prsUsersAction');
	if (!container) return;
	const selectedUsers = Array.from(selectedUsersMap.values());
	if (selectedUsers.length === 0) {
		container.innerHTML = '';
		return;
	}
	const rows = selectedUsers.map((user, idx) => {
		const id = escapeHtml(user?.id ?? user?.participant_id ?? "");
		const displayId = escapeHtml(user?.participant_id ?? user?.id ?? "");
		// Multi-file selections share a participant_id; show which file this row is.
		const fileTag = (user?.participant_id != null && user?.id !== user?.participant_id && user?._fileIndex != null)
			? ` <span class="badge bg-secondary rounded-pill">file ${user._fileIndex + 1}</span>`
			: "";
		const name = escapeHtml(user?.name ?? "");
		const published = escapeHtml(user?.publishedDate ?? user?.published_date ?? user?.date ?? "");
		const genos = user?.genotypes ?? [];
		const genoCount = genos.length || (user?.downloadUrl || user?.finalUrl || user?.fileName ? 1 : 0);
		const downloadUrl =
			user?.downloadUrl ?? user?.download_url ?? user?.finalUrl ??
			(genos[0]?.download_url ?? genos[0]?.file) ?? "";
		const downloadHtml = downloadUrl
			? `<a href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener">Download</a>`
			: "-";
		const variantCount = user?._parsed?.dt?.length ?? 0;
		return `
			<tr>
				<td>${idx + 1}</td>
				<td><input type="checkbox" class="form-check-input prs-user-select-cb" value="${id}" checked /></td>
				<td>${displayId}${fileTag}</td>
				<td>${name}</td>
				<td>${published}</td>
				<td>${genoCount}</td>
				<td>${variantCount.toLocaleString()}</td>
				<td>${downloadHtml}</td>
			</tr>`;
	}).join("");
	container.innerHTML = `
		<table class="table table-striped table-sm mt-3">
			<thead class="table-dark">
				<tr>
					<th>#</th>
					<th>Select</th>
					<th>Participant ID</th>
					<th>Name</th>
					<th>Published Date</th>
					<th>Genotypes #</th>
					<th>Variants Loaded</th>
					<th>Download</th>
				</tr>
			</thead>
			<tbody>${rows}</tbody>
		</table>`;
}
/**
 * escapeHtml(value)
 * Escape HTML special characters to prevent injection when inserting text into the DOM.
 * @param {any} value
 * @returns {string}
 */
function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

/**
 * sanitizeKey(value)
 * Produce a lowercase alphanumeric underscore-only key suitable for element IDs.
 * @param {string} value
 * @returns {string}
 */
function sanitizeKey(value) {
	return String(value)
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "_")
		.replaceAll(/^_+|_+$/g, "");
}

/** Return a published/date string from an item using common property names. */
function getPublishedDate(item) {
	return item.publishedDate ?? item.published_date ?? item.date ?? item.created ?? "-";
}

/** Prefer known download URL fields (downloadUrl, download_url, url, profileUrl). */
function getDownloadUrl(item) {
	return item.downloadUrl ?? item.download_url ?? item.url ?? item.profileUrl ?? null;
}

/** Extract a profile URL from common candidate properties. */
function getProfileUrl(item) {
	return item.profileUrl ?? item.profile_url ?? null;
}

/** Trigger a browser download of `content` as a file. */
function downloadAsFile(content, filename, mime = 'text/plain') {
	const blob = new Blob([content], { type: `${mime};charset=utf-8` });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Escape a single CSV field per RFC 4180. */
function csvEscape(value) {
	if (value == null) return '';
	const s = String(value);
	return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** Convert a participants list to CSV using a curated, human-friendly column set. */
function participantsToCsv(list) {
	const cols = [
		'id', 'name', 'age', 'gender', 'race', 'ethnicity', 'valid23File', 'version', 'build', 'sizeMB', 'filename',
		'publishedDate', 'profileUrl', 'downloadUrl', 'finalUrl'
	];
	const rows = list.map((p) => {
		const version = extractVersion(p) ?? '';
		const build = p.genomeBuild ?? p.build ?? '';
		const sizeMB = p.genomeBuildFiles?.[0]?.sizeMB ?? p.sizeMB ?? '';
		const filename = p.gcsfilename ?? p.innerFilename ?? p.filename ?? p.fileName ?? p.genotypes?.[0]?.filename ?? '';
		const published = p.publishedDate ?? p.published_date ?? p.date ?? p.created ?? '';
		return [
			p.id ?? p.participant_id ?? '',
			p.name ?? '',
			p.age ?? '',
			p.gender ?? '',
			p.race ?? '',
			p.ethnicity ?? '',
			p.valid23File == null ? '' : (p.valid23File ? 'true' : 'false'),
			version,
			build,
			sizeMB,
			filename,
			published,
			p.profileUrl ?? p.profile_url ?? '',
			p.downloadUrl ?? p.download_url ?? p.url ?? '',
			p.finalUrl ?? '',
		].map(csvEscape).join(',');
	});
	return [cols.join(','), ...rows].join('\r\n');
}

/**
 * extractVersion(item)
 * Extract 23andMe chip version(s) from a genome filename.
 * Returns a comma-joined string when multiple versions are present,
 * e.g. "genome_Mark_Jones_v2_v3_v5_Full_..." -> "v2,v3,v5".
 * @param {Object} item
 * @returns {string|null}
 */
function extractVersion(item) {
	const filename = item.gcsfilename ?? item.innerFilename ?? item.filename ?? item.fileName ?? item.genotypes?.[0]?.filename ?? item.name ?? '';
	const s = String(filename);
	// Restrict to the "genome_..._Full" section when present to avoid false matches elsewhere
	const section = s.match(/genome_.*?_Full/i)?.[0] ?? s;
	const nums = [...section.matchAll(/_v(\d+)/gi)].map(m => m[1]);
	if (nums.length === 0) return null;
	return nums.map(n => `v${n}`).join(',');
}

/**
 * Populate the `participantsVersionSelect` dropdown with available 23andMe chip versions.
 * @returns {void}
 */
function populateVersionSelect() {
	const sel = document.getElementById('participantsVersionSelect');
	if (!sel) return;
	const counts = new Map();
	participants.forEach((p) => {
		const v = extractVersion(p);
		const key = v ?? 'Unknown';
		counts.set(key, (counts.get(key) || 0) + 1);
	});
	// Sort versions numerically (v3, v4, v5, etc.)
	const versions = Array.from(counts.keys()).filter(k => k !== 'Unknown').sort((a, b) => {
		const numA = parseInt(a.replace('v', ''));
		const numB = parseInt(b.replace('v', ''));
		return numA - numB;
	});
	const entries = versions.map(v => [v, counts.get(v)]);
	if (counts.has('Unknown')) entries.push(['Unknown', counts.get('Unknown')]);
	renderCheckboxFilter(sel, entries);
}
window.populateVersionSelect = populateVersionSelect;

/**
 * Populate the build dropdown from the current participants list.
 */
function populateBuildSelect() {
	const sel = document.getElementById('participantsBuildSelect');
	if (!sel) return;
	const counts = new Map();
	participants.forEach((p) => {
		const raw = p.genomeBuild ?? p.build;
		const key = (raw == null || raw === '') ? 'Unknown' : String(raw);
		counts.set(key, (counts.get(key) || 0) + 1);
	});
	const builds = Array.from(counts.keys())
		.filter(k => k !== 'Unknown')
		.sort((a, b) => {
			const na = parseInt(a, 10), nb = parseInt(b, 10);
			if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
			return String(a).localeCompare(String(b));
		});
	const entries = builds.map(v => [v, counts.get(v)]);
	if (counts.has('Unknown')) entries.push(['Unknown', counts.get('Unknown')]);
	renderCheckboxFilter(sel, entries);
}
window.populateBuildSelect = populateBuildSelect;

/**
 * Return an array of selected values from a filter control.
 * Supports both checkbox-list containers (current UI) and legacy <select multiple>.
 */
function getSelectValues(el) {
	if (!el) return [];
	if (el.classList?.contains('filter-check-list') || el.querySelector?.('input[type="checkbox"]')) {
		return Array.from(el.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value).filter(v => v !== '');
	}
	return Array.from(el.selectedOptions ?? []).map(o => o.value).filter(v => v !== '');
}

/**
 * Render a checkbox-list filter into a container, preserving any prior checked state.
 * A one-time delegated change listener re-applies participant filters whenever a box toggles.
 * @param {HTMLElement} container  the `.filter-check-list` element
 * @param {Array<[string, number]>} entries  ordered [value, count] pairs
 */
function renderCheckboxFilter(container, entries) {
	if (!container) return;
	const prev = new Set(getSelectValues(container));
	const name = container.id || 'flt';
	container.innerHTML = entries.map(([value, count], i) => {
		const optId = `${name}_opt_${i}`;
		const checked = prev.has(value) ? 'checked' : '';
		return `<label class="filter-chip" for="${optId}">`
			+ `<input type="checkbox" id="${optId}" value="${escapeHtml(value)}" ${checked} />`
			+ `<span class="filter-chip-label">${escapeHtml(value)}</span>`
			+ `<span class="filter-chip-count">${count}</span>`
			+ `</label>`;
	}).join('');
	if (!container.dataset.wired) {
		container.addEventListener('change', () => applyParticipantFilters());
		container.dataset.wired = '1';
	}
}

/** Uncheck every option in a checkbox-list filter and re-apply filters. */
window.clearCheckboxFilter = function clearCheckboxFilter(containerId) {
	const c = document.getElementById(containerId);
	if (!c) return;
	c.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
	applyParticipantFilters();
};

/**
 * Populate a demographic dropdown (gender / race / ethnicity) from the current
 * participants list. Values with an empty/unknown answer are grouped under "Unknown".
 * @param {string} elementId  target <select> element id
 * @param {'gender'|'race'|'ethnicity'} field  participant field to summarize
 */
function populateDemographicSelect(elementId, field) {
	const sel = document.getElementById(elementId);
	if (!sel) return;
	const isMulti = field === 'raceCategories' || field === 'ethnicityCategories';
	const counts = new Map();
	participants.forEach((p) => {
		if (isMulti) {
			const cats = (Array.isArray(p?.[field]) && p[field].length) ? p[field] : ['Unknown'];
			new Set(cats).forEach(c => counts.set(c, (counts.get(c) || 0) + 1));
		} else {
			const raw = p?.[field];
			const key = (raw == null || raw === '') ? 'Unknown' : String(raw);
			counts.set(key, (counts.get(key) || 0) + 1);
		}
	});
	// Sort alphabetically but push the catch-all buckets to the bottom.
	const rank = (k) => (k === 'Other' ? 1 : (k === 'Unknown' ? 2 : 0));
	const values = Array.from(counts.keys()).sort((a, b) => {
		const ra = rank(a), rb = rank(b);
		if (ra !== rb) return ra - rb;
		return String(a).localeCompare(String(b));
	});
	const entries = values.map(v => [v, counts.get(v)]);
	renderCheckboxFilter(sel, entries);
}

function populateGenderSelect() { populateDemographicSelect('participantsGenderSelect', 'gender'); }
function populateRaceSelect() { populateDemographicSelect('participantsRaceSelect', 'raceCategories'); }
function populateEthnicitySelect() { populateDemographicSelect('participantsEthnicitySelect', 'ethnicityCategories'); }
window.populateGenderSelect = populateGenderSelect;
window.populateRaceSelect = populateRaceSelect;
window.populateEthnicitySelect = populateEthnicitySelect;

/** Bucket a participant's 23andMe validity into a filter category. */
function validCategory(p) {
	return p?.valid23File === true ? 'Valid' : (p?.valid23File === false ? 'Invalid' : 'Unknown');
}

/**
 * Whether a single file (or file-selection object) satisfies the currently active
 * file-level filters (version, build, valid, size). Demographic filters are
 * participant-level and don't distinguish individual files. Returns true when no
 * file-level filters are active.
 * @param {Object} file
 * @returns {boolean}
 */
function fileMatchesActiveFilters(file) {
	const f = activeFileFilters;
	if (!f) return true;
	if (f.versions && !f.versions.has(extractVersion(file) ?? 'Unknown')) return false;
	if (f.builds) {
		const raw = file.genomeBuild ?? file.build;
		const key = (raw == null || raw === '') ? 'Unknown' : String(raw);
		if (!f.builds.has(key)) return false;
	}
	if (f.valids && !f.valids.has(validCategory(file))) return false;
	if (f.sizeMin != null || f.sizeMax != null) {
		const n = Number(file.genomeBuildFiles?.[0]?.sizeMB ?? file.sizeMB);
		if (!Number.isFinite(n)) return false;
		if (f.sizeMin != null && n < f.sizeMin) return false;
		if (f.sizeMax != null && n > f.sizeMax) return false;
	}
	return true;
}

/** Populate the Valid-23andMe checkbox filter from the current participants list. */
function populateValidSelect() {
	const sel = document.getElementById('participantsValidSelect');
	if (!sel) return;
	const counts = new Map();
	participants.forEach((p) => {
		const key = validCategory(p);
		counts.set(key, (counts.get(key) || 0) + 1);
	});
	const entries = ['Valid', 'Invalid', 'Unknown'].filter(k => counts.has(k)).map(k => [k, counts.get(k)]);
	renderCheckboxFilter(sel, entries);
}
window.populateValidSelect = populateValidSelect;

/** Populate all participant filter selects (version, build, gender, race, ethnicity, valid). */
function populateAllFilters() {
	populateVersionSelect();
	populateBuildSelect();
	populateGenderSelect();
	populateRaceSelect();
	populateEthnicitySelect();
	populateValidSelect();
}

/**
 * Apply all filters (version, build, size range) to participants and re-render the table.
 * @returns {void}
 */
function applyParticipantFilters() {
	const versionSel = document.getElementById('participantsVersionSelect');
	const buildSel = document.getElementById('participantsBuildSelect');
	const genderSel = document.getElementById('participantsGenderSelect');
	const raceSel = document.getElementById('participantsRaceSelect');
	const ethnicitySel = document.getElementById('participantsEthnicitySelect');
	const validSel = document.getElementById('participantsValidSelect');
	const sizeMinEl = document.getElementById('participantsSizeMin');
	const sizeMaxEl = document.getElementById('participantsSizeMax');
	const versions = getSelectValues(versionSel);
	const builds = getSelectValues(buildSel);
	const genders = getSelectValues(genderSel);
	const races = getSelectValues(raceSel);
	const ethnicities = getSelectValues(ethnicitySel);
	const valids = getSelectValues(validSel);
	const sizeMinRaw = sizeMinEl?.value ?? '';
	const sizeMaxRaw = sizeMaxEl?.value ?? '';
	const sizeMin = sizeMinRaw === '' ? null : Number(sizeMinRaw);
	const sizeMax = sizeMaxRaw === '' ? null : Number(sizeMaxRaw);

	let list = participants;

	if (versions.length > 0) {
		const set = new Set(versions);
		list = list.filter(p => set.has(extractVersion(p) ?? 'Unknown'));
	}
	if (builds.length > 0) {
		const set = new Set(builds);
		list = list.filter(p => {
			const raw = p.genomeBuild ?? p.build;
			const key = (raw == null || raw === '') ? 'Unknown' : String(raw);
			return set.has(key);
		});
	}
	const filterByDemographic = (arr, field, multi) => {
		if (arr.length === 0) return;
		const set = new Set(arr);
		list = list.filter(p => {
			if (multi) {
				const cats = (Array.isArray(p?.[field]) && p[field].length) ? p[field] : ['Unknown'];
				return cats.some(c => set.has(c));
			}
			const raw = p?.[field];
			const key = (raw == null || raw === '') ? 'Unknown' : String(raw);
			return set.has(key);
		});
	};
	filterByDemographic(genders, 'gender', false);
	filterByDemographic(races, 'raceCategories', true);
	filterByDemographic(ethnicities, 'ethnicityCategories', true);
	if (valids.length > 0) {
		const set = new Set(valids);
		list = list.filter(p => set.has(validCategory(p)));
	}
	if (sizeMin != null || sizeMax != null) {
		list = list.filter(p => {
			const n = Number(p.genomeBuildFiles?.[0]?.sizeMB ?? p.sizeMB);
			if (!Number.isFinite(n)) return false;
			if (sizeMin != null && n < sizeMin) return false;
			if (sizeMax != null && n > sizeMax) return false;
			return true;
		});
	}

	// Record file-level filters so multi-file rows can gray out / disable non-matching files,
	// then drop any already-selected PGP file that no longer matches those filters.
	activeFileFilters = (versions.length || builds.length || valids.length || sizeMin != null || sizeMax != null)
		? {
			versions: versions.length ? new Set(versions) : null,
			builds: builds.length ? new Set(builds) : null,
			valids: valids.length ? new Set(valids) : null,
			sizeMin,
			sizeMax,
		}
		: null;
	let prunedSelection = false;
	if (activeFileFilters) {
		for (const [id, sel] of selectedUsersMap) {
			if (sel.dataSource === 'file Upload') continue; // uploads aren't PGP files
			if (!fileMatchesActiveFilters(sel)) {
				selectedUsersMap.delete(id);
				selectedUserIds.delete(id);
				prunedSelection = true;
			}
		}
	}

	// Hide build/size/demographic filter controls when not in JSON mode (fields aren't available)
	const buildDiv = document.getElementById('participantsBuildFilterDiv');
	const sizeDiv = document.getElementById('participantsSizeFilterDiv');
	const genderDiv = document.getElementById('participantsGenderFilterDiv');
	const raceDiv = document.getElementById('participantsRaceFilterDiv');
	const ethnicityDiv = document.getElementById('participantsEthnicityFilterDiv');
	const validDiv = document.getElementById('participantsValidFilterDiv');
	const showJsonOnly = participantLoadMode === 'json';
	if (buildDiv) buildDiv.style.display = showJsonOnly ? '' : 'none';
	if (sizeDiv) sizeDiv.style.display = showJsonOnly ? '' : 'none';
	if (genderDiv) genderDiv.style.display = showJsonOnly ? '' : 'none';
	if (raceDiv) raceDiv.style.display = showJsonOnly ? '' : 'none';
	if (ethnicityDiv) ethnicityDiv.style.display = showJsonOnly ? '' : 'none';
	if (validDiv) validDiv.style.display = showJsonOnly ? '' : 'none';

	const key = sanitizeKey('participants') || 'participants';
	// Update the "Filters · N active" badge on the collapse toggle.
	const activeCount = [versions, builds, genders, races, ethnicities, valids].filter(a => a.length > 0).length
		+ ((sizeMin != null || sizeMax != null) ? 1 : 0);
	const badge = document.getElementById('activeFilterBadge');
	if (badge) {
		if (activeCount > 0) {
			badge.textContent = `${activeCount} active`;
			badge.style.display = '';
		} else {
			badge.style.display = 'none';
		}
	}
	renderParticipantActiveFilters({ versions, builds, genders, races, ethnicities, valids, sizeMin, sizeMax });
	renderParticipantsTable(list, 'localUsersDiv', `Personal Genome Project Participants - ${list.length} of ${participants.length}`, key);
	// If filtering deselected any now-hidden files, refresh the sticky selection counter.
	if (prunedSelection) updateGlobalSelectionCount();
}
window.applyParticipantFilters = applyParticipantFilters;

/**
 * Render the active participant filter selections as removable chips under the filter box
 * (mirrors the PGS Catalog tab), instead of appending them to the table title.
 */
function renderParticipantActiveFilters({ versions, builds, genders, races, ethnicities, valids, sizeMin, sizeMax }) {
	const el = document.getElementById('participantsActiveFilters');
	if (!el) return;

	const chips = [];
	const push = (group, prefix, arr) => arr.forEach(v => chips.push({ label: `${prefix}: ${v}`, group, value: v }));
	push('participantsVersionSelect', 'Version', versions);
	push('participantsBuildSelect', 'Build', builds);
	push('participantsGenderSelect', 'Gender', genders);
	push('participantsRaceSelect', 'Race', races);
	push('participantsEthnicitySelect', 'Ethnicity', ethnicities);
	push('participantsValidSelect', 'Valid 23andMe', valids);
	if (sizeMin != null || sizeMax != null) {
		chips.push({ label: `Size: ${sizeMin ?? 0}–${sizeMax ?? '∞'} MB`, group: 'size', value: '' });
	}

	if (!chips.length) {
		el.innerHTML = `<span class="small text-muted">No active filters</span>`;
		return;
	}

	el.innerHTML = chips.map(c =>
		`<span class="active-filter-chip">${escapeHtml(c.label)}` +
		`<button type="button" class="chip-remove" data-group="${escapeHtml(c.group)}" data-value="${escapeHtml(c.value)}" aria-label="Remove filter" title="Remove filter">&times;</button></span>`
	).join('') +
		`<button type="button" id="clearAllParticipantFilters" class="btn btn-link btn-sm p-0 ms-1" style="font-size:0.78rem;">Clear all</button>`;

	el.querySelectorAll('.chip-remove').forEach(btn => {
		btn.addEventListener('click', () => {
			const group = btn.dataset.group;
			const value = btn.dataset.value;
			if (group === 'size') {
				const mn = document.getElementById('participantsSizeMin');
				const mx = document.getElementById('participantsSizeMax');
				if (mn) mn.value = '';
				if (mx) mx.value = '';
			} else {
				const container = document.getElementById(group);
				container?.querySelectorAll('input[type="checkbox"]').forEach(cb => {
					if (cb.value === value) cb.checked = false;
				});
			}
			applyParticipantFilters();
		});
	});
	const clearAll = el.querySelector('#clearAllParticipantFilters');
	if (clearAll) clearAll.addEventListener('click', () => {
		['participantsVersionSelect', 'participantsBuildSelect', 'participantsGenderSelect', 'participantsRaceSelect', 'participantsEthnicitySelect', 'participantsValidSelect'].forEach(id => {
			document.getElementById(id)?.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
		});
		const mn = document.getElementById('participantsSizeMin');
		const mx = document.getElementById('participantsSizeMax');
		if (mn) mn.value = '';
		if (mx) mx.value = '';
		applyParticipantFilters();
	});
}

/**
 * Handler for the size range inputs (wired via oninput in index.html); re-applies filters.
 * The checkbox filters (version/build/gender/race/ethnicity/valid) wire their own delegated
 * change listener in renderCheckboxFilter(), so no per-field change handlers are needed.
 */
window.onParticipantsSizeChange = function onParticipantsSizeChange() {
	applyParticipantFilters();
};

/**
 * Handler invoked when the load-mode toggle changes ('all' vs 'json').
 * @param {'all'|'json'} mode
 */
window.onParticipantsModeChange = async function onParticipantsModeChange(mode) {
	participantLoadMode = mode === 'json' ? 'json' : 'all';
	// Reset sort state when leaving JSON mode
	if (participantLoadMode !== 'json') sortState = { key: null, dir: 'asc' };
	if (mode === 'json') {
		if (!curatedJsonParticipants) {
			showParticipantsLoadingOverlay(true, 20, 'Loading curated JSON list...');
			try {
				curatedJsonParticipants = await fetchCuratedParticipants();
			} catch (err) {
				console.error('Failed to load curated JSON:', err);
				curatedJsonParticipants = [];
				alert(`Failed to load data/pgp_participants_1017_with_profiles.json: ${err.message}`);
			} finally {
				showParticipantsLoadingOverlay(false);
			}
		}
		participants = curatedJsonParticipants ?? [];
		updateAllParticipantsCacheInfoUI();
	} else {
		const allBtn = document.getElementById('modeAllBtn');
		const fromCache = !!allParticipantsFast;
		if (!allParticipantsFast) {
			showParticipantsLoadingOverlay(true, 20, 'Fetching all participants...');
			try {
				allParticipantsFast = await allUsersMetaDataByType_fast();
				allParticipantsFetchedAt = new Date().toISOString();
				try {
					await localforage.setItem(ALL_PARTICIPANTS_CACHE_KEY, {
						data: allParticipantsFast,
						fetchedAt: allParticipantsFetchedAt,
					});
				} catch (cacheErr) {
					console.warn('Failed to cache All Participants:', cacheErr);
				}
			} catch (err) {
				console.error('allUsersMetaDataByType_fast error:', err);
				allParticipantsFast = [];
			} finally {
				showParticipantsLoadingOverlay(false);
			}
		}
		participants = allParticipantsFast ?? [];
		if (allBtn) {
			allBtn.textContent = fromCache
				? `From PGP (${participants.length}, cached)`
				: `Fetch from PGP (${participants.length})`;
		}
		updateAllParticipantsCacheInfoUI();
	}

	populateAllFilters();
	applyParticipantFilters();
};

/**
 * Force a re-fetch of the All-Participants list, overwriting the cache and timestamp.
 */
window.refreshAllParticipants = async function refreshAllParticipants() {
	const allBtn = document.getElementById('modeAllBtn');
	const updateBtn = document.getElementById('allParticipantsUpdateBtn');
	if (updateBtn) updateBtn.disabled = true;
	showParticipantsLoadingOverlay(true, 20, 'Re-fetching all participants...');
	try {
		const fresh = await allUsersMetaDataByType_fast();
		allParticipantsFast = fresh ?? [];
		allParticipantsFetchedAt = new Date().toISOString();
		try {
			await localforage.setItem(ALL_PARTICIPANTS_CACHE_KEY, {
				data: allParticipantsFast,
				fetchedAt: allParticipantsFetchedAt,
			});
		} catch (cacheErr) {
			console.warn('Failed to cache All Participants:', cacheErr);
		}
		if (participantLoadMode === 'all') {
			participants = allParticipantsFast;
			if (allBtn) allBtn.textContent = `From PGP (${participants.length}, cached)`;
			populateAllFilters();
			applyParticipantFilters();
		}
		updateAllParticipantsCacheInfoUI();
	} catch (err) {
		console.error('refreshAllParticipants failed:', err);
		alert(`Failed to refresh All Participants: ${err.message}`);
	} finally {
		showParticipantsLoadingOverlay(false);
		if (updateBtn) updateBtn.disabled = false;
	}
};

/**
 * Callback invoked when PGS score selection changes.
 * Re-renders the participants table to reflect the new selection.
 * @returns {void}
 */
window.onPgsSelectionChange = function onPgsSelectionChange() {
	// console.log('PGS selection changed, re-rendering participants table');
	applyParticipantFilters();
};

/**
 * Show a loading overlay in the participants table container.
 * @param {boolean} show - Whether to show or hide the overlay
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} message - Loading message to display
 */
function showParticipantsLoadingOverlay(show, progress = 0, message = 'Loading...') {
	const container = document.getElementById('localUsersDiv');
	if (!container) return;
	
	let overlay = document.getElementById('participantsLoadingOverlay');
	
	if (show) {
		if (!overlay) {
			overlay = document.createElement('div');
			overlay.id = 'participantsLoadingOverlay';
			overlay.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 100;';
			overlay.innerHTML = `
				<div class="spinner-border text-primary mb-3" role="status">
					<span class="visually-hidden">Loading...</span>
				</div>
				<div class="progress w-50 mb-2" style="height: 6px;">
					<div id="loadMoreProgressBar" class="progress-bar progress-bar-striped progress-bar-animated" style="width: 0%"></div>
				</div>
				<small id="loadMoreMessage" class="text-muted">Loading...</small>
			`;
			container.style.position = 'relative';
			container.appendChild(overlay);
		}
		const progressBar = document.getElementById('loadMoreProgressBar');
		const messageEl = document.getElementById('loadMoreMessage');
		if (progressBar) progressBar.style.width = `${progress}%`;
		if (messageEl) messageEl.textContent = message;
	} else {
		if (overlay) overlay.remove();
	}
}

/**
 * Index of the file shown by default for a participant: the first valid 23andMe file,
 * else the first file. Mirrors the primary-file choice in flattenCuratedRecord().
 */
function defaultFileIndex(p) {
	const files = Array.isArray(p.files) ? p.files : [];
	const vi = files.findIndex(f => f?.valid23File);
	return vi >= 0 ? vi : 0;
}

/**
 * Copy the chosen file's fields up to the participant's flattened top-level fields,
 * so the table row (filename, version, build, size, published date, download) reflects it.
 */
function applyActiveFile(p, idx) {
	const files = Array.isArray(p.files) ? p.files : [];
	if (!files.length) return;
	const clamped = Math.min(Math.max(0, idx), files.length - 1);
	const f = files[clamped] ?? {};
	p._activeFileIndex = clamped;
	p.publishedDate = f.publishedDate ?? null;
	p.dataType = f.dataType ?? null;
	p.name = f.name ?? null;
	p.downloadUrl = f.downloadUrl ?? null;
	p.finalUrl = f.finalUrl ?? null;
	p.filename = f.filename ?? null;
	p.innerFilename = f.innerFilename ?? null;
	p.genomeBuild = f.genomeBuild ?? null;
	p.genomeBuildFiles = f.genomeBuildFiles ?? [];
	p.gcsfilename = f.genomeBuildFiles?.[0]?.gcsfilename ?? null;
}

/**
 * Canonical participant id string.
 * @param {Object} p - Participant object.
 * @returns {string}
 */
function participantIdOf(p) {
	return String(p?.id ?? p?.participant_id ?? p?.name ?? '');
}

/**
 * Unique selection key for a specific file of a participant.
 * Single-file participants use their plain participant id (so behavior and the
 * genome cache key are unchanged); multi-file participants use a composite key.
 * @param {Object} p - Participant object.
 * @param {number} fi - File index.
 * @param {number} filesLen - Number of files for the participant.
 * @returns {string}
 */
function fileKeyOf(p, fi, filesLen) {
	const pid = participantIdOf(p);
	return filesLen > 1 ? `${pid}#${fi}` : pid;
}

/**
 * Build a per-file selection object stored in selectedUsersMap and fed to the PRS pipeline.
 * @param {Object} p - Participant object.
 * @param {number} fi - File index.
 * @returns {Object}
 */
function makeFileSelection(p, fi) {
	const files = Array.isArray(p.files) ? p.files : [];
	const multi = files.length > 1;
	const src = files[fi] ?? files[0] ?? p; // fall back to participant when no curated files array
	const pid = participantIdOf(p);
	const gcsfilename = src.genomeBuildFiles?.[0]?.gcsfilename ?? src.gcsfilename ?? null;
	const filename = gcsfilename ?? src.innerFilename ?? src.filename ?? src.fileName ?? src.genotypes?.[0]?.filename ?? '';
	const rawName = nameFromFilename(src.finalUrl ?? src.downloadUrl ?? filename) || String(p.name ?? pid);
	return {
		id: fileKeyOf(p, fi, files.length),
		participant_id: pid,
		name: rawName,
		_fileIndex: multi ? fi : 0,
		// File-specific fields consumed by the PRS pipeline / tables
		publishedDate: src.publishedDate ?? src.published_date ?? src.date ?? null,
		dataType: src.dataType ?? null,
		downloadUrl: src.downloadUrl ?? src.download_url ?? null,
		finalUrl: src.finalUrl ?? null,
		filename: src.filename ?? src.fileName ?? null,
		innerFilename: src.innerFilename ?? null,
		genomeBuild: src.genomeBuild ?? src.build ?? null,
		genomeBuildFiles: src.genomeBuildFiles ?? [],
		gcsfilename,
		valid23File: src.valid23File ?? p.valid23File ?? null,
		genotypes: src.genotypes ?? p.genotypes,
		// Participant-level demographics (shared across that participant's files)
		age: p.age ?? null,
		gender: p.gender ?? null,
		race: p.race ?? null,
		ethnicity: p.ethnicity ?? null,
		raceCategories: p.raceCategories ?? [],
		ethnicityCategories: p.ethnicityCategories ?? [],
		profileUrl: p.profileUrl ?? getProfileUrl(p),
		profile: p.profile ?? null,
		dataSource: p.dataSource,
	};
}

/**
 * Add a single file of a participant to the selection, honoring MAX_SELECTION.
 * @param {Object} p - Participant object.
 * @param {number} fi - File index.
 * @returns {boolean} false if the selection limit blocked the add.
 */
function addFileSelection(p, fi) {
	const files = Array.isArray(p.files) ? p.files : [];
	const key = fileKeyOf(p, fi, files.length);
	if (selectedUserIds.has(key)) return true;
	if (selectedUserIds.size >= MAX_SELECTION) return false;
	selectedUserIds.add(key);
	selectedUsersMap.set(key, makeFileSelection(p, fi));
	return true;
}

/**
 * Remove a single file of a participant from the selection.
 * @param {Object} p - Participant object.
 * @param {number} fi - File index.
 * @returns {void}
 */
function removeFileSelection(p, fi) {
	const files = Array.isArray(p.files) ? p.files : [];
	const key = fileKeyOf(p, fi, files.length);
	selectedUserIds.delete(key);
	selectedUsersMap.delete(key);
}

/**
 * Render the file-specific table cells (Valid, Version, Build, Size, Filename, Published, Download) for a file source.
 * @param {Object} src - A file object (or participant used as a single-file source).
 * @returns {{filename:string, filenameHtml:string, version:string, buildHtml:string, sizeHtml:string, validHtml:string, published:string, downloadHtml:string}}
 */
function fileCells(src) {
	const gcsfilename = src.genomeBuildFiles?.[0]?.gcsfilename ?? src.gcsfilename ?? null;
	const filename = gcsfilename ?? src.innerFilename ?? src.filename ?? src.fileName ?? src.genotypes?.[0]?.filename ?? '';
	const version = extractVersion(src) ?? '-';
	const build = src.genomeBuild ?? src.build ?? '-';
	const sizeMB = src.genomeBuildFiles?.[0]?.sizeMB ?? src.sizeMB ?? null;
	const sizeHtml = (sizeMB != null) ? `${Number(sizeMB).toFixed(2)}` : '-';
	const valid = src.valid23File;
	const validHtml = valid === true
		? '<span class="badge rounded-pill bg-success">✓ Valid</span>'
		: (valid === false ? '<span class="badge rounded-pill bg-light text-muted border">Invalid</span>' : '<span class="text-muted">—</span>');
	const published = escapeHtml(String(getPublishedDate(src)));
	const dl = getDownloadUrl(src);
	const downloadHtml = dl
		? `<a href="${escapeHtml(dl)}" target="_blank" rel="noopener" title="${escapeHtml(dl)}">${escapeHtml(truncateUrlForDisplay(dl))}</a>`
		: '-';
	return {
		filename,
		filenameHtml: filename ? escapeHtml(filename) : '-',
		version: escapeHtml(String(version)),
		buildHtml: escapeHtml(String(build)),
		sizeHtml,
		validHtml,
		published,
		downloadHtml,
	};
}

/**
 * Render a paginated participants table with selection and pagination controls.
 * @param {Array<Object>} list - Array of participant objects to display.
 * @param {string} targetId - DOM element ID to render the table into.
 * @param {string} title - Title text to display above the table.
 * @param {string} key - Unique key used to construct control IDs.
 * @returns {void}
 */
function renderParticipantsTable(list, targetId, title, key) {
	const container = document.getElementById(targetId);
	if (!container) return;
	container.style.display = 'block';

	let currentPage = 1;
	let searchQuery = '';
	const selectedIds = selectedUserIds; // Use module-level set
	const expanded = new Set(); // participant ids whose file child-rows are shown

	const renderPage = () => {
		// Sort a copy of the list based on the current sortState
		const sortGetters = {
			version: (p) => {
				const v = extractVersion(p);
				if (!v) return -Infinity;
				const m = v.match(/v(\d+)/i);
				return m ? parseInt(m[1], 10) : -Infinity;
			},
			build: (p) => {
				const n = parseInt(p.genomeBuild ?? p.build, 10);
				return Number.isFinite(n) ? n : -Infinity;
			},
			size: (p) => {
				const n = Number(p.genomeBuildFiles?.[0]?.sizeMB ?? p.sizeMB);
				return Number.isFinite(n) ? n : -Infinity;
			},
		};
		let displayList = list;
		if (participantLoadMode === 'json' && sortState.key && sortGetters[sortState.key]) {
			const get = sortGetters[sortState.key];
			const mult = sortState.dir === 'asc' ? 1 : -1;
			displayList = [...list].sort((a, b) => {
				const av = get(a), bv = get(b);
				if (av === bv) return 0;
				return (av < bv ? -1 : 1) * mult;
			});
		}
		// Apply free-text search (participant ID, name, age, race, or ethnicity)
		const q = searchQuery.trim().toLowerCase();
		if (q) {
			displayList = displayList.filter((p) => {
				const genoFilename = p.fileName ?? p.finalUrl ?? p.genotypes?.[0]?.filename ?? p.genotypes?.[0]?.download_url ?? p.downloadUrl ?? p.download_url;
				const nm = String(nameFromFilename(genoFilename) || p.name || '').toLowerCase();
				const id = String(p.id ?? p.participant_id ?? p.name ?? '').toLowerCase();
				const age = String(p.age ?? '').toLowerCase();
				const race = [p.race, ...(Array.isArray(p.raceCategories) ? p.raceCategories : [])].filter(Boolean).join(' ').toLowerCase();
				const ethnicity = [p.ethnicity, ...(Array.isArray(p.ethnicityCategories) ? p.ethnicityCategories : [])].filter(Boolean).join(' ').toLowerCase();
				return id.includes(q) || nm.includes(q) || age.includes(q) || race.includes(q) || ethnicity.includes(q);
			});
		}
		const sortable = participantLoadMode === 'json';
		const sortArrow = (k) => !sortable ? '' : (sortState.key === k ? (sortState.dir === 'asc' ? ' ▲' : ' ▼') : ' ⇅');
		const sortAttrs = (k) => sortable ? `class="sortable" data-sort="${k}" style="cursor:pointer;user-select:none;"` : '';
		// Right-aligned variant for numeric sortable columns (Build, Size)
		const sortAttrsEnd = (k) => sortable ? `class="sortable text-end" data-sort="${k}" style="cursor:pointer;user-select:none;"` : 'class="text-end"';

		const totalPages = Math.max(1, Math.ceil(displayList.length / ROWS_PER_PAGE));
		currentPage = Math.min(Math.max(1, currentPage), totalPages);
		const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
		const pageItems = displayList.slice(startIndex, startIndex + ROWS_PER_PAGE);

		const rowsHtml = pageItems.map((p, i) => {
			const rowNum = startIndex + i + 1;
			const pid = participantIdOf(p);
			const pidEsc = escapeHtml(pid);
			const files = Array.isArray(p.files) ? p.files : [];
			const multiFile = files.length > 1;

			// Participant display name (derived from a representative file or p.name)
			const genoFilename =
				p.fileName ??
				p.finalUrl ??
				files[0]?.finalUrl ??
				files[0]?.downloadUrl ??
				p.genotypes?.[0]?.filename ??
				p.genotypes?.[0]?.download_url ??
				p.downloadUrl ??
				p.download_url;
			const rawName = nameFromFilename(genoFilename) || String(p.name ?? "");
			// Enrich the participant object so selectedUsersMap stores the full name
			p.name = rawName || p.name;
			const name = escapeHtml(rawName);
			const displayName = escapeHtml(rawName.length > 14 ? rawName.slice(0, 14) + '...' : rawName);

			// Participant-level demographic cells (shared across a participant's files)
			const ageHtml = (p.age != null && p.age !== '') ? escapeHtml(String(p.age)) : '-';
			const genderHtml = p.gender ? escapeHtml(String(p.gender)) : '-';
			const raceCats = (Array.isArray(p.raceCategories) && p.raceCategories.length) ? p.raceCategories.join(', ') : (p.race || '');
			const ethnicityCats = (Array.isArray(p.ethnicityCategories) && p.ethnicityCategories.length) ? p.ethnicityCategories.join(', ') : (p.ethnicity || '');
			const raceHtml = raceCats ? escapeHtml(String(raceCats)) : '-';
			const ethnicityHtml = ethnicityCats ? escapeHtml(String(ethnicityCats)) : '-';
			const raceTitle = p.race ? escapeHtml(String(p.race)) : raceHtml;
			const ethnicityTitle = p.ethnicity ? escapeHtml(String(p.ethnicity)) : ethnicityHtml;
			const profileUrl = getProfileUrl(p);
			const profileHtml = profileUrl ? `<a href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener">View</a>` : "-";

			// Selection state for this participant's file(s)
			let selCount = 0;
			if (multiFile) {
				for (let fi = 0; fi < files.length; fi++) if (selectedIds.has(fileKeyOf(p, fi, files.length))) selCount++;
			} else if (selectedIds.has(pid)) {
				selCount = 1;
			}

			// Single-file participant: one flat row, its checkbox selects that file. No expander.
			if (!multiFile) {
				const c = fileCells(files[0] ?? p);
				return `
					<tr>
						<td></td>
						<td>${rowNum}</td>
						<td><input class="participant-select" type="checkbox" data-id="${pidEsc}" data-fi="0" value="${pidEsc}" ${selCount === 1 ? 'checked' : ''} /></td>
						<td>${pidEsc}</td>
						<td title="${name}">${displayName}</td>
						<td class="text-end">${ageHtml}</td>
						<td>${genderHtml}</td>
						<td title="${raceTitle}">${raceHtml}</td>
						<td title="${ethnicityTitle}">${ethnicityHtml}</td>
						<td class="text-center">${c.validHtml}</td>
						<td>${c.version}</td>
						<td class="text-end">${c.buildHtml}</td>
						<td class="text-end">${c.sizeHtml}</td>
						<td style="max-width:200px;"><div class="text-truncate" style="max-width:190px;" title="${escapeHtml(c.filename)}">${c.filenameHtml}</div></td>
						<td>${c.published}</td>
						<td>${profileHtml}</td>
						<td>${c.downloadHtml}</td>
					</tr>
				`;
			}

			// Multi-file participant: a parent identity row (tri-state "select all files"
			// checkbox + caret + count badge) plus per-file child rows when expanded.
			const isExp = expanded.has(pid);
			// Per-file match against the active file-level filters (version/build/valid/size).
			const fileMatch = files.map(f => fileMatchesActiveFilters(f));
			const matchCount = fileMatch.reduce((n, ok) => n + (ok ? 1 : 0), 0);
			const hiddenByFilter = files.length - matchCount;
			// All selected files are matching ones (non-matching are pruned on filter change).
			const allSel = matchCount > 0 && selCount === matchCount;
			const parentDisabled = matchCount === 0;
			const summaryText = parentDisabled
				? 'no files match filters'
				: (selCount
					? `${selCount} of ${matchCount} selected`
					: (isExp ? 'select files below' : 'expand to select'))
					+ (hiddenByFilter ? ` · ${hiddenByFilter} filtered out` : '');
			const matchBadge = hiddenByFilter
				? ` <span class="badge bg-warning text-dark rounded-pill ms-1" title="${hiddenByFilter} file(s) don't match the active filters">${matchCount}/${files.length} match</span>`
				: '';
			const parentRow = `
				<tr class="file-parent-row${parentDisabled ? ' file-parent-nomatch' : ''}">
					<td class="text-center"><button type="button" class="btn btn-sm btn-link p-0 text-decoration-none file-expander" data-id="${pidEsc}" aria-expanded="${isExp}" title="${isExp ? 'Collapse' : 'Expand'} files">${isExp ? '▾' : '▸'}</button></td>
					<td>${rowNum}</td>
					<td><input class="participant-select participant-parent" type="checkbox" data-id="${pidEsc}" ${allSel ? 'checked' : ''} ${parentDisabled ? 'disabled' : ''} title="${parentDisabled ? 'No files match the active filters' : 'Select all matching files for this participant'}" /></td>
					<td>${pidEsc} <span class="badge bg-secondary rounded-pill ms-1" title="${files.length} files available">${files.length} files</span>${matchBadge}</td>
					<td title="${name}">${displayName}</td>
					<td class="text-end">${ageHtml}</td>
					<td>${genderHtml}</td>
					<td title="${raceTitle}">${raceHtml}</td>
					<td title="${ethnicityTitle}">${ethnicityHtml}</td>
					<td class="text-center text-muted">—</td>
					<td class="text-muted">—</td>
					<td class="text-end text-muted">—</td>
					<td class="text-end text-muted">—</td>
					<td style="max-width:200px;"><span class="small ${selCount ? 'text-success fw-semibold' : 'text-muted fst-italic'}">${summaryText}</span></td>
					<td class="text-muted">—</td>
					<td>${profileHtml}</td>
					<td class="text-muted">—</td>
				</tr>
			`;
			let childRows = '';
			if (isExp) {
				childRows = files.map((f, fi) => {
					const key = fileKeyOf(p, fi, files.length);
					const cc = fileCells(f);
					const cName = escapeHtml(nameFromFilename(f.finalUrl ?? f.downloadUrl ?? cc.filename) || rawName);
					const matches = fileMatch[fi];
					const rowCls = matches ? 'file-child-row' : 'file-child-row file-row-filtered';
					const cbCls = matches ? 'participant-select file-select' : 'participant-select file-select file-filtered-out';
					const cbAttrs = matches
						? `${selectedIds.has(key) ? 'checked' : ''}`
						: `disabled title="This file doesn't match the active filters"`;
					const fileLabel = matches
						? `↳ file ${fi + 1}`
						: `↳ file ${fi + 1} <span class="badge bg-light text-muted border">filtered</span>`;
					return `
						<tr class="${rowCls}" data-parent="${pidEsc}">
							<td></td>
							<td class="text-end text-muted small">${rowNum}.${fi + 1}</td>
							<td><input class="${cbCls}" type="checkbox" data-id="${pidEsc}" data-fi="${fi}" value="${escapeHtml(key)}" ${cbAttrs} /></td>
							<td class="text-muted small">${fileLabel}</td>
							<td class="text-muted small" title="${cName}">${cName}</td>
							<td></td>
							<td></td>
							<td></td>
							<td></td>
							<td class="text-center">${cc.validHtml}</td>
							<td>${cc.version}</td>
							<td class="text-end">${cc.buildHtml}</td>
							<td class="text-end">${cc.sizeHtml}</td>
							<td style="max-width:200px;"><div class="text-truncate" style="max-width:190px;" title="${escapeHtml(cc.filename)}">${cc.filenameHtml}</div></td>
							<td>${cc.published}</td>
							<td></td>
							<td>${cc.downloadHtml}</td>
						</tr>
					`;
				}).join('');
			}
			return parentRow + childRows;
		}).join('');

		// Total selectable "files" across the full (unpaginated) list, for the header Select-all state.
		// Only files matching the active file-level filters count as selectable.
		let totalFilesInList = 0;
		for (const it of list) {
			const itFiles = Array.isArray(it.files) ? it.files : [];
			if (itFiles.length > 1) {
				for (let fi = 0; fi < itFiles.length; fi++) if (fileMatchesActiveFilters(itFiles[fi])) totalFilesInList++;
			} else {
				totalFilesInList += 1;
			}
		}
		const selectAllChecked = selectedIds.size > 0 && selectedIds.size >= Math.min(totalFilesInList, MAX_SELECTION);

		// Multi-file participants (in the current filtered list) drive the expand/collapse-all control.
		const multiFileIds = displayList
			.filter(p => (Array.isArray(p.files) ? p.files.length : 0) > 1)
			.map(p => participantIdOf(p));
		const hasMultiFile = multiFileIds.length > 0;
		const allExpanded = hasMultiFile && multiFileIds.every(id => expanded.has(id));

		// (Selection table in the PRS tab is rendered by renderSelectedUsersTable() —
		//  do NOT clear #prsUsersAction here, or it would wipe on every filter/sort.)

		container.innerHTML = `
			<div class="d-flex justify-content-between align-items-center my-2 flex-wrap gap-2">
				<h5 class="mb-0">${escapeHtml(title)}</h5>
				<div class="d-flex align-items-center gap-2 flex-wrap">
					<button id="downloadJsonBtn_${key}" class="btn btn-outline-secondary btn-sm" style="font-size:0.7rem;padding:2px 6px;" title="Download the currently filtered list as JSON">Download JSON</button>
					<button id="downloadCsvBtn_${key}" class="btn btn-outline-secondary btn-sm" style="font-size:0.7rem;padding:2px 6px;" title="Download the currently filtered list as CSV">Download CSV</button>
					<label class="form-check-label me-2" for="selectAllParticipants_${key}">Select all</label>
					<input class="form-check-input" id="selectAllParticipants_${key}" type="checkbox" ${selectAllChecked ? 'checked' : ''} />
					<button id="deselectAllParticipants_${key}" class="btn btn-outline-secondary btn-sm" style="font-size:0.7rem;padding:2px 6px;">Deselect all</button>
				</div>
			</div>
			<div class="mb-2">
				<input id="participantSearch_${key}" type="search" class="form-control form-control-sm" style="max-width: 420px;" placeholder="Search by ID, name, age, race, or ethnicity…" value="${escapeHtml(searchQuery)}" />
				<div class="small text-muted mt-1">Showing ${displayList.length} of ${list.length}</div>
			</div>
			<div class="table-responsive sticky-scroll">
				<table class="table table-sm table-striped table-bordered align-middle">
					<thead class="table-dark">
						<tr>
							<th style="width:32px;" class="text-center p-1">${hasMultiFile ? `<button type="button" id="expandAllFiles_${key}" class="btn btn-sm p-0 file-expander-all" aria-expanded="${allExpanded}" title="${allExpanded ? 'Collapse all files' : 'Expand all files'}" aria-label="${allExpanded ? 'Collapse all files' : 'Expand all files'}">${allExpanded ? '▾' : '▸'}</button>` : ''}</th>
							<th>#</th>
							<th>Select</th>
							<th>Participant ID</th>
							<th>Name</th>
							<th class="text-end">Age</th>
							<th>Gender</th>
							<th>Race</th>
							<th>Ethnicity</th>
							<th title="File matched the 23andMe header signature">Valid 23andMe</th>
							<th ${sortAttrs('version')}>Version${sortArrow('version')}</th>
							<th ${sortAttrsEnd('build')}>Build${sortArrow('build')}</th>
							<th ${sortAttrsEnd('size')}>Size (MB)${sortArrow('size')}</th>
							<th style="max-width:180px;">Filename</th>
							<th>Published Date</th>
							<th>Profile</th>
							<th>Download URL</th>
						</tr>
					</thead>
					<tbody>
						${rowsHtml}
					</tbody>
				</table>
			</div>
			<div class="d-flex justify-content-between align-items-center mt-2">
			<div id="selectedParticipantsSummary_${key}" class="small text-muted">${selectedIds.size} of ${MAX_SELECTION} files selected</div>
				<div class="d-flex align-items-center gap-2">
					<button id="prevPage_${key}" class="btn btn-sm btn-outline-secondary" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
					<span id="pageInfo_${key}" class="small text-muted">Page ${currentPage} of ${totalPages}</span>
					<button id="nextPage_${key}" class="btn btn-sm btn-outline-secondary" ${currentPage >= totalPages ? 'disabled' : ''}>Next</button>
				</div>
			</div>
		`;

		const selectAll = document.getElementById(`selectAllParticipants_${key}`);
		const deselectAllBtn = document.getElementById(`deselectAllParticipants_${key}`);
		const downloadJsonBtn = document.getElementById(`downloadJsonBtn_${key}`);
		const downloadCsvBtn = document.getElementById(`downloadCsvBtn_${key}`);
		const prevPageBtn = document.getElementById(`prevPage_${key}`);
		const nextPageBtn = document.getElementById(`nextPage_${key}`);
		const searchInput = document.getElementById(`participantSearch_${key}`);

		if (searchInput) {
			searchInput.addEventListener('input', () => {
				searchQuery = searchInput.value;
				currentPage = 1;
				renderPage();
				// Restore focus/caret after the re-render replaces the input
				const again = document.getElementById(`participantSearch_${key}`);
				if (again) { again.focus(); const v = again.value; again.value = ''; again.value = v; }
			});
		}

		if (downloadJsonBtn) {
			downloadJsonBtn.addEventListener('click', () => {
				downloadAsFile(
					JSON.stringify(displayList, null, 2),
					`PGP_participants_1017.json`,
					'application/json'
				);
			});
		}
		if (downloadCsvBtn) {
			downloadCsvBtn.addEventListener('click', () => {
				downloadAsFile(
					participantsToCsv(displayList),
					`PGP_participants_1017.csv`,
					'text/csv'
				);
			});
		}

		// Sortable column headers
		container.querySelectorAll('th.sortable').forEach((th) => {
			th.addEventListener('click', () => {
				const k = th.dataset.sort;
				if (sortState.key === k) {
					sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
				} else {
					sortState.key = k;
					sortState.dir = 'asc';
				}
				currentPage = 1;
				renderPage();
			});
		});

		// Flash the shared "selection limit reached" message.
		const flashLimit = () => {
			const limitMsg = document.getElementById('selectionLimitMsg');
			if (!limitMsg) return;
			limitMsg.style.display = '';
			limitMsg.classList.remove('flash-attention');
			void limitMsg.offsetWidth; // restart animation
			limitMsg.classList.add('flash-attention');
		};
		// Re-render the page and refresh the global sticky counter after a selection change.
		const afterSelectionChange = () => {
			renderPage();
			updateGlobalSelectionCount();
		};

		// Expander caret: toggle a participant's file child-rows.
		container.querySelectorAll('.file-expander').forEach((btn) => {
			btn.addEventListener('click', () => {
				const id = btn.dataset.id;
				if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
				renderPage();
			});
		});

		// Header caret: expand or collapse every multi-file participant at once.
		const expandAllBtn = document.getElementById(`expandAllFiles_${key}`);
		if (expandAllBtn) {
			expandAllBtn.addEventListener('click', () => {
				const ids = displayList
					.filter(p => (Array.isArray(p.files) ? p.files.length : 0) > 1)
					.map(p => participantIdOf(p));
				const everyExpanded = ids.length > 0 && ids.every(id => expanded.has(id));
				if (everyExpanded) ids.forEach(id => expanded.delete(id));
				else ids.forEach(id => expanded.add(id));
				renderPage();
			});
		}

		if (deselectAllBtn) {
			deselectAllBtn.addEventListener('click', () => {
				selectedIds.clear();
				selectedUsersMap.clear();
				if (selectAll) selectAll.checked = false;
				afterSelectionChange();
			});
		}

		if (selectAll) {
			selectAll.addEventListener('change', () => {
				if (selectAll.checked) {
					// Select files across participants, in list order, up to MAX_SELECTION.
					// Skip files that don't match the active file-level filters.
					let hitLimit = false;
					for (const it of list) {
						const files = Array.isArray(it.files) ? it.files : [];
						const n = files.length > 1 ? files.length : 1;
						for (let fi = 0; fi < n; fi++) {
							if (files.length > 1 && !fileMatchesActiveFilters(files[fi])) continue;
							if (!addFileSelection(it, fi)) { hitLimit = true; break; }
						}
						if (hitLimit) break;
					}
					if (hitLimit) flashLimit();
				} else {
					selectedIds.clear();
					selectedUsersMap.clear();
				}
				afterSelectionChange();
			});
		}

		// Single-file participant checkbox: selects/deselects that one file.
		container.querySelectorAll('.participant-select:not(.participant-parent):not(.file-select)').forEach((cb) => {
			cb.addEventListener('change', () => {
				const p = list.find(it => participantIdOf(it) === cb.dataset.id);
				if (!p) return;
				if (cb.checked) {
					if (!addFileSelection(p, 0)) { cb.checked = false; flashLimit(); return; }
				} else {
					removeFileSelection(p, 0);
				}
				afterSelectionChange();
			});
		});

		// Child (per-file) checkbox: selects/deselects a single file of a multi-file participant.
		container.querySelectorAll('.file-select').forEach((cb) => {
			cb.addEventListener('change', () => {
				const p = list.find(it => participantIdOf(it) === cb.dataset.id);
				if (!p) return;
				const fi = Number(cb.dataset.fi);
				if (cb.checked) {
					if (!addFileSelection(p, fi)) { cb.checked = false; flashLimit(); return; }
				} else {
					removeFileSelection(p, fi);
				}
				afterSelectionChange();
			});
		});

		// Parent tri-state checkbox: selects/deselects all matching files of a participant.
		container.querySelectorAll('.participant-parent').forEach((cb) => {
			cb.addEventListener('change', () => {
				const p = list.find(it => participantIdOf(it) === cb.dataset.id);
				if (!p) return;
				const files = Array.isArray(p.files) ? p.files : [];
				if (cb.checked) {
					let hitLimit = false;
					for (let fi = 0; fi < files.length; fi++) {
						if (!fileMatchesActiveFilters(files[fi])) continue;
						if (!addFileSelection(p, fi)) { hitLimit = true; break; }
					}
					if (hitLimit) flashLimit();
				} else {
					for (let fi = 0; fi < files.length; fi++) removeFileSelection(p, fi);
				}
				afterSelectionChange();
			});
		});

		// Mark partially-selected parents as indeterminate (must be set via JS after render).
		// Only matching files count toward the "all selected" state.
		container.querySelectorAll('.participant-parent').forEach((cb) => {
			const p = list.find(it => participantIdOf(it) === cb.dataset.id);
			if (!p) return;
			const files = Array.isArray(p.files) ? p.files : [];
			let c = 0, m = 0;
			for (let fi = 0; fi < files.length; fi++) {
				if (!fileMatchesActiveFilters(files[fi])) continue;
				m++;
				if (selectedIds.has(fileKeyOf(p, fi, files.length))) c++;
			}
			cb.indeterminate = c > 0 && c < m;
		});

		if (prevPageBtn) prevPageBtn.addEventListener('click', () => { currentPage -= 1; renderPage(); });
		if (nextPageBtn) nextPageBtn.addEventListener('click', () => { currentPage += 1; renderPage(); });

		// Re-apply the selection limit (disable unchecked rows) after each (re)render
		updateSelectionAvailability();
	};

	renderPage();
}

/**
 * renderLocalUsers()
 * Public entry point that renders the participants table (honoring any active year/version filters).
 */
window.renderLocalUsers = () => {
	applyParticipantFilters();
};

// If the GenomicData tab is already visible on load, render immediately
if (document.getElementById("GenomicData")?.style.display === "block") {
	window.renderLocalUsers();
}

// populate filter selects after definitions
populateAllFilters();

// --- Upload Your 23andMe File Button Handler ---

/**
 * Handle user clicking the "Upload Your 23andMe File" button.
 * Opens a file picker and parses the selected file.
 */
const my23Btn = document.getElementById("my23Btn");
const my23FileInput = document.getElementById("my23FileInput");
const my23Status = document.getElementById("my23Status");

if (my23Btn && my23FileInput) {
	// console.log("Setting up 23andMe file upload handler");
	// Clicking the button triggers the hidden file input
	my23Btn.addEventListener("click", () => {
		// console.log("Upload 23andMe button clicked");
		my23FileInput.click();
	});

	// Handle file selection (up to 5 files)
	my23FileInput.addEventListener("change", async (event) => {
		const MAX_UPLOAD = 5;
		const files = Array.from(event.target.files ?? []).slice(0, MAX_UPLOAD);
		if (files.length === 0) return;

		if (my23Status) my23Status.textContent = `Reading ${files.length} file(s)...`;

		const messages = [];

		// (Selection table in the PRS tab is populated via renderSelectedUsersTable()
		//  from updateGlobalSelectionCount(); no need to clear #prsUsersAction here.)

		for (const file of files) {
			try {
				const text = await file.text();

				let parsed = await get23Txt(file);
				if (!parsed || !parsed.dt) {
					throw new Error("get23Txt did not return expected parsed data structure.");
				}
				parsed = {
					cols: parsed.cols || [],
					dt: parsed.dt || [],
					meta: parsed.meta || ""
				};

				if (!parsed.dt.length) {
					messages.push(`⚠ ${file.name}: failed to parse.`);
					continue;
				}

				// Extract published date from first line
				const firstLine = text.split(/[\r\n]/)[0] ?? "";
				let publishedDate = new Date().toISOString().slice(0, 10);
				const dateMatch = firstLine.match(/at:\s*(.+)$/i);
				if (dateMatch) {
					const parsedDate = new Date(dateMatch[1].trim());
					if (!isNaN(parsedDate.getTime())) {
						publishedDate = parsedDate.toISOString().slice(0, 10);
					}
				}

				const userId = file.name;
				const user = {
					id: userId,
					name: file.name,
					fileName: file.name,
					dataSource: "file Upload",
					dataType: "23andMe",
					downloadUrl: null,
					profileUrl: null,
					publishedDate: publishedDate,
					_parsed: parsed,
				};

				// Cache parsed genome data using the same key pattern as calculatePrs.js
				try {
					await localforage.setItem(`Genome:23andMe-txt-${userId}`, parsed);
					console.log(`Cached uploaded genome for ${userId} (${parsed.dt.length} variants)`);
				} catch (cacheErr) {
					console.warn(`Failed to cache genome for ${userId}:`, cacheErr);
				}

				if (selectedUserIds.size < MAX_SELECTION) {
					selectedUserIds.add(userId);
					selectedUsersMap.set(userId, user);
					updateGlobalSelectionCount();
					messages.push(`✓ ${file.name}: ${parsed.dt.length.toLocaleString()} variants added.`);
				} else {
					messages.push(`⚠ ${file.name}: max selection (${MAX_SELECTION}) reached.`);
				}
			} catch (err) {
				console.error("Error reading 23andMe file:", err);
				messages.push(`✗ ${file.name}: ${err.message}`);
			}
		}

		if (my23Status) my23Status.innerHTML = messages.join('<br>');

		// Show fetch button if any files were successfully loaded
		const fetchBtn = document.getElementById('fetchUsersBtn');
		if (fetchBtn && selectedUserIds.size > 0) {
			fetchBtn.style.display = '';
		}

		// Reset input so the same file(s) can be re-selected
		my23FileInput.value = "";
	});
}

// --- Option D: Load by list of IDs (URLs looked up from curated list) ---
const loadByUrlBtn = document.getElementById("loadByUrlBtn");
const loadByUrlExampleBtn = document.getElementById("loadByUrlExampleBtn");
if (loadByUrlExampleBtn) {
	loadByUrlExampleBtn.addEventListener("click", () => {
		const idsInput = document.getElementById("loadByUrlIds");
		if (idsInput) idsInput.value = "huA08F4D, huC8B936";
	});
}

/** Split a free-form list of IDs (comma / whitespace / newline separated) into a
 *  de-duplicated array, preserving order. */
function parseIdList(raw) {
	if (!raw) return [];
	const seen = new Set();
	const out = [];
	for (const token of String(raw).split(/[\s,;]+/)) {
		const id = token.trim();
		if (!id || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}
	return out;
}

if (loadByUrlBtn) {
	loadByUrlBtn.addEventListener("click", async () => {
		const idsInput = document.getElementById("loadByUrlIds");
		const statusEl = document.getElementById("loadByUrlStatus");
		const allIds = parseIdList(idsInput?.value);

		if (allIds.length === 0) {
			if (statusEl) statusEl.textContent = "Enter at least one participant ID.";
			return;
		}

		// Cap the list at MAX_SELECTION IDs
		const ids = allIds.slice(0, MAX_SELECTION);
		const truncated = allIds.length - ids.length;

		// Build a quick lookup from the curated participants list
		const byId = new Map();
		for (const p of participants) {
			const pid = p?.id ?? p?.participant_id;
			if (pid) byId.set(String(pid), p);
		}

		loadByUrlBtn.disabled = true;
		const messages = [];
		if (truncated > 0) {
			messages.push(`\u26A0 Only the first ${MAX_SELECTION} IDs will be processed (${truncated} ignored).`);
		}

		try {
			for (const id of ids) {
				if (selectedUserIds.has(id)) {
					messages.push(`\u26A0 ${escapeHtml(id)}: already selected.`);
					continue;
				}
				if (selectedUserIds.size >= MAX_SELECTION) {
					messages.push(`\u26A0 ${escapeHtml(id)}: max selection (${MAX_SELECTION}) reached.`);
					break;
				}

				const record = byId.get(id);
				if (!record) {
					messages.push(`\u2717 ${escapeHtml(id)}: not found in curated participants list.`);
					continue;
				}
				const url = record.downloadUrl ?? record.download_url ?? record.url ?? null;
				if (!url) {
					messages.push(`\u2717 ${escapeHtml(id)}: no download URL in curated list.`);
					continue;
				}

				if (statusEl) statusEl.textContent = `Loading ${id}...`;

				try {
					let parsed = await get23Txt(url, id, false);
					if (!parsed || !parsed.dt) {
						throw new Error("get23Txt did not return expected parsed data.");
					}
					const innerFilename = parsed.filename ?? '';
					const finalUrl = parsed.finalUrl ?? parsed.meta?.finalUrl ?? record.finalUrl ?? url;
					parsed = {
						cols: parsed.cols || [],
						dt: parsed.dt || [],
						meta: parsed.meta || "",
					};

					try {
						await localforage.setItem(`Genome:23andMe-txt-${id}`, parsed);
					} catch (cacheErr) {
						console.warn(`Failed to cache genome for ${id}:`, cacheErr);
					}

					const user = {
						id,
						name: record.name || nameFromFilename(innerFilename || record.filename || finalUrl) || id,
						fileName: innerFilename || record.filename || String(finalUrl).split("/").pop() || id,
						dataSource: "url",
						dataType: record.dataType || "23andMe",
						downloadUrl: url,
						finalUrl,
						profileUrl: record.profileUrl ?? null,
						publishedDate: record.publishedDate ?? new Date().toISOString().slice(0, 10),
						_parsed: parsed,
					};

					selectedUserIds.add(id);
					selectedUsersMap.set(id, user);
					updateGlobalSelectionCount();

					messages.push(`\u2713 ${escapeHtml(id)}: ${parsed.dt.length.toLocaleString()} variants loaded and cached.`);
				} catch (err) {
					console.error(`Load by ID failed for ${id}:`, err);
					messages.push(`\u2717 ${escapeHtml(id)}: ${escapeHtml(err.message)}`);
				}
			}

			if (statusEl) statusEl.innerHTML = messages.join('<br>');
			if (idsInput) idsInput.value = "";
		} finally {
			loadByUrlBtn.disabled = false;
		}
	});
}

// --- Genome cache: show / clear ---
async function showGenomicCache() {
	const container = document.getElementById("genomicCacheList");
	if (!container) return;
	container.innerHTML = '<span class="small text-muted">Reading cache...</span>';
	try {
		const keys = await localforage.keys();
		const genomeKeys = keys.filter(k => k.startsWith("Genome:"));
		if (genomeKeys.length === 0) {
			container.innerHTML = '<span class="small text-muted"><em>No cached genomes.</em></span>';
			return;
		}
		let totalBytes = 0;
		const rows = [];
		for (const key of genomeKeys) {
			const item = await localforage.getItem(key);
			const bytes = new Blob([JSON.stringify(item ?? null)]).size;
			totalBytes += bytes;
			// SDK caches wrap payload under .data; local caching stores {cols, dt, meta} directly.
			const payload = item?.data ?? item;
			const variants = payload?.dt?.length ?? 0;
			rows.push(
				`<li><code>${escapeHtml(key)}</code> \u2014 ${variants.toLocaleString()} variants \u2014 ${(bytes / 1024 / 1024).toFixed(2)} MB</li>`
			);
		}
		container.innerHTML =
			`<div class="small text-muted mb-1"><b>Total:</b> ${genomeKeys.length} item(s), ${(totalBytes / 1024 / 1024).toFixed(2)} MB</div>` +
			`<ul class="small mb-0" style="max-height:220px;overflow:auto;">${rows.join("")}</ul>`;
	} catch (err) {
		console.error("showGenomicCache failed:", err);
		container.innerHTML = `<span class="small text-danger">Error reading cache: ${escapeHtml(err.message)}</span>`;
	}
}
window.showGenomicCache = showGenomicCache;

const showGenomicCacheBtn = document.getElementById("showGenomicCacheBtn");
if (showGenomicCacheBtn) {
	showGenomicCacheBtn.addEventListener("click", showGenomicCache);
}

const clearGenomicCacheBtn = document.getElementById("clearGenomicCacheBtn");
if (clearGenomicCacheBtn) {
	clearGenomicCacheBtn.addEventListener("click", async () => {
		try {
			const keys = await localforage.keys();
			const gKeys = keys.filter(k => k.startsWith("Genome:"));
			for (const k of gKeys) await localforage.removeItem(k);
			const container = document.getElementById("genomicCacheList");
			if (container) {
				container.innerHTML = `<span class="small text-muted">Cleared ${gKeys.length} genome cache item(s).</span>`;
			}
		} catch (err) {
			alert(`Error clearing genome cache: ${err.message}`);
		}
	});
}

// --- Compute overlapping SNPs between Joshua and Marika based on chr:position ---
/**
 * Build a set of chr:position keys from parsed 23andMe data.
 * @param {Object} parsed - Parsed 23andMe data with cols and dt
 * @returns {Set<string>} Set of "chr:position" strings
 */
function getChrPosSet(parsed) {
  if (!parsed?.cols || !parsed?.dt) return new Set();

  const chrIdx = parsed.cols.indexOf('chromosome');
  const posIdx = parsed.cols.indexOf('position');

  if (chrIdx < 0 || posIdx < 0) {
    console.warn('Missing chromosome or position column', parsed.cols);
    return new Set();
  }

  const set = new Set();

  for (const row of parsed.dt) {
    const chr = row[chrIdx];
    const pos = row[posIdx];

    if (chr != null && pos != null && chr !== '' && pos !== '') {
      set.add(`${chr}:${pos}`);
    }
  }

  return set;
}




/**
 * Compute overlapping SNP positions between two 23andMe files.
 */
async function computeV4V5Overlap() {
  try {
    const joshuaUrl = 'data/PGP_hu09B28E_genome_Joshua_Yoakem_v5_Full_20250127054538.txt';
    const marikaUrl = 'data/PGP_huAE4518_genome_Marika_Forsythe_v4_Full_20240826181111.txt';

    const [joshuaParsed, marikaParsed] = await Promise.all([
      get23Txt(joshuaUrl),
      get23Txt(marikaUrl),
    ]);

    const joshuaSet = getChrPosSet(joshuaParsed);
    const marikaSet = getChrPosSet(marikaParsed);

    const overlap = [...joshuaSet].filter(key => marikaSet.has(key));

    // Store individual sets and overlap globally
    window.v5_23andme = [...joshuaSet];  // v5 SNPs (Joshua)
    window.v4_23andme = [...marikaSet];  // v4 SNPs (Marika)
    window.v4_v5_23andme = overlap;      // Overlap of both

	// console.log(`23andMe SNP sets computed:`);
	// console.log(`  v5 (Joshua): ${joshuaSet.size} SNPs`);
	// console.log(`  v4 (Marika): ${marikaSet.size} SNPs`);
	// console.log(`  Overlap: ${overlap.length} SNPs`);

    return overlap;
  } catch (err) {
    console.error('Error computing v4_v5_23andme overlap:', err);
    window.v5_23andme = [];
    window.v4_23andme = [];
    window.v4_v5_23andme = [];
    return [];
  }
}

// Initialize v4_v5_23andme on load — store the promise so fetchScoresTxts can await it
window._v4v5OverlapReady = computeV4V5Overlap();

// --- window.sdk namespace (users/participants) ---
window.sdk = Object.assign(window.sdk ?? {}, {
	// User selection
	getSelectedUserIds: () => Array.from(selectedUserIds),
	getSelectedUsers: () => Array.from(selectedUsersMap.values()),

	// Participant table UI
	renderLocalUsers: window.renderLocalUsers,
	applyParticipantFilters,
	populateVersionSelect,
	populateBuildSelect,
	populateGenderSelect,
	populateRaceSelect,
	populateEthnicitySelect,
	onParticipantsSizeChange: window.onParticipantsSizeChange,
	onParticipantsModeChange: window.onParticipantsModeChange,
	onPgsSelectionChange: window.onPgsSelectionChange,
});
//# sourceMappingURL=displayUsers-FXzPiGvl.mjs.map
