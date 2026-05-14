import { db } from '@/lib/db';
import {
	rfqs,
	rfqLines,
	projects,
	companies,
	users,
	qapLines,
	products,
	types
} from '@/lib/db/schema';
import { eq, and, notInArray, sql } from 'drizzle-orm';
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
		qtyType: l.qtyType,
		typeNameSnapshot: l.typeNameSnapshot,
		catalogNoSnapshot: l.catalogNoSnapshot,
		manufacturerNameSnapshot: l.manufacturerNameSnapshot,
		descriptionSnapshot: l.descriptionSnapshot,
		quotedDn: l.quotedDn,
		quoteReceivedAt: l.quoteReceivedAt?.toISOString() ?? null,
		appliedToQapAt: l.appliedToQapAt?.toISOString() ?? null
	}));

	// QAP lines on this project that are NOT yet on this RFQ — the "add more"
	// pool. Exclude any qap_line already attached to this RFQ.
	const alreadyOnRfq = lines.map((l) => l.qapLineId).filter((x): x is string => x !== null);
	const availableLines = await db
		.select({
			id: qapLines.id,
			type: types.name,
			catalogNo: products.catalogNo,
			manufacturer: companies.name,
			qty: qapLines.qty,
			currentDn: qapLines.currentDn,
			description: qapLines.description
		})
		.from(qapLines)
		.innerJoin(types, eq(qapLines.typeId, types.id))
		.innerJoin(products, eq(qapLines.productId, products.id))
		.leftJoin(companies, eq(products.manufacturerCompanyId, companies.id))
		.where(
			and(
				eq(qapLines.projectId, id),
				alreadyOnRfq.length > 0
					? notInArray(qapLines.id, alreadyOnRfq)
					: sql`true`
			)
		)
		.orderBy(companies.name, types.name, products.catalogNo);

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
			availableLines={availableLines}
		/>
	);
}
