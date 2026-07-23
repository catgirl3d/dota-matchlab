import type { ArchivedPlayerMatch, PlayerMatchesPage } from './match-provider';
import {
  RequestTimeoutError,
  ResponseBodyTooLargeError,
  readBoundedText,
  withTimeout,
} from '../../shared/http';
import * as v from 'valibot';
import {
  NormalizedDetailPlayerSchema,
  type NormalizedDetailPlayer,
} from '../../shared/contracts/detail-ingestion';
import {
  isJsonValue,
  isShallowObject,
  readNullableSafeInteger as readNullableInteger,
  readSafeInteger,
  type JsonObject,
} from '../../shared/contracts/json';
import {
  StratzDetailPayloadSchema,
  readStratzDetailPlayers,
  type StratzDetailPayload,
} from '../../shared/contracts/stratz-detail';
import {
  METADATA_SELECTION,
  PLAYBACK_SELECTION,
  PLAYER_PLAYBACK_SELECTION,
  PLAYERS_SELECTION,
  STATS_SELECTION,
  RELATIONS_SELECTION,
} from './stratz-detail-selections';

const STRATZ_GRAPHQL_URL = 'https://api.stratz.com/graphql';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_DETAIL_RESPONSE_BYTES = 25_000_000;
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
        endDateTime
        towerStatusRadiant
        towerStatusDire
        barracksStatusRadiant
        barracksStatusDire
        clusterId
        firstBloodTime
        gameMode
        lobbyType
        regionId
        leagueId
        gameVersionId
        numHumanPlayers
        replaySalt
        isStats
        tournamentId
        tournamentRound
        actualRank
        averageRank
        averageImp
        parsedDateTime
        statsDateTime
        radiantTeamId
        direTeamId
        seriesId
        sequenceNum
        rank
        bracket
        analysisOutcome
        predictedOutcomeWeight
        radiantNetworthLeads
        radiantExperienceLeads
        radiantKills
        direKills
        winRates
        predictedWinRates
        bottomLaneOutcome
        midLaneOutcome
        topLaneOutcome
        didRequestDownload
        league { id }
        radiantTeam { id }
        direTeam { id }
        series { id }
        pickBans {
          isPick
          heroId
          order
          bannedHeroId
          isRadiant
          playerIndex
          wasBannedSuccessfully
          isCaptain
          baseWinRate
          adjustedWinRate
          letter
        }
        chatEvents {
          time
          type
          fromHeroId
          toHeroId
          value
          pausedTick
          isRadiant
        }
        towerDeaths {
          time
          npcId
          isRadiant
          attacker
        }
        players {
          matchId
          steamAccountId
          heroId
          isRadiant
          isVictory
          playerSlot
          gameVersionId
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
          isRandom
          lane
          position
          streakPrediction
          intentionalFeeding
          role
          roleBasic
          award
          item0Id
          item1Id
          item2Id
          item3Id
          item4Id
          item5Id
          backpack0Id
          backpack1Id
          backpack2Id
          neutral0Id
          behavior
          invisibleSeconds
          dotaPlusHeroXp
          variant
        }
      }
    }
  }
`;

const DETAIL_SECTIONS = [
  ['metadata', `${METADATA_SELECTION} ${RELATIONS_SELECTION}`],
  ['players', `players { ${PLAYERS_SELECTION} }`],
  ['player_stats', `players { ${STATS_SELECTION} }`],
  ['player_playback', `players { ${PLAYER_PLAYBACK_SELECTION} }`],
  ['match_playback', PLAYBACK_SELECTION],
] as const;

export class StratzError extends Error {
  readonly statusCode: 400 | 403 | 404 | 429 | 502 | 504;
  readonly code: string;

  constructor(message: string, statusCode: 400 | 403 | 404 | 429 | 502 | 504, code: string) {
    super(message);
    this.name = 'StratzError';
    this.statusCode = statusCode;
    this.code = code;
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
    throw new StratzError('STRATZ API token is not configured', 403, 'STRATZ_TOKEN_MISSING');
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new StratzError('Invalid STRATZ match history offset', 400, 'STRATZ_OFFSET_INVALID');
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > STRATZ_PAGE_SIZE) {
    throw new StratzError('Invalid STRATZ match history page size', 400, 'STRATZ_LIMIT_INVALID');
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

  const data = isShallowObject(payload.data) ? payload.data : null;
  const player = data && isShallowObject(data.player) ? data.player : null;
  const rawMatches = player && Array.isArray(player.matches) ? player.matches : null;
  if (!rawMatches) {
    throw new StratzError('STRATZ returned unexpected match history format', 502, 'STRATZ_UNEXPECTED_FORMAT');
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

export type { NormalizedDetailPlayer as NormalizedStratzDetailPlayer } from '../../shared/contracts/detail-ingestion';
export type { StratzDetailPayload } from '../../shared/contracts/stratz-detail';

export type StratzMatchDetailResult = {
  payloads: StratzDetailPayload[];
  unavailable: boolean;
  error: StratzError | null;
};

export type NormalizedStratzDetailMatch = {
  match_id: number;
  start_time: number | null;
  duration: number | null;
  radiant_win: boolean | null;
  game_mode: number | null;
  lobby_type: number | null;
  average_rank: number | null;
  cluster: number | null;
  version: number | null;
  radiant_team_id: number | null;
  dire_team_id: number | null;
  league_id: number | null;
  series_id: number | null;
  series_type: number | null;
  radiant_score: number | null;
  dire_score: number | null;
};

export function normalizeStratzDetailMatch(value: unknown): NormalizedStratzDetailMatch | null {
  if (!isShallowObject(value)) return null;
  const matchId = readSafeInteger(value.id);
  if (matchId === null) return null;
  return {
    match_id: matchId,
    start_time: readNullableInteger(value.startDateTime),
    duration: readNullableInteger(value.durationSeconds),
    radiant_win: readBoolean(value.didRadiantWin),
    game_mode: readGameMode(value.gameMode, value.lobbyType),
    lobby_type: readLobbyType(value.lobbyType),
    average_rank: readNullableInteger(value.averageRank),
    cluster: readNullableInteger(value.clusterId) ?? readNullableInteger(value.regionId),
    version: readVersion(value.gameVersionId),
    radiant_team_id: readNullableInteger(value.radiantTeamId),
    dire_team_id: readNullableInteger(value.direTeamId),
    league_id: readNullableInteger(value.leagueId),
    series_id: readNullableInteger(value.seriesId),
    series_type: readNullableInteger(value.seriesType),
    radiant_score: readNullableInteger(value.radiantScore) ?? readNullableInteger(value.radiantKills),
    dire_score: readNullableInteger(value.direScore) ?? readNullableInteger(value.direKills),
  };
}

export function normalizeStratzDetailPlayers(
  payloads: StratzDetailPayload[],
): NormalizedDetailPlayer[] {
  return payloads.flatMap(({ section, response }) => {
    if (section !== 'players') return [];
    return readStratzDetailPlayers(response).flatMap((player): NormalizedDetailPlayer[] => {
      const normalized = normalizeStratzDetailPlayer(player);
      return normalized ? [normalized] : [];
    });
  });
}

export async function loadStratzMatchDetail(
  token: string,
  matchId: number,
  fetcher: typeof fetch = fetch,
): Promise<StratzMatchDetailResult> {
  if (!Number.isSafeInteger(matchId) || matchId <= 0) {
    throw new StratzError('Invalid STRATZ match ID', 400, 'STRATZ_MATCH_ID_INVALID');
  }
  const payloads: StratzDetailPayload[] = [];
  let unavailable = false;
  let error: StratzError | null = null;

  for (const [section, selection] of DETAIL_SECTIONS) {
    try {
      const response = await fetchStratzJson(
        token,
        {
          query: `query MatchDetail${toOperationSuffix(section)}($matchId: Long!) { match(id: $matchId) { ${selection} } }`,
          operationName: `MatchDetail${toOperationSuffix(section)}`,
          variables: { matchId },
        },
        fetcher,
        MAX_DETAIL_RESPONSE_BYTES,
      );
      const data = isShallowObject(response.data) ? response.data : null;
      const match = data?.match;
      if (match === null || match === undefined) {
        unavailable = true;
        break;
      }
      if (!isShallowObject(match)) {
        throw new StratzError('STRATZ returned invalid match details', 502, 'STRATZ_DETAIL_INVALID');
      }
      // Preserve the original provider response for raw payload archival.
      const payload = v.safeParse(StratzDetailPayloadSchema, { section, response });
      if (!payload.success) {
        throw new StratzError('STRATZ returned invalid match details', 502, 'STRATZ_DETAIL_INVALID');
      }
      payloads.push({ section, response });
    } catch (sectionError) {
      error = sectionError instanceof StratzError
        ? sectionError
        : new StratzError('Failed to load STRATZ detail section', 502, 'STRATZ_SECTION_FAILED');
      break;
    }
  }

  return { payloads, unavailable, error };
}

export async function fetchStratzJson(
  token: string,
  body: JsonObject,
  fetcher: typeof fetch,
  maxResponseBytes: number = MAX_RESPONSE_BYTES,
): Promise<JsonObject> {
  try {
    return await withTimeout(REQUEST_TIMEOUT_MS, async (signal) => {
      const response = await fetcher(STRATZ_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'STRATZ_API',
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        await response.body?.cancel();

        if (response.status === 403) {
          throw new StratzError('STRATZ rejected request or returned Cloudflare challenge', 403, 'STRATZ_CHALLENGE_OR_REJECTED');
        }
        if (response.status === 404) {
          throw new StratzError('STRATZ player not found', 404, 'STRATZ_PLAYER_NOT_FOUND');
        }
        if (response.status === 429) {
          throw new StratzError('STRATZ rate limit exceeded, please retry later', 429, 'STRATZ_LIMIT_EXCEEDED');
        }
        throw new StratzError('STRATZ is temporarily unavailable', 502, 'STRATZ_UNAVAILABLE');
      }

      const responseText = await readBoundedText(response, maxResponseBytes);

      let responseBody: unknown;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        throw new StratzError('STRATZ returned invalid JSON', 502, 'STRATZ_INVALID_JSON');
      }

      if (!isJsonValue(responseBody) || !isShallowObject(responseBody)) {
        throw new StratzError('STRATZ returned unexpected response', 502, 'STRATZ_UNEXPECTED_RESPONSE');
      }
      if (Array.isArray(responseBody.errors) && responseBody.errors.length > 0) {
        throw new StratzError(readGraphqlError(responseBody.errors), 502, 'STRATZ_GRAPHQL_ERROR');
      }

      return responseBody;
    });
  } catch (error) {
    if (error instanceof StratzError) {
      throw error;
    }
    if (error instanceof ResponseBodyTooLargeError) {
      throw new StratzError('STRATZ response exceeds allowed size', 502, 'STRATZ_RESPONSE_TOO_LARGE');
    }
    if (error instanceof RequestTimeoutError) {
      throw new StratzError('STRATZ did not respond in time', 504, 'STRATZ_TIMEOUT');
    }
    throw new StratzError('Failed to connect to STRATZ', 502, 'STRATZ_CONN_ERROR');
  }
}

function toOperationSuffix(section: string): string {
  return section.replace(/(^|_)([a-z])/g, (_, _prefix: string, letter: string) => letter.toUpperCase());
}

function normalizeStratzMatch(
  value: unknown,
  accountId: number,
): ArchivedPlayerMatch | null {
  if (!isShallowObject(value)) return null;

  const matchId = readSafeInteger(value.id);
  const radiantWin = readBoolean(value.didRadiantWin);
  const players = Array.isArray(value.players) ? value.players : [];
  const player = players.find(
    (candidate) => isShallowObject(candidate) && readSafeInteger(candidate.steamAccountId) === accountId,
  );

  if (matchId === null || radiantWin === null || !isShallowObject(player)) {
    return null;
  }

  const playerSlot = readSafeInteger(player.playerSlot);
  const heroId = readSafeInteger(player.heroId);
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
    averageRank: readNullableInteger(value.averageRank),
    cluster: readNullableInteger(value.clusterId) ?? readNullableInteger(value.regionId),
    version: readVersion(value.gameVersionId),
    radiantTeamId: readNullableInteger(value.radiantTeamId),
    direTeamId: readNullableInteger(value.direTeamId),
    leagueId: readNullableInteger(value.leagueId),
    seriesId: readNullableInteger(value.seriesId),
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
    rawPayload: value,
    rawPayloadKind: 'history',
    rawPayloadSchemaVersion: 'stratz.match.history.v1',
  };
}

function normalizeStratzDetailPlayer(value: unknown): NormalizedDetailPlayer | null {
  if (!isShallowObject(value)) return null;

  const matchId = readPositiveInteger(value.matchId);
  const accountId = readIntegerInRange(value.steamAccountId, 0, 4_294_967_295);
  if (matchId === null || accountId === null) return null;

  const normalized = {
    match_id: matchId,
    account_id: accountId,
    player_slot: readNullableIntegerInRange(value.playerSlot, 0, 255),
    hero_id: readNullableIntegerInRange(value.heroId, 1, 32_767),
    kills: readNullableDatabaseInteger(value.kills),
    deaths: readNullableDatabaseInteger(value.deaths),
    assists: readNullableDatabaseInteger(value.assists),
    gold_per_min: readNullableDatabaseInteger(value.goldPerMinute),
    xp_per_min: readNullableDatabaseInteger(value.experiencePerMinute),
    last_hits: readNullableDatabaseInteger(value.numLastHits),
    denies: readNullableDatabaseInteger(value.numDenies),
    hero_damage: readNullableDatabaseInteger(value.heroDamage),
    tower_damage: readNullableDatabaseInteger(value.towerDamage),
    hero_healing: readNullableDatabaseInteger(value.heroHealing),
    level: readNullableIntegerInRange(value.level, -32_768, 32_767),
    net_worth: readNullableDatabaseInteger(value.networth),
    leaver_status: readNullableIntegerInRange(readLeaverStatus(value.leaverStatus), -32_768, 32_767),
  };
  const parsed = v.safeParse(NormalizedDetailPlayerSchema, normalized);
  return parsed.success ? parsed.output : null;
}

function readGraphqlError(errors: unknown[]): string {
  const first = errors[0];
  return isShallowObject(first) && typeof first.message === 'string'
    ? first.message
    : 'STRATZ GraphQL returned error';
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
    (candidate) => isShallowObject(candidate) && readNullableInteger(candidate.partyId) === partyId,
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

function readPositiveInteger(value: unknown): number | null {
  const integer = readSafeInteger(value);
  return integer !== null && integer > 0 ? integer : null;
}

function readIntegerInRange(value: unknown, minimum: number, maximum: number): number | null {
  const integer = readSafeInteger(value);
  return integer !== null && integer >= minimum && integer <= maximum ? integer : null;
}

function readNullableIntegerInRange(value: unknown, minimum: number, maximum: number): number | null {
  return value === null || value === undefined ? null : readIntegerInRange(value, minimum, maximum);
}

function readNullableDatabaseInteger(value: unknown): number | null {
  return readNullableIntegerInRange(value, -2_147_483_648, 2_147_483_647);
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}
