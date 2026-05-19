import { db } from '@/lib/db';
import { salesOrders, orderLines, projects } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import TabHelp from '@/app/components/TabHelp';

const SO_STATUSES = ['draft', 'confirmed', 'shipped', 'invoiced', 'closed', 'cancelled'];

export default async function GlobalSosPage({
	searchParams
}: {
	searchParams: Promise<{ project?: string; status?: string }>;
}) {
	const sp = await searchParams;
	const projectFilter = (sp.project ?? '').trim();
	const statusFilter = (sp.status ?? '').trim();

	const conditions = [];
	if (projectFilter !== '') conditions.push(eq(salesOrders.projectId, projectFilter));
	if (statusFilter !== '') conditions.push(eq(salesOrders.status, statusFilter));
	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const rows = await db
		.select({
			id: salesOrders.id,
			soNo: salesOrders.soNo,
			status: salesOrders.status,
			projectId: salesOrders.projectId,
			projectName: projects.name,
			description: salesOrders.description,
			sentAt: salesOrders.sentAt,
			createdAt: salesOrders.createdAt,
			lineCount: sql<number>`(SELECT count(*) FROM ${orderLines} WHERE ${orderLines.salesOrderId} = ${salesOrders.id})::int`,
			lineTotal: sql<string>`(SELECT coalesce(sum(${orderLines.qty} * ${orderLines.unitCn}), 0) FROM ${orderLines} WHERE ${orderLines.salesOrderId} = ${salesOrders.id})`
		})
		.from(salesOrders)
		.innerJoin(projects, eq(salesOrders.projectId, projects.id))
		.where(whereClause)
		.orderBy(desc(salesOrders.createdAt));

	const projectOptions = await db
		.selectDistinct({ id: projects.id, name: projects.name })
		.from(salesOrders)
		.innerJoin(projects, eq(salesOrders.projectId, projects.id))
		.orderBy(projects.name);

	const statusCounts = await db
		.select({ status: salesOrders.status, n: sql<number>`count(*)::int` })
		.from(salesOrders)
		.groupBy(salesOrders.status);
	const countByStatus = new Map(statusCounts.map((r) => [r.status, r.n]));

	const usd = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0
	});

	return (
		<>
			<h1>Sales Orders — all projects</h1>

			<TabHelp tabKey="sos-global" title="Cross-project Sales Order workspace">
				<p style={{ margin: '0 0 6px' }}>
					Every Sales Order across every project. Use this view to see what ILC has sold,
					what&apos;s shipped, and what&apos;s been invoiced.
				</p>
				<ul style={{ margin: '6px 0', paddingLeft: '20px' }}>
					<li>
						<strong>draft</strong> — being composed · <strong>confirmed</strong> — sent to
						client · <strong>shipped</strong> — at least one PO from this SO has shipped ·{' '}
						<strong>invoiced</strong> — fully billed · <strong>closed</strong> — done.
					</li>
					<li>Click an SO number to open its detail page (inside its parent project).</li>
					<li>
						To create a new SO, open the project and use <strong>+ New Sales Order</strong> —
						SOs are always scoped to one project.
					</li>
				</ul>
			</TabHelp>

			<StatusRow countByStatus={countByStatus} kind="so" />

			<FilterForm
				projectOptions={projectOptions}
				projectFilter={projectFilter}
				statusFilter={statusFilter}
				statuses={SO_STATUSES}
				clearHref="/sos"
			/>

			<p className="muted" style={{ fontSize: '12px' }}>
				Showing {rows.length} SO{rows.length === 1 ? '' : 's'}.
			</p>

			{rows.length === 0 ? (
				<p className="muted">No sales orders match the current filters.</p>
			) : (
				<table className="plain" style={{ maxWidth: '1200px', fontSize: '13px' }}>
					<thead>
						<tr>
							<th>SO NO</th>
							<th>Project</th>
							<th style={{ textAlign: 'right' }}>Lines</th>
							<th style={{ textAlign: 'right' }}>Client-net total</th>
							<th>Status</th>
							<th>Sent</th>
							<th>Created</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id}>
								<td>
									<a href={`/projects/${r.projectId}/sos/${r.id}`}>{r.soNo}</a>
								</td>
								<td>
									<a href={`/projects/${r.projectId}`}>{r.projectName}</a>
								</td>
								<td style={{ textAlign: 'right' }}>{r.lineCount}</td>
								<td style={{ textAlign: 'right' }}>
									{Number(r.lineTotal) ? usd.format(Number(r.lineTotal)) : '—'}
								</td>
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

function FilterForm({
	projectOptions,
	projectFilter,
	statusFilter,
	statuses,
	clearHref
}: {
	projectOptions: { id: string; name: string }[];
	projectFilter: string;
	statusFilter: string;
	statuses: string[];
	clearHref: string;
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
				<a href={clearHref} className="muted" style={{ marginLeft: '8px' }}>
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
