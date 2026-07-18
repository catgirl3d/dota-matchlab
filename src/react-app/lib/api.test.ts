import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSystemHealth } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchSystemHealth', () => {
  it('keeps a valid degraded response available to the UI', async () => {
    const payload = {
      status: 'degraded',
      checkedAt: '2026-07-18T20:35:00.000Z',
      services: {
        worker: 'ok',
        supabase: { status: 'error', latencyMs: 8, statusCode: 401 },
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json(payload, { status: 503 })),
    );

    await expect(fetchSystemHealth()).resolves.toEqual(payload);
  });

  it('rejects an invalid API contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ status: 'ok' })),
    );

    await expect(fetchSystemHealth()).rejects.toThrow(
      'Health endpoint returned an invalid response',
    );
  });
});
