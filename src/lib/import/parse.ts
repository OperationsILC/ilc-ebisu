import Papa from 'papaparse';

/**
 * Raw CSV row from the designer template. Keys match the IMPORT_TEMPLATE
 * headers verbatim. Unknown columns are kept for forward-compatibility.
 */
export type CsvRow = Record<string, string>;

/**
 * Required headers from the designer's IMPORT_TEMPLATE - ROUTE 40 v2.csv.
 * Subset matters for import; everything else is preserved on the row.
 */
export const REQUIRED_HEADERS = [
	'PROJECT',
	'TYPE',
	'CATALOG #',
	'MANUFACTURER'
] as const;

export type ParseResult = {
	rows: CsvRow[];
	headers: string[];
	skipped: { row: number; reason: 'empty' | 'slug' }[];
	errors: string[];
};

/**
 * Parse a CSV file (string contents) into rows, applying the Apps Script's
 * empty-row and slug-row skip rules.
 *
 * Slug rows are rows pasted by designers that contain Tadabase field IDs
 * ("field_1234") in 3+ columns — they were the second row of the template
 * before designers stripped them, and we want to keep ignoring them in case
 * any sneak through. See IMPORT_TEMPLATE_SCRIPT.txt:1514.
 */
export function parseCsv(content: string): ParseResult {
	const parsed = Papa.parse<CsvRow>(content, {
		header: true,
		skipEmptyLines: 'greedy',
		transformHeader: (h) => h.trim()
	});

	const errors: string[] = parsed.errors.map((e) => `Row ${e.row}: ${e.message}`);
	const headers = parsed.meta.fields ?? [];

	// Validate required headers present
	for (const h of REQUIRED_HEADERS) {
		if (!headers.includes(h)) {
			errors.push(`Missing required column: "${h}"`);
		}
	}

	const skipped: ParseResult['skipped'] = [];
	const kept: CsvRow[] = [];

	parsed.data.forEach((row, i) => {
		const rowNum = i + 2; // 1-based, plus header row
		if (isEmptyRow(row)) {
			skipped.push({ row: rowNum, reason: 'empty' });
			return;
		}
		if (isSlugRow(row)) {
			skipped.push({ row: rowNum, reason: 'slug' });
			return;
		}
		kept.push(row);
	});

	return { rows: kept, headers, skipped, errors };
}

function isEmptyRow(row: CsvRow): boolean {
	// Only checks fields we care about for import — extra blank columns ignored.
	for (const key of REQUIRED_HEADERS) {
		if ((row[key] ?? '').trim() !== '') return false;
	}
	return true;
}

const SLUG_RE = /^field_\d+$/;

function isSlugRow(row: CsvRow): boolean {
	let n = 0;
	for (const v of Object.values(row)) {
		if (SLUG_RE.test(String(v).trim())) n++;
		if (n >= 3) return true;
	}
	return false;
}
