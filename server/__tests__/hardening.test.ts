import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../index';
import { prisma } from '../prisma/client';

let baseUrl: string;
let srv: ReturnType<typeof app.listen>;

// Spin up the real Express app on an ephemeral port for HTTP-level tests.
// Uses the same middleware stack as production (json parser, cookie, auth, router, 404, error handler).
beforeAll(async () => {
  await new Promise<void>((resolve) => {
    srv = app.listen(0, () => resolve());
  });
  const addr = srv.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => srv.close((e) => (e ? reject(e) : resolve())));
});

async function loginCookie(): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'test-password-123' }),
  });
  const cookie = res.headers.get('set-cookie') ?? '';
  // return only the session cookie part
  const match = cookie.match(/khaokai_session=[^;]+/);
  return match ? match[0] : '';
}

describe('hardening — malformed JSON', () => {
  it('returns JSON error envelope, not HTML, for malformed JSON', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not-json ',
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    // never leaks stack
    expect(JSON.stringify(body)).not.toMatch(/SyntaxError|at\s+.*\(.*\)/);
  });
});

describe('hardening — unexpected error', () => {
  it('returns JSON error envelope for unexpected server error, no stack leak', async () => {
    const res = await fetch(`${baseUrl}/api/__test-throw`);
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error).toBeDefined();
    expect(body.error.message).toBe('เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์');
    expect(JSON.stringify(body)).not.toMatch(/test boom|at\s+/);
  });
});

describe('hardening — 404 handler', () => {
  it('authenticated unknown /api route returns JSON NOT_FOUND', async () => {
    const cookie = await loginCookie();
    const res = await fetch(`${baseUrl}/api/does-not-exist`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('ไม่พบ API endpoint ที่ร้องขอ');
  });

  it('unauthenticated unknown /api route returns 401, not 404', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('hardening — cookie', () => {
  it('development login Set-Cookie is httpOnly SameSite=Lax without Secure', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'test-password-123' }),
    });
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    // In test/development secure must not be set
    expect(setCookie).not.toMatch(/Secure/i);
  });
});

describe('hardening — graceful shutdown export', () => {
  it('exports gracefulShutdown without throwing when no server', async () => {
    const mod = await import('../index');
    expect(typeof mod.gracefulShutdown).toBe('function');
    expect(typeof mod.resetShutdownForTest).toBe('function');
    // do not actually call gracefulShutdown (would exit), just verify shape
  });
});
