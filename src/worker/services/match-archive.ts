import { createClient, type PostgrestSingleResponse } from '@supabase/supabase-js';
import * as v from 'valibot';
import type { Json } from '../../shared/database.types';
import type { AppDatabase } from '../../shared/app-database';
import {
  HistorySyncApplyResponseSchema,
  HistorySyncClaimSchema,
  RecordMatchSyncFailureResponseSchema,
  type HistorySyncApplyResponse,
  type HistorySyncClaim,
  type RecordMatchSyncFailureResponse,
} from '../../shared/contracts/history-rpc';
import type { MatchSyncResult } from '../../shared/match-archive';
import {
  HISTORY_PAGE_SIZE,
  loadPlayerMatchesPage,
  OpenDotaError,
} from './opendota';
import {
  loadStratzPlayerMatchesBatch,
  StratzError,
} from './stratz';
import type {
  ArchivedPlayerMatch,
  MatchHistoryProvider,
  PlayerMatchesPage,
} from './match-provider';

type ClaimMatchSyncArgs = AppDatabase['public']['Functions']['claim_match_sync_for_provider']['Args'];
type ApplyMatchSyncPageArgs = AppDatabase['public']['Functions']['apply_match_sync_page_with_boundary_source_and_payloads']['Args'];
type RecordMatchSyncFailureArgs = AppDatabase['public']['Functions']['record_match_sync_failure']['Args'];

type ArchiveRpcClient = {
  claimMatchSyncForProvider(args: ClaimMatchSyncArgs): Promise<PostgrestSingleResponse<HistorySyncClaim>>;
  applyMatchSyncPageWithBoundarySourceAndPayloads(
    args: ApplyMatchSyncPageArgs,
  ): Promise<PostgrestSingleResponse<HistorySyncApplyResponse>>;
  recordMatchSyncFailure(args: RecordMatchSyncFailureArgs): Promise<PostgrestSingleResponse<RecordMatchSyncFailureResponse>>;
};

type MatchArchiveDependencies = {
  createClient: (env: Env) => ArchiveRpcClient;
  loadOpenDotaPlayerMatchesPage: typeof loadPlayerMatchesPage;
  loadStratzPlayerMatchesBatch?: typeof loadStratzPlayerMatchesBatch;
};

export class MatchArchiveError extends Error {
  readonly statusCode: 404 | 409 | 502 | 504;
  readonly code: string;

  constructor(message: string, statusCode: 404 | 409 | 502 | 504, code: string) {
    super(message);
    this.name = 'MatchArchiveError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const defaultDependencies: MatchArchiveDependencies = {
  createClient: createArchiveRpcClient,
  loadOpenDotaPlayerMatchesPage: loadPlayerMatchesPage,
  loadStratzPlayerMatchesBatch,
};

export async function syncTrackedAccount(
  env: Env,
  actorUserId: string,
  trackedAccountId: string,
  dependencies: MatchArchiveDependencies = defaultDependencies,
): Promise<MatchSyncResult> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new MatchArchiveError('Match archive is not configured on Worker', 502, 'MATCH_ARCHIVE_NOT_CONFIGURED');
  }

  const archiveClient = dependencies.createClient(env);
  const preferredProvider: MatchHistoryProvider = env.STRATZ_API_TOKEN.trim()
    ? 'stratz'
    : 'opendota';
  const claimResponse = await archiveClient.claimMatchSyncForProvider({
    p_actor_user_id: actorUserId,
    p_tracked_account_id: trackedAccountId,
    p_lease_seconds: 300,
    p_history_provider: preferredProvider,
  });
  const claim = readHistorySyncClaim(claimResponse);

  if (!claim.owned) {
    throw new MatchArchiveError('Tracked account not found', 404, 'MATCH_ARCHIVE_ACCOUNT_NOT_FOUND');
  }
  if (!claim.claimed) {
    if (claim.status === 'failed') {
      throw new MatchArchiveError(
        'Synchronization is temporarily suspended due to provider error',
        409,
        'MATCH_ARCHIVE_SYNC_SUSPENDED',
      );
    }
    throw new MatchArchiveError(
      'Synchronization for this account is already in progress',
      409,
      'MATCH_ARCHIVE_SYNC_IN_PROGRESS',
    );
  }

  const accountId = claim.dotaAccountId;
  const offset = claim.offset;
  const leaseToken = claim.leaseToken;
  const provider = claim.historyProvider;
  const claimedUpperBound = claim.backfillUpperBoundMatchId;

  try {
    const page = await loadProviderPage(
      env,
      provider,
      accountId,
      offset,
      dependencies,
    );
    const upperBound = claimedUpperBound ?? getPageUpperBound(page);
    const boundedMatches = upperBound === null
      ? page.matches
      : page.matches.filter((match) => Number(match.matchId) <= upperBound);
    const backfillComplete = !page.hasMore;
    const nextOffset = backfillComplete ? 0 : page.nextOffset;
    const applyResponse = await archiveClient.applyMatchSyncPageWithBoundarySourceAndPayloads({
      p_actor_user_id: actorUserId,
      p_tracked_account_id: trackedAccountId,
      p_dota_account_id: accountId,
      p_lease_token: leaseToken,
      p_matches: boundedMatches.map((match) => toArchiveRpcMatch(match, provider)),
      p_next_offset: nextOffset,
      p_backfill_complete: backfillComplete,
      // Supabase's generated RPC types do not represent nullable arguments.
      // Zero is outside the valid match ID range and is translated to NULL in SQL.
      p_backfill_upper_bound_match_id: upperBound ?? 0,
      p_source: provider,
      p_payloads: boundedMatches.map((match) => toArchiveRpcPayload(match, provider)),
    });
    const applied = readHistorySyncApplyResponse(applyResponse);

    return {
      trackedAccountId,
      accountId,
      fetchedMatches: boundedMatches.length,
      archivedMatches: applied.archivedMatches,
      status: applied.status,
      backfillComplete: applied.backfillComplete,
      nextOffset: applied.nextOffset,
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

    if (
      error instanceof MatchArchiveError ||
      error instanceof OpenDotaError ||
      error instanceof StratzError
    ) {
      throw error;
    }

    throw new MatchArchiveError('Failed to synchronize match archive', 502, 'MATCH_ARCHIVE_SYNC_FAILED');
  }
}

function createArchiveRpcClient(env: Env): ArchiveRpcClient {
  const client = createClient<AppDatabase>(
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
    claimMatchSyncForProvider: async (args) =>
      client.rpc('claim_match_sync_for_provider', args),
    applyMatchSyncPageWithBoundarySourceAndPayloads: async (args) =>
      client.rpc('apply_match_sync_page_with_boundary_source_and_payloads', args),
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
      const recorded = readRecordMatchSyncFailureResponse(response);
      if (!recorded.recorded) {
        throw new MatchArchiveError(
          'Match sync failure was not recorded',
          502,
          'MATCH_ARCHIVE_RECORD_FAILURE_FAILED',
        );
      }
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

function toArchiveRpcMatch(
  match: ArchivedPlayerMatch,
  source: MatchHistoryProvider,
): Json {
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
    source,
  };
}

function toArchiveRpcPayload(
  match: ArchivedPlayerMatch,
  provider: MatchHistoryProvider,
): Json {
  return {
    match_id: Number(match.matchId),
    provider,
    payload_kind: match.rawPayloadKind,
    payload_section: 'match',
    payload: match.rawPayload,
    schema_version: match.rawPayloadSchemaVersion,
  };
}

function readHistorySyncClaim(response: PostgrestSingleResponse<HistorySyncClaim>): HistorySyncClaim {
  const data = readRpcData(response, 'Failed to initiate archive synchronization', 'MATCH_ARCHIVE_SYNC_INITIATION_FAILED');
  const parsed = v.safeParse(HistorySyncClaimSchema, data);
  if (!parsed.success) {
    throw new MatchArchiveError('Archive returned invalid claim response', 502, 'MATCH_ARCHIVE_INVALID_FIELD');
  }
  return parsed.output;
}

function readHistorySyncApplyResponse(
  response: PostgrestSingleResponse<HistorySyncApplyResponse>,
): HistorySyncApplyResponse {
  const data = readRpcData(response, 'Failed to save archive page', 'MATCH_ARCHIVE_SAVE_PAGE_FAILED');
  const parsed = v.safeParse(HistorySyncApplyResponseSchema, data);
  if (!parsed.success) {
    throw new MatchArchiveError('Archive returned invalid apply response', 502, 'MATCH_ARCHIVE_INVALID_FIELD');
  }
  return parsed.output;
}

function readRecordMatchSyncFailureResponse(
  response: PostgrestSingleResponse<RecordMatchSyncFailureResponse>,
): RecordMatchSyncFailureResponse {
  const data = readRpcData(response, 'Could not record match sync failure', 'MATCH_ARCHIVE_RECORD_FAILURE_FAILED');
  const parsed = v.safeParse(RecordMatchSyncFailureResponseSchema, data);
  if (!parsed.success) {
    throw new MatchArchiveError('Archive returned invalid failure response', 502, 'MATCH_ARCHIVE_INVALID_FIELD');
  }
  return parsed.output;
}

function readRpcData<T>(response: PostgrestSingleResponse<T>, fallbackMessage: string, errorCode: string): T {
  if (response.error) {
    console.error(
      JSON.stringify({
        message: 'Archive RPC failed',
        error: response.error.message,
        fallbackMessage,
      }),
    );
    throw new MatchArchiveError(fallbackMessage, 502, errorCode);
  }
  if (response.data === null) {
    throw new MatchArchiveError(fallbackMessage, 502, errorCode);
  }
  return response.data;
}

function getSyncErrorCode(error: unknown): string {
  if (error instanceof OpenDotaError) {
    return `OPEN_DOTA_${error.statusCode}`;
  }
  if (error instanceof StratzError) {
    return `STRATZ_${error.statusCode}`;
  }
  if (error instanceof MatchArchiveError) {
    return 'ARCHIVE_ERROR';
  }
  return 'ARCHIVE_APPLY_FAILED';
}

function getSyncErrorMessage(error: unknown): string {
  if (
    error instanceof OpenDotaError ||
    error instanceof StratzError ||
    error instanceof MatchArchiveError
  ) {
    return error.message;
  }
  return 'Unknown synchronization error';
}

async function loadProviderPage(
  env: Env,
  provider: MatchHistoryProvider,
  accountId: number,
  offset: number,
  dependencies: MatchArchiveDependencies,
): Promise<PlayerMatchesPage> {
  if (provider === 'stratz') {
    if (!dependencies.loadStratzPlayerMatchesBatch) {
      throw new MatchArchiveError('STRATZ provider is not configured on the Worker', 502, 'MATCH_ARCHIVE_NOT_CONFIGURED');
    }
    return dependencies.loadStratzPlayerMatchesBatch(
      env.STRATZ_API_TOKEN,
      accountId,
      offset,
    );
  }

  return dependencies.loadOpenDotaPlayerMatchesPage(
    env.OPENDOTA_BASE_URL,
    accountId,
    offset,
    HISTORY_PAGE_SIZE,
  );
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
