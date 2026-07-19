import { describe, expect, it } from 'vitest';
import type { Json } from '../../shared/database.types';
import { buildMatchDetailSnapshot } from './match-detail';

describe('match detail read model', () => {
  it('builds a complete scoreboard and match summary from STRATZ history raw data', () => {
    const snapshot = buildMatchDetailSnapshot(
      {
        match_id: 9_000_000_001,
        start_time: 1_800_000_000,
        duration: 2_531,
        radiant_win: true,
        game_mode: 23,
        lobby_type: 0,
        average_rank: 55,
        radiant_score: null,
        dire_score: null,
        source: 'stratz',
        detail_status: 'not_requested',
        detail_fetched_at: null,
      },
      [],
      [
        {
          payload_kind: 'history',
          payload_section: 'match',
          fetched_at: '2026-07-19T00:00:00.000Z',
          payload: {
            id: 9_000_000_001,
            radiantKills: [2, 3],
            direKills: [1, 1],
            radiantNetworthLeads: [0, 500, 1_200],
            radiantExperienceLeads: [0, 250, 700],
            topLaneOutcome: 'RADIANT_VICTORY',
            midLaneOutcome: 'DIRE_VICTORY',
            bottomLaneOutcome: 'TIE',
            pickBans: [{ heroId: 1, isPick: true, isRadiant: true, order: 0 }],
            players: [
              {
                steamAccountId: 111,
                playerSlot: 0,
                isRadiant: true,
                heroId: 1,
                kills: 3,
                deaths: 1,
                assists: 8,
                goldPerMinute: 700,
                experiencePerMinute: 800,
                networth: 20_000,
                item0Id: 50,
                item1Id: 63,
                neutral0Id: 287,
                role: 'CORE',
              },
              {
                steamAccountId: 222,
                playerSlot: 128,
                isRadiant: false,
                heroId: 2,
                kills: 2,
                deaths: 3,
                assists: 4,
                goldPerMinute: 500,
                experiencePerMinute: 600,
                networth: 15_000,
              },
            ],
          },
        },
      ],
    );

    expect(snapshot).toMatchObject({
      radiantScore: 5,
      direScore: 2,
      detailStatus: 'not_requested',
      radiantNetworthLeads: [0, 500, 1_200],
      players: [
        expect.objectContaining({
          accountId: 111,
          isRadiant: true,
          heroId: 1,
          goldPerMinute: 700,
          itemIds: [50, 63],
          neutralItemId: 287,
        }),
        expect.objectContaining({ accountId: 222, isRadiant: false, heroId: 2 }),
      ],
    });
    expect(snapshot.pickBans).toEqual([
      { heroId: 1, isPick: true, isRadiant: true, order: 0 },
    ]);
  });

  it('prefers detail player sections and exposes timeline event counts', () => {
    const snapshot = buildMatchDetailSnapshot(
      {
        match_id: 9_000_000_002,
        start_time: null,
        duration: null,
        radiant_win: false,
        game_mode: null,
        lobby_type: null,
        average_rank: null,
        radiant_score: null,
        dire_score: null,
        source: 'stratz',
        detail_status: 'available',
        detail_fetched_at: '2026-07-19T00:00:00.000Z',
      },
      [],
      [
        {
          payload_kind: 'detail',
          payload_section: 'players',
          fetched_at: '2026-07-19T00:00:00.000Z',
          payload: {
            data: {
              match: {
                players: [
                  {
                    matchId: 9_000_000_002,
                    steamAccountId: 333,
                    playerSlot: 0,
                    heroId: 3,
                    abilities: [{ abilityId: 5001 }],
                  },
                ],
              },
            },
          },
        },
        {
          payload_kind: 'detail',
          payload_section: 'player_stats',
          fetched_at: '2026-07-19T00:00:00.000Z',
          payload: {
            data: {
              match: {
                players: [
                  {
                    stats: {
                      steamAccountId: 333,
                      goldPerMinute: [100, 250],
                      experiencePerMinute: [120, 300],
                      networthPerMinute: [600, 1_200],
                      killEvents: [{ time: 120 }],
                      wards: [{ time: 90 }],
                      itemPurchases: [{ time: 120, itemId: 42 }],
                      allTalks: [{ time: 130, message: 'gg' }],
                      chatWheels: [{ time: 140, chatWheelId: 71 }],
                    },
                  },
                ],
              },
            },
          },
        },
        {
          payload_kind: 'detail',
          payload_section: 'match_playback',
          fetched_at: '2026-07-19T00:00:00.000Z',
          payload: {
            data: {
              match: {
                playbackData: {
                  runeEvents: [{ time: 60 }],
                  wardEvents: [{ time: 90 }, { time: 100 }],
                },
              },
            },
          },
        },
      ],
    );

    expect(snapshot.players[0]).toMatchObject({
      abilityBuild: [
        { abilityId: 5001, time: 0, level: 0, name: null, isTalent: false },
      ],
      purchaseEvents: [{ time: 120, itemId: 42 }],
      minuteSeries: {
        gold: [100, 250],
        experience: [120, 300],
        netWorth: [600, 1_200],
      },
      detailEvents: { kills: 1, wards: 1 },
    });
    expect(snapshot.eventCounts).toMatchObject({
      runes: 1,
      wards: 2,
      buildings: null,
      roshan: null,
    });
    expect(snapshot.chatMessages).toEqual([
      expect.objectContaining({ type: 'text', time: 130, accountId: 333, message: 'gg' }),
      expect.objectContaining({ type: 'wheel', time: 140, accountId: 333, chatWheelId: 71 }),
    ]);
    expect(snapshot.availableSections).toEqual([
      'match_playback',
      'player_stats',
      'players',
    ]);
  });

  it('prefers player playback timelines and sorts equal-time events deterministically', () => {
    const snapshot = buildMatchDetailSnapshot(
      {
        match_id: 9_000_000_003, start_time: null, duration: null, radiant_win: null,
        game_mode: null, lobby_type: null, average_rank: null, radiant_score: null,
        dire_score: null, source: 'stratz', detail_status: 'available', detail_fetched_at: null,
      },
      [],
      [
        {
          payload_kind: 'detail', payload_section: 'players', fetched_at: '2026-07-19T00:00:00.000Z',
          payload: { data: { match: { players: [{ steamAccountId: 444, playerSlot: 0, heroId: 4, abilities: [{ abilityId: 9, time: 90, level: 3 }] }] } } },
        },
        {
          payload_kind: 'detail', payload_section: 'player_stats', fetched_at: '2026-07-19T00:00:00.000Z',
          payload: { data: { match: { players: [{ stats: { steamAccountId: 444, itemPurchases: [{ time: 40, itemId: 99 }] } }] } } },
        },
        {
          payload_kind: 'detail', payload_section: 'player_playback', fetched_at: '2026-07-19T00:00:00.000Z',
          payload: { data: { match: { players: [{ steamAccountId: 444, playbackData: {
            abilityLearnEvents: [{ time: 30, abilityId: 8, levelObtained: 2 }, { time: 30, abilityId: 7, levelObtained: 1 }],
            purchaseEvents: [{ time: 20, itemId: 50 }, { time: 20, itemId: 29 }],
          } }] } } },
        },
      ],
    );

    expect(snapshot.players[0].abilityBuild).toEqual([
      { abilityId: 7, time: 30, level: 1, name: null, isTalent: false },
      { abilityId: 8, time: 30, level: 2, name: null, isTalent: false },
    ]);
    expect(snapshot.players[0].purchaseEvents).toEqual([
      { time: 20, itemId: 29 }, { time: 20, itemId: 50 },
    ]);
  });

  it('enriches playback-only ability events from same-account outer player abilities', () => {
    const snapshot = buildMatchDetailSnapshot(
      baseMatch(9_000_000_009),
      [],
      [
        {
          payload_kind: 'history', payload_section: 'match', fetched_at: '2026-07-19T00:00:00.000Z',
          payload: { players: [{ steamAccountId: 909, playerSlot: 0, heroId: 35 }] },
        },
        detailPayload('player_playback', { players: [{
          steamAccountId: 909,
          abilities: [{ abilityId: 5_154, abilityType: { name: 'sniper_shrapnel' } }],
          playbackData: { abilityLearnEvents: [{ time: 108, abilityId: 5_154, levelObtained: 2 }] },
        }] }),
      ],
    );

    expect(snapshot.players[0].abilityBuild).toEqual([
      { abilityId: 5_154, time: 108, level: 2, name: 'sniper_shrapnel', isTalent: false },
    ]);
  });

  it('uses players and stats fallbacks when player playback is absent', () => {
    const snapshot = buildMatchDetailSnapshot(
      {
        match_id: 9_000_000_004, start_time: null, duration: null, radiant_win: null,
        game_mode: null, lobby_type: null, average_rank: null, radiant_score: null,
        dire_score: null, source: 'stratz', detail_status: 'available', detail_fetched_at: null,
      },
      [],
      [
        { payload_kind: 'detail', payload_section: 'players', fetched_at: '2026-07-19T00:00:00.000Z', payload: { data: { match: { players: [{ steamAccountId: 555, playerSlot: 0, abilities: [{ abilityId: 3, time: 20, level: 2 }, { abilityId: 2, time: 10, level: 1 }] }] } } } },
        { payload_kind: 'detail', payload_section: 'player_stats', fetched_at: '2026-07-19T00:00:00.000Z', payload: { data: { match: { players: [{ stats: { steamAccountId: 555, itemPurchases: [{ time: 30, itemId: 50 }, { time: 10, itemId: 29 }] } }] } } } },
      ],
    );

    expect(snapshot.players[0].abilityBuild.map((event) => event.abilityId)).toEqual([2, 3]);
    expect(snapshot.players[0].purchaseEvents).toEqual([{ time: 10, itemId: 29 }, { time: 30, itemId: 50 }]);
  });

  it('ignores legacy playback entries without an account ID instead of joining them by position', () => {
    const snapshot = buildMatchDetailSnapshot(
      baseMatch(9_000_000_005),
      [],
      [
        detailPayload('players', { players: [
          { steamAccountId: 601, playerSlot: 0, abilities: [{ abilityId: 1, time: 10, level: 1 }] },
          { steamAccountId: 602, playerSlot: 128, abilities: [{ abilityId: 2, time: 20, level: 2 }] },
        ] }),
        detailPayload('player_stats', { players: [
          { stats: { steamAccountId: 601, itemPurchases: [{ time: 10, itemId: 29 }] } },
          { stats: { steamAccountId: 602, itemPurchases: [{ time: 20, itemId: 50 }] } },
        ] }),
        detailPayload('player_playback', { players: [
          { playbackData: { abilityLearnEvents: [{ time: 1, abilityId: 999 }], purchaseEvents: [{ time: 1, itemId: 999 }] } },
          { playbackData: { abilityLearnEvents: [{ time: 2, abilityId: 998 }], purchaseEvents: [{ time: 2, itemId: 998 }] } },
        ] }),
      ],
    );

    expect(snapshot.players.map((player) => player.abilityBuild[0]?.abilityId)).toEqual([1, 2]);
    expect(snapshot.players.map((player) => player.purchaseEvents[0]?.itemId)).toEqual([29, 50]);
  });

  it('does not join stats or playback to a roster player without an account ID', () => {
    const snapshot = buildMatchDetailSnapshot(
      baseMatch(9_000_000_005),
      [],
      [
        detailPayload('players', { players: [
          { playerSlot: 0, heroId: 1 },
          { steamAccountId: 602, playerSlot: 128, heroId: 2 },
        ] }),
        detailPayload('player_stats', { players: [
          { stats: { steamAccountId: 601, itemPurchases: [{ time: 10, itemId: 29 }] } },
          { stats: { steamAccountId: 602, itemPurchases: [{ time: 20, itemId: 50 }] } },
        ] }),
        detailPayload('player_playback', { players: [
          { steamAccountId: 601, playbackData: { abilityLearnEvents: [{ time: 10, abilityId: 1 }] } },
          { steamAccountId: 602, playbackData: { abilityLearnEvents: [{ time: 20, abilityId: 2 }] } },
        ] }),
      ],
    );

    expect(snapshot.players[0]).toMatchObject({ accountId: null, abilityBuild: [], purchaseEvents: [] });
    expect(snapshot.players[1]).toMatchObject({
      accountId: 602,
      abilityBuild: [{ abilityId: 2 }],
      purchaseEvents: [{ time: 20, itemId: 50 }],
    });
  });

  it('maps reordered explicit playback entries to their matching players and enriches ability names', () => {
    const snapshot = buildMatchDetailSnapshot(
      baseMatch(9_000_000_006),
      [],
      [
        detailPayload('players', { players: [
          { steamAccountId: 701, playerSlot: 0, abilities: [{ abilityId: 11, abilityType: { name: 'alpha' } }] },
          { steamAccountId: 702, playerSlot: 128, abilities: [{ abilityId: 22, abilityType: { name: 'beta' } }] },
        ] }),
        detailPayload('player_playback', { players: [
          { steamAccountId: 702, abilities: [{ abilityId: 22, abilityType: { name: 'playback_beta' } }], playbackData: { abilityLearnEvents: [{ time: 20, abilityId: 22, levelObtained: 2, isTalent: true }], purchaseEvents: [{ time: 20, itemId: 50 }] } },
          { steamAccountId: 701, abilities: [{ abilityId: 11, abilityType: { name: 'playback_alpha' } }], playbackData: { abilityLearnEvents: [{ time: 10, abilityId: 11, levelObtained: 1, isTalent: false }], purchaseEvents: [{ time: 10, itemId: 29 }] } },
        ] }),
      ],
    );

    expect(snapshot.players[0].abilityBuild).toEqual([{ abilityId: 11, time: 10, level: 1, name: 'alpha', isTalent: false }]);
    expect(snapshot.players[1].abilityBuild).toEqual([{ abilityId: 22, time: 20, level: 2, name: 'beta', isTalent: true }]);
    expect(snapshot.players.map((player) => player.purchaseEvents[0]?.itemId)).toEqual([29, 50]);
  });

  it('keeps saved player progression and marks empty arrays as available after a failed overall detail', () => {
    const snapshot = buildMatchDetailSnapshot(
      { ...baseMatch(9_000_000_007), detail_status: 'failed' },
      [],
      [detailPayload('players', { players: [{ steamAccountId: 801, playerSlot: 0, abilities: [] }] })],
    );

    expect(snapshot.detailStatus).toBe('failed');
    expect(snapshot.players[0]).toMatchObject({ hasAbilityBuildData: true, abilityBuild: [], hasPurchaseEventsData: false });
  });

  it('merges an incomplete detail roster with history and normalized players without losing players', () => {
    const snapshot = buildMatchDetailSnapshot(
      baseMatch(9_000_000_008),
      [normalizedPlayer(903, 129)],
      [
        { payload_kind: 'history', payload_section: 'match', fetched_at: '2026-07-19T00:00:00.000Z', payload: { players: [
          { steamAccountId: 901, playerSlot: 0, heroId: 1 },
          { steamAccountId: 902, playerSlot: 128, heroId: 2 },
        ] } },
        detailPayload('players', { players: [{ steamAccountId: 901, playerSlot: 0, heroId: 11 }] }),
      ],
    );

    expect(snapshot.rosterStatus).toBe('incomplete');
    expect(snapshot.players.map((player) => [player.accountId, player.heroId])).toEqual([[901, 11], [902, 2], [903, 3]]);
  });

  it('marks a standard ten-player merged roster as complete', () => {
    const snapshot = buildMatchDetailSnapshot(
      baseMatch(9_000_000_009),
      [],
      [{
        payload_kind: 'history',
        payload_section: 'match',
        fetched_at: '2026-07-19T00:00:00.000Z',
        payload: {
          players: Array.from({ length: 10 }, (_, index) => ({
            steamAccountId: 1_000 + index,
            playerSlot: index < 5 ? index : 123 + index,
            heroId: index + 1,
          })),
        },
      }],
    );

    expect(snapshot.rosterStatus).toBe('complete');
  });
});

function baseMatch(matchId: number) {
  return {
    match_id: matchId, start_time: null, duration: null, radiant_win: null,
    game_mode: null, lobby_type: null, average_rank: null, radiant_score: null,
    dire_score: null, source: 'stratz', detail_status: 'available', detail_fetched_at: null,
  };
}

function detailPayload(section: string, match: Record<string, Json>): Parameters<typeof buildMatchDetailSnapshot>[2][number] {
  return {
    payload_kind: 'detail' as const, payload_section: section, fetched_at: '2026-07-19T00:00:00.000Z',
    payload: { data: { match } },
  };
}

function normalizedPlayer(accountId: number, playerSlot: number) {
  return {
    account_id: accountId, player_slot: playerSlot, hero_id: 3, kills: 0, deaths: 0, assists: 0,
    gold_per_min: 0, xp_per_min: 0, last_hits: 0, denies: 0, hero_damage: 0, tower_damage: 0,
    hero_healing: 0, level: 0, net_worth: 0,
  };
}
