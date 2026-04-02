import { cacheAndReturn, parse23Txt,load23andMeFile, fetch23andMeParticipants } from "https://lorenasandoval88.github.io/get-23andme-data/dist/sdk.mjs";
console.log("displayUsers.js loaded")
console.log("Importing fetch23andMeParticipants from SDK: https://lorenasandoval88.github.io/get-23andme-data/dist/sdk.mjs");
const data = await fetch23andMeParticipants();
// console.log("Fetched 23andMe participants:", data);
const participants = data ?? [];

const ROWS_PER_PAGE = 50;
const MAX_SELECTION = 10;

// Module-level selected users (shared across renders)
const selectedUserIds = new Set();
const selectedUsersMap = new Map(); // Map<id, userObject>

/** Get the currently selected user IDs. */
window.getSelectedUserIds = () => Array.from(selectedUserIds);

/** Get the currently selected users with full metadata. */
window.getSelectedUsers = () => Array.from(selectedUsersMap.values());


/** Update the global selection count display. */
function updateGlobalSelectionCount() {
	// Update count on 23andMe Data tab
	const el = document.getElementById("globalSelectionCount2");
	if (el) el.textContent = `Selected: ${selectedUserIds.size} / ${MAX_SELECTION}`;
	
	// Also update PRS tab user section to reflect selection
	const prsUsersdiv = document.getElementById("prsUsersdiv");
	if (prsUsersdiv && selectedUserIds.size > 0) {
		const userList = Array.from(selectedUsersMap.values())
			.map(u => u.name || u.id)
			.join(", ");
		prsUsersdiv.textContent = `${selectedUserIds.size} user(s) selected: ${userList}`;
	}
	
	console.log(`Selection updated: ${selectedUserIds.size} user(s)`, Array.from(selectedUserIds));
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
 * formatGenotypes(genotypes)
 * Format an array of genotype/file objects into an HTML string for display.
 * @param {Array} genotypes
 * @returns {string}
 */
function formatGenotypes(genotypes) {
	if (!Array.isArray(genotypes) || !genotypes.length) return "-";
	return genotypes
		.map((g) => {
			const name = g.filename ?? g.file ?? g.download_url ?? g.filetype ?? "(file)";
			const type = g.filetype ?? "";
			return `${escapeHtml(name)} ${type ? `(${escapeHtml(type)})` : ""}`;
		})
		.join("<br>");
}

/**
 * sanitizeKey(value)
 * Produce a lowercase alphanumeric underscore-only key suitable for element IDs.
 * @param {string} value
 * @returns {string}
 */
function sanitizeKey(value) {
	return String(value ?? "")
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "_")
		.replaceAll(/^_+|_+$/g, "");
}

/**
 * extractYear(item)
 * Extract a 4-digit year from common published/date fields on a participant.
 * @param {Object} item
 * @returns {string|null}
 */
function extractYear(item) {
	const pub = item.publishedDate ?? item.published_date ?? item.date ?? item.created ?? "";
	const s = String(pub ?? "");
	const m = s.match(/^(\d{4})/);
	if (m) return m[1];
	const d = new Date(s);
	if (!Number.isNaN(d.getFullYear()) && d.getFullYear() > 0) return String(d.getFullYear());
	return null;
}

/**
 * Populate the `participantsYearSelect` dropdown with available years.
 * @returns {void}
 */
function populateYearSelect() {
	const sel = document.getElementById('participantsYearSelect');
	if (!sel) return;
	const counts = new Map();
	participants.forEach((p) => {
		const y = extractYear(p);
		const key = y ?? 'Unknown';
		counts.set(key, (counts.get(key) || 0) + 1);
	});
	const years = Array.from(counts.keys()).filter(k => k !== 'Unknown').sort((a, b) => Number(b) - Number(a));
	const opts = [`<option value="">All Years (${participants.length} rows)</option>`].concat(years.map(y => `<option value="${y}">${y} (${counts.get(y)} rows)</option>`));
	if (counts.has('Unknown')) opts.push(`<option value="Unknown">Unknown (${counts.get('Unknown')} rows)</option>`);
	sel.innerHTML = opts.join('');
}

/**
 * Handler invoked when the year dropdown changes; filters participants and re-renders the table.
 * @param {string} selectedYear
 * @returns {void}
 */
window.onParticipantsYearChange = function onParticipantsYearChange(selectedYear) {
	const sel = document.getElementById('participantsYearSelect');
	const year = selectedYear ?? (sel && sel.value) ?? '';
	const list = year && year !== ''
		? participants.filter(p => (extractYear(p) ?? 'Unknown') === year)
		: participants;
	const key = sanitizeKey('participants') || 'participants';
	const yearLabel = year && year !== '' ? year : 'All Years';
	renderParticipantsTable(list, 'localUsersDiv', `Personal Genome Project Participants (${list.length}) - ${yearLabel}`, key);
};

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
	const selectedIds = selectedUserIds; // Use module-level set

	const renderPage = () => {
		const totalPages = Math.max(1, Math.ceil(list.length / ROWS_PER_PAGE));
		currentPage = Math.min(Math.max(1, currentPage), totalPages);
		const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
		const pageItems = list.slice(startIndex, startIndex + ROWS_PER_PAGE);

		const rowsHtml = pageItems.map((p, i) => {
			const rawId = p.id ?? p.participant_id ?? p.name ?? `user_${startIndex + i + 1}`;
			const pid = escapeHtml(String(rawId));
			const rawName = String(p.name ?? "");
			const name = escapeHtml(rawName);
			const displayName = escapeHtml(rawName.length > 14 ? rawName.slice(0, 14) + '...' : rawName);
			const genos = p.genotypes ?? [];
			const genoCount = genos.length;
			const genoList = formatGenotypes(genos);

			/**
			 * getPublishedDate(item)
			 * Return a published/date string from an item using common property names.
			 * @param {Object} item
			 * @returns {string}
			 */
			function getPublishedDate(item) {
				return item.publishedDate ?? item.published_date ?? item.date ?? item.created ?? "-";
			}

			/**
			 * getDownloadUrl(item)
			 * Prefer known download URL fields (downloadUrl, download_url, url, profileUrl).
			 * @param {Object} item
			 * @returns {string|null}
			 */
			function getDownloadUrl(item) {
				return item.downloadUrl ?? item.download_url ?? item.url ?? item.profileUrl ?? null;
			}

			const published = escapeHtml(String(getPublishedDate(p)));

			/**
			 * getProfileUrl(item)
			 * Extract a profile URL from common candidate properties.
			 * @param {Object} item
			 * @returns {string|null}
			 */
			function getProfileUrl(item) {
				return item.profileUrl ?? item.profile_url ?? null;
			}

			const profileUrl = getProfileUrl(p);
			const profileHtml = profileUrl ? `<a href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener">View</a>` : "-";

			const downloadUrl = getDownloadUrl(p);
			const downloadHtml = downloadUrl ? `<a href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener">${escapeHtml(downloadUrl)}</a>` : "-";
			const checked = selectedIds.has(String(rawId)) ? 'checked' : '';

			return `
				<tr>
					<td>${startIndex + i + 1}</td>
					<td><input class="participant-select" type="checkbox" value="${escapeHtml(String(rawId))}" ${checked} /></td>
					<td>${pid}</td>
					<td title="${name}">${displayName}</td>
					<td>${published}</td>
					<td>${profileHtml}</td>
					<td>${downloadHtml}</td>
				</tr>
			`;
		}).join('');

		container.innerHTML = `
			<div class="d-flex justify-content-between align-items-center my-2">
				<h5 class="mb-0">${escapeHtml(title)}</h5>
				<div>
					<label class="form-check-label me-2" for="selectAllParticipants_${key}">Select all</label>
					<input class="form-check-input" id="selectAllParticipants_${key}" type="checkbox" ${list.length > 0 && selectedIds.size === list.length ? 'checked' : ''} />
				</div>
			</div>
			<div class="table-responsive">
				<table class="table table-sm table-striped table-bordered align-middle">
					<thead class="table-dark">
						<tr>
							<th>#</th>
							<th>Select</th>
							<th>Participant ID</th>
							<th>Name</th>
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
			<div id="selectedParticipantsSummary_${key}" class="small text-muted">Selected: ${selectedIds.size} / ${MAX_SELECTION}</div>
				<div class="d-flex align-items-center gap-2">
					<button id="prevPage_${key}" class="btn btn-sm btn-outline-secondary" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
					<span id="pageInfo_${key}" class="small text-muted">Page ${currentPage} of ${totalPages}</span>
					<button id="nextPage_${key}" class="btn btn-sm btn-outline-secondary" ${currentPage >= totalPages ? 'disabled' : ''}>Next</button>
				</div>
			</div>
		`;

		const selectAll = document.getElementById(`selectAllParticipants_${key}`);
		// update external title element (placed above the dropdown)
		const titleEl = document.getElementById('participantsTitle');
		if (titleEl) titleEl.textContent = title;
		const rowCheckboxes = Array.from(container.querySelectorAll('.participant-select'));
		const prevPageBtn = document.getElementById(`prevPage_${key}`);
		const nextPageBtn = document.getElementById(`nextPage_${key}`);

		if (selectAll) {
			selectAll.addEventListener('change', () => {
				if (selectAll.checked) {
					// Limit to first MAX_SELECTION items
					list.slice(0, MAX_SELECTION).forEach((it) => {
						const id = String(it.id ?? it.participant_id ?? it.name);
						selectedIds.add(id);
						selectedUsersMap.set(id, it);
					});
					if (list.length > MAX_SELECTION) {
						alert(`Selection limited to ${MAX_SELECTION} items.`);
					}
				} else {
					selectedIds.clear();
					selectedUsersMap.clear();
				}
				renderPage();
				updateGlobalSelectionCount();
			});
		}

		rowCheckboxes.forEach((cb) => {
			const user = list.find(it => String(it.id ?? it.participant_id ?? it.name) === cb.value);
			cb.addEventListener('change', () => {
				if (cb.checked) {
					if (selectedIds.size >= MAX_SELECTION) {
						cb.checked = false;
						alert(`Maximum ${MAX_SELECTION} selections allowed.`);
						return;
					}
					selectedIds.add(cb.value);
					if (user) selectedUsersMap.set(cb.value, user);
				} else {
					selectedIds.delete(cb.value);
					selectedUsersMap.delete(cb.value);
				}
				if (selectAll) selectAll.checked = list.length > 0 && selectedIds.size === Math.min(list.length, MAX_SELECTION);
				const summary = document.getElementById(`selectedParticipantsSummary_${key}`);
				if (summary) summary.textContent = `Selected: ${selectedIds.size} / ${MAX_SELECTION}`;
				updateGlobalSelectionCount();

			});
		});

		if (prevPageBtn) prevPageBtn.addEventListener('click', () => { currentPage -= 1; renderPage(); });
		if (nextPageBtn) nextPageBtn.addEventListener('click', () => { currentPage += 1; renderPage(); });
	};

	renderPage();
}

/**
 * renderLocalUsers()
 * Public entry point that renders the participants table (honoring any active year filter).
 */
window.renderLocalUsers = () => {
	const key = sanitizeKey('participants') || 'participants';
	const sel = document.getElementById('participantsYearSelect');
	const year = sel?.value ?? '';
	const list = year && year !== '' ? participants.filter(p => (extractYear(p) ?? 'Unknown') === year) : participants;
	const yearLabel = year && year !== '' ? year : 'All Years';
	renderParticipantsTable(list, 'localUsersDiv', `Personal Genome Project Participants (${list.length}) - ${yearLabel}`, key);
};

// If the LocalData tab is already visible on load, render immediately
if (document.getElementById("LocalData")?.style.display === "block") {
	window.renderLocalUsers();
}

// populate year select after definitions
populateYearSelect();

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
		console.log("Upload 23andMe button clicked");
		my23FileInput.click();
	});

	// Handle file selection
	my23FileInput.addEventListener("change", async (event) => {
		const file = event.target.files?.[0];
		// console.log("file upload", file);
		if (!file) return;

		if (my23Status) my23Status.textContent = `Reading ${file.name}...`;

		try {
			const text = await file.text();
			
			// Use parse23Txt from the SDK if available, otherwise fall back to local parser
			let parsed;
			
			if (typeof load23andMeFile === "function") {
				// SDK is available - load23andMeFile returns parsed data directly
				parsed = await load23andMeFile(file);
				//console.log("Using load23andMeFile from SDK import", parsed);
				// If load23andMeFile returns an object with a 'dt' property, use it directly
				if (parsed && parsed.dt) {
					parsed = {
						cols: parsed.cols || [],
						dt: parsed.dt || [],
						meta: parsed.meta || ""
					};
				} else {
					throw new Error("load23andMeFile did not return expected parsed data structure.");
				}
			} else if (typeof window.parse23Txt === "function") {
				parsed = await window.parse23Txt(text);
				console.log("Using window.parse23Txt from window", parsed);
			} else {
				parsed = parseLocalFile(text, file.name);
				console.log("Using parseLocalFile fallback", parsed);
			}

			if (!parsed || !parsed.dt || parsed.dt.length === 0) {
				if (my23Status) my23Status.textContent = `Failed to parse ${file.name}. Ensure it's a valid 23andMe file.`;
				return;
			}

			// Extract published date from first line (e.g., "# This data file generated by 23andMe at: Wed Jan 29 21:17:49 2025")
			const firstLine = text.split(/[\r\n]/)[0] ?? "";
			let publishedDate = new Date().toISOString().slice(0, 10); // default to today
			const dateMatch = firstLine.match(/at:\s*(.+)$/i);
			if (dateMatch) {
				const parsedDate = new Date(dateMatch[1].trim());
				if (!isNaN(parsedDate.getTime())) {
					publishedDate = parsedDate.toISOString().slice(0, 10);
				}
			}

			// Always create a proper user object structure
			const userId = file.name; // Use filename with extension as ID
			const user = {
				id: userId,
				//name: userId,
				dataSource: "file Upload",
				dataType: "23andMe",
				downloadUrl: null, // No URL for uploaded files
				profileUrl: null,
				publishedDate: publishedDate,
			
			};
			
			// Add to selection
			if (selectedUserIds.size < MAX_SELECTION) {
				selectedUserIds.add(userId);
				selectedUsersMap.set(userId, user);
				updateGlobalSelectionCount();
				if (my23Status) my23Status.textContent = `Loaded ${file.name}: ${parsed.dt.length.toLocaleString()} variants. Added to selection.`;
			} else {
				if (my23Status) my23Status.textContent = `Loaded ${file.name}, but max selection (${MAX_SELECTION}) reached. Deselect a user first.`;
			}

			console.log("Uploaded 23andMe file:", user);
		} catch (err) {
			console.error("Error reading 23andMe file:", err);
			if (my23Status) my23Status.textContent = `Error: ${err.message}`;
		}

		// Reset input so the same file can be re-selected
		my23FileInput.value = "";
	});
}

/**
 * Fallback parser for 23andMe files when SDK parse23Txt is not available.
 * Matches the structure of parse23Txt from the SDK.
 * @param {string} txt - Raw file content
 * @param {string} url - Name or URL of the file
 * @returns {Object} Parsed data with cols, dt, meta arrays
 */
function parseLocalFile(txt, url) {
	const obj = {};
	const rows = String(txt ?? "").split(/[\r\n]+/g).filter(Boolean);
	obj.txt = txt;
	obj.url = url || "no url";

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