import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../../shared/database.types';

export type ArchiveMatch = {
  matchId: number;
  startTime: number | null;
  durationSeconds: number | null;
  radiantWin: boolean | null;
  gameMode: number | null;
  lobbyType: number | null;
  averageRank: number | null;
  radiantScore: number | null;
  direScore: number | null;
  playerSlot: number | null;
  heroId: number | null;
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
  won: boolean | null;
};

export type ArchiveSyncState = Pick<
  Tables<'account_match_sync_state'>,
  | 'status'
  | 'history_provider'
  | 'backfill_offset'
  | 'backfill_complete'
  | 'last_attempt_at'
  | 'last_success_at'
  | 'next_retry_at'
  | 'consecutive_failures'
  | 'last_error_message'
  | 'newest_match_id'
  | 'oldest_match_id'
>;

export type ArchiveSnapshot = {
  matches: ArchiveMatch[];
  syncState: ArchiveSyncState | null;
};

type UserSupabaseClient = SupabaseClient<Database>;

const PAGE_SIZE = 1_000;
const ID_CHUNK_SIZE = 200;

const MATCH_SELECT =
  'match_id,start_time,duration,radiant_win,game_mode,lobby_type,average_rank,radiant_score,dire_score' as const;
const PLAYER_SELECT =
  'match_id,player_slot,hero_id,hero_variant,kills,deaths,assists,gold_per_min,xp_per_min,last_hits,denies,hero_damage,tower_damage,hero_healing,level,net_worth,leaver_status,party_size,lane,lane_role,is_roaming' as const;

export async function fetchArchiveSnapshot(
  client: UserSupabaseClient,
  trackedAccountId: string,
  dotaAccountId: number,
): Promise<ArchiveSnapshot> {
  const links = await readAllMatchLinks(client, trackedAccountId);
  const matchIds = links.map((link) => link.match_id);

  const [matches, playerStats, syncState] = await Promise.all([
    readMatches(client, matchIds),
    readPlayerStats(client, matchIds, dotaAccountId),
    readSyncState(client, dotaAccountId),
  ]);

  const statsByMatch = new Map(playerStats.map((stats) => [stats.match_id, stats]));
  const matchesById = new Map(matches.map((match) => [match.match_id, match]));

  const archiveMatches = matchIds.flatMap((matchId): ArchiveMatch[] => {
    const match = matchesById.get(matchId);
    const stats = statsByMatch.get(matchId);
    if (!match || !stats) {
      return [];
    }

    const isRadiant = stats.player_slot === null ? null : stats.player_slot < 128;
    const won =
      isRadiant === null || match.radiant_win === null
        ? null
        : isRadiant === match.radiant_win;

    return [
      {
        matchId: match.match_id,
        startTime: match.start_time,
        durationSeconds: match.duration,
        radiantWin: match.radiant_win,
        gameMode: match.game_mode,
        lobbyType: match.lobby_type,
        averageRank: match.average_rank,
        radiantScore: match.radiant_score,
        direScore: match.dire_score,
        playerSlot: stats.player_slot,
        heroId: stats.hero_id,
        heroVariant: stats.hero_variant,
        kills: stats.kills,
        deaths: stats.deaths,
        assists: stats.assists,
        goldPerMinute: stats.gold_per_min,
        xpPerMinute: stats.xp_per_min,
        lastHits: stats.last_hits,
        denies: stats.denies,
        heroDamage: stats.hero_damage,
        towerDamage: stats.tower_damage,
        heroHealing: stats.hero_healing,
        level: stats.level,
        netWorth: stats.net_worth,
        leaverStatus: stats.leaver_status,
        partySize: stats.party_size,
        lane: stats.lane,
        laneRole: stats.lane_role,
        isRoaming: stats.is_roaming,
        won,
      },
    ];
  });

  archiveMatches.sort((left, right) => (right.startTime ?? 0) - (left.startTime ?? 0));

  return { matches: archiveMatches, syncState };
}

async function readAllMatchLinks(
  client: UserSupabaseClient,
  trackedAccountId: string,
): Promise<Array<Pick<Tables<'tracked_account_matches'>, 'match_id'>>> {
  const rows: Array<Pick<Tables<'tracked_account_matches'>, 'match_id'>> = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from('tracked_account_matches')
      .select('match_id')
      .eq('tracked_account_id', trackedAccountId)
      .order('match_id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Не удалось загрузить связи архива: ${error.message}`);
    }

    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) {
      return rows;
    }
  }
}

async function readMatches(
  client: UserSupabaseClient,
  matchIds: number[],
): Promise<Pick<Tables<'dota_matches'>, MatchField>[]> {
  const rows: Pick<Tables<'dota_matches'>, MatchField>[] = [];

  for (const chunk of chunkIds(matchIds)) {
    const { data, error } = await client
      .from('dota_matches')
      .select(MATCH_SELECT)
      .in('match_id', chunk);

    if (error) {
      throw new Error(`Не удалось загрузить архив матчей: ${error.message}`);
    }

    rows.push(...(data ?? []));
  }

  return rows;
}

async function readPlayerStats(
  client: UserSupabaseClient,
  matchIds: number[],
  dotaAccountId: number,
): Promise<Pick<Tables<'player_match_stats'>, PlayerField>[]> {
  const rows: Pick<
    Tables<'player_match_stats'>,
    PlayerField
  >[] = [];

  for (const chunk of chunkIds(matchIds)) {
    const { data, error } = await client
      .from('player_match_stats')
      .select(PLAYER_SELECT)
      .eq('account_id', dotaAccountId)
      .in('match_id', chunk);

    if (error) {
      throw new Error(`Не удалось загрузить статистику игрока: ${error.message}`);
    }

    rows.push(...(data ?? []));
  }

  return rows;
}

type MatchField =
  | 'match_id'
  | 'start_time'
  | 'duration'
  | 'radiant_win'
  | 'game_mode'
  | 'lobby_type'
  | 'average_rank'
  | 'radiant_score'
  | 'dire_score';

type PlayerField =
  | 'match_id'
  | 'player_slot'
  | 'hero_id'
  | 'hero_variant'
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
  | 'leaver_status'
  | 'party_size'
  | 'lane'
  | 'lane_role'
  | 'is_roaming';

async function readSyncState(
  client: UserSupabaseClient,
  dotaAccountId: number,
): Promise<ArchiveSyncState | null> {
  const { data, error } = await client
    .from('account_match_sync_state')
    .select(
      'status,history_provider,backfill_offset,backfill_complete,last_attempt_at,last_success_at,next_retry_at,consecutive_failures,last_error_message,newest_match_id,oldest_match_id',
    )
    .eq('dota_account_id', dotaAccountId)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось загрузить состояние синхронизации: ${error.message}`);
  }

  return data;
}

function chunkIds(ids: number[]): number[][] {
  const chunks: number[][] = [];
  for (let index = 0; index < ids.length; index += ID_CHUNK_SIZE) {
    chunks.push(ids.slice(index, index + ID_CHUNK_SIZE));
  }
  return chunks;
}
