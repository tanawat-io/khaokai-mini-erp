// Runs once before the backend test suite: fresh SQLite file, schema pushed (no migration
// history needed for a throwaway test DB), then the same seed data the dev DB uses.

import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TEST_DATABASE_URL } from '../vitest.config';

const repoRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const testDbPath = path.join(repoRoot, 'server', 'prisma', 'test.db');

export default async function setup() {
  if (existsSync(testDbPath)) rmSync(testDbPath);

  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };
  execSync('npx prisma db push', { cwd: repoRoot, env, stdio: 'inherit' });
  execSync('npx tsx server/prisma/seed.ts', {
    cwd: repoRoot,
    env: { ...env, ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'test-password-123' },
    stdio: 'inherit',
  });
}
