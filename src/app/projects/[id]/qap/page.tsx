import { db } from '@/lib/db';
import { qapLines, projects, types, products, companies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import QapGridClient from './QapGridClient';

export default async function QapPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const rows = await db
		.select({
			id: qapLines.id,
			rowVersion: qapLines.rowVersion,
			qapIdText: qapLines.qapIdText,
			type: types.name,
			catalogNo: products.catalogNo,
			manufacturer: companies.name,
			qty: qapLines.qty,
			currentDn: qapLines.currentDn,
			marginPct: qapLines.marginPct,
			fixtureOrControl: qapLines.fixtureOrControl,
			finish: qapLines.finish,
			cct: qapLines.cct,
			wattage: qapLines.wattage,
			voltage: qapLines.voltage,
			dim: qapLines.dim,
			mounting: qapLines.mounting,
			roughInRequired: qapLines.roughInRequired,
			fixtureCategory: qapLines.fixtureCategory,
			fixtureLocation: qapLines.fixtureLocation,
			atticStock: qapLines.atticStock,
			internalDesignerNotes: qapLines.internalDesignerNotes,
			notes: qapLines.notes,
			description: qapLines.description
		})
		.from(qapLines)
		.innerJoin(types, eq(qapLines.typeId, types.id))
		.innerJoin(products, eq(qapLines.productId, products.id))
		.leftJoin(companies, eq(products.manufacturerCompanyId, companies.id))
		.where(eq(qapLines.projectId, id))
		.orderBy(types.name, products.catalogNo);

	// Serialize to plain types — Drizzle returns numeric as strings already,
	// but Date and bigint need toString() for React's serialization boundary.
	const serializedRows = rows.map((r) => ({
		...r,
		rowVersion: Number(r.rowVersion)
	}));

	return (
		<>
			<p>
				<a href={`/projects/${project.id}`}>← {project.name}</a>
			</p>

			<h1>QAP — {project.name}</h1>
			<p className="muted">
				{serializedRows.length} line{serializedRows.length === 1 ? '' : 's'}.
			</p>

			{serializedRows.length === 0 ? (
				<p className="muted">
					No QAP lines yet.{' '}
					<a href={`/projects/${project.id}/qap/import`}>Import a CSV</a> to get started.
				</p>
			) : (
				<QapGridClient projectId={project.id} rows={serializedRows} />
			)}
		</>
	);
}
