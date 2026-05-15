import 'server-only';
import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	type CipherGCM,
	type DecipherGCM
} from 'node:crypto';

/**
 * AES-256-GCM for OAuth tokens at rest.
 *
 * Format: base64(iv) + ':' + base64(ciphertext) + ':' + base64(authTag)
 *
 * The 32-byte key comes from QBO_TOKEN_ENC_KEY (hex-encoded in env). Each
 * encryption uses a fresh 12-byte random IV. The authTag is mandatory — if it
 * doesn't verify on decrypt, we throw (means the ciphertext was tampered with
 * or the key has changed).
 */

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

function getKey(): Buffer {
	const hex = process.env.QBO_TOKEN_ENC_KEY;
	if (!hex) throw new Error('QBO_TOKEN_ENC_KEY is not set');
	const key = Buffer.from(hex, 'hex');
	if (key.length !== 32) {
		throw new Error(
			`QBO_TOKEN_ENC_KEY must decode to 32 bytes (256 bits). Got ${key.length}. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
		);
	}
	return key;
}

export function encryptToken(plaintext: string): string {
	const key = getKey();
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv(ALGO, key, iv) as CipherGCM;
	const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `${iv.toString('base64')}:${enc.toString('base64')}:${tag.toString('base64')}`;
}

export function decryptToken(blob: string): string {
	const parts = blob.split(':');
	if (parts.length !== 3) throw new Error('Malformed encrypted token blob');
	const iv = Buffer.from(parts[0], 'base64');
	const enc = Buffer.from(parts[1], 'base64');
	const tag = Buffer.from(parts[2], 'base64');

	const key = getKey();
	const decipher = createDecipheriv(ALGO, key, iv) as DecipherGCM;
	decipher.setAuthTag(tag);
	const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
	return dec.toString('utf8');
}
