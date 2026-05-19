import { db } from '@/lib/db';
import { salesOrders, orderLines, projects, purchaseOrders } from '@/lib/db/schema';
import { eq, desc, count, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { createSo } from './actions';
import TabHelp from '@/app/components/TabHelp';

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

			<TabHelp tabKey="sos" title="Sales Orders — what ILC has sold">
				<p style={{ margin: '0 0 6px' }}>
					A Sales Order is the contract between ILC and the client — qty + unit prices for
					the fixtures the client is buying. Lines are pulled from the QAP and snapshot at
					creation; editing them here doesn&apos;t alter the QAP.
				</p>
				<ul style={{ margin: '6px 0', paddingLeft: '20px' }}>
					<li>
						<strong>+ New Sales Order</strong> creates a draft. Open it, pick QAP lines to
						include, set qty + unit_dn.
					</li>
					<li>
						Once the SO has lines with real numbers, use <strong>Create POs from SO</strong>{' '}
						(on the SO detail) to generate one PO per rep firm.
					</li>
					<li>
						SO and PO lines are <em>bidirectional</em>: editing qty / unit price on either
						view updates the underlying line — both views render fresh data.
					</li>
				</ul>
			</TabHelp>

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
