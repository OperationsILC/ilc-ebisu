import { requireUser } from '@/lib/dal';
import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import {
	QBO_AUTH_URL,
	QBO_SCOPES,
	getQboClientId,
	getQboEnvironment,
	getQboRedirectUri
} from '@/lib/qbo/env';

/**
 * GET /api/qbo/connect — kicks off the OAuth2 authorization-code flow.
 *
 * 1. Generates a CSRF state token, stores it in an httpOnly cookie
 * 2. Redirects to Intuit's authorize endpoint with our client_id + scopes
 * 3. User picks a QBO company on Intuit's screen
 * 4. Intuit redirects back to /api/qbo/callback with code + realmId + state
 */
export async function GET() {
	await requireUser();

	const state = randomBytes(24).toString('base64url');
	const url = new URL(QBO_AUTH_URL);
	url.searchParams.set('client_id', getQboClientId());
	url.searchParams.set('redirect_uri', getQboRedirectUri());
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('scope', QBO_SCOPES.join(' '));
	url.searchParams.set('state', state);

	const res = NextResponse.redirect(url.toString());
	res.cookies.set('qbo_oauth_state', state, {
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		maxAge: 60 * 10 // 10 minutes
	});
	res.cookies.set('qbo_oauth_env', getQboEnvironment(), {
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		maxAge: 60 * 10
	});
	return res;
}
