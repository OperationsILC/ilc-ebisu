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
import { getCurrentUser } from '@/lib/dal';
import TabHelp from '@/app/components/TabHelp';
import GlobalShipQapClient, { type ShipQapGlobalRow } from './GlobalShipQapClient';

export default async function GlobalShipQapPage({
	searchParams
}: {
	searchParams: Promise<{
		project?: string;
		showHidden?: string;
		needsOnly?: string;
	}>;
}) {
	const sp = await searchParams;
	const projectFilter = (sp.project ?? '').trim();
	const showHidden = sp.showHidden === '1';
	const needsOnly = sp.needsOnly === '1';

	const me = await getCurrentUser();

	// Project filter dropdown — every project that has at least one QAP line.
	const projectOptions = await db
		.selectDistinct({ id: projects.id, name: projects.name })
		.from(qapLines)
		.innerJoin(projects, eq(qapLines.projectId, projects.id))
		.orderBy(projects.name);

	const linesQuery = db
		.select({
			id: qapLines.id,
			projectId: qapLines.projectId,
			projectName: projects.name,
			typeName: types.name,
			catalogNo: products.catalogNo,
			manufacturer: companies.name,
			qty: qapLines.qty,
			expectedShipDate: qapLines.expectedShipDate,
			expectedArrivalDate: qapLines.expectedArrivalDate,
			expectedShipNotes: qapLines.expectedShipNotes
		})
		.from(qapLines)
		.innerJoin(projects, eq(qapLines.projectId, projects.id))
		.innerJoin(types, eq(qapLines.typeId, types.id))
		.innerJoin(products, eq(qapLines.productId, products.id))
		.leftJoin(companies, eq(products.manufacturerCompanyId, companies.id));

	const lines =
		projectFilter !== ''
			? await linesQuery.where(eq(qapLines.projectId, projectFilter)).orderBy(projects.name, types.name)
			: await linesQuery.orderBy(projects.name, types.name);

	if (lines.length === 0) {
		return (
			<>
				<h1>Ship QAP — all projects</h1>
				<TabHelp tabKey="ship-qap-global" title="Cross-project shipping workspace">
					<p style={{ margin: 0 }}>
						Once projects have QAP lines, they&apos;ll appear here so you can plan and
						chase across every active project from one screen.
					</p>
				</TabHelp>
				<p className="muted">No QAP lines yet anywhere. Import a CSV on a project first.</p>
			</>
		);
	}

	const lineIds = lines.map((l) => l.id);

	const procurementRollup = await db
		.select({
			qapLineId: orderLines.qapLineId,
			qty: orderLines.qty,
			poNo: purchaseOrders.poNo
		})
		.from(orderLines)
		.innerJoin(purchaseOrders, eq(orderLines.purchaseOrderId, purchaseOrders.id))
		.where(inArray(orderLines.qapLineId, lineIds));

	const shipmentRollup = await db
		.select({
			qapLineId: orderLines.qapLineId,
			shipmentStatus: shipments.status,
			qtyShipped: shipmentLines.qtyShipped
		})
		.from(shipmentLines)
		.innerJoin(orderLines, eq(shipmentLines.orderLineId, orderLines.id))
		.innerJoin(shipments, eq(shipmentLines.shipmentId, shipments.id))
		.where(inArray(orderLines.qapLineId, lineIds));

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

	const procByLine = new Map<string, { qtyOnPo: number; poNos: string[] }>();
	for (const p of procurementRollup) {
		if (!p.qapLineId) continue;
		const cur = procByLine.get(p.qapLineId) ?? { qtyOnPo: 0, poNos: [] };
		cur.qtyOnPo += Number(p.qty ?? 0);
		if (!cur.poNos.includes(p.poNo)) cur.poNos.push(p.poNo);
		procByLine.set(p.qapLineId, cur);
	}

	const shipByLine = new Map<string, { qtyShipped: number; qtyReceived: number }>();
	for (const s of shipmentRollup) {
		if (!s.qapLineId) continue;
		const cur = shipByLine.get(s.qapLineId) ?? { qtyShipped: 0, qtyReceived: 0 };
		const qty = Number(s.qtyShipped ?? 0);
		cur.qtyShipped += qty;
		if (s.shipmentStatus === 'received') cur.qtyReceived += qty;
		shipByLine.set(s.qapLineId, cur);
	}

	const rowsAll: ShipQapGlobalRow[] = lines.map((l) => {
		const qtyNeeded = Number(l.qty ?? 0);
		const proc = procByLine.get(l.id) ?? { qtyOnPo: 0, poNos: [] };
		const ship = shipByLine.get(l.id) ?? { qtyShipped: 0, qtyReceived: 0 };
		const qtyOpen = Math.max(qtyNeeded - proc.qtyOnPo, 0);
		const fullyReceived = qtyNeeded > 0 && ship.qtyReceived >= qtyNeeded;
		return {
			id: l.id,
			projectId: l.projectId,
			projectName: l.projectName,
			typeName: l.typeName,
			catalogNo: l.catalogNo,
			manufacturer: l.manufacturer,
			qtyNeeded,
			qtyOnPo: proc.qtyOnPo,
			poNos: proc.poNos,
			qtyShipped: ship.qtyShipped,
			qtyReceived: ship.qtyReceived,
			qtyOpen,
			fullyReceived,
			expectedShipDate: l.expectedShipDate?.toISOString() ?? null,
			expectedArrivalDate: l.expectedArrivalDate?.toISOString() ?? null,
			expectedShipNotes: l.expectedShipNotes,
			hidden: hiddenSet.has(l.id)
		};
	});

	let visibleRows = showHidden ? rowsAll : rowsAll.filter((r) => !r.hidden);
	if (needsOnly) visibleRows = visibleRows.filter((r) => r.qtyOpen > 0);

	const hiddenCount = rowsAll.filter((r) => r.hidden).length;
	const needsChasing = rowsAll.filter((r) => r.qtyOpen > 0).length;
	const fullyReceived = rowsAll.filter((r) => r.fullyReceived).length;

	const num = new Intl.NumberFormat('en-US');

	return (
		<>
			<h1>Ship QAP — all projects</h1>

			<TabHelp tabKey="ship-qap-global" title="Cross-project shipping workspace">
				<p style={{ margin: '0 0 6px' }}>
					Every QAP line on every project, with PO + shipment status alongside and editable
					expected ship / arrival dates. Use this view to chase what hasn&apos;t been ordered
					across your whole project portfolio.
				</p>
				<ul style={{ margin: '6px 0', paddingLeft: '20px' }}>
					<li>
						Filter to one project, only-needs-chasing lines, or both. The cross-project view
						is great for morning triage; the per-project tab is great for focused work.
					</li>
					<li>
						Hide lines you don&apos;t want to see — your choice only, applied here AND on the
						per-project tab.
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
				<MiniTile label="QAP lines" value={num.format(rowsAll.length)} />
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

			<form
				method="get"
				style={{ display: 'flex', gap: '8px', margin: '12px 0', alignItems: 'end', flexWrap: 'wrap' }}
			>
				<label>
					Project
					<br />
					<select name="project" defaultValue={projectFilter} style={{ minWidth: '220px' }}>
						<option value="">All projects</option>
						{projectOptions.map((p) => (
							<option key={p.id} value={p.id}>
								{p.name}
							</option>
						))}
					</select>
				</label>
				<label style={{ fontSize: '12px' }}>
					<input
						type="checkbox"
						name="needsOnly"
						value="1"
						defaultChecked={needsOnly}
						style={{ marginRight: '4px' }}
					/>
					Only show &ldquo;needs chasing&rdquo; (qty open &gt; 0)
				</label>
				<label style={{ fontSize: '12px' }}>
					<input
						type="checkbox"
						name="showHidden"
						value="1"
						defaultChecked={showHidden}
						style={{ marginRight: '4px' }}
					/>
					Show rows I&apos;ve hidden
				</label>
				<button type="submit">Filter</button>
				{(projectFilter || needsOnly || showHidden) && (
					<a href="/ship-qap" className="muted" style={{ marginLeft: '8px' }}>
						Clear
					</a>
				)}
			</form>

			<p className="muted" style={{ fontSize: '12px' }}>
				Showing {visibleRows.length} row{visibleRows.length === 1 ? '' : 's'} of{' '}
				{rowsAll.length} total.
			</p>

			<GlobalShipQapClient rows={visibleRows} />
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
