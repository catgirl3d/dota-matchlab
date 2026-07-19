import { describe, expect, it } from 'vitest';
import { fetchArchiveSnapshot } from './archive';

describe('archive read model', () => {
  it('joins visible match links with the tracked player stats and sync state', async () => {
    const client = createFakeSupabaseClient();

    await expect(
      fetchArchiveSnapshot(
        client,
        '00000000-0000-0000-0000-000000000202',
        93_447_624,
      ),
    ).resolves.toMatchObject({
      matches: [
        {
          matchId: 9_000_000_001,
          heroId: 1,
          heroDamage: 30_000,
          won: true,
        },
      ],
      syncState: {
        status: 'partial',
        history_provider: 'stratz',
        backfill_offset: 100,
      },
    });
  });
});

function createFakeSupabaseClient() {
  const responses = {
    tracked_account_matches: {
      data: [{ match_id: 9_000_000_001 }],
      error: null,
    },
    dota_matches: {
      data: [
        {
          match_id: 9_000_000_001,
          start_time: 1_800_000_000,
          duration: 2_400,
          radiant_win: true,
          game_mode: 22,
          lobby_type: 7,
          average_rank: 55,
          radiant_score: 30,
          dire_score: 20,
        },
      ],
      error: null,
    },
    player_match_stats: {
      data: [
        {
          match_id: 9_000_000_001,
          player_slot: 0,
          hero_id: 1,
          hero_variant: null,
          kills: 10,
          deaths: 2,
          assists: 8,
          gold_per_min: 600,
          xp_per_min: 700,
          last_hits: 300,
          denies: 10,
          hero_damage: 30_000,
          tower_damage: 5_000,
          hero_healing: 0,
          level: 30,
          net_worth: 20_000,
          leaver_status: 0,
          party_size: 0,
          lane: 1,
          lane_role: 1,
          is_roaming: false,
        },
      ],
      error: null,
    },
    account_match_sync_state: {
      data: {
        status: 'partial',
        history_provider: 'stratz',
        backfill_offset: 100,
        backfill_complete: false,
        last_attempt_at: '2026-07-19T00:00:00.000Z',
        last_success_at: '2026-07-19T00:00:00.000Z',
        next_retry_at: null,
        consecutive_failures: 0,
        last_error_message: null,
        newest_match_id: 9_000_000_001,
        oldest_match_id: 9_000_000_001,
      },
      error: null,
    },
  } as const;

  const client = {
    from(table: keyof typeof responses) {
      const response = responses[table];
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        range: async () => response,
        in: async () => response,
        maybeSingle: async () => response,
      };
      return builder;
    },
  };

  return client as unknown as DatabaseClient;
}

type DatabaseClient = Parameters<typeof fetchArchiveSnapshot>[0];
