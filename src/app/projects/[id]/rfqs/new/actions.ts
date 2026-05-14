'use server';

import { db } from '@/lib/db';
import { rfqs, rfqLines, qapLines, projects, products, companies, types } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { eq, count, inArray } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const CreateRfqSchema = z.object({
	repFirmCompanyId: z.string().uuid('Pick a rep firm'),
	notes: z.string().optional(),
	qapLineIds: z.array(z.string().uuid()).min(1, 'Select at least one QAP line')
});

export type CreateRfqState = {
	error?: string;
	errors?: Record<string, string[]>;
	values?: {
		repFirmCompanyId?: string;
		notes?: string;
		selectedIds?: string[];
	};
};

export async function createRfq(
	projectId: string,
	_prev: CreateRfqState | undefined,
	formData: FormData
): Promise<CreateRfqState> {
	const user = await requireUser();

	const project = (await db.select().from(projects).where(eq(projects.id, projectId)).limit(1))[0];
	if (!project) return { error: 'Project not found' };

	const raw = {
		repFirmCompanyId: String(formData.get('repFirmCompanyId') ?? ''),
		notes: String(formData.get('notes') ?? ''),
		qapLineIds: formData.getAll('qapLineId').map((v) => String(v))
	};

	const parsed = CreateRfqSchema.safeParse(raw);
	if (!parsed.success) {
		return {
			values: {
				repFirmCompanyId: raw.repFirmCompanyId,
				notes: raw.notes,
				selectedIds: raw.qapLineIds
			},
			errors: parsed.error.flatten().fieldErrors
		};
	}

	const v = parsed.data;

	// Fetch snapshot data for each selected QAP line.
	const linesToSnapshot = await db
		.select({
			id: qapLines.id,
			projectId: qapLines.projectId,
			qty: qapLines.qty,
			typeName: types.name,
			catalogNo: products.catalogNo,
			manufacturer: companies.name,
			description: qapLines.description
		})
		.from(qapLines)
		.innerJoin(types, eq(qapLines.typeId, types.id))
		.innerJoin(products, eq(qapLines.productId, products.id))
		.leftJoin(companies, eq(products.manufacturerCompanyId, companies.id))
		.where(inArray(qapLines.id, v.qapLineIds));

	// Verify every selected line belongs to this project.
	const wrongProject = linesToSnapshot.filter((l) => l.projectId !== projectId);
	if (wrongProject.length > 0) {
		return { error: 'Some selected lines do not belong to this project. Refresh and try again.' };
	}
	if (linesToSnapshot.length !== v.qapLineIds.length) {
		return { error: 'Some selected lines were not found. Refresh and try again.' };
	}

	// Generate next RFQ NO. Cheap and lock-free; the unique constraint on rfq_no
	// catches the rare race condition between two concurrent creates.
	const [{ n: existing }] = await db.select({ n: count() }).from(rfqs);
	const rfqNo = `RQ${String(Number(existing) + 1).padStart(5, '0')}`;

	let createdRfqId: string | undefined;
	try {
		const [created] = await db
			.insert(rfqs)
			.values({
				projectId,
				repFirmCompanyId: v.repFirmCompanyId,
				rfqNo,
				status: 'draft',
				notes: v.notes && v.notes.trim() !== '' ? v.notes : null,
				createdByUserId: user.id
			})
			.returning({ id: rfqs.id });
		createdRfqId = created.id;

		await db.insert(rfqLines).values(
			linesToSnapshot.map((l) => ({
				rfqId: created.id,
				qapLineId: l.id,
				qtySnapshot: l.qty,
				typeNameSnapshot: l.typeName,
				catalogNoSnapshot: l.catalogNo,
				manufacturerNameSnapshot: l.manufacturer,
				descriptionSnapshot: l.description
			}))
		);
	} catch (err) {
		if (err instanceof Error && err.message.includes('unique')) {
			return { error: `RFQ NO collision (${rfqNo}). Refresh and try again.` };
		}
		throw err;
	}

	if (createdRfqId) redirect(`/projects/${projectId}/rfqs/${createdRfqId}`);
	return {};
}
