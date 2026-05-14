'use server';

import { db } from '@/lib/db';
import {
	companies,
	companyRoles,
	manufacturerRep,
	type NewCompany
} from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const ROLE_VALUES = ['manufacturer', 'rep_firm', 'client', 'gc', 'designer'] as const;
type CompanyRoleValue = (typeof ROLE_VALUES)[number];

const CompanySchema = z.object({
	name: z.string().min(1, 'Name is required'),
	street: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	zip: z.string().optional(),
	phone: z.string().optional(),
	website: z.string().optional(),
	quoteEmails: z.string().optional(),
	orderEmails: z.string().optional(),
	paymentTermsDays: z.string().optional(),
	ffa: z.string().optional(),
	creditLimit: z.string().optional(),
	parentCompanyId: z.string().optional(),
	notes: z.string().optional(),
	qboCustomerId: z.string().optional(),
	qboVendorId: z.string().optional()
});

export type CompanyResult = { ok?: boolean; error?: string; companyId?: string };

/**
 * Create a new company. Roles are set via a separate write to the
 * company_roles junction (multi-select).
 */
export async function createCompany(
	_prev: CompanyResult | undefined,
	formData: FormData
): Promise<CompanyResult> {
	const user = await requireUser();
	const raw = Object.fromEntries(formData) as Record<string, string>;
	const parsed = CompanySchema.safeParse(raw);
	if (!parsed.success) {
		return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' };
	}
	const v = parsed.data;

	// Existing-name check (case-sensitive — matches QBO convention)
	const existing = await db
		.select({ id: companies.id })
		.from(companies)
		.where(eq(companies.name, v.name.trim()))
		.limit(1);
	if (existing.length > 0)
		return { error: `A company named "${v.name.trim()}" already exists.` };

	const values: NewCompany = {
		name: v.name.trim(),
		street: blankToNull(v.street),
		city: blankToNull(v.city),
		state: blankToNull(v.state),
		zip: blankToNull(v.zip),
		phone: blankToNull(v.phone),
		website: blankToNull(v.website),
		quoteEmails: blankToNull(v.quoteEmails),
		orderEmails: blankToNull(v.orderEmails),
		notes: blankToNull(v.notes),
		qboCustomerId: blankToNull(v.qboCustomerId),
		qboVendorId: blankToNull(v.qboVendorId),
		createdByUserId: user.id
	};
	if (v.paymentTermsDays && v.paymentTermsDays.trim() !== '') {
		const n = Number(v.paymentTermsDays);
		if (Number.isFinite(n)) values.paymentTermsDays = n;
	}
	if (v.ffa && v.ffa.trim() !== '') {
		const n = Number(v.ffa);
		if (Number.isFinite(n)) values.ffa = v.ffa.trim();
	}
	if (v.creditLimit && v.creditLimit.trim() !== '') {
		const n = Number(v.creditLimit);
		if (Number.isFinite(n)) values.creditLimit = v.creditLimit.trim();
	}
	if (v.parentCompanyId && v.parentCompanyId.trim() !== '') {
		values.parentCompanyId = v.parentCompanyId.trim();
	}

	let createdId: string | undefined;
	try {
		const [row] = await db.insert(companies).values(values).returning({ id: companies.id });
		createdId = row.id;
	} catch (err) {
		if (err instanceof Error && err.message.includes('unique')) {
			return { error: 'A company with that name already exists.' };
		}
		throw err;
	}

	// Pick up roles checkbox values (e.g. role_manufacturer="on")
	const roles: CompanyRoleValue[] = ROLE_VALUES.filter(
		(r) => raw[`role_${r}`] === 'on'
	);
	if (roles.length > 0 && createdId) {
		await db.insert(companyRoles).values(roles.map((role) => ({ companyId: createdId!, role })));
	}

	revalidatePath('/companies');
	redirect(`/companies/${createdId}`);
}

/**
 * Update an existing company. Roles are diffed against the current set —
 * we delete role rows no longer ticked and insert ones newly ticked.
 */
export async function updateCompany(
	companyId: string,
	_prev: CompanyResult | undefined,
	formData: FormData
): Promise<CompanyResult> {
	await requireUser();
	const raw = Object.fromEntries(formData) as Record<string, string>;
	const parsed = CompanySchema.safeParse(raw);
	if (!parsed.success) {
		return { error: parsed.error.issues[0]?.message ?? 'Invalid form data' };
	}
	const v = parsed.data;

	// Name-uniqueness check, ignoring this row
	if (v.name) {
		const clash = await db
			.select({ id: companies.id })
			.from(companies)
			.where(and(eq(companies.name, v.name.trim()), ne(companies.id, companyId)))
			.limit(1);
		if (clash.length > 0)
			return { error: `Another company is already named "${v.name.trim()}".` };
	}

	const updates: Record<string, unknown> = {
		name: v.name.trim(),
		street: blankToNull(v.street),
		city: blankToNull(v.city),
		state: blankToNull(v.state),
		zip: blankToNull(v.zip),
		phone: blankToNull(v.phone),
		website: blankToNull(v.website),
		quoteEmails: blankToNull(v.quoteEmails),
		orderEmails: blankToNull(v.orderEmails),
		notes: blankToNull(v.notes),
		qboCustomerId: blankToNull(v.qboCustomerId),
		qboVendorId: blankToNull(v.qboVendorId),
		paymentTermsDays:
			v.paymentTermsDays && Number.isFinite(Number(v.paymentTermsDays))
				? Number(v.paymentTermsDays)
				: null,
		ffa: v.ffa && Number.isFinite(Number(v.ffa)) ? v.ffa.trim() : null,
		creditLimit:
			v.creditLimit && Number.isFinite(Number(v.creditLimit)) ? v.creditLimit.trim() : null,
		parentCompanyId:
			v.parentCompanyId && v.parentCompanyId.trim() !== '' ? v.parentCompanyId.trim() : null,
		updatedAt: new Date()
	};

	await db.update(companies).set(updates).where(eq(companies.id, companyId));

	// Diff roles
	const wanted = new Set<CompanyRoleValue>(
		ROLE_VALUES.filter((r) => raw[`role_${r}`] === 'on')
	);
	const current = await db
		.select({ role: companyRoles.role })
		.from(companyRoles)
		.where(eq(companyRoles.companyId, companyId));
	const have = new Set(current.map((r) => r.role));

	const toAdd: CompanyRoleValue[] = [];
	const toRemove: string[] = [];
	for (const r of wanted) if (!have.has(r)) toAdd.push(r);
	for (const r of have) if (!wanted.has(r as CompanyRoleValue)) toRemove.push(r);

	if (toAdd.length > 0) {
		await db
			.insert(companyRoles)
			.values(toAdd.map((role) => ({ companyId, role })));
	}
	if (toRemove.length > 0) {
		await db
			.delete(companyRoles)
			.where(and(eq(companyRoles.companyId, companyId), inArray(companyRoles.role, toRemove)));
	}

	revalidatePath('/companies');
	revalidatePath(`/companies/${companyId}`);
	return { ok: true, companyId };
}

/**
 * Update manufacturer→rep_firm mapping. Used on a manufacturer's company edit
 * page so PMs can record "this manufacturer is repped by these rep firms."
 * Replaces all existing mappings for the manufacturer with the new set.
 */
export async function setManufacturerReps(
	manufacturerCompanyId: string,
	repFirmIds: string[]
): Promise<{ ok?: boolean; error?: string }> {
	await requireUser();

	// Delete existing mappings for this manufacturer
	await db
		.delete(manufacturerRep)
		.where(eq(manufacturerRep.manufacturerCompanyId, manufacturerCompanyId));

	if (repFirmIds.length > 0) {
		await db
			.insert(manufacturerRep)
			.values(repFirmIds.map((repFirmCompanyId) => ({ manufacturerCompanyId, repFirmCompanyId })));
	}

	revalidatePath(`/companies/${manufacturerCompanyId}`);
	revalidatePath('/companies');
	return { ok: true };
}

function blankToNull(v: string | undefined): string | null {
	if (v === undefined) return null;
	const t = v.trim();
	return t === '' ? null : t;
}
