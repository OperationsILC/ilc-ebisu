import { db } from '@/lib/db';
import { rfqs, rfqLines, projects, companies, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';

export default async function RfqDetailPage({
	params
}: {
	params: Promise<{ id: string; rfqId: string }>;
}) {
	const { id, rfqId } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const rfqRow = (
		await db
			.select({
				rfq: rfqs,
				repFirm: companies.name,
				creatorEmail: users.email
			})
			.from(rfqs)
			.leftJoin(companies, eq(rfqs.repFirmCompanyId, companies.id))
			.leftJoin(users, eq(rfqs.createdByUserId, users.id))
			.where(and(eq(rfqs.id, rfqId), eq(rfqs.projectId, id)))
			.limit(1)
	)[0];
	if (!rfqRow) notFound();
	const r = rfqRow.rfq;

	const lines = await db
		.select()
		.from(rfqLines)
		.where(eq(rfqLines.rfqId, rfqId))
		.orderBy(rfqLines.manufacturerNameSnapshot, rfqLines.typeNameSnapshot, rfqLines.catalogNoSnapshot);

	const totalQty = lines.reduce((s, l) => s + Number(l.qtySnapshot ?? 0), 0);
	const quotedTotal = lines.reduce(
		(s, l) => s + Number(l.quotedDn ?? 0) * Number(l.qtySnapshot ?? 0),
		0
	);
	const lineCountWithQuotes = lines.filter((l) => l.quotedDn !== null).length;

	return (
		<>
			<p>
				<a href={`/projects/${project.id}/rfqs`}>← RFQs for {project.name}</a>
			</p>

			<h1>{r.rfqNo}</h1>
			<p className="muted">
				{r.status} · {project.name} · to <strong>{rfqRow.repFirm ?? '(no rep firm)'}</strong>
			</p>

			<table className="plain" style={{ maxWidth: '720px', marginBottom: '20px' }}>
				<tbody>
					<tr>
						<th>RFQ NO</th>
						<td>{r.rfqNo}</td>
					</tr>
					<tr>
						<th>Rep firm</th>
						<td>{rfqRow.repFirm ?? '—'}</td>
					</tr>
					<tr>
						<th>Status</th>
						<td>{r.status}</td>
					</tr>
					<tr>
						<th>Notes</th>
						<td>{r.notes ?? '—'}</td>
					</tr>
					<tr>
						<th>Created</th>
						<td>
							{new Date(r.createdAt).toLocaleString()} by {rfqRow.creatorEmail ?? '—'}
						</td>
					</tr>
					<tr>
						<th>Sent</th>
						<td>{r.sentAt ? new Date(r.sentAt).toLocaleString() : '—'}</td>
					</tr>
				</tbody>
			</table>

			<h2>Lines ({lines.length})</h2>
			<p className="muted">
				Total QTY: {totalQty} · Quotes received: {lineCountWithQuotes} of {lines.length}
				{quotedTotal > 0 && <> · Quoted total: ${quotedTotal.toLocaleString()}</>}
			</p>

			<table className="plain" style={{ fontSize: '12px' }}>
				<thead>
					<tr>
						<th>TYPE</th>
						<th>CATALOG #</th>
						<th>MANUFACTURER</th>
						<th style={{ textAlign: 'right' }}>QTY</th>
						<th style={{ textAlign: 'right' }}>QUOTED DN</th>
						<th>Description</th>
					</tr>
				</thead>
				<tbody>
					{lines.map((l) => (
						<tr key={l.id}>
							<td>{l.typeNameSnapshot}</td>
							<td>{l.catalogNoSnapshot}</td>
							<td>{l.manufacturerNameSnapshot ?? '—'}</td>
							<td style={{ textAlign: 'right' }}>{l.qtySnapshot ?? '—'}</td>
							<td style={{ textAlign: 'right' }}>{l.quotedDn ?? '—'}</td>
							<td className="muted" style={{ maxWidth: '320px' }}>
								{l.descriptionSnapshot ?? ''}
							</td>
						</tr>
					))}
				</tbody>
			</table>

			<p className="muted" style={{ marginTop: '24px' }}>
				Quote-receiving, status transitions (sent → quoted → accepted), PDF generation, and email
				send are next steps. For Phase 2 starter, RFQs live as drafts in the system.
			</p>
		</>
	);
}
