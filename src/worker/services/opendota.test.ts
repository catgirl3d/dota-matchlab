import { describe, expect, it, vi } from 'vitest';
import {
  loadPlayerMatchesPage,
  resolveDotaPlayer,
} from './opendota';

describe('OpenDota adapter', () => {
  it('normalizes a public player profile', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        profile: {
          personaname: 'Analyst',
          avatarfull: 'https://cdn.example/avatar.jpg',
        },
        rank_tier: 54,
      }),
    );

    await expect(
      resolveDotaPlayer(
        'https://api.opendota.com/api',
        '76561198115048758',
        fetcher,
      ),
    ).resolves.toEqual({
      steamId64: '76561198115048758',
      accountId: 154_783_030,
      personaName: 'Analyst',
      avatarUrl: 'https://cdn.example/avatar.jpg',
      rankTier: 54,
    });
  });

  it('loads and normalizes an extended history page with explicit projections', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json([
        {
          match_id: 8_889_779_250,
          player_slot: 132,
          radiant_win: true,
          hero_id: 129,
          start_time: 1_783_689_522,
          duration: 2_273,
          game_mode: 22,
          lobby_type: 7,
          average_rank: null,
          kills: 4,
          deaths: 2,
          assists: 18,
          gold_per_min: 352,
          xp_per_min: 555,
          last_hits: 82,
          denies: 9,
          hero_damage: 31_404,
          tower_damage: 4_200,
          hero_healing: 800,
          party_size: 0,
          lane_role: 4,
          is_roaming: false,
          provider_only_field: { preserved: true },
        },
        {
          match_id: 8_889_779_249,
          player_slot: 3,
          radiant_win: true,
          hero_id: 5,
        },
        { match_id: 'not-a-number' },
      ]),
    );

    await expect(
      loadPlayerMatchesPage(
        'https://api.opendota.com/api',
        154_783_030,
        100,
        100,
        fetcher,
      ),
    ).resolves.toMatchObject({
      offset: 100,
      nextOffset: 103,
      hasMore: false,
      matches: [
        {
          matchId: '8889779250',
          radiantWin: true,
          playerSlot: 132,
          heroDamage: 31_404,
          averageRank: null,
          laneRole: 4,
          partySize: 0,
          rawPayload: expect.objectContaining({
            provider_only_field: { preserved: true },
          }),
          rawPayloadSchemaVersion: 'opendota.player-matches.v1',
        },
        {
          matchId: '8889779249',
          playerSlot: 3,
        },
      ],
    });

    const requestUrl = String(fetcher.mock.calls[0]?.[0]);
    expect(requestUrl).toContain('limit=100');
    expect(requestUrl).toContain('offset=100');
    expect(requestUrl).toContain('project=match_id');
    expect(requestUrl).toContain('project=hero_damage');
  });

  it('rejects a response whose streamed body exceeds the provider limit', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(1_000_001));
          controller.close();
        },
      })),
    );

    await expect(
      resolveDotaPlayer('https://api.opendota.com/api', '76561198115048758', fetcher),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: 'OPENDOTA_RESPONSE_TOO_LARGE',
    });
  });

});
