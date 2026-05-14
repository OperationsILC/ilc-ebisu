import { db } from '@/lib/db';
import { companies } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import CompanyForm from '../CompanyForm';

export default async function NewCompanyPage() {
	const parents = await db
		.select({ id: companies.id, name: companies.name })
		.from(companies)
		.orderBy(asc(companies.name));

	return (
		<>
			<p>
				<a href="/companies">← Companies</a>
			</p>
			<h1>New company</h1>
			<CompanyForm mode="create" parentOptions={parents} />
		</>
	);
}
