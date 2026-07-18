import { describe, expect, it } from 'vitest';
import type { RecentDotaMatch } from '../../shared/dota';
import { calculateMatchSummary } from './match-summary';

const match = (
  overrides: Partial<RecentDotaMatch> = {},
): RecentDotaMatch => ({
  matchId: '1',
  startTime: 1,
  durationSeconds: 2_400,
  heroId: 1,
  heroName: 'Anti-Mage',
  won: true,
  kills: 10,
  deaths: 2,
  assists: 8,
  goldPerMinute: 600,
  xpPerMinute: 700,
  lastHits: 300,
  ...overrides,
});

describe('calculateMatchSummary', () => {
  it('calculates win rate and averages without rounding drift', () => {
    const summary = calculateMatchSummary([
      match(),
      match({ matchId: '2', won: false, kills: 3, deaths: 7, assists: 11, goldPerMinute: 400 }),
    ]);

    expect(summary).toEqual({
      matches: 2,
      wins: 1,
      losses: 1,
      winRate: 50,
      averageKills: 6.5,
      averageDeaths: 4.5,
      averageAssists: 9.5,
      averageGpm: 500,
    });
  });

  it('returns a stable empty summary', () => {
    expect(calculateMatchSummary([])).toMatchObject({
      matches: 0,
      winRate: 0,
      averageGpm: 0,
    });
  });
});
