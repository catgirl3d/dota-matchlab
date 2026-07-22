import { describe, expect, it } from 'vitest';
import type { MatchDetailPlayer, MatchTimelineEvent, MatchTimelineParticipant } from './match-detail';
import { analyzePlayerFightParticipation } from './fight-analysis';

describe('analyzePlayerFightParticipation', () => {
  it('clusters combat events, counts assist participation, discounts objective trades, and excludes pre-dead players', () => {
    const players = [
      player('selected', 1, 1, true, { assists: [{ time: 100 }], deaths: [{ time: 270, timeDead: 50 }] }),
      player('radiant-ally', 2, 2, true),
      player('radiant-second', 5, 5, true, { assists: [{ time: 200 }, { time: 300 }], deaths: [] }),
      player('dire-core', 3, 3, false),
      player('dire-support', 4, 4, false),
    ];
    const events: MatchTimelineEvent[] = [
      kill('fight-1-a', 100, players[1], players[3]),
      kill('fight-1-b', 108, players[4], players[1]),
      kill('fight-2-a', 200, players[1], players[3]),
      kill('fight-2-b', 210, players[4], players[1]),
      tower('fight-2-objective', 212, players[0], false),
      kill('fight-3-a', 300, players[1], players[3]),
      kill('fight-3-b', 308, players[4], players[1]),
    ];

    expect(analyzePlayerFightParticipation(players, events, 'selected')).toEqual({
      qualifyingFights: 3,
      eligibleFights: 2,
      participatedFights: 1,
      missedFights: 1,
      objectiveTradeFights: 1,
      rawAbsence: 0.5,
      adjustedAbsence: 0.125,
    });
  });

  it('returns null when there are no qualifying eligible fights', () => {
    const players = [player('selected', 1, 1, true), player('enemy', 2, 2, false)];
    expect(analyzePlayerFightParticipation(players, [kill('pickoff', 100, players[0], players[1])], 'selected')).toBeNull();
  });

  it.each([1, 2, 3, 4, 5])('does not classify a %d versus 1 pickoff as a fight', (attackerCount) => {
    const attackers = Array.from({ length: attackerCount }, (_, index) => player(
      `attacker-${index}`,
      index + 1,
      index + 1,
      true,
      { assists: index === 0 ? [] : [{ time: 100 }], deaths: [] },
    ));
    const victim = player('victim', 100, 100, false);
    const players = [...attackers, victim];

    expect(analyzePlayerFightParticipation(players, [kill('pickoff', 100, attackers[0], victim)], attackers[0].key)).toBeNull();
  });

  it('does not classify an asymmetric 2 versus 1 exchange as a fight', () => {
    const radiantCore = player('radiant-core', 1, 1, true);
    const radiantSupport = player('radiant-support', 2, 2, true, { assists: [{ time: 100 }], deaths: [] });
    const direSolo = player('dire-solo', 3, 3, false);
    const players = [radiantCore, radiantSupport, direSolo];
    const events = [
      kill('gank-kill', 100, radiantCore, direSolo),
      kill('counter-kill', 108, direSolo, radiantCore),
    ];

    expect(analyzePlayerFightParticipation(players, events, radiantSupport.key)).toBeNull();
  });
});

function player(
  key: string,
  accountId: number,
  heroId: number,
  isRadiant: boolean,
  combatEvents: MatchDetailPlayer['combatEvents'] = { assists: [], deaths: [] },
): MatchDetailPlayer {
  return {
    key, accountId, heroId, isRadiant, playerSlot: isRadiant ? accountId : 128 + accountId, name: key,
    kills: 0, deaths: 0, assists: 0, goldPerMinute: 0, xpPerMinute: 0, lastHits: 0, denies: 0,
    heroDamage: 0, towerDamage: 0, heroHealing: 0, netWorth: 0, level: 0, imp: null, role: null,
    position: null, lane: null, award: null, itemIds: [], backpackItemIds: [], neutralItemId: null,
    permanentUpgradeItemIds: { scepterItemId: null, shardItemId: null, moonShardItemId: null },
    abilityBuild: [], hasAbilityBuildData: false, purchaseEvents: [], hasPurchaseEventsData: false,
    minuteSeries: { gold: [], experience: [], netWorth: [], lastHits: [], heroDamage: [], imp: [] },
    detailEvents: { kills: 0, deaths: 0, assists: 0, wards: 0, runes: 0, itemUses: 0, wardDestructions: 0 },
    combatEvents, dotaPlusLevel: null, totalActions: null,
  };
}

function participant(player: MatchDetailPlayer): MatchTimelineParticipant {
  return { accountId: player.accountId, heroId: player.heroId, name: player.name, isRadiant: player.isRadiant };
}

function kill(key: string, time: number, actor: MatchDetailPlayer, target: MatchDetailPlayer): MatchTimelineEvent {
  return { key, time, type: 'kill', actor: participant(actor), target: participant(target), isRadiant: actor.isRadiant, targetIsRadiant: target.isRadiant };
}

function tower(key: string, time: number, actor: MatchDetailPlayer, targetIsRadiant: boolean): MatchTimelineEvent {
  return { key, time, type: 'tower', actor: participant(actor), target: null, isRadiant: actor.isRadiant, targetIsRadiant };
}
