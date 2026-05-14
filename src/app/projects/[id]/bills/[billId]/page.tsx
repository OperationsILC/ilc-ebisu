import { db } from '@/lib/db';
import {
	bills,
	billLines,
	purchaseOrders,
	orderLines,
	projects,
	companies,
	users
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import BillDetailClient from './BillDetailClient';

export default async function BillDetailPage({
	params
}: {
	params: Promise<{ id: string; billId: string }>;
}) {
	const { id, billId } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const row = (
		await db
			.select({
				bill: bills,
				vendor: companies.name,
				poNo: purchaseOrders.poNo,
				poStatus: purchaseOrders.status,
				approver: users.email
			})
			.from(bills)
			.leftJoin(companies, eq(bills.vendorCompanyId, companies.id))
			.leftJoin(purchaseOrders, eq(bills.purchaseOrderId, purchaseOrders.id))
			.leftJoin(users, eq(users.id, bills.approvedByUserId))
			.where(and(eq(bills.id, billId), eq(bills.projectId, id)))
			.limit(1)
	)[0];
	if (!row) notFound();
	const bill = row.bill;

	const lines = await db
		.select()
		.from(billLines)
		.where(eq(billLines.billId, billId))
		.orderBy(billLines.createdAt);

	// PO line context for matching: load all order lines on the matched PO
	// (if any) so PMs can see what was ordered alongside what was billed.
	const poLines = bill.purchaseOrderId
		? await db
				.select({
					id: orderLines.id,
					type: orderLines.typeNameSnapshot,
					catalogNo: orderLines.catalogNoSnapshot,
					manufacturer: orderLines.manufacturerNameSnapshot,
					description: orderLines.descriptionSnapshot,
					qty: orderLines.qty,
					unitDn: orderLines.unitDn
				})
				.from(orderLines)
				.where(eq(orderLines.purchaseOrderId, bill.purchaseOrderId))
				.orderBy(orderLines.manufacturerNameSnapshot, orderLines.catalogNoSnapshot)
		: [];

	// Sum bill lines for at-a-glance total vs header total reconciliation
	const [linesTotal] = await db
		.select({
			total: sql<string>`coalesce(sum(${billLines.lineTotal}), 0)`,
			count: sql<number>`count(*)::int`
		})
		.from(billLines)
		.where(eq(billLines.billId, billId));

	return (
		<BillDetailClient
			projectId={project.id}
			projectName={project.name}
			bill={{
				id: bill.id,
				billNo: bill.billNo,
				vendorBillNo: bill.vendorBillNo,
				status: bill.status,
				billDate: bill.billDate?.toISOString() ?? null,
				dueDate: bill.dueDate?.toISOString() ?? null,
				totalAmount: bill.totalAmount,
				paidAmount: bill.paidAmount,
				notes: bill.notes,
				sourcePdfUrl: bill.sourcePdfUrl,
				sourceParsedJson: bill.sourceParsedJson as Record<string, unknown> | null,
				approvedAt: bill.approvedAt?.toISOString() ?? null,
				rejectedAt: bill.rejectedAt?.toISOString() ?? null,
				rejectedReason: bill.rejectedReason,
				qboStatus: bill.qboStatus,
				createdAt: bill.createdAt.toISOString(),
				vendor: row.vendor,
				poId: bill.purchaseOrderId,
				poNo: row.poNo,
				poStatus: row.poStatus,
				approverEmail: row.approver
			}}
			lines={lines.map((l) => ({
				id: l.id,
				orderLineId: l.orderLineId,
				descriptionText: l.descriptionText,
				catalogNoText: l.catalogNoText,
				qty: l.qty,
				unitPrice: l.unitPrice,
				lineTotal: l.lineTotal,
				notes: l.notes
			}))}
			poLines={poLines.map((p) => ({
				id: p.id,
				type: p.type,
				catalogNo: p.catalogNo,
				manufacturer: p.manufacturer,
				description: p.description,
				qty: p.qty,
				unitDn: p.unitDn
			}))}
			linesTotal={Number(linesTotal?.total ?? 0)}
			linesCount={Number(linesTotal?.count ?? 0)}
		/>
	);
}
