'use server';

import { db } from '@/lib/db';
import { invoices } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { recomputeInvoiceTotals } from '../actions';

export async function updateInvoiceHeader(
	projectId: string,
	invoiceId: string,
	formData: FormData
): Promise<void> {
	await requireUser();
	const raw = Object.fromEntries(formData) as Record<string, string>;

	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (raw.invoiceDate !== undefined) {
		const t = raw.invoiceDate.trim();
		updates.invoiceDate = t === '' ? null : new Date(t);
	}
	if (raw.dueDate !== undefined) {
		const t = raw.dueDate.trim();
		updates.dueDate = t === '' ? null : new Date(t);
	}
	if (raw.clientPoNo !== undefined) {
		updates.clientPoNo = raw.clientPoNo.trim() === '' ? null : raw.clientPoNo.trim();
	}
	if (raw.salesTaxPct !== undefined) {
		const t = raw.salesTaxPct.trim();
		if (t === '') updates.salesTaxPct = null;
		else if (Number.isFinite(Number(t))) updates.salesTaxPct = t;
	}
	if (raw.salesTaxName !== undefined) {
		updates.salesTaxName = raw.salesTaxName.trim() === '' ? null : raw.salesTaxName.trim();
	}
	if (raw.designPhase !== undefined) {
		updates.designPhase = raw.designPhase.trim() === '' ? null : raw.designPhase.trim();
	}

	await db
		.update(invoices)
		.set(updates)
		.where(and(eq(invoices.id, invoiceId), eq(invoices.projectId, projectId)));

	// Tax % changes affect total; recompute.
	if ('salesTaxPct' in updates) {
		await recomputeInvoiceTotals(invoiceId);
	}

	revalidatePath(`/projects/${projectId}/invoices/${invoiceId}`);
	revalidatePath(`/projects/${projectId}/invoices`);
}
