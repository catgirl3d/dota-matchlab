import { describe, expect, it } from 'vitest';
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
});
