import { describe, expect, it } from 'vitest';
import type { MatchDetailPlayer } from '../../lib/match-detail';
import { sortPlayers } from './match-detail-player';

describe('sortPlayers', () => {
  it('sorts by position, puts unknown positions last, and uses player slot as the tie-breaker', () => {
    const players = [
      player({ key: 'position-five', playerSlot: 0, position: 5 }),
      player({ key: 'position-one', playerSlot: 1, position: 1 }),
      player({ key: 'unknown-later', playerSlot: 2, position: null }),
      player({ key: 'unknown-earlier', playerSlot: 3, position: null }),
      player({ key: 'position-one-later', playerSlot: 4, position: 1 }),
    ];

    expect(sortPlayers(players, 'role').map(({ key }) => key)).toEqual([
      'position-one',
      'position-one-later',
      'position-five',
      'unknown-later',
      'unknown-earlier',
    ]);
    expect(players.map(({ key }) => key)).toEqual([
      'position-five',
      'position-one',
      'unknown-later',
      'unknown-earlier',
      'position-one-later',
    ]);
  });
});

function player(overrides: Partial<MatchDetailPlayer>): MatchDetailPlayer {
  return {
    key: 'player',
    accountId: null,
    playerSlot: 0,
    isRadiant: true,
    name: null,
    heroId: 1,
    kills: 0,
    deaths: 0,
    assists: 0,
    goldPerMinute: 0,
    xpPerMinute: 0,
    lastHits: 0,
    denies: 0,
    heroDamage: 0,
    towerDamage: 0,
    heroHealing: 0,
    netWorth: 0,
    level: 1,
    imp: null,
    role: null,
    position: null,
    lane: null,
    award: null,
    itemIds: [],
    backpackItemIds: [],
    neutralItemId: null,
    permanentUpgradeItemIds: { scepterItemId: null, shardItemId: null, moonShardItemId: null },
    abilityBuild: [],
    hasAbilityBuildData: false,
    purchaseEvents: [],
    hasPurchaseEventsData: false,
    minuteSeries: { gold: [], experience: [], netWorth: [], lastHits: [], denies: [], heroDamage: [], imp: [] },
    detailEvents: { kills: 0, deaths: 0, assists: 0, wards: 0, runes: 0, itemUses: 0, wardDestructions: 0 },
    combatEvents: { kills: [], assists: [], deaths: [] },
    dotaPlusLevel: null,
    totalActions: null,
    ...overrides,
  };
}
