import { Router } from 'express';
import { prisma } from '../prisma/client';
import { verifyPassword } from '../auth/password';
import { createSession, destroySession, getUserForToken, SESSION_COOKIE_NAME } from '../auth/session';
import { sendError } from './errors';

export const authRouter = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
};

authRouter.post('/login', async (req, res) => {
  const username = String(req.body?.username ?? '');
  const password = String(req.body?.password ?? '');
  const user = await prisma.user.findUnique({ where: { username } });
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    return sendError(res, 401, 'UNAUTHENTICATED', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  const { token, expiresAt } = await createSession(user.id);
  res.cookie(SESSION_COOKIE_NAME, token, { ...COOKIE_OPTIONS, expires: expiresAt });
  res.json({ ok: true, username: user.username });
});

authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (token) await destroySession(token);
  res.clearCookie(SESSION_COOKIE_NAME, COOKIE_OPTIONS);
  res.json({ ok: true });
});

// Deliberately returns only identity — setupComplete has exactly one source of truth,
// RepositorySnapshot.store (fetched via GET /api/snapshot right after login), so the frontend
// guard doesn't have two places that can disagree about whether the wizard should show.
authRouter.get('/me', async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const user = await getUserForToken(token);
  if (!user) return sendError(res, 401, 'UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบ');
  res.json({ username: user.username });
});
