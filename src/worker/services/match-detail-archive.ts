import { createClient, type PostgrestSingleResponse } from '@supabase/supabase-js';
import * as v from 'valibot';
import type { Json } from '../../shared/database.types';
import type { AppDatabase } from '../../shared/app-database';
import {
  DetailApplyResponseSchema,
  PublicDetailApplyResponseSchema,
  TrackedDetailClaimSchema,
  type DetailApplyResponse,
  type PublicDetailApplyResponse,
  type TrackedDetailClaim,
} from '../../shared/contracts/detail-rpc';
import {
  readStratzDetailMatch,
  readStratzDetailPlayers,
  type StratzDetailPayload,
} from '../../shared/contracts/stratz-detail';
import type { MatchDetailSyncResult, MatchImportResult } from '../../shared/match-archive';
import {
  loadStratzMatchDetail,
  normalizeStratzDetailMatch,
  normalizeStratzDetailPlayers,
  StratzError,
} from './stratz';

type DetailRpcClient = {
  claimSpecificMatchDetail(
    args: AppDatabase['public']['Functions']['claim_specific_match_detail']['Args'],
  ): PromiseLike<PostgrestSingleResponse<TrackedDetailClaim>>;
  applyPublicMatchImport(
    args: AppDatabase['public']['Functions']['apply_public_match_import']['Args'],
  ): PromiseLike<PostgrestSingleResponse<PublicDetailApplyResponse>>;
  applyMatchDetailBatch(
    args: AppDatabase['public']['Functions']['apply_match_detail_batch']['Args'],
  ): PromiseLike<PostgrestSingleResponse<DetailApplyResponse>>;
};

type Dependencies = {
  createClient: (env: Env) => DetailRpcClient;
  loadDetail: typeof loadStratzMatchDetail;
};

const defaultDependencies: Dependencies = {
  createClient: (env) => {
    const client = createClient<AppDatabase>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    return {
      claimSpecificMatchDetail: (args) => client.rpc('claim_specific_match_detail', args),
      applyMatchDetailBatch: (args) => client.rpc('apply_match_detail_batch', args),
      applyPublicMatchImport: (args) => client.rpc('apply_public_match_import', args),
    };
  },
  loadDetail: loadStratzMatchDetail,
};

export async function syncTrackedMatchDetail(
  env: Env,
  actorUserId: string,
  trackedAccountId: string,
  matchId: number,
  dependencies: Dependencies = defaultDependencies,
): Promise<MatchDetailSyncResult> {
  if (!Number.isSafeInteger(matchId) || matchId <= 0) {
    throw new StratzError('Invalid match ID', 400, 'MATCH_DETAIL_ARCHIVE_INVALID_ID');
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.STRATZ_API_TOKEN.trim()) {
    throw new StratzError('STRATZ detail sync is not configured', 403, 'STRATZ_TOKEN_MISSING');
  }
  const client = dependencies.createClient(env);
  const claim = readTrackedDetailClaim(await client.claimSpecificMatchDetail({
    p_actor_user_id: actorUserId,
    p_tracked_account_id: trackedAccountId,
    p_match_id: matchId,
    p_lease_seconds: 300,
  }));
  return processDetailClaim(env, actorUserId, trackedAccountId, claim, client, dependencies);
}

export async function importPublicMatchDetail(
  env: Env,
  matchId: number,
  dependencies: Dependencies = defaultDependencies,
): Promise<MatchImportResult> {
  if (!Number.isSafeInteger(matchId) || matchId <= 0) throw new StratzError('Invalid match ID', 400, 'MATCH_DETAIL_ARCHIVE_INVALID_ID');
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.STRATZ_API_TOKEN.trim()) throw new StratzError('STRATZ detail sync is not configured', 403, 'STRATZ_TOKEN_MISSING');
  const client = dependencies.createClient(env);
  const detail = await dependencies.loadDetail(env.STRATZ_API_TOKEN, matchId);
  if (detail.unavailable) return { matchId, status: 'unavailable', imported: false };
  if (detail.error) throw detail.error;
  if (!validateDetailIdentity(matchId, detail.payloads)) {
    throw new StratzError('STRATZ detail returned another match', 502, 'STRATZ_DETAIL_INVALID');
  }
  const normalizedPlayers = readNormalizedPlayers(matchId, detail.payloads);
  const normalizedMatch = readNormalizedMatch(detail.payloads);
  if (!normalizedMatch || normalizedMatch.match_id !== matchId) {
    throw new StratzError('STRATZ detail metadata is incomplete', 502, 'STRATZ_DETAIL_INVALID');
  }
  const result: Json = {
    status: 'available',
    payloads: detail.payloads.map(toPayload),
    normalized_match: normalizedMatch,
    normalized_players: normalizedPlayers,
  };
  readPublicDetailApplyResponse(
    await client.applyPublicMatchImport({ p_match_id: matchId, p_result: result }),
    matchId,
  );
  return { matchId, status: 'available', imported: true };
}

function toPayload(payload: StratzDetailPayload) {
  return { payload_section: payload.section, payload: payload.response, schema_version: 'stratz.match.detail.v2' };
}

async function processDetailClaim(
  env: Env,
  actorUserId: string,
  trackedAccountId: string,
  claim: TrackedDetailClaim,
  client: DetailRpcClient,
  dependencies: Dependencies,
): Promise<MatchDetailSyncResult> {
  if (claim.owned !== true) throw new StratzError('Tracked match not found', 404, 'MATCH_DETAIL_ARCHIVE_NOT_FOUND');

  const accountId = claim.dotaAccountId;
  const matchIds = claim.matchIds;
  const backfillComplete = claim.backfillComplete;
  if (matchIds.length === 0) {
    return {
      accountId,
      processedMatches: 0,
      availableMatches: claim.claimed === false && claim.status === 'available' ? 1 : 0,
      failedMatches: 0,
      backfillComplete,
    };
  }
  if (claim.claimed !== true) {
    throw new StratzError('Detail queue returned unclaimed match IDs', 502, 'MATCH_DETAIL_ARCHIVE_QUEUE_INVALID_IDS');
  }
  const leaseToken = claim.leaseToken;
  const results: Json[] = [];
  let availableMatches = 0;
  let failedMatches = 0;

  for (const matchId of matchIds) {
    try {
      const detail = await dependencies.loadDetail(env.STRATZ_API_TOKEN, matchId);
      if (detail.unavailable) {
        results.push({ match_id: matchId, status: 'unavailable' });
      } else if (detail.error) {
        failedMatches += 1;
        results.push({
          match_id: matchId,
          status: 'failed',
          payloads: detail.payloads.map((payload) => ({
            payload_section: payload.section,
            payload: payload.response,
            schema_version: 'stratz.match.detail.v2',
          })),
          error_code: `STRATZ_${detail.error.statusCode}`,
          error_message: detail.error.message,
        });
      } else {
        if (!validateDetailIdentity(matchId, detail.payloads)) {
          throw new StratzError('STRATZ detail returned another match', 502, 'STRATZ_DETAIL_INVALID');
        }
        const normalizedPlayers = readNormalizedPlayers(matchId, detail.payloads);
        availableMatches += 1;
        results.push({
          match_id: matchId,
          status: 'available',
          payloads: detail.payloads.map((payload) => ({
            payload_section: payload.section,
            payload: payload.response,
            schema_version: 'stratz.match.detail.v2',
          })),
          normalized_players: normalizedPlayers,
        });
      }
    } catch (error) {
      failedMatches += 1;
      results.push({
        match_id: matchId,
        status: 'failed',
        error_code: error instanceof StratzError ? `STRATZ_${error.statusCode}` : 'STRATZ_DETAIL_ERROR',
        error_message: error instanceof Error ? error.message : 'Unknown STRATZ detail error',
      });
    }
  }

  const applied = readDetailApplyResponse(await client.applyMatchDetailBatch({
    p_actor_user_id: actorUserId,
    p_tracked_account_id: trackedAccountId,
    p_dota_account_id: accountId,
    p_lease_token: leaseToken,
    p_results: results,
  }));
  return {
    accountId,
    processedMatches: applied.processedMatches,
    availableMatches,
    failedMatches,
    backfillComplete: applied.backfillComplete === true,
  };
}

function validateDetailIdentity(matchId: number, payloads: StratzDetailPayload[]): boolean {
  return payloads.every(({ response }) => {
    const match = readStratzDetailMatch(response);
    if (!match) return true;
    if (typeof match.id === 'number' && match.id !== matchId) return false;
    return readStratzDetailPlayers(response).every(
      (player) => player.matchId === undefined || player.matchId === matchId,
    );
  });
}

function readNormalizedMatch(payloads: StratzDetailPayload[]) {
  for (const { response } of payloads) {
    const match = readStratzDetailMatch(response);
    const normalized = match ? normalizeStratzDetailMatch(match) : null;
    if (normalized) return normalized;
  }
  return null;
}

function readNormalizedPlayers(matchId: number, payloads: StratzDetailPayload[]) {
  const normalizedPlayers = normalizeStratzDetailPlayers(payloads);
  if (!normalizedPlayers.some((player) => player.match_id === matchId)) {
    throw new StratzError('STRATZ detail contains no projectable players', 502, 'STRATZ_DETAIL_INVALID');
  }
  return normalizedPlayers;
}

function readTrackedDetailClaim(response: PostgrestSingleResponse<TrackedDetailClaim>): TrackedDetailClaim {
  const data = readRpcData(response, 'Failed to retrieve selected match details', 'MATCH_DETAIL_ARCHIVE_FETCH_FAILED');
  const parsed = v.safeParse(TrackedDetailClaimSchema, data);
  if (!parsed.success) {
    throw new StratzError('Detail queue returned invalid claim response', 502, 'MATCH_ARCHIVE_INVALID_FIELD');
  }
  return parsed.output;
}

function readDetailApplyResponse(response: PostgrestSingleResponse<DetailApplyResponse>) {
  const data = readRpcData(response, 'Failed to save match details', 'MATCH_DETAIL_ARCHIVE_DETAILS_SAVE_FAILED');
  const parsed = v.safeParse(DetailApplyResponseSchema, data);
  if (!parsed.success) {
    throw new StratzError('Detail apply returned invalid response', 502, 'MATCH_ARCHIVE_INVALID_FIELD');
  }
  return parsed.output;
}

function readPublicDetailApplyResponse(response: PostgrestSingleResponse<PublicDetailApplyResponse>, matchId: number) {
  const data = readRpcData(response, 'Failed to save match', 'MATCH_DETAIL_ARCHIVE_SAVE_FAILED');
  const parsed = v.safeParse(PublicDetailApplyResponseSchema, data);
  if (!parsed.success || parsed.output.match_id !== matchId) {
    throw new StratzError('Public detail apply returned invalid response', 502, 'MATCH_ARCHIVE_INVALID_FIELD');
  }
  return parsed.output;
}

function readRpcData<T>(response: PostgrestSingleResponse<T>, message: string, errorCode: string): T {
  if (response.error || response.data === null) {
    throw new StratzError(response.error?.message || message, 502, errorCode);
  }
  return response.data;
}
