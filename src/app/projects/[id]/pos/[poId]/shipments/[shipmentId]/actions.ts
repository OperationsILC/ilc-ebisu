'use server';

import { db } from '@/lib/db';
import { shipments, shipmentLines } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shipment header edits
// ---------------------------------------------------------------------------

const HeaderSchema = z.object({
	status: z.string().optional(),
	carrier: z.string().optional(),
	trackingNumber: z.string().optional(),
	expectedDate: z.string().optional(),
	shippedDate: z.string().optional(),
	receivedDate: z.string().optional(),
	receivedAtLocation: z.string().optional(),
	notes: z.string().optional(),
	internalNotes: z.string().optional()
});

export type ShipmentHeaderResult = { ok?: boolean; error?: string };

export async function updateShipmentHeader(
	projectId: string,
	poId: string,
	shipmentId: string,
	_prev: ShipmentHeaderResult | undefined,
	formData: FormData
): Promise<ShipmentHeaderResult> {
	const user = await requireUser();
	const raw = Object.fromEntries(formData) as Record<string, string>;
	const parsed = HeaderSchema.safeParse(raw);
	if (!parsed.success) return { error: 'Invalid form data' };

	const v = parsed.data;
	const updates: Record<string, unknown> = { updatedAt: new Date() };

	for (const k of [
		'status',
		'carrier',
		'trackingNumber',
		'receivedAtLocation',
		'notes',
		'internalNotes'
	] as const) {
		if (v[k] !== undefined) updates[k] = v[k].trim() === '' ? null : v[k].trim();
	}

	for (const k of ['expectedDate', 'shippedDate', 'receivedDate'] as const) {
		if (v[k] !== undefined) {
			const t = v[k].trim();
			if (t === '') updates[k] = null;
			else {
				const d = new Date(t);
				if (!isNaN(d.getTime())) updates[k] = d;
			}
		}
	}

	// Auto-stamp received_date + received_by_user_id the first time status
	// flips to 'received' (if PM didn't manually set the date).
	if (updates.status === 'received') {
		const current = (
			await db
				.select({
					receivedDate: shipments.receivedDate,
					receivedByUserId: shipments.receivedByUserId
				})
				.from(shipments)
				.where(eq(shipments.id, shipmentId))
				.limit(1)
		)[0];
		if (current && current.receivedDate === null && updates.receivedDate === undefined) {
			updates.receivedDate = new Date();
		}
		if (current && current.receivedByUserId === null) {
			updates.receivedByUserId = user.id;
		}
	}

	await db
		.update(shipments)
		.set(updates)
		.where(and(eq(shipments.id, shipmentId), eq(shipments.purchaseOrderId, poId)));

	revalidatePath(`/projects/${projectId}/pos/${poId}/shipments/${shipmentId}`);
	revalidatePath(`/projects/${projectId}/pos/${poId}/shipments`);
	revalidatePath(`/projects/${projectId}/pos/${poId}`);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Save shipment lines — one bulk operation. Payload lists every PO line the
// PM has touched. qty_shipped="" or "0" means "not on this shipment" → delete
// any existing shipment_line row. Otherwise UPSERT.
// ---------------------------------------------------------------------------

const LineEditSchema = z.object({
	orderLineId: z.string().uuid(),
	qtyShipped: z.string(),
	notes: z.string().optional()
});
const SaveLinesSchema = z.object({ changes: z.array(LineEditSchema) });

export type SaveShipmentLinesResult = {
	upserted: number;
	deleted: number;
	rejected: { orderLineId: string; reason: string }[];
	error?: string;
};

export async function saveShipmentLines(
	shipmentId: string,
	payloadJson: string
): Promise<SaveShipmentLinesResult> {
	await requireUser();

	let payload: z.infer<typeof SaveLinesSchema>;
	try {
		payload = SaveLinesSchema.parse(JSON.parse(payloadJson));
	} catch {
		return { upserted: 0, deleted: 0, rejected: [], error: 'Invalid payload' };
	}

	let upserted = 0;
	let deleted = 0;
	const rejected: SaveShipmentLinesResult['rejected'] = [];

	// Existing shipment_lines for this shipment, keyed by orderLineId
	const existing = await db
		.select({
			id: shipmentLines.id,
			orderLineId: shipmentLines.orderLineId
		})
		.from(shipmentLines)
		.where(eq(shipmentLines.shipmentId, shipmentId));
	const existingByOrderLineId = new Map(existing.map((e) => [e.orderLineId, e.id]));

	for (const c of payload.changes) {
		const raw = c.qtyShipped.trim();
		const notesT = (c.notes ?? '').trim();
		const existingId = existingByOrderLineId.get(c.orderLineId);

		// Blank or zero → delete (if any)
		if (raw === '' || Number(raw) === 0) {
			if (existingId) {
				await db.delete(shipmentLines).where(eq(shipmentLines.id, existingId));
				deleted++;
			}
			continue;
		}

		const n = Number(raw);
		if (!Number.isFinite(n) || n < 0) {
			rejected.push({ orderLineId: c.orderLineId, reason: 'qty_shipped must be a non-negative number' });
			continue;
		}

		if (existingId) {
			await db
				.update(shipmentLines)
				.set({ qtyShipped: raw, notes: notesT === '' ? null : notesT })
				.where(eq(shipmentLines.id, existingId));
		} else {
			await db.insert(shipmentLines).values({
				shipmentId,
				orderLineId: c.orderLineId,
				qtyShipped: raw,
				notes: notesT === '' ? null : notesT
			});
		}
		upserted++;
	}

	return { upserted, deleted, rejected };
}

// ---------------------------------------------------------------------------
// Mark received — convenience action that flips status + stamps received_date
// (if not already set) and received_by_user_id.
// ---------------------------------------------------------------------------

export async function markReceived(
	projectId: string,
	poId: string,
	shipmentId: string
): Promise<{ ok?: boolean; error?: string }> {
	const user = await requireUser();

	const current = (
		await db
			.select({
				receivedDate: shipments.receivedDate,
				receivedByUserId: shipments.receivedByUserId
			})
			.from(shipments)
			.where(eq(shipments.id, shipmentId))
			.limit(1)
	)[0];
	if (!current) return { error: 'Shipment not found' };

	const updates: Record<string, unknown> = {
		status: 'received',
		updatedAt: new Date()
	};
	if (current.receivedDate === null) updates.receivedDate = new Date();
	if (current.receivedByUserId === null) updates.receivedByUserId = user.id;

	await db
		.update(shipments)
		.set(updates)
		.where(and(eq(shipments.id, shipmentId), eq(shipments.purchaseOrderId, poId)));

	revalidatePath(`/projects/${projectId}/pos/${poId}/shipments/${shipmentId}`);
	revalidatePath(`/projects/${projectId}/pos/${poId}/shipments`);
	revalidatePath(`/projects/${projectId}/pos/${poId}`);
	revalidatePath(`/projects/${projectId}/shipments`);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Delete shipment (and cascading shipment_lines via FK).
// ---------------------------------------------------------------------------

export async function deleteShipment(
	projectId: string,
	poId: string,
	shipmentId: string
): Promise<void> {
	await requireUser();
	await db
		.delete(shipments)
		.where(and(eq(shipments.id, shipmentId), eq(shipments.purchaseOrderId, poId)));
	redirect(`/projects/${projectId}/pos/${poId}/shipments`);
}
