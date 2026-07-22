import type { MatchDetailPlayer, MatchTimelineEvent, MatchTimelineParticipant } from './match-detail';
import { analyzePlayerFightParticipation } from './fight-analysis';
import { getLanePlayerMetrics } from './lane-analysis';

export type ContributionDimensionId = 'fight' | 'lane' | 'economy' | 'objectives' | 'utility';
export type TeamOutputComponentId = 'fight-involvement' | 'hero-damage' | 'tower-damage' | 'hero-healing';

export type PlayerContributionResult = {
  score: number;
  confidence: 'high' | 'medium' | 'low';
  role: 'core' | 'support' | 'unknown';
  benchmark: {
    kind: 'position-opponent' | 'opposing-team-average';
    playerKey: string | null;
  };
  dimensions: Array<{
    id: ContributionDimensionId;
    score: number;
    weight: number;
  }>;
};

export type TeamOutputShareResult = {
  score: number;
  equalShare: number;
  components: Array<{
    id: TeamOutputComponentId;
    score: number;
    weight: number;
    points: number;
  }>;
};

export type LiabilityDimensionId = 'death-cost' | 'fight-absence' | 'resource-conversion-gap' | 'objective-exposure';
export const OBJECTIVE_EXPOSURE_WINDOW_SECONDS = 20;

export type PlayerResponsibilityResult = {
  contribution: PlayerContributionResult;
  liability: {
    score: number;
    dimensions: Array<{
      id: LiabilityDimensionId;
      score: number;
      weight: number;
    }>;
  };
  balance: number;
  metrics: {
    deaths: number;
    untradedDeaths: number | null;
    chainDeaths: number | null;
    lateDeaths: number | null;
    objectiveExposureDeaths: number | null;
    objectiveExposureWeight: number | null;
    killParticipation: number;
    rawAbsence: number | null;
    adjustedAbsence: number | null;
    benchmarkRawAbsence: number | null;
    benchmarkAdjustedAbsence: number | null;
    eligibleFights: number | null;
    participatedFights: number | null;
    missedFights: number | null;
    objectiveTradeFights: number | null;
    resourceShare: number;
    outputShare: number;
    resourceConversionGap: number;
  };
};

type ContributionOptions = {
  hasDetailedEvents: boolean;
};

type WeightedValue = {
  value: number | null;
  weight: number;
};

const ROLE_WEIGHTS: Record<PlayerContributionResult['role'], Record<ContributionDimensionId, number>> = {
  core: { fight: 35, lane: 25, economy: 20, objectives: 15, utility: 5 },
  support: { fight: 30, lane: 15, economy: 10, objectives: 10, utility: 35 },
  unknown: { fight: 35, lane: 20, economy: 15, objectives: 15, utility: 15 },
};

const LIABILITY_WEIGHTS: Record<PlayerContributionResult['role'], Record<LiabilityDimensionId, number>> = {
  core: { 'death-cost': 50, 'fight-absence': 20, 'resource-conversion-gap': 20, 'objective-exposure': 10 },
  support: { 'death-cost': 40, 'fight-absence': 30, 'resource-conversion-gap': 10, 'objective-exposure': 20 },
  unknown: { 'death-cost': 45, 'fight-absence': 25, 'resource-conversion-gap': 15, 'objective-exposure': 15 },
};

const RESOURCE_CONVERSION_GAP_DEAD_ZONE = 0.03;
const RESOURCE_CONVERSION_GAP_SATURATION = 0.15;
const TEAM_OUTPUT_WEIGHTS: Record<TeamOutputComponentId, number> = {
  'fight-involvement': 40,
  'hero-damage': 35,
  'tower-damage': 20,
  'hero-healing': 5,
};

export function calculatePlayerContribution(
  players: readonly MatchDetailPlayer[],
  playerKey: string,
  options: ContributionOptions,
): PlayerContributionResult | null {
  const player = players.find((candidate) => candidate.key === playerKey);
  if (!player) return null;

  const opponents = players.filter((candidate) => candidate.isRadiant !== player.isRadiant);
  if (opponents.length === 0) return null;

  const directOpponent = player.position === null
    ? null
    : opponents.find((candidate) => candidate.position === player.position) ?? null;
  const benchmarkValue = (read: (candidate: MatchDetailPlayer) => number | null): number | null => {
    if (directOpponent) return read(directOpponent);
    return average(opponents.map(read));
  };
  const playerTeam = players.filter((candidate) => candidate.isRadiant === player.isRadiant);
  const opposingTeam = opponents;
  const playerTeamKills = sum(playerTeam, (candidate) => candidate.kills);
  const opposingTeamKills = sum(opposingTeam, (candidate) => candidate.kills);
  const playerTeamDeaths = sum(playerTeam, (candidate) => candidate.deaths);
  const opposingTeamDeaths = sum(opposingTeam, (candidate) => candidate.deaths);

  const fight = weightedAverage([
    {
      value: duelScore(
        participation(player.kills + player.assists, playerTeamKills),
        benchmarkValue((candidate) => participation(candidate.kills + candidate.assists, opposingTeamKills)),
        0.05,
      ),
      weight: 45,
    },
    {
      value: duelScore(
        efficiency(player.heroDamage, player.netWorth),
        benchmarkValue((candidate) => efficiency(candidate.heroDamage, candidate.netWorth)),
        0.25,
      ),
      weight: 35,
    },
    {
      value: inverseDuelScore(
        participation(player.deaths, playerTeamDeaths),
        benchmarkValue((candidate) => participation(candidate.deaths, opposingTeamDeaths)),
        0.03,
      ),
      weight: 20,
    },
  ]);

  const playerLane = getLanePlayerMetrics(player);
  const lane = weightedAverage([
    { value: duelScore(playerLane.netWorth, benchmarkValue((candidate) => getLanePlayerMetrics(candidate).netWorth), 500), weight: 65 },
    { value: duelScore(playerLane.lastHits, benchmarkValue((candidate) => getLanePlayerMetrics(candidate).lastHits), 5), weight: 35 },
  ]);

  const economy = weightedAverage([
    { value: duelScore(player.goldPerMinute, benchmarkValue((candidate) => candidate.goldPerMinute), 50), weight: 50 },
    { value: duelScore(player.xpPerMinute, benchmarkValue((candidate) => candidate.xpPerMinute), 50), weight: 30 },
    { value: duelScore(player.netWorth, benchmarkValue((candidate) => candidate.netWorth), 1_000), weight: 20 },
  ]);

  const objectives = zeroAnchoredDuelScore(
    player.towerDamage,
    benchmarkValue((candidate) => candidate.towerDamage),
    500,
  );

  const utilityValues: WeightedValue[] = [
    {
      value: duelScore(
        participation(player.assists, playerTeamKills),
        benchmarkValue((candidate) => participation(candidate.assists, opposingTeamKills)),
        0.05,
      ),
      weight: 35,
    },
    { value: duelScore(player.heroHealing, benchmarkValue((candidate) => candidate.heroHealing), 500), weight: 25 },
  ];
  if (options.hasDetailedEvents) {
    utilityValues.push(
      { value: duelScore(player.detailEvents.wards, benchmarkValue((candidate) => candidate.detailEvents.wards), 1), weight: 20 },
      { value: duelScore(player.detailEvents.wardDestructions, benchmarkValue((candidate) => candidate.detailEvents.wardDestructions), 0.5), weight: 10 },
      { value: duelScore(player.detailEvents.runes, benchmarkValue((candidate) => candidate.detailEvents.runes), 1), weight: 10 },
    );
  }
  const utility = weightedAverage(utilityValues);

  const role = playerRole(player);
  const roleWeights = ROLE_WEIGHTS[role];
  const dimensionValues: Array<{ id: ContributionDimensionId; value: number | null }> = [
    { id: 'fight', value: fight },
    { id: 'lane', value: lane },
    { id: 'economy', value: economy },
    { id: 'objectives', value: objectives },
    { id: 'utility', value: utility },
  ];
  const availableDimensions = dimensionValues.filter((dimension): dimension is { id: ContributionDimensionId; value: number } => dimension.value !== null);
  const availableWeight = availableDimensions.reduce((total, dimension) => total + roleWeights[dimension.id], 0);
  if (availableWeight === 0) return null;

  const normalizedWeights = normalizeWeights(availableDimensions.map((dimension) => roleWeights[dimension.id]));
  const dimensions = availableDimensions.map((dimension, index) => ({
    id: dimension.id,
    score: Math.round(dimension.value),
    weight: normalizedWeights[index],
  }));
  const score = Math.round(availableDimensions.reduce(
    (total, dimension) => total + dimension.value * roleWeights[dimension.id],
    0,
  ) / availableWeight);
  const hasLaneComparison = lane !== null;

  return {
    score,
    confidence: directOpponent && hasLaneComparison && options.hasDetailedEvents
      ? 'high'
      : directOpponent || hasLaneComparison || options.hasDetailedEvents ? 'medium' : 'low',
    role,
    benchmark: {
      kind: directOpponent ? 'position-opponent' : 'opposing-team-average',
      playerKey: directOpponent?.key ?? null,
    },
    dimensions,
  };
}

export function calculateTeamOutputShare(
  players: readonly MatchDetailPlayer[],
  playerKey: string,
): TeamOutputShareResult | null {
  const player = players.find((candidate) => candidate.key === playerKey);
  if (!player) return null;

  const team = players.filter((candidate) => candidate.isRadiant === player.isRadiant);
  if (team.length !== 5) return null;

  const teamKills = sum(team, (candidate) => candidate.kills);
  const teamAssists = sum(team, (candidate) => candidate.assists);
  const componentCandidates: Array<{ id: TeamOutputComponentId; shares: Array<number | null> }> = [
    {
      id: 'fight-involvement',
      shares: team.map((candidate) => weightedAverage([
        { value: teamKills > 0 ? candidate.kills / teamKills : null, weight: 60 },
        { value: teamAssists > 0 ? candidate.assists / teamAssists : null, weight: 40 },
      ])),
    },
    { id: 'hero-damage', shares: teamMetricShares(team, (candidate) => candidate.heroDamage) },
    { id: 'tower-damage', shares: teamMetricShares(team, (candidate) => candidate.towerDamage) },
    { id: 'hero-healing', shares: teamMetricShares(team, (candidate) => candidate.heroHealing) },
  ];
  const availableComponents = componentCandidates.flatMap((component) => component.shares.every((share) => share !== null)
    ? [{ id: component.id, shares: component.shares as number[], weight: TEAM_OUTPUT_WEIGHTS[component.id] }]
    : []);
  const availableWeight = availableComponents.reduce((total, component) => total + component.weight, 0);
  if (availableWeight === 0) return null;

  const rawScores = team.map((_, playerIndex) => availableComponents.reduce(
    (total, component) => total + component.shares[playerIndex] * component.weight,
    0,
  ) / availableWeight * 100);
  const scores = allocateRoundedTotal(team, rawScores, 100);
  const selectedIndex = team.findIndex((candidate) => candidate.key === playerKey);
  const normalizedWeights = normalizeWeights(availableComponents.map((component) => component.weight));

  return {
    score: scores[selectedIndex],
    equalShare: 100 / team.length,
    components: availableComponents.map((component, index) => ({
      id: component.id,
      score: Math.round(component.shares[selectedIndex] * 100),
      weight: normalizedWeights[index],
      points: roundToTwo(component.shares[selectedIndex] * component.weight / availableWeight * 100),
    })),
  };
}

export function calculatePlayerResponsibility(
  players: readonly MatchDetailPlayer[],
  playerKey: string,
  events: readonly MatchTimelineEvent[],
  durationSeconds: number | null,
  options: ContributionOptions,
): PlayerResponsibilityResult | null {
  const contribution = calculatePlayerContribution(players, playerKey, options);
  const player = players.find((candidate) => candidate.key === playerKey);
  if (!contribution || !player) return null;

  const opponents = players.filter((candidate) => candidate.isRadiant !== player.isRadiant);
  if (opponents.length === 0) return null;
  const directOpponent = player.position === null
    ? null
    : opponents.find((candidate) => candidate.position === player.position) ?? null;
  const benchmarkValue = (read: (candidate: MatchDetailPlayer) => number | null): number | null => {
    if (directOpponent) return read(directOpponent);
    return average(opponents.map(read));
  };
  const playerDeathMetrics = deathMetrics(player, players, events, durationSeconds, options.hasDetailedEvents);
  const playerFightParticipation = options.hasDetailedEvents
    ? analyzePlayerFightParticipation(players, events, player.key)
    : null;
  const readFightParticipation = (candidate: MatchDetailPlayer) => analyzePlayerFightParticipation(players, events, candidate.key);
  const directOpponentFightParticipation = directOpponent ? readFightParticipation(directOpponent) : null;
  const benchmarkRawAbsence = directOpponentFightParticipation?.rawAbsence
    ?? average(opponents.map((candidate) => readFightParticipation(candidate)?.rawAbsence ?? null));
  const benchmarkAdjustedAbsence = directOpponentFightParticipation?.adjustedAbsence
    ?? average(opponents.map((candidate) => readFightParticipation(candidate)?.adjustedAbsence ?? null));
  const playerResourceConversion = resourceConversionGap(player, players);
  const deathCost = liabilityDuelScore(
    playerDeathMetrics.weightedCost,
    benchmarkValue((candidate) => deathMetrics(candidate, players, events, durationSeconds, options.hasDetailedEvents).weightedCost),
    1,
  );
  const fightAbsenceScore = playerFightParticipation === null
    ? null
    : liabilityDuelScore(playerFightParticipation.adjustedAbsence, benchmarkAdjustedAbsence, 0.05);
  const resourceConversionGapScore = normalizedResourceConversionGap(playerResourceConversion.gap);
  const objectiveExposure = options.hasDetailedEvents
    ? liabilityDuelScore(
        playerDeathMetrics.objectiveExposureWeight,
        benchmarkValue((candidate) => deathMetrics(candidate, players, events, durationSeconds, true).objectiveExposureWeight),
        0.5,
      )
    : null;
  const roleWeights = LIABILITY_WEIGHTS[contribution.role];
  const liabilityValues: Array<{ id: LiabilityDimensionId; value: number | null }> = [
    { id: 'death-cost', value: deathCost },
    { id: 'fight-absence', value: fightAbsenceScore },
    { id: 'resource-conversion-gap', value: resourceConversionGapScore },
    { id: 'objective-exposure', value: objectiveExposure },
  ];
  const availableLiabilities = liabilityValues.filter((dimension): dimension is { id: LiabilityDimensionId; value: number } => dimension.value !== null);
  const availableWeight = availableLiabilities.reduce((total, dimension) => total + roleWeights[dimension.id], 0);
  if (availableWeight === 0) return null;
  const normalizedWeights = normalizeWeights(availableLiabilities.map((dimension) => roleWeights[dimension.id]));
  const liabilityScore = Math.round(availableLiabilities.reduce(
    (total, dimension) => total + dimension.value * roleWeights[dimension.id],
    0,
  ) / availableWeight);

  return {
    contribution,
    liability: {
      score: liabilityScore,
      dimensions: availableLiabilities.map((dimension, index) => ({
        id: dimension.id,
        score: Math.round(dimension.value),
        weight: normalizedWeights[index],
      })),
    },
    balance: contribution.score - liabilityScore,
    metrics: {
      deaths: player.deaths,
      untradedDeaths: options.hasDetailedEvents ? playerDeathMetrics.untradedDeaths : null,
      chainDeaths: options.hasDetailedEvents ? playerDeathMetrics.chainDeaths : null,
      lateDeaths: options.hasDetailedEvents ? playerDeathMetrics.lateDeaths : null,
      objectiveExposureDeaths: options.hasDetailedEvents ? playerDeathMetrics.objectiveExposureDeaths : null,
      objectiveExposureWeight: options.hasDetailedEvents ? roundToTwo(playerDeathMetrics.objectiveExposureWeight) : null,
      killParticipation: Math.round(killParticipationRate(player, players) * 100),
      rawAbsence: percentageOrNull(playerFightParticipation?.rawAbsence ?? null),
      adjustedAbsence: percentageOrNull(playerFightParticipation?.adjustedAbsence ?? null),
      benchmarkRawAbsence: percentageOrNull(benchmarkRawAbsence),
      benchmarkAdjustedAbsence: percentageOrNull(benchmarkAdjustedAbsence),
      eligibleFights: playerFightParticipation?.eligibleFights ?? null,
      participatedFights: playerFightParticipation?.participatedFights ?? null,
      missedFights: playerFightParticipation?.missedFights ?? null,
      objectiveTradeFights: playerFightParticipation?.objectiveTradeFights ?? null,
      resourceShare: Math.round(playerResourceConversion.resourceShare * 100),
      outputShare: Math.round(playerResourceConversion.outputShare * 100),
      resourceConversionGap: Math.round(playerResourceConversion.gap * 100),
    },
  };
}

function playerRole(player: MatchDetailPlayer): PlayerContributionResult['role'] {
  if (player.position !== null && player.position <= 3) return 'core';
  if (player.position !== null && player.position >= 4) return 'support';
  return 'unknown';
}

function weightedAverage(values: WeightedValue[]): number | null {
  const available = values.filter((entry): entry is { value: number; weight: number } => entry.value !== null);
  const totalWeight = available.reduce((total, entry) => total + entry.weight, 0);
  if (totalWeight === 0) return null;
  return available.reduce((total, entry) => total + entry.value * entry.weight, 0) / totalWeight;
}

function duelScore(value: number | null, benchmark: number | null, smoothing: number): number | null {
  if (value === null || benchmark === null) return null;
  return 100 * (Math.max(0, value) + smoothing) / (Math.max(0, value) + Math.max(0, benchmark) + 2 * smoothing);
}

function inverseDuelScore(value: number | null, benchmark: number | null, smoothing: number): number | null {
  return duelScore(benchmark, value, smoothing);
}

function zeroAnchoredDuelScore(value: number | null, benchmark: number | null, smoothing: number): number | null {
  if (value === null || benchmark === null) return null;
  if (value === 0 && benchmark === 0) return 50;
  if (value === 0) return 0;
  if (benchmark === 0) return 100;
  return duelScore(value, benchmark, smoothing);
}

function liabilityDuelScore(value: number | null, benchmark: number | null, smoothing: number): number | null {
  if (value === null || benchmark === null) return null;
  const nonNegativeValue = Math.max(0, value);
  const nonNegativeBenchmark = Math.max(0, benchmark);
  if (nonNegativeValue === 0) return 0;
  return 100 * nonNegativeValue / (nonNegativeValue + nonNegativeBenchmark + smoothing);
}

function participation(value: number, teamTotal: number): number {
  return teamTotal <= 0 ? 0 : value / teamTotal;
}

function teamMetricShares(team: readonly MatchDetailPlayer[], read: (player: MatchDetailPlayer) => number): Array<number | null> {
  const total = sum(team, read);
  return total <= 0 ? team.map(() => null) : team.map((player) => read(player) / total);
}

function efficiency(output: number, resources: number): number {
  return output / Math.max(1, resources);
}

function killParticipationRate(player: MatchDetailPlayer, players: readonly MatchDetailPlayer[]): number {
  const team = players.filter((candidate) => candidate.isRadiant === player.isRadiant);
  const teamKills = sum(team, (candidate) => candidate.kills);
  return Math.min(1, participation(player.kills + player.assists, teamKills));
}

function resourceConversionGap(player: MatchDetailPlayer, players: readonly MatchDetailPlayer[]): { gap: number; resourceShare: number; outputShare: number } {
  const team = players.filter((candidate) => candidate.isRadiant === player.isRadiant);
  const resourceShare = participation(player.netWorth, sum(team, (candidate) => candidate.netWorth));
  const damageShare = participation(player.heroDamage, sum(team, (candidate) => candidate.heroDamage));
  const towerShare = participation(player.towerDamage, sum(team, (candidate) => candidate.towerDamage));
  const assistShare = participation(player.assists, sum(team, (candidate) => candidate.assists));
  const healingShare = participation(player.heroHealing, sum(team, (candidate) => candidate.heroHealing));
  const utilityShare = assistShare * 0.6 + healingShare * 0.4;
  const outputShare = damageShare * 0.6 + towerShare * 0.25 + utilityShare * 0.15;
  return { gap: Math.max(0, resourceShare - outputShare), resourceShare, outputShare };
}

function normalizedResourceConversionGap(gap: number): number {
  const normalizedGap = (gap - RESOURCE_CONVERSION_GAP_DEAD_ZONE)
    / (RESOURCE_CONVERSION_GAP_SATURATION - RESOURCE_CONVERSION_GAP_DEAD_ZONE);
  return 100 * Math.min(1, Math.max(0, normalizedGap));
}

function deathMetrics(
  player: MatchDetailPlayer,
  players: readonly MatchDetailPlayer[],
  events: readonly MatchTimelineEvent[],
  durationSeconds: number | null,
  hasDetailedEvents: boolean,
): {
  weightedCost: number;
  untradedDeaths: number;
  chainDeaths: number;
  lateDeaths: number;
  objectiveExposureDeaths: number;
  objectiveExposureWeight: number;
} {
  const deaths = hasDetailedEvents
    ? [...events.filter((event) => event.type === 'kill' && participantMatchesPlayer(event.target, player))].sort((left, right) => left.time - right.time)
    : [];
  if (!hasDetailedEvents || deaths.length === 0) {
    return { weightedCost: player.deaths, untradedDeaths: 0, chainDeaths: 0, lateDeaths: 0, objectiveExposureDeaths: 0, objectiveExposureWeight: 0 };
  }

  const effectiveDuration = Math.max(durationSeconds ?? 0, ...events.map((event) => event.time), 1);
  let untradedDeaths = 0;
  let chainDeaths = 0;
  let lateDeaths = 0;
  let objectiveExposureDeaths = 0;
  let objectiveExposureWeight = 0;
  let weightedCost = 0;

  for (const [index, death] of deaths.entries()) {
    const phase = Math.min(1, Math.max(0, death.time / effectiveDuration));
    const traded = events.some((event) => event.type === 'kill'
      && event.time >= death.time
      && event.time <= death.time + 15
      && event.isRadiant === player.isRadiant);
    const previousDeath = index === 0 ? null : deaths[index - 1];
    const isChainDeath = previousDeath !== null && death.time - previousDeath.time <= 90;
    const objectiveLink = objectiveExposureLink(death.time, player.isRadiant, events);
    const precedesObjectiveLoss = objectiveLink > 0;
    const isLateDeath = phase >= 0.7;
    const resourceShare = netWorthShareAt(player, players, death.time);

    if (!traded) untradedDeaths += 1;
    if (isChainDeath) chainDeaths += 1;
    if (isLateDeath) lateDeaths += 1;
    if (precedesObjectiveLoss) objectiveExposureDeaths += 1;
    objectiveExposureWeight += objectiveLink;

    weightedCost += (1 + 1.5 * phase ** 2)
      * (0.8 + Math.min(0.6, resourceShare))
      * (traded ? 1 : 1.35)
      * (isChainDeath ? 1.2 : 1)
      * (1 + 0.25 * objectiveLink);
  }

  weightedCost += Math.max(0, player.deaths - deaths.length);

  return { weightedCost, untradedDeaths, chainDeaths, lateDeaths, objectiveExposureDeaths, objectiveExposureWeight };
}

function objectiveExposureLink(deathTime: number, isRadiant: boolean, events: readonly MatchTimelineEvent[]): number {
  return events.reduce((strongestLink, event) => {
    if (event.type !== 'tower' || event.targetIsRadiant !== isRadiant) return strongestLink;
    const delay = event.time - deathTime;
    if (delay < 0 || delay >= OBJECTIVE_EXPOSURE_WINDOW_SECONDS) return strongestLink;
    return Math.max(strongestLink, 1 - delay / OBJECTIVE_EXPOSURE_WINDOW_SECONDS);
  }, 0);
}

function netWorthShareAt(player: MatchDetailPlayer, players: readonly MatchDetailPlayer[], time: number): number {
  const minute = Math.max(0, Math.floor(time / 60));
  const team = players.filter((candidate) => candidate.isRadiant === player.isRadiant);
  const playerNetWorth = player.minuteSeries.netWorth[minute] ?? player.netWorth;
  const teamNetWorth = team.reduce((total, candidate) => total + (candidate.minuteSeries.netWorth[minute] ?? candidate.netWorth), 0);
  return participation(playerNetWorth, teamNetWorth);
}

function participantMatchesPlayer(participant: MatchTimelineParticipant | null, player: MatchDetailPlayer): boolean {
  if (!participant) return false;
  if (participant.accountId !== null && player.accountId !== null) return participant.accountId === player.accountId;
  return participant.heroId !== null && participant.heroId === player.heroId;
}

function sum(players: readonly MatchDetailPlayer[], read: (player: MatchDetailPlayer) => number): number {
  return players.reduce((total, player) => total + read(player), 0);
}

function average(values: Array<number | null>): number | null {
  const available = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return available.length === 0 ? null : available.reduce((total, value) => total + value, 0) / available.length;
}

function normalizeWeights(weights: number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let allocated = 0;
  return weights.map((weight, index) => {
    const normalized = index === weights.length - 1
      ? 100 - allocated
      : Math.round(weight / total * 100);
    allocated += normalized;
    return normalized;
  });
}

function allocateRoundedTotal(players: readonly MatchDetailPlayer[], values: number[], target: number): number[] {
  const allocated = values.map(Math.floor);
  const remaining = target - allocated.reduce((total, value) => total + value, 0);
  const order = values
    .map((value, index) => ({ index, remainder: value - allocated[index], key: players[index].key }))
    .sort((left, right) => right.remainder - left.remainder || left.key.localeCompare(right.key));

  for (let index = 0; index < remaining; index += 1) {
    allocated[order[index].index] += 1;
  }
  return allocated;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentageOrNull(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100);
}
