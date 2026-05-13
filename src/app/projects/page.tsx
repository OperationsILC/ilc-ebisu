import { db } from '@/lib/db';
import { projects, qapLines } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';

export default async function ProjectsPage() {
	const rows = await db
		.select({
			id: projects.id,
			name: projects.name,
			status: projects.status,
			marginPct: projects.marginPct,
			createdAt: projects.createdAt,
			qapCount: sql<number>`(SELECT count(*) FROM ${qapLines} WHERE ${qapLines.projectId} = ${projects.id})`
		})
		.from(projects)
		.orderBy(desc(projects.createdAt));

	return (
		<>
			<h1>Projects</h1>

			<p>
				<a href="/projects/new">
					<button className="primary">+ New project</button>
				</a>
			</p>

			{rows.length === 0 ? (
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
						{rows.map((p) => (
							<tr key={p.id}>
								<td>
									<a href={`/projects/${p.id}`}>{p.name}</a>
								</td>
								<td>{p.status}</td>
								<td>{p.marginPct ?? '—'}</td>
								<td>{p.qapCount}</td>
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
