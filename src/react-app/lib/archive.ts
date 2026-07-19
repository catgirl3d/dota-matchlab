import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../../shared/database.types';
import type { ArchiveFilters } from './archive-analytics';

export type ArchiveMatch = {
  dataStatus: 'complete' | 'missing_player_stats';
  matchId: number;
  startTime: number | null;
  durationSeconds: number | null;
  radiantWin: boolean | null;
  gameMode: number | null;
  lobbyType: number | null;
  averageRank: number | null;
  radiantScore: number | null;
  direScore: number | null;
  playerSlot: number | null;
  heroId: number | null;
  heroVariant: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  goldPerMinute: number | null;
  xpPerMinute: number | null;
  lastHits: number | null;
  denies: number | null;
  heroDamage: number | null;
  towerDamage: number | null;
  heroHealing: number | null;
  level: number | null;
  netWorth: number | null;
  leaverStatus: number | null;
  partySize: number | null;
  lane: number | null;
  laneRole: number | null;
  isRoaming: boolean | null;
  won: boolean | null;
};

export type ArchiveSyncState = Pick<
  Tables<'account_match_sync_state'>,
  | 'status'
  | 'history_provider'
  | 'backfill_offset'
  | 'backfill_complete'
  | 'last_attempt_at'
  | 'last_success_at'
  | 'next_retry_at'
  | 'consecutive_failures'
  | 'last_error_message'
  | 'newest_match_id'
  | 'oldest_match_id'
>;

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

export type ArchiveCursor = { startTime: number | null; matchId: number };
export type ArchivePage = { matches: ArchiveMatch[]; nextCursor: ArchiveCursor | null };

type UserSupabaseClient = SupabaseClient<Database>;

export async function fetchArchiveOverview(
  client: UserSupabaseClient,
  trackedAccountId: string,
  filters: ArchiveFilters,
  signal?: AbortSignal,
): Promise<ArchiveOverview> {
  const { data, error } = await client
    .rpc('get_match_archive_overview', archiveFilterArgs(trackedAccountId, filters))
    .abortSignal(signal ?? new AbortController().signal);
  if (error) throw new Error(`Не удалось загрузить обзор архива: ${error.message}`);
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
  if (error) throw new Error(`Не удалось загрузить страницу архива: ${error.message}`);
  return mapPage(data);
}

export function archiveFilterArgs(trackedAccountId: string, filters: ArchiveFilters) {
  return {
    p_tracked_account_id: trackedAccountId,
    p_period: filters.period,
    p_mode: filters.mode,
    p_result: filters.result,
    p_party: filters.party,
    p_position: filters.position,
    p_hero_id: filters.heroId,
  };
}

function mapOverview(value: unknown): ArchiveOverview {
  const record = asRecord(value, 'overview');
  const summary = asRecord(record.summary, 'overview.summary');
  const integrity = asRecord(record.integrity, 'overview.integrity');
  return {
    summary: {
      matches: numberValue(summary.matches), wins: numberValue(summary.wins), losses: numberValue(summary.losses),
      unknownResults: numberValue(summary.unknown_results), winRate: numberValue(summary.win_rate),
      averageKills: numberValue(summary.average_kills), averageDeaths: numberValue(summary.average_deaths),
      averageAssists: numberValue(summary.average_assists), averageKda: numberValue(summary.average_kda),
      averageGpm: numberValue(summary.average_gpm), averageXpm: numberValue(summary.average_xpm),
      averageLastHits: numberValue(summary.average_last_hits), averageDamage: numberValue(summary.average_damage),
      averageDurationMinutes: numberValue(summary.average_duration_minutes), firstMatchAt: nullableNumber(summary.first_match_at), latestMatchAt: nullableNumber(summary.latest_match_at),
    },
    form: arrayValue(record.form).map(formValue),
    modes: mapBreakdowns(record.modes), heroes: mapHeroBreakdowns(record.heroes), positions: mapBreakdowns(record.positions),
    lanes: mapBreakdowns(record.lanes), party: mapBreakdowns(record.party), tempo: mapBreakdowns(record.tempo),
    heroOptions: arrayValue(record.heroOptions).map(numberValue),
    syncState: record.syncState === null || record.syncState === undefined ? null : asRecord(record.syncState, 'overview.syncState') as ArchiveSyncState,
    integrity: { linked: numberValue(integrity.linked), complete: numberValue(integrity.complete), missingStats: numberValue(integrity.missing_stats), missingMatch: numberValue(integrity.missing_match) },
  };
}

function mapPage(value: unknown): ArchivePage {
  const record = asRecord(value, 'page');
  return {
    matches: arrayValue(record.matches).map(mapMatch),
    nextCursor: record.nextCursor === null || record.nextCursor === undefined ? null : mapCursor(record.nextCursor),
  };
}

function mapMatch(value: unknown): ArchiveMatch {
  const row = asRecord(value, 'match');
  return {
    dataStatus: dataStatusValue(row.dataStatus), matchId: numberValue(row.matchId), startTime: nullableNumber(row.startTime), durationSeconds: nullableNumber(row.durationSeconds), radiantWin: nullableBoolean(row.radiantWin), gameMode: nullableNumber(row.gameMode), lobbyType: nullableNumber(row.lobbyType), averageRank: nullableNumber(row.averageRank), radiantScore: nullableNumber(row.radiantScore), direScore: nullableNumber(row.direScore), playerSlot: nullableNumber(row.playerSlot), heroId: nullableNumber(row.heroId), heroVariant: nullableNumber(row.heroVariant), kills: nullableNumber(row.kills), deaths: nullableNumber(row.deaths), assists: nullableNumber(row.assists), goldPerMinute: nullableNumber(row.goldPerMinute), xpPerMinute: nullableNumber(row.xpPerMinute), lastHits: nullableNumber(row.lastHits), denies: nullableNumber(row.denies), heroDamage: nullableNumber(row.heroDamage), towerDamage: nullableNumber(row.towerDamage), heroHealing: nullableNumber(row.heroHealing), level: nullableNumber(row.level), netWorth: nullableNumber(row.netWorth), leaverStatus: nullableNumber(row.leaverStatus), partySize: nullableNumber(row.partySize), lane: nullableNumber(row.lane), laneRole: nullableNumber(row.laneRole), isRoaming: nullableBoolean(row.isRoaming), won: nullableBoolean(row.won),
  };
}

function mapCursor(value: unknown): ArchiveCursor {
  const row = asRecord(value, 'page.nextCursor');
  return { startTime: nullableNumber(row.startTime), matchId: numberValue(row.matchId) };
}

function mapBreakdowns(value: unknown): ArchiveBreakdown[] {
  return arrayValue(value).map((item) => {
    const row = asRecord(item, 'breakdown');
    return { key: stringValue(row.key), label: stringValue(row.label), matches: numberValue(row.matches), wins: numberValue(row.wins), winRate: numberValue(row.winRate) };
  });
}

function mapHeroBreakdowns(value: unknown): ArchiveHeroBreakdown[] {
  return arrayValue(value).map((item) => {
    const row = asRecord(item, 'hero breakdown');
    return {
      key: stringValue(row.key),
      heroId: numberValue(row.heroId),
      matches: numberValue(row.matches),
      wins: numberValue(row.wins),
      winRate: numberValue(row.winRate),
      averageKda: numberValue(row.averageKda),
      averageGpm: numberValue(row.averageGpm),
    };
  });
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Некорректный ответ ${label}`);
  return value as Record<string, unknown>;
}
function arrayValue(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error('Некорректный массив архива'); return value; }
function numberValue(value: unknown): number { if (typeof value !== 'number') throw new Error('Некорректное число архива'); return value; }
function nullableNumber(value: unknown): number | null { return value === null ? null : numberValue(value); }
function stringValue(value: unknown): string { if (typeof value !== 'string') throw new Error('Некорректная строка архива'); return value; }
function nullableBoolean(value: unknown): boolean | null { if (value === null) return null; if (typeof value !== 'boolean') throw new Error('Некорректный флаг архива'); return value; }
function formValue(value: unknown): ArchiveOverview['form'][number] {
  if (value === 'win' || value === 'loss' || value === 'unknown') return value;
  throw new Error('Некорректный результат формы архива');
}
function dataStatusValue(value: unknown): ArchiveMatch['dataStatus'] {
  if (value === 'complete' || value === 'missing_player_stats') return value;
  throw new Error('Некорректный статус данных матча');
}
