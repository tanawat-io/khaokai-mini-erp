import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set — check .env");
}

// @prisma/adapter-pg wraps the raw `pg` driver and does not parse a `?schema=` query param out
// of the connection string the way Prisma's CLI does — without passing it explicitly, every
// query silently falls back to the connection's default `public` search_path regardless of the
// URL (this is what the isolated Postgres test schema — see server/vitest.config.ts — relies on).
const schema = new URL(connectionString).searchParams.get("schema") ?? undefined;

const adapter = new PrismaPg(
  { connectionString },
  { schema },
);

export const prisma = new PrismaClient({
  adapter,
});