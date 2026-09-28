import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Chiffrement AES-256-GCM des secrets restaurateur (clés Shipday, Stuart…).
 * Format stocké : "v1.<iv b64url>.<tag b64url>.<ciphertext b64url>".
 * Le préfixe de version permet une rotation de clé future.
 */

const ALGO = 'aes-256-gcm';
const VERSION = 'v1';

function toKey(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) throw new Error('La clé de chiffrement doit faire 32 octets.');
  return key;
}

export function encryptSecret(plaintext: string, keyB64: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, toKey(keyB64), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ciphertext]
    .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
    .join('.');
}

export function decryptSecret(payload: string, keyB64: string): string {
  const [version, iv, tag, ciphertext] = payload.split('.');
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Secret chiffré illisible.');
  }
  const decipher = createDecipheriv(ALGO, toKey(keyB64), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/** Affichage sûr dans le back-office : "sk_…a1b2". */
export function maskSecret(secret: string): string {
  return secret.length <= 8 ? '••••' : `${secret.slice(0, 3)}…${secret.slice(-4)}`;
}
