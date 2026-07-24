import { createClient } from '@supabase/supabase-js';
import type { AppDatabase } from '../../shared/app-database';
import {
  buildMatchDetailSnapshot,
  type DotaMatchRow,
  type MatchDetailSnapshot,
  type PlayerStatsRow,
} from '../../shared/match-detail';
import {
  parseProviderPayloadRow,
  type ProviderPayloadRow,
} from '../../shared/contracts/provider-payload';

type MatchDetailData = {
  match: DotaMatchRow | null;
  players: PlayerStatsRow[];
  payloadRows: ProviderPayloadRow[];
};

type Dependencies = {
  loadMatchDetailData: (env: Env, matchId: number) => Promise<MatchDetailData>;
};

const detailPayloadSections = [
  'match',
  'metadata',
  'players',
  'player_stats',
  'player_playback',
  'match_playback',
];

const defaultDependencies: Dependencies = {
  loadMatchDetailData,
};

// This is the only read path that may interpret archived provider payloads.
export async function readPublicMatchDetail(
  env: Env,
  matchId: number,
  dependencies: Dependencies = defaultDependencies,
): Promise<MatchDetailSnapshot | null> {
  const { match, players, payloadRows } = await dependencies.loadMatchDetailData(env, matchId);
  return match ? buildMatchDetailSnapshot(match, players, payloadRows) : null;
}

async function loadMatchDetailData(env: Env, matchId: number): Promise<MatchDetailData> {
  const client = createClient<AppDatabase>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
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
      .in('payload_section', detailPayloadSections),
  ]);

  if (matchResponse.error) {
    throw new Error(`Failed to load match: ${matchResponse.error.message}`);
  }
  if (playersResponse.error) {
    throw new Error(`Failed to load scoreboard: ${playersResponse.error.message}`);
  }
  if (payloadsResponse.error) {
    throw new Error(`Failed to load archived match detail: ${payloadsResponse.error.message}`);
  }

  return {
    match: matchResponse.data,
    players: playersResponse.data ?? [],
    payloadRows: (payloadsResponse.data ?? []).flatMap((row) => {
      const payload = parseProviderPayloadRow(row);
      return payload ? [payload] : [];
    }),
  };
}
