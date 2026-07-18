import type {
  DotaPlayerProfile,
  RecentDotaMatch,
  RecentMatchesResponse,
} from '../../shared/dota';
import { steamId64ToAccountId } from './steam-id';

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const RECENT_MATCH_LIMIT = 20;

type JsonObject = Record<string, unknown>;

export class OpenDotaError extends Error {
  readonly statusCode: 400 | 404 | 429 | 502 | 504;

  constructor(message: string, statusCode: 400 | 404 | 429 | 502 | 504) {
    super(message);
    this.name = 'OpenDotaError';
    this.statusCode = statusCode;
  }
}

export async function resolveDotaPlayer(
  baseUrl: string,
  steamId64: string,
  fetcher: typeof fetch = fetch,
): Promise<DotaPlayerProfile> {
  const accountId = steamId64ToAccountId(steamId64);
  const payload = await fetchOpenDotaJson(
    baseUrl,
    `/players/${accountId}`,
    fetcher,
  );

  if (!isObject(payload) || !isObject(payload.profile)) {
    throw new OpenDotaError(
      'Профиль не найден или скрыт настройками приватности',
      404,
    );
  }

  const personaName = readString(payload.profile.personaname);
  if (!personaName) {
    throw new OpenDotaError('OpenDota не вернула имя профиля', 502);
  }

  return {
    steamId64: steamId64.trim(),
    accountId,
    personaName,
    avatarUrl: readString(payload.profile.avatarfull),
    rankTier: readNullableInteger(payload.rank_tier),
  };
}

export async function loadRecentMatches(
  baseUrl: string,
  accountId: number,
  fetcher: typeof fetch = fetch,
): Promise<RecentMatchesResponse> {
  const [matchesPayload, heroesPayload] = await Promise.all([
    fetchOpenDotaJson(baseUrl, `/players/${accountId}/recentMatches`, fetcher),
    fetchOpenDotaJson(baseUrl, '/constants/heroes', fetcher),
  ]);

  if (!Array.isArray(matchesPayload) || !isObject(heroesPayload)) {
    throw new OpenDotaError('OpenDota вернула неожиданный формат данных', 502);
  }

  const matches = matchesPayload
    .slice(0, RECENT_MATCH_LIMIT)
    .flatMap((value): RecentDotaMatch[] => {
      if (!isObject(value)) {
        return [];
      }

      const heroId = readInteger(value.hero_id);
      const playerSlot = readInteger(value.player_slot);
      const radiantWin = readBoolean(value.radiant_win);
      const matchId = readInteger(value.match_id);
      if (
        heroId === null ||
        playerSlot === null ||
        radiantWin === null ||
        matchId === null
      ) {
        return [];
      }

      const hero = heroesPayload[String(heroId)];
      const heroName =
        isObject(hero) && readString(hero.localized_name)
          ? readString(hero.localized_name)!
          : `Герой #${heroId}`;
      const isRadiant = playerSlot < 128;

      return [
        {
          matchId: String(matchId),
          startTime: readInteger(value.start_time) ?? 0,
          durationSeconds: readInteger(value.duration) ?? 0,
          heroId,
          heroName,
          won: isRadiant === radiantWin,
          kills: readInteger(value.kills) ?? 0,
          deaths: readInteger(value.deaths) ?? 0,
          assists: readInteger(value.assists) ?? 0,
          goldPerMinute: readInteger(value.gold_per_min) ?? 0,
          xpPerMinute: readInteger(value.xp_per_min) ?? 0,
          lastHits: readInteger(value.last_hits) ?? 0,
        },
      ];
    });

  return { accountId, matches };
}

async function fetchOpenDotaJson(
  baseUrl: string,
  pathname: string,
  fetcher: typeof fetch,
): Promise<unknown> {
  let endpoint: URL;
  try {
    endpoint = new URL(`${baseUrl.replace(/\/$/, '')}${pathname}`);
  } catch {
    throw new OpenDotaError('OpenDota URL настроен неверно', 502);
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetcher(endpoint, {
      headers: { Accept: 'application/json' },
      signal: abortController.signal,
    });

    if (!response.ok) {
      await response.body?.cancel();

      if (response.status === 404) {
        throw new OpenDotaError('Профиль OpenDota не найден', 404);
      }
      if (response.status === 429) {
        throw new OpenDotaError('Лимит OpenDota исчерпан, повторите позже', 429);
      }

      throw new OpenDotaError('OpenDota временно недоступна', 502);
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_RESPONSE_BYTES) {
      await response.body?.cancel();
      throw new OpenDotaError('Ответ OpenDota превышает допустимый размер', 502);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof OpenDotaError) {
      throw error;
    }
    if (abortController.signal.aborted) {
      throw new OpenDotaError('OpenDota не ответила вовремя', 504);
    }

    throw new OpenDotaError('Не удалось связаться с OpenDota', 502);
  } finally {
    clearTimeout(timeout);
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

function readNullableInteger(value: unknown): number | null {
  return value === null || value === undefined ? null : readInteger(value);
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}
