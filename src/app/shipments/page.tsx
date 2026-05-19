import { db } from '@/lib/db';
import {
	shipments,
	shipmentLines,
	purchaseOrders,
	projects,
	companies
} from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import TabHelp from '@/app/components/TabHelp';

const SHIPMENT_STATUSES = ['expected', 'in_transit', 'received', 'partial', 'cancelled'];

export default async function GlobalShipmentsPage({
	searchParams
}: {
	searchParams: Promise<{ project?: string; status?: string }>;
}) {
	const sp = await searchParams;
	const projectFilter = (sp.project ?? '').trim();
	const statusFilter = (sp.status ?? '').trim();

	const conditions = [];
	if (projectFilter !== '') conditions.push(eq(shipments.projectId, projectFilter));
	if (statusFilter !== '') conditions.push(eq(shipments.status, statusFilter));
	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const rows = await db
		.select({
			id: shipments.id,
			shipmentNo: shipments.shipmentNo,
			status: shipments.status,
			projectId: shipments.projectId,
			projectName: projects.name,
			poId: shipments.purchaseOrderId,
			poNo: purchaseOrders.poNo,
			repFirm: companies.name,
			carrier: shipments.carrier,
			trackingNumber: shipments.trackingNumber,
			expectedDate: shipments.expectedDate,
			shippedDate: shipments.shippedDate,
			receivedDate: shipments.receivedDate,
			createdAt: shipments.createdAt,
			lineCount: sql<number>`(SELECT count(*) FROM ${shipmentLines} WHERE ${shipmentLines.shipmentId} = ${shipments.id})::int`
		})
		.from(shipments)
		.innerJoin(projects, eq(shipments.projectId, projects.id))
		.leftJoin(purchaseOrders, eq(shipments.purchaseOrderId, purchaseOrders.id))
		.leftJoin(companies, eq(purchaseOrders.repFirmCompanyId, companies.id))
		.where(whereClause)
		.orderBy(desc(shipments.createdAt));

	const projectOptions = await db
		.selectDistinct({ id: projects.id, name: projects.name })
		.from(shipments)
		.innerJoin(projects, eq(shipments.projectId, projects.id))
		.orderBy(projects.name);

	const statusCounts = await db
		.select({ status: shipments.status, n: sql<number>`count(*)::int` })
		.from(shipments)
		.groupBy(shipments.status);
	const countByStatus = new Map(statusCounts.map((r) => [r.status, r.n]));

	return (
		<>
			<h1>Shipments — all projects</h1>

			<TabHelp tabKey="shipments-global" title="Cross-project Shipment workspace">
				<p style={{ margin: '0 0 6px' }}>
					Every shipment ILC expects or has received, across every project. Use this view
					to see what&apos;s arriving this week, what&apos;s late, and what just landed and
					needs receiving.
				</p>
				<ul style={{ margin: '6px 0', paddingLeft: '20px' }}>
					<li>
						<strong>expected</strong> — confirmed by rep, not in transit yet ·{' '}
						<strong>in_transit</strong> — shipped, awaiting arrival ·{' '}
						<strong>partial</strong> — arrived short, under investigation ·{' '}
						<strong>received</strong> — fully landed, lines now billable.
					</li>
					<li>
						Click a shipment number to open it (inside its parent project / PO).
					</li>
					<li>
						To create a new shipment, open the parent PO and use its shipment controls.
					</li>
				</ul>
			</TabHelp>

			<StatusRow countByStatus={countByStatus} kind="ship" />

			<form method="get" style={{ display: 'flex', gap: '8px', margin: '12px 0', alignItems: 'end' }}>
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
						{SHIPMENT_STATUSES.map((s) => (
							<option key={s} value={s}>{s}</option>
						))}
					</select>
				</label>
				<button type="submit">Filter</button>
				{(projectFilter || statusFilter) && (
					<a href="/shipments" className="muted" style={{ marginLeft: '8px' }}>Clear</a>
				)}
			</form>

			<p className="muted" style={{ fontSize: '12px' }}>
				Showing {rows.length} shipment{rows.length === 1 ? '' : 's'}.
			</p>

			{rows.length === 0 ? (
				<p className="muted">No shipments match the current filters.</p>
			) : (
				<table className="plain" style={{ maxWidth: '1300px', fontSize: '13px' }}>
					<thead>
						<tr>
							<th>SHIPMENT NO</th>
							<th>Project</th>
							<th>PO</th>
							<th>Rep firm</th>
							<th>Carrier</th>
							<th>Tracking</th>
							<th style={{ textAlign: 'right' }}>Lines</th>
							<th>Status</th>
							<th>Expected</th>
							<th>Received</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id}>
								<td>{r.shipmentNo}</td>
								<td>
									<a href={`/projects/${r.projectId}`}>{r.projectName}</a>
								</td>
								<td>
									{r.poNo ? (
										<a href={`/projects/${r.projectId}/pos/${r.poId}`}>{r.poNo}</a>
									) : (
										'—'
									)}
								</td>
								<td>{r.repFirm ?? '—'}</td>
								<td className="muted">{r.carrier ?? '—'}</td>
								<td className="muted" style={{ fontSize: '11px' }}>
									{r.trackingNumber ?? '—'}
								</td>
								<td style={{ textAlign: 'right' }}>{r.lineCount}</td>
								<td>{r.status}</td>
								<td className="muted">
									{r.expectedDate ? new Date(r.expectedDate).toLocaleDateString() : '—'}
								</td>
								<td className="muted">
									{r.receivedDate ? new Date(r.receivedDate).toLocaleDateString() : '—'}
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
				<MiniTile key={`${kind}-${s}`} label={s.replace('_', ' ')} value={n} />
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
