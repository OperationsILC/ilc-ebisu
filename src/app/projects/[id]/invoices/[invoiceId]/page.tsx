import { db } from '@/lib/db';
import {
	invoices,
	invoiceLines,
	projects,
	salesOrders,
	companies,
	users,
	clientCredits
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import InvoiceDetailClient from './InvoiceDetailClient';
import { listDeliveredUninvoicedLines } from '../actions';

export default async function InvoiceDetailPage({
	params
}: {
	params: Promise<{ id: string; invoiceId: string }>;
}) {
	const { id, invoiceId } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const invRow = (
		await db
			.select({
				inv: invoices,
				soNo: salesOrders.soNo,
				clientCompany: companies.name,
				clientCompanyId: companies.id,
				creatorEmail: users.email
			})
			.from(invoices)
			.leftJoin(salesOrders, eq(invoices.salesOrderId, salesOrders.id))
			.leftJoin(companies, eq(companies.id, projects.clientCompanyId))
			.leftJoin(users, eq(users.id, invoices.createdByUserId))
			.where(and(eq(invoices.id, invoiceId), eq(invoices.projectId, id)))
			.limit(1)
	)[0];
	if (!invRow) notFound();
	const inv = invRow.inv;

	const lines = await db
		.select()
		.from(invoiceLines)
		.where(eq(invoiceLines.invoiceId, invoiceId))
		.orderBy(invoiceLines.manufacturerSnapshot, invoiceLines.catalogNoSnapshot);

	// For product invoices: pull delivered-but-uninvoiced candidates so the
	// "Add from delivered" panel can render in the same load.
	const deliveredCandidates =
		inv.type === 'product' && inv.salesOrderId
			? await listDeliveredUninvoicedLines(id, inv.salesOrderId)
			: [];

	// Client's available credit balance, if we know the client.
	let availableCredit = 0;
	if (invRow.clientCompanyId) {
		const [creditTotals] = await db
			.select({
				total: sql<string>`coalesce(sum(${clientCredits.amount}), 0)`
			})
			.from(clientCredits)
			.where(eq(clientCredits.clientCompanyId, invRow.clientCompanyId));
		const totalCredits = Number(creditTotals?.total ?? 0);

		// Subtract credit already applied to other invoices for this client.
		const [appliedAgg] = await db.execute<{ applied: string }>(sql`
			SELECT coalesce(sum(credit_applied_amount), 0) AS applied
			FROM invoices
			WHERE project_id IN (SELECT id FROM projects WHERE client_company_id = ${invRow.clientCompanyId})
				AND status != 'void'
				AND id != ${invoiceId}
		`).then((r) => r.rows as Array<{ applied: string }>);
		const otherApplied = Number(appliedAgg?.applied ?? 0);
		availableCredit = Math.max(totalCredits - otherApplied, 0);
	}

	return (
		<InvoiceDetailClient
			projectId={project.id}
			projectName={project.name}
			availableCredit={availableCredit}
			invoice={{
				id: inv.id,
				invoiceNo: inv.invoiceNo,
				type: inv.type,
				status: inv.status,
				designPhase: inv.designPhase,
				invoiceDate: inv.invoiceDate?.toISOString() ?? null,
				dueDate: inv.dueDate?.toISOString() ?? null,
				clientPoNo: inv.clientPoNo,
				salesTaxPct: inv.salesTaxPct,
				salesTaxName: inv.salesTaxName,
				depositAppliedAmount: inv.depositAppliedAmount,
				creditAppliedAmount: inv.creditAppliedAmount,
				totalAmount: inv.totalAmount,
				amountDue: inv.amountDue,
				paidAmount: inv.paidAmount,
				sentAt: inv.sentAt?.toISOString() ?? null,
				paidAt: inv.paidAt?.toISOString() ?? null,
				qboStatus: inv.qboStatus,
				qboId: inv.qboId,
				qboPushedAt: inv.qboPushedAt?.toISOString() ?? null,
				qboLastError: inv.qboLastError,
				createdAt: inv.createdAt.toISOString(),
				soNo: invRow.soNo,
				soId: inv.salesOrderId,
				clientCompany: invRow.clientCompany,
				creatorEmail: invRow.creatorEmail
			}}
			lines={lines.map((l) => ({
				id: l.id,
				orderLineId: l.orderLineId,
				type: l.typeSnapshot,
				catalogNo: l.catalogNoSnapshot,
				manufacturer: l.manufacturerSnapshot,
				description: l.descriptionSnapshot,
				designFeeDescription: l.designFeeDescription,
				qtyInvoiced: l.qtyInvoiced,
				qtyType: l.qtyType,
				unitCnSnapshot: l.unitCnSnapshot,
				lineTotal: l.lineTotal
			}))}
			deliveredCandidates={deliveredCandidates}
		/>
	);
}
