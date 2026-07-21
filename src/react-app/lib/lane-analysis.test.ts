import { describe, expect, it } from 'vitest';
import { buildLaneAnalysis, LANE_ANALYSIS_MINUTE, type LaneAnalysisPlayer } from './lane-analysis';

describe('lane analysis', () => {
  it('builds physical lane matchups and calculates their 10-minute economy', () => {
    const analysis = buildLaneAnalysis([
      player({ key: 'radiant-carry', isRadiant: true, position: 1, lane: 1, netWorth: 7_000, lastHits: 70 }),
      player({ key: 'radiant-mid', isRadiant: true, position: 2, lane: 2, netWorth: 5_500, lastHits: 54 }),
      player({ key: 'radiant-offlane', isRadiant: true, position: 3, lane: 3, netWorth: 6_300, lastHits: 70 }),
      player({ key: 'radiant-soft-support', isRadiant: true, position: 4, lane: 3, netWorth: 3_200, lastHits: 5 }),
      player({ key: 'radiant-hard-support', isRadiant: true, position: 5, lane: 1, netWorth: 2_400, lastHits: 8 }),
      player({ key: 'dire-carry', isRadiant: false, position: 1, lane: 1, netWorth: 7_000, lastHits: 75 }),
      player({ key: 'dire-mid', isRadiant: false, position: 2, lane: 2, netWorth: 5_100, lastHits: 49 }),
      player({ key: 'dire-offlane', isRadiant: false, position: 3, lane: 3, netWorth: 6_700, lastHits: 63 }),
      player({ key: 'dire-soft-support', isRadiant: false, position: 4, lane: 3, netWorth: 2_900, lastHits: 4 }),
      player({ key: 'dire-hard-support', isRadiant: false, position: 5, lane: 1, netWorth: 2_100, lastHits: 2 }),
    ], [
      { lane: 'Top lane', outcome: 'DIRE_VICTORY' },
      { lane: 'Mid lane', outcome: 'RADIANT_VICTORY' },
      { lane: 'Bottom lane', outcome: 'TIE' },
    ]);

    expect(analysis[0]).toMatchObject({
      id: 'top',
      radiantPlayers: [expect.objectContaining({ position: 3 }), expect.objectContaining({ position: 4 })],
      direPlayers: [expect.objectContaining({ position: 1 }), expect.objectContaining({ position: 5 })],
      radiantNetWorth: 9_500,
      direNetWorth: 9_100,
      radiantLastHits: 75,
      direLastHits: 77,
      netWorthDelta: 400,
      source: 'calculated',
    });
    expect(analysis[0].radiantPlayers.map((player) => player.minuteSeries.lastHits[LANE_ANALYSIS_MINUTE])).toEqual([0, 5]);
    expect(analysis[1]).toMatchObject({
      id: 'mid',
      radiantPlayers: [expect.objectContaining({ position: 2 })],
      direPlayers: [expect.objectContaining({ position: 2 })],
      netWorthDelta: 400,
      source: 'calculated',
    });
    expect(analysis[2]).toMatchObject({
      id: 'bottom',
      radiantPlayers: [expect.objectContaining({ position: 1 }), expect.objectContaining({ position: 5 })],
      direPlayers: [expect.objectContaining({ position: 3 }), expect.objectContaining({ position: 4 })],
      netWorthDelta: -200,
      source: 'calculated',
    });
  });

  it('falls back to the provider result when the 10-minute series is incomplete', () => {
    const [topLane] = buildLaneAnalysis([
      player({ key: 'radiant-offlane', isRadiant: true, position: 3, lane: 3, netWorth: null, lastHits: null }),
      player({ key: 'radiant-soft-support', isRadiant: true, position: 4, lane: 3, netWorth: null, lastHits: null }),
      player({ key: 'dire-carry', isRadiant: false, position: 1, lane: 1, netWorth: null, lastHits: null }),
      player({ key: 'dire-hard-support', isRadiant: false, position: 5, lane: 1, netWorth: null, lastHits: null }),
    ], [{ lane: 'Top lane', outcome: 'DIRE_VICTORY' }]);

    expect(topLane).toMatchObject({
      source: 'provider',
      providerOutcome: 'DIRE_VICTORY',
      netWorthDelta: null,
    });
  });
});

function player({
  key,
  isRadiant,
  position,
  lane,
  netWorth,
  lastHits,
}: {
  key: string;
  isRadiant: boolean;
  position: 1 | 2 | 3 | 4 | 5;
  lane: 1 | 2 | 3;
  netWorth: number | null;
  lastHits: number | null;
}): LaneAnalysisPlayer {
  return {
    key,
    isRadiant,
    heroId: null,
    role: null,
    position,
    lane,
    minuteSeries: {
      netWorth: netWorthMinuteSeries(netWorth),
      lastHits: lastHitMinuteSeries(lastHits),
    },
  };
}

function netWorthMinuteSeries(value: number | null): number[] {
  return value === null ? [] : Array.from({ length: LANE_ANALYSIS_MINUTE + 1 }, () => value);
}

function lastHitMinuteSeries(total: number | null): number[] {
  if (total === null) return [];
  const perMinute = Math.floor(total / LANE_ANALYSIS_MINUTE);
  return Array.from(
    { length: LANE_ANALYSIS_MINUTE + 1 },
    (_, minute) => minute < LANE_ANALYSIS_MINUTE ? perMinute : total - perMinute * LANE_ANALYSIS_MINUTE,
  );
}
