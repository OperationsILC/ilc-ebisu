'use server';

import { db } from '@/lib/db';
import { shipments, purchaseOrders } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, count, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

/**
 * Create a draft "expected" shipment under this PO and redirect to its detail
 * page. The PM then fills in which lines are on it and what quantity of each.
 */
export async function createShipment(projectId: string, poId: string) {
	const user = await requireUser();

	const po = (
		await db
			.select({ id: purchaseOrders.id })
			.from(purchaseOrders)
			.where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.projectId, projectId)))
			.limit(1)
	)[0];
	if (!po) throw new Error('PO not found');

	const [{ n: existing }] = await db.select({ n: count() }).from(shipments);
	const shipmentNo = `SH${String(Number(existing) + 1).padStart(5, '0')}`;

	let createdId: string | undefined;
	try {
		const [row] = await db
			.insert(shipments)
			.values({
				projectId,
				purchaseOrderId: poId,
				shipmentNo,
				status: 'expected',
				createdByUserId: user.id
			})
			.returning({ id: shipments.id });
		createdId = row.id;
	} catch (err) {
		// Tiny race window on duplicate shipment_no — retry once with bumped counter
		if (err instanceof Error && err.message.includes('unique')) {
			const [{ n: again }] = await db.select({ n: count() }).from(shipments);
			const retryNo = `SH${String(Number(again) + 1).padStart(5, '0')}`;
			const [row] = await db
				.insert(shipments)
				.values({
					projectId,
					purchaseOrderId: poId,
					shipmentNo: retryNo,
					status: 'expected',
					createdByUserId: user.id
				})
				.returning({ id: shipments.id });
			createdId = row.id;
		} else {
			throw err;
		}
	}

	if (createdId)
		redirect(`/projects/${projectId}/pos/${poId}/shipments/${createdId}`);
}
