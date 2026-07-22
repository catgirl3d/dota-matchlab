import type { MatchDetailPlayer, PlayerPosition } from './match-detail';

export type RoleBreakdownPlayer = Pick<
  MatchDetailPlayer,
  | 'key'
  | 'isRadiant'
  | 'heroId'
  | 'position'
  | 'kills'
  | 'deaths'
  | 'assists'
  | 'netWorth'
  | 'xpPerMinute'
  | 'lastHits'
  | 'denies'
  | 'minuteSeries'
  | 'combatEvents'
>;

export type RoleBreakdownPeriod = 'full' | 10 | 20;

export type RoleBreakdownPerformance = {
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  netWorth: number | null;
  experience: number | null;
  lastHits: number | null;
  denies: number | null;
};

export type RoleBreakdown = {
  position: PlayerPosition;
  label: string;
  radiantPlayers: RoleBreakdownPlayer[];
  direPlayers: RoleBreakdownPlayer[];
};

const ROLE_DEFINITIONS: Array<Pick<RoleBreakdown, 'position' | 'label'>> = [
  { position: 1, label: 'Carry' },
  { position: 2, label: 'Mid' },
  { position: 3, label: 'Offlane' },
  { position: 4, label: 'Soft support' },
  { position: 5, label: 'Hard support' },
];

export function buildRoleBreakdown(players: readonly RoleBreakdownPlayer[]): RoleBreakdown[] {
  return ROLE_DEFINITIONS.map((definition) => ({
    ...definition,
    radiantPlayers: selectRolePlayers(players, true, definition.position),
    direPlayers: selectRolePlayers(players, false, definition.position),
  }));
}

export function getRoleBreakdownPerformance(
  player: RoleBreakdownPlayer | null,
  period: RoleBreakdownPeriod,
): RoleBreakdownPerformance | null {
  if (player === null) return null;

  if (period === 'full') {
    return {
      kills: player.kills,
      deaths: player.deaths,
      assists: player.assists,
      netWorth: player.netWorth,
      experience: player.xpPerMinute,
      lastHits: player.lastHits,
      denies: player.denies,
    };
  }

  if (player.minuteSeries.netWorth.length <= period) {
    return {
      kills: null,
      deaths: null,
      assists: null,
      netWorth: null,
      experience: null,
      lastHits: null,
      denies: null,
    };
  }

  return {
    kills: countEventsThroughMinute(player.combatEvents.kills, period),
    deaths: countEventsThroughMinute(player.combatEvents.deaths, period),
    assists: countEventsThroughMinute(player.combatEvents.assists, period),
    netWorth: player.minuteSeries.netWorth[period] ?? null,
    experience: sumMinuteSeriesThrough(player.minuteSeries.experience, period),
    lastHits: sumMinuteSeriesThrough(player.minuteSeries.lastHits, period),
    denies: sumMinuteSeriesThrough(player.minuteSeries.denies, period),
  };
}

function selectRolePlayers(
  players: readonly RoleBreakdownPlayer[],
  isRadiant: boolean,
  position: PlayerPosition,
): RoleBreakdownPlayer[] {
  return players.filter((player) => player.isRadiant === isRadiant && player.position === position);
}

function countEventsThroughMinute(events: readonly { time: number }[], minute: number): number {
  return events.filter((event) => event.time <= minute * 60).length;
}

function sumMinuteSeriesThrough(values: readonly number[], minute: number): number | null {
  const valuesThroughMinute = values.slice(0, minute + 1);
  if (valuesThroughMinute.length !== minute + 1 || valuesThroughMinute.some((value) => !Number.isFinite(value))) {
    return null;
  }
  return valuesThroughMinute.reduce((total, value) => total + value, 0);
}
