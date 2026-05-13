/**
 * Generate the canonical QAP ID for a line item. Format:
 *
 *   "PROJECT - TYPE - CATALOG #"
 *
 * Joined with " - " (hyphen flanked by single spaces). Empty components are
 * left blank so the user can see what's missing rather than producing an
 * ambiguous concatenation. Ported from IMPORT_TEMPLATE_SCRIPT.txt:1442.
 */
export function generateQapId(project: string, type: string, catalog: string): string {
	const p = (project ?? '').trim();
	const t = (type ?? '').trim();
	const c = (catalog ?? '').trim();
	return `${p} - ${t} - ${c}`.replace(/ {2,}/g, ' ');
}

/**
 * Stable hash of a designer-supplied CSV row's import-relevant fields.
 * Used to detect "did this row change since last import" — re-imports of
 * unchanged rows are skipped (Apps Script's STATUS=OK idempotency).
 */
export async function sourceRowHash(row: Record<string, unknown>): Promise<string> {
	const fields = [
		'PROJECT',
		'TYPE',
		'CATALOG #',
		'MANUFACTURER',
		'QTY',
		'FIXTURE / CONTROL DEVICE',
		'DESCRIPTION',
		'CURRENT DN',
		'MARGIN',
		'FINISH',
		'CCT',
		'WATTAGE',
		'VOLTAGE',
		'DIM',
		'MOUNTING',
		'ROUGH-IN REQUIRED',
		'NOTES',
		'FIXTURE CATEGORY',
		'FIXTURE LOCATION',
		'ATTIC STOCK',
		'INTERNAL DESIGNER NOTES'
	];
	const parts = fields.map((k) => `${k}=${String(row[k] ?? '').trim()}`);
	const text = parts.join('|');

	// Node's webcrypto digest. ~32 chars hex prefix is enough to be collision-safe
	// at our scale (millions of rows would be fine).
	const enc = new TextEncoder().encode(text);
	const buf = await crypto.subtle.digest('SHA-256', enc);
	return Array.from(new Uint8Array(buf))
		.slice(0, 16)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
