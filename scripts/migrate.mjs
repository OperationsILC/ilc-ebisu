// Direct SQL migration runner — bypasses drizzle-kit's CLI which hangs on
// AWS RDS SSL. Reads every .sql file in src/lib/db/migrations in order and
// executes each one as a single transaction. Tracks applied migrations in a
// __migrations table so re-runs are no-ops.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../src/lib/db/migrations');
const ENV_PATH = path.resolve(__dirname, '../.env');

function parseEnv(text) {
	const out = {};
	for (const line of text.split(/\r?\n/)) {
		const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
		if (!m) continue;
		let v = m[2];
		if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
			v = v.slice(1, -1);
		}
		out[m[1]] = v;
	}
	return out;
}

async function main() {
	const envText = await fs.readFile(ENV_PATH, 'utf8');
	const env = parseEnv(envText);
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL missing from app/.env');

	const files = (await fs.readdir(MIGRATIONS_DIR))
		.filter((f) => f.endsWith('.sql'))
		.sort();
	console.log(`Found ${files.length} migration file(s): ${files.join(', ')}`);

	const client = new pg.Client({
		connectionString: env.DATABASE_URL,
		ssl: { rejectUnauthorized: false }
	});
	await client.connect();
	console.log('Connected to ebisu DB.');

	// Create a tracking table so we don't re-run migrations.
	await client.query(`
		CREATE TABLE IF NOT EXISTS __migrations (
			id SERIAL PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`);

	const { rows: applied } = await client.query('SELECT name FROM __migrations');
	const appliedSet = new Set(applied.map((r) => r.name));

	for (const file of files) {
		if (appliedSet.has(file)) {
			console.log(`✓ ${file} — already applied, skipping`);
			continue;
		}
		const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
		console.log(`→ Applying ${file}…`);
		try {
			await client.query('BEGIN');
			// Split on Drizzle's statement-breakpoint markers — each statement runs separately.
			const statements = sql.split(/--\s*>?\s*statement-breakpoint/);
			for (const stmt of statements) {
				const trimmed = stmt.trim();
				if (!trimmed) continue;
				await client.query(trimmed);
			}
			await client.query('INSERT INTO __migrations (name) VALUES ($1)', [file]);
			await client.query('COMMIT');
			console.log(`✓ ${file} — applied`);
		} catch (err) {
			await client.query('ROLLBACK');
			console.error(`✗ ${file} — failed:`, err.message);
			throw err;
		}
	}

	await client.end();
	console.log('All migrations applied.');
}

main().catch((err) => {
	console.error('Migration failed:', err.message);
	process.exit(1);
});
