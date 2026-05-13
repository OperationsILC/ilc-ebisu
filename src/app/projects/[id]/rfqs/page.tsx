import { db } from '@/lib/db';
import { rfqs, rfqLines, projects, companies } from '@/lib/db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { notFound } from 'next/navigation';

export default async function RfqsListPage({
	params
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const rows = await db
		.select({
			id: rfqs.id,
			rfqNo: rfqs.rfqNo,
			status: rfqs.status,
			repFirm: companies.name,
			notes: rfqs.notes,
			sentAt: rfqs.sentAt,
			createdAt: rfqs.createdAt,
			lineCount: count(rfqLines.id)
		})
		.from(rfqs)
		.leftJoin(companies, eq(rfqs.repFirmCompanyId, companies.id))
		.leftJoin(rfqLines, eq(rfqLines.rfqId, rfqs.id))
		.where(eq(rfqs.projectId, id))
		.groupBy(rfqs.id, companies.name)
		.orderBy(desc(rfqs.createdAt));

	return (
		<>
			<p>
				<a href={`/projects/${project.id}`}>← {project.name}</a>
			</p>

			<h1>RFQs — {project.name}</h1>

			<p>
				<a href={`/projects/${project.id}/rfqs/new`}>
					<button className="primary">+ New RFQ</button>
				</a>
			</p>

			{rows.length === 0 ? (
				<p className="muted">
					No RFQs yet for this project. Click <strong>+ New RFQ</strong> to compose one from
					the QAP.
				</p>
			) : (
				<table className="plain" style={{ maxWidth: '1000px' }}>
					<thead>
						<tr>
							<th>RFQ NO</th>
							<th>Rep firm</th>
							<th>Lines</th>
							<th>Status</th>
							<th>Sent</th>
							<th>Created</th>
							<th>Notes</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => (
							<tr key={r.id}>
								<td>
									<a href={`/projects/${project.id}/rfqs/${r.id}`}>{r.rfqNo}</a>
								</td>
								<td>{r.repFirm ?? '—'}</td>
								<td>{r.lineCount}</td>
								<td>{r.status}</td>
								<td>{r.sentAt ? new Date(r.sentAt).toLocaleDateString() : '—'}</td>
								<td>{new Date(r.createdAt).toLocaleDateString()}</td>
								<td className="muted" style={{ maxWidth: '300px' }}>
									{r.notes ?? ''}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</>
	);
}
