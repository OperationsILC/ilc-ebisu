'use server';

import { db } from '@/lib/db';
import {
	rfqs,
	rfqLines,
	qapLines,
	auditCells,
	companies,
	projects,
	users,
	products,
	types
} from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import { renderRfqEmailHtml, renderRfqEmailText } from '@/lib/rfq-email';
import { renderRfqPdf } from '@/lib/pdf/render';
import { type RfqPdfData } from '@/lib/pdf/rfq';

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

const LineEditSchema = z.object({
	id: z.string().uuid(),
	fields: z.object({
		qty: z.string().optional(),
		quotedDn: z.string().optional(),
		qtyType: z.string().optional()
	})
});

const SaveLineEditsSchema = z.object({
	changes: z.array(LineEditSchema)
});

export type SaveLineEditsResult = {
	saved?: number;
	rejected?: { id: string; reason: string }[];
	error?: string;
};

/**
 * Bulk-save edits to any RFQ line fields PMs can adjust pre-quote:
 *  - qty (qtySnapshot) — the qty being requested on this RFQ
 *  - quotedDn — the price the rep came back with
 *
 * Empty string clears the value (sets null). Non-numeric values are rejected
 * per-row, others commit. One transaction equivalent: each row is independent.
 */
export async function saveRfqLineEdits(
	projectId: string,
	rfqId: string,
	payloadJson: string
): Promise<SaveLineEditsResult> {
	await requireUser();
	let payload: z.infer<typeof SaveLineEditsSchema>;
	try {
		payload = SaveLineEditsSchema.parse(JSON.parse(payloadJson));
	} catch {
		return { error: 'Invalid payload format' };
	}

	let saved = 0;
	const rejected: { id: string; reason: string }[] = [];

	for (const change of payload.changes) {
		const updates: Record<string, unknown> = {};
		let bad = false;

		if (change.fields.qty !== undefined) {
			const raw = change.fields.qty.trim();
			if (raw === '') {
				updates.qtySnapshot = null;
			} else if (Number.isFinite(Number(raw)) && Number(raw) >= 0) {
				updates.qtySnapshot = raw;
			} else {
				rejected.push({ id: change.id, reason: 'qty: must be a non-negative number' });
				bad = true;
			}
		}

		if (!bad && change.fields.quotedDn !== undefined) {
			const raw = change.fields.quotedDn.trim();
			if (raw === '') {
				updates.quotedDn = null;
				updates.quoteReceivedAt = null;
			} else if (Number.isFinite(Number(raw))) {
				updates.quotedDn = raw;
				updates.quoteReceivedAt = new Date();
			} else {
				rejected.push({ id: change.id, reason: 'quotedDn: must be a number' });
				bad = true;
			}
		}

		if (!bad && change.fields.qtyType !== undefined) {
			const raw = change.fields.qtyType.trim();
			updates.qtyType = raw === '' ? null : raw;
		}

		if (bad || Object.keys(updates).length === 0) continue;

		await db
			.update(rfqLines)
			.set(updates)
			.where(and(eq(rfqLines.id, change.id), eq(rfqLines.rfqId, rfqId)));
		saved++;
	}

	revalidatePath(`/projects/${projectId}/rfqs/${rfqId}`);
	return { saved, rejected };
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
export type AddLinesResult = {
	added?: number;
	skipped?: number;
	error?: string;
};

/**
 * Add QAP lines to an existing RFQ. Snapshots the QAP values at add time.
 * Lines already on this RFQ are silently skipped (via the unique constraint
 * on rfq_id + qap_line_id).
 */
export async function addLinesToRfq(
	projectId: string,
	rfqId: string,
	qapLineIds: string[]
): Promise<AddLinesResult> {
	await requireUser();
	if (qapLineIds.length === 0) return { error: 'No lines selected' };

	const rfq = (
		await db
			.select()
			.from(rfqs)
			.where(and(eq(rfqs.id, rfqId), eq(rfqs.projectId, projectId)))
			.limit(1)
	)[0];
	if (!rfq) return { error: 'RFQ not found' };

	// Fetch QAP line data to snapshot. Verify each belongs to this project.
	const lines = await db
		.select({
			id: qapLines.id,
			projectId: qapLines.projectId,
			qty: qapLines.qty,
			typeName: types.name,
			catalogNo: products.catalogNo,
			manufacturer: companies.name,
			description: qapLines.description
		})
		.from(qapLines)
		.innerJoin(types, eq(qapLines.typeId, types.id))
		.innerJoin(products, eq(qapLines.productId, products.id))
		.leftJoin(companies, eq(products.manufacturerCompanyId, companies.id))
		.where(inArray(qapLines.id, qapLineIds));

	const wrongProject = lines.filter((l) => l.projectId !== projectId);
	if (wrongProject.length > 0) {
		return { error: 'Some selected lines do not belong to this project. Refresh and try again.' };
	}

	let added = 0;
	let skipped = 0;
	for (const l of lines) {
		try {
			await db.insert(rfqLines).values({
				rfqId,
				qapLineId: l.id,
				qtySnapshot: l.qty,
				typeNameSnapshot: l.typeName,
				catalogNoSnapshot: l.catalogNo,
				manufacturerNameSnapshot: l.manufacturer,
				descriptionSnapshot: l.description
			});
			added++;
		} catch (err) {
			// Likely unique-constraint violation (line already on this RFQ).
			if (err instanceof Error && err.message.toLowerCase().includes('unique')) {
				skipped++;
			} else {
				throw err;
			}
		}
	}

	revalidatePath(`/projects/${projectId}/rfqs/${rfqId}`);
	return { added, skipped };
}

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

	// Render the RFQ PDF and attach to the email so the rep firm gets a
	// branded document alongside the inline HTML table. The HTML stays —
	// rep firms often paste prices into the email reply directly, and the
	// PDF is the canonical reference.
	const pdfData: RfqPdfData = {
		rfqNo: rfq.rfqNo,
		status: rfq.status,
		createdAt: new Date().toISOString(),
		sentAt: new Date().toISOString(),
		notes: rfq.notes,
		projectName: project.name,
		repFirm: repFirm.name,
		repFirmQuoteEmails: repFirm.quoteEmails,
		pmName,
		pmEmail,
		lines: lines.map((l) => ({
			type: l.type,
			catalogNo: l.catalogNo,
			manufacturer: l.manufacturer,
			description: l.description,
			qty: l.qty,
			qtyType: null
		}))
	};
	const pdfBuffer = await renderRfqPdf(pdfData);

	const result = await sendEmail({
		to: toList,
		replyTo: pmEmail,
		subject: `RFQ ${rfq.rfqNo} — ${project.name}`,
		html: renderRfqEmailHtml(ctx),
		text: renderRfqEmailText(ctx),
		attachments: [
			{
				filename: `${rfq.rfqNo}.pdf`,
				content: pdfBuffer
			}
		]
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
