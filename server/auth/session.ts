// Session issuance/validation. A session is a random opaque token stored server-side (Session
// table) with an expiry — never a client-decodable JWT, and never trusted without a DB lookup
// (Phase 3B §13: "never trust a frontend-only auth flag").

import { randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';

const SESSION_COOKIE = 'khaokai_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

export async function getUserForToken(token: string | undefined) {
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { token } });
    return null;
  }
  return session.user;
}

/** Rejects any request without a valid, unexpired session — applied to every route except auth/health. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  const user = await getUserForToken(token);
  if (!user) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'กรุณาเข้าสู่ระบบ' } });
    return;
  }
  (req as Request & { userId: string }).userId = user.id;
  next();
}
