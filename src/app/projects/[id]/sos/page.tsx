import { db } from '@/lib/db';
import { salesOrders, orderLines, projects, purchaseOrders } from '@/lib/db/schema';
import { eq, desc, count, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { createSo } from './actions';

export default async function SosListPage({
	params
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const rows = await db
		.select({
			id: salesOrders.id,
			soNo: salesOrders.soNo,
			status: salesOrders.status,
			description: salesOrders.description,
			createdAt: salesOrders.createdAt,
			sentAt: salesOrders.sentAt,
			lineCount: sql<number>`(SELECT count(*) FROM ${orderLines} WHERE ${orderLines.salesOrderId} = ${salesOrders.id})`,
			poCount: sql<number>`(SELECT count(DISTINCT ${orderLines.purchaseOrderId}) FROM ${orderLines} WHERE ${orderLines.salesOrderId} = ${salesOrders.id} AND ${orderLines.purchaseOrderId} IS NOT NULL)`
		})
		.from(salesOrders)
		.where(eq(salesOrders.projectId, id))
		.orderBy(desc(salesOrders.createdAt));

	const createSoAction = createSo.bind(null, project.id);

	return (
		<>
			<p>
				<a href={`/projects/${project.id}`}>← {project.name}</a>
			</p>

			<h1>Sales Orders — {project.name}</h1>

			<form action={createSoAction} style={{ margin: '16px 0' }}>
				<button className="primary" type="submit">
					+ New Sales Order
				</button>
			</form>

			{rows.length === 0 ? (
				<p className="muted">
					No sales orders yet for this project. Click <strong>+ New Sales Order</strong> above
					to create one.
				</p>
			) : (
				<table className="plain" style={{ maxWidth: '1000px' }}>
					<thead>
						<tr>
							<th>SO NO</th>
							<th>Status</th>
							<th>Lines</th>
							<th>POs</th>
							<th>Created</th>
							<th>Sent</th>
							<th>Description</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((s) => (
							<tr key={s.id}>
								<td>
									<a href={`/projects/${project.id}/sos/${s.id}`}>{s.soNo}</a>
								</td>
								<td>{s.status}</td>
								<td>{s.lineCount}</td>
								<td>{s.poCount}</td>
								<td>{new Date(s.createdAt).toLocaleDateString()}</td>
								<td>{s.sentAt ? new Date(s.sentAt).toLocaleDateString() : '—'}</td>
								<td className="muted" style={{ maxWidth: '300px' }}>
									{s.description ?? ''}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</>
	);
}
