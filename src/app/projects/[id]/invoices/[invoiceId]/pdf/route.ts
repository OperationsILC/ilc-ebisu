import { db } from '@/lib/db';
import {
	invoices,
	invoiceLines,
	salesOrders,
	projects,
	companies
} from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { eq, and } from 'drizzle-orm';
import { renderInvoicePdf } from '@/lib/pdf/render';
import { type InvoicePdfData } from '@/lib/pdf/invoice';
import { NextResponse } from 'next/server';

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
	await requireUser();
	const { id, invoiceId } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) return new NextResponse('Project not found', { status: 404 });

	const row = (
		await db
			.select({
				inv: invoices,
				clientCompany: companies.name,
				soNo: salesOrders.soNo
			})
			.from(invoices)
			.leftJoin(companies, eq(companies.id, projects.clientCompanyId))
			.leftJoin(salesOrders, eq(invoices.salesOrderId, salesOrders.id))
			.innerJoin(projects, eq(projects.id, invoices.projectId))
			.where(and(eq(invoices.id, invoiceId), eq(invoices.projectId, id)))
			.limit(1)
	)[0];
	if (!row) return new NextResponse('Invoice not found', { status: 404 });

	const lines = await db
		.select()
		.from(invoiceLines)
		.where(eq(invoiceLines.invoiceId, invoiceId))
		.orderBy(invoiceLines.manufacturerSnapshot, invoiceLines.catalogNoSnapshot);

	const data: InvoicePdfData = {
		invoiceNo: row.inv.invoiceNo,
		type: row.inv.type,
		status: row.inv.status,
		invoiceDate: row.inv.invoiceDate?.toISOString() ?? null,
		dueDate: row.inv.dueDate?.toISOString() ?? null,
		clientPoNo: row.inv.clientPoNo,
		clientPoProjectNo: null, // project-level CLIENT PO# not yet on projects schema; surfacing here when added
		designPhase: row.inv.designPhase,
		salesTaxPct: row.inv.salesTaxPct,
		salesTaxName: row.inv.salesTaxName,
		depositAppliedAmount: row.inv.depositAppliedAmount,
		creditAppliedAmount: row.inv.creditAppliedAmount,
		totalAmount: row.inv.totalAmount,
		amountDue: row.inv.amountDue,
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

	const buffer = await renderInvoicePdf(data);

	return new NextResponse(buffer as unknown as BodyInit, {
		status: 200,
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="${row.inv.invoiceNo}.pdf"`,
			'Cache-Control': 'private, no-cache'
		}
	});
}
