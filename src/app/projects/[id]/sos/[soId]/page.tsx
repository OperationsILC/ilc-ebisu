import { db } from '@/lib/db';
import {
	salesOrders,
	purchaseOrders,
	orderLines,
	qapLines,
	projects,
	companies,
	users,
	products,
	types
} from '@/lib/db/schema';
import { eq, and, notInArray, sql, count } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import SoDetailClient from './SoDetailClient';

export default async function SoDetailPage({
	params
}: {
	params: Promise<{ id: string; soId: string }>;
}) {
	const { id, soId } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const soRow = (
		await db
			.select({ so: salesOrders, pmEmail: users.email })
			.from(salesOrders)
			.leftJoin(users, eq(salesOrders.procurementMgrUserId, users.id))
			.where(and(eq(salesOrders.id, soId), eq(salesOrders.projectId, id)))
			.limit(1)
	)[0];
	if (!soRow) notFound();
	const so = soRow.so;

	// Order lines for this SO. Join PO (if assigned) for the "PO" column.
	const lines = await db
		.select({
			line: orderLines,
			poNo: purchaseOrders.poNo
		})
		.from(orderLines)
		.leftJoin(purchaseOrders, eq(orderLines.purchaseOrderId, purchaseOrders.id))
		.where(eq(orderLines.salesOrderId, soId))
		.orderBy(orderLines.manufacturerNameSnapshot, orderLines.typeNameSnapshot, orderLines.catalogNoSnapshot);

	const safeLines = lines.map((r) => ({
		id: r.line.id,
		rowVersion: Number(r.line.rowVersion),
		type: r.line.typeNameSnapshot,
		catalogNo: r.line.catalogNoSnapshot,
		manufacturer: r.line.manufacturerNameSnapshot,
		description: r.line.descriptionSnapshot,
		qty: r.line.qty,
		qtyType: r.line.qtyType,
		unitDn: r.line.unitDn,
		unitCn: r.line.unitCn,
		marginPct: r.line.marginPct,
		repQuoteNo: r.line.repQuoteNo,
		poNo: r.poNo,
		purchaseOrderId: r.line.purchaseOrderId
	}));

	// QAP lines on this project that aren't already on this SO (so we can show
	// them in the "Add lines from QAP" panel).
	const alreadyOnSo = lines
		.map((l) => l.line.qapLineId)
		.filter((x): x is string => x !== null);
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
				alreadyOnSo.length > 0 ? notInArray(qapLines.id, alreadyOnSo) : sql`true`
			)
		)
		.orderBy(companies.name, types.name, products.catalogNo);

	// Count of POs already created from this SO
	const [{ n: poCountRaw }] = await db
		.select({ n: count() })
		.from(purchaseOrders)
		.where(eq(purchaseOrders.salesOrderId, soId));

	return (
		<SoDetailClient
			projectId={project.id}
			projectName={project.name}
			projectDefaults={{
				marginPct: project.marginPct,
				freightPct: project.freightPct,
				warehousingPct: project.warehousingPct,
				salesTaxPct: project.salesTaxPct
			}}
			so={{
				id: so.id,
				soNo: so.soNo,
				status: so.status,
				description: so.description,
				notes: so.notes,
				customEmailMessage: so.customEmailMessage,
				procurementMgrEmail: soRow.pmEmail,
				marginPct: so.marginPct,
				freightPct: so.freightPct,
				warehousingPct: so.warehousingPct,
				salesTaxPct: so.salesTaxPct,
				salesTaxName: so.salesTaxName,
				additionalFreight: so.additionalFreight,
				freightOverride: so.freightOverride,
				sentAt: so.sentAt?.toISOString() ?? null,
				createdAt: so.createdAt.toISOString()
			}}
			lines={safeLines}
			availableLines={availableLines}
			poCount={Number(poCountRaw)}
		/>
	);
}
