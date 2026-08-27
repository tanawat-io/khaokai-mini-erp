// .env must be loaded via `--env-file=.env` on the node/tsx invocation (see package.json's
// "server" script), not here — ESM hoists all `import` statements above any top-level statement
// in this file, so a call here would run too late for ./app's own transitive top-level check.
// Local dev / test entrypoint only — the Netlify Function (netlify/functions/api.ts) imports
// `app` from ./app directly and never runs the listen/signal-handling code below.

import { app } from './app';
import { prisma } from './prisma/client';

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
