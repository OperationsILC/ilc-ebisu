import { db } from '@/lib/db';
import {
	projects,
	qapLines,
	types,
	products,
	companies,
	orderLines,
	purchaseOrders,
	shipments,
	shipmentLines,
	shipQapHiddenLines
} from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/dal';
import TabHelp from '@/app/components/TabHelp';
import ShipQapClient, { type ShipQapRow } from './ShipQapClient';

export default async function ShipQapPage({
	params,
	searchParams
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ showHidden?: string }>;
}) {
	const { id } = await params;
	const sp = await searchParams;
	const showHidden = sp.showHidden === '1';

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const me = await getCurrentUser();

	// Pull every QAP line with type + product + manufacturer info.
	const lines = await db
		.select({
			id: qapLines.id,
			qapIdText: qapLines.qapIdText,
			typeName: types.name,
			catalogNo: products.catalogNo,
			manufacturer: companies.name,
			description: qapLines.description,
			productDescription: products.description,
			finish: qapLines.finish,
			qty: qapLines.qty,
			notes: qapLines.notes,
			expectedShipDate: qapLines.expectedShipDate,
			expectedArrivalDate: qapLines.expectedArrivalDate,
			expectedShipNotes: qapLines.expectedShipNotes
		})
		.from(qapLines)
		.innerJoin(types, eq(qapLines.typeId, types.id))
		.innerJoin(products, eq(qapLines.productId, products.id))
		.leftJoin(companies, eq(products.manufacturerCompanyId, companies.id))
		.where(eq(qapLines.projectId, id))
		.orderBy(types.name, products.catalogNo);

	if (lines.length === 0) {
		return (
			<>
				<p>
					<a href={`/projects/${project.id}`}>← {project.name}</a>
				</p>
				<h1>Ship QAP — {project.name}</h1>
				<TabHelp tabKey="ship-qap" title="Your personal ship-tracking workspace">
					<p style={{ margin: 0 }}>
						Once this project has QAP lines, they&apos;ll appear here with their
						procurement / shipment status alongside, plus editable expected ship &amp;
						arrival dates you can plan against.
					</p>
				</TabHelp>
				<p className="muted">No QAP lines yet for this project. Import a CSV first.</p>
			</>
		);
	}

	const lineIds = lines.map((l) => l.id);

	// Per-line procurement rollup: how many qty is on POs across all order lines
	// referencing each QAP line, plus rep firm names of POs involved.
	const procurementRollup = await db
		.select({
			qapLineId: orderLines.qapLineId,
			poId: purchaseOrders.id,
			poNo: purchaseOrders.poNo,
			poStatus: purchaseOrders.status,
			repFirm: companies.name,
			qty: orderLines.qty
		})
		.from(orderLines)
		.innerJoin(purchaseOrders, eq(orderLines.purchaseOrderId, purchaseOrders.id))
		.leftJoin(companies, eq(purchaseOrders.repFirmCompanyId, companies.id))
		.where(inArray(orderLines.qapLineId, lineIds));

	// Per-line shipment rollup: shipments + qty shipped + status, joined via
	// the order line that connects them.
	const shipmentRollup = await db
		.select({
			qapLineId: orderLines.qapLineId,
			shipmentId: shipments.id,
			shipmentNo: shipments.shipmentNo,
			shipmentStatus: shipments.status,
			expectedDate: shipments.expectedDate,
			receivedDate: shipments.receivedDate,
			qtyShipped: shipmentLines.qtyShipped
		})
		.from(shipmentLines)
		.innerJoin(orderLines, eq(shipmentLines.orderLineId, orderLines.id))
		.innerJoin(shipments, eq(shipmentLines.shipmentId, shipments.id))
		.where(inArray(orderLines.qapLineId, lineIds));

	// My personal hide list scoped to this project's lines
	const hidden = me
		? await db
				.select({ qapLineId: shipQapHiddenLines.qapLineId })
				.from(shipQapHiddenLines)
				.where(
					and(
						eq(shipQapHiddenLines.userId, me.id),
						inArray(shipQapHiddenLines.qapLineId, lineIds)
					)
				)
		: [];
	const hiddenSet = new Set(hidden.map((h) => h.qapLineId));

	// Roll up procurement + shipment data per qap_line_id.
	type ProcSummary = {
		qtyOnPo: number;
		pos: Array<{ id: string; no: string; status: string; repFirm: string | null }>;
	};
	const procByLine = new Map<string, ProcSummary>();
	for (const p of procurementRollup) {
		if (!p.qapLineId) continue;
		const cur = procByLine.get(p.qapLineId) ?? { qtyOnPo: 0, pos: [] };
		cur.qtyOnPo += Number(p.qty ?? 0);
		if (!cur.pos.find((x) => x.id === p.poId)) {
			cur.pos.push({ id: p.poId, no: p.poNo, status: p.poStatus, repFirm: p.repFirm ?? null });
		}
		procByLine.set(p.qapLineId, cur);
	}

	type ShipSummary = {
		qtyShipped: number;
		qtyReceived: number;
		shipments: Array<{
			id: string;
			no: string;
			status: string;
			expectedDate: string | null;
			receivedDate: string | null;
		}>;
	};
	const shipByLine = new Map<string, ShipSummary>();
	for (const s of shipmentRollup) {
		if (!s.qapLineId) continue;
		const cur = shipByLine.get(s.qapLineId) ?? { qtyShipped: 0, qtyReceived: 0, shipments: [] };
		const qty = Number(s.qtyShipped ?? 0);
		cur.qtyShipped += qty;
		if (s.shipmentStatus === 'received') cur.qtyReceived += qty;
		if (!cur.shipments.find((x) => x.id === s.shipmentId)) {
			cur.shipments.push({
				id: s.shipmentId,
				no: s.shipmentNo,
				status: s.shipmentStatus,
				expectedDate: s.expectedDate?.toISOString() ?? null,
				receivedDate: s.receivedDate?.toISOString() ?? null
			});
		}
		shipByLine.set(s.qapLineId, cur);
	}

	// Build final rows for the client component.
	const rowsAll: ShipQapRow[] = lines.map((l) => {
		const qtyNeeded = Number(l.qty ?? 0);
		const proc = procByLine.get(l.id) ?? { qtyOnPo: 0, pos: [] };
		const ship = shipByLine.get(l.id) ?? { qtyShipped: 0, qtyReceived: 0, shipments: [] };
		const qtyOpen = Math.max(qtyNeeded - proc.qtyOnPo, 0);
		const fullyReceived = qtyNeeded > 0 && ship.qtyReceived >= qtyNeeded;
		return {
			id: l.id,
			qapIdText: l.qapIdText,
			typeName: l.typeName,
			catalogNo: l.catalogNo,
			manufacturer: l.manufacturer,
			description: l.description ?? l.productDescription,
			finish: l.finish,
			qtyNeeded,
			notes: l.notes,
			expectedShipDate: l.expectedShipDate?.toISOString() ?? null,
			expectedArrivalDate: l.expectedArrivalDate?.toISOString() ?? null,
			expectedShipNotes: l.expectedShipNotes,
			procurement: proc,
			shipment: ship,
			qtyOpen,
			fullyReceived,
			hidden: hiddenSet.has(l.id)
		};
	});

	const visibleRows = showHidden ? rowsAll : rowsAll.filter((r) => !r.hidden);

	const totalLines = rowsAll.length;
	const hiddenCount = rowsAll.filter((r) => r.hidden).length;
	const needsChasing = rowsAll.filter((r) => r.qtyOpen > 0).length;
	const fullyReceived = rowsAll.filter((r) => r.fullyReceived).length;

	const num = new Intl.NumberFormat('en-US');

	return (
		<>
			<p>
				<a href={`/projects/${project.id}`}>← {project.name}</a>
			</p>

			<h1>Ship QAP — {project.name}</h1>

			<TabHelp tabKey="ship-qap" title="Your personal ship-tracking workspace">
				<p style={{ margin: '0 0 6px' }}>
					Every QAP line on this project, with its procurement and shipment status alongside,
					plus editable <strong>expected ship</strong> and <strong>expected arrival</strong>{' '}
					dates you can plan against — even before a PO exists.
				</p>
				<ul style={{ margin: '6px 0', paddingLeft: '20px' }}>
					<li>
						Red rows are <strong>not fully ordered yet</strong> (qty on POs &lt; qty needed).
						Green rows are <strong>fully received</strong>.
					</li>
					<li>
						<strong>Hide</strong> any row to remove it from your view — your choice only,
						doesn&apos;t affect anyone else, doesn&apos;t touch the underlying data.
					</li>
					<li>
						Edits to expected dates / notes save immediately and write to the underlying QAP
						row, so they&apos;re authoritative across Ebisu.
					</li>
					<li>
						When real shipments arrive, their status shows alongside your &quot;what I
						expected&quot; — useful for retrospective: planned vs actual.
					</li>
				</ul>
			</TabHelp>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
					gap: '8px',
					maxWidth: '900px',
					margin: '12px 0'
				}}
			>
				<MiniTile label="QAP lines" value={num.format(totalLines)} />
				<MiniTile
					label="Needs chasing"
					value={num.format(needsChasing)}
					tone={needsChasing > 0 ? 'warn' : undefined}
				/>
				<MiniTile
					label="Fully received"
					value={num.format(fullyReceived)}
					tone={fullyReceived > 0 ? 'good' : undefined}
				/>
				<MiniTile
					label="Hidden by me"
					value={num.format(hiddenCount)}
					tone={hiddenCount > 0 ? 'muted' : undefined}
				/>
			</div>

			<p style={{ marginBottom: '12px', fontSize: '13px' }}>
				{showHidden ? (
					<>
						Showing all rows including {hiddenCount} hidden.{' '}
						<a href={`/projects/${project.id}/ship-qap`}>Hide them again</a>
					</>
				) : hiddenCount > 0 ? (
					<>
						{hiddenCount} row{hiddenCount === 1 ? '' : 's'} hidden by you.{' '}
						<a href={`/projects/${project.id}/ship-qap?showHidden=1`}>Show all</a>
					</>
				) : (
					<span className="muted">No rows hidden.</span>
				)}
			</p>

			<ShipQapClient projectId={project.id} rows={visibleRows} />
		</>
	);
}

function MiniTile({
	label,
	value,
	tone
}: {
	label: string;
	value: string;
	tone?: 'good' | 'warn' | 'muted';
}) {
	const colors: Record<string, { bg: string; fg: string; border: string }> = {
		good: { bg: '#e8f5e9', fg: '#155724', border: '#a3d4af' },
		warn: { bg: '#fff3cd', fg: '#7a5d00', border: '#f0d878' },
		muted: { bg: '#f5f5f5', fg: '#666', border: '#ddd' }
	};
	const c = tone ? colors[tone] : { bg: '#fff', fg: '#111', border: '#ddd' };
	return (
		<div
			style={{
				padding: '8px 10px',
				background: c.bg,
				border: `1px solid ${c.border}`,
				borderRadius: '4px'
			}}
		>
			<div className="muted" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
				{label}
			</div>
			<div style={{ fontSize: '18px', fontWeight: 600, color: c.fg }}>{value}</div>
		</div>
	);
}
