// DocParser → Ebisu inbound bill webhook.
//
// DocParser posts the OCR'd contents of a manufacturer's bill PDF to this
// endpoint. We create a `bills` row in 'pending_review' status, attempt to
// auto-link it to its PO via the extracted PO number (e.g. "PO0113"), and
// store the raw extraction on `source_parsed_json` for audit.
//
// Auth: shared-secret header. Set `BILLS_INBOUND_SECRET` in env; DocParser
// must POST with `X-Ebisu-Secret: <value>`.
//
// Expected payload shape — DocParser configures fields, but we accept a
// flexible map. The mapping below is best-effort; PMs review and correct.
//
//   {
//     "po_number":      "PO0113",        // matched against purchase_orders.po_no
//     "vendor_bill_no": "L-123456",      // vendor's own bill number
//     "vendor_name":    "LOGIQ SUPPLY",  // matched against companies.name
//     "bill_date":      "2026-05-14",
//     "due_date":       "2026-06-14",
//     "total":          1234.56,
//     "pdf_url":        "https://...",   // where the original PDF lives
//     "lines": [
//       { "catalog_no":"WD-7-3K", "description":"...", "qty":25, "unit_price":138.50 },
//       ...
//     ],
//     "raw": { ...whatever DocParser sent... }
//   }

import { db } from '@/lib/db';
import { bills, billLines, purchaseOrders, companies } from '@/lib/db/schema';
import { count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const InboundSchema = z.object({
	po_number: z.string().optional(),
	vendor_bill_no: z.string().optional(),
	vendor_name: z.string().optional(),
	bill_date: z.string().optional(),
	due_date: z.string().optional(),
	total: z.union([z.number(), z.string()]).optional(),
	pdf_url: z.string().url().optional(),
	lines: z
		.array(
			z.object({
				catalog_no: z.string().optional(),
				description: z.string().optional(),
				qty: z.union([z.number(), z.string()]).optional(),
				unit_price: z.union([z.number(), z.string()]).optional(),
				line_total: z.union([z.number(), z.string()]).optional()
			})
		)
		.optional(),
	raw: z.unknown().optional()
});

export async function POST(req: Request) {
	const secret = req.headers.get('x-ebisu-secret');
	const expected = process.env.BILLS_INBOUND_SECRET;
	if (!expected || secret !== expected) {
		return new NextResponse('Unauthorized', { status: 401 });
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const parsed = InboundSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: 'Invalid payload', issues: parsed.error.issues },
			{ status: 400 }
		);
	}
	const v = parsed.data;

	// Try to match PO. We accept the bare PO# (e.g. "PO0113") or the legacy
	// angle-bracket form (e.g. "<PO0113>") by stripping non-alphanumeric chars.
	let purchaseOrderId: string | null = null;
	let projectId: string | null = null;
	if (v.po_number) {
		const cleaned = v.po_number.replace(/[^A-Za-z0-9]/g, '');
		const matchedPo = (
			await db
				.select({ id: purchaseOrders.id, projectId: purchaseOrders.projectId })
				.from(purchaseOrders)
				.where(eq(purchaseOrders.poNo, cleaned))
				.limit(1)
		)[0];
		if (matchedPo) {
			purchaseOrderId = matchedPo.id;
			projectId = matchedPo.projectId;
		}
	}

	// Try to match vendor by name (case-sensitive — Sean's QBO convention)
	let vendorCompanyId: string | null = null;
	if (v.vendor_name) {
		const vendor = (
			await db
				.select({ id: companies.id })
				.from(companies)
				.where(eq(companies.name, v.vendor_name))
				.limit(1)
		)[0];
		if (vendor) vendorCompanyId = vendor.id;
	}

	const [{ n }] = await db.select({ n: count() }).from(bills);
	const billNo = `BL${String(Number(n) + 1).padStart(5, '0')}`;

	const total = v.total !== undefined ? String(v.total) : null;

	const [created] = await db
		.insert(bills)
		.values({
			projectId,
			purchaseOrderId,
			vendorCompanyId,
			billNo,
			vendorBillNo: v.vendor_bill_no ?? null,
			billDate: v.bill_date ? new Date(v.bill_date) : null,
			dueDate: v.due_date ? new Date(v.due_date) : null,
			totalAmount: total,
			status: 'pending_review',
			sourcePdfUrl: v.pdf_url ?? null,
			sourceParsedJson: (body ?? null) as never
		})
		.returning({ id: bills.id });

	if (v.lines && v.lines.length > 0) {
		await db.insert(billLines).values(
			v.lines.map((l) => {
				const qtyN = l.qty !== undefined ? Number(l.qty) : null;
				const unitN = l.unit_price !== undefined ? Number(l.unit_price) : null;
				const lineTotal =
					l.line_total !== undefined
						? String(l.line_total)
						: qtyN !== null && unitN !== null
							? String(qtyN * unitN)
							: null;
				return {
					billId: created.id,
					descriptionText: l.description ?? null,
					catalogNoText: l.catalog_no ?? null,
					qty: l.qty !== undefined ? String(l.qty) : null,
					unitPrice: l.unit_price !== undefined ? String(l.unit_price) : null,
					lineTotal
				};
			})
		);
	}

	return NextResponse.json({
		ok: true,
		billId: created.id,
		billNo,
		matchedPo: !!purchaseOrderId,
		matchedVendor: !!vendorCompanyId,
		matchedProject: !!projectId
	});
}
