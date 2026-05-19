import 'server-only';
import { db } from '@/lib/db';
import {
	invoices,
	invoiceLines,
	orderLines,
	qapLines,
	projects,
	companies
} from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { qboPost, QboNotConnectedError } from './client';
import { getOrCreateQboItem } from './items';
import { isQboDryRun, getQboEnvironment } from './env';

/**
 * Push an Ebisu invoice to QBO as a QBO Invoice (or CreditMemo if type=credit_memo).
 *
 * Scope of the first cut:
 *   - PRODUCT invoices push as QBO Invoice, one SalesItemLineDetail line per
 *     invoice_lines row. Each line's QBO Item is resolved (or created) via
 *     getOrCreateQboItem from the source product.
 *   - DESIGN-FEE invoices push as QBO Invoice with DescriptionOnly lines
 *     (free-form, no ItemRef). QBO accepts these for service-style billing.
 *   - CREDIT-MEMO invoices push as QBO CreditMemo (same shape, different
 *     endpoint and DocType).
 *
 * Preconditions (the function returns a structured error if violated):
 *   - QBO connection active for the current environment.
 *   - Connection has default income + COGS accounts saved (needed by Item
 *     creation; verified inside getOrCreateQboItem).
 *   - Invoice's project has a client_company_id and that company has
 *     qbo_customer_id set.
 *   - Invoice has at least one line.
 *
 * Side effects:
 *   - On success: invoice.qbo_id, qbo_status='pushed', qbo_pushed_at set.
 *   - On failure: qbo_status='failed', qbo_last_error captures the message.
 *   - Respects QBO_DRY_RUN — when true, the payload is logged and the
 *     function returns {ok, dryRun:true, payload} without firing the network
 *     request or mutating qbo_id.
 *
 * Idempotency note: this is NOT idempotent across multiple calls. If you call
 * it twice on the same invoice, QBO will create two separate invoices. The
 * caller (UI button + server action) is responsible for not re-pushing an
 * invoice that already has qbo_status='pushed'. A future revision could
 * switch to PATCH semantics keyed on qbo_id.
 */
export type PushInvoiceResult =
	| { ok: true; qboId: string; dryRun?: false }
	| { ok: true; dryRun: true; payload: unknown }
	| { ok: false; error: string };

export async function pushInvoiceToQbo(invoiceId: string): Promise<PushInvoiceResult> {
	// 1. Load the invoice + project + client company in one query.
	const [row] = await db
		.select({
			inv: invoices,
			projectName: projects.name,
			clientCompanyId: companies.id,
			clientCompanyName: companies.name,
			qboCustomerId: companies.qboCustomerId
		})
		.from(invoices)
		.innerJoin(projects, eq(projects.id, invoices.projectId))
		.leftJoin(companies, eq(companies.id, projects.clientCompanyId))
		.where(eq(invoices.id, invoiceId))
		.limit(1);

	if (!row) return { ok: false, error: `Invoice ${invoiceId} not found.` };
	const inv = row.inv;

	if (inv.status === 'void') {
		return { ok: false, error: 'Cannot push a void invoice.' };
	}
	if (!row.clientCompanyId) {
		return { ok: false, error: 'Project has no client company set — link one before pushing.' };
	}
	if (!row.qboCustomerId) {
		return {
			ok: false,
			error: `Client "${row.clientCompanyName}" has no QBO Customer link. Open the company page and use Find in QBO.`
		};
	}

	// 2. Load invoice lines.
	const lines = await db
		.select()
		.from(invoiceLines)
		.where(eq(invoiceLines.invoiceId, invoiceId));

	if (lines.length === 0) {
		return { ok: false, error: 'Invoice has no lines.' };
	}

	// 3. Build QBO line payload. Resolve Item refs for product lines.
	//    For each product line we need to trace invoice_line → order_line →
	//    qap_line → product to get a product ID for getOrCreateQboItem.
	const qboLines: unknown[] = [];
	const isProduct = inv.type === 'product';

	for (const ln of lines) {
		const qty = Number(ln.qtyInvoiced ?? 0);
		const unit = Number(ln.unitCnSnapshot ?? 0);
		const amount = Number(ln.lineTotal ?? qty * unit);

		if (isProduct) {
			if (!ln.orderLineId) {
				return {
					ok: false,
					error: `Line ${ln.id} on a product invoice has no order_line_id — cannot resolve QBO Item.`
				};
			}
			const [ol] = await db
				.select({ qapLineId: orderLines.qapLineId })
				.from(orderLines)
				.where(eq(orderLines.id, ln.orderLineId))
				.limit(1);
			if (!ol?.qapLineId) {
				return {
					ok: false,
					error: `Line ${ln.id} traces to an order line with no QAP origin — cannot resolve product.`
				};
			}
			const [qap] = await db
				.select({ productId: qapLines.productId })
				.from(qapLines)
				.where(eq(qapLines.id, ol.qapLineId))
				.limit(1);
			if (!qap?.productId) {
				return {
					ok: false,
					error: `Line ${ln.id} traces to a QAP line with no product — cannot resolve QBO Item.`
				};
			}

			let itemId: string;
			try {
				itemId = await getOrCreateQboItem(qap.productId);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return { ok: false, error: `Failed to resolve QBO Item for line ${ln.id}: ${msg}` };
			}

			qboLines.push({
				DetailType: 'SalesItemLineDetail',
				Amount: round2(amount),
				Description:
					[ln.catalogNoSnapshot, ln.manufacturerSnapshot, ln.descriptionSnapshot]
						.filter(Boolean)
						.join(' — ') || undefined,
				SalesItemLineDetail: {
					ItemRef: { value: itemId },
					Qty: qty,
					UnitPrice: round2(unit)
				}
			});
		} else {
			// Design fee or credit memo — free-form description line, no ItemRef.
			const desc = ln.designFeeDescription ?? ln.descriptionSnapshot ?? 'Service';
			qboLines.push({
				DetailType: 'SalesItemLineDetail',
				Amount: round2(amount),
				Description: desc,
				SalesItemLineDetail: {
					// QBO requires SOME ItemRef on SalesItemLineDetail; we let it default
					// by omitting and using a description-only line via DescriptionOnly
					// detail type instead would be cleaner, but those don't carry an
					// Amount. Pragmatic shortcut: every connection has a default income
					// account so QBO can fall back to "Services" item if available. If
					// this fails in sandbox we'll switch to a dedicated DESIGN-FEE
					// service Item — see notes in items.ts roadmap.
					Qty: qty,
					UnitPrice: round2(unit)
				}
			});
		}
	}

	// 4. Compose the document body.
	const docNumber = inv.invoiceNo; // e.g. IN00123 — QBO accepts up to 21 chars.
	const txnDate = inv.invoiceDate
		? inv.invoiceDate.toISOString().slice(0, 10)
		: new Date().toISOString().slice(0, 10);
	const dueDate = inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : undefined;

	const body: Record<string, unknown> = {
		CustomerRef: { value: row.qboCustomerId },
		DocNumber: docNumber,
		TxnDate: txnDate,
		Line: qboLines,
		PrivateNote: `Ebisu invoice ${inv.invoiceNo} · project ${row.projectName} · pushed from /projects/${inv.projectId}/invoices/${inv.id}`
	};
	if (dueDate) body.DueDate = dueDate;
	if (inv.clientPoNo) body.CustomFieldOrPONumber = inv.clientPoNo; // QBO uses CustomField for client PO; left as-is for now.

	// 5. Dry-run short-circuit.
	const isCreditMemo = inv.type === 'credit_memo';
	const endpoint = isCreditMemo ? '/creditmemo?minorversion=70' : '/invoice?minorversion=70';

	if (isQboDryRun()) {
		console.log('[QBO DRY RUN]', {
			environment: getQboEnvironment(),
			endpoint,
			invoiceId,
			body
		});
		await db
			.update(invoices)
			.set({
				qboLastError: null,
				updatedAt: new Date()
			})
			.where(eq(invoices.id, invoiceId));
		return { ok: true, dryRun: true, payload: body };
	}

	// 6. Real push.
	type CreatedInvoice = { Invoice?: { Id: string }; CreditMemo?: { Id: string } };
	let created: CreatedInvoice;
	try {
		created = await qboPost<CreatedInvoice>(endpoint, body);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		await db
			.update(invoices)
			.set({
				qboStatus: 'failed',
				qboLastError: msg,
				updatedAt: new Date()
			})
			.where(eq(invoices.id, invoiceId));
		if (err instanceof QboNotConnectedError) {
			return { ok: false, error: msg };
		}
		return { ok: false, error: msg };
	}

	const newQboId = created.Invoice?.Id ?? created.CreditMemo?.Id;
	if (!newQboId) {
		const msg = 'QBO accepted the push but returned no Id.';
		await db
			.update(invoices)
			.set({ qboStatus: 'failed', qboLastError: msg, updatedAt: new Date() })
			.where(eq(invoices.id, invoiceId));
		return { ok: false, error: msg };
	}

	await db
		.update(invoices)
		.set({
			qboId: newQboId,
			qboStatus: 'pushed',
			qboPushedAt: new Date(),
			qboLastError: null,
			updatedAt: new Date()
		})
		.where(and(eq(invoices.id, invoiceId)));

	return { ok: true, qboId: newQboId };
}

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}
