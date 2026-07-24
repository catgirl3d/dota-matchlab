import { buildFightClusters } from './fight-analysis';
import type { MatchDetailPlayer, MatchTimelineEvent } from './match-detail';

export type KillBreakdownFight = {
  key: string;
  startTime: number;
  endTime: number;
  killCount: number;
  radiantKills: number;
  direKills: number;
  killPairs: KillBreakdownPair[];
  radiantPlayers: MatchDetailPlayer[];
  direPlayers: MatchDetailPlayer[];
  includesSelectedPlayer: boolean;
};

export type KillBreakdownPair = {
  key: string;
  killer: MatchDetailPlayer;
  victim: MatchDetailPlayer;
  killCount: number;
};

export type KillBreakdownKiller = {
  key: string;
  killer: MatchDetailPlayer;
  totalKills: number;
  victims: Array<{ player: MatchDetailPlayer; killCount: number }>;
  includesSelectedPlayer: boolean;
};

export function buildKillBreakdown(
  players: readonly MatchDetailPlayer[],
  events: readonly MatchTimelineEvent[],
  selectedPlayerKey: string | null,
): KillBreakdownFight[] {
  return buildFightClusters(players, events).map((fight) => {
    const killPairs = buildKillPairs(players, fight.kills);
    return {
      key: fight.kills.map((kill) => kill.key).join('|'),
      startTime: fight.startTime,
      endTime: fight.endTime,
      killCount: fight.weight,
      radiantKills: fight.kills.filter((kill) => kill.isRadiant === true).length,
      direKills: fight.kills.filter((kill) => kill.isRadiant === false).length,
      killPairs,
      radiantPlayers: players.filter((player) => player.isRadiant && fight.participantKeys.has(player.key)),
      direPlayers: players.filter((player) => !player.isRadiant && fight.participantKeys.has(player.key)),
      includesSelectedPlayer: selectedPlayerKey !== null && fight.participantKeys.has(selectedPlayerKey),
    };
  });
}

export function buildKillKillerBreakdown(
  players: readonly MatchDetailPlayer[],
  events: readonly MatchTimelineEvent[],
  selectedPlayerKey: string | null,
): KillBreakdownKiller[] {
  const killers = new Map<string, { killer: MatchDetailPlayer; victims: Map<string, { player: MatchDetailPlayer; killCount: number }> }>();

  for (const pair of buildKillPairs(players, events)) {
    const killerEntry = killers.get(pair.killer.key) ?? { killer: pair.killer, victims: new Map() };
    killerEntry.victims.set(pair.victim.key, { player: pair.victim, killCount: pair.killCount });
    killers.set(pair.killer.key, killerEntry);
  }

  return [...killers.entries()]
    .map(([key, entry]) => {
      const victims = [...entry.victims.values()].sort((left, right) => right.killCount - left.killCount || left.player.key.localeCompare(right.player.key));
      const totalKills = victims.reduce((total, victim) => total + victim.killCount, 0);
      return {
        key,
        killer: entry.killer,
        totalKills,
        victims,
        includesSelectedPlayer: selectedPlayerKey !== null && (entry.killer.key === selectedPlayerKey || entry.victims.has(selectedPlayerKey)),
      };
    })
    .sort((left, right) => right.totalKills - left.totalKills || left.killer.key.localeCompare(right.killer.key));
}

function buildKillPairs(
  players: readonly MatchDetailPlayer[],
  events: readonly MatchTimelineEvent[],
): KillBreakdownPair[] {
  const resolvePlayer = buildPlayerResolver(players);
  const pairs = new Map<string, KillBreakdownPair>();

  for (const event of events) {
    if (event.type !== 'kill') continue;

    const killer = resolvePlayer(event.actor);
    const victim = resolvePlayer(event.target);
    if (!killer || !victim) continue;

    const key = `${killer.key}|${victim.key}`;
    const pair = pairs.get(key) ?? { key, killer, victim, killCount: 0 };
    pair.killCount += 1;
    pairs.set(key, pair);
  }

  return [...pairs.values()].sort((left, right) => {
    if (left.killer.isRadiant !== right.killer.isRadiant) return left.killer.isRadiant ? -1 : 1;
    return right.killCount - left.killCount || left.killer.key.localeCompare(right.killer.key) || left.victim.key.localeCompare(right.victim.key);
  });
}

function buildPlayerResolver(players: readonly MatchDetailPlayer[]) {
  const byAccount = new Map(players.flatMap((player): Array<[number, MatchDetailPlayer]> => player.accountId === null ? [] : [[player.accountId, player]]));
  const byHero = new Map(players.flatMap((player): Array<[number, MatchDetailPlayer]> => player.heroId === null ? [] : [[player.heroId, player]]));

  return (participant: MatchTimelineEvent['actor']): MatchDetailPlayer | null => {
    if (!participant) return null;
    if (participant.accountId !== null) {
      const accountPlayer = byAccount.get(participant.accountId);
      if (accountPlayer) return accountPlayer;
    }
    return participant.heroId === null ? null : byHero.get(participant.heroId) ?? null;
  };
}
