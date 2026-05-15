import { db } from '@/lib/db';
import {
	budgets,
	budgetLines,
	projects,
	companies
} from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { eq, and } from 'drizzle-orm';
import { renderBudgetPdf } from '@/lib/pdf/render';
import { type BudgetPdfData } from '@/lib/pdf/budget';
import { NextResponse } from 'next/server';

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string; budgetId: string }> }
) {
	await requireUser();
	const { id, budgetId } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) return new NextResponse('Project not found', { status: 404 });

	const budget = (
		await db
			.select()
			.from(budgets)
			.where(and(eq(budgets.id, budgetId), eq(budgets.projectId, id)))
			.limit(1)
	)[0];
	if (!budget) return new NextResponse('Budget not found', { status: 404 });

	const client = project.clientCompanyId
		? (
				await db
					.select({ name: companies.name })
					.from(companies)
					.where(eq(companies.id, project.clientCompanyId))
					.limit(1)
			)[0]
		: null;

	const lines = await db
		.select()
		.from(budgetLines)
		.where(eq(budgetLines.budgetId, budgetId))
		.orderBy(budgetLines.manufacturerNameSnapshot, budgetLines.catalogNoSnapshot);

	const data: BudgetPdfData = {
		budgetNo: budget.budgetNo,
		status: budget.status,
		description: budget.description,
		createdAt: budget.createdAt.toISOString(),
		updatedAt: budget.updatedAt.toISOString(),
		marginPct: budget.marginPct,
		freightPct: budget.freightPct,
		warehousingPct: budget.warehousingPct,
		salesTaxPct: budget.salesTaxPct,
		projectName: project.name,
		clientCompany: client?.name ?? null,
		totalSf: project.totalSf,
		targetBudget: project.targetBudgetTotal,
		targetDollarsPerSf: project.targetDollarsPerSf,
		lines: lines.map((l) => ({
			type: l.typeNameSnapshot,
			catalogNo: l.catalogNoSnapshot,
			manufacturer: l.manufacturerNameSnapshot,
			description: l.descriptionSnapshot,
			qty: l.qty,
			unitDn: l.unitDn
		}))
	};

	const buffer = await renderBudgetPdf(data);

	return new NextResponse(buffer as unknown as BodyInit, {
		status: 200,
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="${budget.budgetNo}.pdf"`,
			'Cache-Control': 'private, no-cache'
		}
	});
}
