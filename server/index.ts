// .env must be loaded via `--env-file=.env` on the node/tsx invocation (see package.json's
// "server" script), not here — ESM hoists all `import` statements above any top-level statement
// in this file, so a call here would run too late for ../prisma/client.ts's own top-level check.

import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './api/authRouter';
import { router } from './api/router';
import { requireAuth } from './auth/session';
import { prisma } from './prisma/client';

const app = express();
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
if (process.env.VITEST) {
  app.get('/api/__test-throw', (_req, _res, next) => next(new Error('test boom')));
}
app.use('/api/auth', authRouter);
app.use('/api', requireAuth, router);

// 404 for unknown /api routes — after requireAuth so unauthenticated callers still get 401 first
// via requireAuth, authenticated callers get the JSON NOT_FOUND envelope.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'ไม่พบ API endpoint ที่ร้องขอ' } });
});

// Global error handler — must be last, 4-arg signature so Express treats it as error middleware.
// Preserves JSON envelope, never leaks stack/Prisma internals, handles malformed JSON explicitly.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const e = err as { type?: string; status?: number; statusCode?: number; message?: string; stack?: string };
  // express.json() SyntaxError for malformed JSON — body-parser sets type/entity parse
  if (e instanceof SyntaxError || e?.type === 'entity.parse.failed') {
    console.error('[api] malformed JSON', e.message);
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'รูปแบบข้อมูลไม่ถูกต้อง' } });
    return;
  }
  const status = (typeof e?.status === 'number' ? e.status : typeof e?.statusCode === 'number' ? e.statusCode : 500);
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  console.error('[api] unexpected error', e?.stack ?? e?.message ?? String(err));
  // Never echo Prisma internals or stack to client
  res.status(safeStatus).json({ error: { code: 'VALIDATION_ERROR', message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' } });
});

export { app };

const port = Number(process.env.PORT ?? 3001);
export const server = !process.env.VITEST
  ? app.listen(port, () => {
      console.log(`khaokai backend listening on http://localhost:${port}`);
    })
  : (null as unknown as ReturnType<typeof app.listen>);

// Graceful shutdown — prevent WAL lock / resource leak on SIGINT/SIGTERM.
// Close HTTP server (stop accepting, allow in-flight to finish), disconnect Prisma, exit.
let shuttingDown = false;
export async function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received — closing server`);
  const srv: ReturnType<typeof app.listen> | null = server as unknown as ReturnType<typeof app.listen> | null;
  if (srv && typeof (srv as { close?: unknown }).close === 'function') {
    srv.close(async () => {
      try {
        await prisma.$disconnect();
      } catch (e) {
        console.error('[shutdown] prisma disconnect error', e);
      } finally {
        process.exit(0);
      }
    });
  } else {
    try {
      await prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  }
  // Force exit if connections linger (e.g. keep-alive)
  setTimeout(() => {
    console.error('[shutdown] force exit after timeout');
    process.exit(1);
  }, 10_000).unref();
}
export function resetShutdownForTest() {
  shuttingDown = false;
}
if (!process.env.VITEST) {
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}
