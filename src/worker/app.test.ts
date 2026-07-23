import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app';

const testEnv: Env = {
  CLERK_PUBLISHABLE_KEY:
    'pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk',
  CLERK_SECRET_KEY: 'sk_test_example',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_example',
  SUPABASE_URL: 'https://example.supabase.co',
  STRATZ_API_TOKEN: 'stratz_token_example',
  OPENDOTA_BASE_URL: 'https://api.opendota.com/api',
};

describe('API health routes', () => {
  it('does not retain the aggregate health endpoint', async () => {
    const app = createApp();

    const response = await app.request('https://example.com/api/health', undefined, testEnv);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not found', code: 'NOT_FOUND' });
  });

  it('keeps liveness independent from external services', async () => {
    const app = createApp();

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
  it('does not expose a hero constants endpoint', async () => {
    const app = createApp();

    const response = await app.request(
      'https://example.com/api/dota/constants/heroes',
      undefined,
      testEnv,
    );

    expect(response.status).toBe(404);
  });

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

  it('rejects anonymous archive sync before calling the archive service', async () => {
    const syncTrackedAccount = vi.fn();
    const app = createApp({ syncTrackedAccount });

    const response = await app.request(
      'https://example.com/api/dota/tracked-accounts/00000000-0000-0000-0000-000000000202/matches/sync',
      { method: 'POST' },
      testEnv,
    );

    expect(response.status).toBe(401);
    expect(syncTrackedAccount).not.toHaveBeenCalled();
  });

  it('does not expose batch detail sync and keeps the selected-match route', async () => {
    const app = createApp();
    const batchResponse = await app.request(
      'https://example.com/api/dota/tracked-accounts/00000000-0000-0000-0000-000000000202/matches/details/sync',
      { method: 'POST' },
      testEnv,
    );
    const specificResponse = await app.request(
      'https://example.com/api/dota/tracked-accounts/00000000-0000-0000-0000-000000000202/matches/9001/details/sync',
      { method: 'POST' },
      testEnv,
    );

    expect(batchResponse.status).toBe(404);
    expect(specificResponse.status).toBe(401);
  });

  it('rejects anonymous public match import before provider work', async () => {
    const importPublicMatchDetail = vi.fn();
    const app = createApp({ importPublicMatchDetail });
    const response = await app.request('https://example.com/api/dota/matches/8749050591/import', { method: 'POST' }, testEnv);
    expect(response.status).toBe(401);
    expect(importPublicMatchDetail).not.toHaveBeenCalled();
  });

  it('validates public match IDs before import work', async () => {
    const importPublicMatchDetail = vi.fn();
    const app = createApp({ importPublicMatchDetail });
    const response = await app.request('https://example.com/api/dota/matches/not-a-number/import', { method: 'POST' }, testEnv);
    expect(response.status).toBe(401); // Authentication is deliberately checked before ID parsing.
    expect(importPublicMatchDetail).not.toHaveBeenCalled();
  });
});
