'use server';

import { db } from '@/lib/db';
import {
	changeOrders,
	changeOrderLines,
	orderLines,
	purchaseOrders,
	projects,
	companies,
	users
} from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, count, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import {
	renderDocEmailHtml,
	renderDocEmailText,
	parseEmails,
	type DocEmailLine
} from '@/lib/doc-email';
import { renderChangeOrderPdf } from '@/lib/pdf/render';
import { type ChangeOrderPdfData } from '@/lib/pdf/change-order';

/**
 * Create a draft CO against a sent PO. Refuses if the PO has an open CO
 * already (only one draft / sent / acknowledged at a time).
 */
export async function createChangeOrder(
	projectId: string,
	poId: string
): Promise<void> {
	const user = await requireUser();

	const po = (
		await db
			.select()
			.from(purchaseOrders)
			.where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.projectId, projectId)))
			.limit(1)
	)[0];
	if (!po) throw new Error('PO not found');

	// Refuse if there's an open CO
	const openCo = await db
		.select({ id: changeOrders.id })
		.from(changeOrders)
		.where(
			and(
				eq(changeOrders.purchaseOrderId, poId),
				inArray(changeOrders.status, ['draft', 'sent', 'acknowledged'])
			)
		)
		.limit(1);
	if (openCo.length > 0) {
		throw new Error(
			`This PO already has an open Change Order. Apply or cancel it before creating another.`
		);
	}

	const coNo = await nextChangeOrderNo();
	const [row] = await db
		.insert(changeOrders)
		.values({
			projectId,
			purchaseOrderId: poId,
			coNo,
			versionNoBefore: po.versionNo,
			status: 'draft',
			createdByUserId: user.id
		})
		.returning({ id: changeOrders.id });

	redirect(`/projects/${projectId}/pos/${poId}/change-orders/${row.id}`);
}

async function nextChangeOrderNo(): Promise<string> {
	const [{ n }] = await db.select({ n: count() }).from(changeOrders);
	return `CO${String(Number(n) + 1).padStart(5, '0')}`;
}

// ---------------------------------------------------------------------------
// Header edits
// ---------------------------------------------------------------------------

export async function updateChangeOrderHeader(
	projectId: string,
	poId: string,
	coId: string,
	formData: FormData
): Promise<void> {
	await requireUser();
	const raw = Object.fromEntries(formData) as Record<string, string>;
	const updates: Record<string, unknown> = { updatedAt: new Date() };

	for (const k of ['description', 'reason', 'customEmailMessage'] as const) {
		if (raw[k] !== undefined)
			updates[k] = raw[k].trim() === '' ? null : raw[k].trim();
	}

	await db
		.update(changeOrders)
		.set(updates)
		.where(and(eq(changeOrders.id, coId), eq(changeOrders.purchaseOrderId, poId)));

	revalidatePath(`/projects/${projectId}/pos/${poId}/change-orders/${coId}`);
}

// ---------------------------------------------------------------------------
// Add a line-modification entry (modify an existing PO line)
// ---------------------------------------------------------------------------

const ModifyLineSchema = z.object({
	orderLineId: z.string().uuid(),
	qtyAfter: z.string().optional(),
	unitDnAfter: z.string().optional(),
	catalogNoAfter: z.string().optional(),
	descriptionAfter: z.string().optional(),
	reasonText: z.string().optional()
});

export async function addModifyLineToCo(
	projectId: string,
	poId: string,
	coId: string,
	formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	const raw = Object.fromEntries(formData) as Record<string, string>;
	const parsed = ModifyLineSchema.safeParse(raw);
	if (!parsed.success) return { error: 'Invalid input' };
	const v = parsed.data;

	const co = (
		await db.select().from(changeOrders).where(eq(changeOrders.id, coId)).limit(1)
	)[0];
	if (!co) return { error: 'CO not found' };
	if (co.status !== 'draft') return { error: 'Only draft COs accept new lines' };

	const ol = (
		await db
			.select()
			.from(orderLines)
			.where(and(eq(orderLines.id, v.orderLineId), eq(orderLines.purchaseOrderId, poId)))
			.limit(1)
	)[0];
	if (!ol) return { error: 'Order line not on this PO' };

	// "After" values: blank means "no change" — copy the before value
	const qtyBefore = ol.qty;
	const qtyAfter =
		v.qtyAfter && v.qtyAfter.trim() !== '' ? v.qtyAfter.trim() : ol.qty;
	const unitDnBefore = ol.unitDn;
	const unitDnAfter =
		v.unitDnAfter && v.unitDnAfter.trim() !== '' ? v.unitDnAfter.trim() : ol.unitDn;
	const catalogNoBefore = ol.catalogNoSnapshot;
	const catalogNoAfter =
		v.catalogNoAfter && v.catalogNoAfter.trim() !== ''
			? v.catalogNoAfter.trim()
			: ol.catalogNoSnapshot;
	const descriptionBefore = ol.descriptionSnapshot;
	const descriptionAfter =
		v.descriptionAfter && v.descriptionAfter.trim() !== ''
			? v.descriptionAfter.trim()
			: ol.descriptionSnapshot;

	const delta = computeLineDelta({
		qtyBefore,
		qtyAfter,
		unitDnBefore,
		unitDnAfter
	});

	await db.insert(changeOrderLines).values({
		changeOrderId: coId,
		orderLineId: ol.id,
		operation: 'modify',
		typeBefore: ol.typeNameSnapshot,
		catalogNoBefore,
		manufacturerBefore: ol.manufacturerNameSnapshot,
		descriptionBefore,
		qtyBefore,
		qtyTypeBefore: ol.qtyType,
		unitDnBefore,
		typeAfter: ol.typeNameSnapshot,
		catalogNoAfter,
		manufacturerAfter: ol.manufacturerNameSnapshot,
		descriptionAfter,
		qtyAfter,
		qtyTypeAfter: ol.qtyType,
		unitDnAfter,
		lineTotalDelta: String(delta),
		reasonText: v.reasonText?.trim() || null
	});

	await recomputeCoTotal(coId);
	revalidatePath(`/projects/${projectId}/pos/${poId}/change-orders/${coId}`);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Remove a line (mark for deletion on apply)
// ---------------------------------------------------------------------------

export async function addRemoveLineToCo(
	projectId: string,
	poId: string,
	coId: string,
	orderLineId: string,
	reasonText: string
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	const co = (
		await db.select().from(changeOrders).where(eq(changeOrders.id, coId)).limit(1)
	)[0];
	if (!co) return { error: 'CO not found' };
	if (co.status !== 'draft') return { error: 'Only draft COs accept new lines' };

	const ol = (
		await db
			.select()
			.from(orderLines)
			.where(and(eq(orderLines.id, orderLineId), eq(orderLines.purchaseOrderId, poId)))
			.limit(1)
	)[0];
	if (!ol) return { error: 'Order line not on this PO' };

	const delta = computeLineDelta({
		qtyBefore: ol.qty,
		qtyAfter: null,
		unitDnBefore: ol.unitDn,
		unitDnAfter: null
	});

	await db.insert(changeOrderLines).values({
		changeOrderId: coId,
		orderLineId: ol.id,
		operation: 'remove',
		typeBefore: ol.typeNameSnapshot,
		catalogNoBefore: ol.catalogNoSnapshot,
		manufacturerBefore: ol.manufacturerNameSnapshot,
		descriptionBefore: ol.descriptionSnapshot,
		qtyBefore: ol.qty,
		qtyTypeBefore: ol.qtyType,
		unitDnBefore: ol.unitDn,
		lineTotalDelta: String(delta),
		reasonText: reasonText.trim() || null
	});

	await recomputeCoTotal(coId);
	revalidatePath(`/projects/${projectId}/pos/${poId}/change-orders/${coId}`);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Add a brand-new line (didn't exist on the PO)
// ---------------------------------------------------------------------------

const AddLineSchema = z.object({
	type: z.string().optional(),
	catalogNo: z.string().min(1, 'Catalog # required'),
	manufacturer: z.string().optional(),
	description: z.string().optional(),
	qty: z.string().min(1, 'Qty required'),
	qtyType: z.string().optional(),
	unitDn: z.string().min(1, 'Unit DN required'),
	reasonText: z.string().optional()
});

export async function addNewLineToCo(
	projectId: string,
	poId: string,
	coId: string,
	formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	const raw = Object.fromEntries(formData) as Record<string, string>;
	const parsed = AddLineSchema.safeParse(raw);
	if (!parsed.success)
		return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
	const v = parsed.data;

	const co = (
		await db.select().from(changeOrders).where(eq(changeOrders.id, coId)).limit(1)
	)[0];
	if (!co) return { error: 'CO not found' };
	if (co.status !== 'draft') return { error: 'Only draft COs accept new lines' };

	const qty = v.qty.trim();
	const unitDn = v.unitDn.trim();
	const delta = computeLineDelta({
		qtyBefore: null,
		qtyAfter: qty,
		unitDnBefore: null,
		unitDnAfter: unitDn
	});

	await db.insert(changeOrderLines).values({
		changeOrderId: coId,
		operation: 'add',
		typeAfter: v.type?.trim() || null,
		catalogNoAfter: v.catalogNo.trim(),
		manufacturerAfter: v.manufacturer?.trim() || null,
		descriptionAfter: v.description?.trim() || null,
		qtyAfter: qty,
		qtyTypeAfter: v.qtyType?.trim() || null,
		unitDnAfter: unitDn,
		lineTotalDelta: String(delta),
		reasonText: v.reasonText?.trim() || null
	});

	await recomputeCoTotal(coId);
	revalidatePath(`/projects/${projectId}/pos/${poId}/change-orders/${coId}`);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Delete a CO line (only while draft)
// ---------------------------------------------------------------------------

export async function deleteCoLine(
	projectId: string,
	poId: string,
	coId: string,
	lineId: string
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	const co = (
		await db.select().from(changeOrders).where(eq(changeOrders.id, coId)).limit(1)
	)[0];
	if (!co) return { error: 'CO not found' };
	if (co.status !== 'draft')
		return { error: 'Only draft COs can have lines deleted' };

	await db
		.delete(changeOrderLines)
		.where(and(eq(changeOrderLines.id, lineId), eq(changeOrderLines.changeOrderId, coId)));

	await recomputeCoTotal(coId);
	revalidatePath(`/projects/${projectId}/pos/${poId}/change-orders/${coId}`);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Mark sent (locks line edits, stamps sentAt)
// ---------------------------------------------------------------------------

export async function markChangeOrderSent(
	projectId: string,
	poId: string,
	coId: string
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	const co = (
		await db.select().from(changeOrders).where(eq(changeOrders.id, coId)).limit(1)
	)[0];
	if (!co) return { error: 'CO not found' };
	if (co.status !== 'draft') return { error: 'Only draft COs can be sent' };

	const [{ n }] = await db
		.select({ n: count() })
		.from(changeOrderLines)
		.where(eq(changeOrderLines.changeOrderId, coId));
	if (Number(n) === 0) return { error: 'CO has no lines yet' };

	await db
		.update(changeOrders)
		.set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
		.where(eq(changeOrders.id, coId));

	revalidatePath(`/projects/${projectId}/pos/${poId}/change-orders/${coId}`);
	revalidatePath(`/projects/${projectId}/pos/${poId}/change-orders`);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Mark acknowledged
// ---------------------------------------------------------------------------

export async function markChangeOrderAcknowledged(
	projectId: string,
	poId: string,
	coId: string
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	const co = (
		await db.select().from(changeOrders).where(eq(changeOrders.id, coId)).limit(1)
	)[0];
	if (!co) return { error: 'CO not found' };
	if (co.status !== 'sent') return { error: 'Only sent COs can be acknowledged' };

	await db
		.update(changeOrders)
		.set({ status: 'acknowledged', acknowledgedAt: new Date(), updatedAt: new Date() })
		.where(eq(changeOrders.id, coId));

	revalidatePath(`/projects/${projectId}/pos/${poId}/change-orders/${coId}`);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Apply CO — the big action. Mutates order_lines, bumps PO.version_no,
// stamps applied_at + applied_by, status flips to 'applied'.
// ---------------------------------------------------------------------------

export async function applyChangeOrder(
	projectId: string,
	poId: string,
	coId: string
): Promise<{ ok?: boolean; error?: string }> {
	const user = await requireUser();
	const co = (
		await db.select().from(changeOrders).where(eq(changeOrders.id, coId)).limit(1)
	)[0];
	if (!co) return { error: 'CO not found' };
	if (!['draft', 'sent', 'acknowledged'].includes(co.status))
		return { error: `CO status is ${co.status}; cannot apply` };

	const po = (
		await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1)
	)[0];
	if (!po) return { error: 'PO not found' };

	const lines = await db
		.select()
		.from(changeOrderLines)
		.where(eq(changeOrderLines.changeOrderId, coId));

	// Walk the lines and apply each
	for (const cl of lines) {
		if (cl.operation === 'remove') {
			if (cl.orderLineId) {
				await db
					.delete(orderLines)
					.where(eq(orderLines.id, cl.orderLineId));
			}
		} else if (cl.operation === 'modify') {
			if (cl.orderLineId) {
				await db
					.update(orderLines)
					.set({
						qty: cl.qtyAfter,
						unitDn: cl.unitDnAfter,
						catalogNoSnapshot: cl.catalogNoAfter,
						descriptionSnapshot: cl.descriptionAfter,
						updatedAt: new Date(),
						updatedByUserId: user.id,
						rowVersion: sql`${orderLines.rowVersion} + 1`
					})
					.where(eq(orderLines.id, cl.orderLineId));
			}
		} else if (cl.operation === 'add') {
			const [inserted] = await db
				.insert(orderLines)
				.values({
					salesOrderId: po.salesOrderId!,
					purchaseOrderId: poId,
					typeNameSnapshot: cl.typeAfter,
					catalogNoSnapshot: cl.catalogNoAfter,
					manufacturerNameSnapshot: cl.manufacturerAfter,
					descriptionSnapshot: cl.descriptionAfter,
					qty: cl.qtyAfter,
					qtyType: cl.qtyTypeAfter,
					unitDn: cl.unitDnAfter,
					createdByUserId: user.id,
					updatedByUserId: user.id
				})
				.returning({ id: orderLines.id });
			// Backfill the CO line's order_line_id so future readers can trace
			await db
				.update(changeOrderLines)
				.set({ orderLineId: inserted.id })
				.where(eq(changeOrderLines.id, cl.id));
		}
	}

	const newVersion = po.versionNo + 1;
	await db
		.update(purchaseOrders)
		.set({ versionNo: newVersion, updatedAt: new Date() })
		.where(eq(purchaseOrders.id, poId));

	await db
		.update(changeOrders)
		.set({
			status: 'applied',
			versionNoAfter: newVersion,
			appliedAt: new Date(),
			appliedByUserId: user.id,
			updatedAt: new Date()
		})
		.where(eq(changeOrders.id, coId));

	revalidatePath(`/projects/${projectId}/pos/${poId}/change-orders/${coId}`);
	revalidatePath(`/projects/${projectId}/pos/${poId}/change-orders`);
	revalidatePath(`/projects/${projectId}/pos/${poId}`);
	if (po.salesOrderId) revalidatePath(`/projects/${projectId}/sos/${po.salesOrderId}`);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Reject / cancel
// ---------------------------------------------------------------------------

export async function rejectChangeOrder(
	projectId: string,
	poId: string,
	coId: string,
	reason: string
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	const co = (
		await db.select().from(changeOrders).where(eq(changeOrders.id, coId)).limit(1)
	)[0];
	if (!co) return { error: 'CO not found' };
	if (co.status === 'applied') return { error: 'Cannot reject an applied CO' };
	if (!reason.trim()) return { error: 'Reject reason required' };

	await db
		.update(changeOrders)
		.set({
			status: 'rejected',
			rejectedAt: new Date(),
			rejectedReason: reason.trim(),
			updatedAt: new Date()
		})
		.where(eq(changeOrders.id, coId));

	revalidatePath(`/projects/${projectId}/pos/${poId}/change-orders/${coId}`);
	revalidatePath(`/projects/${projectId}/pos/${poId}/change-orders`);
	return { ok: true };
}

export async function cancelChangeOrder(
	projectId: string,
	poId: string,
	coId: string
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();
	await db
		.update(changeOrders)
		.set({ status: 'cancelled', updatedAt: new Date() })
		.where(eq(changeOrders.id, coId));
	revalidatePath(`/projects/${projectId}/pos/${poId}/change-orders/${coId}`);
	revalidatePath(`/projects/${projectId}/pos/${poId}/change-orders`);
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeLineDelta({
	qtyBefore,
	qtyAfter,
	unitDnBefore,
	unitDnAfter
}: {
	qtyBefore: string | null;
	qtyAfter: string | null;
	unitDnBefore: string | null;
	unitDnAfter: string | null;
}): number {
	const beforeTotal =
		qtyBefore !== null && unitDnBefore !== null
			? Number(qtyBefore) * Number(unitDnBefore)
			: 0;
	const afterTotal =
		qtyAfter !== null && unitDnAfter !== null
			? Number(qtyAfter) * Number(unitDnAfter)
			: 0;
	return afterTotal - beforeTotal;
}

async function recomputeCoTotal(coId: string): Promise<void> {
	const [{ total }] = await db
		.select({
			total: sql<string>`coalesce(sum(${changeOrderLines.lineTotalDelta}), 0)`
		})
		.from(changeOrderLines)
		.where(eq(changeOrderLines.changeOrderId, coId));

	await db
		.update(changeOrders)
		.set({ netAmountChange: total ?? '0', updatedAt: new Date() })
		.where(eq(changeOrders.id, coId));
}

// ---------------------------------------------------------------------------
// Send CO via email (PDF attached). Auto-stamps sentAt + flips status to sent
// if still draft. Optimistically leaves the CO open for acknowledgement/apply.
// ---------------------------------------------------------------------------

export type SendCoResult = {
	ok?: boolean;
	error?: string;
	sentTo?: string[];
	redirectedTo?: string[];
};

export async function sendChangeOrderEmail(
	projectId: string,
	poId: string,
	coId: string,
	recipientsRaw: string
): Promise<SendCoResult> {
	const me = await requireUser();
	const recipients = parseEmails(recipientsRaw);
	if (recipients.length === 0)
		return { error: 'At least one valid email recipient required.' };

	const project = (await db.select().from(projects).where(eq(projects.id, projectId)).limit(1))[0];
	if (!project) return { error: 'Project not found' };

	const row = (
		await db
			.select({
				co: changeOrders,
				poNo: purchaseOrders.poNo,
				repFirm: companies.name,
				repFirmOrderEmails: companies.orderEmails,
				pmName: users.name,
				pmEmail: users.email
			})
			.from(changeOrders)
			.innerJoin(purchaseOrders, eq(changeOrders.purchaseOrderId, purchaseOrders.id))
			.leftJoin(companies, eq(purchaseOrders.repFirmCompanyId, companies.id))
			.leftJoin(users, eq(users.id, changeOrders.createdByUserId))
			.where(
				and(
					eq(changeOrders.id, coId),
					eq(changeOrders.purchaseOrderId, poId),
					eq(changeOrders.projectId, projectId)
				)
			)
			.limit(1)
	)[0];
	if (!row) return { error: 'CO not found' };
	const co = row.co;

	const lines = await db
		.select()
		.from(changeOrderLines)
		.where(eq(changeOrderLines.changeOrderId, coId))
		.orderBy(changeOrderLines.createdAt);
	if (lines.length === 0) return { error: 'CO has no lines yet.' };

	const usd = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});

	const emailLines: DocEmailLine[] = lines.map((l) => {
		const fmtDiff = (b: string | null, a: string | null): string | null => {
			if (l.operation === 'add') return a !== null ? `+ ${a}` : null;
			if (l.operation === 'remove') return b !== null ? `(removed) ${b}` : null;
			if (b === a || a === null || b === null) return a ?? b;
			return `${b} → ${a}`;
		};
		return {
			c1: l.operation.toUpperCase(),
			c2: fmtDiff(l.catalogNoBefore, l.catalogNoAfter),
			c3: l.manufacturerAfter ?? l.manufacturerBefore,
			c4: fmtDiff(l.descriptionBefore, l.descriptionAfter),
			c5: fmtDiff(
				l.qtyBefore ? Number(l.qtyBefore).toLocaleString() : null,
				l.qtyAfter ? Number(l.qtyAfter).toLocaleString() : null
			),
			c6:
				l.lineTotalDelta && Number(l.lineTotalDelta) !== 0
					? `${Number(l.lineTotalDelta) > 0 ? '+' : ''}${usd.format(Number(l.lineTotalDelta))}`
					: null
		};
	});

	const netChange = Number(co.netAmountChange ?? 0);

	const appUrl = process.env.AUTH_URL ?? '';
	const docUrl = appUrl ? `${appUrl}/projects/${projectId}/pos/${poId}/change-orders/${coId}` : '';
	const pmName = row.pmName ?? me.name ?? null;
	const pmEmail = row.pmEmail ?? me.email;

	const html = renderDocEmailHtml({
		docKindLabel: 'Change Order',
		docNo: co.coNo,
		projectName: project.name,
		recipientName: row.repFirm,
		pmName,
		pmEmail,
		customMessage: co.description ?? co.customEmailMessage,
		columns: ['Op', 'Catalog #', 'Manufacturer', 'Description', 'Qty', 'Δ $'],
		lines: emailLines,
		grandLabel: 'Net change to PO total',
		grandValue: `${netChange > 0 ? '+' : ''}${usd.format(netChange)}`,
		appUrl,
		docUrl,
		closing: `Please acknowledge receipt of ${co.coNo} against PO ${row.poNo} and confirm any pricing impacts.`
	});
	const text = renderDocEmailText({
		docKindLabel: 'Change Order',
		docNo: co.coNo,
		projectName: project.name,
		recipientName: row.repFirm,
		pmName,
		pmEmail,
		customMessage: co.description ?? co.customEmailMessage,
		columns: ['Op', 'Catalog #', 'Manufacturer', 'Description', 'Qty', 'Δ $'],
		lines: emailLines,
		grandLabel: 'Net change to PO total',
		grandValue: `${netChange > 0 ? '+' : ''}${usd.format(netChange)}`,
		appUrl,
		docUrl,
		closing: `Please acknowledge receipt of ${co.coNo} against PO ${row.poNo} and confirm any pricing impacts.`
	});

	const pdfData: ChangeOrderPdfData = {
		coNo: co.coNo,
		status: co.status,
		createdAt: co.createdAt.toISOString(),
		sentAt: new Date().toISOString(),
		appliedAt: co.appliedAt?.toISOString() ?? null,
		versionNoBefore: co.versionNoBefore,
		versionNoAfter: co.versionNoAfter,
		description: co.description,
		customEmailMessage: co.customEmailMessage,
		netAmountChange: co.netAmountChange,
		projectName: project.name,
		poNo: row.poNo,
		repFirm: row.repFirm,
		repFirmOrderEmails: row.repFirmOrderEmails,
		pmName,
		pmEmail,
		lines: lines.map((l) => ({
			operation: l.operation,
			catalogNoBefore: l.catalogNoBefore,
			catalogNoAfter: l.catalogNoAfter,
			descriptionBefore: l.descriptionBefore,
			descriptionAfter: l.descriptionAfter,
			qtyBefore: l.qtyBefore,
			qtyAfter: l.qtyAfter,
			qtyType: l.qtyTypeAfter ?? l.qtyTypeBefore,
			unitDnBefore: l.unitDnBefore,
			unitDnAfter: l.unitDnAfter,
			lineTotalDelta: l.lineTotalDelta,
			reasonText: l.reasonText
		}))
	};
	const pdfBuffer = await renderChangeOrderPdf(pdfData);

	const result = await sendEmail({
		to: recipients,
		replyTo: pmEmail,
		subject: `Change Order ${co.coNo} against PO ${row.poNo}`,
		html,
		text,
		attachments: [{ filename: `${co.coNo}.pdf`, content: pdfBuffer }]
	});

	if (!result.ok) return { error: result.error ?? 'Email send failed' };

	// Flip status to sent if still draft
	if (co.status === 'draft') {
		await db
			.update(changeOrders)
			.set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
			.where(eq(changeOrders.id, coId));
	}

	revalidatePath(`/projects/${projectId}/pos/${poId}/change-orders/${coId}`);
	revalidatePath(`/projects/${projectId}/pos/${poId}/change-orders`);

	return { ok: true, sentTo: recipients, redirectedTo: result.redirectedTo };
}
