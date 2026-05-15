'use server';

import { db } from '@/lib/db';
import {
	purchaseOrders,
	orderLines,
	projects,
	salesOrders,
	companies,
	users
} from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import {
	renderDocEmailHtml,
	renderDocEmailText,
	parseEmails,
	type DocEmailLine
} from '@/lib/doc-email';
import { renderPoPdf } from '@/lib/pdf/render';
import { type PoPdfData } from '@/lib/pdf/po';

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

// ---------------------------------------------------------------------------
// Send PO via email (PDF attached)
// ---------------------------------------------------------------------------

export type SendPoResult = {
	ok?: boolean;
	error?: string;
	sentTo?: string[];
	redirectedTo?: string[];
};

export async function sendPoEmail(
	projectId: string,
	poId: string,
	recipientsRaw: string
): Promise<SendPoResult> {
	const me = await requireUser();
	const recipients = parseEmails(recipientsRaw);
	if (recipients.length === 0)
		return { error: 'At least one valid email recipient required.' };

	const project = (
		await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
	)[0];
	if (!project) return { error: 'Project not found' };

	const poRow = (
		await db
			.select({
				po: purchaseOrders,
				repFirm: companies.name,
				repFirmOrderEmails: companies.orderEmails,
				soNo: salesOrders.soNo,
				creator: users.email,
				creatorName: users.name
			})
			.from(purchaseOrders)
			.leftJoin(companies, eq(purchaseOrders.repFirmCompanyId, companies.id))
			.leftJoin(salesOrders, eq(purchaseOrders.salesOrderId, salesOrders.id))
			.leftJoin(users, eq(purchaseOrders.createdByUserId, users.id))
			.where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.projectId, projectId)))
			.limit(1)
	)[0];
	if (!poRow) return { error: 'PO not found' };
	const po = poRow.po;

	const lines = await db
		.select()
		.from(orderLines)
		.where(eq(orderLines.purchaseOrderId, poId))
		.orderBy(
			orderLines.manufacturerNameSnapshot,
			orderLines.typeNameSnapshot,
			orderLines.catalogNoSnapshot
		);

	if (lines.length === 0) return { error: 'PO has no lines to send.' };

	const usd = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});

	const emailLines: DocEmailLine[] = lines.map((l) => ({
		c1: l.typeNameSnapshot,
		c2: l.catalogNoSnapshot,
		c3: l.manufacturerNameSnapshot,
		c4: l.descriptionSnapshot,
		c5: l.qty ? Number(l.qty).toLocaleString() : null,
		c6: l.unitDn ? usd.format(Number(l.unitDn)) : null
	}));

	let subtotal = 0;
	for (const l of lines) subtotal += Number(l.qty ?? 0) * Number(l.unitDn ?? 0);
	const addedFreight = Number(po.addedFreight ?? 0);
	const grandTotal = subtotal + addedFreight;

	const appUrl = process.env.AUTH_URL ?? '';
	const docUrl = appUrl ? `${appUrl}/projects/${projectId}/pos/${poId}` : '';

	const pmName = poRow.creatorName ?? me.name ?? null;
	const pmEmail = poRow.creator ?? me.email;

	const html = renderDocEmailHtml({
		docKindLabel: 'Purchase Order',
		docNo: po.poNo,
		projectName: project.name,
		recipientName: poRow.repFirm,
		pmName,
		pmEmail,
		customMessage: po.customEmailMessage,
		columns: ['Type', 'Catalog #', 'Manufacturer', 'Description', 'Qty', 'Unit DN'],
		lines: emailLines,
		totalsLines: [
			{ label: 'Subtotal', value: usd.format(subtotal) },
			...(addedFreight > 0
				? [{ label: 'Added freight', value: usd.format(addedFreight) }]
				: [])
		],
		grandLabel: 'PO Total',
		grandValue: usd.format(grandTotal),
		appUrl,
		docUrl,
		closing: 'Please confirm receipt and expected ship dates.'
	});
	const text = renderDocEmailText({
		docKindLabel: 'Purchase Order',
		docNo: po.poNo,
		projectName: project.name,
		recipientName: poRow.repFirm,
		pmName,
		pmEmail,
		customMessage: po.customEmailMessage,
		columns: ['Type', 'Catalog #', 'Manufacturer', 'Description', 'Qty', 'Unit DN'],
		lines: emailLines,
		totalsLines: [
			{ label: 'Subtotal', value: usd.format(subtotal) },
			...(addedFreight > 0
				? [{ label: 'Added freight', value: usd.format(addedFreight) }]
				: [])
		],
		grandLabel: 'PO Total',
		grandValue: usd.format(grandTotal),
		appUrl,
		docUrl,
		closing: 'Please confirm receipt and expected ship dates.'
	});

	// Render PDF for attachment
	const deliveryAddress = [
		project.deliveryStreet,
		[project.deliveryCity, project.deliveryState, project.deliveryZip].filter(Boolean).join(' ')
	]
		.filter((s) => s && s.trim() !== '')
		.join('\n');
	const pdfData: PoPdfData = {
		poNo: po.poNo,
		status: po.status,
		versionNo: po.versionNo,
		orderedDate: po.orderedDate?.toISOString() ?? null,
		sentAt: new Date().toISOString(),
		createdAt: po.createdAt.toISOString(),
		description: po.description,
		notes: po.notes,
		customEmailMessage: po.customEmailMessage,
		addedFreight: po.addedFreight,
		repQuoteNo: po.repQuoteNo,
		trackingNumber: po.trackingNumber,
		shipToText: po.shipToText,
		ilcOfficeAddress: po.ilcOfficeAddress,
		sendFromEmail: po.sendFromEmail,
		sendToEmail: po.sendToEmail,
		projectName: project.name,
		soNo: poRow.soNo,
		repFirm: poRow.repFirm,
		repFirmOrderEmails: poRow.repFirmOrderEmails,
		deliveryAddress: deliveryAddress || null,
		lines: lines.map((l) => ({
			type: l.typeNameSnapshot,
			catalogNo: l.catalogNoSnapshot,
			manufacturer: l.manufacturerNameSnapshot,
			description: l.descriptionSnapshot,
			qty: l.qty,
			qtyType: l.qtyType,
			unitDn: l.unitDn,
			repQuoteNo: l.repQuoteNo
		}))
	};
	const pdfBuffer = await renderPoPdf(pdfData);

	const result = await sendEmail({
		to: recipients,
		replyTo: po.sendFromEmail ?? pmEmail,
		subject: `Purchase Order ${po.poNo} — ${project.name}`,
		html,
		text,
		attachments: [
			{
				filename: `${po.poNo}.pdf`,
				content: pdfBuffer
			}
		]
	});

	if (!result.ok) return { error: result.error ?? 'Email send failed' };

	// Auto-stamp sentAt + flip status to 'sent' if still draft
	await db
		.update(purchaseOrders)
		.set({
			status: po.status === 'draft' ? 'sent' : po.status,
			sentAt: po.sentAt ?? new Date(),
			updatedAt: new Date()
		})
		.where(eq(purchaseOrders.id, poId));

	revalidatePath(`/projects/${projectId}/pos/${poId}`);
	revalidatePath(`/projects/${projectId}/pos`);

	return { ok: true, sentTo: recipients, redirectedTo: result.redirectedTo };
}

