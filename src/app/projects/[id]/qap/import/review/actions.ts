'use server';

import { db } from '@/lib/db';
import { importSessions, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/dal';
import { validateManufacturers } from '@/lib/import/validate';
import { runImport } from '@/lib/import/importer';
import { redirect } from 'next/navigation';
import type { CsvRow } from '@/lib/import/parse';

export async function ignoreAndImport(projectId: string, sessionId: string) {
	const user = await requireUser();

	const sess = (
		await db.select().from(importSessions).where(eq(importSessions.id, sessionId)).limit(1)
	)[0];
	if (!sess || sess.projectId !== projectId) {
		throw new Error('Import session not found');
	}

	const project = (await db.select().from(projects).where(eq(projects.id, projectId)).limit(1))[0];
	if (!project) throw new Error('Project not found');

	const report = sess.validationReport as {
		rows: CsvRow[];
		mismatches: { row: number; value: string }[];
	};
	const rows = report.rows;
	const skipRowNumbers = new Set<number>(report.mismatches.map((m) => m.row));

	const validation = await validateManufacturers(rows);

	const outcome = await runImport({
		projectId,
		projectName: project.name,
		userId: user.id,
		sourceFilename: sess.sourceFilename ?? 'upload.csv',
		rows,
		validation,
		skipRowNumbers
	});

	await db
		.update(importSessions)
		.set({ status: 'completed', completedAt: new Date() })
		.where(eq(importSessions.id, sessionId));

	const parts = [
		`${outcome.imported} imported`,
		outcome.updated > 0 && `${outcome.updated} updated`,
		outcome.unchanged > 0 && `${outcome.unchanged} unchanged (re-import, hash matched)`,
		outcome.skippedIncomplete > 0 &&
			`${outcome.skippedIncomplete} skipped — incomplete (no TYPE / CATALOG # / matched MANUFACTURER)`,
		outcome.skippedNoMatch > 0 &&
			`${outcome.skippedNoMatch} skipped — unmatched manufacturer (Ignored)`,
		outcome.failed > 0 && `${outcome.failed} failed`
	].filter(Boolean);
	const message = parts.join(', ') + '.';
	redirect(`/projects/${projectId}/qap?msg=${encodeURIComponent(message)}`);
}

export async function cancelImport(projectId: string, sessionId: string) {
	await requireUser();
	await db
		.update(importSessions)
		.set({ status: 'cancelled', completedAt: new Date() })
		.where(eq(importSessions.id, sessionId));
	redirect(`/projects/${projectId}/qap/import`);
}
