import type { ArchiveMatch } from './archive';

export type ArchivePeriod = 'all' | '30d' | '90d' | 'year';
export type ArchiveMode = 'all' | 'ranked' | 'turbo' | 'all-pick';
export type ArchiveResult = 'all' | 'wins' | 'losses';
export type ArchiveParty = 'all' | 'solo' | 'party';
export type ArchivePosition = 'all' | 'carry' | 'mid' | 'offlane' | 'support' | 'hard-support';

export type ArchiveFilters = {
  period: ArchivePeriod;
  mode: ArchiveMode;
  result: ArchiveResult;
  party: ArchiveParty;
  position: ArchivePosition;
  heroId: number | null;
};

export const DEFAULT_ARCHIVE_FILTERS: ArchiveFilters = {
  period: 'all',
  mode: 'all',
  result: 'all',
  party: 'all',
  position: 'all',
  heroId: null,
};

export type ArchiveBreakdown = {
  key: string;
  label: string;
  matches: number;
  wins: number;
  winRate: number;
};

export type HeroBreakdown = ArchiveBreakdown & {
  heroId: number;
  averageKda: number;
  averageGpm: number;
};

export type ArchiveAnalytics = {
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  averageKills: number;
  averageDeaths: number;
  averageAssists: number;
  averageKda: number;
  averageGpm: number;
  averageXpm: number;
  averageLastHits: number;
  averageDamage: number;
  averageDurationMinutes: number;
  firstMatchAt: number | null;
  latestMatchAt: number | null;
  form: Array<'win' | 'loss' | 'unknown'>;
  modes: ArchiveBreakdown[];
  heroes: HeroBreakdown[];
  positions: ArchiveBreakdown[];
  lanes: ArchiveBreakdown[];
  party: ArchiveBreakdown[];
  tempo: ArchiveBreakdown[];
};

const MODE_LABELS: Record<ArchiveMode, string> = {
  all: 'Все режимы',
  ranked: 'Ranked',
  turbo: 'Turbo',
  'all-pick': 'All Pick',
};

const MODE_IDS: Record<Exclude<ArchiveMode, 'all'>, number> = {
  ranked: 22,
  turbo: 23,
  'all-pick': 1,
};

const POSITION_LABELS: Record<ArchivePosition, string> = {
  all: 'Все позиции',
  carry: 'Carry',
  mid: 'Mid',
  offlane: 'Offlane',
  support: 'Soft support',
  'hard-support': 'Hard support',
};

const POSITION_IDS: Record<Exclude<ArchivePosition, 'all'>, number> = {
  carry: 1,
  mid: 2,
  offlane: 3,
  support: 4,
  'hard-support': 5,
};

export function filterArchiveMatches(
  matches: ArchiveMatch[],
  filters: ArchiveFilters,
  now = Date.now(),
): ArchiveMatch[] {
  const cutoff = getPeriodCutoff(filters.period, now);

  return matches.filter((match) => {
    if (cutoff !== null && (match.startTime === null || match.startTime * 1_000 < cutoff)) {
      return false;
    }
    if (
      filters.mode !== 'all' &&
      match.gameMode !== MODE_IDS[filters.mode]
    ) {
      return false;
    }
    if (filters.result === 'wins' && match.won !== true) {
      return false;
    }
    if (filters.result === 'losses' && match.won !== false) {
      return false;
    }
    if (filters.party === 'solo' && !isSolo(match.partySize)) {
      return false;
    }
    if (filters.party === 'party' && !isParty(match.partySize)) {
      return false;
    }
    if (filters.position !== 'all' && match.laneRole !== POSITION_IDS[filters.position]) {
      return false;
    }
    if (filters.heroId !== null && match.heroId !== filters.heroId) {
      return false;
    }
    return true;
  });
}

export function calculateArchiveAnalytics(
  matches: ArchiveMatch[],
  heroNames: Record<number, string> = {},
): ArchiveAnalytics {
  const wins = matches.filter((match) => match.won === true).length;
  const losses = matches.filter((match) => match.won === false).length;
  const totals = matches.reduce(
    (summary, match) => ({
      kills: summary.kills + numberOrZero(match.kills),
      deaths: summary.deaths + numberOrZero(match.deaths),
      assists: summary.assists + numberOrZero(match.assists),
      gpm: summary.gpm + numberOrZero(match.goldPerMinute),
      xpm: summary.xpm + numberOrZero(match.xpPerMinute),
      lastHits: summary.lastHits + numberOrZero(match.lastHits),
      damage: summary.damage + numberOrZero(match.heroDamage),
      duration: summary.duration + numberOrZero(match.durationSeconds),
    }),
    { kills: 0, deaths: 0, assists: 0, gpm: 0, xpm: 0, lastHits: 0, damage: 0, duration: 0 },
  );

  return {
    matches: matches.length,
    wins,
    losses,
    winRate: percentage(wins, matches.length),
    averageKills: average(totals.kills, matches.length),
    averageDeaths: average(totals.deaths, matches.length),
    averageAssists: average(totals.assists, matches.length),
    averageKda: average(
      matches.reduce((sum, match) => sum + kda(match), 0),
      matches.length,
    ),
    averageGpm: Math.round(average(totals.gpm, matches.length)),
    averageXpm: Math.round(average(totals.xpm, matches.length)),
    averageLastHits: Math.round(average(totals.lastHits, matches.length)),
    averageDamage: Math.round(average(totals.damage, matches.length)),
    averageDurationMinutes: roundOne(average(totals.duration, matches.length) / 60),
    firstMatchAt: getFirstMatchAt(matches),
    latestMatchAt: getLatestMatchAt(matches),
    form: matches.slice(0, 20).map((match) => {
      if (match.won === true) return 'win';
      if (match.won === false) return 'loss';
      return 'unknown';
    }),
    modes: buildBreakdown(matches, getModeKey, getModeLabel),
    heroes: buildHeroBreakdown(matches, heroNames),
    positions: buildBreakdown(matches, getPositionKey, getPositionLabel),
    lanes: buildBreakdown(matches, getLaneKey, getLaneLabel),
    party: buildBreakdown(matches, getPartyKey, getPartyLabel),
    tempo: buildBreakdown(matches, getTempoKey, getTempoLabel),
  };
}

function buildBreakdown(
  matches: ArchiveMatch[],
  getKey: (match: ArchiveMatch) => string,
  getLabel: (key: string) => string,
): ArchiveBreakdown[] {
  const buckets = new Map<string, { matches: number; wins: number }>();

  for (const match of matches) {
    const key = getKey(match);
    const bucket = buckets.get(key) ?? { matches: 0, wins: 0 };
    bucket.matches += 1;
    bucket.wins += match.won === true ? 1 : 0;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      label: getLabel(key),
      matches: bucket.matches,
      wins: bucket.wins,
      winRate: percentage(bucket.wins, bucket.matches),
    }))
    .sort((left, right) => right.matches - left.matches);
}

function buildHeroBreakdown(
  matches: ArchiveMatch[],
  heroNames: Record<number, string>,
): HeroBreakdown[] {
  const buckets = new Map<number, { matches: ArchiveMatch[] }>();

  for (const match of matches) {
    if (match.heroId === null) continue;
    const bucket = buckets.get(match.heroId) ?? { matches: [] };
    bucket.matches.push(match);
    buckets.set(match.heroId, bucket);
  }

  return [...buckets.entries()]
    .map(([heroId, bucket]) => {
      const wins = bucket.matches.filter((match) => match.won === true).length;
      return {
        key: String(heroId),
        label: heroNames[heroId] ?? `Hero #${heroId}`,
        heroId,
        matches: bucket.matches.length,
        wins,
        winRate: percentage(wins, bucket.matches.length),
        averageKda: average(
          bucket.matches.reduce((sum, match) => sum + kda(match), 0),
          bucket.matches.length,
        ),
        averageGpm: Math.round(
          average(
            bucket.matches.reduce(
              (sum, match) => sum + numberOrZero(match.goldPerMinute),
              0,
            ),
            bucket.matches.length,
          ),
        ),
      };
    })
    .sort((left, right) => right.matches - left.matches || right.winRate - left.winRate);
}

function getPeriodCutoff(period: ArchivePeriod, now: number): number | null {
  const days = period === '30d' ? 30 : period === '90d' ? 90 : period === 'year' ? 365 : null;
  return days === null ? null : now - days * 86_400_000;
}

function getModeKey(match: ArchiveMatch): string {
  if (match.gameMode === MODE_IDS.ranked) return 'ranked';
  if (match.gameMode === MODE_IDS.turbo) return 'turbo';
  if (match.gameMode === MODE_IDS['all-pick']) return 'all-pick';
  return 'other';
}

function getModeLabel(key: string): string {
  return key === 'other' ? 'Other' : MODE_LABELS[key as ArchiveMode] ?? key;
}

function getPositionKey(match: ArchiveMatch): string {
  const position = Object.entries(POSITION_IDS).find(([, id]) => id === match.laneRole);
  return position?.[0] ?? 'unknown';
}

function getPositionLabel(key: string): string {
  return key === 'unknown'
    ? 'Unknown position'
    : POSITION_LABELS[key as ArchivePosition] ?? key;
}

function getLaneKey(match: ArchiveMatch): string {
  if (match.lane === 1) return 'safe';
  if (match.lane === 2) return 'mid';
  if (match.lane === 3) return 'offlane';
  return 'unknown';
}

function getLaneLabel(key: string): string {
  return { safe: 'Safe lane', mid: 'Mid lane', offlane: 'Off lane', unknown: 'Unknown lane' }[key] ?? key;
}

function getPartyKey(match: ArchiveMatch): string {
  if (isSolo(match.partySize)) return 'solo';
  if (isParty(match.partySize)) return 'party';
  return 'unknown';
}

function getPartyLabel(key: string): string {
  return { solo: 'Solo', party: 'Party', unknown: 'Unknown' }[key] ?? key;
}

function getTempoKey(match: ArchiveMatch): string {
  const minutes = numberOrZero(match.durationSeconds) / 60;
  if (minutes < 30) return 'early';
  if (minutes >= 40) return 'late';
  return 'standard';
}

function getTempoLabel(key: string): string {
  return { early: 'Under 30 min', standard: '30–40 min', late: '40+ min' }[key] ?? key;
}

export function getModeLabelForFilter(mode: ArchiveMode): string {
  return MODE_LABELS[mode];
}

export function getPositionLabelForFilter(position: ArchivePosition): string {
  return POSITION_LABELS[position];
}

export function isSolo(partySize: number | null): boolean {
  return partySize === 0 || partySize === 1;
}

export function isParty(partySize: number | null): boolean {
  return partySize !== null && partySize > 1;
}

function kda(match: ArchiveMatch): number {
  return (
    (numberOrZero(match.kills) + numberOrZero(match.assists)) /
    Math.max(numberOrZero(match.deaths), 1)
  );
}

function getFirstMatchAt(matches: ArchiveMatch[]): number | null {
  return matches.reduce<number | null>(
    (oldest, match) =>
      match.startTime !== null && (oldest === null || match.startTime < oldest)
        ? match.startTime
        : oldest,
    null,
  );
}

function getLatestMatchAt(matches: ArchiveMatch[]): number | null {
  return matches.reduce<number | null>(
    (latest, match) =>
      match.startTime !== null && (latest === null || match.startTime > latest)
        ? match.startTime
        : latest,
    null,
  );
}

function numberOrZero(value: number | null): number {
  return value ?? 0;
}

function average(total: number, count: number): number {
  return count === 0 ? 0 : roundOne(total / count);
}

function percentage(wins: number, matches: number): number {
  return matches === 0 ? 0 : roundOne((wins / matches) * 100);
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}
