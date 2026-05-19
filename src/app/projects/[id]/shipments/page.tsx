import { db } from '@/lib/db';
import {
	shipments,
	shipmentLines,
	purchaseOrders,
	projects,
	companies
} from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import TabHelp from '@/app/components/TabHelp';

export default async function ProjectShipmentsPage({
	params
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const rows = await db
		.select({
			id: shipments.id,
			shipmentNo: shipments.shipmentNo,
			status: shipments.status,
			poId: shipments.purchaseOrderId,
			poNo: purchaseOrders.poNo,
			repFirm: companies.name,
			carrier: shipments.carrier,
			trackingNumber: shipments.trackingNumber,
			expectedDate: shipments.expectedDate,
			shippedDate: shipments.shippedDate,
			receivedDate: shipments.receivedDate,
			receivedAtLocation: shipments.receivedAtLocation,
			createdAt: shipments.createdAt,
			lineCount: sql<number>`(SELECT count(*) FROM ${shipmentLines} WHERE ${shipmentLines.shipmentId} = ${shipments.id})`,
			totalQty: sql<string>`(SELECT coalesce(sum(${shipmentLines.qtyShipped}), 0) FROM ${shipmentLines} WHERE ${shipmentLines.shipmentId} = ${shipments.id})`
		})
		.from(shipments)
		.leftJoin(purchaseOrders, eq(shipments.purchaseOrderId, purchaseOrders.id))
		.leftJoin(companies, eq(purchaseOrders.repFirmCompanyId, companies.id))
		.where(eq(shipments.projectId, id))
		.orderBy(desc(shipments.createdAt));

	// Status counts for the header row
	const [counts] = await db
		.select({
			total: sql<number>`count(*)::int`,
			expected: sql<number>`count(*) filter (where ${shipments.status} = 'expected')::int`,
			inTransit: sql<number>`count(*) filter (where ${shipments.status} = 'in_transit')::int`,
			received: sql<number>`count(*) filter (where ${shipments.status} = 'received')::int`,
			partial: sql<number>`count(*) filter (where ${shipments.status} = 'partial')::int`,
			cancelled: sql<number>`count(*) filter (where ${shipments.status} = 'cancelled')::int`
		})
		.from(shipments)
		.where(eq(shipments.projectId, id));

	return (
		<>
			<p>
				<a href={`/projects/${project.id}`}>← {project.name}</a>
			</p>

			<h1>Shipments — {project.name}</h1>

			<TabHelp tabKey="shipments" title="Shipments — tracking actual deliveries">
				<p style={{ margin: '0 0 6px' }}>
					A shipment is one physical delivery from one rep firm against one PO. Manufacturers
					commonly split orders (50 now, 50 later) so a single PO can have many shipments.
				</p>
				<ul style={{ margin: '6px 0', paddingLeft: '20px' }}>
					<li>
						Create shipments from the PO detail page. Lines are partial-friendly — qty shipped
						can be less than the line&apos;s qty.
					</li>
					<li>
						Status lifecycle: <code>expected → in_transit → received</code> (or{' '}
						<code>partial</code> for arrived-but-short).
					</li>
					<li>
						Marking a shipment received is what makes those lines eligible to invoice on the
						<strong> Invoices</strong> tab — the &quot;delivered &amp; uninvoiced&quot; picker
						reads from this.
					</li>
				</ul>
			</TabHelp>

			<p className="muted">
				Shipments are logged against POs. From a PO, click <strong>Shipments</strong> to add a new
				one.
			</p>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
					gap: '8px',
					maxWidth: '900px',
					margin: '12px 0 16px'
				}}
			>
				<MiniStat label="Total" value={counts?.total ?? 0} />
				<MiniStat label="Expected" value={counts?.expected ?? 0} />
				<MiniStat label="In transit" value={counts?.inTransit ?? 0} />
				<MiniStat label="Partial" value={counts?.partial ?? 0} />
				<MiniStat label="Received" value={counts?.received ?? 0} highlight />
				<MiniStat label="Cancelled" value={counts?.cancelled ?? 0} muted />
			</div>

			{rows.length === 0 ? (
				<p className="muted">No shipments on this project yet.</p>
			) : (
				<table className="plain" style={{ maxWidth: '1200px' }}>
					<thead>
						<tr>
							<th>SHIPMENT #</th>
							<th>Status</th>
							<th>PO</th>
							<th>Rep firm</th>
							<th>Lines</th>
							<th style={{ textAlign: 'right' }}>QTY</th>
							<th>Carrier</th>
							<th>Tracking #</th>
							<th>Expected</th>
							<th>Shipped</th>
							<th>Received</th>
							<th>At</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((s) => (
							<tr key={s.id}>
								<td>
									<a href={`/projects/${id}/pos/${s.poId}/shipments/${s.id}`}>{s.shipmentNo}</a>
								</td>
								<td>
									<StatusBadge status={s.status} />
								</td>
								<td>
									{s.poNo ? (
										<a href={`/projects/${id}/pos/${s.poId}`}>{s.poNo}</a>
									) : (
										'—'
									)}
								</td>
								<td>{s.repFirm ?? '—'}</td>
								<td>{s.lineCount}</td>
								<td style={{ textAlign: 'right' }}>{Number(s.totalQty).toLocaleString()}</td>
								<td>{s.carrier ?? '—'}</td>
								<td className="muted">{s.trackingNumber ?? '—'}</td>
								<td>{s.expectedDate ? new Date(s.expectedDate).toLocaleDateString() : '—'}</td>
								<td>{s.shippedDate ? new Date(s.shippedDate).toLocaleDateString() : '—'}</td>
								<td>{s.receivedDate ? new Date(s.receivedDate).toLocaleDateString() : '—'}</td>
								<td>{s.receivedAtLocation ?? '—'}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</>
	);
}

function MiniStat({
	label,
	value,
	highlight,
	muted
}: {
	label: string;
	value: number;
	highlight?: boolean;
	muted?: boolean;
}) {
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
			<div
				style={{
					fontSize: '16px',
					fontWeight: 600,
					color: muted ? '#999' : highlight ? '#0a7c2f' : '#111'
				}}
			>
				{value}
			</div>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, { bg: string; fg: string }> = {
		expected: { bg: '#e8eef5', fg: '#234' },
		in_transit: { bg: '#fff3cd', fg: '#7a5d00' },
		received: { bg: '#d4edda', fg: '#155724' },
		partial: { bg: '#ffe4c2', fg: '#8a4a00' },
		cancelled: { bg: '#f5d6d6', fg: '#7a1212' }
	};
	const c = colors[status] ?? { bg: '#eee', fg: '#333' };
	return (
		<span
			style={{
				background: c.bg,
				color: c.fg,
				padding: '2px 6px',
				borderRadius: '3px',
				fontSize: '11px',
				textTransform: 'uppercase',
				fontWeight: 600
			}}
		>
			{status}
		</span>
	);
}
