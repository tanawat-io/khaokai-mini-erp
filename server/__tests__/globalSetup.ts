// Runs once before the backend test suite: drops/recreates the isolated `test` Postgres schema
// (see vitest.config.ts — same Supabase instance as DIRECT_URL, never the `public` schema real
// data lives in), pushes the current schema into it (no migration history needed for a
// throwaway test DB), then seeds the same data the dev DB uses.

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client } from 'pg';
import { TEST_DATABASE_URL } from '../vitest.config';

const repoRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

export default async function setup() {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS "test" CASCADE');
    await client.query('CREATE SCHEMA "test"');
  } finally {
    await client.end();
  }

  // prisma.config.ts's CLI datasource reads DIRECT_URL — override it here so `db push` targets
  // the test schema above, not the real dev database.
  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL };
  execSync('npx prisma db push', { cwd: repoRoot, env, stdio: 'inherit' });
  execSync('npx tsx server/prisma/seed.ts', {
    cwd: repoRoot,
    env: { ...env, ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'test-password-123' },
    stdio: 'inherit',
  });
}
