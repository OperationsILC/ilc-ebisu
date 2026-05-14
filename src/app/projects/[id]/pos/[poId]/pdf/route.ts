import { db } from '@/lib/db';
import {
	purchaseOrders,
	salesOrders,
	orderLines,
	projects,
	companies
} from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { eq, and } from 'drizzle-orm';
import { renderPoPdf } from '@/lib/pdf/render';
import { type PoPdfData } from '@/lib/pdf/po';
import { NextResponse } from 'next/server';

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string; poId: string }> }
) {
	await requireUser();
	const { id, poId } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) return new NextResponse('Project not found', { status: 404 });

	const poRow = (
		await db
			.select({
				po: purchaseOrders,
				repFirm: companies.name,
				repFirmOrderEmails: companies.orderEmails,
				soNo: salesOrders.soNo
			})
			.from(purchaseOrders)
			.leftJoin(companies, eq(purchaseOrders.repFirmCompanyId, companies.id))
			.leftJoin(salesOrders, eq(purchaseOrders.salesOrderId, salesOrders.id))
			.where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.projectId, id)))
			.limit(1)
	)[0];
	if (!poRow) return new NextResponse('PO not found', { status: 404 });

	const lines = await db
		.select()
		.from(orderLines)
		.where(eq(orderLines.purchaseOrderId, poId))
		.orderBy(
			orderLines.manufacturerNameSnapshot,
			orderLines.typeNameSnapshot,
			orderLines.catalogNoSnapshot
		);

	const deliveryAddress = [
		project.deliveryStreet,
		[project.deliveryCity, project.deliveryState, project.deliveryZip]
			.filter(Boolean)
			.join(' ')
	]
		.filter((s) => s && s.trim() !== '')
		.join('\n');

	const data: PoPdfData = {
		poNo: poRow.po.poNo,
		status: poRow.po.status,
		versionNo: poRow.po.versionNo,
		orderedDate: poRow.po.orderedDate?.toISOString() ?? null,
		sentAt: poRow.po.sentAt?.toISOString() ?? null,
		createdAt: poRow.po.createdAt.toISOString(),
		description: poRow.po.description,
		notes: poRow.po.notes,
		customEmailMessage: poRow.po.customEmailMessage,
		addedFreight: poRow.po.addedFreight,
		repQuoteNo: poRow.po.repQuoteNo,
		trackingNumber: poRow.po.trackingNumber,
		shipToText: poRow.po.shipToText,
		ilcOfficeAddress: poRow.po.ilcOfficeAddress,
		sendFromEmail: poRow.po.sendFromEmail,
		sendToEmail: poRow.po.sendToEmail,
		projectName: project.name,
		soNo: poRow.soNo,
		repFirm: poRow.repFirm,
		repFirmOrderEmails: poRow.repFirmOrderEmails,
		deliveryAddress: deliveryAddress || null,
		lines: lines.map((l) => ({
			type: l.typeNameSnapshot,
			catalogNo: l.catalogNoSnapshot,
			manufacturer: l.manufacturerNameSnapshot,
			description: l.descriptionSnapshot,
			qty: l.qty,
			qtyType: l.qtyType,
			unitDn: l.unitDn,
			repQuoteNo: l.repQuoteNo
		}))
	};

	const buffer = await renderPoPdf(data);

	return new NextResponse(buffer as unknown as BodyInit, {
		status: 200,
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="${poRow.po.poNo}.pdf"`,
			'Cache-Control': 'private, no-cache'
		}
	});
}
