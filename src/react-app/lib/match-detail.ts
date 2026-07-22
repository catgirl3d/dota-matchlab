import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '../../shared/database.types';
import type { AppDatabase } from '../../shared/app-database';
import {
  parseProviderPayloadRow,
  routeStratzPayload,
  type ProviderPayloadRow,
} from '../../shared/contracts/provider-payload';
import { isShallowObject, readSafeInteger as readInteger } from '../../shared/contracts/json';
import { abilityIconSlugs } from './ability-icon-slugs';
import { repairAbilityEvent, type AbilityEventSource } from './ability-event-repairs';
import { getPermanentUpgradeItemIds, type PermanentUpgradeItemIds } from './permanent-upgrades';

export type PlayerPosition = 1 | 2 | 3 | 4 | 5;
export type PlayerLane = 1 | 2 | 3;

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
  position: PlayerPosition | null;
  lane: PlayerLane | null;
  award: string | null;
  itemIds: number[];
  backpackItemIds: number[];
  neutralItemId: number | null;
  permanentUpgradeItemIds: PermanentUpgradeItemIds;
  abilityBuild: Array<{
    abilityId: number;
    time: number;
    level: number;
    name: string | null;
    isTalent: boolean;
  }>;
  hasAbilityBuildData: boolean;
  purchaseEvents: Array<{ time: number; itemId: number }>;
  hasPurchaseEventsData: boolean;
  minuteSeries: {
    gold: number[];
    experience: number[];
    netWorth: number[];
    lastHits: number[];
    denies: number[];
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
  combatEvents: {
    kills: Array<{ time: number }>;
    assists: Array<{ time: number }>;
    deaths: Array<{ time: number; timeDead: number | null }>;
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

export type MatchTimelineParticipant = {
  accountId: number | null;
  heroId: number | null;
  name: string | null;
  isRadiant: boolean | null;
};

export type MatchTimelineEvent = {
  key: string;
  time: number;
  type: 'kill' | 'tower';
  actor: MatchTimelineParticipant | null;
  target: MatchTimelineParticipant | null;
  isRadiant: boolean | null;
  targetIsRadiant: boolean | null;
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
  timelineEvents: MatchTimelineEvent[];
  availableSections: string[];
  rosterStatus: 'complete' | 'incomplete';
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
  | 'lane'
  | 'lane_role'
  | 'level'
  | 'net_worth'
>;

type PayloadRow = ProviderPayloadRow;

export async function fetchMatchDetail(
  client: SupabaseClient<AppDatabase>,
  matchId: number,
): Promise<MatchDetailSnapshot | null> {
  const [matchResponse, playersResponse, payloadsResponse] = await Promise.all([
    client
      .from('dota_matches')
      .select(
        'match_id,start_time,duration,radiant_win,game_mode,lobby_type,average_rank,radiant_score,dire_score,source,detail_status,detail_fetched_at',
      )
      .eq('match_id', matchId)
      .maybeSingle(),
    client
      .from('player_match_stats')
      .select(
        'account_id,player_slot,hero_id,kills,deaths,assists,gold_per_min,xp_per_min,last_hits,denies,hero_damage,tower_damage,hero_healing,lane,lane_role,level,net_worth',
      )
      .eq('match_id', matchId)
      .order('player_slot', { ascending: true }),
    client
      .from('match_provider_payloads')
      .select('provider,payload_kind,payload_section,payload,schema_version,fetched_at')
      .eq('match_id', matchId)
      .eq('provider', 'stratz')
      .in('payload_section', [
        'match',
        'metadata',
        'players',
        'player_stats',
        'player_playback',
        'match_playback',
      ]),
  ]);

  if (matchResponse.error) {
    throw new Error(`Failed to load match: ${matchResponse.error.message}`);
  }
  if (playersResponse.error) {
    throw new Error(`Failed to load scoreboard: ${playersResponse.error.message}`);
  }
  if (payloadsResponse.error) {
    throw new Error(`Failed to load STRATZ payload: ${payloadsResponse.error.message}`);
  }
  if (!matchResponse.data) return null;

  return buildMatchDetailSnapshot(
    matchResponse.data,
    playersResponse.data ?? [],
    (payloadsResponse.data ?? []).flatMap((row) => {
      const payload = parseProviderPayloadRow(row);
      return payload ? [payload] : [];
    }),
  );
}

export function buildMatchDetailSnapshot(
  match: DotaMatchRow,
  normalizedPlayers: PlayerStatsRow[],
  payloadRows: PayloadRow[],
): MatchDetailSnapshot {
  const routedPayloads = payloadRows.flatMap((row) => {
    const routed = routeStratzPayload(row);
    return routed ? [routed] : [];
  });
  const history = routedPayloads.find((payload) => payload.kind === 'history')?.match ?? null;
  const detailBySection = new Map(
    routedPayloads
      .filter((payload) => payload.kind === 'detail')
      .map((payload) => [payload.section, payload.match]),
  );
  const metadata = detailBySection.get('metadata') ?? history;
  const detailPlayersPayload = detailBySection.get('players');
  const statsPayload = detailBySection.get('player_stats');
  const playerPlaybackPayload = detailBySection.get('player_playback');
  const playbackPayload = detailBySection.get('match_playback');
  const historyPlayers = readObjectArray(history?.players);
  const detailPlayers = readObjectArray(detailPlayersPayload?.players);
  const rawPlayers = mergeRoster(detailPlayers, historyPlayers);
  const rawPlayersByAccount = new Map(
    rawPlayers.flatMap((player): Array<[number, Record<string, unknown>]> => {
      const accountId = readInteger(player.steamAccountId);
      return accountId === null ? [] : [[accountId, player]];
    }),
  );
  const playerStatsByAccount = mapNestedPlayerData(statsPayload, 'stats');
  const playerPlaybackByAccount = mapPlayerPlaybackData(playerPlaybackPayload);
  const players = buildRosterPlayers(rawPlayers, normalizedPlayers, playerStatsByAccount, playerPlaybackByAccount);

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
    timelineEvents: buildTimelineEvents(metadata, statsPayload, rawPlayersByAccount),
    availableSections: routedPayloads
      .filter((payload) => payload.kind === 'detail')
      .map((payload) => payload.section)
      .sort(),
    rosterStatus: players.length >= 10 ? 'complete' : 'incomplete',
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

function buildTimelineEvents(
  metadata: Record<string, unknown> | null,
  statsPayload: Record<string, unknown> | null | undefined,
  rawPlayersByAccount: Map<number, Record<string, unknown>>,
): MatchTimelineEvent[] {
  const participantIndex = buildTimelineParticipantIndex(rawPlayersByAccount);
  const events = [
    ...readTowerTimelineEvents(metadata?.towerDeaths, participantIndex),
    ...readKillTimelineEvents(statsPayload, participantIndex),
  ];

  return events.sort((left, right) => left.time - right.time || left.key.localeCompare(right.key));
}

function readTowerTimelineEvents(
  value: unknown,
  participantIndex: TimelineParticipantIndex,
): MatchTimelineEvent[] {
  return readObjectArray(value).flatMap((event, index) => {
    const time = readInteger(event.time);
    const targetIsRadiant = readBoolean(event.isRadiant);
    const actor = readTimelineParticipant(event.attacker, participantIndex);
    return time === null
      ? []
      : [{
          key: `tower-${time}-${index}`,
          time,
          type: 'tower',
          actor,
          target: null,
          isRadiant: actor?.isRadiant ?? (targetIsRadiant === null ? null : !targetIsRadiant),
          targetIsRadiant,
        }];
  });
}

function readKillTimelineEvents(
  statsPayload: Record<string, unknown> | null | undefined,
  participantIndex: TimelineParticipantIndex,
): MatchTimelineEvent[] {
  const events: MatchTimelineEvent[] = [];

  for (const player of readObjectArray(statsPayload?.players)) {
    const stats = readObject(player.stats);
    const accountId = readInteger(player.steamAccountId) ?? readInteger(stats?.steamAccountId);
    const actor = accountId === null ? null : participantIndex.byAccount.get(accountId) ?? null;

    for (const [index, event] of readObjectArray(stats?.killEvents).entries()) {
      const time = readInteger(event.time);
      if (time === null) continue;
      const target = readTimelineParticipant(event.target, participantIndex);
      events.push({
        key: `kill-${accountId ?? 'unknown'}-${time}-${index}`,
        time,
        type: 'kill',
        actor,
        target,
        isRadiant: actor?.isRadiant ?? null,
        targetIsRadiant: target?.isRadiant ?? null,
      });
    }
  }

  return events;
}

type TimelineParticipantIndex = {
  byAccount: Map<number, MatchTimelineParticipant>;
  byHero: Map<number, MatchTimelineParticipant>;
};

function buildTimelineParticipantIndex(
  rawPlayersByAccount: Map<number, Record<string, unknown>>,
): TimelineParticipantIndex {
  const byAccount = new Map<number, MatchTimelineParticipant>();
  const byHero = new Map<number, MatchTimelineParticipant>();

  for (const [accountId, rawPlayer] of rawPlayersByAccount) {
    const participant = {
      accountId,
      heroId: readInteger(rawPlayer.heroId),
      name: readString(readObject(rawPlayer.steamAccount)?.name),
      isRadiant: readBoolean(rawPlayer.isRadiant),
    };
    byAccount.set(accountId, participant);
    if (participant.heroId !== null) {
      byHero.set(participant.heroId, participant);
    }
  }

  return { byAccount, byHero };
}

function readTimelineParticipant(
  value: unknown,
  participantIndex: TimelineParticipantIndex,
): MatchTimelineParticipant | null {
  const identifier = readInteger(value);
  if (identifier === null) return null;
  return participantIndex.byAccount.get(identifier) ?? participantIndex.byHero.get(identifier) ?? null;
}

function buildPlayer(
  raw: Record<string, unknown>,
  normalized: PlayerStatsRow | undefined,
  detailStats: Record<string, unknown> | undefined,
  playerPlayback: Record<string, unknown> | undefined,
  index: number,
): MatchDetailPlayer {
  const playerSlot = readInteger(raw.playerSlot) ?? normalized?.player_slot ?? index;
  const accountId = readInteger(raw.steamAccountId) ?? normalized?.account_id ?? null;
  const heroId = readInteger(raw.heroId) ?? normalized?.hero_id ?? null;
  const steamAccount = readObject(raw.steamAccount);
  const playbackData = readObject(playerPlayback?.playbackData) ?? playerPlayback;
  const abilityNames = mergeAbilityNames(
    readAbilityNames(raw.abilities),
    readAbilityNames(playerPlayback?.abilities),
  );
  const playbackAbilities = readAbilityEvents(
    playbackData?.abilityLearnEvents,
    { source: 'playback', heroId },
    abilityNames,
  );
  const fallbackAbilityBuild = readAbilityEvents(raw.abilities, { source: 'player-abilities', heroId });
  const playbackPurchases = readPurchaseEvents(playbackData?.purchaseEvents);
  const fallbackPurchases = readPurchaseEvents(detailStats?.itemPurchases);
  const hasPlaybackAbilities = Array.isArray(playbackData?.abilityLearnEvents);
  const hasFallbackAbilities = Array.isArray(raw.abilities);
  const hasPlaybackPurchases = Array.isArray(playbackData?.purchaseEvents);
  const hasFallbackPurchases = Array.isArray(detailStats?.itemPurchases);
  const dotaPlus = readObject(raw.dotaPlus);

  return {
    key: accountId === null ? `slot-${playerSlot}` : String(accountId),
    accountId,
    playerSlot,
    isRadiant: readBoolean(raw.isRadiant) ?? playerSlot < 128,
    name: readString(steamAccount?.name),
    heroId,
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
    position: readPlayerPosition(raw.position) ?? readPlayerPosition(normalized?.lane_role),
    lane: readPlayerLane(raw.lane) ?? readPlayerLane(normalized?.lane),
    award: readString(raw.award),
    itemIds: readItemIds(raw, ['item0Id', 'item1Id', 'item2Id', 'item3Id', 'item4Id', 'item5Id']),
    backpackItemIds: readItemIds(raw, ['backpack0Id', 'backpack1Id', 'backpack2Id']),
    neutralItemId: readInteger(raw.neutral0Id),
    permanentUpgradeItemIds: getPermanentUpgradeItemIds(
      fallbackPurchases,
      readItemIdsFromEvents(detailStats?.matchPlayerBuffEvent),
    ),
    abilityBuild: hasPlaybackAbilities ? playbackAbilities : fallbackAbilityBuild,
    hasAbilityBuildData: hasPlaybackAbilities || hasFallbackAbilities,
    purchaseEvents: hasPlaybackPurchases ? playbackPurchases : fallbackPurchases,
    hasPurchaseEventsData: hasPlaybackPurchases || hasFallbackPurchases,
    minuteSeries: {
      gold: readNumberArray(detailStats?.goldPerMinute),
      experience: readNumberArray(detailStats?.experiencePerMinute),
      netWorth: readNumberArray(detailStats?.networthPerMinute),
      lastHits: readNumberArray(detailStats?.lastHitsPerMinute),
      denies: readNumberArray(detailStats?.deniesPerMinute),
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
    combatEvents: {
      kills: readObjectArray(detailStats?.killEvents).flatMap((event) => {
        const time = readInteger(event.time);
        return time === null ? [] : [{ time }];
      }),
      assists: readObjectArray(detailStats?.assistEvents).flatMap((event) => {
        const time = readInteger(event.time);
        return time === null ? [] : [{ time }];
      }),
      deaths: readObjectArray(detailStats?.deathEvents).flatMap((event) => {
        const time = readInteger(event.time);
        return time === null ? [] : [{ time, timeDead: readInteger(event.timeDead) }];
      }),
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

function mapPlayerPlaybackData(
  payload: Record<string, unknown> | null | undefined,
): Map<number, Record<string, unknown>> {
  const playbackPlayers = readObjectArray(payload?.players);
  const result = new Map<number, Record<string, unknown>>();

  for (const player of playbackPlayers) {
    const playbackData = readObject(player.playbackData);
    const accountId = readInteger(player.steamAccountId);
    if (accountId !== null && playbackData) result.set(accountId, player);
  }

  return result;
}

function readAbilityEvents(
  value: unknown,
  context: { source: AbilityEventSource; heroId: number | null },
  abilityNames: Map<number, string> = new Map(),
): MatchDetailPlayer['abilityBuild'] {
  return readObjectArray(value)
    .flatMap((ability) => {
      const abilityId = readInteger(ability.abilityId);
      if (abilityId === null) return [];
      const isTalent = ability.isTalent === true;
      const repairedAbility = repairAbilityEvent({
        ...context,
        abilityId,
        gameVersionId: readInteger(ability.gameVersionId),
        isTalent,
      });
      return [{
        abilityId: repairedAbility.abilityId,
        time: readInteger(ability.time) ?? 0,
        level: readInteger(ability.levelObtained) ?? readInteger(ability.level) ?? 0,
        name:
          repairedAbility.name ??
          readString(readObject(ability.abilityType)?.name) ??
          abilityNames.get(repairedAbility.abilityId) ??
          abilityIconSlugs[repairedAbility.abilityId] ??
          null,
        isTalent,
      }];
    })
    .sort((left, right) => left.time - right.time || left.abilityId - right.abilityId || left.level - right.level);
}

function readAbilityNames(value: unknown): Map<number, string> {
  const names = new Map<number, string>();
  for (const ability of readObjectArray(value)) {
    const abilityId = readInteger(ability.abilityId);
    const name = readString(readObject(ability.abilityType)?.name);
    if (abilityId !== null && name !== null) names.set(abilityId, name);
  }
  return names;
}

function mergeAbilityNames(
  detailNames: Map<number, string>,
  playbackNames: Map<number, string>,
): Map<number, string> {
  return new Map([...playbackNames, ...detailNames]);
}

function buildRosterPlayers(
  rawPlayers: Array<Record<string, unknown>>,
  normalizedPlayers: PlayerStatsRow[],
  playerStatsByAccount: Map<number, Record<string, unknown>>,
  playerPlaybackByAccount: Map<number, Record<string, unknown>>,
): MatchDetailPlayer[] {
  const usedNormalized = new Set<PlayerStatsRow>();
  const players = rawPlayers.map((rawPlayer, index) => {
    const accountId = readInteger(rawPlayer.steamAccountId);
    const playerSlot = readInteger(rawPlayer.playerSlot);
    const normalized = accountId === null
      ? normalizedPlayers.find((player) => !usedNormalized.has(player) && playerSlot !== null && player.player_slot === playerSlot)
      : normalizedPlayers.find((player) => !usedNormalized.has(player) && player.account_id === accountId);
    if (normalized) usedNormalized.add(normalized);
    const resolvedAccountId = accountId ?? normalized?.account_id ?? null;
    return buildPlayer(
      rawPlayer,
      normalized,
      resolvedAccountId === null ? undefined : playerStatsByAccount.get(resolvedAccountId),
      resolvedAccountId === null ? undefined : playerPlaybackByAccount.get(resolvedAccountId),
      index,
    );
  });

  for (const [index, normalized] of normalizedPlayers.entries()) {
    if (usedNormalized.has(normalized)) continue;
    players.push(buildPlayer({}, normalized, playerStatsByAccount.get(normalized.account_id), playerPlaybackByAccount.get(normalized.account_id), rawPlayers.length + index));
  }
  return players;
}

function mergeRoster(
  detailPlayers: Array<Record<string, unknown>>,
  historyPlayers: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const merged = [...historyPlayers];
  for (const detailPlayer of detailPlayers) {
    const detailAccountId = readInteger(detailPlayer.steamAccountId);
    const detailSlot = readInteger(detailPlayer.playerSlot);
    const index = merged.findIndex((historyPlayer) => {
      const historyAccountId = readInteger(historyPlayer.steamAccountId);
      if (detailAccountId !== null && historyAccountId !== null) return detailAccountId === historyAccountId;
      if (detailAccountId !== null || historyAccountId !== null) {
        return detailSlot !== null && detailSlot === readInteger(historyPlayer.playerSlot);
      }
      return detailSlot !== null && detailSlot === readInteger(historyPlayer.playerSlot);
    });
    if (index === -1) {
      merged.push(detailPlayer);
    } else {
      merged[index] = { ...merged[index], ...detailPlayer };
    }
  }
  return merged;
}

function readPurchaseEvents(value: unknown): MatchDetailPlayer['purchaseEvents'] {
  return readObjectArray(value)
    .flatMap((purchase) => {
      const time = readInteger(purchase.time);
      const itemId = readInteger(purchase.itemId);
      return time === null || itemId === null ? [] : [{ time, itemId }];
    })
    .sort((left, right) => left.time - right.time || left.itemId - right.itemId);
}

function readItemIds(value: Record<string, unknown>, keys: string[]): number[] {
  return keys.flatMap((key) => {
    const itemId = readInteger(value[key]);
    return itemId === null || itemId <= 0 ? [] : [itemId];
  });
}

function readItemIdsFromEvents(value: unknown): number[] {
  return readObjectArray(value).flatMap((event) => {
    const itemId = readInteger(event.itemId);
    return itemId === null || itemId <= 0 ? [] : [itemId];
  });
}

function readPlayerPosition(value: unknown): PlayerPosition | null {
  const numericPosition = readInteger(value);
  if (numericPosition !== null && numericPosition >= 1 && numericPosition <= 5) {
    return numericPosition as PlayerPosition;
  }

  const namedPosition = readString(value);
  const match = /^POSITION_([1-5])$/.exec(namedPosition ?? '');
  return match ? Number(match[1]) as PlayerPosition : null;
}

function readPlayerLane(value: unknown): PlayerLane | null {
  const numericLane = readInteger(value);
  if (numericLane !== null && numericLane >= 1 && numericLane <= 3) {
    return numericLane as PlayerLane;
  }

  const namedLane = readString(value);
  const laneMap: Record<string, PlayerLane> = {
    SAFE_LANE: 1,
    MID_LANE: 2,
    OFF_LANE: 3,
  };
  return namedLane === null ? null : laneMap[namedLane] ?? null;
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
  return isShallowObject(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}
