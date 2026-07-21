import type { MatchDetailPlayer, PlayerLane, PlayerPosition } from './match-detail';

export const LANE_ANALYSIS_MINUTE = 10;

type LaneId = 'top' | 'mid' | 'bottom';
type LaneOutcome = { lane: string; outcome: string };

export type LaneAnalysisPlayer = Pick<
  MatchDetailPlayer,
  'key' | 'isRadiant' | 'heroId' | 'role' | 'position' | 'lane'
> & {
  minuteSeries: Pick<MatchDetailPlayer['minuteSeries'], 'netWorth' | 'lastHits'>;
};

export type LaneAnalysis = {
  id: LaneId;
  label: string;
  radiantPlayers: LaneAnalysisPlayer[];
  direPlayers: LaneAnalysisPlayer[];
  radiantNetWorth: number | null;
  direNetWorth: number | null;
  radiantLastHits: number | null;
  direLastHits: number | null;
  netWorthDelta: number | null;
  providerOutcome: string;
  source: 'calculated' | 'provider' | 'unavailable';
};

type LaneDefinition = {
  id: LaneId;
  label: string;
  radiantLane: PlayerLane;
  direLane: PlayerLane;
  radiantPositions: PlayerPosition[];
  direPositions: PlayerPosition[];
};

const LANE_DEFINITIONS: LaneDefinition[] = [
  {
    id: 'top',
    label: 'Top lane',
    radiantLane: 3,
    direLane: 1,
    radiantPositions: [3, 4],
    direPositions: [1, 5],
  },
  {
    id: 'mid',
    label: 'Mid lane',
    radiantLane: 2,
    direLane: 2,
    radiantPositions: [2],
    direPositions: [2],
  },
  {
    id: 'bottom',
    label: 'Bottom lane',
    radiantLane: 1,
    direLane: 3,
    radiantPositions: [1, 5],
    direPositions: [3, 4],
  },
];

export function buildLaneAnalysis(
  players: readonly LaneAnalysisPlayer[],
  laneOutcomes: readonly LaneOutcome[],
): LaneAnalysis[] {
  return LANE_DEFINITIONS.map((definition) => {
    const radiantPlayers = selectLanePlayers(
      players,
      true,
      definition.radiantLane,
      definition.radiantPositions,
    );
    const direPlayers = selectLanePlayers(
      players,
      false,
      definition.direLane,
      definition.direPositions,
    );
    const radiantNetWorth = sumMinuteMetric(radiantPlayers, 'netWorth');
    const direNetWorth = sumMinuteMetric(direPlayers, 'netWorth');
    const hasCompleteMatchup =
      radiantPlayers.length >= definition.radiantPositions.length &&
      direPlayers.length >= definition.direPositions.length;
    const providerOutcome = laneOutcomes.find((outcome) => outcome.lane === definition.label)?.outcome ?? 'UNKNOWN';
    const hasCalculatedResult = hasCompleteMatchup && radiantNetWorth !== null && direNetWorth !== null;

    return {
      id: definition.id,
      label: definition.label,
      radiantPlayers,
      direPlayers,
      radiantNetWorth,
      direNetWorth,
      radiantLastHits: sumMinuteMetric(radiantPlayers, 'lastHits'),
      direLastHits: sumMinuteMetric(direPlayers, 'lastHits'),
      netWorthDelta: hasCalculatedResult ? radiantNetWorth - direNetWorth : null,
      providerOutcome,
      source: hasCalculatedResult ? 'calculated' : providerOutcome === 'UNKNOWN' ? 'unavailable' : 'provider',
    };
  });
}

export function getLanePlayerMetrics(player: LaneAnalysisPlayer): { netWorth: number | null; lastHits: number | null } {
  return {
    netWorth: minuteMetricValue(player.minuteSeries.netWorth, 'netWorth'),
    lastHits: minuteMetricValue(player.minuteSeries.lastHits, 'lastHits'),
  };
}

function selectLanePlayers(
  players: readonly LaneAnalysisPlayer[],
  isRadiant: boolean,
  lane: PlayerLane,
  positions: PlayerPosition[],
): LaneAnalysisPlayer[] {
  const teamPlayers = players.filter((player) => player.isRadiant === isRadiant);
  const playersOnLane = teamPlayers.filter((player) => player.lane === lane);
  const selectedPlayers = playersOnLane.length > 0
    ? playersOnLane
    : teamPlayers.filter((player) => player.position !== null && positions.includes(player.position));

  return [...selectedPlayers].sort((left, right) => positionOrder(left.position, positions) - positionOrder(right.position, positions));
}

function positionOrder(position: PlayerPosition | null, positions: PlayerPosition[]): number {
  const index = position === null ? -1 : positions.indexOf(position);
  return index === -1 ? positions.length : index;
}

function sumMinuteMetric(
  players: readonly LaneAnalysisPlayer[],
  metric: 'netWorth' | 'lastHits',
): number | null {
  if (players.length === 0) return null;

  const values = players.map((player) => minuteMetricValue(player.minuteSeries[metric], metric));
  let total = 0;
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    total += value;
  }
  return total;
}

function minuteMetricValue(values: number[], metric: 'netWorth' | 'lastHits'): number | null {
  if (metric === 'netWorth') {
    return values[LANE_ANALYSIS_MINUTE] ?? null;
  }

  const valuesThroughMinute = values.slice(0, LANE_ANALYSIS_MINUTE + 1);
  return valuesThroughMinute.length === LANE_ANALYSIS_MINUTE + 1
    ? valuesThroughMinute.reduce((total, value) => total + value, 0)
    : null;
}
