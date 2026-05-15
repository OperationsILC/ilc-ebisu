'use server';

import { db } from '@/lib/db';
import {
	invoices,
	invoiceLines,
	salesOrders,
	projects,
	companies
} from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { recomputeInvoiceTotals } from '../actions';
import { sendEmail } from '@/lib/email';
import {
	renderDocEmailHtml,
	renderDocEmailText,
	parseEmails,
	type DocEmailLine
} from '@/lib/doc-email';
import { renderInvoicePdf } from '@/lib/pdf/render';
import { type InvoicePdfData } from '@/lib/pdf/invoice';

export async function updateInvoiceHeader(
	projectId: string,
	invoiceId: string,
	formData: FormData
): Promise<void> {
	await requireUser();
	const raw = Object.fromEntries(formData) as Record<string, string>;

	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (raw.invoiceDate !== undefined) {
		const t = raw.invoiceDate.trim();
		updates.invoiceDate = t === '' ? null : new Date(t);
	}
	if (raw.dueDate !== undefined) {
		const t = raw.dueDate.trim();
		updates.dueDate = t === '' ? null : new Date(t);
	}
	if (raw.clientPoNo !== undefined) {
		updates.clientPoNo = raw.clientPoNo.trim() === '' ? null : raw.clientPoNo.trim();
	}
	if (raw.salesTaxPct !== undefined) {
		const t = raw.salesTaxPct.trim();
		if (t === '') updates.salesTaxPct = null;
		else if (Number.isFinite(Number(t))) updates.salesTaxPct = t;
	}
	if (raw.salesTaxName !== undefined) {
		updates.salesTaxName = raw.salesTaxName.trim() === '' ? null : raw.salesTaxName.trim();
	}
	if (raw.designPhase !== undefined) {
		updates.designPhase = raw.designPhase.trim() === '' ? null : raw.designPhase.trim();
	}

	await db
		.update(invoices)
		.set(updates)
		.where(and(eq(invoices.id, invoiceId), eq(invoices.projectId, projectId)));

	// Tax % changes affect total; recompute.
	if ('salesTaxPct' in updates) {
		await recomputeInvoiceTotals(invoiceId);
	}

	revalidatePath(`/projects/${projectId}/invoices/${invoiceId}`);
	revalidatePath(`/projects/${projectId}/invoices`);
}

// ---------------------------------------------------------------------------
// Send invoice via email (PDF attached)
// ---------------------------------------------------------------------------

export type SendInvoiceResult = {
	ok?: boolean;
	error?: string;
	sentTo?: string[];
	redirectedTo?: string[];
};

export async function sendInvoiceEmail(
	projectId: string,
	invoiceId: string,
	recipientsRaw: string
): Promise<SendInvoiceResult> {
	const me = await requireUser();
	const recipients = parseEmails(recipientsRaw);
	if (recipients.length === 0)
		return { error: 'At least one valid email recipient required.' };

	const project = (await db.select().from(projects).where(eq(projects.id, projectId)).limit(1))[0];
	if (!project) return { error: 'Project not found' };

	const row = (
		await db
			.select({
				inv: invoices,
				soNo: salesOrders.soNo,
				clientCompany: companies.name
			})
			.from(invoices)
			.leftJoin(salesOrders, eq(invoices.salesOrderId, salesOrders.id))
			.leftJoin(companies, eq(companies.id, projects.clientCompanyId))
			.innerJoin(projects, eq(projects.id, invoices.projectId))
			.where(and(eq(invoices.id, invoiceId), eq(invoices.projectId, projectId)))
			.limit(1)
	)[0];
	if (!row) return { error: 'Invoice not found' };
	const inv = row.inv;

	const lines = await db
		.select()
		.from(invoiceLines)
		.where(eq(invoiceLines.invoiceId, invoiceId))
		.orderBy(invoiceLines.manufacturerSnapshot, invoiceLines.catalogNoSnapshot);
	if (lines.length === 0) return { error: 'Invoice has no lines to send.' };

	const isProduct = inv.type === 'product';
	const isCredit = inv.type === 'credit_memo';
	const usd = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});

	let subtotal = 0;
	const emailLines: DocEmailLine[] = lines.map((l) => {
		const qty = Number(l.qtyInvoiced ?? 0);
		const unit = Number(l.unitCnSnapshot ?? 0);
		const lineTotal = Number(l.lineTotal ?? qty * unit);
		subtotal += lineTotal;
		if (isProduct) {
			return {
				c1: l.typeSnapshot,
				c2: l.catalogNoSnapshot,
				c3: l.manufacturerSnapshot,
				c4: l.descriptionSnapshot,
				c5: l.qtyInvoiced ? Number(l.qtyInvoiced).toLocaleString() : null,
				c6: lineTotal !== 0 ? usd.format(lineTotal) : null
			};
		}
		return {
			c1: null,
			c2: null,
			c3: null,
			c4: l.designFeeDescription ?? l.descriptionSnapshot,
			c5: l.qtyInvoiced ? Number(l.qtyInvoiced).toLocaleString() : null,
			c6: lineTotal !== 0 ? usd.format(lineTotal) : null
		};
	});

	const taxPct = Number(inv.salesTaxPct ?? 0);
	const taxAmt = isProduct ? subtotal * (taxPct / 100) : 0;
	const total = Number(inv.totalAmount ?? subtotal + taxAmt);
	const credit = Number(inv.creditAppliedAmount ?? 0);
	const deposit = Number(inv.depositAppliedAmount ?? 0);
	const due = Number(inv.amountDue ?? Math.max(total - credit - deposit, 0));

	const appUrl = process.env.AUTH_URL ?? '';
	const docUrl = appUrl ? `${appUrl}/projects/${projectId}/invoices/${invoiceId}` : '';

	const docKindLabel =
		inv.type === 'design_fee'
			? 'Design Fee Invoice'
			: inv.type === 'credit_memo'
				? 'Credit Memo'
				: 'Invoice';

	const totalsLines = [
		{ label: 'Subtotal', value: usd.format(subtotal) },
		...(isProduct && taxAmt !== 0
			? [{ label: `${inv.salesTaxName ?? 'Sales tax'} (${taxPct}%)`, value: usd.format(taxAmt) }]
			: []),
		...(deposit > 0 ? [{ label: 'Deposit applied', value: '-' + usd.format(deposit) }] : []),
		...(credit > 0 ? [{ label: 'Credit applied', value: '-' + usd.format(credit) }] : [])
	];

	const closing =
		isCredit
			? 'This credit may be applied against any future invoice. Please contact ILC Studios with questions.'
			: inv.dueDate
				? `Payment due ${new Date(inv.dueDate).toLocaleDateString()}. Reference invoice ${inv.invoiceNo} on payment.`
				: `Payment due upon receipt. Reference invoice ${inv.invoiceNo} on payment.`;

	const columns = isProduct
		? ['Type', 'Catalog #', 'Manufacturer', 'Description', 'Qty', 'Total']
		: ['', '', '', 'Description', 'Qty', 'Total'];

	const html = renderDocEmailHtml({
		docKindLabel,
		docNo: inv.invoiceNo,
		projectName: project.name,
		recipientName: row.clientCompany,
		pmName: me.name ?? null,
		pmEmail: me.email,
		customMessage: null,
		columns,
		lines: emailLines,
		totalsLines,
		grandLabel: isCredit ? 'Credit total' : 'Amount due',
		grandValue: usd.format(due),
		appUrl,
		docUrl,
		closing
	});
	const text = renderDocEmailText({
		docKindLabel,
		docNo: inv.invoiceNo,
		projectName: project.name,
		recipientName: row.clientCompany,
		pmName: me.name ?? null,
		pmEmail: me.email,
		customMessage: null,
		columns,
		lines: emailLines,
		totalsLines,
		grandLabel: isCredit ? 'Credit total' : 'Amount due',
		grandValue: usd.format(due),
		appUrl,
		docUrl,
		closing
	});

	const pdfData: InvoicePdfData = {
		invoiceNo: inv.invoiceNo,
		type: inv.type,
		status: inv.status,
		invoiceDate: inv.invoiceDate?.toISOString() ?? null,
		dueDate: inv.dueDate?.toISOString() ?? null,
		clientPoNo: inv.clientPoNo,
		clientPoProjectNo: null,
		designPhase: inv.designPhase,
		salesTaxPct: inv.salesTaxPct,
		salesTaxName: inv.salesTaxName,
		depositAppliedAmount: inv.depositAppliedAmount,
		creditAppliedAmount: inv.creditAppliedAmount,
		totalAmount: inv.totalAmount,
		amountDue: inv.amountDue,
		projectName: project.name,
		clientCompany: row.clientCompany,
		soNo: row.soNo,
		lines: lines.map((l) => ({
			type: l.typeSnapshot,
			catalogNo: l.catalogNoSnapshot,
			manufacturer: l.manufacturerSnapshot,
			description: l.descriptionSnapshot,
			designFeeDescription: l.designFeeDescription,
			qty: l.qtyInvoiced,
			qtyType: l.qtyType,
			unitCn: l.unitCnSnapshot,
			lineTotal: l.lineTotal
		}))
	};
	const pdfBuffer = await renderInvoicePdf(pdfData);

	const result = await sendEmail({
		to: recipients,
		replyTo: me.email,
		subject: `${docKindLabel} ${inv.invoiceNo} — ${project.name}`,
		html,
		text,
		attachments: [{ filename: `${inv.invoiceNo}.pdf`, content: pdfBuffer }]
	});

	if (!result.ok) return { error: result.error ?? 'Email send failed' };

	// Flip to sent if still draft
	await db
		.update(invoices)
		.set({
			status: inv.status === 'draft' ? 'sent' : inv.status,
			sentAt: inv.sentAt ?? new Date(),
			updatedAt: new Date()
		})
		.where(eq(invoices.id, invoiceId));

	revalidatePath(`/projects/${projectId}/invoices/${invoiceId}`);
	revalidatePath(`/projects/${projectId}/invoices`);

	return { ok: true, sentTo: recipients, redirectedTo: result.redirectedTo };
}
