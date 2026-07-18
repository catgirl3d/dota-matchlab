import type {
  DotaPlayerProfile,
  RecentDotaMatch,
  RecentMatchesResponse,
} from '../../shared/dota';
import { steamId64ToAccountId } from './steam-id';

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const RECENT_MATCH_LIMIT = 20;
export const HISTORY_PAGE_SIZE = 100;

const HISTORY_PROJECT_FIELDS = [
  'match_id',
  'start_time',
  'duration',
  'radiant_win',
  'game_mode',
  'lobby_type',
  'version',
  'hero_id',
  'hero_variant',
  'player_slot',
  'kills',
  'deaths',
  'assists',
  'gold_per_min',
  'xp_per_min',
  'last_hits',
  'denies',
  'hero_damage',
  'tower_damage',
  'hero_healing',
  'level',
  'net_worth',
  'leaver_status',
  'party_size',
  'lane',
  'lane_role',
  'is_roaming',
  'average_rank',
  'cluster',
  'radiant_team_id',
  'dire_team_id',
  'leagueid',
  'series_id',
  'series_type',
  'radiant_score',
  'dire_score',
] as const;

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

export type ArchivedPlayerMatch = {
  matchId: string;
  startTime: number | null;
  durationSeconds: number | null;
  radiantWin: boolean;
  gameMode: number | null;
  lobbyType: number | null;
  averageRank: number | null;
  cluster: number | null;
  version: number | null;
  radiantTeamId: number | null;
  direTeamId: number | null;
  leagueId: number | null;
  seriesId: number | null;
  seriesType: number | null;
  radiantScore: number | null;
  direScore: number | null;
  playerSlot: number;
  heroId: number;
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
};

export type PlayerMatchesPage = {
  accountId: number;
  offset: number;
  limit: number;
  matches: ArchivedPlayerMatch[];
  nextOffset: number;
  hasMore: boolean;
};

export async function loadPlayerMatchesPage(
  baseUrl: string,
  accountId: number,
  offset: number,
  limit: number = HISTORY_PAGE_SIZE,
  fetcher: typeof fetch = fetch,
): Promise<PlayerMatchesPage> {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new OpenDotaError('Некорректный offset истории матчей', 400);
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > HISTORY_PAGE_SIZE) {
    throw new OpenDotaError('Некорректный размер страницы истории матчей', 400);
  }

  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  for (const field of HISTORY_PROJECT_FIELDS) {
    query.append('project', field);
  }

  const payload = await fetchOpenDotaJson(
    baseUrl,
    `/players/${accountId}/matches?${query.toString()}`,
    fetcher,
  );

  if (!Array.isArray(payload)) {
    throw new OpenDotaError('OpenDota вернула неожиданный формат истории', 502);
  }

  const matches: ArchivedPlayerMatch[] = [];
  const seenMatchIds = new Set<string>();

  for (const value of payload) {
    const match = normalizeArchivedPlayerMatch(value);
    if (!match || seenMatchIds.has(match.matchId)) {
      continue;
    }

    seenMatchIds.add(match.matchId);
    matches.push(match);
  }

  return {
    accountId,
    offset,
    limit,
    matches,
    nextOffset: offset + payload.length,
    hasMore: payload.length >= limit,
  };
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

function normalizeArchivedPlayerMatch(
  value: unknown,
): ArchivedPlayerMatch | null {
  if (!isObject(value)) {
    return null;
  }

  const matchId = readInteger(value.match_id);
  const playerSlot = readInteger(value.player_slot);
  const heroId = readInteger(value.hero_id);
  const radiantWin = readBoolean(value.radiant_win);
  if (
    matchId === null ||
    playerSlot === null ||
    heroId === null ||
    radiantWin === null
  ) {
    return null;
  }

  return {
    matchId: String(matchId),
    startTime: readNullableInteger(value.start_time),
    durationSeconds: readNullableInteger(value.duration),
    radiantWin,
    gameMode: readNullableInteger(value.game_mode),
    lobbyType: readNullableInteger(value.lobby_type),
    averageRank: readNullableInteger(value.average_rank),
    cluster: readNullableInteger(value.cluster),
    version: readNullableInteger(value.version),
    radiantTeamId: readNullableInteger(value.radiant_team_id),
    direTeamId: readNullableInteger(value.dire_team_id),
    leagueId: readNullableInteger(value.leagueid),
    seriesId: readNullableInteger(value.series_id),
    seriesType: readNullableInteger(value.series_type),
    radiantScore: readNullableInteger(value.radiant_score),
    direScore: readNullableInteger(value.dire_score),
    playerSlot,
    heroId,
    heroVariant: readNullableInteger(value.hero_variant),
    kills: readNullableInteger(value.kills),
    deaths: readNullableInteger(value.deaths),
    assists: readNullableInteger(value.assists),
    goldPerMinute: readNullableInteger(value.gold_per_min),
    xpPerMinute: readNullableInteger(value.xp_per_min),
    lastHits: readNullableInteger(value.last_hits),
    denies: readNullableInteger(value.denies),
    heroDamage: readNullableInteger(value.hero_damage),
    towerDamage: readNullableInteger(value.tower_damage),
    heroHealing: readNullableInteger(value.hero_healing),
    level: readNullableInteger(value.level),
    netWorth: readNullableInteger(value.net_worth),
    leaverStatus: readNullableInteger(value.leaver_status),
    partySize: readNullableInteger(value.party_size),
    lane: readNullableInteger(value.lane),
    laneRole: readNullableInteger(value.lane_role),
    isRoaming: readBoolean(value.is_roaming),
  };
}
