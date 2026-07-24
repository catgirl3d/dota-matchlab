import { describe, expect, it } from 'vitest';
import { buildKillBreakdown, buildKillKillerBreakdown } from './kill-breakdown';
import type { MatchDetailPlayer, MatchTimelineEvent } from './match-detail';

describe('kill breakdown', () => {
  it('shows only confirmed multi-hero fight clusters and maps their participants by team', () => {
    const players = [
      player('radiant-core', 1, true),
      player('radiant-support', 2, true),
      player('dire-core', 3, false),
      player('dire-support', 4, false),
    ];
    const events = [
      kill('fight-first', 100, players[0], players[2]),
      kill('fight-second', 108, players[3], players[1]),
      kill('pickoff', 160, players[0], players[2]),
    ];

    const [fight] = buildKillBreakdown(players, events, 'radiant-support');

    expect(fight).toMatchObject({
      startTime: 100,
      endTime: 108,
      killCount: 2,
      radiantKills: 1,
      direKills: 1,
      includesSelectedPlayer: true,
    });
    expect(fight.killPairs.map((pair) => [pair.killer.key, pair.victim.key, pair.killCount])).toEqual([
      ['radiant-core', 'dire-core', 1],
      ['dire-support', 'radiant-support', 1],
    ]);
    expect(fight.radiantPlayers.map((player) => player.key)).toEqual(['radiant-core', 'radiant-support']);
    expect(fight.direPlayers.map((player) => player.key)).toEqual(['dire-core', 'dire-support']);
  });

  it('groups every match kill by killer and victim', () => {
    const players = [
      player('radiant-core', 1, true),
      player('radiant-support', 2, true),
      player('dire-core', 3, false),
      player('dire-support', 4, false),
    ];
    const killers = buildKillKillerBreakdown(players, [
      kill('core-first', 100, players[0], players[2]),
      kill('core-second', 108, players[0], players[2]),
      kill('core-third', 150, players[0], players[3]),
      kill('support-first', 160, players[3], players[1]),
    ], 'dire-core');

    expect(killers[0]).toMatchObject({ key: 'radiant-core', totalKills: 3, includesSelectedPlayer: true });
    expect(killers[0].victims.map((victim) => [victim.player.key, victim.killCount])).toEqual([
      ['dire-core', 2],
      ['dire-support', 1],
    ]);
    expect(killers[1]).toMatchObject({ key: 'dire-support', totalKills: 1, includesSelectedPlayer: false });
  });
});

function player(key: string, accountId: number, isRadiant: boolean): MatchDetailPlayer {
  return {
    key, accountId, isRadiant, playerSlot: isRadiant ? accountId : 128 + accountId, name: key, heroId: accountId,
    kills: 0, deaths: 0, assists: 0, goldPerMinute: 0, xpPerMinute: 0, lastHits: 0, denies: 0,
    heroDamage: 0, towerDamage: 0, heroHealing: 0, netWorth: 0, level: 0, imp: null, role: null,
    position: null, lane: null, award: null, itemIds: [], backpackItemIds: [], neutralItemId: null,
    permanentUpgradeItemIds: { scepterItemId: null, shardItemId: null, moonShardItemId: null },
    abilityBuild: [], hasAbilityBuildData: false, purchaseEvents: [], hasPurchaseEventsData: false,
    minuteSeries: { gold: [], experience: [], netWorth: [], lastHits: [], denies: [], heroDamage: [], imp: [] },
    detailEvents: { kills: 0, deaths: 0, assists: 0, wards: 0, runes: 0, itemUses: 0, wardDestructions: 0 },
    combatEvents: { kills: [], assists: [], deaths: [] }, dotaPlusLevel: null, totalActions: null,
  };
}

function kill(key: string, time: number, actor: MatchDetailPlayer, target: MatchDetailPlayer): MatchTimelineEvent {
  return {
    key,
    time,
    type: 'kill',
    actor: { accountId: actor.accountId, heroId: actor.heroId, name: actor.name, isRadiant: actor.isRadiant },
    target: { accountId: target.accountId, heroId: target.heroId, name: target.name, isRadiant: target.isRadiant },
    isRadiant: actor.isRadiant,
    targetIsRadiant: target.isRadiant,
  };
}
