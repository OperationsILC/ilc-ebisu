// Standalone seed runner. Connects to ebisu DB directly via pg (bypassing
// SvelteKit's $env alias), then inserts ILC test users, companies +
// company_roles, and one test project. Idempotent — re-running adds nothing.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

const USERS = [
	{ email: 'sean@ilcstudios.com', name: 'Sean McCauley', role: 'admin' },
	{ email: 'mason@ilcstudios.com', name: 'Mason Bartlett', role: 'project_manager' },
	{ email: 'olivia@ilcstudios.com', name: 'Olivia Murphy', role: 'project_manager' },
	{ email: 'jason@ilcstudios.com', name: 'Jason Mullen', role: 'admin' },
	{ email: 'mike@ilcstudios.com', name: 'Michael Kirshner', role: 'admin' },
	{ email: 'operations@ilcstudios.com', name: 'Operations', role: 'admin' }
];

const COMPANIES = [
	{ name: 'LOGIQ SUPPLY', roles: ['manufacturer', 'rep_firm'], city: 'DENVER', state: 'CO' },
	{ name: 'ELUMA', roles: ['manufacturer'] },
	{ name: 'NORA LIGHTING', roles: ['manufacturer'] },
	{ name: 'BARRON', roles: ['manufacturer'] },
	{ name: 'VISUAL COMFORT', roles: ['manufacturer'] },
	{ name: 'AFX', roles: ['manufacturer'] },
	{ name: 'KLIK', roles: ['manufacturer'] },
	{ name: 'HAPCO', roles: ['manufacturer'] },
	{ name: 'PRIMUS', roles: ['manufacturer'] },
	{ name: 'ACUITY', roles: ['manufacturer'] },
	{ name: 'BIG ASS FANS', roles: ['manufacturer'] },
	{ name: 'LUMINII LLC', roles: ['manufacturer'] },
	{ name: 'VAXCEL LIGHTING', roles: ['manufacturer'] },
	{ name: 'ARTERIORS', roles: ['manufacturer'] },
	{ name: 'IN COMMON WITH', roles: ['manufacturer'] },
	{ name: 'GLOBE ELECTRIC', roles: ['manufacturer'] },
	{ name: 'MAXIM', roles: ['manufacturer'] },
	{ name: 'PEARED CREATIONS', roles: ['manufacturer'] },
	{ name: 'PLP SOCAL', roles: ['rep_firm'] },
	{ name: 'COAST TO COAST', roles: ['rep_firm'] }
];

const PROJECT = {
	name: '16W DRY CREEK TEST',
	status: 'test',
	margin_pct: '23',
	freight_pct: '6',
	warehousing_pct: '3',
	sales_tax_pct: '8.72',
	description: 'Phase 1 smoke-test project — used by seed + import fixtures.'
};

async function main() {
	const env = parseEnv(await fs.readFile(ENV_PATH, 'utf8'));
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL missing from app/.env');

	const client = new pg.Client({
		connectionString: env.DATABASE_URL,
		ssl: { rejectUnauthorized: false }
	});
	await client.connect();
	console.log('Connected to ebisu DB.');

	// Users
	for (const u of USERS) {
		await client.query(
			`INSERT INTO users (email, name, role) VALUES ($1, $2, $3)
			 ON CONFLICT (email) DO NOTHING`,
			[u.email, u.name, u.role]
		);
	}
	console.log(`✓ Upserted ${USERS.length} users`);

	// Companies + roles
	for (const c of COMPANIES) {
		const r = await client.query(
			`INSERT INTO companies (name, city, state) VALUES ($1, $2, $3)
			 ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
			 RETURNING id`,
			[c.name, c.city ?? null, c.state ?? null]
		);
		const companyId = r.rows[0].id;
		for (const role of c.roles) {
			await client.query(
				`INSERT INTO company_roles (company_id, role) VALUES ($1, $2)
				 ON CONFLICT (company_id, role) DO NOTHING`,
				[companyId, role]
			);
		}
	}
	console.log(`✓ Upserted ${COMPANIES.length} companies with their roles`);

	// Test project
	await client.query(
		`INSERT INTO projects (
			name, status, margin_pct, freight_pct, warehousing_pct,
			sales_tax_pct, description
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (name) DO NOTHING`,
		[
			PROJECT.name,
			PROJECT.status,
			PROJECT.margin_pct,
			PROJECT.freight_pct,
			PROJECT.warehousing_pct,
			PROJECT.sales_tax_pct,
			PROJECT.description
		]
	);
	console.log(`✓ Ensured project "${PROJECT.name}" exists`);

	await client.end();
	console.log('Seed complete.');
}

main().catch((err) => {
	console.error('Seed failed:', err.message);
	process.exit(1);
});
