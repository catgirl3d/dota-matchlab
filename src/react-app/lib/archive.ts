import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppDatabase } from '../../shared/app-database';
import {
  parseArchiveOverview,
  parseArchivePage,
  parseArchiveShowcaseOverview,
  parseArchiveShowcaseSlug,
  type ArchiveCursorProjection,
  type ArchiveMatchProjection,
  type ArchivePageProjection,
  type ArchiveSyncStateProjection,
} from '../../shared/contracts/archive-rpc';
import type { ArchiveFilters } from './archive-analytics';

export type ArchiveMatch = ArchiveMatchProjection;
export type ArchiveSyncState = ArchiveSyncStateProjection;

export type ArchiveBreakdown = {
  key: string;
  label: string;
  matches: number;
  wins: number;
  winRate: number;
};

export type ArchiveHeroBreakdown = Omit<ArchiveBreakdown, 'label'> & {
  heroId: number;
  averageKda: number;
  averageGpm: number;
};

export type ArchiveOverview = {
  summary: {
    matches: number;
    wins: number;
    losses: number;
    unknownResults: number;
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
  };
  form: Array<'win' | 'loss' | 'unknown'>;
  modes: ArchiveBreakdown[];
  heroes: ArchiveHeroBreakdown[];
  positions: ArchiveBreakdown[];
  lanes: ArchiveBreakdown[];
  party: ArchiveBreakdown[];
  tempo: ArchiveBreakdown[];
  heroOptions: number[];
  syncState: ArchiveSyncState | null;
  integrity: { linked: number; complete: number; missingStats: number; missingMatch: number };
};

export type ArchiveCursor = ArchiveCursorProjection;
export type ArchivePage = ArchivePageProjection;
export type ArchiveShowcaseOverview = {
  account: {
    dotaAccountId: number;
    personaName: string | null;
    avatarUrl: string | null;
    rankTier: number | null;
    profileRefreshedAt: string | null;
  };
  overview: ArchiveOverview;
};

type UserSupabaseClient = SupabaseClient<AppDatabase>;

export async function fetchArchiveOverview(
  client: UserSupabaseClient,
  trackedAccountId: string,
  filters: ArchiveFilters,
  signal?: AbortSignal,
): Promise<ArchiveOverview> {
  const { data, error } = await client
    .rpc('get_match_archive_overview', archiveFilterArgs(trackedAccountId, filters))
    .abortSignal(signal ?? new AbortController().signal);
  if (error) throw new Error(`Failed to load archive overview: ${error.message}`);
  return mapOverview(data);
}

export async function fetchArchivePage(
  client: UserSupabaseClient,
  trackedAccountId: string,
  filters: ArchiveFilters,
  cursor: ArchiveCursor | null,
  signal?: AbortSignal,
): Promise<ArchivePage> {
  const { data, error } = await client
    .rpc('get_match_archive_page', {
      ...archiveFilterArgs(trackedAccountId, filters),
      p_cursor_start_time: cursor?.startTime ?? null,
      p_cursor_match_id: cursor?.matchId ?? null,
      p_limit: 100,
    })
    .abortSignal(signal ?? new AbortController().signal);
  if (error) throw new Error(`Failed to load archive page: ${error.message}`);
  return mapPage(data);
}

export async function fetchArchiveShowcaseOverview(
  client: UserSupabaseClient,
  dotaAccountId: number,
  filters: ArchiveFilters,
  signal?: AbortSignal,
): Promise<ArchiveShowcaseOverview | null> {
  const { data, error } = await client
    .rpc('get_archive_showcase_overview', archiveShowcaseFilterArgs(dotaAccountId, filters))
    .abortSignal(signal ?? new AbortController().signal);
  if (error) throw new Error(`Failed to load public archive: ${error.message}`);
  if (data === null) return null;
  const record = parseArchiveShowcaseOverview(data);
  const account = record.account;
  return {
    account: {
      dotaAccountId: account.dotaAccountId,
      personaName: account.personaName,
      avatarUrl: account.avatarUrl,
      rankTier: account.rankTier,
      profileRefreshedAt: account.profileRefreshedAt,
    },
    overview: mapOverview(record.overview),
  };
}

export async function fetchArchiveShowcasePage(
  client: UserSupabaseClient,
  dotaAccountId: number,
  filters: ArchiveFilters,
  cursor: ArchiveCursor | null,
  signal?: AbortSignal,
): Promise<ArchivePage | null> {
  const { data, error } = await client
    .rpc('get_archive_showcase_page', {
      ...archiveShowcaseFilterArgs(dotaAccountId, filters),
      p_cursor_start_time: cursor?.startTime ?? null,
      p_cursor_match_id: cursor?.matchId ?? null,
      p_limit: 100,
    })
    .abortSignal(signal ?? new AbortController().signal);
  if (error) throw new Error(`Failed to load public showcase page: ${error.message}`);
  return data === null ? null : mapPage(data);
}

export async function resolveArchiveShowcase(
  client: UserSupabaseClient,
  slug: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const { data, error } = await client
    .rpc('resolve_archive_showcase', { p_slug: slug })
    .abortSignal(signal ?? new AbortController().signal);
  if (error) throw new Error(`Could not open public archive: ${error.message}`);
  return data === null ? null : parseArchiveShowcaseSlug(data);
}

export function archiveFilterArgs(trackedAccountId: string, filters: ArchiveFilters) {
  return {
    p_tracked_account_id: trackedAccountId,
    ...archiveFilterValues(filters),
  };
}

function archiveFilterValues(filters: ArchiveFilters) {
  return {
    p_period: filters.period,
    p_mode: filters.mode,
    p_result: filters.result,
    p_party: filters.party,
    p_position: filters.position,
    p_hero_id: filters.heroId,
    p_start_date: filters.period === 'custom' ? filters.startDate : null,
    p_end_date: filters.period === 'custom' ? filters.endDate : null,
  };
}

export function archiveShowcaseFilterArgs(dotaAccountId: number, filters: ArchiveFilters) {
  return { p_dota_account_id: dotaAccountId, ...archiveFilterValues(filters) };
}

function mapOverview(value: unknown): ArchiveOverview {
  const record = parseArchiveOverview(value);
  const { summary, integrity } = record;
  return {
    summary: {
      matches: summary.matches, wins: summary.wins, losses: summary.losses,
      unknownResults: summary.unknown_results, winRate: summary.win_rate,
      averageKills: summary.average_kills, averageDeaths: summary.average_deaths,
      averageAssists: summary.average_assists, averageKda: summary.average_kda,
      averageGpm: summary.average_gpm, averageXpm: summary.average_xpm,
      averageLastHits: summary.average_last_hits, averageDamage: summary.average_damage,
      averageDurationMinutes: summary.average_duration_minutes, firstMatchAt: summary.first_match_at, latestMatchAt: summary.latest_match_at,
    },
    form: record.form,
    modes: record.modes, heroes: record.heroes, positions: record.positions,
    lanes: record.lanes, party: record.party, tempo: record.tempo,
    heroOptions: record.heroOptions,
    syncState: record.syncState,
    integrity: { linked: integrity.linked, complete: integrity.complete, missingStats: integrity.missing_stats, missingMatch: integrity.missing_match },
  };
}

function mapPage(value: unknown): ArchivePage {
  return parseArchivePage(value);
}
