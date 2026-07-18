import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveSteamProfile } from './dota-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Dota API client', () => {
  it('sends the Clerk token and Steam profile input to the Worker', async () => {
    const profile = {
      steamId64: '76561198115048758',
      accountId: 154_783_030,
      personaName: 'Analyst',
      avatarUrl: null,
      rankTier: 54,
    };
    const fetcher = vi.fn().mockResolvedValue(Response.json(profile));
    vi.stubGlobal('fetch', fetcher);

    await expect(
      resolveSteamProfile('clerk-token', '76561198115048758'),
    ).resolves.toEqual(profile);
    expect(fetcher).toHaveBeenCalledWith(
      '/api/dota/players/resolve',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer clerk-token',
        }),
        body: JSON.stringify({ steamProfile: '76561198115048758' }),
      }),
    );
  });

  it('surfaces the safe Worker error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ error: 'Введите корректный SteamID64' }, { status: 400 }),
      ),
    );

    await expect(resolveSteamProfile('token', 'bad')).rejects.toThrow(
      'Введите корректный SteamID64',
    );
  });
});
