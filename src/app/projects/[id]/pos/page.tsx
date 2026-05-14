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
