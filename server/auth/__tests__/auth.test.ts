import { describe, it, expect } from 'vitest';
import { prisma } from '../../prisma/client';
import { hashPassword, verifyPassword } from '../password';
import { createSession, destroySession, getUserForToken } from '../session';

describe('password hashing', () => {
  it('round-trips correctly and rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('wrong password', hash)).toBe(false);
  });

  it('never stores the plaintext password in the hash string', async () => {
    const hash = await hashPassword('super-secret-123');
    expect(hash).not.toContain('super-secret-123');
  });
});

describe('sessions', () => {
  it('creates a session that resolves to the user, then invalidates on destroy', async () => {
    const user = await prisma.user.findFirstOrThrow();
    const { token } = await createSession(user.id);

    const resolved = await getUserForToken(token);
    expect(resolved?.id).toBe(user.id);

    await destroySession(token);
    const afterDestroy = await getUserForToken(token);
    expect(afterDestroy).toBeNull();
  });

  it('rejects an unknown token', async () => {
    expect(await getUserForToken('not-a-real-token')).toBeNull();
  });
});
