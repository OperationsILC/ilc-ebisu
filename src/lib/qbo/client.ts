import 'server-only';
import { db } from '@/lib/db';
import { qboConnections, type QboConnection } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { decryptToken, encryptToken } from './crypto';
import {
	QBO_TOKEN_URL,
	getQboApiBaseUrl,
	getQboClientId,
	getQboClientSecret,
	getQboEnvironment
} from './env';

/**
 * Get the active QBO connection for the current environment (sandbox|production).
 * Returns null if no active connection exists. The caller should redirect to
 * `/qbo` to connect, or return a "not connected" error.
 */
export async function getActiveQboConnection(): Promise<QboConnection | null> {
	const env = getQboEnvironment();
	const rows = await db
		.select()
		.from(qboConnections)
		.where(and(eq(qboConnections.environment, env), isNull(qboConnections.disconnectedAt)))
		.limit(1);
	return rows[0] ?? null;
}

/**
 * Token-aware HTTPS request to QBO. Refreshes the access token if it's
 * within 60 seconds of expiry. Returns the raw Response so callers can
 * decode JSON or stream as needed.
 *
 * Caller is responsible for status-code handling — this just deals with
 * auth + URL composition.
 */
export async function qboFetch(
	path: string,
	init: RequestInit = {}
): Promise<Response> {
	const conn = await getActiveQboConnection();
	if (!conn) {
		throw new QboNotConnectedError(
			`No active QBO connection for environment "${getQboEnvironment()}". Connect at /qbo first.`
		);
	}
	const fresh = await refreshIfNeeded(conn);
	const accessToken = decryptToken(fresh.accessTokenCiphertext);

	const url = `${getQboApiBaseUrl()}/v3/company/${fresh.realmId}${path}`;
	const headers = new Headers(init.headers ?? {});
	headers.set('Authorization', `Bearer ${accessToken}`);
	headers.set('Accept', 'application/json');
	if (init.body && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}
	return fetch(url, { ...init, headers });
}

/**
 * Convenience JSON GET. Throws on non-2xx.
 */
export async function qboGet<T = unknown>(path: string): Promise<T> {
	const r = await qboFetch(path, { method: 'GET' });
	if (!r.ok) {
		const text = await r.text();
		throw new QboApiError(`QBO GET ${path} failed: ${r.status} ${text}`, r.status);
	}
	return (await r.json()) as T;
}

/**
 * Convenience JSON POST. Throws on non-2xx.
 */
export async function qboPost<T = unknown>(path: string, body: unknown): Promise<T> {
	const r = await qboFetch(path, { method: 'POST', body: JSON.stringify(body) });
	if (!r.ok) {
		const text = await r.text();
		throw new QboApiError(`QBO POST ${path} failed: ${r.status} ${text}`, r.status);
	}
	return (await r.json()) as T;
}

/**
 * QBO Query Language: a SQL-ish subset accepted at /query?query=...
 * Useful for "find Customer where Name = '...'" without paging through lists.
 */
export async function qboQuery<T = unknown>(query: string): Promise<T> {
	const encoded = encodeURIComponent(query);
	return qboGet<T>(`/query?query=${encoded}&minorversion=70`);
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

const REFRESH_WINDOW_MS = 60 * 1000;

async function refreshIfNeeded(conn: QboConnection): Promise<QboConnection> {
	const expiresAtMs = conn.expiresAt.getTime();
	if (expiresAtMs > Date.now() + REFRESH_WINDOW_MS) return conn;

	const refreshToken = decryptToken(conn.refreshTokenCiphertext);
	const params = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: refreshToken
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
		// If refresh fails (e.g. token was revoked), mark this connection
		// disconnected so users get pushed back to /qbo to re-auth.
		await db
			.update(qboConnections)
			.set({
				disconnectedAt: new Date(),
				updatedAt: new Date()
			})
			.where(eq(qboConnections.id, conn.id));
		throw new QboNotConnectedError(
			`QBO token refresh failed (${r.status}): ${text}. Reconnect at /qbo.`
		);
	}

	const json = (await r.json()) as {
		access_token: string;
		refresh_token: string;
		expires_in: number;
		x_refresh_token_expires_in?: number;
		token_type: string;
	};

	const newExpiresAt = new Date(Date.now() + json.expires_in * 1000);
	const updates = {
		accessTokenCiphertext: encryptToken(json.access_token),
		refreshTokenCiphertext: encryptToken(json.refresh_token),
		expiresAt: newExpiresAt,
		updatedAt: new Date()
	};
	await db.update(qboConnections).set(updates).where(eq(qboConnections.id, conn.id));

	return { ...conn, ...updates };
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class QboNotConnectedError extends Error {
	constructor(msg: string) {
		super(msg);
		this.name = 'QboNotConnectedError';
	}
}

export class QboApiError extends Error {
	constructor(
		msg: string,
		public status: number
	) {
		super(msg);
		this.name = 'QboApiError';
	}
}
