'use server';

import { db } from '@/lib/db';
import { projects, type NewProject } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const ProjectFormSchema = z.object({
	name: z.string().trim().min(1, 'Project name is required').max(120),
	status: z.string().optional(),
	phase: z.string().optional(),
	projectType: z.string().optional(),
	serviceType: z.string().optional(),

	clientCompanyId: z.string().optional(),
	gcCompanyId: z.string().optional(),
	designerCompanyId: z.string().optional(),

	projectManagerUserId: z.string().optional(),
	designLeadUserId: z.string().optional(),
	secondDesignerUserId: z.string().optional(),
	salesPersonUserId: z.string().optional(),
	caManagerUserId: z.string().optional(),

	ifcSubDate: z.string().optional(),
	expectedOrderDate: z.string().optional(),
	designStartDate: z.string().optional(),
	roughInStartDate: z.string().optional(),
	constructionStartDate: z.string().optional(),

	marginPct: z.string().optional(),
	freightPct: z.string().optional(),
	warehousingPct: z.string().optional(),
	salesTaxPct: z.string().optional(),
	salesTaxName: z.string().optional(),
	projectedDesignFeeTotal: z.string().optional(),
	targetBudgetTotal: z.string().optional(),
	targetDollarsPerSf: z.string().optional(),

	emailsForBudgets: z.string().optional(),
	emailsForQuotesSo: z.string().optional(),
	emailsForShipmentUpdates: z.string().optional(),

	deliveryStreet: z.string().optional(),
	deliveryCity: z.string().optional(),
	deliveryState: z.string().optional(),
	deliveryZip: z.string().optional(),
	deliverySiteContactName: z.string().optional(),
	deliverySiteContactPhone: z.string().optional(),

	siteStreet: z.string().optional(),
	siteCity: z.string().optional(),
	siteState: z.string().optional(),
	siteZip: z.string().optional(),
	jobSiteContactName: z.string().optional(),
	jobSiteContactPhone: z.string().optional(),

	totalSf: z.string().optional(),
	interiorSf: z.string().optional(),
	exteriorSf: z.string().optional(),
	numUnitsRooms: z.string().optional(),
	unitRoomSf: z.string().optional(),
	garageSf: z.string().optional(),
	bohSf: z.string().optional(),
	openOfficeSf: z.string().optional(),
	privateOfficeSf: z.string().optional(),
	corridorAreaSf: z.string().optional(),
	amenityAreaSf: z.string().optional(),
	unfinishedOfficeSf: z.string().optional(),

	description: z.string().optional(),
	notes: z.string().optional(),
	projectStats: z.string().optional()
});

export type ProjectFormState = {
	ok?: boolean;
	error?: string;
	errors?: Record<string, string[]>;
	values?: Record<string, string>;
};

function emptyToNull(s: string | undefined | null): string | null {
	const t = (s ?? '').trim();
	return t === '' ? null : t;
}
function emptyToNullDate(s: string | undefined | null): Date | null {
	const t = (s ?? '').trim();
	if (t === '') return null;
	const d = new Date(t);
	return isNaN(d.getTime()) ? null : d;
}
function emptyToNullInt(s: string | undefined | null): number | null {
	const t = (s ?? '').trim();
	if (t === '') return null;
	const n = Number(t);
	return Number.isFinite(n) ? Math.round(n) : null;
}
function emptyToNullNumeric(s: string | undefined | null): string | null {
	const t = (s ?? '').trim();
	if (t === '') return null;
	const n = Number(t);
	return Number.isFinite(n) ? t : null;
}

function buildValues(v: z.infer<typeof ProjectFormSchema>): Partial<NewProject> {
	return {
		name: v.name,
		status: v.status && v.status.trim() !== '' ? v.status : 'active',
		phase: emptyToNull(v.phase),
		projectType: emptyToNull(v.projectType),
		serviceType: emptyToNull(v.serviceType),

		clientCompanyId: emptyToNull(v.clientCompanyId),
		gcCompanyId: emptyToNull(v.gcCompanyId),
		designerCompanyId: emptyToNull(v.designerCompanyId),

		projectManagerUserId: emptyToNull(v.projectManagerUserId),
		designLeadUserId: emptyToNull(v.designLeadUserId),
		secondDesignerUserId: emptyToNull(v.secondDesignerUserId),
		salesPersonUserId: emptyToNull(v.salesPersonUserId),
		caManagerUserId: emptyToNull(v.caManagerUserId),

		ifcSubDate: emptyToNullDate(v.ifcSubDate),
		expectedOrderDate: emptyToNullDate(v.expectedOrderDate),
		designStartDate: emptyToNullDate(v.designStartDate),
		roughInStartDate: emptyToNullDate(v.roughInStartDate),
		constructionStartDate: emptyToNullDate(v.constructionStartDate),

		marginPct: emptyToNullNumeric(v.marginPct),
		freightPct: emptyToNullNumeric(v.freightPct),
		warehousingPct: emptyToNullNumeric(v.warehousingPct),
		salesTaxPct: emptyToNullNumeric(v.salesTaxPct),
		salesTaxName: emptyToNull(v.salesTaxName),
		projectedDesignFeeTotal: emptyToNullNumeric(v.projectedDesignFeeTotal),
		targetBudgetTotal: emptyToNullNumeric(v.targetBudgetTotal),
		targetDollarsPerSf: emptyToNullNumeric(v.targetDollarsPerSf),

		emailsForBudgets: emptyToNull(v.emailsForBudgets),
		emailsForQuotesSo: emptyToNull(v.emailsForQuotesSo),
		emailsForShipmentUpdates: emptyToNull(v.emailsForShipmentUpdates),

		deliveryStreet: emptyToNull(v.deliveryStreet),
		deliveryCity: emptyToNull(v.deliveryCity),
		deliveryState: emptyToNull(v.deliveryState),
		deliveryZip: emptyToNull(v.deliveryZip),
		deliverySiteContactName: emptyToNull(v.deliverySiteContactName),
		deliverySiteContactPhone: emptyToNull(v.deliverySiteContactPhone),

		siteStreet: emptyToNull(v.siteStreet),
		siteCity: emptyToNull(v.siteCity),
		siteState: emptyToNull(v.siteState),
		siteZip: emptyToNull(v.siteZip),
		jobSiteContactName: emptyToNull(v.jobSiteContactName),
		jobSiteContactPhone: emptyToNull(v.jobSiteContactPhone),

		totalSf: emptyToNullInt(v.totalSf),
		interiorSf: emptyToNullInt(v.interiorSf),
		exteriorSf: emptyToNullInt(v.exteriorSf),
		numUnitsRooms: emptyToNullInt(v.numUnitsRooms),
		unitRoomSf: emptyToNullInt(v.unitRoomSf),
		garageSf: emptyToNullInt(v.garageSf),
		bohSf: emptyToNullInt(v.bohSf),
		openOfficeSf: emptyToNullInt(v.openOfficeSf),
		privateOfficeSf: emptyToNullInt(v.privateOfficeSf),
		corridorAreaSf: emptyToNullInt(v.corridorAreaSf),
		amenityAreaSf: emptyToNullInt(v.amenityAreaSf),
		unfinishedOfficeSf: emptyToNullInt(v.unfinishedOfficeSf),

		description: emptyToNull(v.description),
		notes: emptyToNull(v.notes),
		projectStats: emptyToNull(v.projectStats)
	};
}

export async function createProject(
	_prev: ProjectFormState | undefined,
	formData: FormData
): Promise<ProjectFormState> {
	const user = await requireUser();
	const raw = Object.fromEntries(formData) as Record<string, string>;
	const parsed = ProjectFormSchema.safeParse(raw);
	if (!parsed.success) {
		return {
			values: raw,
			errors: parsed.error.flatten().fieldErrors
		};
	}

	const values: NewProject = {
		...buildValues(parsed.data),
		name: parsed.data.name,
		createdByUserId: user.id
	} as NewProject;

	let createdId: string | undefined;
	try {
		const [row] = await db.insert(projects).values(values).returning({ id: projects.id });
		createdId = row.id;
	} catch (err) {
		if (err instanceof Error && err.message.includes('unique')) {
			return {
				values: raw,
				errors: { name: ['A project with this name already exists.'] }
			};
		}
		throw err;
	}

	if (createdId) redirect(`/projects/${createdId}`);
	return {};
}

export async function updateProject(
	projectId: string,
	_prev: ProjectFormState | undefined,
	formData: FormData
): Promise<ProjectFormState> {
	await requireUser();
	const raw = Object.fromEntries(formData) as Record<string, string>;
	const parsed = ProjectFormSchema.safeParse(raw);
	if (!parsed.success) {
		return {
			values: raw,
			errors: parsed.error.flatten().fieldErrors
		};
	}

	// Name uniqueness, ignoring this project
	const clash = await db
		.select({ id: projects.id })
		.from(projects)
		.where(and(eq(projects.name, parsed.data.name.trim()), ne(projects.id, projectId)))
		.limit(1);
	if (clash.length > 0) {
		return {
			values: raw,
			errors: { name: ['Another project already has this name.'] }
		};
	}

	const updates = {
		...buildValues(parsed.data),
		updatedAt: new Date()
	};

	await db.update(projects).set(updates).where(eq(projects.id, projectId));

	revalidatePath(`/projects/${projectId}`);
	revalidatePath(`/projects/${projectId}/edit`);
	revalidatePath('/projects');
	return { ok: true };
}
