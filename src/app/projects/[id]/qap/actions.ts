'use server';

import { db } from '@/lib/db';
import { qapLines, auditCells } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const QAP_EDITABLE_COLUMNS = [
	'qty',
	'currentDn',
	'marginPct',
	'finish',
	'cct',
	'wattage',
	'voltage',
	'dim',
	'mounting',
	'roughInRequired',
	'fixtureCategory',
	'fixtureLocation',
	'atticStock',
	'internalDesignerNotes',
	'notes',
	'description'
] as const;

const EDITABLE_SET = new Set<string>(QAP_EDITABLE_COLUMNS);

const ChangeSchema = z.object({
	id: z.string().uuid(),
	row_version: z.number(),
	cells: z.record(z.string(), z.unknown())
});

const PayloadSchema = z.object({
	changes: z.array(ChangeSchema)
});

export type SaveResult = {
	accepted: { id: string; new_row_version: number }[];
	rejected: {
		id: string;
		reason: 'stale_row_version' | 'validation' | 'not_found';
		server_row_version?: number;
		errors?: Record<string, string>;
	}[];
	error?: string;
};

export async function saveQapChanges(
	projectId: string,
	payloadJson: string
): Promise<SaveResult> {
	const user = await requireUser();

	let payload: z.infer<typeof PayloadSchema>;
	try {
		payload = PayloadSchema.parse(JSON.parse(payloadJson));
	} catch {
		return { accepted: [], rejected: [], error: 'Invalid payload format' };
	}

	const accepted: SaveResult['accepted'] = [];
	const rejected: SaveResult['rejected'] = [];

	for (const change of payload.changes) {
		// Filter to known editable columns + cheap per-column validation.
		const updates: Record<string, unknown> = {};
		const validationErrors: Record<string, string> = {};
		for (const [k, v] of Object.entries(change.cells)) {
			if (!EDITABLE_SET.has(k)) continue;
			if (k === 'qty' || k === 'currentDn' || k === 'marginPct') {
				if (v === '' || v === null || v === undefined) {
					updates[k] = null;
				} else if (Number.isFinite(Number(v))) {
					const n = Number(v);
					if (k === 'qty' && n < 0) {
						validationErrors[k] = 'must be >= 0';
					} else {
						updates[k] = String(v);
					}
				} else {
					validationErrors[k] = 'not a number';
				}
			} else {
				updates[k] = v === '' ? null : v;
			}
		}

		if (Object.keys(validationErrors).length > 0) {
			rejected.push({ id: change.id, reason: 'validation', errors: validationErrors });
			continue;
		}
		if (Object.keys(updates).length === 0) continue;

		// Fetch current row (need old values for audit + concurrency check).
		const current = (
			await db
				.select()
				.from(qapLines)
				.where(and(eq(qapLines.id, change.id), eq(qapLines.projectId, projectId)))
				.limit(1)
		)[0];

		if (!current) {
			rejected.push({ id: change.id, reason: 'not_found' });
			continue;
		}

		if (Number(current.rowVersion) !== change.row_version) {
			rejected.push({
				id: change.id,
				reason: 'stale_row_version',
				server_row_version: Number(current.rowVersion)
			});
			continue;
		}

		// Atomic update conditional on expected row_version.
		const result = await db
			.update(qapLines)
			.set({
				...updates,
				rowVersion: sql`${qapLines.rowVersion} + 1`,
				updatedAt: new Date(),
				updatedByUserId: user.id
			})
			.where(and(eq(qapLines.id, change.id), eq(qapLines.rowVersion, change.row_version)))
			.returning({ rowVersion: qapLines.rowVersion });

		if (result.length === 0) {
			// Lost the race — someone else bumped row_version between SELECT and UPDATE.
			const fresh = await db
				.select({ rv: qapLines.rowVersion })
				.from(qapLines)
				.where(eq(qapLines.id, change.id))
				.limit(1);
			rejected.push({
				id: change.id,
				reason: 'stale_row_version',
				server_row_version: Number(fresh[0]?.rv ?? 0)
			});
			continue;
		}

		// Cell-level audit entries.
		const auditEntries = Object.entries(updates).map(([col, newVal]) => ({
			userId: user.id,
			tableName: 'qap_lines',
			rowId: change.id,
			columnName: col,
			operation: 'update',
			oldValue: (current as Record<string, unknown>)[col] as unknown as object,
			newValue: newVal as unknown as object
		}));
		if (auditEntries.length > 0) {
			await db.insert(auditCells).values(auditEntries);
		}

		accepted.push({ id: change.id, new_row_version: Number(result[0].rowVersion) });
	}

	revalidatePath(`/projects/${projectId}/qap`);
	return { accepted, rejected };
}
