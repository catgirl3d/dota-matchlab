import type { RecentDotaMatch } from '../../shared/dota';

export type MatchSummary = {
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  averageKills: number;
  averageDeaths: number;
  averageAssists: number;
  averageGpm: number;
};

export function calculateMatchSummary(matches: RecentDotaMatch[]): MatchSummary {
  if (matches.length === 0) {
    return {
      matches: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      averageKills: 0,
      averageDeaths: 0,
      averageAssists: 0,
      averageGpm: 0,
    };
  }

  const totals = matches.reduce(
    (summary, match) => ({
      wins: summary.wins + (match.won ? 1 : 0),
      kills: summary.kills + match.kills,
      deaths: summary.deaths + match.deaths,
      assists: summary.assists + match.assists,
      gpm: summary.gpm + match.goldPerMinute,
    }),
    { wins: 0, kills: 0, deaths: 0, assists: 0, gpm: 0 },
  );

  return {
    matches: matches.length,
    wins: totals.wins,
    losses: matches.length - totals.wins,
    winRate: roundToOneDecimal((totals.wins / matches.length) * 100),
    averageKills: roundToOneDecimal(totals.kills / matches.length),
    averageDeaths: roundToOneDecimal(totals.deaths / matches.length),
    averageAssists: roundToOneDecimal(totals.assists / matches.length),
    averageGpm: Math.round(totals.gpm / matches.length),
  };
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
