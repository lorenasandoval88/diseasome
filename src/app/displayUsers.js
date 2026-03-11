import { fetch23andMeParticipants } from "https://lorenasandoval88.github.io/get-23andme-data/dist/sdk.mjs";

const data = await fetch23andMeParticipants();
console.log("Fetched 23andMe participants:", data);
const participants = data ?? [];

function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

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

function renderLocalUsers(list) {
	const container = document.getElementById("localUsersDiv");
	if (!container) return;

	if (!Array.isArray(list) || !list.length) {
		container.innerHTML = "<p>No local users found.</p>";
		return;
	}

	const rows = list
		.map((p, i) => {
			const id = escapeHtml(p.id ?? p.participant_id ?? p.name ?? `user_${i + 1}`);
			const name = escapeHtml(p.name ?? "");
			const genos = p.genotypes ?? [];
			const genoCount = genos.length;
			const genoList = formatGenotypes(genos);
			return `
				<tr>
					<td>${i + 1}</td>
					<td>${id}</td>
					<td>${name}</td>
					<td>${genoCount}</td>
					<td>${genoList}</td>
				</tr>
			`;
		})
		.join("");

	container.innerHTML = `
		<div class="table-responsive">
			<table class="table table-sm table-striped table-bordered align-middle">
				<thead>
					<tr>
						<th>#</th>
						<th>Participant ID</th>
						<th>Name</th>
						<th># Genotypes</th>
						<th>Genotype files</th>
					</tr>
				</thead>
				<tbody>
					${rows}
				</tbody>
			</table>
		</div>
	`;
}

window.renderLocalUsers = () => renderLocalUsers(participants);

// If the LocalData tab is already visible on load, render immediately
if (document.getElementById("LocalData")?.style.display === "block") {
	window.renderLocalUsers();
}