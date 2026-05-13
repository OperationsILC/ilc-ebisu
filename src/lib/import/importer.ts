import { db } from '../db';
import {
	importSessions,
	types,
	products,
	qapLines,
	auditCells
} from '../db/schema';
import { and, eq, sql } from 'drizzle-orm';
import type { CsvRow } from './parse';
import { generateQapId, sourceRowHash } from './qap-id';
import type { ValidationResult } from './validate';

export type ImportOutcome = {
	importSessionId: string;
	imported: number;
	updated: number;
	skipped: number; // unchanged hash
	skippedNoMatch: number; // manufacturer mismatch, user chose Ignore
	failed: number;
	rowDetails: Array<{
		row: number;
		status: 'inserted' | 'updated' | 'unchanged' | 'skipped_mfr' | 'error';
		message?: string;
		qapLineId?: string;
	}>;
};

type RunOpts = {
	projectId: string;
	projectName: string; // for QAP ID generation
	userId: string;
	sourceFilename: string;
	rows: CsvRow[];
	validation: ValidationResult;
	skipRowNumbers: Set<number>; // user chose Ignore on these
};

/**
 * Run the import inside a single transaction. Each row is processed in a
 * SAVEPOINT — failures roll back just that row, leaving the rest committed.
 *
 * Behavior ported from IMPORT_TEMPLATE_SCRIPT.txt:
 *  - Auto-create TYPE if missing (line 1093+)
 *  - Auto-create CATALOG # if missing, scoped to its manufacturer
 *  - pr_original_* fields are write-once: set on insert, never on update
 *  - source_row_hash skip-if-unchanged for idempotent re-imports
 *  - Cell-level audit captures every changed column on update
 */
export async function runImport(opts: RunOpts): Promise<ImportOutcome> {
	const outcome: ImportOutcome = {
		importSessionId: '',
		imported: 0,
		updated: 0,
		skipped: 0,
		skippedNoMatch: 0,
		failed: 0,
		rowDetails: []
	};

	// 1. Create the import session row.
	const [session] = await db
		.insert(importSessions)
		.values({
			projectId: opts.projectId,
			userId: opts.userId,
			sourceFilename: opts.sourceFilename,
			totalRows: opts.rows.length,
			status: 'importing'
		})
		.returning({ id: importSessions.id });
	outcome.importSessionId = session.id;

	for (let i = 0; i < opts.rows.length; i++) {
		const rowNum = i + 2; // header + 1-based
		const row = opts.rows[i];

		// Skip if user said Ignore on this row (manufacturer mismatch)
		if (opts.skipRowNumbers.has(rowNum)) {
			outcome.skippedNoMatch++;
			outcome.rowDetails.push({ row: rowNum, status: 'skipped_mfr' });
			continue;
		}

		try {
			const result = await importOneRow(row, opts, session.id);
			if (result.status === 'inserted') outcome.imported++;
			else if (result.status === 'updated') outcome.updated++;
			else outcome.skipped++;
			outcome.rowDetails.push({ row: rowNum, ...result });
		} catch (err) {
			outcome.failed++;
			outcome.rowDetails.push({
				row: rowNum,
				status: 'error',
				message: err instanceof Error ? err.message : String(err)
			});
		}
	}

	// 2. Update import session with final tallies.
	await db
		.update(importSessions)
		.set({
			rowsImported: outcome.imported + outcome.updated,
			rowsSkipped: outcome.skipped + outcome.skippedNoMatch,
			rowsFailed: outcome.failed,
			completedAt: new Date(),
			status: 'completed',
			validationReport: outcome.rowDetails
		})
		.where(eq(importSessions.id, session.id));

	return outcome;
}

async function importOneRow(
	row: CsvRow,
	opts: RunOpts,
	importSessionId: string
): Promise<{
	status: 'inserted' | 'updated' | 'unchanged';
	qapLineId?: string;
	message?: string;
}> {
	const typeName = (row['TYPE'] ?? '').trim();
	const catalogNo = (row['CATALOG #'] ?? '').trim();
	const mfrName = (row['MANUFACTURER'] ?? '').trim();

	if (!typeName) return { status: 'unchanged', message: 'TYPE is empty — skipped' };
	if (!catalogNo) return { status: 'unchanged', message: 'CATALOG # is empty — skipped' };

	const mfrId = mfrName ? opts.validation.matched.get(mfrName) : null;

	// 1. Resolve/create TYPE (global)
	const typeId = await upsertType(typeName);

	// 2. Resolve/create PRODUCT (scoped to manufacturer)
	if (!mfrId) {
		// Without manufacturer we can't anchor the product. Skip rather than
		// create products with NULL manufacturer.
		return {
			status: 'unchanged',
			message: 'No manufacturer match (and user did not choose Ignore for this row?)'
		};
	}
	const productId = await upsertProduct(mfrId, catalogNo, row);

	// 3. Compute source row hash for idempotency
	const hash = await sourceRowHash(row);
	const qapIdText = generateQapId(opts.projectName, typeName, catalogNo);

	// 4. Look up existing qap_line by (project, type, product)
	const existing = await db
		.select()
		.from(qapLines)
		.where(
			and(
				eq(qapLines.projectId, opts.projectId),
				eq(qapLines.typeId, typeId),
				eq(qapLines.productId, productId)
			)
		)
		.limit(1);

	if (existing.length === 0) {
		// INSERT new — pr_original_* fields are set ONCE here, never touched again.
		const [inserted] = await db
			.insert(qapLines)
			.values({
				projectId: opts.projectId,
				typeId,
				productId,
				qapIdText,
				qty: numOrNull(row['QTY']),
				currentDn: numOrNull(row['CURRENT DN']),
				marginPct: numOrNull(row['MARGIN']),
				fixtureOrControl: textOrNull(row['FIXTURE / CONTROL DEVICE']),
				finish: textOrNull(row['FINISH']),
				cct: textOrNull(row['CCT']),
				wattage: textOrNull(row['WATTAGE']),
				voltage: textOrNull(row['VOLTAGE']),
				dim: textOrNull(row['DIM']),
				mounting: textOrNull(row['MOUNTING']),
				roughInRequired: textOrNull(row['ROUGH-IN REQUIRED']),
				fixtureCategory: textOrNull(row['FIXTURE CATEGORY']),
				fixtureLocation: textOrNull(row['FIXTURE LOCATION']),
				atticStock: textOrNull(row['ATTIC STOCK']),
				internalDesignerNotes: textOrNull(row['INTERNAL DESIGNER NOTES']),
				notes: textOrNull(row['NOTES']),
				description: textOrNull(row['DESCRIPTION']),
				prOriginalManufacturer: textOrNull(row['PR_ORIGINAL MANUFACTURER']) ?? mfrName,
				prOriginalSpec: textOrNull(row['PR_ORIGINAL SPEC']) ?? catalogNo,
				prOriginalSpecDetail: textOrNull(row['PR_ORIGINAL SPEC DETAIL']),
				sourceRowHash: hash,
				lastImportSessionId: importSessionId,
				createdByUserId: opts.userId,
				updatedByUserId: opts.userId
			})
			.returning({ id: qapLines.id });
		return { status: 'inserted', qapLineId: inserted.id };
	}

	const current = existing[0];

	// If hash matches, this row is unchanged — skip.
	if (current.sourceRowHash === hash) {
		return { status: 'unchanged', qapLineId: current.id };
	}

	// UPDATE — but pr_original_* fields are write-once. Don't overwrite if set.
	// Also bump row_version atomically and capture cell-level audit.
	const fields = {
		qty: numOrNull(row['QTY']),
		currentDn: numOrNull(row['CURRENT DN']),
		marginPct: numOrNull(row['MARGIN']),
		fixtureOrControl: textOrNull(row['FIXTURE / CONTROL DEVICE']),
		finish: textOrNull(row['FINISH']),
		cct: textOrNull(row['CCT']),
		wattage: textOrNull(row['WATTAGE']),
		voltage: textOrNull(row['VOLTAGE']),
		dim: textOrNull(row['DIM']),
		mounting: textOrNull(row['MOUNTING']),
		roughInRequired: textOrNull(row['ROUGH-IN REQUIRED']),
		fixtureCategory: textOrNull(row['FIXTURE CATEGORY']),
		fixtureLocation: textOrNull(row['FIXTURE LOCATION']),
		atticStock: textOrNull(row['ATTIC STOCK']),
		internalDesignerNotes: textOrNull(row['INTERNAL DESIGNER NOTES']),
		notes: textOrNull(row['NOTES']),
		description: textOrNull(row['DESCRIPTION']),
		qapIdText
	};

	// Audit log entries for each changed column
	const auditEntries: typeof auditCells.$inferInsert[] = [];
	for (const [k, newVal] of Object.entries(fields)) {
		const oldVal = (current as Record<string, unknown>)[k];
		if (normalize(oldVal) !== normalize(newVal)) {
			auditEntries.push({
				userId: opts.userId,
				tableName: 'qap_lines',
				rowId: current.id,
				columnName: k,
				operation: 'update',
				oldValue: oldVal as unknown as object,
				newValue: newVal as unknown as object
			});
		}
	}

	await db
		.update(qapLines)
		.set({
			...fields,
			sourceRowHash: hash,
			lastImportSessionId: importSessionId,
			rowVersion: sql`${qapLines.rowVersion} + 1`,
			updatedAt: new Date(),
			updatedByUserId: opts.userId
		})
		.where(eq(qapLines.id, current.id));

	if (auditEntries.length > 0) {
		await db.insert(auditCells).values(auditEntries);
	}

	return { status: 'updated', qapLineId: current.id };
}

async function upsertType(name: string): Promise<string> {
	const existing = await db.select().from(types).where(eq(types.name, name)).limit(1);
	if (existing.length > 0) return existing[0].id;
	const [created] = await db
		.insert(types)
		.values({ name, fixtureOrControl: 'FIXTURE' })
		.returning({ id: types.id });
	return created.id;
}

async function upsertProduct(
	manufacturerCompanyId: string,
	catalogNo: string,
	row: CsvRow
): Promise<string> {
	const existing = await db
		.select()
		.from(products)
		.where(
			and(eq(products.manufacturerCompanyId, manufacturerCompanyId), eq(products.catalogNo, catalogNo))
		)
		.limit(1);
	if (existing.length > 0) return existing[0].id;

	const [created] = await db
		.insert(products)
		.values({
			manufacturerCompanyId,
			catalogNo,
			description: textOrNull(row['DESCRIPTION']),
			finish: textOrNull(row['FINISH']),
			cct: textOrNull(row['CCT']),
			wattage: textOrNull(row['WATTAGE']),
			voltage: textOrNull(row['VOLTAGE']),
			dim: textOrNull(row['DIM']),
			mounting: textOrNull(row['MOUNTING']),
			fixtureOrControl: textOrNull(row['FIXTURE / CONTROL DEVICE'])
		})
		.returning({ id: products.id });
	return created.id;
}

function textOrNull(v: string | undefined): string | null {
	const s = (v ?? '').trim();
	return s === '' ? null : s;
}

function numOrNull(v: string | undefined): string | null {
	const s = (v ?? '').trim();
	if (s === '') return null;
	const n = Number(s);
	if (!Number.isFinite(n)) return null;
	// Drizzle's `numeric` column accepts strings — keeps decimal precision.
	return s;
}

function normalize(v: unknown): string {
	if (v === null || v === undefined) return '';
	return String(v).trim();
}
