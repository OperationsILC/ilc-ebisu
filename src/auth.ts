import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from './lib/db';
import { users, accounts, sessions, verificationTokens } from './lib/db/schema';
import { eq } from 'drizzle-orm';

const allowedDomains = (process.env.AUTH_ALLOWED_EMAIL_DOMAINS ?? 'ilcstudios.com')
	.split(',')
	.map((d) => d.trim().toLowerCase())
	.filter(Boolean);

function emailDomainAllowed(email: string | null | undefined): boolean {
	if (!email) return false;
	const at = email.lastIndexOf('@');
	if (at < 0) return false;
	return allowedDomains.includes(email.slice(at + 1).toLowerCase());
}

export const { handlers, signIn, signOut, auth } = NextAuth({
	adapter: DrizzleAdapter(db, {
		usersTable: users,
		accountsTable: accounts,
		sessionsTable: sessions,
		verificationTokensTable: verificationTokens
	}),
	providers: [
		Google({
			clientId: process.env.AUTH_GOOGLE_ID,
			clientSecret: process.env.AUTH_GOOGLE_SECRET
		})
	],
	session: { strategy: 'database' },
	secret: process.env.AUTH_SECRET,
	trustHost: true,
	callbacks: {
		async signIn({ user }) {
			if (!emailDomainAllowed(user.email)) {
				console.warn(`[auth] rejected sign-in from ${user.email} — not in allowed domains`);
				return false;
			}
			return true;
		},
		async session({ session, user }) {
			if (user?.id) {
				const rows = await db
					.select({ role: users.role, active: users.active })
					.from(users)
					.where(eq(users.id, user.id))
					.limit(1);
				if (rows[0]) {
					(session.user as { id: string; role: string; active: boolean }).id = user.id;
					(session.user as { id: string; role: string; active: boolean }).role = rows[0].role;
					(session.user as { id: string; role: string; active: boolean }).active = rows[0].active;
				}
			}
			return session;
		}
	},
	pages: { signIn: '/signin' }
});

declare module 'next-auth' {
	interface Session {
		user: {
			id: string;
			email: string;
			name?: string | null;
			image?: string | null;
			role: string;
			active: boolean;
		};
	}
}
