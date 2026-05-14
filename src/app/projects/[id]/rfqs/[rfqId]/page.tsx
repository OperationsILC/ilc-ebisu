import { db } from '@/lib/db';
import { rfqs, rfqLines, projects, companies, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import RfqDetailClient from './RfqDetailClient';

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

	const lines = await db
		.select()
		.from(rfqLines)
		.where(eq(rfqLines.rfqId, rfqId))
		.orderBy(rfqLines.manufacturerNameSnapshot, rfqLines.typeNameSnapshot, rfqLines.catalogNoSnapshot);

	// Serialize Dates and numerics to JSON-safe shape for the client component.
	const safeLines = lines.map((l) => ({
		id: l.id,
		qapLineId: l.qapLineId,
		qtySnapshot: l.qtySnapshot,
		typeNameSnapshot: l.typeNameSnapshot,
		catalogNoSnapshot: l.catalogNoSnapshot,
		manufacturerNameSnapshot: l.manufacturerNameSnapshot,
		descriptionSnapshot: l.descriptionSnapshot,
		quotedDn: l.quotedDn,
		quoteReceivedAt: l.quoteReceivedAt?.toISOString() ?? null,
		appliedToQapAt: l.appliedToQapAt?.toISOString() ?? null
	}));

	const r = rfqRow.rfq;
	return (
		<RfqDetailClient
			projectId={project.id}
			projectName={project.name}
			rfq={{
				id: r.id,
				rfqNo: r.rfqNo,
				status: r.status,
				notes: r.notes,
				sentAt: r.sentAt?.toISOString() ?? null,
				createdAt: r.createdAt.toISOString(),
				repFirm: rfqRow.repFirm,
				creatorEmail: rfqRow.creatorEmail
			}}
			lines={safeLines}
		/>
	);
}
