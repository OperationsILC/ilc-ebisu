import { db } from '@/lib/db';
import { rfqs, rfqLines, projects, companies } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import TabHelp from '@/app/components/TabHelp';

const RFQ_STATUSES = ['draft', 'sent', 'quoted', 'accepted', 'declined', 'cancelled'];

export default async function GlobalRfqsPage({
	searchParams
}: {
	searchParams: Promise<{ project?: string; status?: string }>;
}) {
	const sp = await searchParams;
	const projectFilter = (sp.project ?? '').trim();
	const statusFilter = (sp.status ?? '').trim();

	// Build the WHERE conditions
	const conditions = [];
	if (projectFilter !== '') conditions.push(eq(rfqs.projectId, projectFilter));
	if (statusFilter !== '') conditions.push(eq(rfqs.status, statusFilter));
	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const rows = await db
		.select({
			id: rfqs.id,
			rfqNo: rfqs.rfqNo,
			status: rfqs.status,
			projectId: rfqs.projectId,
			projectName: projects.name,
			repFirm: companies.name,
			sentAt: rfqs.sentAt,
			createdAt: rfqs.createdAt,
			lineCount: sql<number>`(SELECT count(*) FROM ${rfqLines} WHERE ${rfqLines.rfqId} = ${rfqs.id})::int`
		})
		.from(rfqs)
		.innerJoin(projects, eq(rfqs.projectId, projects.id))
		.leftJoin(companies, eq(rfqs.repFirmCompanyId, companies.id))
		.where(whereClause)
		.orderBy(desc(rfqs.createdAt));

	// Project list for the filter dropdown — only show projects that actually have RFQs.
	const projectOptions = await db
		.selectDistinct({ id: projects.id, name: projects.name })
		.from(rfqs)
		.innerJoin(projects, eq(rfqs.projectId, projects.id))
		.orderBy(projects.name);

	// Status counts for the badge row
	const statusCounts = await db
		.select({
			status: rfqs.status,
			n: sql<number>`count(*)::int`
		})
		.from(rfqs)
		.groupBy(rfqs.status);
	const countByStatus = new Map(statusCounts.map((r) => [r.status, r.n]));

	return (
		<>
			<h1>RFQs — all projects</h1>

			<TabHelp tabKey="rfqs-global" title="Cross-project RFQ workspace">
				<p style={{ margin: '0 0 6px' }}>
					Every Request For Quote across every project. Use this view to chase rep firms,
					see what&apos;s outstanding, and find quotes by status.
				</p>
				<ul style={{ margin: '6px 0', paddingLeft: '20px' }}>
					<li>
						<strong>draft</strong> — composed but not sent yet · <strong>sent</strong> —
						emailed to the rep, awaiting reply · <strong>quoted</strong> — rep replied with
						pricing, ready to feed an SO · <strong>accepted</strong> — pricing approved ·{' '}
						<strong>declined / cancelled</strong> — closed without quote.
					</li>
					<li>Click an RFQ number to open its detail page (inside its parent project).</li>
					<li>
						To create a new RFQ, open the project and use <strong>+ New RFQ</strong> — RFQs
						are always scoped to one project.
					</li>
				</ul>
			</TabHelp>

			<StatusRow countByStatus={countByStatus} kind="rfq" />

			<FilterForm
				projectOptions={projectOptions}
				projectFilter={projectFilter}
				statusFilter={statusFilter}
				statuses={RFQ_STATUSES}
			/>

			<p className="muted" style={{ fontSize: '12px' }}>
				Showing {rows.length} RFQ{rows.length === 1 ? '' : 's'}.
			</p>

			{rows.length === 0 ? (
				<p className="muted">No RFQs match the current filters.</p>
			) : (
				<table className="plain" style={{ maxWidth: '1200px', fontSize: '13px' }}>
					<thead>
						<tr>
							<th>RFQ NO</th>
							<th>Project</th>
							<th>Rep firm</th>
							<th style={{ textAlign: 'right' }}>Lines</th>
							<th>Status</th>
							<th>Sent</th>
							<th>Created</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id}>
								<td>
									<a href={`/projects/${r.projectId}/rfqs/${r.id}`}>{r.rfqNo}</a>
								</td>
								<td>
									<a href={`/projects/${r.projectId}`}>{r.projectName}</a>
								</td>
								<td>{r.repFirm ?? '—'}</td>
								<td style={{ textAlign: 'right' }}>{r.lineCount}</td>
								<td>{r.status}</td>
								<td>{r.sentAt ? new Date(r.sentAt).toLocaleDateString() : '—'}</td>
								<td className="muted">{new Date(r.createdAt).toLocaleDateString()}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</>
	);
}

// ---------------------------------------------------------------------------
// Shared filter UI (copy-pasted to each cross-project page would be cleaner
// to factor out, but for now we inline so each page is self-contained).
// ---------------------------------------------------------------------------

function FilterForm({
	projectOptions,
	projectFilter,
	statusFilter,
	statuses
}: {
	projectOptions: { id: string; name: string }[];
	projectFilter: string;
	statusFilter: string;
	statuses: string[];
}) {
	return (
		<form method="get" style={{ display: 'flex', gap: '8px', margin: '12px 0', alignItems: 'end' }}>
			<label>
				Project
				<br />
				<select name="project" defaultValue={projectFilter} style={{ minWidth: '200px' }}>
					<option value="">All projects</option>
					{projectOptions.map((p) => (
						<option key={p.id} value={p.id}>
							{p.name}
						</option>
					))}
				</select>
			</label>
			<label>
				Status
				<br />
				<select name="status" defaultValue={statusFilter} style={{ minWidth: '140px' }}>
					<option value="">All statuses</option>
					{statuses.map((s) => (
						<option key={s} value={s}>
							{s}
						</option>
					))}
				</select>
			</label>
			<button type="submit">Filter</button>
			{(projectFilter || statusFilter) && (
				<a href="/rfqs" className="muted" style={{ marginLeft: '8px' }}>
					Clear
				</a>
			)}
		</form>
	);
}

function StatusRow({
	countByStatus,
	kind
}: {
	countByStatus: Map<string, number>;
	kind: string;
}) {
	const total = Array.from(countByStatus.values()).reduce((a, b) => a + b, 0);
	const entries = Array.from(countByStatus.entries());
	return (
		<div
			style={{
				display: 'grid',
				gridTemplateColumns: `repeat(auto-fit, minmax(110px, 1fr))`,
				gap: '8px',
				maxWidth: '900px',
				margin: '12px 0'
			}}
		>
			<MiniTile label="Total" value={total} />
			{entries.map(([s, n]) => (
				<MiniTile key={`${kind}-${s}`} label={s} value={n} />
			))}
		</div>
	);
}

function MiniTile({ label, value }: { label: string; value: number }) {
	return (
		<div
			style={{
				padding: '6px 10px',
				background: '#fff',
				border: '1px solid #ddd',
				borderRadius: '4px'
			}}
		>
			<div className="muted" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
				{label}
			</div>
			<div style={{ fontSize: '16px', fontWeight: 600 }}>{value}</div>
		</div>
	);
}
