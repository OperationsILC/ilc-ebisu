'use server';

import { db } from '@/lib/db';
import { purchaseOrders, orderLines } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// PO header edits
// ---------------------------------------------------------------------------

const PoHeaderSchema = z.object({
	status: z.string().optional(),
	description: z.string().optional(),
	notes: z.string().optional(),
	internalNotes: z.string().optional(),
	customEmailMessage: z.string().optional(),
	addedFreight: z.string().optional(),
	repQuoteNo: z.string().optional(),
	trackingNumber: z.string().optional(),
	shipToText: z.string().optional(),
	ilcOfficeAddress: z.string().optional(),
	sendFromEmail: z.string().optional(),
	sendToEmail: z.string().optional()
});

export type PoHeaderResult = { ok?: boolean; error?: string };

export async function updatePoHeader(
	projectId: string,
	poId: string,
	_prev: PoHeaderResult | undefined,
	formData: FormData
): Promise<PoHeaderResult> {
	await requireUser();
	const raw = Object.fromEntries(formData) as Record<string, string>;
	const parsed = PoHeaderSchema.safeParse(raw);
	if (!parsed.success) return { error: 'Invalid form data' };

	const v = parsed.data;
	const updates: Record<string, unknown> = { updatedAt: new Date() };
	for (const k of [
		'status',
		'description',
		'notes',
		'internalNotes',
		'customEmailMessage',
		'repQuoteNo',
		'trackingNumber',
		'shipToText',
		'ilcOfficeAddress',
		'sendFromEmail',
		'sendToEmail'
	] as const) {
		if (v[k] !== undefined) updates[k] = v[k].trim() === '' ? null : v[k].trim();
	}
	if (v.addedFreight !== undefined) {
		const t = v.addedFreight.trim();
		if (t === '') updates.addedFreight = null;
		else if (Number.isFinite(Number(t))) updates.addedFreight = t;
	}

	// Auto-stamp sentAt the first time status flips to 'sent'.
	if (updates.status === 'sent') {
		const current = (
			await db
				.select({ sentAt: purchaseOrders.sentAt })
				.from(purchaseOrders)
				.where(eq(purchaseOrders.id, poId))
				.limit(1)
		)[0];
		if (current && current.sentAt === null) {
			updates.sentAt = new Date();
		}
	}

	await db
		.update(purchaseOrders)
		.set(updates)
		.where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.projectId, projectId)));

	revalidatePath(`/projects/${projectId}/pos/${poId}`);
	revalidatePath(`/projects/${projectId}/pos`);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// PO line edits (same shape as SO line edits — bidirectional sync, since the
// rows are shared)
// ---------------------------------------------------------------------------

const LineEditSchema = z.object({
	id: z.string().uuid(),
	rowVersion: z.number(),
	fields: z.object({
		qty: z.string().optional(),
		qtyType: z.string().optional(),
		unitDn: z.string().optional(),
		unitCn: z.string().optional(),
		marginPct: z.string().optional(),
		repQuoteNo: z.string().optional()
	})
});
const SaveLineEditsSchema = z.object({ changes: z.array(LineEditSchema) });
const EDITABLE_NUMERIC = new Set(['qty', 'unitDn', 'unitCn', 'marginPct']);

export type SavePoLineEditsResult = {
	accepted: { id: string; new_row_version: number }[];
	rejected: { id: string; reason: string }[];
	error?: string;
};

export async function savePoLineEdits(
	poId: string,
	payloadJson: string
): Promise<SavePoLineEditsResult> {
	const user = await requireUser();
	let payload: z.infer<typeof SaveLineEditsSchema>;
	try {
		payload = SaveLineEditsSchema.parse(JSON.parse(payloadJson));
	} catch {
		return { accepted: [], rejected: [], error: 'Invalid payload' };
	}

	const accepted: SavePoLineEditsResult['accepted'] = [];
	const rejected: SavePoLineEditsResult['rejected'] = [];

	for (const change of payload.changes) {
		const updates: Record<string, unknown> = {};
		const errors: string[] = [];
		for (const [k, v] of Object.entries(change.fields)) {
			if (v === undefined) continue;
			const t = String(v).trim();
			if (EDITABLE_NUMERIC.has(k)) {
				if (t === '') updates[k] = null;
				else if (Number.isFinite(Number(t))) updates[k] = t;
				else errors.push(`${k}: must be a number`);
			} else {
				updates[k] = t === '' ? null : t;
			}
		}
		if (errors.length > 0) {
			rejected.push({ id: change.id, reason: errors.join('; ') });
			continue;
		}
		if (Object.keys(updates).length === 0) continue;

		const current = (
			await db
				.select({ rv: orderLines.rowVersion })
				.from(orderLines)
				.where(and(eq(orderLines.id, change.id), eq(orderLines.purchaseOrderId, poId)))
				.limit(1)
		)[0];
		if (!current) {
			rejected.push({ id: change.id, reason: 'not_found' });
			continue;
		}
		if (Number(current.rv) !== change.rowVersion) {
			rejected.push({ id: change.id, reason: `stale_row_version (server is at v${current.rv})` });
			continue;
		}

		const result = await db
			.update(orderLines)
			.set({
				...updates,
				rowVersion: sql`${orderLines.rowVersion} + 1`,
				updatedAt: new Date(),
				updatedByUserId: user.id
			})
			.where(and(eq(orderLines.id, change.id), eq(orderLines.rowVersion, change.rowVersion)))
			.returning({ rv: orderLines.rowVersion });

		if (result.length === 0) {
			rejected.push({ id: change.id, reason: 'stale_row_version (race)' });
			continue;
		}
		accepted.push({ id: change.id, new_row_version: Number(result[0].rv) });
	}

	// Revalidate both the PO detail AND any SO that shares lines with this PO,
	// since the rows are shared and the SO totals need to reflect the changes.
	const soIds = (
		await db
			.selectDistinct({ soId: orderLines.salesOrderId })
			.from(orderLines)
			.where(eq(orderLines.purchaseOrderId, poId))
	)
		.map((r) => r.soId)
		.filter((x): x is string => x !== null);

	revalidatePath(`/projects/.+/pos/${poId}`, 'page');
	for (const soId of soIds) {
		revalidatePath(`/projects/.+/sos/${soId}`, 'page');
	}

	return { accepted, rejected };
}
