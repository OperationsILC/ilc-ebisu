'use server';

import { db } from '@/lib/db';
import { rfqs, rfqLines, qapLines, auditCells, companies, projects, users } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import { renderRfqEmailHtml, renderRfqEmailText } from '@/lib/rfq-email';

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
export type SendRfqResult = {
	ok?: boolean;
	error?: string;
	redirectedTo?: string[];
	sentTo?: string[];
};

/**
 * Send this RFQ via email to the rep firm's quoteEmails. Updates the RFQ
 * status to 'sent' and stamps sent_at. If DEV_EMAIL_REDIRECT is set, the
 * email goes there instead — see lib/email.ts.
 */
export async function sendRfqEmail(projectId: string, rfqId: string): Promise<SendRfqResult> {
	const user = await requireUser();

	// Gather all the data the email needs.
	const rfq = (
		await db
			.select({
				rfqNo: rfqs.rfqNo,
				notes: rfqs.notes,
				status: rfqs.status,
				repFirmId: rfqs.repFirmCompanyId
			})
			.from(rfqs)
			.where(and(eq(rfqs.id, rfqId), eq(rfqs.projectId, projectId)))
			.limit(1)
	)[0];
	if (!rfq) return { error: 'RFQ not found' };

	if (!rfq.repFirmId) return { error: 'No rep firm assigned to this RFQ' };

	const repFirm = (
		await db
			.select({ name: companies.name, quoteEmails: companies.quoteEmails })
			.from(companies)
			.where(eq(companies.id, rfq.repFirmId))
			.limit(1)
	)[0];
	if (!repFirm) return { error: 'Rep firm not found' };

	const toList = (repFirm.quoteEmails ?? '')
		.split(/[,;\s]+/)
		.map((s) => s.trim())
		.filter((s) => /@/.test(s));
	if (toList.length === 0) {
		return {
			error: `Rep firm "${repFirm.name}" has no quote_emails set. Open the companies record and add an email before sending.`
		};
	}

	const project = (
		await db.select({ name: projects.name }).from(projects).where(eq(projects.id, projectId)).limit(1)
	)[0];
	if (!project) return { error: 'Project not found' };

	const pm = (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0];
	const pmName = pm?.name ?? null;
	const pmEmail = pm?.email ?? user.email;

	const lines = await db
		.select({
			type: rfqLines.typeNameSnapshot,
			catalogNo: rfqLines.catalogNoSnapshot,
			manufacturer: rfqLines.manufacturerNameSnapshot,
			qty: rfqLines.qtySnapshot,
			description: rfqLines.descriptionSnapshot
		})
		.from(rfqLines)
		.where(eq(rfqLines.rfqId, rfqId))
		.orderBy(
			rfqLines.manufacturerNameSnapshot,
			rfqLines.typeNameSnapshot,
			rfqLines.catalogNoSnapshot
		);

	if (lines.length === 0) return { error: 'RFQ has no lines to quote' };

	const appUrl = process.env.AUTH_URL ?? '';
	const rfqUrl = appUrl ? `${appUrl}/projects/${projectId}/rfqs/${rfqId}` : '';

	const ctx = {
		rfqNo: rfq.rfqNo,
		projectName: project.name,
		repFirmName: repFirm.name,
		pmName,
		pmEmail,
		notes: rfq.notes,
		lines,
		appUrl,
		rfqUrl
	};

	const result = await sendEmail({
		to: toList,
		replyTo: pmEmail,
		subject: `RFQ ${rfq.rfqNo} — ${project.name}`,
		html: renderRfqEmailHtml(ctx),
		text: renderRfqEmailText(ctx)
	});

	if (!result.ok) {
		return { error: result.error ?? 'Email send failed' };
	}

	// Update RFQ status to 'sent' (only if still draft — don't clobber later states).
	await db
		.update(rfqs)
		.set({ status: rfq.status === 'draft' ? 'sent' : rfq.status, sentAt: new Date(), updatedAt: new Date() })
		.where(and(eq(rfqs.id, rfqId), eq(rfqs.projectId, projectId)));

	revalidatePath(`/projects/${projectId}/rfqs/${rfqId}`);
	revalidatePath(`/projects/${projectId}/rfqs`);

	return {
		ok: true,
		sentTo: toList,
		redirectedTo: result.redirectedTo
	};
}

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
