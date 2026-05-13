import { db } from '@/lib/db';
import {
	projects,
	qapLines,
	companies,
	companyRoles,
	products,
	types
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import RfqComposer from './RfqComposer';

export default async function NewRfqPage({
	params
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	// Rep firms — companies tagged with role='rep_firm'
	const repFirms = await db
		.select({ id: companies.id, name: companies.name })
		.from(companies)
		.innerJoin(companyRoles, and(eq(companyRoles.companyId, companies.id), eq(companyRoles.role, 'rep_firm')))
		.orderBy(companies.name);

	// QAP lines for this project
	const lines = await db
		.select({
			id: qapLines.id,
			qapIdText: qapLines.qapIdText,
			type: types.name,
			catalogNo: products.catalogNo,
			manufacturer: companies.name,
			qty: qapLines.qty,
			currentDn: qapLines.currentDn,
			description: qapLines.description
		})
		.from(qapLines)
		.innerJoin(types, eq(qapLines.typeId, types.id))
		.innerJoin(products, eq(qapLines.productId, products.id))
		.leftJoin(companies, eq(products.manufacturerCompanyId, companies.id))
		.where(eq(qapLines.projectId, id))
		.orderBy(companies.name, types.name, products.catalogNo);

	return (
		<>
			<p>
				<a href={`/projects/${project.id}/rfqs`}>← RFQs for {project.name}</a>
			</p>

			<h1>New RFQ — {project.name}</h1>

			{lines.length === 0 ? (
				<p className="muted">
					This project has no QAP lines yet. Import a CSV first to populate the QAP.
				</p>
			) : (
				<RfqComposer
					projectId={project.id}
					repFirms={repFirms}
					lines={lines}
				/>
			)}
		</>
	);
}
