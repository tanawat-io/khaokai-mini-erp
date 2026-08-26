import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // The backend suite (server/**/__tests__) has its own config/DB setup — see
    // server/vitest.config.ts and package.json's "test:server" script — and must not be picked
    // up by the default vitest.config.ts's globs here, or `npm test` would fail without
    // DATABASE_URL set.
    exclude: ['**/node_modules/**', 'server/**'],
  },
  server: {
    port: 5173,
    proxy: {
      // Same-origin from the browser's perspective, so cookies flow without extra CORS setup —
      // see server/index.ts (port 3001) and src/repository/apiRepository.ts.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
