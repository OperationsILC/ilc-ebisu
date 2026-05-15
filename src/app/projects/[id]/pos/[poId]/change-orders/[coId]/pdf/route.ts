import { db } from '@/lib/db';
import {
	changeOrders,
	changeOrderLines,
	purchaseOrders,
	projects,
	companies,
	users
} from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { eq, and } from 'drizzle-orm';
import { renderChangeOrderPdf } from '@/lib/pdf/render';
import { type ChangeOrderPdfData } from '@/lib/pdf/change-order';
import { NextResponse } from 'next/server';

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string; poId: string; coId: string }> }
) {
	const me = await requireUser();
	const { id, poId, coId } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) return new NextResponse('Project not found', { status: 404 });

	const row = (
		await db
			.select({
				co: changeOrders,
				poNo: purchaseOrders.poNo,
				repFirm: companies.name,
				repFirmOrderEmails: companies.orderEmails,
				pmName: users.name,
				pmEmail: users.email
			})
			.from(changeOrders)
			.innerJoin(purchaseOrders, eq(changeOrders.purchaseOrderId, purchaseOrders.id))
			.leftJoin(companies, eq(purchaseOrders.repFirmCompanyId, companies.id))
			.leftJoin(users, eq(users.id, changeOrders.createdByUserId))
			.where(
				and(
					eq(changeOrders.id, coId),
					eq(changeOrders.purchaseOrderId, poId),
					eq(changeOrders.projectId, id)
				)
			)
			.limit(1)
	)[0];
	if (!row) return new NextResponse('CO not found', { status: 404 });

	const lines = await db
		.select()
		.from(changeOrderLines)
		.where(eq(changeOrderLines.changeOrderId, coId))
		.orderBy(changeOrderLines.createdAt);

	const data: ChangeOrderPdfData = {
		coNo: row.co.coNo,
		status: row.co.status,
		createdAt: row.co.createdAt.toISOString(),
		sentAt: row.co.sentAt?.toISOString() ?? null,
		appliedAt: row.co.appliedAt?.toISOString() ?? null,
		versionNoBefore: row.co.versionNoBefore,
		versionNoAfter: row.co.versionNoAfter,
		description: row.co.description,
		customEmailMessage: row.co.customEmailMessage,
		netAmountChange: row.co.netAmountChange,
		projectName: project.name,
		poNo: row.poNo,
		repFirm: row.repFirm,
		repFirmOrderEmails: row.repFirmOrderEmails,
		pmName: row.pmName ?? me.name ?? null,
		pmEmail: row.pmEmail ?? me.email,
		lines: lines.map((l) => ({
			operation: l.operation,
			catalogNoBefore: l.catalogNoBefore,
			catalogNoAfter: l.catalogNoAfter,
			descriptionBefore: l.descriptionBefore,
			descriptionAfter: l.descriptionAfter,
			qtyBefore: l.qtyBefore,
			qtyAfter: l.qtyAfter,
			qtyType: l.qtyTypeAfter ?? l.qtyTypeBefore,
			unitDnBefore: l.unitDnBefore,
			unitDnAfter: l.unitDnAfter,
			lineTotalDelta: l.lineTotalDelta,
			reasonText: l.reasonText
		}))
	};

	const buffer = await renderChangeOrderPdf(data);

	return new NextResponse(buffer as unknown as BodyInit, {
		status: 200,
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="${row.co.coNo}.pdf"`,
			'Cache-Control': 'private, no-cache'
		}
	});
}
