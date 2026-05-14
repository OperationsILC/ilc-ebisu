// One-off: set quote_emails / order_emails on a company by name. Run like:
//   node scripts/set-company-emails.mjs "LOGIQ SUPPLY" --quote andrew@logiqsupply.com --orders andrew@logiqsupply.com
//
// Either flag can be omitted (leaves that field untouched).

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

const args = process.argv.slice(2);
const name = args[0];
let quoteEmail = null;
let ordersEmail = null;
for (let i = 1; i < args.length; i++) {
	if (args[i] === '--quote' && i + 1 < args.length) {
		quoteEmail = args[++i];
	} else if (args[i] === '--orders' && i + 1 < args.length) {
		ordersEmail = args[++i];
	}
}

if (!name) {
	console.error('Usage: node scripts/set-company-emails.mjs <company name> [--quote EMAIL] [--orders EMAIL]');
	process.exit(1);
}
if (!quoteEmail && !ordersEmail) {
	console.error('Provide at least one of --quote or --orders');
	process.exit(1);
}

const env = parseEnv(await fs.readFile(ENV_PATH, 'utf8'));
const client = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const before = (await client.query(
	'SELECT id, name, quote_emails, order_emails FROM companies WHERE name = $1',
	[name]
)).rows[0];

if (!before) {
	console.error(`No company named "${name}"`);
	await client.end();
	process.exit(1);
}

console.log('Before:', before);

const sets = [];
const vals = [name];
if (quoteEmail) { sets.push(`quote_emails = $${vals.length + 1}`); vals.push(quoteEmail); }
if (ordersEmail) { sets.push(`order_emails = $${vals.length + 1}`); vals.push(ordersEmail); }
sets.push(`updated_at = now()`);

await client.query(
	`UPDATE companies SET ${sets.join(', ')} WHERE name = $1`,
	vals
);

const after = (await client.query(
	'SELECT id, name, quote_emails, order_emails FROM companies WHERE name = $1',
	[name]
)).rows[0];

console.log('After: ', after);
console.log('Done.');
await client.end();
