// One-shot renumbering script: RFQ##### -> RQ##### and SHP##### -> SH#####
// Safe to re-run; the regex only matches the old prefixes.
//
// Run with:  node scripts/renumber-rfq-shp.mjs

import { config } from 'dotenv';
import { Pool } from 'pg';

config({ path: '.env' });

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: { rejectUnauthorized: false }
});

async function main() {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');

		const rfqRes = await client.query(
			`UPDATE rfqs
			 SET rfq_no = 'RQ' || substring(rfq_no FROM 4)
			 WHERE rfq_no LIKE 'RFQ%'
			 RETURNING rfq_no`
		);
		console.log(`Renamed ${rfqRes.rowCount} RFQ${rfqRes.rowCount === 1 ? '' : 's'}.`);

		const shpRes = await client.query(
			`UPDATE shipments
			 SET shipment_no = 'SH' || substring(shipment_no FROM 4)
			 WHERE shipment_no LIKE 'SHP%'
			 RETURNING shipment_no`
		);
		console.log(`Renamed ${shpRes.rowCount} shipment${shpRes.rowCount === 1 ? '' : 's'}.`);

		await client.query('COMMIT');
		console.log('Done.');
	} catch (err) {
		await client.query('ROLLBACK');
		console.error('Rollback. Error:', err);
		process.exit(1);
	} finally {
		client.release();
		await pool.end();
	}
}

main();
