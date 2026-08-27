import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const target = path.resolve('server/prisma/generated/client.ts');

let src;
try {
  src = readFileSync(target, 'utf8');
} catch {
  // No generated client yet (e.g. clean checkout before `prisma generate`) — nothing to patch.
  process.exit(0);
}

// Already patched?
if (src.includes('__prismaPatchApplied')) {
  process.exit(0);
}

// Replace the ESM-only __dirname assignment with a CJS-safe version.
// When esbuild bundles the Netlify Function as CommonJS, `import.meta.url` is undefined
// and `fileURLToPath(undefined)` throws ERR_INVALID_ARG_TYPE before the handler runs (502).
// The patched version falls back to CJS `__dirname` or `process.cwd()`.

const before = `import { fileURLToPath } from 'node:url'
globalThis['__dirname'] = path.dirname(fileURLToPath(import.meta.url))`;

const after = `import { fileURLToPath } from 'node:url'
// __prismaPatchApplied — CJS-safe for Netlify esbuild (import.meta.url is undefined when bundled as CommonJS)
try {
  globalThis['__dirname'] = path.dirname(fileURLToPath(import.meta.url))
} catch {
  globalThis['__dirname'] = typeof __dirname !== 'undefined' ? __dirname : process.cwd()
}`;

if (!src.includes(before)) {
  console.warn('[patch-prisma-client] expected pattern not found, skipping');
  process.exit(0);
}

writeFileSync(target, src.replace(before, after), 'utf8');
console.log('[patch-prisma-client] patched server/prisma/generated/client.ts for Netlify CJS bundling');
