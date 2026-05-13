import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import UploadForm from './UploadForm';

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
