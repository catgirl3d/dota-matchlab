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

describe('public match-detail route', () => {
  it('returns the Worker-normalized detail without requiring a session', async () => {
    const readPublicMatchDetail = vi.fn().mockResolvedValue({ matchId: 9_001, players: [] });
    const app = createApp({ readPublicMatchDetail });

    const response = await app.request('https://example.com/api/dota/matches/9001', undefined, testEnv);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=300, s-maxage=86400, stale-while-revalidate=300',
    );
    await expect(response.json()).resolves.toEqual({ matchId: 9_001, players: [] });
    expect(readPublicMatchDetail).toHaveBeenCalledWith(testEnv, 9_001);
  });

  it('rejects malformed IDs before reading archived detail', async () => {
    const readPublicMatchDetail = vi.fn();
    const app = createApp({ readPublicMatchDetail });

    const response = await app.request('https://example.com/api/dota/matches/not-a-number', undefined, testEnv);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid match ID', code: 'INVALID_MATCH_ID' });
    expect(readPublicMatchDetail).not.toHaveBeenCalled();
  });

  it('logs a database failure while keeping the public 500 response sanitized', async () => {
    const databaseError = new Error('database connection refused');
    const readPublicMatchDetail = vi.fn().mockRejectedValue(databaseError);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = createApp({ readPublicMatchDetail });

    const response = await app.request('https://example.com/api/dota/matches/9001', undefined, testEnv);

    expect(response.status).toBe(500);
    expect(response.headers.get('Cache-Control')).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('database connection refused'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('/api/dota/matches/9001'));
    log.mockRestore();
  });
});

describe('protected API routes', () => {
  it('rejects anonymous session access through the shared auth middleware', async () => {
    const app = createApp();

    const response = await app.request('https://example.com/api/session', undefined, testEnv);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  });

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
  it('rejects an empty steam profile before provider work', async () => {
    const getAuth = vi.fn().mockReturnValue({ userId: 'user-a' });
    const resolveSteamProfileInput = vi.fn();
    const resolveDotaPlayer = vi.fn();
    const app = createApp({ getAuth, resolveSteamProfileInput, resolveDotaPlayer });

    const response = await app.request(
      'https://example.com/api/dota/players/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamProfile: '' }),
      },
      testEnv,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Steam profile is required',
      code: 'STEAM_PROFILE_REQUIRED',
    });
    expect(resolveSteamProfileInput).not.toHaveBeenCalled();
    expect(resolveDotaPlayer).not.toHaveBeenCalled();
  });

});
