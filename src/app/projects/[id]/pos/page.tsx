import { db } from '@/lib/db';
import {
	purchaseOrders,
	salesOrders,
	orderLines,
	companies,
	projects
} from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import TabHelp from '@/app/components/TabHelp';

export default async function PosListPage({
	params
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const rows = await db
		.select({
			id: purchaseOrders.id,
			poNo: purchaseOrders.poNo,
			status: purchaseOrders.status,
			soNo: salesOrders.soNo,
			soId: salesOrders.id,
			repFirm: companies.name,
			trackingNumber: purchaseOrders.trackingNumber,
			orderedDate: purchaseOrders.orderedDate,
			sentAt: purchaseOrders.sentAt,
			createdAt: purchaseOrders.createdAt,
			lineCount: sql<number>`(SELECT count(*) FROM ${orderLines} WHERE ${orderLines.purchaseOrderId} = ${purchaseOrders.id})`
		})
		.from(purchaseOrders)
		.leftJoin(salesOrders, eq(purchaseOrders.salesOrderId, salesOrders.id))
		.leftJoin(companies, eq(purchaseOrders.repFirmCompanyId, companies.id))
		.where(eq(purchaseOrders.projectId, id))
		.orderBy(desc(purchaseOrders.createdAt));

	return (
		<>
			<p>
				<a href={`/projects/${project.id}`}>← {project.name}</a>
			</p>

			<h1>Purchase Orders — {project.name}</h1>

			<TabHelp tabKey="pos" title="POs — what ILC ordered from manufacturers">
				<p style={{ margin: '0 0 6px' }}>
					Each PO covers one rep firm and the lines they&apos;re sourcing for this project.
					Ebisu creates POs from a Sales Order — one PO per rep firm, all sharing the SO&apos;s
					underlying lines.
				</p>
				<ul style={{ margin: '6px 0', paddingLeft: '20px' }}>
					<li>
						To create a new PO: go to the Sales Order, click{' '}
						<strong>Create POs from SO</strong>.
					</li>
					<li>
						PO and SO lines are <em>bidirectional</em>. Edit qty / unit_dn / unit_cn /
						margin / rep quote # on either view and the other view re-renders with the same
						data.
					</li>
					<li>
						Send a PO PDF to the rep via email from the PO detail page. Tracking received
						goods happens under <strong>Shipments</strong>.
					</li>
				</ul>
			</TabHelp>

			<p className="muted">
				POs are created from Sales Orders. Go to an SO and use{' '}
				<strong>&quot;Create POs from SO&quot;</strong>.
			</p>

			{rows.length === 0 ? (
				<p className="muted">
					No purchase orders yet. Create POs from an SO via the{' '}
					<a href={`/projects/${project.id}/sos`}>Sales Orders page</a>.
				</p>
			) : (
				<table className="plain" style={{ maxWidth: '1100px' }}>
					<thead>
						<tr>
							<th>PO NO</th>
							<th>Status</th>
							<th>Rep firm</th>
							<th>SO</th>
							<th>Lines</th>
							<th>Tracking #</th>
							<th>Ordered</th>
							<th>Sent</th>
							<th>Created</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((p) => (
							<tr key={p.id}>
								<td>
									<a href={`/projects/${project.id}/pos/${p.id}`}>{p.poNo}</a>
								</td>
								<td>{p.status}</td>
								<td>{p.repFirm ?? '—'}</td>
								<td>
									{p.soNo ? <a href={`/projects/${project.id}/sos/${p.soId}`}>{p.soNo}</a> : '—'}
								</td>
								<td>{p.lineCount}</td>
								<td className="muted">{p.trackingNumber ?? '—'}</td>
								<td>{p.orderedDate ? new Date(p.orderedDate).toLocaleDateString() : '—'}</td>
								<td>{p.sentAt ? new Date(p.sentAt).toLocaleDateString() : '—'}</td>
								<td>{new Date(p.createdAt).toLocaleDateString()}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</>
	);
}
