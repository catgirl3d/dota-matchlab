import { describe, expect, it, vi } from 'vitest';
import {
  loadStratzPlayerMatchesBatch,
  loadStratzPlayerMatchesPage,
} from './stratz';

describe('STRATZ match provider', () => {
  it('loads and normalizes the player row from a GraphQL match page', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        data: {
          player: {
            steamAccountId: 93_447_624,
            matches: [
              {
                id: 9_000_000_001,
                startDateTime: 1_800_000_000,
                durationSeconds: 2_100,
                didRadiantWin: true,
                gameMode: 'TURBO',
                lobbyType: 'UNRANKED',
                regionId: 12,
                leagueId: 345,
                gameVersionId: '7.39e',
                players: [
                  {
                    steamAccountId: 93_447_624,
                    heroId: 1,
                    isRadiant: true,
                    playerSlot: 0,
                    kills: 12,
                    deaths: 2,
                    assists: 9,
                    networth: 21_000,
                    level: 30,
                    imp: 3.4,
                    leaverStatus: 'NONE',
                    numLastHits: 259,
                    numDenies: 7,
                    goldPerMinute: 1_841,
                    experiencePerMinute: 2_802,
                    heroDamage: 79_765,
                    towerDamage: 12_061,
                    heroHealing: 125,
                    partyId: null,
                    lane: 'OFF_LANE',
                    position: 'POSITION_4',
                    variant: 0,
                  },
                ],
              },
            ],
          },
        },
      }),
    );

    await expect(
      loadStratzPlayerMatchesPage('token', 93_447_624, 100, 100, fetcher),
    ).resolves.toMatchObject({
      accountId: 93_447_624,
      offset: 100,
      nextOffset: 101,
      hasMore: false,
      matches: [
        expect.objectContaining({
          matchId: '9000000001',
          gameMode: 23,
          lobbyType: 0,
          version: null,
          playerSlot: 0,
          heroId: 1,
          kills: 12,
          deaths: 2,
          assists: 9,
          netWorth: 21_000,
          goldPerMinute: 1_841,
          xpPerMinute: 2_802,
          lastHits: 259,
          denies: 7,
          heroDamage: 79_765,
          towerDamage: 12_061,
          heroHealing: 125,
          leaverStatus: 0,
          partySize: 0,
          lane: 3,
          laneRole: 4,
          isRoaming: null,
          heroVariant: 0,
        }),
      ],
    });

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.stratz.com/graphql',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'User-Agent': 'STRATZ_API',
        }),
         body: expect.stringMatching(/PlayerMatchesRequestType.*goldPerMinute/s),
      }),
    );
  });

  it('maps GraphQL errors and upstream limits to provider errors', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json(
        { errors: [{ message: 'Rate limit exceeded' }] },
        { status: 200 },
      ),
    );

    await expect(
      loadStratzPlayerMatchesPage('token', 93_447_624, 0, 100, fetcher),
    ).rejects.toMatchObject({
      name: 'StratzError',
      statusCode: 502,
      message: 'Rate limit exceeded',
    });
  });

  it('combines up to five provider pages into one atomic sync batch', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(createStratzPageResponse(0, 100))
      .mockResolvedValueOnce(createStratzPageResponse(100, 100))
      .mockResolvedValueOnce(createStratzPageResponse(200, 50));

    await expect(
      loadStratzPlayerMatchesBatch('token', 93_447_624, 0, fetcher),
    ).resolves.toMatchObject({
      offset: 0,
      limit: 500,
      nextOffset: 250,
      hasMore: false,
      matches: expect.arrayContaining([
        expect.objectContaining({ matchId: '9000000000' }),
        expect.objectContaining({ matchId: '9000000249' }),
      ]),
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

function createStratzPageResponse(offset: number, count: number): Response {
  return Response.json({
    data: {
      player: {
        steamAccountId: 93_447_624,
        matches: Array.from({ length: count }, (_, index) => ({
          id: 9_000_000_000 + offset + index,
          startDateTime: 1_800_000_000 - offset - index,
          durationSeconds: 2_100,
          didRadiantWin: true,
          gameMode: 'TURBO',
          lobbyType: 'UNRANKED',
          players: [
            {
              steamAccountId: 93_447_624,
              heroId: 1,
              isRadiant: true,
              playerSlot: 0,
              kills: 10,
              deaths: 2,
              assists: 8,
               networth: 20_000,
               level: 30,
               imp: 5,
              leaverStatus: 'NONE',
              numLastHits: 100,
              numDenies: 4,
              goldPerMinute: 600,
              experiencePerMinute: 700,
              heroDamage: 20_000,
              towerDamage: 3_000,
              heroHealing: 0,
              partyId: null,
              lane: 'SAFE_LANE',
              position: 'POSITION_1',
              variant: 0,
            },
          ],
        })),
      },
    },
  });
}
