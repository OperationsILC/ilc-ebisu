import { db } from '@/lib/db';
import {
	salesOrders,
	orderLines,
	projects,
	companies,
	users
} from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { eq, and } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { renderSoPdf } from '@/lib/pdf/render';
import { type SoPdfData } from '@/lib/pdf/so';
import { NextResponse } from 'next/server';

const clientCo = alias(companies, 'client_co');
const gcCo = alias(companies, 'gc_co');
const procurementMgr = alias(users, 'procurement_mgr');
const projectMgr = alias(users, 'project_mgr');

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string; soId: string }> }
) {
	await requireUser();
	const { id, soId } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) return new NextResponse('Project not found', { status: 404 });

	const soRow = (
		await db
			.select({
				so: salesOrders,
				clientCompany: clientCo.name,
				gcCompany: gcCo.name,
				procurementMgrName: procurementMgr.name,
				procurementMgrEmail: procurementMgr.email,
				projectMgrName: projectMgr.name
			})
			.from(salesOrders)
			.leftJoin(clientCo, eq(clientCo.id, projects.clientCompanyId))
			.leftJoin(gcCo, eq(gcCo.id, projects.gcCompanyId))
			.leftJoin(procurementMgr, eq(procurementMgr.id, salesOrders.procurementMgrUserId))
			.leftJoin(projectMgr, eq(projectMgr.id, projects.projectManagerUserId))
			.innerJoin(projects, eq(projects.id, salesOrders.projectId))
			.where(and(eq(salesOrders.id, soId), eq(salesOrders.projectId, id)))
			.limit(1)
	)[0];
	if (!soRow) return new NextResponse('SO not found', { status: 404 });

	const lines = await db
		.select()
		.from(orderLines)
		.where(eq(orderLines.salesOrderId, soId))
		.orderBy(
			orderLines.manufacturerNameSnapshot,
			orderLines.typeNameSnapshot,
			orderLines.catalogNoSnapshot
		);

	const deliveryAddress = [
		project.deliveryStreet,
		[project.deliveryCity, project.deliveryState, project.deliveryZip]
			.filter(Boolean)
			.join(' ')
	]
		.filter((s) => s && s.trim() !== '')
		.join('\n');

	const data: SoPdfData = {
		soNo: soRow.so.soNo,
		status: soRow.so.status,
		createdAt: soRow.so.createdAt.toISOString(),
		confirmedAt: soRow.so.confirmedAt?.toISOString() ?? null,
		sentAt: soRow.so.sentAt?.toISOString() ?? null,
		description: soRow.so.description,
		notes: soRow.so.notes,
		customEmailMessage: soRow.so.customEmailMessage,
		marginPct: soRow.so.marginPct,
		freightPct: soRow.so.freightPct,
		warehousingPct: soRow.so.warehousingPct,
		salesTaxPct: soRow.so.salesTaxPct,
		salesTaxName: soRow.so.salesTaxName,
		additionalFreight: soRow.so.additionalFreight,
		freightOverride: soRow.so.freightOverride,
		projectName: project.name,
		clientCompany: soRow.clientCompany,
		gcCompany: soRow.gcCompany,
		projectMgrName: soRow.projectMgrName,
		procurementMgrName: soRow.procurementMgrName,
		deliveryAddress: deliveryAddress || null,
		lines: lines.map((l) => ({
			type: l.typeNameSnapshot,
			catalogNo: l.catalogNoSnapshot,
			manufacturer: l.manufacturerNameSnapshot,
			description: l.descriptionSnapshot,
			qty: l.qty,
			qtyType: l.qtyType,
			unitCn: l.unitCn
		}))
	};

	const buffer = await renderSoPdf(data);

	return new NextResponse(buffer as unknown as BodyInit, {
		status: 200,
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="${soRow.so.soNo}.pdf"`,
			'Cache-Control': 'private, no-cache'
		}
	});
}
