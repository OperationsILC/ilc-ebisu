import 'server-only';
import { cache } from 'react';
import { auth } from '@/auth';
import { db } from './db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';

export type SessionUser = {
	id: string;
	email: string;
	name: string | null;
	role: string;
	active: boolean;
};

/**
 * Return the current authenticated user, or null.
 *
 * Honors the dev-only DEV_AUTH_BYPASS_EMAIL short-circuit: when set in
 * development and pointing at an existing email in the users table, every
 * request is treated as that user. Production is never affected.
 *
 * Memoized per render pass via React's `cache` so multiple Server Components
 * in one render don't all hit the DB.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
	const bypassEmail = process.env.DEV_AUTH_BYPASS_EMAIL;
	if (process.env.NODE_ENV !== 'production' && bypassEmail) {
		const rows = await db.select().from(users).where(eq(users.email, bypassEmail)).limit(1);
		if (rows[0]) {
			return {
				id: rows[0].id,
				email: rows[0].email,
				name: rows[0].name,
				role: rows[0].role,
				active: rows[0].active
			};
		}
	}

	const session = await auth();
	if (!session?.user) return null;
	return {
		id: session.user.id,
		email: session.user.email,
		name: session.user.name ?? null,
		role: session.user.role,
		active: session.user.active
	};
});

/**
 * Use this in Server Actions / Route Handlers that mutate data — throws if
 * no session, so callers don't have to remember to check.
 */
export async function requireUser(): Promise<SessionUser> {
	const u = await getCurrentUser();
	if (!u) throw new Error('Unauthorized');
	return u;
}
