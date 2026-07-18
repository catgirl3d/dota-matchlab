import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app';

const testEnv: Env = {
  CLERK_PUBLISHABLE_KEY:
    'pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk',
  CLERK_SECRET_KEY: 'sk_test_example',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
  SUPABASE_URL: 'https://example.supabase.co',
  OPENDOTA_BASE_URL: 'https://api.opendota.com/api',
};

describe('API health routes', () => {
  it('reports a healthy vertical slice', async () => {
    const app = createApp({
      checkSupabase: async () => ({ status: 'ok', latencyMs: 7 }),
    });

    const response = await app.request(
      'https://example.com/api/health',
      undefined,
      testEnv,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      services: {
        worker: 'ok',
        supabase: { status: 'ok', latencyMs: 7 },
      },
    });
  });

  it('reports a degraded service when Supabase is unavailable', async () => {
    const app = createApp({
      checkSupabase: async () => ({
        status: 'error',
        latencyMs: 12,
        statusCode: 401,
      }),
    });

    const response = await app.request(
      'https://example.com/api/health',
      undefined,
      testEnv,
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: 'degraded',
      services: {
        supabase: { status: 'error', statusCode: 401 },
      },
    });
  });

  it('keeps liveness independent from external services', async () => {
    const app = createApp({
      checkSupabase: async () => ({ status: 'error', latencyMs: 0 }),
    });

    const response = await app.request(
      'https://example.com/api/health/live',
      undefined,
      testEnv,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});

describe('protected Dota routes', () => {
  it('rejects anonymous profile resolution before calling OpenDota', async () => {
    const resolveDotaPlayer = vi.fn();
    const app = createApp({ resolveDotaPlayer });

    const response = await app.request(
      'https://example.com/api/dota/players/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamProfile: '76561198115048758' }),
      },
      testEnv,
    );

    expect(response.status).toBe(401);
    expect(resolveDotaPlayer).not.toHaveBeenCalled();
  });
});
