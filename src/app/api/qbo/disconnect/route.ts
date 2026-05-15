import { db } from '@/lib/db';
import { qboConnections } from '@/lib/db/schema';
import { requireUser } from '@/lib/dal';
import { decryptToken } from '@/lib/qbo/crypto';
import {
	QBO_REVOKE_URL,
	getQboClientId,
	getQboClientSecret,
	getQboEnvironment
} from '@/lib/qbo/env';
import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';

/**
 * POST /api/qbo/disconnect — revokes the current environment's tokens with
 * Intuit and marks the connection row disconnected.
 *
 * Best-effort: if the revoke API call fails (e.g. tokens already invalid),
 * we still mark the local row disconnected so Ebisu's state matches.
 */
export async function POST() {
	await requireUser();
	const env = getQboEnvironment();

	const conn = (
		await db
			.select()
			.from(qboConnections)
			.where(and(eq(qboConnections.environment, env), isNull(qboConnections.disconnectedAt)))
			.limit(1)
	)[0];
	if (!conn) {
		return NextResponse.json({ ok: true, note: 'No active connection to disconnect.' });
	}

	// Try to revoke at Intuit. Don't fail the whole call if this errors.
	try {
		const refreshToken = decryptToken(conn.refreshTokenCiphertext);
		const basic = Buffer.from(`${getQboClientId()}:${getQboClientSecret()}`).toString('base64');
		await fetch(QBO_REVOKE_URL, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${basic}`,
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify({ token: refreshToken })
		});
	} catch {
		// Swallow — Intuit may already consider the token revoked or have lost it
	}

	await db
		.update(qboConnections)
		.set({ disconnectedAt: new Date(), updatedAt: new Date() })
		.where(eq(qboConnections.id, conn.id));

	const base = process.env.AUTH_URL ?? 'http://localhost:3000';
	return NextResponse.redirect(`${base.replace(/\/$/, '')}/qbo?disconnected=1`, 303);
}
