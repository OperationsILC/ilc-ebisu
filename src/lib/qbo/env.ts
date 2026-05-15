import 'server-only';

/**
 * Environment configuration for QBO.
 *
 * QBO_ENVIRONMENT controls which credentials + API base URL are used:
 *   - "sandbox" (default): development keys, sandbox-quickbooks.api.intuit.com
 *   - "production": production keys (require Intuit app review), quickbooks.api.intuit.com
 *
 * QBO_DRY_RUN, if "true", makes every push log what it WOULD send without
 * actually firing the request. Reads are unaffected. Default: true on prod,
 * false on dev — but the explicit env wins.
 */

export type QboEnvironment = 'sandbox' | 'production';

export function getQboEnvironment(): QboEnvironment {
	const v = (process.env.QBO_ENVIRONMENT ?? 'sandbox').toLowerCase();
	return v === 'production' ? 'production' : 'sandbox';
}

export function isQboDryRun(): boolean {
	const v = (process.env.QBO_DRY_RUN ?? '').toLowerCase();
	if (v === 'true' || v === '1' || v === 'yes') return true;
	if (v === 'false' || v === '0' || v === 'no') return false;
	// Default: dry-run ON in production environment, OFF in sandbox (so sandbox
	// can do real round-trip testing).
	return getQboEnvironment() === 'production';
}

export function getQboClientId(): string {
	const env = getQboEnvironment();
	const key = env === 'production' ? 'QBO_CLIENT_ID_PRODUCTION' : 'QBO_CLIENT_ID_SANDBOX';
	const v = process.env[key];
	if (!v) throw new Error(`${key} is not set — required to connect to QBO ${env}`);
	return v;
}

export function getQboClientSecret(): string {
	const env = getQboEnvironment();
	const key = env === 'production' ? 'QBO_CLIENT_SECRET_PRODUCTION' : 'QBO_CLIENT_SECRET_SANDBOX';
	const v = process.env[key];
	if (!v) throw new Error(`${key} is not set — required to connect to QBO ${env}`);
	return v;
}

export function getQboApiBaseUrl(): string {
	return getQboEnvironment() === 'production'
		? 'https://quickbooks.api.intuit.com'
		: 'https://sandbox-quickbooks.api.intuit.com';
}

// OAuth endpoints are the same regardless of environment — Intuit routes by
// the credentials presented in the OAuth basic-auth header.
export const QBO_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
export const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
export const QBO_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';

/**
 * Redirect URI registered on the Intuit Developer app. Same URI is used for
 * both sandbox and production keys.
 */
export function getQboRedirectUri(): string {
	const base = process.env.AUTH_URL ?? 'http://localhost:3000';
	return `${base.replace(/\/$/, '')}/api/qbo/callback`;
}

/** Scopes Ebisu requests. Accounting covers everything we need; openid is
 *  optional but lets us know who connected. */
export const QBO_SCOPES = ['com.intuit.quickbooks.accounting', 'openid', 'profile', 'email'];
