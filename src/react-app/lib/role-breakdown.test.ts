import { describe, expect, it } from 'vitest';
import { buildRoleBreakdown, getRoleBreakdownPerformance, type RoleBreakdownPlayer } from './role-breakdown';

describe('role breakdown', () => {
  it('groups only identical valid positions across teams', () => {
    const roles = buildRoleBreakdown([
      player({ key: 'radiant-mid', isRadiant: true, position: 2 }),
      player({ key: 'dire-mid', isRadiant: false, position: 2 }),
      player({ key: 'radiant-offlane-a', isRadiant: true, position: 3 }),
      player({ key: 'radiant-offlane-b', isRadiant: true, position: 3 }),
      player({ key: 'dire-carry', isRadiant: false, position: 1 }),
      player({ key: 'unknown', isRadiant: true, position: null }),
    ]);

    expect(roles.map((role) => role.label)).toEqual(['Carry', 'Mid', 'Offlane', 'Soft support', 'Hard support']);
    expect(roles[1]).toMatchObject({
      position: 2,
      radiantPlayers: [expect.objectContaining({ key: 'radiant-mid' })],
      direPlayers: [expect.objectContaining({ key: 'dire-mid' })],
    });
    expect(roles[2].radiantPlayers.map((player) => player.key)).toEqual(['radiant-offlane-a', 'radiant-offlane-b']);
    expect(roles[2].direPlayers).toEqual([]);
    expect(roles.flatMap((role) => [...role.radiantPlayers, ...role.direPlayers])).not.toContainEqual(expect.objectContaining({ key: 'unknown' }));
  });

  it('calculates the 10-minute and 20-minute performance from detail events and series', () => {
    const entry = player({ key: 'mid', isRadiant: true, position: 2, minuteSeries: {
      netWorth: Array.from({ length: 21 }, (_, minute) => minute * 500),
      experience: Array.from({ length: 21 }, () => 100),
      lastHits: Array.from({ length: 21 }, () => 5),
      denies: Array.from({ length: 21 }, () => 1),
    }, combatEvents: {
      kills: [{ time: 300 }, { time: 900 }],
      deaths: [{ time: 660, timeDead: null }],
      assists: [{ time: 120 }, { time: 1_100 }],
    } });

    expect(getRoleBreakdownPerformance(entry, 10)).toEqual({
      kills: 1, deaths: 0, assists: 1, netWorth: 5_000, experience: 1_100, lastHits: 55, denies: 11,
    });
    expect(getRoleBreakdownPerformance(entry, 20)).toEqual({
      kills: 2, deaths: 1, assists: 2, netWorth: 10_000, experience: 2_100, lastHits: 105, denies: 21,
    });
  });
});

function player({
  key,
  isRadiant,
  position,
  minuteSeries = { netWorth: [], experience: [], lastHits: [], denies: [] },
  combatEvents = { kills: [], assists: [], deaths: [] },
}: {
  key: string;
  isRadiant: boolean;
  position: RoleBreakdownPlayer['position'];
  minuteSeries?: Pick<RoleBreakdownPlayer['minuteSeries'], 'netWorth' | 'experience' | 'lastHits' | 'denies'>;
  combatEvents?: RoleBreakdownPlayer['combatEvents'];
}): RoleBreakdownPlayer {
  return {
    key,
    isRadiant,
    heroId: null,
    position,
    kills: 0,
    deaths: 0,
    assists: 0,
    netWorth: 0,
    xpPerMinute: 0,
    lastHits: 0,
    denies: 0,
    minuteSeries: { gold: [], heroDamage: [], imp: [], ...minuteSeries },
    combatEvents,
  };
}
