'use server';

import { db } from '@/lib/db';
import { bills, billLines, purchaseOrders } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, count, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/**
 * Create a blank bill that a PM will manually fill in. Used when DocParser
 * isn't in the loop or when a bill arrives outside the OCR pipeline.
 */
export async function createBlankBill(projectId: string) {
	const user = await requireUser();
	const billNo = await nextBillNo();

	const [row] = await db
		.insert(bills)
		.values({
			projectId,
			billNo,
			status: 'pending_review',
			createdByUserId: user.id
		})
		.returning({ id: bills.id });

	redirect(`/projects/${projectId}/bills/${row.id}`);
}

/**
 * Generate the next BL##### number.
 */
export async function nextBillNo(): Promise<string> {
	const [{ n }] = await db.select({ n: count() }).from(bills);
	return `BL${String(Number(n) + 1).padStart(5, '0')}`;
}

// ---------------------------------------------------------------------------
// Bill header edits
// ---------------------------------------------------------------------------

export async function updateBillHeader(
	projectId: string,
	billId: string,
	formData: FormData
): Promise<void> {
	await requireUser();
	const raw = Object.fromEntries(formData) as Record<string, string>;
	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (raw.vendorBillNo !== undefined)
		updates.vendorBillNo = raw.vendorBillNo.trim() === '' ? null : raw.vendorBillNo.trim();
	if (raw.notes !== undefined)
		updates.notes = raw.notes.trim() === '' ? null : raw.notes.trim();
	if (raw.purchaseOrderId !== undefined)
		updates.purchaseOrderId = raw.purchaseOrderId.trim() === '' ? null : raw.purchaseOrderId.trim();
	if (raw.totalAmount !== undefined) {
		const t = raw.totalAmount.trim();
		if (t === '') updates.totalAmount = null;
		else if (Number.isFinite(Number(t))) updates.totalAmount = t;
	}
	if (raw.billDate !== undefined) {
		const t = raw.billDate.trim();
		updates.billDate = t === '' ? null : new Date(t);
	}
	if (raw.dueDate !== undefined) {
		const t = raw.dueDate.trim();
		updates.dueDate = t === '' ? null : new Date(t);
	}

	await db
		.update(bills)
		.set(updates)
		.where(and(eq(bills.id, billId), eq(bills.projectId, projectId)));

	revalidatePath(`/projects/${projectId}/bills/${billId}`);
	revalidatePath(`/projects/${projectId}/bills`);
}

/**
 * Try to auto-link a bill to its PO by matching the vendor's bill reference.
 * Used after DocParser delivers a bill — the OCR usually extracts the PO# but
 * we don't trust it blindly. PM can override.
 */
export async function attachBillToPo(
	projectId: string,
	billId: string,
	poNumber: string
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	const cleaned = poNumber.trim();
	if (cleaned === '') return { error: 'PO number required' };

	const po = (
		await db
			.select({ id: purchaseOrders.id, projectId: purchaseOrders.projectId })
			.from(purchaseOrders)
			.where(eq(purchaseOrders.poNo, cleaned))
			.limit(1)
	)[0];
	if (!po) return { error: `No PO found with number ${cleaned}` };

	await db
		.update(bills)
		.set({
			purchaseOrderId: po.id,
			projectId: po.projectId,
			updatedAt: new Date()
		})
		.where(eq(bills.id, billId));

	if (projectId) revalidatePath(`/projects/${projectId}/bills/${billId}`);
	revalidatePath(`/projects/${po.projectId}/bills/${billId}`);
	revalidatePath(`/projects/${po.projectId}/bills`);
	revalidatePath(`/bills`);
	revalidatePath(`/bills/${billId}`);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Approve / reject
// ---------------------------------------------------------------------------

export async function approveBill(
	projectId: string,
	billId: string
): Promise<{ ok?: boolean; error?: string }> {
	const user = await requireUser();
	const bill = (await db.select().from(bills).where(eq(bills.id, billId)).limit(1))[0];
	if (!bill) return { error: 'Bill not found' };
	if (bill.status !== 'pending_review')
		return { error: `Bill is already ${bill.status}` };
	if (!bill.purchaseOrderId)
		return { error: 'Attach a PO before approving' };

	await db
		.update(bills)
		.set({
			status: 'approved',
			approvedByUserId: user.id,
			approvedAt: new Date(),
			updatedAt: new Date()
		})
		.where(eq(bills.id, billId));

	revalidatePath(`/projects/${projectId}/bills/${billId}`);
	revalidatePath(`/projects/${projectId}/bills`);
	return { ok: true };
}

export async function rejectBill(
	projectId: string,
	billId: string,
	reason: string
): Promise<{ ok?: boolean; error?: string }> {
	const user = await requireUser();
	if (!reason.trim()) return { error: 'Provide a reject reason' };

	await db
		.update(bills)
		.set({
			status: 'rejected',
			rejectedByUserId: user.id,
			rejectedAt: new Date(),
			rejectedReason: reason.trim(),
			updatedAt: new Date()
		})
		.where(eq(bills.id, billId));

	revalidatePath(`/projects/${projectId}/bills/${billId}`);
	revalidatePath(`/projects/${projectId}/bills`);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Bill line edits — add / update / delete
// ---------------------------------------------------------------------------

export async function upsertBillLine(
	projectId: string,
	billId: string,
	formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	const raw = Object.fromEntries(formData) as Record<string, string>;

	const lineId = raw.lineId?.trim() || null;
	const description = raw.description?.trim() ?? '';
	const catalogNo = raw.catalogNo?.trim() ?? '';
	const qty = raw.qty?.trim() ?? '';
	const unitPrice = raw.unitPrice?.trim() ?? '';

	const qtyN = Number(qty);
	const unitN = Number(unitPrice);
	if (!Number.isFinite(qtyN) || qtyN <= 0) return { error: 'Qty must be > 0' };
	if (!Number.isFinite(unitN)) return { error: 'Unit price must be a number' };
	const lineTotal = qtyN * unitN;

	if (lineId) {
		await db
			.update(billLines)
			.set({
				descriptionText: description || null,
				catalogNoText: catalogNo || null,
				qty: qty || null,
				unitPrice: unitPrice || null,
				lineTotal: String(lineTotal)
			})
			.where(and(eq(billLines.id, lineId), eq(billLines.billId, billId)));
	} else {
		await db.insert(billLines).values({
			billId,
			descriptionText: description || null,
			catalogNoText: catalogNo || null,
			qty: qty || null,
			unitPrice: unitPrice || null,
			lineTotal: String(lineTotal)
		});
	}

	revalidatePath(`/projects/${projectId}/bills/${billId}`);
	return { ok: true };
}

export async function deleteBillLine(
	projectId: string,
	billId: string,
	lineId: string
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	await db
		.delete(billLines)
		.where(and(eq(billLines.id, lineId), eq(billLines.billId, billId)));
	revalidatePath(`/projects/${projectId}/bills/${billId}`);
	return { ok: true };
}
