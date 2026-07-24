import { describe, expect, it, vi } from 'vitest';
import { readPublicMatchDetail } from './match-detail-read';

const testEnv: Env = {
  CLERK_PUBLISHABLE_KEY: 'pk_test_example',
  CLERK_SECRET_KEY: 'sk_test_example',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_example',
  SUPABASE_URL: 'https://example.supabase.co',
  STRATZ_API_TOKEN: 'stratz_token_example',
  OPENDOTA_BASE_URL: 'https://api.opendota.com/api',
};

describe('public match-detail read service', () => {
  it('returns a normalized snapshot without leaking archived provider fields', async () => {
    const loadMatchDetailData = vi.fn().mockResolvedValue({
      match: {
        match_id: 9_001,
        start_time: 1_800_000_000,
        duration: 2_400,
        radiant_win: true,
        game_mode: 23,
        lobby_type: 0,
        average_rank: 55,
        radiant_score: 30,
        dire_score: 20,
        source: 'stratz',
        detail_status: 'available',
        detail_fetched_at: '2026-07-23T20:00:00.000Z',
      },
      players: [],
      payloadRows: [{
        provider: 'stratz',
        payload_kind: 'detail',
        payload_section: 'players',
        schema_version: 'stratz.match.detail.v2',
        fetched_at: '2026-07-23T20:00:00.000Z',
        payload: {
          data: {
            match: {
              providerOnly: { token: 'must-not-leak' },
              players: [{
                steamAccountId: 77,
                playerSlot: 0,
                heroId: 1,
                steamAccount: { name: 'Player' },
              }],
            },
          },
        },
      }],
    });

    const detail = await readPublicMatchDetail(testEnv, 9_001, { loadMatchDetailData });

    expect(loadMatchDetailData).toHaveBeenCalledWith(testEnv, 9_001);
    expect(detail).toMatchObject({
      matchId: 9_001,
      radiantScore: 30,
      direScore: 20,
      players: [{ accountId: 77, heroId: 1, name: 'Player' }],
    });
    expect(JSON.stringify(detail)).not.toContain('providerOnly');
    expect(JSON.stringify(detail)).not.toContain('must-not-leak');
  });

  it('returns null when the requested match does not exist', async () => {
    const detail = await readPublicMatchDetail(testEnv, 9_002, {
      loadMatchDetailData: vi.fn().mockResolvedValue({ match: null, players: [], payloadRows: [] }),
    });

    expect(detail).toBeNull();
  });

  it('returns a sparse valid snapshot for an unparsed stub match', async () => {
    const detail = await readPublicMatchDetail(testEnv, 9_003, {
      loadMatchDetailData: vi.fn().mockResolvedValue({
        match: {
          match_id: 9_003,
          start_time: null,
          duration: null,
          radiant_win: null,
          game_mode: null,
          lobby_type: null,
          average_rank: null,
          radiant_score: null,
          dire_score: null,
          source: 'stratz',
          detail_status: 'not_requested',
          detail_fetched_at: null,
        },
        players: [],
        payloadRows: [],
      }),
    });

    expect(detail).toEqual({
      matchId: 9_003,
      startTime: null,
      durationSeconds: null,
      radiantWin: null,
      gameMode: null,
      lobbyType: null,
      averageRank: null,
      radiantScore: 0,
      direScore: 0,
      source: 'stratz',
      detailStatus: 'not_requested',
      detailFetchedAt: null,
      players: [],
      pickBans: [],
      radiantNetworthLeads: [],
      radiantExperienceLeads: [],
      laneOutcomes: [
        { lane: 'Top lane', outcome: 'UNKNOWN' },
        { lane: 'Mid lane', outcome: 'UNKNOWN' },
        { lane: 'Bottom lane', outcome: 'UNKNOWN' },
      ],
      eventCounts: {
        chat: null,
        towers: null,
        runes: null,
        wards: null,
        buildings: null,
        roshan: null,
      },
      chatMessages: [],
      timelineEvents: [],
      availableSections: [],
      rosterStatus: 'incomplete',
    });
  });
});
