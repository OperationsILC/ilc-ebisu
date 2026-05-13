import { db } from '@/lib/db';
import { importSessions, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import type { CsvRow } from '@/lib/import/parse';
import { ignoreAndImport, cancelImport } from './actions';

export default async function ReviewPage({
	params,
	searchParams
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ session?: string }>;
}) {
	const { id } = await params;
	const { session: sessionId } = await searchParams;
	if (!sessionId) notFound();

	const sess = (
		await db.select().from(importSessions).where(eq(importSessions.id, sessionId)).limit(1)
	)[0];
	if (!sess || sess.projectId !== id) notFound();

	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	const report = sess.validationReport as {
		rows: CsvRow[];
		mismatches: { row: number; value: string }[];
		skipped: { row: number; reason: string }[];
		uniqueMfrs: string[];
		matchedCount: number;
	};

	const ignoreAction = ignoreAndImport.bind(null, project.id, sess.id);
	const cancelAction = cancelImport.bind(null, project.id, sess.id);

	return (
		<>
			<p>
				<a href={`/projects/${project.id}/qap/import`}>← upload a different file</a>
			</p>

			<h1>Review import — {project.name}</h1>

			<p>
				File: <code>{sess.sourceFilename}</code> · {report.rows.length} rows after parsing (skipped{' '}
				{report.skipped.length} empty/slug rows during parse).
			</p>

			<h2>Manufacturer check</h2>
			<p>
				{report.matchedCount} of {report.uniqueMfrs.length} unique manufacturers matched.
			</p>

			{report.mismatches.length > 0 ? (
				<div className="flash error">
					<strong>
						{report.mismatches.length} row{report.mismatches.length === 1 ? '' : 's'} have
						unrecognized manufacturers.
					</strong>
					<p>
						You can ignore-and-continue (these rows will be skipped) or cancel and revise the
						CSV.
					</p>
					<table className="plain" style={{ marginTop: '12px' }}>
						<thead>
							<tr>
								<th>Row</th>
								<th>Unknown manufacturer</th>
							</tr>
						</thead>
						<tbody>
							{report.mismatches.map((m, i) => (
								<tr key={i}>
									<td>{m.row}</td>
									<td>{m.value}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<p className="flash success">All manufacturers recognized. Ready to import.</p>
			)}

			<h2>Rows that will import</h2>
			<p className="muted">
				First 20 of {report.rows.length} rows shown. The importer will auto-create missing TYPE
				and CATALOG # entries, and write designer-specified (<code>PR_ORIGINAL_*</code>) fields
				once and never overwrite them.
			</p>

			<table className="plain" style={{ fontSize: '12px' }}>
				<thead>
					<tr>
						<th>#</th>
						<th>TYPE</th>
						<th>CATALOG #</th>
						<th>MANUFACTURER</th>
						<th>QTY</th>
						<th>CURRENT DN</th>
						<th>DESCRIPTION</th>
					</tr>
				</thead>
				<tbody>
					{report.rows.slice(0, 20).map((r, i) => (
						<tr key={i}>
							<td>{i + 1}</td>
							<td>{r['TYPE'] ?? ''}</td>
							<td>{r['CATALOG #'] ?? ''}</td>
							<td>{r['MANUFACTURER'] ?? ''}</td>
							<td>{r['QTY'] ?? ''}</td>
							<td>{r['CURRENT DN'] ?? ''}</td>
							<td>{r['DESCRIPTION'] ?? ''}</td>
						</tr>
					))}
				</tbody>
			</table>

			<div style={{ margin: '24px 0', display: 'flex', gap: '12px' }}>
				<form action={ignoreAction}>
					<button className="primary" type="submit">
						{report.mismatches.length > 0
							? 'Ignore unmatched + import the rest'
							: `Import ${report.rows.length} row${report.rows.length === 1 ? '' : 's'}`}
					</button>
				</form>
				<form action={cancelAction}>
					<button type="submit">Cancel</button>
				</form>
			</div>
		</>
	);
}
