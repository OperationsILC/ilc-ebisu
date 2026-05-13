import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	out: './src/lib/db/migrations',
	schema: './src/lib/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL ?? 'postgres://localhost/ebisu_dev',
		ssl: process.env.DATABASE_URL?.includes('rds.amazonaws.com')
			? { rejectUnauthorized: false }
			: false
	},
	verbose: true,
	strict: true
});
