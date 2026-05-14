import { db } from '@/lib/db';
import {
	purchaseOrders,
	salesOrders,
	orderLines,
	projects,
	companies,
	users
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import PoDetailClient from './PoDetailClient';

export default async function PoDetailPage({
	params
}: {
	params: Promise<{ id: string; poId: string }>;
}) {
	const { id, poId } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const poRow = (
		await db
			.select({
				po: purchaseOrders,
				repFirm: companies.name,
				repFirmQuoteEmails: companies.quoteEmails,
				repFirmOrderEmails: companies.orderEmails,
				creatorEmail: users.email,
				soNo: salesOrders.soNo,
				soId: salesOrders.id
			})
			.from(purchaseOrders)
			.leftJoin(companies, eq(purchaseOrders.repFirmCompanyId, companies.id))
			.leftJoin(users, eq(purchaseOrders.createdByUserId, users.id))
			.leftJoin(salesOrders, eq(purchaseOrders.salesOrderId, salesOrders.id))
			.where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.projectId, id)))
			.limit(1)
	)[0];
	if (!poRow) notFound();
	const po = poRow.po;

	const lines = await db
		.select()
		.from(orderLines)
		.where(eq(orderLines.purchaseOrderId, poId))
		.orderBy(orderLines.manufacturerNameSnapshot, orderLines.typeNameSnapshot, orderLines.catalogNoSnapshot);

	const safeLines = lines.map((l) => ({
		id: l.id,
		rowVersion: Number(l.rowVersion),
		type: l.typeNameSnapshot,
		catalogNo: l.catalogNoSnapshot,
		manufacturer: l.manufacturerNameSnapshot,
		description: l.descriptionSnapshot,
		qty: l.qty,
		qtyType: l.qtyType,
		unitDn: l.unitDn,
		unitCn: l.unitCn,
		marginPct: l.marginPct,
		repQuoteNo: l.repQuoteNo
	}));

	return (
		<PoDetailClient
			projectId={project.id}
			projectName={project.name}
			po={{
				id: po.id,
				poNo: po.poNo,
				status: po.status,
				description: po.description,
				notes: po.notes,
				internalNotes: po.internalNotes,
				customEmailMessage: po.customEmailMessage,
				addedFreight: po.addedFreight,
				repQuoteNo: po.repQuoteNo,
				trackingNumber: po.trackingNumber,
				orderedDate: po.orderedDate?.toISOString() ?? null,
				acknowledgedAt: po.acknowledgedAt?.toISOString() ?? null,
				shipToText: po.shipToText,
				ilcOfficeAddress: po.ilcOfficeAddress,
				sendFromEmail: po.sendFromEmail,
				sendToEmail: po.sendToEmail,
				sentAt: po.sentAt?.toISOString() ?? null,
				versionNo: po.versionNo,
				createdAt: po.createdAt.toISOString(),
				repFirm: poRow.repFirm,
				repFirmQuoteEmails: poRow.repFirmQuoteEmails,
				repFirmOrderEmails: poRow.repFirmOrderEmails,
				creatorEmail: poRow.creatorEmail,
				soNo: poRow.soNo,
				soId: poRow.soId
			}}
			lines={safeLines}
		/>
	);
}
