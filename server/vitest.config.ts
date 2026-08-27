import { defineConfig } from 'vitest/config';

try {
  process.loadEnvFile('.env');
} catch {
  // .env not present (e.g. CI with env vars already set) — fine, the check below throws a
  // clear error if DIRECT_URL is genuinely missing.
}

// Isolated from the real dev/prod data: same Supabase Postgres instance as DIRECT_URL, but a
// separate `test` schema (not `public`, where real data lives) — see globalSetup.ts, which
// drops and recreates this schema before every run for a clean slate.
function buildTestDatabaseUrl(): string {
  const direct = process.env.DIRECT_URL;
  if (!direct) {
    throw new Error('DIRECT_URL is not set — check .env (needed to derive the isolated test database URL)');
  }
  const url = new URL(direct);
  url.searchParams.set('schema', 'test');
  return url.toString();
}

export const TEST_DATABASE_URL = buildTestDatabaseUrl();

export default defineConfig({
  test: {
    include: ['server/**/__tests__/*.test.ts'],
    globalSetup: ['server/__tests__/globalSetup.ts'],
    fileParallelism: false, // shared Postgres test schema — order-mutating tests must not interleave
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
    },
  },
});
