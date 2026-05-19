import { db } from '@/lib/db';
import {
	purchaseOrders,
	salesOrders,
	orderLines,
	companies,
	projects
} from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import TabHelp from '@/app/components/TabHelp';

const PO_STATUSES = [
	'draft',
	'sent',
	'acknowledged',
	'shipped',
	'received',
	'closed',
	'cancelled',
	'dont_send'
];

export default async function GlobalPosPage({
	searchParams
}: {
	searchParams: Promise<{ project?: string; status?: string; repFirm?: string }>;
}) {
	const sp = await searchParams;
	const projectFilter = (sp.project ?? '').trim();
	const statusFilter = (sp.status ?? '').trim();
	const repFirmFilter = (sp.repFirm ?? '').trim();

	const conditions = [];
	if (projectFilter !== '') conditions.push(eq(purchaseOrders.projectId, projectFilter));
	if (statusFilter !== '') conditions.push(eq(purchaseOrders.status, statusFilter));
	if (repFirmFilter !== '')
		conditions.push(eq(purchaseOrders.repFirmCompanyId, repFirmFilter));
	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const rows = await db
		.select({
			id: purchaseOrders.id,
			poNo: purchaseOrders.poNo,
			status: purchaseOrders.status,
			projectId: purchaseOrders.projectId,
			projectName: projects.name,
			soNo: salesOrders.soNo,
			soId: salesOrders.id,
			repFirm: companies.name,
			trackingNumber: purchaseOrders.trackingNumber,
			orderedDate: purchaseOrders.orderedDate,
			sentAt: purchaseOrders.sentAt,
			createdAt: purchaseOrders.createdAt,
			lineCount: sql<number>`(SELECT count(*) FROM ${orderLines} WHERE ${orderLines.purchaseOrderId} = ${purchaseOrders.id})::int`,
			lineTotal: sql<string>`(SELECT coalesce(sum(${orderLines.qty} * ${orderLines.unitDn}), 0) FROM ${orderLines} WHERE ${orderLines.purchaseOrderId} = ${purchaseOrders.id})`
		})
		.from(purchaseOrders)
		.innerJoin(projects, eq(purchaseOrders.projectId, projects.id))
		.leftJoin(salesOrders, eq(purchaseOrders.salesOrderId, salesOrders.id))
		.leftJoin(companies, eq(purchaseOrders.repFirmCompanyId, companies.id))
		.where(whereClause)
		.orderBy(desc(purchaseOrders.createdAt));

	const projectOptions = await db
		.selectDistinct({ id: projects.id, name: projects.name })
		.from(purchaseOrders)
		.innerJoin(projects, eq(purchaseOrders.projectId, projects.id))
		.orderBy(projects.name);

	const repFirmOptions = await db
		.selectDistinct({ id: companies.id, name: companies.name })
		.from(purchaseOrders)
		.innerJoin(companies, eq(purchaseOrders.repFirmCompanyId, companies.id))
		.orderBy(companies.name);

	const statusCounts = await db
		.select({ status: purchaseOrders.status, n: sql<number>`count(*)::int` })
		.from(purchaseOrders)
		.groupBy(purchaseOrders.status);
	const countByStatus = new Map(statusCounts.map((r) => [r.status, r.n]));

	const usd = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0
	});

	return (
		<>
			<h1>Purchase Orders — all projects</h1>

			<TabHelp tabKey="pos-global" title="Cross-project Purchase Order workspace">
				<p style={{ margin: '0 0 6px' }}>
					Every PO ILC has issued to a manufacturer or rep firm, across every project.
					Use this view to track outstanding orders, chase rep firms, and find money out
					the door.
				</p>
				<ul style={{ margin: '6px 0', paddingLeft: '20px' }}>
					<li>
						<strong>draft</strong> — being prepared · <strong>sent</strong> — emailed to the
						rep · <strong>acknowledged</strong> — rep confirmed receipt ·{' '}
						<strong>shipped</strong> / <strong>received</strong> — fulfillment in progress
						or done · <strong>dont_send</strong> — internal-only PO (no rep email).
					</li>
					<li>Click a PO number to open its detail page (inside its parent project).</li>
					<li>
						POs are created from Sales Orders. To make a new one, open the SO and click{' '}
						<strong>Create POs from SO</strong>.
					</li>
				</ul>
			</TabHelp>

			<StatusRow countByStatus={countByStatus} kind="po" />

			<form method="get" style={{ display: 'flex', gap: '8px', margin: '12px 0', alignItems: 'end', flexWrap: 'wrap' }}>
				<label>
					Project
					<br />
					<select name="project" defaultValue={projectFilter} style={{ minWidth: '200px' }}>
						<option value="">All projects</option>
						{projectOptions.map((p) => (
							<option key={p.id} value={p.id}>{p.name}</option>
						))}
					</select>
				</label>
				<label>
					Status
					<br />
					<select name="status" defaultValue={statusFilter} style={{ minWidth: '140px' }}>
						<option value="">All statuses</option>
						{PO_STATUSES.map((s) => (
							<option key={s} value={s}>{s}</option>
						))}
					</select>
				</label>
				<label>
					Rep firm
					<br />
					<select name="repFirm" defaultValue={repFirmFilter} style={{ minWidth: '180px' }}>
						<option value="">All rep firms</option>
						{repFirmOptions.map((r) => (
							<option key={r.id} value={r.id}>{r.name}</option>
						))}
					</select>
				</label>
				<button type="submit">Filter</button>
				{(projectFilter || statusFilter || repFirmFilter) && (
					<a href="/pos" className="muted" style={{ marginLeft: '8px' }}>Clear</a>
				)}
			</form>

			<p className="muted" style={{ fontSize: '12px' }}>
				Showing {rows.length} PO{rows.length === 1 ? '' : 's'}.
			</p>

			{rows.length === 0 ? (
				<p className="muted">No purchase orders match the current filters.</p>
			) : (
				<table className="plain" style={{ maxWidth: '1300px', fontSize: '13px' }}>
					<thead>
						<tr>
							<th>PO NO</th>
							<th>Project</th>
							<th>Rep firm</th>
							<th>From SO</th>
							<th style={{ textAlign: 'right' }}>Lines</th>
							<th style={{ textAlign: 'right' }}>Dealer-net total</th>
							<th>Status</th>
							<th>Sent</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id}>
								<td>
									<a href={`/projects/${r.projectId}/pos/${r.id}`}>{r.poNo}</a>
								</td>
								<td>
									<a href={`/projects/${r.projectId}`}>{r.projectName}</a>
								</td>
								<td>{r.repFirm ?? '—'}</td>
								<td>
									{r.soNo ? (
										<a href={`/projects/${r.projectId}/sos/${r.soId}`}>{r.soNo}</a>
									) : (
										'—'
									)}
								</td>
								<td style={{ textAlign: 'right' }}>{r.lineCount}</td>
								<td style={{ textAlign: 'right' }}>
									{Number(r.lineTotal) ? usd.format(Number(r.lineTotal)) : '—'}
								</td>
								<td>{r.status}</td>
								<td className="muted">
									{r.sentAt ? new Date(r.sentAt).toLocaleDateString() : '—'}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</>
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
