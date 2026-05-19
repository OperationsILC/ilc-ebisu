import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import UploadForm from './UploadForm';
import TabHelp from '@/app/components/TabHelp';

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const project = (await db.select().from(projects).where(eq(projects.id, id)).limit(1))[0];
	if (!project) notFound();

	return (
		<>
			<p>
				<a href={`/projects/${project.id}/qap`}>← QAP for {project.name}</a>
			</p>

			<h1>Import CSV — {project.name}</h1>

			<TabHelp tabKey="qap-import" title="Importing a designer&rsquo;s CSV">
				<p style={{ margin: '0 0 6px' }}>
					Designers send their fixture schedule as a CSV. Upload it here and Ebisu turns
					each row into a QAP line.
				</p>
				<ul style={{ margin: '6px 0', paddingLeft: '20px' }}>
					<li>
						Required columns: <code>PROJECT</code>, <code>TYPE</code>, <code>CATALOG #</code>,{' '}
						<code>MANUFACTURER</code>. Other columns are preserved as provided.
					</li>
					<li>
						Rows with <code>&quot; + &quot;</code> in the catalog number expand into multiple
						QAP lines (kit expansion).
					</li>
					<li>
						If a MANUFACTURER value doesn&apos;t match an existing company, you&apos;ll get
						a review screen offering Ignore / Revise per row before anything writes.
					</li>
					<li>
						Re-importing the same CSV is safe — rows whose contents haven&apos;t changed are
						skipped.
					</li>
				</ul>
			</TabHelp>

			<p>
				Upload a CSV produced by a lighting designer using the standard{' '}
				<code>IMPORT_TEMPLATE</code> shape. The system will parse it, skip blank and slug rows,
				expand &quot; + &quot; kit rows, and check that every manufacturer already exists.
				You&apos;ll get a review page before anything actually imports.
			</p>

			<UploadForm projectId={project.id} />

			<p className="muted" style={{ marginTop: '24px' }}>
				The CSV must include these columns at minimum: <code>PROJECT</code>, <code>TYPE</code>,{' '}
				<code>CATALOG #</code>, <code>MANUFACTURER</code>. Other columns are preserved as
				provided.
			</p>
		</>
	);
}
