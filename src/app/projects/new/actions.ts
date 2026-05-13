'use server';

import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const NewProjectSchema = z.object({
	name: z.string().trim().min(1, 'Project name is required').max(120),
	status: z.enum(['active', 'completed', 'test', 'on_hold']).default('active'),
	marginPct: z.string().optional(),
	freightPct: z.string().optional(),
	warehousingPct: z.string().optional(),
	salesTaxPct: z.string().optional(),
	description: z.string().optional(),
	deliveryStreet: z.string().optional(),
	deliveryCity: z.string().optional(),
	deliveryState: z.string().optional(),
	deliveryZip: z.string().optional()
});

export type NewProjectState = {
	values?: Record<string, string>;
	errors?: Record<string, string[]>;
	error?: string;
};

function emptyToNull(s: string | undefined): string | null {
	const t = (s ?? '').trim();
	return t === '' ? null : t;
}

export async function createProject(
	_prev: NewProjectState | undefined,
	formData: FormData
): Promise<NewProjectState> {
	const user = await requireUser();

	const rawValues = Object.fromEntries(formData) as Record<string, string>;
	const parsed = NewProjectSchema.safeParse(rawValues);
	if (!parsed.success) {
		return {
			values: rawValues,
			errors: parsed.error.flatten().fieldErrors
		};
	}

	const v = parsed.data;
	let createdId: string | undefined;
	try {
		const [row] = await db
			.insert(projects)
			.values({
				name: v.name,
				status: v.status,
				marginPct: emptyToNull(v.marginPct),
				freightPct: emptyToNull(v.freightPct),
				warehousingPct: emptyToNull(v.warehousingPct),
				salesTaxPct: emptyToNull(v.salesTaxPct),
				description: emptyToNull(v.description),
				deliveryStreet: emptyToNull(v.deliveryStreet),
				deliveryCity: emptyToNull(v.deliveryCity),
				deliveryState: emptyToNull(v.deliveryState),
				deliveryZip: emptyToNull(v.deliveryZip),
				createdByUserId: user.id
			})
			.returning({ id: projects.id });
		createdId = row.id;
	} catch (err) {
		if (err instanceof Error && err.message.includes('unique')) {
			return {
				values: rawValues,
				errors: { name: ['A project with this name already exists.'] }
			};
		}
		throw err;
	}

	if (createdId) redirect(`/projects/${createdId}`);
	return {};
}
