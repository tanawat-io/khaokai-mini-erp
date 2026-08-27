import { defineConfig, env } from 'prisma/config';

try {
  process.loadEnvFile('.env');
} catch {
  // .env not present (e.g. CI with env vars already set) — fine, defineConfig below will
  // throw a clear error if DIRECT_URL is genuinely missing.
}

// CLI-only connection (migrate/db push/introspect) — deliberately DIRECT_URL, not DATABASE_URL:
// Supabase's transaction-mode pooler (DATABASE_URL, used by the app's own PrismaPg adapter in
// server/prisma/client.ts for serverless runtime connections) doesn't support the advisory locks
// DDL that schema migrations need. Prisma 7 removed schema.prisma's `url`/`directUrl` fields
// (see prisma.config.ts docs: https://pris.ly/d/config-datasource) — this is the one remaining
// place a connection string is configured for CLI commands.
export default defineConfig({
  schema: 'server/prisma/schema.prisma',
  datasource: {
    url: env('DIRECT_URL'),
  },
  migrations: {
    seed: 'tsx --env-file=.env server/prisma/seed.ts',
  },
});
