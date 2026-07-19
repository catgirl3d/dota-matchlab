import type {
  DotaPlayerProfile,
  HeroNamesResponse,
  RecentMatchesResponse,
} from '../../shared/dota';
import type { MatchDetailSyncResult, MatchImportResult, MatchSyncResult } from '../../shared/match-archive';

type ApiErrorPayload = {
  error?: unknown;
};

export type MatchSyncProgress = {
  completedBatches: number;
  fetchedMatches: number;
  nextOffset: number;
};

type SyncAllOptions = {
  delayMs?: number;
  maxBatches?: number;
  onProgress?: (progress: MatchSyncProgress) => void;
};

const FULL_SYNC_DELAY_MS = 250;
const FULL_SYNC_MAX_BATCHES = 100;

export async function resolveSteamProfile(
  token: string,
  steamProfile: string,
): Promise<DotaPlayerProfile> {
  return requestJson<DotaPlayerProfile>('/api/dota/players/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ steamProfile }),
  }, token);
}

export async function fetchRecentMatches(
  token: string,
  accountId: number,
): Promise<RecentMatchesResponse> {
  return requestJson<RecentMatchesResponse>(
    `/api/dota/players/${accountId}/recent-matches`,
    {},
    token,
  );
}

export async function syncTrackedAccount(
  token: string,
  trackedAccountId: string,
): Promise<MatchSyncResult> {
  return requestJson<MatchSyncResult>(
    `/api/dota/tracked-accounts/${encodeURIComponent(trackedAccountId)}/matches/sync`,
    { method: 'POST' },
    token,
  );
}

export async function syncTrackedMatchDetail(
  token: string,
  trackedAccountId: string,
  matchId: number,
): Promise<MatchDetailSyncResult> {
  return requestJson<MatchDetailSyncResult>(
    `/api/dota/tracked-accounts/${encodeURIComponent(trackedAccountId)}/matches/${matchId}/details/sync`,
    { method: 'POST' },
    token,
  );
}

export async function importMatch(
  token: string,
  matchId: number,
): Promise<MatchImportResult> {
  return requestJson<MatchImportResult>(
    `/api/dota/matches/${matchId}/import`, { method: 'POST' }, token,
  );
}

export async function syncAllTrackedAccount(
  token: string,
  trackedAccountId: string,
  options: SyncAllOptions = {},
): Promise<MatchSyncResult> {
  const delayMs = options.delayMs ?? FULL_SYNC_DELAY_MS;
  const maxBatches = options.maxBatches ?? FULL_SYNC_MAX_BATCHES;
  let fetchedMatches = 0;

  for (let completedBatches = 1; completedBatches <= maxBatches; completedBatches += 1) {
    const result = await syncTrackedAccount(token, trackedAccountId);
    fetchedMatches += result.fetchedMatches;
    options.onProgress?.({
      completedBatches,
      fetchedMatches,
      nextOffset: result.nextOffset,
    });

    if (result.status === 'ready' || result.backfillComplete) {
      return result;
    }
    if (delayMs > 0) {
      await wait(delayMs);
    }
  }

  throw new Error(`Полная синхронизация превысила лимит ${maxBatches} пакетов`);
}

export async function fetchHeroNames(): Promise<Record<number, string>> {
  const response = await requestJson<HeroNamesResponse>(
    '/api/dota/constants/heroes',
  );

  return Object.entries(response.heroes).reduce<Record<number, string>>(
    (names, [heroId, name]) => {
      const numericHeroId = Number(heroId);
      if (Number.isSafeInteger(numericHeroId) && name.trim()) {
        names[numericHeroId] = name;
      }
      return names;
    },
    {},
  );
}

async function requestJson<T>(
  url: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const payload: unknown = await response.json();

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload;
    const message =
      typeof errorPayload.error === 'string'
        ? errorPayload.error
        : 'Не удалось выполнить запрос';
    throw new Error(message);
  }

  return payload as T;
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
