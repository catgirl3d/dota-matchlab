import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from '../../shared/database.types';
import type { MatchSyncResult } from '../../shared/match-archive';
import {
  HISTORY_PAGE_SIZE,
  loadPlayerMatchesPage,
  type ArchivedPlayerMatch,
  OpenDotaError,
} from './opendota';

type RpcResponse = {
  data: Json | null;
  error: { message: string } | null;
};

type ClaimMatchSyncArgs = {
  p_actor_user_id: string;
  p_tracked_account_id: string;
  p_lease_seconds: number;
};

type ApplyMatchSyncPageArgs = {
  p_actor_user_id: string;
  p_tracked_account_id: string;
  p_dota_account_id: number;
  p_lease_token: string;
  p_matches: Json;
  p_next_offset: number;
  p_backfill_complete: boolean;
  p_backfill_upper_bound_match_id: number;
};

type RecordMatchSyncFailureArgs = {
  p_actor_user_id: string;
  p_tracked_account_id: string;
  p_dota_account_id: number;
  p_lease_token: string;
  p_error_code: string;
  p_error_message: string;
};

type ArchiveRpcClient = {
  claimMatchSync(args: ClaimMatchSyncArgs): Promise<RpcResponse>;
  applyMatchSyncPageWithBoundary(
    args: ApplyMatchSyncPageArgs,
  ): Promise<RpcResponse>;
  recordMatchSyncFailure(args: RecordMatchSyncFailureArgs): Promise<RpcResponse>;
};

type MatchArchiveDependencies = {
  createClient: (env: Env) => ArchiveRpcClient;
  loadPlayerMatchesPage: typeof loadPlayerMatchesPage;
};

export class MatchArchiveError extends Error {
  readonly statusCode: 404 | 409 | 502 | 504;

  constructor(message: string, statusCode: 404 | 409 | 502 | 504) {
    super(message);
    this.name = 'MatchArchiveError';
    this.statusCode = statusCode;
  }
}

const defaultDependencies: MatchArchiveDependencies = {
  createClient: createArchiveRpcClient,
  loadPlayerMatchesPage,
};

export async function syncTrackedAccount(
  env: Env,
  actorUserId: string,
  trackedAccountId: string,
  dependencies: MatchArchiveDependencies = defaultDependencies,
): Promise<MatchSyncResult> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new MatchArchiveError('Архив матчей не настроен на Worker', 502);
  }

  const archiveClient = dependencies.createClient(env);
  const claimResponse = await archiveClient.claimMatchSync({
    p_actor_user_id: actorUserId,
    p_tracked_account_id: trackedAccountId,
    p_lease_seconds: 300,
  });
  const claim = readRpcData(claimResponse, 'Не удалось начать синхронизацию архива');

  if (!readBoolean(claim.owned)) {
    throw new MatchArchiveError('Отслеживаемый аккаунт не найден', 404);
  }
  if (!readBoolean(claim.claimed)) {
    const status = readString(claim.status);
    if (status === 'failed') {
      throw new MatchArchiveError(
        'Синхронизация временно приостановлена из-за ошибки OpenDota',
        409,
      );
    }
    throw new MatchArchiveError(
      'Синхронизация этого аккаунта уже выполняется',
      409,
    );
  }

  const accountId = readRequiredInteger(claim.dotaAccountId, 'accountId');
  const offset = readRequiredInteger(claim.offset, 'offset');
  const leaseToken = readRequiredString(claim.leaseToken, 'leaseToken');
  const claimedUpperBound = readNullableInteger(
    claim.backfillUpperBoundMatchId,
    'backfillUpperBoundMatchId',
  );

  try {
    const page = await dependencies.loadPlayerMatchesPage(
      env.OPENDOTA_BASE_URL,
      accountId,
      offset,
      HISTORY_PAGE_SIZE,
    );
    const upperBound = claimedUpperBound ?? getPageUpperBound(page);
    const boundedMatches = upperBound === null
      ? page.matches
      : page.matches.filter((match) => Number(match.matchId) <= upperBound);
    const backfillComplete = !page.hasMore;
    const nextOffset = backfillComplete ? 0 : page.nextOffset;
    const applyResponse = await archiveClient.applyMatchSyncPageWithBoundary({
      p_actor_user_id: actorUserId,
      p_tracked_account_id: trackedAccountId,
      p_dota_account_id: accountId,
      p_lease_token: leaseToken,
      p_matches: boundedMatches.map(toArchiveRpcMatch),
      p_next_offset: nextOffset,
      p_backfill_complete: backfillComplete,
      // Supabase's generated RPC types do not represent nullable arguments.
      // Zero is outside the valid match ID range and is translated to NULL in SQL.
      p_backfill_upper_bound_match_id: upperBound ?? 0,
    });
    const applied = readRpcData(
      applyResponse,
      'Не удалось сохранить страницу архива',
    );

    return {
      trackedAccountId,
      accountId,
      fetchedMatches: boundedMatches.length,
      archivedMatches: readRequiredInteger(applied.archivedMatches, 'archivedMatches'),
      status: readStatus(applied.status),
      backfillComplete: readRequiredBoolean(
        applied.backfillComplete,
        'backfillComplete',
      ),
      nextOffset: readRequiredInteger(applied.nextOffset, 'nextOffset'),
    };
  } catch (error) {
    await recordSyncFailure(
      archiveClient,
      actorUserId,
      trackedAccountId,
      accountId,
      leaseToken,
      error,
    );

    if (error instanceof MatchArchiveError || error instanceof OpenDotaError) {
      throw error;
    }

    throw new MatchArchiveError('Не удалось синхронизировать архив матчей', 502);
  }
}

function createArchiveRpcClient(env: Env): ArchiveRpcClient {
  const client = createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );

  return {
    claimMatchSync: async (args) => client.rpc('claim_match_sync', args),
    applyMatchSyncPageWithBoundary: async (args) =>
      client.rpc('apply_match_sync_page_with_boundary', args),
    recordMatchSyncFailure: async (args) =>
      client.rpc('record_match_sync_failure', args),
  };
}

async function recordSyncFailure(
  archiveClient: ArchiveRpcClient,
  actorUserId: string,
  trackedAccountId: string,
  accountId: number,
  leaseToken: string,
  error: unknown,
): Promise<void> {
  const errorCode = getSyncErrorCode(error);
  const errorMessage = getSyncErrorMessage(error);
  try {
    const response = await archiveClient.recordMatchSyncFailure({
      p_actor_user_id: actorUserId,
      p_tracked_account_id: trackedAccountId,
      p_dota_account_id: accountId,
      p_lease_token: leaseToken,
      p_error_code: errorCode,
      p_error_message: errorMessage,
    });

    if (!response.error) {
      return;
    }

    console.error(
      JSON.stringify({
        message: 'Could not record match sync failure',
        error: response.error.message,
        errorCode,
      }),
    );
  } catch (recordError) {
    console.error(
      JSON.stringify({
        message: 'Could not record match sync failure',
        error:
          recordError instanceof Error ? recordError.message : String(recordError),
        errorCode,
      }),
    );
  }
}

function toArchiveRpcMatch(match: ArchivedPlayerMatch): Json {
  return {
    match_id: Number(match.matchId),
    start_time: match.startTime,
    duration: match.durationSeconds,
    radiant_win: match.radiantWin,
    game_mode: match.gameMode,
    lobby_type: match.lobbyType,
    average_rank: match.averageRank,
    cluster: match.cluster,
    version: match.version,
    radiant_team_id: match.radiantTeamId,
    dire_team_id: match.direTeamId,
    league_id: match.leagueId,
    series_id: match.seriesId,
    series_type: match.seriesType,
    radiant_score: match.radiantScore,
    dire_score: match.direScore,
    player_slot: match.playerSlot,
    hero_id: match.heroId,
    hero_variant: match.heroVariant,
    kills: match.kills,
    deaths: match.deaths,
    assists: match.assists,
    gold_per_min: match.goldPerMinute,
    xp_per_min: match.xpPerMinute,
    last_hits: match.lastHits,
    denies: match.denies,
    hero_damage: match.heroDamage,
    tower_damage: match.towerDamage,
    hero_healing: match.heroHealing,
    level: match.level,
    net_worth: match.netWorth,
    leaver_status: match.leaverStatus,
    party_size: match.partySize,
    lane: match.lane,
    lane_role: match.laneRole,
    is_roaming: match.isRoaming,
  };
}

function readRpcData(response: RpcResponse, fallbackMessage: string): JsonObject {
  if (response.error) {
    console.error(
      JSON.stringify({
        message: 'Archive RPC failed',
        error: response.error.message,
        fallbackMessage,
      }),
    );
    throw new MatchArchiveError(fallbackMessage, 502);
  }
  if (!isObject(response.data)) {
    throw new MatchArchiveError(fallbackMessage, 502);
  }
  return response.data;
}

function readRequiredString(value: Json | undefined, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new MatchArchiveError(`Архив вернул некорректное поле ${fieldName}`, 502);
  }
  return value;
}

function readRequiredInteger(value: Json | undefined, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new MatchArchiveError(`Архив вернул некорректное поле ${fieldName}`, 502);
  }
  return value;
}

function readNullableInteger(
  value: Json | undefined,
  fieldName: string,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return readRequiredInteger(value, fieldName);
}

function readBoolean(value: Json | undefined): boolean {
  return value === true;
}

function readString(value: Json | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readRequiredBoolean(
  value: Json | undefined,
  fieldName: string,
): boolean {
  if (typeof value !== 'boolean') {
    throw new MatchArchiveError(`Архив вернул некорректное поле ${fieldName}`, 502);
  }
  return value;
}

function readStatus(value: Json | undefined): 'partial' | 'ready' {
  if (value === 'partial' || value === 'ready') {
    return value;
  }
  throw new MatchArchiveError('Архив вернул некорректный статус', 502);
}

function getSyncErrorCode(error: unknown): string {
  if (error instanceof OpenDotaError) {
    return `OPEN_DOTA_${error.statusCode}`;
  }
  if (error instanceof MatchArchiveError) {
    return 'ARCHIVE_ERROR';
  }
  return 'ARCHIVE_APPLY_FAILED';
}

function getSyncErrorMessage(error: unknown): string {
  if (error instanceof OpenDotaError || error instanceof MatchArchiveError) {
    return error.message;
  }
  return 'Неизвестная ошибка синхронизации';
}

function getPageUpperBound(page: { matches: ArchivedPlayerMatch[] }): number | null {
  let upperBound: number | null = null;
  for (const match of page.matches) {
    const matchId = Number(match.matchId);
    if (upperBound === null || matchId > upperBound) {
      upperBound = matchId;
    }
  }
  return upperBound;
}

type JsonObject = { [key: string]: Json | undefined };

function isObject(value: Json | null): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
