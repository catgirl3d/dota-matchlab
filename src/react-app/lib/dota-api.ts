import type { DotaPlayerProfile, RecentMatchesResponse } from '../../shared/dota';
import type { MatchSyncResult } from '../../shared/match-archive';

type ApiErrorPayload = {
  error?: unknown;
};

export async function resolveSteamProfile(
  token: string,
  steamProfile: string,
): Promise<DotaPlayerProfile> {
  return requestJson<DotaPlayerProfile>('/api/dota/players/resolve', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ steamProfile }),
  });
}

export async function fetchRecentMatches(
  token: string,
  accountId: number,
): Promise<RecentMatchesResponse> {
  return requestJson<RecentMatchesResponse>(
    `/api/dota/players/${accountId}/recent-matches`,
    token,
  );
}

export async function syncTrackedAccount(
  token: string,
  trackedAccountId: string,
): Promise<MatchSyncResult> {
  return requestJson<MatchSyncResult>(
    `/api/dota/tracked-accounts/${encodeURIComponent(trackedAccountId)}/matches/sync`,
    token,
    { method: 'POST' },
  );
}

async function requestJson<T>(
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
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
