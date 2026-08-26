/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setUnauthenticatedHandler } from '../apiRepository';

describe('apiRepository — 401 handling', () => {
  let handler: ReturnType<typeof vi.fn>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    handler = vi.fn();
    setUnauthenticatedHandler(handler as unknown as () => void);
  });
  afterEach(() => {
    setUnauthenticatedHandler(null);
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('catalogCall triggers handler on 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'UNAUTHENTICATED', message: 'กรุณาเข้าสู่ระบบ' } }),
      headers: { get: () => 'application/json' },
    } as unknown as Response);

    const { apiRepository } = await import('../apiRepository');
    const result = await apiRepository.createIngredient({ name: 'x', category: 'c', baseUnit: 'g', trackingType: 'raw_by_weight' } as any);
    expect(result.ok).toBe(false);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('orderCall triggers handler on UNAUTHENTICATED code', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: { code: 'UNAUTHENTICATED', message: 'กรุณาเข้าสู่ระบบ' } }),
      headers: { get: () => 'application/json' },
    } as unknown as Response);

    const { apiRepository } = await import('../apiRepository');
    const result = await apiRepository.createOrder('2026-01-01', { lines: [] } as any);
    // 409 with UNAUTHENTICATED code must still trigger handler (defense in depth)
    expect(handler).toHaveBeenCalledOnce();
    expect(result.ok).toBe(false);
  });

  it('getSnapshot triggers handler and throws UNAUTHENTICATED on 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'UNAUTHENTICATED', message: 'กรุณาเข้าสู่ระบบ' } }),
      headers: { get: () => 'application/json' },
    } as unknown as Response);

    const { apiRepository } = await import('../apiRepository');
    await expect(apiRepository.getSnapshot()).rejects.toThrow('UNAUTHENTICATED');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not trigger handler on normal validation error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 'VALIDATION_ERROR', message: 'bad', details: { errors: ['bad'] } } }),
      headers: { get: () => 'application/json' },
    } as unknown as Response);

    const { apiRepository } = await import('../apiRepository');
    const result = await apiRepository.createIngredient({ name: '', category: '', baseUnit: '', trackingType: 'raw_by_weight' } as any);
    expect(result.ok).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });
});
