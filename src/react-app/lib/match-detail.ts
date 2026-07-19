import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, Tables } from '../../shared/database.types';

export type MatchDetailPlayer = {
  key: string;
  accountId: number | null;
  playerSlot: number;
  isRadiant: boolean;
  name: string | null;
  heroId: number | null;
  kills: number;
  deaths: number;
  assists: number;
  goldPerMinute: number;
  xpPerMinute: number;
  lastHits: number;
  denies: number;
  heroDamage: number;
  towerDamage: number;
  heroHealing: number;
  netWorth: number;
  level: number;
  imp: number | null;
  role: string | null;
  award: string | null;
  itemIds: number[];
  backpackItemIds: number[];
  neutralItemId: number | null;
  abilityBuild: Array<{
    abilityId: number;
    time: number;
    level: number;
    name: string | null;
    isTalent: boolean;
  }>;
  purchaseEvents: Array<{ time: number; itemId: number }>;
  minuteSeries: {
    gold: number[];
    experience: number[];
    netWorth: number[];
    lastHits: number[];
    heroDamage: number[];
    imp: number[];
  };
  detailEvents: {
    kills: number;
    deaths: number;
    assists: number;
    wards: number;
    runes: number;
    itemUses: number;
    wardDestructions: number;
  };
  dotaPlusLevel: number | null;
  totalActions: number | null;
};

export type MatchDetailPickBan = {
  heroId: number;
  isPick: boolean;
  isRadiant: boolean | null;
  order: number | null;
};

export type MatchChatMessage = {
  key: string;
  type: 'text' | 'wheel';
  time: number;
  accountId: number;
  playerName: string | null;
  heroId: number | null;
  isRadiant: boolean | null;
  message: string | null;
  chatWheelId: number | null;
};

export type MatchDetailSnapshot = {
  matchId: number;
  startTime: number | null;
  durationSeconds: number | null;
  radiantWin: boolean | null;
  gameMode: number | null;
  lobbyType: number | null;
  averageRank: number | null;
  radiantScore: number;
  direScore: number;
  source: string;
  detailStatus: string;
  detailFetchedAt: string | null;
  players: MatchDetailPlayer[];
  pickBans: MatchDetailPickBan[];
  radiantNetworthLeads: number[];
  radiantExperienceLeads: number[];
  laneOutcomes: Array<{ lane: string; outcome: string }>;
  eventCounts: {
    chat: number | null;
    towers: number | null;
    runes: number | null;
    wards: number | null;
    buildings: number | null;
    roshan: number | null;
  };
  chatMessages: MatchChatMessage[];
  availableSections: string[];
};

type DotaMatchRow = Pick<
  Tables<'dota_matches'>,
  | 'match_id'
  | 'start_time'
  | 'duration'
  | 'radiant_win'
  | 'game_mode'
  | 'lobby_type'
  | 'average_rank'
  | 'radiant_score'
  | 'dire_score'
  | 'source'
  | 'detail_status'
  | 'detail_fetched_at'
>;

type PlayerStatsRow = Pick<
  Tables<'player_match_stats'>,
  | 'account_id'
  | 'player_slot'
  | 'hero_id'
  | 'kills'
  | 'deaths'
  | 'assists'
  | 'gold_per_min'
  | 'xp_per_min'
  | 'last_hits'
  | 'denies'
  | 'hero_damage'
  | 'tower_damage'
  | 'hero_healing'
  | 'level'
  | 'net_worth'
>;

type PayloadRow = Pick<
  Tables<'match_provider_payloads'>,
  'payload_kind' | 'payload_section' | 'payload' | 'fetched_at'
>;

export async function fetchMatchDetail(
  client: SupabaseClient<Database>,
  matchId: number,
): Promise<MatchDetailSnapshot> {
  const [matchResponse, playersResponse, payloadsResponse] = await Promise.all([
    client
      .from('dota_matches')
      .select(
        'match_id,start_time,duration,radiant_win,game_mode,lobby_type,average_rank,radiant_score,dire_score,source,detail_status,detail_fetched_at',
      )
      .eq('match_id', matchId)
      .single(),
    client
      .from('player_match_stats')
      .select(
        'account_id,player_slot,hero_id,kills,deaths,assists,gold_per_min,xp_per_min,last_hits,denies,hero_damage,tower_damage,hero_healing,level,net_worth',
      )
      .eq('match_id', matchId)
      .order('player_slot', { ascending: true }),
    client
      .from('match_provider_payloads')
      .select('payload_kind,payload_section,payload,fetched_at')
      .eq('match_id', matchId)
      .eq('provider', 'stratz')
      .in('payload_section', [
        'match',
        'metadata',
        'players',
        'player_stats',
        'match_playback',
      ]),
  ]);

  if (matchResponse.error) {
    throw new Error(`Не удалось загрузить матч: ${matchResponse.error.message}`);
  }
  if (playersResponse.error) {
    throw new Error(`Не удалось загрузить scoreboard: ${playersResponse.error.message}`);
  }
  if (payloadsResponse.error) {
    throw new Error(`Не удалось загрузить STRATZ payload: ${payloadsResponse.error.message}`);
  }

  return buildMatchDetailSnapshot(
    matchResponse.data,
    playersResponse.data ?? [],
    payloadsResponse.data ?? [],
  );
}

export function buildMatchDetailSnapshot(
  match: DotaMatchRow,
  normalizedPlayers: PlayerStatsRow[],
  payloadRows: PayloadRow[],
): MatchDetailSnapshot {
  const payloadBySection = new Map(
    payloadRows.map((row) => [row.payload_section, unwrapMatch(row.payload)]),
  );
  const history = payloadBySection.get('match') ?? null;
  const metadata = payloadBySection.get('metadata') ?? history;
  const playersPayload = payloadBySection.get('players') ?? history;
  const statsPayload = payloadBySection.get('player_stats');
  const playbackPayload = payloadBySection.get('match_playback');
  const rawPlayers = readObjectArray(playersPayload?.players);
  const rawPlayersByAccount = new Map(
    rawPlayers.flatMap((player): Array<[number, Record<string, unknown>]> => {
      const accountId = readInteger(player.steamAccountId);
      return accountId === null ? [] : [[accountId, player]];
    }),
  );
  const normalizedByAccount = new Map(
    normalizedPlayers.map((player) => [player.account_id, player]),
  );
  const playerStatsByAccount = mapNestedPlayerData(statsPayload, 'stats');
  const players = rawPlayers.map((rawPlayer, index) =>
    buildPlayer(
      rawPlayer,
      normalizedByAccount.get(readInteger(rawPlayer.steamAccountId) ?? -1),
      playerStatsByAccount.get(readInteger(rawPlayer.steamAccountId) ?? -1),
      index,
    ),
  );

  if (players.length === 0) {
    for (const [index, player] of normalizedPlayers.entries()) {
      players.push(buildPlayer({}, player, undefined, index));
    }
  }

  const radiantScore =
    match.radiant_score ??
    sumNumbers(metadata?.radiantKills) ??
    sumPlayerKills(players, true);
  const direScore =
    match.dire_score ?? sumNumbers(metadata?.direKills) ?? sumPlayerKills(players, false);

  return {
    matchId: match.match_id,
    startTime: match.start_time,
    durationSeconds: match.duration,
    radiantWin: match.radiant_win,
    gameMode: match.game_mode,
    lobbyType: match.lobby_type,
    averageRank: match.average_rank,
    radiantScore,
    direScore,
    source: match.source,
    detailStatus: match.detail_status,
    detailFetchedAt: match.detail_fetched_at,
    players: players.sort((left, right) => left.playerSlot - right.playerSlot),
    pickBans: readObjectArray(metadata?.pickBans).flatMap((value) => {
      const heroId = readInteger(value.heroId);
      return heroId === null
        ? []
        : [
            {
              heroId,
              isPick: value.isPick === true,
              isRadiant: readBoolean(value.isRadiant),
              order: readInteger(value.order),
            },
          ];
    }),
    radiantNetworthLeads: readNumberArray(metadata?.radiantNetworthLeads),
    radiantExperienceLeads: readNumberArray(metadata?.radiantExperienceLeads),
    laneOutcomes: [
      { lane: 'Top lane', outcome: readString(metadata?.topLaneOutcome) ?? 'UNKNOWN' },
      { lane: 'Mid lane', outcome: readString(metadata?.midLaneOutcome) ?? 'UNKNOWN' },
      { lane: 'Bottom lane', outcome: readString(metadata?.bottomLaneOutcome) ?? 'UNKNOWN' },
    ],
    eventCounts: {
      chat: countObjectArray(metadata?.chatEvents),
      towers: countObjectArray(metadata?.towerDeaths),
      runes: countObjectArray(readObject(playbackPayload?.playbackData)?.runeEvents),
      wards: countObjectArray(readObject(playbackPayload?.playbackData)?.wardEvents),
      buildings: countObjectArray(readObject(playbackPayload?.playbackData)?.buildingEvents),
      roshan: countObjectArray(readObject(playbackPayload?.playbackData)?.roshanEvents),
    },
    chatMessages: buildChatMessages(statsPayload, rawPlayersByAccount),
    availableSections: payloadRows
      .filter((row) => row.payload_kind === 'detail')
      .map((row) => row.payload_section)
      .sort(),
  };
}

function buildChatMessages(
  statsPayload: Record<string, unknown> | null | undefined,
  rawPlayersByAccount: Map<number, Record<string, unknown>>,
): MatchChatMessage[] {
  const messages: MatchChatMessage[] = [];

  for (const player of readObjectArray(statsPayload?.players)) {
    const stats = readObject(player.stats);
    const accountId = readInteger(stats?.steamAccountId);
    if (accountId === null || !stats) continue;
    const rawPlayer = rawPlayersByAccount.get(accountId);
    const steamAccount = readObject(rawPlayer?.steamAccount);
    const common = {
      accountId,
      playerName: readString(steamAccount?.name),
      heroId: readInteger(rawPlayer?.heroId),
      isRadiant: readBoolean(rawPlayer?.isRadiant),
    };

    for (const [index, event] of readObjectArray(stats.allTalks).entries()) {
      const time = readInteger(event.time);
      const message = readString(event.message);
      if (time === null || message === null) continue;
      messages.push({
        key: `text-${accountId}-${time}-${index}`,
        type: 'text',
        time,
        ...common,
        message,
        chatWheelId: null,
      });
    }

    for (const [index, event] of readObjectArray(stats.chatWheels).entries()) {
      const time = readInteger(event.time);
      const chatWheelId = readInteger(event.chatWheelId);
      if (time === null || chatWheelId === null) continue;
      messages.push({
        key: `wheel-${accountId}-${time}-${index}`,
        type: 'wheel',
        time,
        ...common,
        message: null,
        chatWheelId,
      });
    }
  }

  return messages.sort((left, right) => left.time - right.time || left.key.localeCompare(right.key));
}

function buildPlayer(
  raw: Record<string, unknown>,
  normalized: PlayerStatsRow | undefined,
  detailStats: Record<string, unknown> | undefined,
  index: number,
): MatchDetailPlayer {
  const playerSlot = readInteger(raw.playerSlot) ?? normalized?.player_slot ?? index;
  const accountId = readInteger(raw.steamAccountId) ?? normalized?.account_id ?? null;
  const steamAccount = readObject(raw.steamAccount);
  const abilityBuild = readObjectArray(raw.abilities).flatMap((ability) => {
    const abilityId = readInteger(ability.abilityId);
    if (abilityId === null) return [];
    const abilityType = readObject(ability.abilityType);
    return [{
      abilityId,
      time: readInteger(ability.time) ?? 0,
      level: readInteger(ability.level) ?? 0,
      name: readString(abilityType?.name),
      isTalent: ability.isTalent === true,
    }];
  });
  const purchases = readObjectArray(detailStats?.itemPurchases).flatMap((purchase) => {
    const time = readInteger(purchase.time);
    const itemId = readInteger(purchase.itemId);
    return time === null || itemId === null ? [] : [{ time, itemId }];
  });
  const dotaPlus = readObject(raw.dotaPlus);

  return {
    key: accountId === null ? `slot-${playerSlot}` : String(accountId),
    accountId,
    playerSlot,
    isRadiant: readBoolean(raw.isRadiant) ?? playerSlot < 128,
    name: readString(steamAccount?.name),
    heroId: readInteger(raw.heroId) ?? normalized?.hero_id ?? null,
    kills: readInteger(raw.kills) ?? normalized?.kills ?? 0,
    deaths: readInteger(raw.deaths) ?? normalized?.deaths ?? 0,
    assists: readInteger(raw.assists) ?? normalized?.assists ?? 0,
    goldPerMinute: readInteger(raw.goldPerMinute) ?? normalized?.gold_per_min ?? 0,
    xpPerMinute: readInteger(raw.experiencePerMinute) ?? normalized?.xp_per_min ?? 0,
    lastHits: readInteger(raw.numLastHits) ?? normalized?.last_hits ?? 0,
    denies: readInteger(raw.numDenies) ?? normalized?.denies ?? 0,
    heroDamage: readInteger(raw.heroDamage) ?? normalized?.hero_damage ?? 0,
    towerDamage: readInteger(raw.towerDamage) ?? normalized?.tower_damage ?? 0,
    heroHealing: readInteger(raw.heroHealing) ?? normalized?.hero_healing ?? 0,
    netWorth: readInteger(raw.networth) ?? normalized?.net_worth ?? 0,
    level: readInteger(raw.level) ?? normalized?.level ?? 0,
    imp: readInteger(raw.imp),
    role: readString(raw.role) ?? readString(raw.position),
    award: readString(raw.award),
    itemIds: readItemIds(raw, ['item0Id', 'item1Id', 'item2Id', 'item3Id', 'item4Id', 'item5Id']),
    backpackItemIds: readItemIds(raw, ['backpack0Id', 'backpack1Id', 'backpack2Id']),
    neutralItemId: readInteger(raw.neutral0Id),
    abilityBuild,
    purchaseEvents: purchases,
    minuteSeries: {
      gold: readNumberArray(detailStats?.goldPerMinute),
      experience: readNumberArray(detailStats?.experiencePerMinute),
      netWorth: readNumberArray(detailStats?.networthPerMinute),
      lastHits: readNumberArray(detailStats?.lastHitsPerMinute),
      heroDamage: readNumberArray(detailStats?.heroDamagePerMinute),
      imp: readNumberArray(detailStats?.impPerMinute),
    },
    detailEvents: {
      kills: readObjectArray(detailStats?.killEvents).length,
      deaths: readObjectArray(detailStats?.deathEvents).length,
      assists: readObjectArray(detailStats?.assistEvents).length,
      wards: readObjectArray(detailStats?.wards).length,
      runes: readObjectArray(detailStats?.runes).length,
      itemUses: sumObjectField(readObjectArray(detailStats?.itemUsed), 'count'),
      wardDestructions: readObjectArray(detailStats?.wardDestruction).length,
    },
    dotaPlusLevel: readInteger(dotaPlus?.level),
    totalActions: readInteger(dotaPlus?.totalActions),
  };
}

function mapNestedPlayerData(
  match: Record<string, unknown> | null | undefined,
  nestedKey: string,
): Map<number, Record<string, unknown>> {
  const result = new Map<number, Record<string, unknown>>();
  for (const player of readObjectArray(match?.players)) {
    const nested = readObject(player[nestedKey]);
    const accountId =
      readInteger(player.steamAccountId) ?? readInteger(nested?.steamAccountId);
    if (accountId !== null && nested) {
      result.set(accountId, nested);
    }
  }
  return result;
}

function unwrapMatch(payload: Json): Record<string, unknown> | null {
  const root = readObject(payload);
  if (!root) return null;
  const data = readObject(root.data);
  return readObject(data?.match) ?? root;
}

function readItemIds(value: Record<string, unknown>, keys: string[]): number[] {
  return keys.flatMap((key) => {
    const itemId = readInteger(value[key]);
    return itemId === null || itemId <= 0 ? [] : [itemId];
  });
}

function sumPlayerKills(players: MatchDetailPlayer[], radiant: boolean): number {
  return players.reduce(
    (total, player) => total + (player.isRadiant === radiant ? player.kills : 0),
    0,
  );
}

function sumNumbers(value: unknown): number | null {
  const numbers = readNumberArray(value);
  return numbers.length === 0 ? null : numbers.reduce((total, number) => total + number, 0);
}

function readNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry))
    : [];
}

function readObjectArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => readObject(entry) !== null)
    : [];
}

function countObjectArray(value: unknown): number | null {
  return Array.isArray(value) ? readObjectArray(value).length : null;
}

function sumObjectField(values: Array<Record<string, unknown>>, field: string): number {
  return values.reduce((total, value) => total + (readInteger(value[field]) ?? 0), 0);
}

function readObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}
