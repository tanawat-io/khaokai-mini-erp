import { defineConfig, env } from 'prisma/config';

try {
  process.loadEnvFile('.env');
} catch {
  // .env not present (e.g. CI with env vars already set) — fine, defineConfig below will
  // throw a clear error if DATABASE_URL is genuinely missing.
}

export default defineConfig({
  schema: 'server/prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    seed: 'tsx --env-file=.env server/prisma/seed.ts',
  },
});
