'use server';

import { db } from '@/lib/db';
import { qapLines, shipQapHiddenLines } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

/**
 * Persist Olivia's "expected" planning fields on a QAP line. These are
 * forward-looking — they tell ShipQAP when she's planning for ship/arrival
 * before any real PO/shipment exists. Edits here write directly to the
 * QAP row (no separate copy / no writeback dance — there's nothing to
 * write back from).
 *
 * Empty-string fields clear the value (set to NULL).
 */
export type SetExpectedFields = {
	expectedShipDate?: string; // ISO date string, '' to clear
	expectedArrivalDate?: string;
	expectedShipNotes?: string;
};

export type SetExpectedResult = { ok?: true; error?: string };

export async function setShipQapExpected(
	qapLineId: string,
	fields: SetExpectedFields
): Promise<SetExpectedResult> {
	const me = await requireUser();

	const updates: Record<string, unknown> = {
		updatedAt: new Date(),
		updatedByUserId: me.id
	};

	if (fields.expectedShipDate !== undefined) {
		const t = fields.expectedShipDate.trim();
		updates.expectedShipDate = t === '' ? null : new Date(t);
	}
	if (fields.expectedArrivalDate !== undefined) {
		const t = fields.expectedArrivalDate.trim();
		updates.expectedArrivalDate = t === '' ? null : new Date(t);
	}
	if (fields.expectedShipNotes !== undefined) {
		const t = fields.expectedShipNotes;
		updates.expectedShipNotes = t.trim() === '' ? null : t;
	}

	const result = await db
		.update(qapLines)
		.set(updates)
		.where(eq(qapLines.id, qapLineId))
		.returning({ projectId: qapLines.projectId });

	if (result.length === 0) {
		return { error: `QAP line ${qapLineId} not found.` };
	}

	// Both the per-project page and the cross-project page need to refresh.
	revalidatePath(`/projects/${result[0].projectId}/ship-qap`);
	revalidatePath(`/ship-qap`);
	return { ok: true };
}

/**
 * Toggle hide for the current user on one QAP line. Per-user — only the
 * caller's ship_qap_hidden_lines row is affected. Idempotent: if already
 * hidden, unhides; if not hidden, hides.
 */
export type ToggleHiddenResult = { ok?: true; nowHidden?: boolean; error?: string };

export async function toggleShipQapHidden(qapLineId: string): Promise<ToggleHiddenResult> {
	const me = await requireUser();

	const existing = await db
		.select({ qapLineId: shipQapHiddenLines.qapLineId })
		.from(shipQapHiddenLines)
		.where(
			and(
				eq(shipQapHiddenLines.userId, me.id),
				eq(shipQapHiddenLines.qapLineId, qapLineId)
			)
		)
		.limit(1);

	let nowHidden: boolean;
	if (existing.length > 0) {
		await db
			.delete(shipQapHiddenLines)
			.where(
				and(
					eq(shipQapHiddenLines.userId, me.id),
					eq(shipQapHiddenLines.qapLineId, qapLineId)
				)
			);
		nowHidden = false;
	} else {
		await db.insert(shipQapHiddenLines).values({
			userId: me.id,
			qapLineId
		});
		nowHidden = true;
	}

	// Look up the project for revalidation (need it for the per-project path).
	const ql = await db
		.select({ projectId: qapLines.projectId })
		.from(qapLines)
		.where(eq(qapLines.id, qapLineId))
		.limit(1);

	if (ql[0]) {
		revalidatePath(`/projects/${ql[0].projectId}/ship-qap`);
	}
	revalidatePath(`/ship-qap`);
	return { ok: true, nowHidden };
}

/**
 * Bulk unhide for the current user. Useful for a "reset my hides" affordance.
 * Optional scope: if projectId given, only unhide lines on that project.
 */
export async function unhideAllShipQap(projectId?: string): Promise<{ ok?: true; cleared?: number; error?: string }> {
	const me = await requireUser();

	if (projectId) {
		// Need to scope to lines belonging to this project — delete by JOIN
		// isn't directly expressible in Drizzle's delete API, so we look up the
		// IDs first.
		const linesInProject = await db
			.select({ id: qapLines.id })
			.from(qapLines)
			.where(eq(qapLines.projectId, projectId));
		const ids = new Set(linesInProject.map((l) => l.id));
		if (ids.size === 0) return { ok: true, cleared: 0 };

		const hidden = await db
			.select({ qapLineId: shipQapHiddenLines.qapLineId })
			.from(shipQapHiddenLines)
			.where(eq(shipQapHiddenLines.userId, me.id));
		const toClear = hidden.filter((h) => ids.has(h.qapLineId)).map((h) => h.qapLineId);
		if (toClear.length === 0) return { ok: true, cleared: 0 };

		for (const id of toClear) {
			await db
				.delete(shipQapHiddenLines)
				.where(
					and(
						eq(shipQapHiddenLines.userId, me.id),
						eq(shipQapHiddenLines.qapLineId, id)
					)
				);
		}
		revalidatePath(`/projects/${projectId}/ship-qap`);
		revalidatePath(`/ship-qap`);
		return { ok: true, cleared: toClear.length };
	}

	// No scope — unhide everything for this user.
	const result = await db
		.delete(shipQapHiddenLines)
		.where(eq(shipQapHiddenLines.userId, me.id))
		.returning({ qapLineId: shipQapHiddenLines.qapLineId });

	revalidatePath(`/ship-qap`);
	return { ok: true, cleared: result.length };
}
