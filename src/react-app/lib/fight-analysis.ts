import type { MatchDetailPlayer, MatchTimelineEvent, MatchTimelineParticipant } from './match-detail';

export const FIGHT_CLUSTER_GAP_SECONDS = 12;
export const FIGHT_OBJECTIVE_TRADE_GRACE_SECONDS = 10;
const OBJECTIVE_TRADE_ABSENCE_MULTIPLIER = 0.25;

export type PlayerFightParticipation = {
  qualifyingFights: number;
  eligibleFights: number;
  participatedFights: number;
  missedFights: number;
  objectiveTradeFights: number;
  rawAbsence: number;
  adjustedAbsence: number;
};

type FightCluster = {
  startTime: number;
  endTime: number;
  weight: number;
  participantKeys: Set<string>;
};

export function analyzePlayerFightParticipation(
  players: readonly MatchDetailPlayer[],
  events: readonly MatchTimelineEvent[],
  playerKey: string,
): PlayerFightParticipation | null {
  const player = players.find((candidate) => candidate.key === playerKey);
  if (!player) return null;

  const participantKeys = buildParticipantKeyResolver(players);
  const fights = buildFightClusters(players, events, participantKeys);
  let eligibleWeight = 0;
  let missedWeight = 0;
  let adjustedMissedWeight = 0;
  let eligibleFights = 0;
  let participatedFights = 0;
  let missedFights = 0;
  let objectiveTradeFights = 0;

  for (const fight of fights) {
    const participated = fight.participantKeys.has(player.key);
    if (!participated && isDeadAtFightStart(player, fight.startTime)) continue;

    eligibleFights += 1;
    eligibleWeight += fight.weight;
    if (participated) {
      participatedFights += 1;
      continue;
    }

    missedFights += 1;
    missedWeight += fight.weight;
    const tradedForObjective = tookObjectiveDuringFight(player, fight, events, participantKeys);
    if (tradedForObjective) objectiveTradeFights += 1;
    adjustedMissedWeight += fight.weight * (tradedForObjective ? OBJECTIVE_TRADE_ABSENCE_MULTIPLIER : 1);
  }

  if (eligibleWeight === 0) return null;
  return {
    qualifyingFights: fights.length,
    eligibleFights,
    participatedFights,
    missedFights,
    objectiveTradeFights,
    rawAbsence: missedWeight / eligibleWeight,
    adjustedAbsence: adjustedMissedWeight / eligibleWeight,
  };
}

function buildFightClusters(
  players: readonly MatchDetailPlayer[],
  events: readonly MatchTimelineEvent[],
  participantKey: (participant: MatchTimelineParticipant | null) => string | null,
): FightCluster[] {
  const kills = events.filter((event) => event.type === 'kill').sort((left, right) => left.time - right.time || left.key.localeCompare(right.key));
  const groupedKills: MatchTimelineEvent[][] = [];

  for (const kill of kills) {
    const current = groupedKills.at(-1);
    const previousKill = current?.at(-1);
    if (!current || !previousKill || kill.time - previousKill.time > FIGHT_CLUSTER_GAP_SECONDS) {
      groupedKills.push([kill]);
    } else {
      current.push(kill);
    }
  }

  return groupedKills.flatMap((cluster) => {
    const first = cluster[0];
    const last = cluster.at(-1);
    if (!first || !last) return [];
    const participants = new Set<string>();

    for (const kill of cluster) {
      const actorKey = participantKey(kill.actor);
      const targetKey = participantKey(kill.target);
      if (actorKey) participants.add(actorKey);
      if (targetKey) participants.add(targetKey);
    }
    for (const player of players) {
      if (player.combatEvents.assists.some((assist) => assist.time >= first.time && assist.time <= last.time)) {
        participants.add(player.key);
      }
    }

    const radiantParticipants = players.filter((player) => player.isRadiant && participants.has(player.key)).length;
    const direParticipants = players.filter((player) => !player.isRadiant && participants.has(player.key)).length;
    const isConfirmedFight = cluster.length >= 2 && radiantParticipants >= 2 && direParticipants >= 2;
    if (!isConfirmedFight) return [];

    return [{
      startTime: first.time,
      endTime: last.time,
      weight: cluster.length,
      participantKeys: participants,
    }];
  });
}

function buildParticipantKeyResolver(players: readonly MatchDetailPlayer[]) {
  const byAccount = new Map(players.flatMap((player): Array<[number, string]> => player.accountId === null ? [] : [[player.accountId, player.key]]));
  const byHero = new Map(players.flatMap((player): Array<[number, string]> => player.heroId === null ? [] : [[player.heroId, player.key]]));
  return (participant: MatchTimelineParticipant | null): string | null => {
    if (!participant) return null;
    if (participant.accountId !== null) {
      const accountKey = byAccount.get(participant.accountId);
      if (accountKey) return accountKey;
    }
    return participant.heroId === null ? null : byHero.get(participant.heroId) ?? null;
  };
}

function isDeadAtFightStart(player: MatchDetailPlayer, fightStart: number): boolean {
  return player.combatEvents.deaths.some((death) => death.timeDead !== null
    && death.time < fightStart
    && death.time + death.timeDead > fightStart);
}

function tookObjectiveDuringFight(
  player: MatchDetailPlayer,
  fight: FightCluster,
  events: readonly MatchTimelineEvent[],
  participantKey: (participant: MatchTimelineParticipant | null) => string | null,
): boolean {
  return events.some((event) => event.type === 'tower'
    && participantKey(event.actor) === player.key
    && event.targetIsRadiant === !player.isRadiant
    && event.time >= fight.startTime
    && event.time <= fight.endTime + FIGHT_OBJECTIVE_TRADE_GRACE_SECONDS);
}
