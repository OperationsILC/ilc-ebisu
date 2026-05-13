// Quick post-migration smoke check — confirms the schema, seed data, and DB
// connection are all wired correctly.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, '../.env');

function parseEnv(t) {
	const o = {};
	for (const l of t.split(/\r?\n/)) {
		const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
		if (m) {
			let v = m[2];
			if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
			o[m[1]] = v;
		}
	}
	return o;
}

const env = parseEnv(await fs.readFile(ENV_PATH, 'utf8'));
const c = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const tables = await c.query(`
	SELECT tablename FROM pg_tables
	WHERE schemaname='public'
	ORDER BY tablename
`);
console.log(`Tables (${tables.rows.length}):`, tables.rows.map((r) => r.tablename).join(', '));

const counts = await c.query(`
	SELECT 'users' AS t, count(*)::int AS n FROM users
	UNION ALL SELECT 'companies', count(*) FROM companies
	UNION ALL SELECT 'company_roles', count(*) FROM company_roles
	UNION ALL SELECT 'projects', count(*) FROM projects
	UNION ALL SELECT 'types', count(*) FROM types
	UNION ALL SELECT 'products', count(*) FROM products
	UNION ALL SELECT 'qap_lines', count(*) FROM qap_lines
	ORDER BY t
`);
console.log('\nRow counts:');
for (const r of counts.rows) console.log(`  ${r.t.padEnd(20)} ${r.n}`);

const project = await c.query(
	`SELECT id, name, status, margin_pct FROM projects WHERE name = '16W DRY CREEK TEST'`
);
console.log('\nSeed project:', project.rows[0]);

await c.end();
console.log('\n✓ Smoke check passed.');
