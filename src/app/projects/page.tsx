import { db } from '@/lib/db';
import { projects, qapLines } from '@/lib/db/schema';
import { count, desc } from 'drizzle-orm';

export default async function ProjectsPage() {
	const allProjects = await db
		.select({
			id: projects.id,
			name: projects.name,
			status: projects.status,
			marginPct: projects.marginPct,
			createdAt: projects.createdAt
		})
		.from(projects)
		.orderBy(desc(projects.createdAt));

	// One grouped count query, instead of a per-row correlated subquery
	// that interpolated incorrectly in Drizzle's sql template.
	const counts = await db
		.select({
			projectId: qapLines.projectId,
			n: count()
		})
		.from(qapLines)
		.groupBy(qapLines.projectId);

	const countMap = new Map(counts.map((c) => [c.projectId, c.n]));

	return (
		<>
			<h1>Projects</h1>

			<p>
				<a href="/projects/new">
					<button className="primary">+ New project</button>
				</a>
			</p>

			{allProjects.length === 0 ? (
				<p className="muted">No projects yet. Create one to get started.</p>
			) : (
				<table className="plain">
					<thead>
						<tr>
							<th>Name</th>
							<th>Status</th>
							<th>Margin %</th>
							<th>QAP lines</th>
							<th>Created</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{allProjects.map((p) => (
							<tr key={p.id}>
								<td>
									<a href={`/projects/${p.id}`}>{p.name}</a>
								</td>
								<td>{p.status}</td>
								<td>{p.marginPct ?? '—'}</td>
								<td>{countMap.get(p.id) ?? 0}</td>
								<td>{new Date(p.createdAt).toLocaleDateString()}</td>
								<td>
									<a href={`/projects/${p.id}/qap`}>QAP</a>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</>
	);
}
