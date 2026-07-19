import type { ArchivedPlayerMatch, PlayerMatchesPage } from './match-provider';

const STRATZ_GRAPHQL_URL = 'https://api.stratz.com/graphql';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1_000_000;
export const STRATZ_PAGE_SIZE = 100;
export const STRATZ_PAGES_PER_SYNC = 5;
export const STRATZ_SYNC_BATCH_SIZE = STRATZ_PAGE_SIZE * STRATZ_PAGES_PER_SYNC;

const GAME_MODE_IDS: Record<string, number> = {
  ALL_PICK: 1,
  CAPTAINS_MODE: 2,
  RANDOM_DRAFT: 3,
  SINGLE_DRAFT: 4,
  ALL_RANDOM: 5,
  INTRO: 6,
  DIRETIDE: 7,
  REVERSE_CAPTAINS_MODE: 8,
  THE_GREEVILING: 9,
  TUTORIAL: 10,
  MID_ONLY: 11,
  LEAST_PLAYED: 12,
  NEW_PLAYER_POOL: 13,
  COMPENDIUM_MATCHMAKING: 14,
  CUSTOM: 15,
  CAPTAINS_DRAFT: 16,
  BALANCED_DRAFT: 17,
  ABILITY_DRAFT: 18,
  EVENT: 19,
  ALL_RANDOM_DEATH_MATCH: 20,
  SOLO_MID_1V1: 21,
  RANKED_ALL_PICK: 22,
  TURBO: 23,
  MUTATION: 24,
};

const LOBBY_TYPE_IDS: Record<string, number> = {
  INVALID: -1,
  UNRANKED: 0,
  NORMAL: 0,
  PRACTICE: 1,
  TOURNAMENT: 2,
  TUTORIAL: 3,
  COOP_BOT: 4,
  RANKED_TEAM: 5,
  RANKED_SOLO: 6,
  RANKED: 7,
  SOLO_MID_1V1: 8,
  WEEKEND_TOURNEY: 9,
  LOCAL_BOTS: 10,
  SPECTATOR: 11,
  EVENT: 12,
  GAUNTLET: 13,
  NEW_PLAYER: 14,
  FEATURED: 15,
};

const PLAYER_MATCHES_QUERY = `
  query PlayerMatches($steamAccountId: Long!, $request: PlayerMatchesRequestType!) {
    player(steamAccountId: $steamAccountId) {
      steamAccountId
      matches(request: $request) {
        id
        startDateTime
        durationSeconds
        didRadiantWin
        gameMode
        lobbyType
        regionId
        leagueId
        gameVersionId
        players {
          steamAccountId
          heroId
          isRadiant
          playerSlot
          kills
          deaths
          assists
          networth
          level
          imp
          leaverStatus
          numLastHits
          numDenies
          goldPerMinute
          experiencePerMinute
          heroDamage
          towerDamage
          heroHealing
          partyId
          lane
          position
          variant
        }
      }
    }
  }
`;

type JsonObject = Record<string, unknown>;

export class StratzError extends Error {
  readonly statusCode: 400 | 403 | 404 | 429 | 502 | 504;

  constructor(message: string, statusCode: 400 | 403 | 404 | 429 | 502 | 504) {
    super(message);
    this.name = 'StratzError';
    this.statusCode = statusCode;
  }
}

export async function loadStratzPlayerMatchesPage(
  token: string,
  accountId: number,
  offset: number,
  limit: number = STRATZ_PAGE_SIZE,
  fetcher: typeof fetch = fetch,
): Promise<PlayerMatchesPage> {
  if (!token.trim()) {
    throw new StratzError('STRATZ API token is not configured', 403);
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new StratzError('Некорректный STRATZ offset истории матчей', 400);
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > STRATZ_PAGE_SIZE) {
    throw new StratzError('Некорректный размер страницы STRATZ истории матчей', 400);
  }

  const payload = await fetchStratzJson(
    token,
    {
      query: PLAYER_MATCHES_QUERY,
      operationName: 'PlayerMatches',
      variables: {
        steamAccountId: accountId,
        request: { take: limit, skip: offset },
      },
    },
    fetcher,
  );

  const data = isObject(payload.data) ? payload.data : null;
  const player = data && isObject(data.player) ? data.player : null;
  const rawMatches = player && Array.isArray(player.matches) ? player.matches : null;
  if (!rawMatches) {
    throw new StratzError('STRATZ вернул неожиданный формат истории матчей', 502);
  }

  const matches = rawMatches.flatMap((value): ArchivedPlayerMatch[] => {
    const match = normalizeStratzMatch(value, accountId);
    return match ? [match] : [];
  });

  return {
    accountId,
    offset,
    limit,
    matches,
    nextOffset: offset + rawMatches.length,
    hasMore: rawMatches.length >= limit,
  };
}

export async function loadStratzPlayerMatchesBatch(
  token: string,
  accountId: number,
  offset: number,
  fetcher: typeof fetch = fetch,
): Promise<PlayerMatchesPage> {
  const matchesById = new Map<string, ArchivedPlayerMatch>();
  let nextOffset = offset;
  let hasMore = true;

  for (let pageIndex = 0; pageIndex < STRATZ_PAGES_PER_SYNC && hasMore; pageIndex += 1) {
    const page = await loadStratzPlayerMatchesPage(
      token,
      accountId,
      nextOffset,
      STRATZ_PAGE_SIZE,
      fetcher,
    );
    for (const match of page.matches) {
      matchesById.set(match.matchId, match);
    }
    nextOffset = page.nextOffset;
    hasMore = page.hasMore;
  }

  return {
    accountId,
    offset,
    limit: STRATZ_SYNC_BATCH_SIZE,
    matches: [...matchesById.values()],
    nextOffset,
    hasMore,
  };
}

async function fetchStratzJson(
  token: string,
  body: JsonObject,
  fetcher: typeof fetch,
): Promise<JsonObject> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetcher(STRATZ_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'STRATZ_API',
      },
      body: JSON.stringify(body),
      signal: abortController.signal,
    });

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_RESPONSE_BYTES) {
      await response.body?.cancel();
      throw new StratzError('Ответ STRATZ превышает допустимый размер', 502);
    }

    if (!response.ok) {
      if (response.status === 403) {
        throw new StratzError('STRATZ отклонил запрос или вернул Cloudflare challenge', 403);
      }
      if (response.status === 404) {
        throw new StratzError('STRATZ игрок не найден', 404);
      }
      if (response.status === 429) {
        throw new StratzError('Лимит STRATZ исчерпан, повторите позже', 429);
      }
      throw new StratzError('STRATZ временно недоступен', 502);
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      throw new StratzError('STRATZ вернул некорректный JSON', 502);
    }

    if (!isObject(responseBody)) {
      throw new StratzError('STRATZ вернул неожиданный ответ', 502);
    }
    if (Array.isArray(responseBody.errors) && responseBody.errors.length > 0) {
      throw new StratzError(readGraphqlError(responseBody.errors), 502);
    }

    return responseBody;
  } catch (error) {
    if (error instanceof StratzError) {
      throw error;
    }
    if (abortController.signal.aborted) {
      throw new StratzError('STRATZ не ответил вовремя', 504);
    }
    throw new StratzError('Не удалось связаться с STRATZ', 502);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeStratzMatch(
  value: unknown,
  accountId: number,
): ArchivedPlayerMatch | null {
  if (!isObject(value)) return null;

  const matchId = readInteger(value.id);
  const radiantWin = readBoolean(value.didRadiantWin);
  const players = Array.isArray(value.players) ? value.players : [];
  const player = players.find(
    (candidate) => isObject(candidate) && readInteger(candidate.steamAccountId) === accountId,
  );

  if (matchId === null || radiantWin === null || !isObject(player)) {
    return null;
  }

  const playerSlot = readInteger(player.playerSlot);
  const heroId = readInteger(player.heroId);
  if (playerSlot === null || heroId === null) {
    return null;
  }

  return {
    matchId: String(matchId),
    startTime: readNullableInteger(value.startDateTime),
    durationSeconds: readNullableInteger(value.durationSeconds),
    radiantWin,
    gameMode: readGameMode(value.gameMode, value.lobbyType),
    lobbyType: readLobbyType(value.lobbyType),
    averageRank: null,
    cluster: readNullableInteger(value.regionId),
    version: readVersion(value.gameVersionId),
    radiantTeamId: null,
    direTeamId: null,
    leagueId: readNullableInteger(value.leagueId),
    seriesId: null,
    seriesType: null,
    radiantScore: null,
    direScore: null,
    playerSlot,
    heroId,
    heroVariant: readNullableInteger(player.variant),
    kills: readNullableInteger(player.kills),
    deaths: readNullableInteger(player.deaths),
    assists: readNullableInteger(player.assists),
    goldPerMinute: readNullableInteger(player.goldPerMinute),
    xpPerMinute: readNullableInteger(player.experiencePerMinute),
    lastHits: readNullableInteger(player.numLastHits),
    denies: readNullableInteger(player.numDenies),
    heroDamage: readNullableInteger(player.heroDamage),
    towerDamage: readNullableInteger(player.towerDamage),
    heroHealing: readNullableInteger(player.heroHealing),
    level: readNullableInteger(player.level),
    netWorth: readNullableInteger(player.networth),
    leaverStatus: readLeaverStatus(player.leaverStatus),
    partySize: readPartySize(players, player),
    lane: readLane(player.lane),
    laneRole: readPosition(player.position),
    isRoaming: player.lane === 'ROAMING' ? true : null,
  };
}

function readGraphqlError(errors: unknown[]): string {
  const first = errors[0];
  return isObject(first) && typeof first.message === 'string'
    ? first.message
    : 'STRATZ GraphQL вернул ошибку';
}

function readVersion(value: unknown): number | null {
  if (typeof value === 'string') {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) ? numeric : null;
  }
  return readNullableInteger(value);
}

function readGameMode(value: unknown, lobbyType: unknown): number | null {
  if (typeof value === 'string') {
    if (value === 'ALL_PICK' && lobbyType === 'RANKED') {
      return GAME_MODE_IDS.RANKED_ALL_PICK;
    }
    return GAME_MODE_IDS[value] ?? null;
  }
  return readNullableInteger(value);
}

function readLobbyType(value: unknown): number | null {
  return typeof value === 'string'
    ? LOBBY_TYPE_IDS[value] ?? null
    : readNullableInteger(value);
}

function readLeaverStatus(value: unknown): number | null {
  if (typeof value === 'number') {
    return readNullableInteger(value);
  }
  return value === 'NONE' ? 0 : value === null || value === undefined ? null : 1;
}

function readPartySize(players: unknown[], trackedPlayer: JsonObject): number {
  const partyId = readNullableInteger(trackedPlayer.partyId);
  if (partyId === null || partyId === 0) {
    return 0;
  }
  const partyMembers = players.filter(
    (candidate) => isObject(candidate) && readNullableInteger(candidate.partyId) === partyId,
  ).length;
  return partyMembers > 1 ? partyMembers : 0;
}

function readLane(value: unknown): number | null {
  if (typeof value === 'number') return readNullableInteger(value);
  return {
    SAFE_LANE: 1,
    MID_LANE: 2,
    OFF_LANE: 3,
    JUNGLE: 4,
  }[value as string] ?? null;
}

function readPosition(value: unknown): number | null {
  if (typeof value === 'number') return readNullableInteger(value);
  return {
    POSITION_1: 1,
    POSITION_2: 2,
    POSITION_3: 3,
    POSITION_4: 4,
    POSITION_5: 5,
  }[value as string] ?? null;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
