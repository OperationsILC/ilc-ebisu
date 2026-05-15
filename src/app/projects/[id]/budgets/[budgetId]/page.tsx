import { db } from '@/lib/db';
import {
	budgets,
	budgetLines,
	qapLines,
	projects,
	products,
	companies,
	types
} from '@/lib/db/schema';
import { eq, and, sql, notInArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import BudgetDetailClient from './BudgetDetailClient';

export default async function BudgetDetailPage({
	params
}: {
	params: Promise<{ id: string; budgetId: string }>;
}) {
	const { id, budgetId } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const budget = (
		await db
			.select()
			.from(budgets)
			.where(and(eq(budgets.id, budgetId), eq(budgets.projectId, id)))
			.limit(1)
	)[0];
	if (!budget) notFound();

	const lines = await db
		.select()
		.from(budgetLines)
		.where(eq(budgetLines.budgetId, budgetId))
		.orderBy(budgetLines.manufacturerNameSnapshot, budgetLines.catalogNoSnapshot);

	// QAP lines NOT already on this budget — for the "Add lines from QAP" panel.
	const onBudgetIds = lines.map((l) => l.qapLineId).filter((x): x is string => x !== null);

	const availableQapLines = await (onBudgetIds.length > 0
		? db
				.select({
					id: qapLines.id,
					typeName: types.name,
					catalogNo: products.catalogNo,
					manufacturer: companies.name,
					description: qapLines.description,
					qty: qapLines.qty,
					currentDn: qapLines.currentDn
				})
				.from(qapLines)
				.innerJoin(types, eq(qapLines.typeId, types.id))
				.innerJoin(products, eq(qapLines.productId, products.id))
				.leftJoin(companies, eq(products.manufacturerCompanyId, companies.id))
				.where(and(eq(qapLines.projectId, id), notInArray(qapLines.id, onBudgetIds)))
				.orderBy(companies.name, types.name, products.catalogNo)
		: db
				.select({
					id: qapLines.id,
					typeName: types.name,
					catalogNo: products.catalogNo,
					manufacturer: companies.name,
					description: qapLines.description,
					qty: qapLines.qty,
					currentDn: qapLines.currentDn
				})
				.from(qapLines)
				.innerJoin(types, eq(qapLines.typeId, types.id))
				.innerJoin(products, eq(qapLines.productId, products.id))
				.leftJoin(companies, eq(products.manufacturerCompanyId, companies.id))
				.where(eq(qapLines.projectId, id))
				.orderBy(companies.name, types.name, products.catalogNo));

	return (
		<BudgetDetailClient
			projectId={project.id}
			projectName={project.name}
			projectTotalSf={project.totalSf}
			projectTargetBudget={project.targetBudgetTotal}
			projectTargetDollarsPerSf={project.targetDollarsPerSf}
			budget={{
				id: budget.id,
				budgetNo: budget.budgetNo,
				status: budget.status,
				description: budget.description,
				marginPct: budget.marginPct,
				freightPct: budget.freightPct,
				warehousingPct: budget.warehousingPct,
				salesTaxPct: budget.salesTaxPct,
				notes: budget.notes,
				createdAt: budget.createdAt.toISOString(),
				updatedAt: budget.updatedAt.toISOString()
			}}
			lines={lines.map((l) => ({
				id: l.id,
				qapLineId: l.qapLineId,
				type: l.typeNameSnapshot,
				catalogNo: l.catalogNoSnapshot,
				manufacturer: l.manufacturerNameSnapshot,
				description: l.descriptionSnapshot,
				qtySnapshot: l.qtySnapshot,
				currentDnSnapshot: l.currentDnSnapshot,
				marginPctSnapshot: l.marginPctSnapshot,
				qty: l.qty,
				unitDn: l.unitDn
			}))}
			availableQapLines={availableQapLines.map((q) => ({
				id: q.id,
				type: q.typeName,
				catalogNo: q.catalogNo,
				manufacturer: q.manufacturer,
				description: q.description,
				qty: q.qty,
				currentDn: q.currentDn
			}))}
		/>
	);
}

// Keep sql import to avoid unused-import lint
void sql;
