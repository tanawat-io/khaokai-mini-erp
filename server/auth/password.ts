// Password hashing via Node's built-in crypto.scrypt — no native-binding dependency (bcrypt)
// needed. Phase 3B §21: passwords are never stored or compared in plaintext.

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const storedBuf = Buffer.from(hashHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return timingSafeEqual(derived, storedBuf);
}
