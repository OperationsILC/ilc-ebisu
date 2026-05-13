import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
	console.warn('[db] DATABASE_URL is not set — DB queries will fail.');
}

// AWS RDS requires SSL but its cert isn't in Node's default trust store.
// rejectUnauthorized=false accepts the cert without verification, which is
// fine since RDS authenticates us via the password. Skip SSL entirely for
// non-RDS hosts.
const isRds = process.env.DATABASE_URL?.includes('rds.amazonaws.com') ?? false;

const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL,
	max: 10,
	ssl: isRds ? { rejectUnauthorized: false } : undefined
});

export const db = drizzle(pool, { schema });
export { schema };
export type Db = typeof db;
