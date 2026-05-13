import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envText = await fs.readFile(path.resolve(__dirname, '../.env'), 'utf8');
const url = envText.match(/^DATABASE_URL="(.+)"$/m)[1];
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

const counts = await c.query(`
	SELECT 'types' AS t, count(*)::int AS n FROM types
	UNION ALL SELECT 'products', count(*) FROM products
	UNION ALL SELECT 'qap_lines', count(*) FROM qap_lines
	UNION ALL SELECT 'import_sessions', count(*) FROM import_sessions
`);
console.log('After-import row counts:');
for (const r of counts.rows) console.log(`  ${r.t.padEnd(20)} ${r.n}`);

const sample = await c.query(`
	SELECT q.qap_id_text, t.name AS type, p.catalog_no, co.name AS mfr, q.qty, q.row_version
	FROM qap_lines q
	JOIN types t ON q.type_id = t.id
	JOIN products p ON q.product_id = p.id
	LEFT JOIN companies co ON p.manufacturer_company_id = co.id
	ORDER BY t.name, p.catalog_no
	LIMIT 8
`);
console.log('\nFirst 8 qap_lines:');
for (const r of sample.rows) {
	console.log(`  ${r.qap_id_text}`);
	console.log(`    type=${r.type}  catalog=${r.catalog_no}  mfr=${r.mfr ?? '(none)'}  qty=${r.qty ?? 'null'}  v${r.row_version}`);
}

const session = await c.query(`
	SELECT id, status, total_rows, rows_imported, rows_skipped, rows_failed
	FROM import_sessions
	WHERE status = 'completed'
	ORDER BY started_at DESC LIMIT 1
`);
console.log('\nLast completed import session:', session.rows[0]);

await c.end();
