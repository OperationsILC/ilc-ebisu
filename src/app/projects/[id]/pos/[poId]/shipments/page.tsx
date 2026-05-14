import { db } from '@/lib/db';
import {
	shipments,
	shipmentLines,
	purchaseOrders,
	orderLines,
	projects,
	companies
} from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { createShipment } from './actions';

export default async function ShipmentsListPage({
	params
}: {
	params: Promise<{ id: string; poId: string }>;
}) {
	const { id, poId } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const po = (
		await db
			.select({
				po: purchaseOrders,
				repFirm: companies.name
			})
			.from(purchaseOrders)
			.leftJoin(companies, eq(purchaseOrders.repFirmCompanyId, companies.id))
			.where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.projectId, id)))
			.limit(1)
	)[0];
	if (!po) notFound();

	const rows = await db
		.select({
			id: shipments.id,
			shipmentNo: shipments.shipmentNo,
			status: shipments.status,
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
		.where(eq(shipments.purchaseOrderId, poId))
		.orderBy(desc(shipments.createdAt));

	// PO-line totals for the rollup row.
	const [poTotals] = await db
		.select({
			lineCount: sql<number>`count(*)`,
			totalQty: sql<string>`coalesce(sum(${orderLines.qty}), 0)`
		})
		.from(orderLines)
		.where(eq(orderLines.purchaseOrderId, poId));

	// Received qty across all this PO's lines (sum of received shipment_lines).
	const [receivedTotals] = await db
		.select({
			totalReceived: sql<string>`coalesce(sum(${shipmentLines.qtyShipped}), 0)`
		})
		.from(shipmentLines)
		.innerJoin(shipments, eq(shipmentLines.shipmentId, shipments.id))
		.innerJoin(orderLines, eq(shipmentLines.orderLineId, orderLines.id))
		.where(and(eq(orderLines.purchaseOrderId, poId), eq(shipments.status, 'received')));

	const totalQty = Number(poTotals?.totalQty ?? 0);
	const totalReceived = Number(receivedTotals?.totalReceived ?? 0);

	const createBound = createShipment.bind(null, id, poId);

	return (
		<>
			<p>
				<a href={`/projects/${id}/pos/${poId}`}>← {po.po.poNo} ({po.repFirm ?? 'no rep firm'})</a>
			</p>

			<h1>Shipments — {po.po.poNo}</h1>

			<div
				className="muted"
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
					gap: '8px',
					maxWidth: '700px',
					margin: '12px 0 16px'
				}}
			>
				<Stat label="Shipments" value={rows.length.toString()} />
				<Stat label="PO line count" value={String(poTotals?.lineCount ?? 0)} />
				<Stat label="PO total QTY" value={totalQty.toLocaleString()} />
				<Stat
					label="Received"
					value={`${totalReceived.toLocaleString()} / ${totalQty.toLocaleString()}`}
					highlight={totalReceived > 0 && totalReceived >= totalQty}
				/>
			</div>

			<form action={createBound} style={{ margin: '12px 0' }}>
				<button className="primary" type="submit">
					+ New shipment
				</button>
			</form>

			{rows.length === 0 ? (
				<p className="muted">
					No shipments yet. Click <strong>New shipment</strong> to log an expected or arrived
					delivery.
				</p>
			) : (
				<table className="plain" style={{ maxWidth: '1100px' }}>
					<thead>
						<tr>
							<th>SHIPMENT #</th>
							<th>Status</th>
							<th>Lines</th>
							<th style={{ textAlign: 'right' }}>QTY</th>
							<th>Carrier</th>
							<th>Tracking #</th>
							<th>Expected</th>
							<th>Shipped</th>
							<th>Received</th>
							<th>At</th>
							<th>Created</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((s) => (
							<tr key={s.id}>
								<td>
									<a href={`/projects/${id}/pos/${poId}/shipments/${s.id}`}>{s.shipmentNo}</a>
								</td>
								<td>
									<StatusBadge status={s.status} />
								</td>
								<td>{s.lineCount}</td>
								<td style={{ textAlign: 'right' }}>{Number(s.totalQty).toLocaleString()}</td>
								<td>{s.carrier ?? '—'}</td>
								<td className="muted">{s.trackingNumber ?? '—'}</td>
								<td>{s.expectedDate ? new Date(s.expectedDate).toLocaleDateString() : '—'}</td>
								<td>{s.shippedDate ? new Date(s.shippedDate).toLocaleDateString() : '—'}</td>
								<td>{s.receivedDate ? new Date(s.receivedDate).toLocaleDateString() : '—'}</td>
								<td>{s.receivedAtLocation ?? '—'}</td>
								<td>{new Date(s.createdAt).toLocaleDateString()}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</>
	);
}

function Stat({
	label,
	value,
	highlight
}: {
	label: string;
	value: string;
	highlight?: boolean;
}) {
	return (
		<div
			style={{
				padding: '8px 10px',
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
					color: highlight ? '#0a7c2f' : '#111'
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
