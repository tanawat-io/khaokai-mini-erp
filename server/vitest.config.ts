import { defineConfig } from 'vitest/config';

export const TEST_DATABASE_URL = 'file:./server/prisma/test.db';

export default defineConfig({
  test: {
    include: ['server/**/__tests__/*.test.ts'],
    globalSetup: ['server/__tests__/globalSetup.ts'],
    fileParallelism: false, // shared SQLite test DB — order-mutating tests must not interleave
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
    },
  },
});
