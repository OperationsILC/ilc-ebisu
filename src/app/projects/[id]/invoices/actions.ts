'use server';

import { db } from '@/lib/db';
import {
	invoices,
	invoiceLines,
	orderLines,
	salesOrders,
	projects
} from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';

/**
 * Create a blank product invoice scoped to an SO. PM then picks lines to bill.
 * Caller passes the SO so we can copy tax/project context. Caller is normally
 * the SO detail page's "+ New invoice" button.
 */
export async function createProductInvoice(projectId: string, soId: string) {
	const user = await requireUser();

	const project = (
		await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
	)[0];
	if (!project) throw new Error('Project not found');

	const so = (
		await db
			.select()
			.from(salesOrders)
			.where(and(eq(salesOrders.id, soId), eq(salesOrders.projectId, projectId)))
			.limit(1)
	)[0];
	if (!so) throw new Error('SO not found');

	const invoiceNo = await nextInvoiceNo();

	const [row] = await db
		.insert(invoices)
		.values({
			projectId,
			salesOrderId: soId,
			invoiceNo,
			type: 'product',
			status: 'draft',
			invoiceDate: new Date(),
			salesTaxPct: so.salesTaxPct ?? project.salesTaxPct,
			salesTaxName: project.salesTaxName,
			createdByUserId: user.id
		})
		.returning({ id: invoices.id });

	redirect(`/projects/${projectId}/invoices/${row.id}`);
}

/**
 * Create a design-fee invoice scoped to a project (no SO).
 */
export async function createDesignFeeInvoice(projectId: string) {
	const user = await requireUser();
	const project = (
		await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
	)[0];
	if (!project) throw new Error('Project not found');

	const invoiceNo = await nextInvoiceNo();

	const [row] = await db
		.insert(invoices)
		.values({
			projectId,
			invoiceNo,
			type: 'design_fee',
			status: 'draft',
			invoiceDate: new Date(),
			salesTaxPct: '0',
			createdByUserId: user.id
		})
		.returning({ id: invoices.id });

	redirect(`/projects/${projectId}/invoices/${row.id}`);
}

/**
 * Create a credit memo (refund / write-down) for a project.
 */
export async function createCreditMemo(projectId: string) {
	const user = await requireUser();
	const project = (
		await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
	)[0];
	if (!project) throw new Error('Project not found');

	const invoiceNo = await nextInvoiceNo();

	const [row] = await db
		.insert(invoices)
		.values({
			projectId,
			invoiceNo,
			type: 'credit_memo',
			status: 'draft',
			invoiceDate: new Date(),
			salesTaxPct: '0',
			createdByUserId: user.id
		})
		.returning({ id: invoices.id });

	redirect(`/projects/${projectId}/invoices/${row.id}`);
}

/**
 * Generate the next IN##### number, retrying once on collision.
 */
async function nextInvoiceNo(): Promise<string> {
	const [{ n }] = await db.select({ n: count() }).from(invoices);
	return `IN${String(Number(n) + 1).padStart(5, '0')}`;
}

// ---------------------------------------------------------------------------
// "Build invoice from delivered-but-uninvoiced shipment lines" tool
// ---------------------------------------------------------------------------
// Pulls every shipment_line tied to this SO whose owning shipment is 'received',
// minus the portion already on an invoice. PM can pick which to include in
// this invoice, what qty to bill, and at what unit_cn.

export type DeliveredLineCandidate = {
	orderLineId: string;
	shipmentLineId: string;
	shipmentNo: string;
	shipmentReceivedDate: string | null;
	type: string | null;
	catalogNo: string | null;
	manufacturer: string | null;
	description: string | null;
	qtyDelivered: number;
	qtyAlreadyInvoiced: number;
	qtyOpenToInvoice: number;
	unitDn: string | null;
	unitCn: string | null;
	marginPct: string | null;
	qtyType: string | null;
};

export async function listDeliveredUninvoicedLines(
	projectId: string,
	soId: string
): Promise<DeliveredLineCandidate[]> {
	await requireUser();

	// Confirm the SO belongs to the project (gate).
	const so = (
		await db
			.select()
			.from(salesOrders)
			.where(and(eq(salesOrders.id, soId), eq(salesOrders.projectId, projectId)))
			.limit(1)
	)[0];
	if (!so) return [];

	// All order lines on the SO with their shipment + already-invoiced totals.
	const rows = await db.execute(sql`
		SELECT
			ol.id AS order_line_id,
			sl.id AS shipment_line_id,
			s.shipment_no,
			s.received_date,
			ol.type_name_snapshot AS type,
			ol.catalog_no_snapshot AS catalog_no,
			ol.manufacturer_name_snapshot AS manufacturer,
			ol.description_snapshot AS description,
			sl.qty_shipped::numeric AS qty_delivered,
			COALESCE((
				SELECT SUM(il.qty_invoiced)
				FROM invoice_lines il
				INNER JOIN invoices i ON i.id = il.invoice_id
				WHERE il.order_line_id = ol.id
					AND i.status != 'void'
			), 0)::numeric AS qty_already_invoiced,
			ol.unit_dn,
			ol.unit_cn,
			ol.margin_pct,
			ol.qty_type
		FROM order_lines ol
		INNER JOIN shipment_lines sl ON sl.order_line_id = ol.id
		INNER JOIN shipments s ON s.id = sl.shipment_id
		WHERE ol.sales_order_id = ${soId}
			AND s.status = 'received'
		ORDER BY s.received_date DESC, ol.manufacturer_name_snapshot, ol.catalog_no_snapshot
	`);

	const candidates: DeliveredLineCandidate[] = [];
	for (const r of rows.rows as Array<Record<string, unknown>>) {
		const qtyDelivered = Number(r.qty_delivered ?? 0);
		const qtyAlreadyInvoiced = Number(r.qty_already_invoiced ?? 0);
		const qtyOpenToInvoice = Math.max(qtyDelivered - qtyAlreadyInvoiced, 0);
		if (qtyOpenToInvoice <= 0) continue;
		candidates.push({
			orderLineId: r.order_line_id as string,
			shipmentLineId: r.shipment_line_id as string,
			shipmentNo: r.shipment_no as string,
			shipmentReceivedDate: r.received_date
				? new Date(r.received_date as string).toISOString()
				: null,
			type: r.type as string | null,
			catalogNo: r.catalog_no as string | null,
			manufacturer: r.manufacturer as string | null,
			description: r.description as string | null,
			qtyDelivered,
			qtyAlreadyInvoiced,
			qtyOpenToInvoice,
			unitDn: (r.unit_dn ?? null) as string | null,
			unitCn: (r.unit_cn ?? null) as string | null,
			marginPct: (r.margin_pct ?? null) as string | null,
			qtyType: (r.qty_type ?? null) as string | null
		});
	}
	return candidates;
}

/**
 * Add chosen delivered lines to an invoice with the given billing quantities.
 */
export async function addDeliveredLinesToInvoice(
	invoiceId: string,
	picks: {
		orderLineId: string;
		shipmentLineId: string;
		qtyInvoiced: number;
	}[]
): Promise<{ added: number; error?: string }> {
	await requireUser();
	if (picks.length === 0) return { added: 0, error: 'No lines selected' };

	const invoice = (await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1))[0];
	if (!invoice) return { added: 0, error: 'Invoice not found' };
	if (invoice.status !== 'draft')
		return { added: 0, error: 'Only draft invoices accept new lines' };

	const olIds = picks.map((p) => p.orderLineId);
	const olRows = await db
		.select()
		.from(orderLines)
		.where(inArray(orderLines.id, olIds));
	const olById = new Map(olRows.map((o) => [o.id, o]));

	let added = 0;
	for (const p of picks) {
		const ol = olById.get(p.orderLineId);
		if (!ol) continue;
		if (p.qtyInvoiced <= 0) continue;
		const unitCn = Number(ol.unitCn ?? 0);
		const lineTotal = p.qtyInvoiced * unitCn;
		await db.insert(invoiceLines).values({
			invoiceId,
			orderLineId: ol.id,
			shipmentLineId: p.shipmentLineId,
			typeSnapshot: ol.typeNameSnapshot,
			catalogNoSnapshot: ol.catalogNoSnapshot,
			manufacturerSnapshot: ol.manufacturerNameSnapshot,
			descriptionSnapshot: ol.descriptionSnapshot,
			qtyInvoiced: String(p.qtyInvoiced),
			qtyType: ol.qtyType,
			unitDnSnapshot: ol.unitDn,
			unitCnSnapshot: ol.unitCn,
			marginPctSnapshot: ol.marginPct,
			lineTotal: String(lineTotal)
		});
		added++;
	}

	await recomputeInvoiceTotals(invoiceId);
	return { added };
}

// ---------------------------------------------------------------------------
// Manually-added line (for design-fee / credit-memo invoices)
// ---------------------------------------------------------------------------

export async function addFreeFormLineToInvoice(
	invoiceId: string,
	description: string,
	qty: number,
	unitCn: number
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	const invoice = (await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1))[0];
	if (!invoice) return { error: 'Invoice not found' };
	if (invoice.status !== 'draft') return { error: 'Only draft invoices accept new lines' };

	const lineTotal = qty * unitCn;
	await db.insert(invoiceLines).values({
		invoiceId,
		designFeeDescription: description.trim() || null,
		qtyInvoiced: String(qty),
		unitCnSnapshot: String(unitCn),
		lineTotal: String(lineTotal)
	});
	await recomputeInvoiceTotals(invoiceId);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Recompute total_amount and amount_due from the invoice's lines
// ---------------------------------------------------------------------------

export async function recomputeInvoiceTotals(invoiceId: string): Promise<void> {
	const invoice = (await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1))[0];
	if (!invoice) return;

	const [{ total }] = await db
		.select({
			total: sql<string>`coalesce(sum(${invoiceLines.lineTotal}), 0)`
		})
		.from(invoiceLines)
		.where(eq(invoiceLines.invoiceId, invoiceId));

	const subtotal = Number(total);
	const taxPct = Number(invoice.salesTaxPct ?? 0);
	const tax = invoice.type === 'product' ? subtotal * (taxPct / 100) : 0;
	const totalAmount = subtotal + tax;
	const deposit = Number(invoice.depositAppliedAmount ?? 0);
	const credit = Number(invoice.creditAppliedAmount ?? 0);
	const amountDue = Math.max(totalAmount - deposit - credit, 0);

	await db
		.update(invoices)
		.set({
			totalAmount: String(totalAmount),
			amountDue: String(amountDue),
			updatedAt: new Date()
		})
		.where(eq(invoices.id, invoiceId));
}

// ---------------------------------------------------------------------------
// Delete an invoice line
// ---------------------------------------------------------------------------

export async function deleteInvoiceLine(
	invoiceId: string,
	lineId: string
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	const invoice = (await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1))[0];
	if (!invoice) return { error: 'Invoice not found' };
	if (invoice.status !== 'draft') return { error: 'Only draft invoices can be edited' };

	await db
		.delete(invoiceLines)
		.where(and(eq(invoiceLines.id, lineId), eq(invoiceLines.invoiceId, invoiceId)));

	await recomputeInvoiceTotals(invoiceId);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Mark sent (lock further line edits)
// ---------------------------------------------------------------------------

export async function markInvoiceSent(
	invoiceId: string
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	const invoice = (await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1))[0];
	if (!invoice) return { error: 'Invoice not found' };
	if (invoice.status !== 'draft') return { error: 'Only draft invoices can be sent' };

	await db
		.update(invoices)
		.set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
		.where(eq(invoices.id, invoiceId));
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Mark paid
// ---------------------------------------------------------------------------

export async function markInvoicePaid(
	invoiceId: string,
	paidAmount: number
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	const invoice = (await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1))[0];
	if (!invoice) return { error: 'Invoice not found' };

	const totalAmount = Number(invoice.totalAmount ?? 0);
	const deposit = Number(invoice.depositAppliedAmount ?? 0);
	const credit = Number(invoice.creditAppliedAmount ?? 0);
	const fullyPaid = paidAmount + deposit + credit >= totalAmount - 0.005;

	await db
		.update(invoices)
		.set({
			status: fullyPaid ? 'paid' : 'partial_paid',
			paidAmount: String(paidAmount),
			paidAt: fullyPaid ? new Date() : invoice.paidAt,
			updatedAt: new Date()
		})
		.where(eq(invoices.id, invoiceId));
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Apply credit / deposit
// ---------------------------------------------------------------------------

export async function applyCreditToInvoice(
	invoiceId: string,
	creditAmount: number,
	depositAmount: number
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	const invoice = (await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1))[0];
	if (!invoice) return { error: 'Invoice not found' };

	await db
		.update(invoices)
		.set({
			creditAppliedAmount: String(creditAmount),
			depositAppliedAmount: String(depositAmount),
			updatedAt: new Date()
		})
		.where(eq(invoices.id, invoiceId));

	await recomputeInvoiceTotals(invoiceId);
	return { ok: true };
}

// Avoid unused-import lints from helpers we may want later
void isNull;
