import { db } from '@/lib/db';
import {
	changeOrders,
	changeOrderLines,
	orderLines,
	purchaseOrders,
	projects,
	companies,
	users
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { alias } from 'drizzle-orm/pg-core';
import ChangeOrderDetailClient from './ChangeOrderDetailClient';

const creator = alias(users, 'creator');
const applier = alias(users, 'applier');

export default async function ChangeOrderDetailPage({
	params
}: {
	params: Promise<{ id: string; poId: string; coId: string }>;
}) {
	const { id, poId, coId } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const coRow = (
		await db
			.select({
				co: changeOrders,
				poNo: purchaseOrders.poNo,
				poStatus: purchaseOrders.status,
				poVersionNo: purchaseOrders.versionNo,
				repFirm: companies.name,
				creatorEmail: creator.email,
				applierEmail: applier.email
			})
			.from(changeOrders)
			.innerJoin(purchaseOrders, eq(changeOrders.purchaseOrderId, purchaseOrders.id))
			.leftJoin(companies, eq(purchaseOrders.repFirmCompanyId, companies.id))
			.leftJoin(creator, eq(creator.id, changeOrders.createdByUserId))
			.leftJoin(applier, eq(applier.id, changeOrders.appliedByUserId))
			.where(
				and(
					eq(changeOrders.id, coId),
					eq(changeOrders.purchaseOrderId, poId),
					eq(changeOrders.projectId, id)
				)
			)
			.limit(1)
	)[0];
	if (!coRow) notFound();
	const co = coRow.co;

	const lines = await db
		.select()
		.from(changeOrderLines)
		.where(eq(changeOrderLines.changeOrderId, coId))
		.orderBy(changeOrderLines.createdAt);

	// PO lines available to modify or remove (everything currently on the PO that
	// isn't already on this CO with a modify/remove op).
	const allPoLines = await db
		.select()
		.from(orderLines)
		.where(eq(orderLines.purchaseOrderId, poId))
		.orderBy(
			orderLines.manufacturerNameSnapshot,
			orderLines.typeNameSnapshot,
			orderLines.catalogNoSnapshot
		);

	const linesOnCo = new Set(
		lines.filter((l) => l.operation !== 'add').map((l) => l.orderLineId)
	);
	const eligiblePoLines = allPoLines.filter((p) => !linesOnCo.has(p.id));

	return (
		<ChangeOrderDetailClient
			projectId={id}
			projectName={project.name}
			poId={poId}
			poNo={coRow.poNo}
			poStatus={coRow.poStatus}
			poVersionNo={coRow.poVersionNo}
			repFirm={coRow.repFirm}
			co={{
				id: co.id,
				coNo: co.coNo,
				status: co.status,
				versionNoBefore: co.versionNoBefore,
				versionNoAfter: co.versionNoAfter,
				description: co.description,
				reason: co.reason,
				customEmailMessage: co.customEmailMessage,
				netAmountChange: co.netAmountChange,
				sentAt: co.sentAt?.toISOString() ?? null,
				acknowledgedAt: co.acknowledgedAt?.toISOString() ?? null,
				appliedAt: co.appliedAt?.toISOString() ?? null,
				rejectedAt: co.rejectedAt?.toISOString() ?? null,
				rejectedReason: co.rejectedReason,
				createdAt: co.createdAt.toISOString(),
				creatorEmail: coRow.creatorEmail,
				applierEmail: coRow.applierEmail
			}}
			lines={lines.map((l) => ({
				id: l.id,
				operation: l.operation,
				orderLineId: l.orderLineId,
				typeBefore: l.typeBefore,
				catalogNoBefore: l.catalogNoBefore,
				manufacturerBefore: l.manufacturerBefore,
				descriptionBefore: l.descriptionBefore,
				qtyBefore: l.qtyBefore,
				qtyTypeBefore: l.qtyTypeBefore,
				unitDnBefore: l.unitDnBefore,
				typeAfter: l.typeAfter,
				catalogNoAfter: l.catalogNoAfter,
				manufacturerAfter: l.manufacturerAfter,
				descriptionAfter: l.descriptionAfter,
				qtyAfter: l.qtyAfter,
				qtyTypeAfter: l.qtyTypeAfter,
				unitDnAfter: l.unitDnAfter,
				lineTotalDelta: l.lineTotalDelta,
				reasonText: l.reasonText
			}))}
			eligiblePoLines={eligiblePoLines.map((p) => ({
				id: p.id,
				type: p.typeNameSnapshot,
				catalogNo: p.catalogNoSnapshot,
				manufacturer: p.manufacturerNameSnapshot,
				description: p.descriptionSnapshot,
				qty: p.qty,
				qtyType: p.qtyType,
				unitDn: p.unitDn
			}))}
		/>
	);
}
