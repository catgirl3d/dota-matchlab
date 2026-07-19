import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from '../../shared/database.types';
import type { MatchDetailSyncResult } from '../../shared/match-archive';
import { loadStratzMatchDetail, StratzError } from './stratz';

type RpcResponse = { data: Json | null; error: { message: string } | null };

type DetailRpcClient = {
  claimSpecificMatchDetail(args: {
    p_actor_user_id: string;
    p_tracked_account_id: string;
    p_match_id: number;
    p_lease_seconds: number;
  }): PromiseLike<RpcResponse>;
  applyMatchDetailBatch(args: {
    p_actor_user_id: string;
    p_tracked_account_id: string;
    p_dota_account_id: number;
    p_lease_token: string;
    p_results: Json;
  }): PromiseLike<RpcResponse>;
};

type Dependencies = {
  createClient: (env: Env) => DetailRpcClient;
  loadDetail: typeof loadStratzMatchDetail;
};

const defaultDependencies: Dependencies = {
  createClient: (env) => {
    const client = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    return {
      claimSpecificMatchDetail: (args) => client.rpc('claim_specific_match_detail', args),
      applyMatchDetailBatch: (args) => client.rpc('apply_match_detail_batch', args),
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
    throw new StratzError('Некорректный match ID', 400);
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.STRATZ_API_TOKEN.trim()) {
    throw new StratzError('STRATZ detail sync is not configured', 403);
  }
  const client = dependencies.createClient(env);
  const claim = readObject(await client.claimSpecificMatchDetail({
    p_actor_user_id: actorUserId,
    p_tracked_account_id: trackedAccountId,
    p_match_id: matchId,
    p_lease_seconds: 300,
  }), 'Не удалось получить выбранный detail матч');
  return processDetailClaim(env, actorUserId, trackedAccountId, claim, client, dependencies);
}

async function processDetailClaim(
  env: Env,
  actorUserId: string,
  trackedAccountId: string,
  claim: Record<string, Json | undefined>,
  client: DetailRpcClient,
  dependencies: Dependencies,
): Promise<MatchDetailSyncResult> {
  if (claim.owned !== true) throw new StratzError('Отслеживаемый матч не найден', 404);

  const accountId = readInteger(claim.dotaAccountId, 'dotaAccountId');
  const matchIds = readMatchIds(claim.matchIds);
  const backfillComplete = claim.backfillComplete === true;
  if (matchIds.length === 0) {
    return {
      accountId,
      processedMatches: 0,
      availableMatches: claim.status === 'available' ? 1 : 0,
      failedMatches: 0,
      backfillComplete,
    };
  }
  const leaseToken = readString(claim.leaseToken, 'leaseToken');
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
        availableMatches += 1;
        results.push({
          match_id: matchId,
          status: 'available',
          payloads: detail.payloads.map((payload) => ({
            payload_section: payload.section,
            payload: payload.response,
            schema_version: 'stratz.match.detail.v2',
          })),
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

  const applied = readObject(await client.applyMatchDetailBatch({
    p_actor_user_id: actorUserId,
    p_tracked_account_id: trackedAccountId,
    p_dota_account_id: accountId,
    p_lease_token: leaseToken,
    p_results: results,
  }), 'Не удалось сохранить detail матчей');
  return {
    accountId,
    processedMatches: readInteger(applied.processedMatches, 'processedMatches'),
    availableMatches,
    failedMatches,
    backfillComplete: applied.backfillComplete === true,
  };
}

function readObject(response: RpcResponse, message: string): Record<string, Json | undefined> {
  if (response.error || !isObject(response.data)) {
    throw new StratzError(response.error?.message || message, 502);
  }
  return response.data;
}

function readMatchIds(value: Json | undefined): number[] {
  if (!Array.isArray(value) || !value.every((id) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0)) {
    throw new StratzError('Очередь STRATZ detail вернула некорректные match ID', 502);
  }
  return value as number[];
}

function readInteger(value: Json | undefined, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new StratzError(`Очередь detail вернула некорректное поле ${field}`, 502);
  }
  return value;
}

function readString(value: Json | undefined, field: string): string {
  if (typeof value !== 'string' || !value) throw new StratzError(`Очередь detail вернула некорректное поле ${field}`, 502);
  return value;
}

function isObject(value: Json | null): value is Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
