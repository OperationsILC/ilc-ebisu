import { db } from '../db';
import { companies, companyRoles } from '../db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import type { CsvRow } from './parse';

export type Mismatch = {
	row: number; // 1-based row in the CSV (after slug/empty skips removed? No — original row number)
	value: string;
};

export type ValidationResult = {
	uniqueMfrs: string[];
	matched: Map<string, string>; // raw name -> company id
	mismatches: Mismatch[];
};

/**
 * Manufacturer pre-flight: every unique MANUFACTURER value in the CSV must
 * match an existing companies row with the `manufacturer` role.
 *
 * Returns the list of unique values, which matched, and which didn't (with
 * row numbers so the UI can flag them). The UI then asks the user to
 * Ignore-and-continue (skip those rows) or Cancel-and-revise (fix the CSV).
 *
 * Mirrors IMPORT_TEMPLATE_SCRIPT.txt:579-637.
 */
export async function validateManufacturers(rows: CsvRow[]): Promise<ValidationResult> {
	const uniqueMfrsSet = new Set<string>();
	for (const row of rows) {
		const v = (row['MANUFACTURER'] ?? '').trim();
		if (v) uniqueMfrsSet.add(v);
	}
	const uniqueMfrs = [...uniqueMfrsSet];

	const matched = new Map<string, string>();
	if (uniqueMfrs.length > 0) {
		// Find companies whose name matches (case-insensitive via lowercase)
		// AND that hold the `manufacturer` role.
		const found = await db
			.select({ id: companies.id, name: companies.name })
			.from(companies)
			.innerJoin(companyRoles, eq(companyRoles.companyId, companies.id))
			.where(
				and(
					eq(companyRoles.role, 'manufacturer'),
					inArray(companies.name, uniqueMfrs)
				)
			);
		for (const c of found) {
			matched.set(c.name, c.id);
		}

		// Case-insensitive second pass for the unmatched
		const stillMissing = uniqueMfrs.filter((m) => !matched.has(m));
		if (stillMissing.length > 0) {
			const upperRows = await db
				.select({ id: companies.id, name: companies.name })
				.from(companies)
				.innerJoin(companyRoles, eq(companyRoles.companyId, companies.id))
				.where(eq(companyRoles.role, 'manufacturer'));
			const byUpper = new Map(upperRows.map((c) => [c.name.toUpperCase(), c.id]));
			for (const m of stillMissing) {
				const id = byUpper.get(m.toUpperCase());
				if (id) matched.set(m, id);
			}
		}
	}

	const mismatches: Mismatch[] = [];
	rows.forEach((row, i) => {
		const v = (row['MANUFACTURER'] ?? '').trim();
		if (v && !matched.has(v)) {
			mismatches.push({ row: i + 2, value: v }); // +2 = header row + 1-based
		}
	});

	return { uniqueMfrs, matched, mismatches };
}
