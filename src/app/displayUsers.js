import { fetch23andMeParticipants } from "https://lorenasandoval88.github.io/get-23andme-data/dist/sdk.mjs";

const data = await fetch23andMeParticipants();
// console.log("Fetched 23andMe participants:", data);
const participants = data ?? [];

const ROWS_PER_PAGE = 50;

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
 * populateYearSelect()
 * Populate the `participantsYearSelect` dropdown with available years.
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
 * onParticipantsYearChange(selectedYear)
 * Handler invoked when the year dropdown changes; filters participants and re-renders the table.
 * @param {string} selectedYear
 */
window.onParticipantsYearChange = function onParticipantsYearChange(selectedYear) {
	const sel = document.getElementById('participantsYearSelect');
	const year = selectedYear ?? (sel && sel.value) ?? '';
	const list = year && year !== ''
		? participants.filter(p => (extractYear(p) ?? 'Unknown') === year)
		: participants;
	const key = sanitizeKey('participants') || 'participants';
	renderParticipantsTable(list, 'localUsersDiv', `Personal Genome Project Participants (${list.length})`, key);
};

/**
 * renderParticipantsTable(list, targetId, title, key)
 * Render a paginated participants table with selection and pagination controls.
 * @param {Array} list
 * @param {string} targetId
 * @param {string} title
 * @param {string} key
 */
function renderParticipantsTable(list, targetId, title, key) {
	const container = document.getElementById(targetId);
	if (!container) return;
	container.style.display = 'block';

	let currentPage = 1;
	const selectedIds = new Set();

	const renderPage = () => {
		const totalPages = Math.max(1, Math.ceil(list.length / ROWS_PER_PAGE));
		currentPage = Math.min(Math.max(1, currentPage), totalPages);
		const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
		const pageItems = list.slice(startIndex, startIndex + ROWS_PER_PAGE);

		const rowsHtml = pageItems.map((p, i) => {
			const rawId = p.id ?? p.participant_id ?? p.name ?? `user_${startIndex + i + 1}`;
			const pid = escapeHtml(String(rawId));
			const name = escapeHtml(p.name ?? "");
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
			 * Prefer known download URL fields (downloadUrl, download_url, url, profileUrl)
			 * and fall back to genotype file locations.
			 * @param {Object} item
			 * @returns {string|null}
			 */
			function getDownloadUrl(item) {
				return item.downloadUrl ?? item.download_url ?? item.url ?? (item.genotypes && item.genotypes[0] && (item.genotypes[0].download_url ?? item.genotypes[0].file)) ?? item.profileUrl ?? null;
			}

			const published = escapeHtml(String(getPublishedDate(p)));
			const downloadUrl = getDownloadUrl(p);
			const downloadHtml = downloadUrl ? `<a href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener">${escapeHtml(downloadUrl)}</a>` : "-";
			const checked = selectedIds.has(String(rawId)) ? 'checked' : '';

			return `
				<tr>
					<td>${startIndex + i + 1}</td>
					<td><input class="participant-select" type="checkbox" value="${escapeHtml(String(rawId))}" ${checked} /></td>
					<td>${pid}</td>
					<td>${name}</td>
					<td>${published}</td>
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
					<thead>
						<tr>
							<th>#</th>
							<th>Select</th>
							<th>Participant ID</th>
							<th>Name</th>
							<th>Published Date</th>
							<th>Download URL</th>
						</tr>
					</thead>
					<tbody>
						${rowsHtml}
					</tbody>
				</table>
			</div>
			<div class="d-flex justify-content-between align-items-center mt-2">
				<div id="selectedParticipantsSummary_${key}" class="small text-muted">Selected: ${selectedIds.size}</div>
				<div class="d-flex align-items-center gap-2">
					<button id="prevPage_${key}" class="btn btn-sm btn-outline-secondary" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
					<span id="pageInfo_${key}" class="small text-muted">Page ${currentPage} of ${totalPages}</span>
					<button id="nextPage_${key}" class="btn btn-sm btn-outline-secondary" ${currentPage >= totalPages ? 'disabled' : ''}>Next</button>
				</div>
			</div>
		`;

		const selectAll = document.getElementById(`selectAllParticipants_${key}`);
		const rowCheckboxes = Array.from(container.querySelectorAll('.participant-select'));
		const prevPageBtn = document.getElementById(`prevPage_${key}`);
		const nextPageBtn = document.getElementById(`nextPage_${key}`);

		if (selectAll) {
			selectAll.addEventListener('change', () => {
				if (selectAll.checked) {
					list.forEach((it) => selectedIds.add(String(it.id ?? it.participant_id ?? it.name)));
				} else {
					selectedIds.clear();
				}
				renderPage();
			});
		}

		rowCheckboxes.forEach((cb) => {
			cb.addEventListener('change', () => {
				if (cb.checked) selectedIds.add(cb.value);
				else selectedIds.delete(cb.value);
				if (selectAll) selectAll.checked = list.length > 0 && selectedIds.size === list.length;
				const summary = document.getElementById(`selectedParticipantsSummary_${key}`);
				if (summary) summary.textContent = `Selected: ${selectedIds.size}`;
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
	renderParticipantsTable(list, 'localUsersDiv', `Personal Genome Project Participants (${list.length})`, key);
};

// If the LocalData tab is already visible on load, render immediately
if (document.getElementById("LocalData")?.style.display === "block") {
	window.renderLocalUsers();
}

// populate year select after definitions
populateYearSelect();