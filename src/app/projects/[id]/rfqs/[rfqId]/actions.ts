'use server';

import { db } from '@/lib/db';
import { rfqs, rfqLines, qapLines, auditCells } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const VALID_STATUSES = ['draft', 'sent', 'quoted', 'accepted', 'declined', 'cancelled'] as const;
type RfqStatus = (typeof VALID_STATUSES)[number];

export async function updateRfqStatus(projectId: string, rfqId: string, newStatus: string) {
	await requireUser();
	if (!(VALID_STATUSES as readonly string[]).includes(newStatus)) {
		return { error: `Invalid status: ${newStatus}` };
	}
	const status = newStatus as RfqStatus;

	const updates: Record<string, unknown> = {
		status,
		updatedAt: new Date()
	};
	if (status === 'sent') {
		updates.sentAt = new Date();
	}

	await db
		.update(rfqs)
		.set(updates)
		.where(and(eq(rfqs.id, rfqId), eq(rfqs.projectId, projectId)));

	revalidatePath(`/projects/${projectId}/rfqs/${rfqId}`);
	revalidatePath(`/projects/${projectId}/rfqs`);
	return { ok: true };
}

const QuoteSchema = z.object({
	id: z.string().uuid(),
	quotedDn: z.string()
});

const SaveQuotesSchema = z.object({
	quotes: z.array(QuoteSchema)
});

export type SaveQuotesResult = {
	saved?: number;
	error?: string;
};

export async function saveQuotes(
	projectId: string,
	rfqId: string,
	payloadJson: string
): Promise<SaveQuotesResult> {
	await requireUser();
	let payload: z.infer<typeof SaveQuotesSchema>;
	try {
		payload = SaveQuotesSchema.parse(JSON.parse(payloadJson));
	} catch {
		return { error: 'Invalid quotes payload' };
	}

	let saved = 0;
	for (const q of payload.quotes) {
		const raw = q.quotedDn.trim();
		// Allow empty to clear the quoted_dn
		const value = raw === '' ? null : raw;
		if (value !== null && !Number.isFinite(Number(value))) continue;

		await db
			.update(rfqLines)
			.set({
				quotedDn: value,
				quoteReceivedAt: value !== null ? new Date() : null
			})
			.where(and(eq(rfqLines.id, q.id), eq(rfqLines.rfqId, rfqId)));
		saved++;
	}

	revalidatePath(`/projects/${projectId}/rfqs/${rfqId}`);
	return { saved };
}

export type ApplyToQapResult = {
	appliedRfqLineId?: string;
	error?: string;
};

/**
 * Promote one rfq_line's quoted_dn to its qap_line.current_dn.
 * This is the only path by which an RFQ touches the QAP — explicit, per-line,
 * audited. Respects qap_lines.row_version (bumps it) and writes audit_cells.
 */
export async function applyQuoteToQap(
	projectId: string,
	rfqId: string,
	rfqLineId: string
): Promise<ApplyToQapResult> {
	const user = await requireUser();

	const line = (
		await db
			.select({
				rfqLineId: rfqLines.id,
				qapLineId: rfqLines.qapLineId,
				quotedDn: rfqLines.quotedDn,
				appliedAt: rfqLines.appliedToQapAt
			})
			.from(rfqLines)
			.where(and(eq(rfqLines.id, rfqLineId), eq(rfqLines.rfqId, rfqId)))
			.limit(1)
	)[0];

	if (!line) return { error: 'RFQ line not found' };
	if (line.quotedDn === null) return { error: 'No quoted DN on this line yet' };

	// Read existing current_dn for the audit entry.
	const qapBefore = (
		await db
			.select({ currentDn: qapLines.currentDn, rowVersion: qapLines.rowVersion })
			.from(qapLines)
			.where(and(eq(qapLines.id, line.qapLineId), eq(qapLines.projectId, projectId)))
			.limit(1)
	)[0];
	if (!qapBefore) return { error: 'QAP line not found' };

	await db
		.update(qapLines)
		.set({
			currentDn: line.quotedDn,
			rowVersion: sql`${qapLines.rowVersion} + 1`,
			updatedAt: new Date(),
			updatedByUserId: user.id
		})
		.where(eq(qapLines.id, line.qapLineId));

	await db.insert(auditCells).values({
		userId: user.id,
		tableName: 'qap_lines',
		rowId: line.qapLineId,
		columnName: 'currentDn',
		operation: 'update',
		oldValue: qapBefore.currentDn as unknown as object,
		newValue: line.quotedDn as unknown as object
	});

	await db
		.update(rfqLines)
		.set({
			appliedToQapAt: new Date(),
			appliedToQapByUserId: user.id
		})
		.where(eq(rfqLines.id, rfqLineId));

	revalidatePath(`/projects/${projectId}/rfqs/${rfqId}`);
	revalidatePath(`/projects/${projectId}/qap`);
	return { appliedRfqLineId: rfqLineId };
}

/**
 * Apply every rfq_line in this RFQ that has a quoted_dn and hasn't been
 * applied yet. One transaction's worth of QAP writes.
 */
export async function applyAllQuotesToQap(
	projectId: string,
	rfqId: string
): Promise<{ applied: number; skipped: number; error?: string }> {
	const user = await requireUser();

	const eligibleLines = await db
		.select({
			rfqLineId: rfqLines.id,
			qapLineId: rfqLines.qapLineId,
			quotedDn: rfqLines.quotedDn
		})
		.from(rfqLines)
		.where(
			and(
				eq(rfqLines.rfqId, rfqId),
				sql`${rfqLines.quotedDn} is not null`,
				sql`${rfqLines.appliedToQapAt} is null`
			)
		);

	let applied = 0;
	for (const l of eligibleLines) {
		const qapBefore = (
			await db
				.select({ currentDn: qapLines.currentDn })
				.from(qapLines)
				.where(and(eq(qapLines.id, l.qapLineId), eq(qapLines.projectId, projectId)))
				.limit(1)
		)[0];
		if (!qapBefore) continue;

		await db
			.update(qapLines)
			.set({
				currentDn: l.quotedDn,
				rowVersion: sql`${qapLines.rowVersion} + 1`,
				updatedAt: new Date(),
				updatedByUserId: user.id
			})
			.where(eq(qapLines.id, l.qapLineId));

		await db.insert(auditCells).values({
			userId: user.id,
			tableName: 'qap_lines',
			rowId: l.qapLineId,
			columnName: 'currentDn',
			operation: 'update',
			oldValue: qapBefore.currentDn as unknown as object,
			newValue: l.quotedDn as unknown as object
		});

		await db
			.update(rfqLines)
			.set({
				appliedToQapAt: new Date(),
				appliedToQapByUserId: user.id
			})
			.where(eq(rfqLines.id, l.rfqLineId));

		applied++;
	}

	revalidatePath(`/projects/${projectId}/rfqs/${rfqId}`);
	revalidatePath(`/projects/${projectId}/qap`);
	return { applied, skipped: eligibleLines.length - applied };
}
