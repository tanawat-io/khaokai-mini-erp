import { describe, it, expect } from 'vitest';
import { prisma } from '../prisma/client';

describe('infra', () => {
  it('enables SQLite foreign keys', async () => {
    const r = (await (prisma as any).$queryRawUnsafe('PRAGMA foreign_keys')) as Array<{ foreign_keys: number | bigint }>;
    const val = Number(r[0]?.foreign_keys ?? 0);
    expect(val).toBe(1);
  });

  it('has no foreign-key violations in current data', async () => {
    const violations = (await (prisma as any).$queryRawUnsafe('PRAGMA foreign_key_check')) as unknown[];
    expect(violations).toEqual([]);
  });
});
