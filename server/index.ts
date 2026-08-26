// .env must be loaded via `--env-file=.env` on the node/tsx invocation (see package.json's
// "server" script), not here — ESM hoists all `import` statements above any top-level statement
// in this file, so a call here would run too late for ../prisma/client.ts's own top-level check.

import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './api/authRouter';
import { router } from './api/router';
import { requireAuth } from './auth/session';

const app = express();
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api', requireAuth, router);

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`khaokai backend listening on http://localhost:${port}`);
});
