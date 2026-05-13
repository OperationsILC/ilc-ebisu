'use server';

import { db } from '@/lib/db';
import { importSessions } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { parseCsv } from '@/lib/import/parse';
import { expandKitRows } from '@/lib/import/expand';
import { validateManufacturers } from '@/lib/import/validate';
import { redirect } from 'next/navigation';

export type UploadResult = {
	error?: string;
};

export async function uploadCsv(
	projectId: string,
	_prev: UploadResult | undefined,
	formData: FormData
): Promise<UploadResult> {
	const user = await requireUser();

	const file = formData.get('csv');
	if (!(file instanceof File) || file.size === 0) {
		return { error: 'Please choose a CSV file.' };
	}
	const content = await file.text();

	const parsed = parseCsv(content);
	if (parsed.errors.length > 0) {
		return { error: parsed.errors.join('; ') };
	}
	const expandedRows = expandKitRows(parsed.rows);
	const validation = await validateManufacturers(expandedRows);

	const [stored] = await db
		.insert(importSessions)
		.values({
			projectId,
			userId: user.id,
			sourceFilename: file.name,
			totalRows: expandedRows.length,
			status: 'pending_review',
			validationReport: {
				rows: expandedRows,
				mismatches: validation.mismatches,
				skipped: parsed.skipped,
				uniqueMfrs: validation.uniqueMfrs,
				matchedCount: validation.matched.size
			}
		})
		.returning({ id: importSessions.id });

	redirect(`/projects/${projectId}/qap/import/review?session=${stored.id}`);
}
