import { db } from '@/lib/db';
import {
	rfqs,
	rfqLines,
	projects,
	companies,
	users
} from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { eq, and } from 'drizzle-orm';
import { renderRfqPdf } from '@/lib/pdf/render';
import { type RfqPdfData } from '@/lib/pdf/rfq';
import { NextResponse } from 'next/server';

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string; rfqId: string }> }
) {
	const me = await requireUser();
	const { id, rfqId } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) return new NextResponse('Project not found', { status: 404 });

	const rfqRow = (
		await db
			.select({
				rfq: rfqs,
				repFirm: companies.name,
				repFirmQuoteEmails: companies.quoteEmails,
				pmName: users.name,
				pmEmail: users.email
			})
			.from(rfqs)
			.leftJoin(companies, eq(rfqs.repFirmCompanyId, companies.id))
			.leftJoin(users, eq(rfqs.createdByUserId, users.id))
			.where(and(eq(rfqs.id, rfqId), eq(rfqs.projectId, id)))
			.limit(1)
	)[0];
	if (!rfqRow) return new NextResponse('RFQ not found', { status: 404 });

	const lines = await db
		.select()
		.from(rfqLines)
		.where(eq(rfqLines.rfqId, rfqId))
		.orderBy(
			rfqLines.manufacturerNameSnapshot,
			rfqLines.typeNameSnapshot,
			rfqLines.catalogNoSnapshot
		);

	const data: RfqPdfData = {
		rfqNo: rfqRow.rfq.rfqNo,
		status: rfqRow.rfq.status,
		createdAt: rfqRow.rfq.createdAt.toISOString(),
		sentAt: rfqRow.rfq.sentAt?.toISOString() ?? null,
		notes: rfqRow.rfq.notes,
		projectName: project.name,
		repFirm: rfqRow.repFirm,
		repFirmQuoteEmails: rfqRow.repFirmQuoteEmails,
		pmName: rfqRow.pmName ?? me.name ?? null,
		pmEmail: rfqRow.pmEmail ?? me.email,
		lines: lines.map((l) => ({
			type: l.typeNameSnapshot,
			catalogNo: l.catalogNoSnapshot,
			manufacturer: l.manufacturerNameSnapshot,
			description: l.descriptionSnapshot,
			qty: l.qtySnapshot,
			qtyType: l.qtyType
		}))
	};

	const buffer = await renderRfqPdf(data);

	return new NextResponse(buffer as unknown as BodyInit, {
		status: 200,
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="${rfqRow.rfq.rfqNo}.pdf"`,
			'Cache-Control': 'private, no-cache'
		}
	});
}
