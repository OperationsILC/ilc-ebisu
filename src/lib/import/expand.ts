import type { CsvRow } from './parse';

/**
 * Expand "kit" rows where CATALOG # is a " + "-joined list of part numbers
 * into N rows, one per part number, with everything else duplicated.
 *
 * Designers use this shorthand when a single fixture type is delivered as
 * multiple line-items shipped together (e.g. a recessed downlight + its
 * housing + its trim). Ported from IMPORT_TEMPLATE_SCRIPT.txt:1383.
 */
export function expandKitRows(rows: CsvRow[]): CsvRow[] {
	const out: CsvRow[] = [];
	for (const row of rows) {
		const catalog = (row['CATALOG #'] ?? '').trim();
		if (!catalog.includes(' + ')) {
			out.push(row);
			continue;
		}
		const parts = catalog
			.split(' + ')
			.map((s) => s.trim())
			.filter(Boolean);
		if (parts.length <= 1) {
			out.push(row);
			continue;
		}
		for (const part of parts) {
			out.push({ ...row, 'CATALOG #': part });
		}
	}
	return out;
}
