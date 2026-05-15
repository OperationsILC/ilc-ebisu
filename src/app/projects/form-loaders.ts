import 'server-only';
import { db } from '@/lib/db';
import { users, companies, companyRoles } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';

/**
 * Load the option lists every project form needs: users (for staff dropdowns)
 * and companies (filtered by role).
 */
export async function loadProjectFormOptions() {
	const [allUsers, clientCompanies, gcCompanies, designerCompanies] = await Promise.all([
		db
			.select({ id: users.id, name: users.name, email: users.email })
			.from(users)
			.where(eq(users.active, true))
			.orderBy(asc(users.name), asc(users.email)),
		companiesWithRole('client'),
		companiesWithRole('gc'),
		companiesWithRole('designer')
	]);

	return { allUsers, clientCompanies, gcCompanies, designerCompanies };
}

async function companiesWithRole(role: string) {
	return db
		.select({ id: companies.id, name: companies.name })
		.from(companies)
		.innerJoin(
			companyRoles,
			eq(companyRoles.companyId, companies.id)
		)
		.where(eq(companyRoles.role, role))
		.orderBy(asc(companies.name));
}
