import { describe, expect, it } from 'vitest';
import type { ArchiveMatch } from './archive';
import {
  calculateArchiveAnalytics,
  DEFAULT_ARCHIVE_FILTERS,
  filterArchiveMatches,
} from './archive-analytics';

const match = (overrides: Partial<ArchiveMatch> = {}): ArchiveMatch => ({
  matchId: 1,
  startTime: 1_750_000_000,
  durationSeconds: 2_400,
  radiantWin: true,
  gameMode: 22,
  lobbyType: 7,
  averageRank: 55,
  radiantScore: 30,
  direScore: 20,
  playerSlot: 0,
  heroId: 1,
  heroVariant: null,
  kills: 10,
  deaths: 2,
  assists: 8,
  goldPerMinute: 600,
  xpPerMinute: 700,
  lastHits: 300,
  denies: 10,
  heroDamage: 30_000,
  towerDamage: 5_000,
  heroHealing: 0,
  level: 30,
  netWorth: 20_000,
  leaverStatus: 0,
  partySize: 0,
  lane: 1,
  laneRole: 1,
  isRoaming: false,
  won: true,
  ...overrides,
});

describe('archive analytics', () => {
  it('calculates summary, modes, heroes and solo/party breakdowns', () => {
    const analytics = calculateArchiveAnalytics(
      [
        match(),
        match({
          matchId: 2,
          gameMode: 23,
          heroId: 2,
          playerSlot: 128,
          partySize: 3,
          lane: 2,
          laneRole: 2,
          won: false,
          kills: 3,
          deaths: 7,
          assists: 11,
          goldPerMinute: 400,
        }),
        match({
          matchId: 3,
          gameMode: 1,
          heroId: 2,
          lane: 3,
          laneRole: 3,
          won: true,
        }),
      ],
      { 1: 'Anti-Mage', 2: 'Axe' },
    );

    expect(analytics).toMatchObject({
      matches: 3,
      wins: 2,
      losses: 1,
      winRate: 66.7,
      averageGpm: 533,
    });
    expect(analytics.modes.map((item) => item.label)).toEqual([
      'Ranked',
      'Turbo',
      'All Pick',
    ]);
    expect(analytics.heroes[0]).toMatchObject({
      label: 'Axe',
      matches: 2,
      winRate: 50,
    });
    expect(analytics.party.map((item) => item.label)).toEqual(['Solo', 'Party']);
  });

  it('applies time, result, mode, position, hero and party filters', () => {
    const now = 1_800_000_000_000;
    const matches = [
      match({ startTime: Math.floor(now / 1_000) - 10, heroId: 1 }),
      match({
        matchId: 2,
        startTime: Math.floor(now / 1_000) - 40 * 86_400,
        gameMode: 23,
        partySize: 4,
        laneRole: 2,
        heroId: 2,
        won: false,
      }),
    ];

    expect(
      filterArchiveMatches(
        matches,
        { ...DEFAULT_ARCHIVE_FILTERS, period: '30d', result: 'wins', heroId: 1 },
        now,
      ),
    ).toHaveLength(1);
    expect(
      filterArchiveMatches(
        matches,
        { ...DEFAULT_ARCHIVE_FILTERS, mode: 'turbo', party: 'party', position: 'mid' },
        now,
      ),
    ).toHaveLength(1);
  });
});
