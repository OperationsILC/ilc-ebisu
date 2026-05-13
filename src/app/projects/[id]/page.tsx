import { db } from '@/lib/db';
import { projects, qapLines } from '@/lib/db/schema';
import { eq, count } from 'drizzle-orm';
import { notFound } from 'next/navigation';

export default async function ProjectDetailPage({
	params
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const [{ qapCount }] = await db
		.select({ qapCount: count() })
		.from(qapLines)
		.where(eq(qapLines.projectId, id));

	const p = project;

	return (
		<>
			<p>
				<a href="/projects">← all projects</a>
			</p>

			<h1>{p.name}</h1>
			<p className="muted">
				{p.status} · created {new Date(p.createdAt).toLocaleDateString()}
			</p>

			<div style={{ display: 'flex', gap: '12px', margin: '16px 0' }}>
				<a href={`/projects/${p.id}/qap`}>
					<button className="primary">Open QAP ({qapCount} lines)</button>
				</a>
				<a href={`/projects/${p.id}/qap/import`}>
					<button>Import CSV</button>
				</a>
			</div>

			<table className="plain" style={{ maxWidth: '720px' }}>
				<tbody>
					<tr>
						<th>Margin %</th>
						<td>{p.marginPct ?? '—'}</td>
					</tr>
					<tr>
						<th>Freight %</th>
						<td>{p.freightPct ?? '—'}</td>
					</tr>
					<tr>
						<th>Warehousing %</th>
						<td>{p.warehousingPct ?? '—'}</td>
					</tr>
					<tr>
						<th>Sales tax %</th>
						<td>{p.salesTaxPct ?? '—'}</td>
					</tr>
					<tr>
						<th>Delivery</th>
						<td>
							{[p.deliveryStreet, p.deliveryCity, p.deliveryState, p.deliveryZip]
								.filter(Boolean)
								.join(' ') || '—'}
						</td>
					</tr>
					<tr>
						<th>Description</th>
						<td>{p.description ?? '—'}</td>
					</tr>
				</tbody>
			</table>

			<p className="muted" style={{ marginTop: '24px' }}>
				Edit form coming. For now, recreate to change settings.
			</p>
		</>
	);
}
