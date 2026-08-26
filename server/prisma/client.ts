// Single PrismaClient instance for the backend process. Prisma 7 requires an explicit driver
// adapter (no more implicit `datasource.url` connection) — better-sqlite3 is the officially
// maintained adapter for SQLite and matches this phase's chosen stack (SQLite + Prisma).

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set — check .env (see .env.example)');
}

const adapter = new PrismaBetterSqlite3({ url: databaseUrl.replace(/^file:/, '') });

export const prisma = new PrismaClient({ adapter });
