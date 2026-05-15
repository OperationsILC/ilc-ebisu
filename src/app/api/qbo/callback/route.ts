import { db } from '@/lib/db';
import { qboConnections } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { encryptToken } from '@/lib/qbo/crypto';
import {
	QBO_TOKEN_URL,
	getQboClientId,
	getQboClientSecret,
	getQboRedirectUri,
	type QboEnvironment
} from '@/lib/qbo/env';
import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

/**
 * GET /api/qbo/callback — handles Intuit's redirect back with code + realmId.
 *
 *   ?code=...&state=...&realmId=...
 *
 * 1. Verify state matches the cookie we set on /connect
 * 2. Exchange code for access + refresh tokens
 * 3. Encrypt + store on a new qbo_connections row (marking any prior active
 *    connection for the same environment disconnected)
 * 4. Redirect to /qbo for follow-up config (income / cogs account picks)
 */
export async function GET(req: Request) {
	const user = await requireUser();
	const url = new URL(req.url);

	const code = url.searchParams.get('code');
	const realmId = url.searchParams.get('realmId');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');

	if (error) {
		return errorRedirect(`Intuit returned an error: ${error}`);
	}
	if (!code || !realmId || !state) {
		return errorRedirect('Callback missing code / realmId / state.');
	}

	// Verify CSRF state from cookie
	const cookieState = req.headers
		.get('cookie')
		?.split(/;\s*/)
		.find((c) => c.startsWith('qbo_oauth_state='))
		?.split('=')[1];
	if (!cookieState || cookieState !== state) {
		return errorRedirect('OAuth state mismatch. Try connecting again.');
	}

	const cookieEnv = req.headers
		.get('cookie')
		?.split(/;\s*/)
		.find((c) => c.startsWith('qbo_oauth_env='))
		?.split('=')[1] as QboEnvironment | undefined;
	const environment: QboEnvironment = cookieEnv === 'production' ? 'production' : 'sandbox';

	// Exchange code for tokens
	const params = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		redirect_uri: getQboRedirectUri()
	});
	const basic = Buffer.from(`${getQboClientId()}:${getQboClientSecret()}`).toString('base64');

	const r = await fetch(QBO_TOKEN_URL, {
		method: 'POST',
		headers: {
			Authorization: `Basic ${basic}`,
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json'
		},
		body: params.toString()
	});
	if (!r.ok) {
		const text = await r.text();
		return errorRedirect(`Token exchange failed (${r.status}): ${text}`);
	}
	const json = (await r.json()) as {
		access_token: string;
		refresh_token: string;
		expires_in: number;
		x_refresh_token_expires_in: number;
		token_type: string;
	};
	const expiresAt = new Date(Date.now() + json.expires_in * 1000);

	// Mark any prior active connection for this environment disconnected.
	await db
		.update(qboConnections)
		.set({ disconnectedAt: new Date(), updatedAt: new Date() })
		.where(
			and(
				eq(qboConnections.environment, environment),
				isNull(qboConnections.disconnectedAt)
			)
		);

	// Insert the new connection
	await db.insert(qboConnections).values({
		environment,
		realmId,
		accessTokenCiphertext: encryptToken(json.access_token),
		refreshTokenCiphertext: encryptToken(json.refresh_token),
		expiresAt,
		connectedByUserId: user.id
	});

	// Clear the OAuth state cookies and redirect to /qbo for follow-up config
	const base = process.env.AUTH_URL ?? `${url.protocol}//${url.host}`;
	const redirect = NextResponse.redirect(`${base.replace(/\/$/, '')}/qbo?connected=1`);
	redirect.cookies.delete('qbo_oauth_state');
	redirect.cookies.delete('qbo_oauth_env');
	return redirect;
}

function errorRedirect(reason: string): NextResponse {
	const base = process.env.AUTH_URL ?? 'http://localhost:3000';
	const u = new URL(`${base.replace(/\/$/, '')}/qbo`);
	u.searchParams.set('error', reason);
	return NextResponse.redirect(u.toString());
}
