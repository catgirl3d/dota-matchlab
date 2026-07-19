import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchHeroNames,
  resolveSteamProfile,
  syncAllTrackedAccount,
  syncTrackedMatchDetail,
  syncTrackedAccount,
} from './dota-api';

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

  it('starts a tracked-account archive sync with the Clerk token', async () => {
    const result = {
      trackedAccountId: '00000000-0000-0000-0000-000000000202',
      accountId: 154_783_030,
      fetchedMatches: 100,
      archivedMatches: 100,
      status: 'partial',
      backfillComplete: false,
      nextOffset: 100,
    } as const;
    const fetcher = vi.fn().mockResolvedValue(Response.json(result));
    vi.stubGlobal('fetch', fetcher);

    await expect(
      syncTrackedAccount('clerk-token', result.trackedAccountId),
    ).resolves.toEqual(result);
    expect(fetcher).toHaveBeenCalledWith(
      `/api/dota/tracked-accounts/${result.trackedAccountId}/matches/sync`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer clerk-token',
        }),
      }),
    );
  });

  it('loads hero names through the cached constants route', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({ heroes: { '1': 'Anti-Mage', '2': 'Axe' } }),
    );
    vi.stubGlobal('fetch', fetcher);

    await expect(fetchHeroNames('clerk-token')).resolves.toEqual({
      1: 'Anti-Mage',
      2: 'Axe',
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/dota/constants/heroes',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer clerk-token' }),
      }),
    );
  });

  it('syncs all archive batches until the provider reaches ready', async () => {
    const trackedAccountId = '00000000-0000-0000-0000-000000000202';
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          trackedAccountId,
          accountId: 154_783_030,
          fetchedMatches: 500,
          archivedMatches: 500,
          status: 'partial',
          backfillComplete: false,
          nextOffset: 500,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          trackedAccountId,
          accountId: 154_783_030,
          fetchedMatches: 500,
          archivedMatches: 500,
          status: 'partial',
          backfillComplete: false,
          nextOffset: 1_000,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          trackedAccountId,
          accountId: 154_783_030,
          fetchedMatches: 73,
          archivedMatches: 73,
          status: 'ready',
          backfillComplete: true,
          nextOffset: 0,
        }),
      )
    vi.stubGlobal('fetch', fetcher);
    const progress = vi.fn();

    await expect(
      syncAllTrackedAccount('clerk-token', trackedAccountId, {
        delayMs: 0,
        onProgress: progress,
      }),
    ).resolves.toMatchObject({ status: 'ready', fetchedMatches: 73 });

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher).not.toHaveBeenCalledWith(
      `/api/dota/tracked-accounts/${trackedAccountId}/matches/details/sync`,
      expect.anything(),
    );
    expect(progress).toHaveBeenLastCalledWith({
      completedBatches: 3,
      fetchedMatches: 1_073,
      nextOffset: 0,
    });
  });

  it('requests detail parsing for one selected match', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        accountId: 154_783_030,
        processedMatches: 1,
        availableMatches: 1,
        failedMatches: 0,
        backfillComplete: false,
      }),
    );
    vi.stubGlobal('fetch', fetcher);

    await syncTrackedMatchDetail('clerk-token', 'tracked-id', 8_749_050_591);

    expect(fetcher).toHaveBeenCalledWith(
      '/api/dota/tracked-accounts/tracked-id/matches/8749050591/details/sync',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer clerk-token' }),
      }),
    );
  });
});
