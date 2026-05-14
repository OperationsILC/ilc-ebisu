'use server';

import { db } from '@/lib/db';
import { salesOrders, projects } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { count, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

/**
 * Create a draft SO under this project and redirect to its detail page.
 * Pulls margin/freight/warehousing/sales-tax % defaults from the project so
 * the PM doesn't have to retype them per SO.
 */
export async function createSo(projectId: string) {
	const user = await requireUser();
	const project = (
		await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
	)[0];
	if (!project) throw new Error('Project not found');

	const [{ n: existing }] = await db.select({ n: count() }).from(salesOrders);
	const soNo = `SO${String(Number(existing) + 1).padStart(5, '0')}`;

	let createdId: string | undefined;
	try {
		const [row] = await db
			.insert(salesOrders)
			.values({
				projectId,
				soNo,
				status: 'draft',
				marginPct: project.marginPct,
				freightPct: project.freightPct,
				warehousingPct: project.warehousingPct,
				salesTaxPct: project.salesTaxPct,
				procurementMgrUserId: project.projectManagerUserId,
				createdByUserId: user.id
			})
			.returning({ id: salesOrders.id });
		createdId = row.id;
	} catch (err) {
		// Tiny race window on duplicate so_no — retry once with bumped counter
		if (err instanceof Error && err.message.includes('unique')) {
			const [{ n: again }] = await db.select({ n: count() }).from(salesOrders);
			const retryNo = `SO${String(Number(again) + 1).padStart(5, '0')}`;
			const [row] = await db
				.insert(salesOrders)
				.values({
					projectId,
					soNo: retryNo,
					status: 'draft',
					marginPct: project.marginPct,
					freightPct: project.freightPct,
					warehousingPct: project.warehousingPct,
					salesTaxPct: project.salesTaxPct,
					procurementMgrUserId: project.projectManagerUserId,
					createdByUserId: user.id
				})
				.returning({ id: salesOrders.id });
			createdId = row.id;
		} else {
			throw err;
		}
	}

	if (createdId) redirect(`/projects/${projectId}/sos/${createdId}`);
}
