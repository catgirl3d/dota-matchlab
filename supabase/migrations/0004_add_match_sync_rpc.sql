alter table public.account_match_sync_state
  add column lease_token uuid,
  add column lease_expires_at timestamptz;

create index account_match_sync_state_lease_idx
  on public.account_match_sync_state (dota_account_id, lease_expires_at);

create or replace function public.claim_match_sync(
  p_actor_user_id text,
  p_tracked_account_id uuid,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  resolved_account_id bigint;
  sync_status text;
  sync_offset integer;
  sync_complete boolean;
  current_lease_expires_at timestamptz;
  next_lease_token uuid;
begin
  if p_lease_seconds not between 30 and 600 then
    raise exception 'Lease duration is outside the allowed range';
  end if;

  select tracked_account.dota_account_id
  into resolved_account_id
  from public.tracked_accounts as tracked_account
  where tracked_account.id = p_tracked_account_id
    and tracked_account.user_id = p_actor_user_id;

  if not found or resolved_account_id is null then
    return jsonb_build_object(
      'owned', false,
      'claimed', false
    );
  end if;

  insert into public.account_match_sync_state (dota_account_id)
  values (resolved_account_id)
  on conflict (dota_account_id) do nothing;

  insert into public.tracked_account_matches (tracked_account_id, match_id)
  select p_tracked_account_id, player_stats.match_id
  from public.player_match_stats as player_stats
  where player_stats.account_id = resolved_account_id
  on conflict (tracked_account_id, match_id) do nothing;

  select
    sync_state.status,
    sync_state.backfill_offset,
    sync_state.backfill_complete,
    sync_state.lease_expires_at
  into
    sync_status,
    sync_offset,
    sync_complete,
    current_lease_expires_at
  from public.account_match_sync_state as sync_state
  where sync_state.dota_account_id = resolved_account_id
  for update;

  if sync_status = 'syncing'
    and current_lease_expires_at is not null
    and current_lease_expires_at > now()
  then
    return jsonb_build_object(
      'owned', true,
      'claimed', false,
      'status', 'syncing',
      'dotaAccountId', resolved_account_id
    );
  end if;

  next_lease_token := extensions.gen_random_uuid();

  update public.account_match_sync_state
  set status = 'syncing',
      lease_token = next_lease_token,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      last_attempt_at = now(),
      last_error_code = null,
      last_error_message = null
  where dota_account_id = resolved_account_id;

  return jsonb_build_object(
    'owned', true,
    'claimed', true,
    'status', 'syncing',
    'dotaAccountId', resolved_account_id,
    'offset', case when sync_complete then 0 else sync_offset end,
    'backfillComplete', sync_complete,
    'leaseToken', next_lease_token
  );
end;
$function$;

create or replace function public.apply_match_sync_page(
  p_actor_user_id text,
  p_tracked_account_id uuid,
  p_dota_account_id bigint,
  p_lease_token uuid,
  p_matches jsonb,
  p_next_offset integer,
  p_backfill_complete boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  archived_count integer;
  page_newest_match_id bigint;
  page_oldest_match_id bigint;
begin
  if jsonb_typeof(p_matches) <> 'array' then
    raise exception 'Match page must be a JSON array';
  end if;

  if p_next_offset < 0 then
    raise exception 'Match page offset cannot be negative';
  end if;

  if not exists (
    select 1
    from public.tracked_accounts as tracked_account
    where tracked_account.id = p_tracked_account_id
      and tracked_account.user_id = p_actor_user_id
      and tracked_account.dota_account_id = p_dota_account_id
  ) then
    raise exception 'Tracked account is not owned by the sync actor';
  end if;

  if not exists (
    select 1
    from public.account_match_sync_state as sync_state
    where sync_state.dota_account_id = p_dota_account_id
      and sync_state.status = 'syncing'
      and sync_state.lease_token = p_lease_token
      and (sync_state.lease_expires_at is null or sync_state.lease_expires_at > now())
  ) then
    raise exception 'Match sync lease is no longer valid';
  end if;

  insert into public.dota_matches (
    match_id,
    start_time,
    duration,
    radiant_win,
    game_mode,
    lobby_type,
    average_rank,
    cluster,
    version,
    radiant_team_id,
    dire_team_id,
    league_id,
    series_id,
    series_type,
    radiant_score,
    dire_score,
    source
  )
  select
    match_row.match_id,
    match_row.start_time,
    match_row.duration,
    match_row.radiant_win,
    match_row.game_mode,
    match_row.lobby_type,
    match_row.average_rank,
    match_row.cluster,
    match_row.version,
    match_row.radiant_team_id,
    match_row.dire_team_id,
    match_row.league_id,
    match_row.series_id,
    match_row.series_type,
    match_row.radiant_score,
    match_row.dire_score,
    'opendota'
  from jsonb_to_recordset(p_matches) as match_row(
    match_id bigint,
    start_time bigint,
    duration integer,
    radiant_win boolean,
    game_mode smallint,
    lobby_type smallint,
    average_rank smallint,
    cluster integer,
    version integer,
    radiant_team_id bigint,
    dire_team_id bigint,
    league_id bigint,
    series_id bigint,
    series_type smallint,
    radiant_score smallint,
    dire_score smallint,
    player_slot smallint,
    hero_id smallint,
    hero_variant smallint,
    kills integer,
    deaths integer,
    assists integer,
    gold_per_min integer,
    xp_per_min integer,
    last_hits integer,
    denies integer,
    hero_damage integer,
    tower_damage integer,
    hero_healing integer,
    level smallint,
    net_worth integer,
    leaver_status smallint,
    party_size smallint,
    lane smallint,
    lane_role smallint,
    is_roaming boolean
  )
  where match_row.match_id > 0
  on conflict (match_id) do update
  set start_time = coalesce(excluded.start_time, public.dota_matches.start_time),
      duration = coalesce(excluded.duration, public.dota_matches.duration),
      radiant_win = coalesce(excluded.radiant_win, public.dota_matches.radiant_win),
      game_mode = coalesce(excluded.game_mode, public.dota_matches.game_mode),
      lobby_type = coalesce(excluded.lobby_type, public.dota_matches.lobby_type),
      average_rank = coalesce(excluded.average_rank, public.dota_matches.average_rank),
      cluster = coalesce(excluded.cluster, public.dota_matches.cluster),
      version = coalesce(excluded.version, public.dota_matches.version),
      radiant_team_id = coalesce(excluded.radiant_team_id, public.dota_matches.radiant_team_id),
      dire_team_id = coalesce(excluded.dire_team_id, public.dota_matches.dire_team_id),
      league_id = coalesce(excluded.league_id, public.dota_matches.league_id),
      series_id = coalesce(excluded.series_id, public.dota_matches.series_id),
      series_type = coalesce(excluded.series_type, public.dota_matches.series_type),
      radiant_score = coalesce(excluded.radiant_score, public.dota_matches.radiant_score),
      dire_score = coalesce(excluded.dire_score, public.dota_matches.dire_score),
      source_fetched_at = now();

  insert into public.player_match_stats (
    match_id,
    account_id,
    player_slot,
    hero_id,
    hero_variant,
    kills,
    deaths,
    assists,
    gold_per_min,
    xp_per_min,
    last_hits,
    denies,
    hero_damage,
    tower_damage,
    hero_healing,
    level,
    net_worth,
    leaver_status,
    party_size,
    lane,
    lane_role,
    is_roaming
  )
  select
    match_row.match_id,
    p_dota_account_id,
    match_row.player_slot,
    match_row.hero_id,
    match_row.hero_variant,
    match_row.kills,
    match_row.deaths,
    match_row.assists,
    match_row.gold_per_min,
    match_row.xp_per_min,
    match_row.last_hits,
    match_row.denies,
    match_row.hero_damage,
    match_row.tower_damage,
    match_row.hero_healing,
    match_row.level,
    match_row.net_worth,
    match_row.leaver_status,
    match_row.party_size,
    match_row.lane,
    match_row.lane_role,
    match_row.is_roaming
  from jsonb_to_recordset(p_matches) as match_row(
    match_id bigint,
    start_time bigint,
    duration integer,
    radiant_win boolean,
    game_mode smallint,
    lobby_type smallint,
    average_rank smallint,
    cluster integer,
    version integer,
    radiant_team_id bigint,
    dire_team_id bigint,
    league_id bigint,
    series_id bigint,
    series_type smallint,
    radiant_score smallint,
    dire_score smallint,
    player_slot smallint,
    hero_id smallint,
    hero_variant smallint,
    kills integer,
    deaths integer,
    assists integer,
    gold_per_min integer,
    xp_per_min integer,
    last_hits integer,
    denies integer,
    hero_damage integer,
    tower_damage integer,
    hero_healing integer,
    level smallint,
    net_worth integer,
    leaver_status smallint,
    party_size smallint,
    lane smallint,
    lane_role smallint,
    is_roaming boolean
  )
  where match_row.match_id > 0
  on conflict (match_id, account_id) do update
  set player_slot = coalesce(excluded.player_slot, public.player_match_stats.player_slot),
      hero_id = coalesce(excluded.hero_id, public.player_match_stats.hero_id),
      hero_variant = coalesce(excluded.hero_variant, public.player_match_stats.hero_variant),
      kills = coalesce(excluded.kills, public.player_match_stats.kills),
      deaths = coalesce(excluded.deaths, public.player_match_stats.deaths),
      assists = coalesce(excluded.assists, public.player_match_stats.assists),
      gold_per_min = coalesce(excluded.gold_per_min, public.player_match_stats.gold_per_min),
      xp_per_min = coalesce(excluded.xp_per_min, public.player_match_stats.xp_per_min),
      last_hits = coalesce(excluded.last_hits, public.player_match_stats.last_hits),
      denies = coalesce(excluded.denies, public.player_match_stats.denies),
      hero_damage = coalesce(excluded.hero_damage, public.player_match_stats.hero_damage),
      tower_damage = coalesce(excluded.tower_damage, public.player_match_stats.tower_damage),
      hero_healing = coalesce(excluded.hero_healing, public.player_match_stats.hero_healing),
      level = coalesce(excluded.level, public.player_match_stats.level),
      net_worth = coalesce(excluded.net_worth, public.player_match_stats.net_worth),
      leaver_status = coalesce(excluded.leaver_status, public.player_match_stats.leaver_status),
      party_size = coalesce(excluded.party_size, public.player_match_stats.party_size),
      lane = coalesce(excluded.lane, public.player_match_stats.lane),
      lane_role = coalesce(excluded.lane_role, public.player_match_stats.lane_role),
      is_roaming = coalesce(excluded.is_roaming, public.player_match_stats.is_roaming),
      source_fetched_at = now();

  insert into public.tracked_account_matches (tracked_account_id, match_id)
  select p_tracked_account_id, match_row.match_id
  from jsonb_to_recordset(p_matches) as match_row(
    match_id bigint,
    start_time bigint,
    duration integer,
    radiant_win boolean,
    game_mode smallint,
    lobby_type smallint,
    average_rank smallint,
    cluster integer,
    version integer,
    radiant_team_id bigint,
    dire_team_id bigint,
    league_id bigint,
    series_id bigint,
    series_type smallint,
    radiant_score smallint,
    dire_score smallint,
    player_slot smallint,
    hero_id smallint,
    hero_variant smallint,
    kills integer,
    deaths integer,
    assists integer,
    gold_per_min integer,
    xp_per_min integer,
    last_hits integer,
    denies integer,
    hero_damage integer,
    tower_damage integer,
    hero_healing integer,
    level smallint,
    net_worth integer,
    leaver_status smallint,
    party_size smallint,
    lane smallint,
    lane_role smallint,
    is_roaming boolean
  )
  where match_row.match_id > 0
  on conflict (tracked_account_id, match_id) do nothing;

  select max(match_row.match_id), min(match_row.match_id)
  into page_newest_match_id, page_oldest_match_id
  from jsonb_to_recordset(p_matches) as match_row(
    match_id bigint,
    start_time bigint,
    duration integer,
    radiant_win boolean,
    game_mode smallint,
    lobby_type smallint,
    average_rank smallint,
    cluster integer,
    version integer,
    radiant_team_id bigint,
    dire_team_id bigint,
    league_id bigint,
    series_id bigint,
    series_type smallint,
    radiant_score smallint,
    dire_score smallint,
    player_slot smallint,
    hero_id smallint,
    hero_variant smallint,
    kills integer,
    deaths integer,
    assists integer,
    gold_per_min integer,
    xp_per_min integer,
    last_hits integer,
    denies integer,
    hero_damage integer,
    tower_damage integer,
    hero_healing integer,
    level smallint,
    net_worth integer,
    leaver_status smallint,
    party_size smallint,
    lane smallint,
    lane_role smallint,
    is_roaming boolean
  )
  where match_row.match_id > 0;

  update public.account_match_sync_state
  set status = case when p_backfill_complete then 'ready' else 'partial' end,
      newest_match_id = coalesce(page_newest_match_id, newest_match_id),
      oldest_match_id = case
        when page_oldest_match_id is null then oldest_match_id
        when oldest_match_id is null then page_oldest_match_id
        else least(oldest_match_id, page_oldest_match_id)
      end,
      backfill_offset = p_next_offset,
      backfill_complete = p_backfill_complete,
      last_success_at = now(),
      next_retry_at = null,
      consecutive_failures = 0,
      last_error_code = null,
      last_error_message = null,
      lease_token = null,
      lease_expires_at = null
  where dota_account_id = p_dota_account_id
    and status = 'syncing'
    and lease_token = p_lease_token;

  if not found then
    raise exception 'Match sync lease disappeared during apply';
  end if;

  archived_count := jsonb_array_length(p_matches);

  return jsonb_build_object(
    'archivedMatches', archived_count,
    'status', case when p_backfill_complete then 'ready' else 'partial' end,
    'backfillComplete', p_backfill_complete,
    'nextOffset', p_next_offset
  );
end;
$function$;

create or replace function public.record_match_sync_failure(
  p_actor_user_id text,
  p_tracked_account_id uuid,
  p_dota_account_id bigint,
  p_lease_token uuid,
  p_error_code text,
  p_error_message text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  recorded boolean;
begin
  if not exists (
    select 1
    from public.tracked_accounts as tracked_account
    where tracked_account.id = p_tracked_account_id
      and tracked_account.user_id = p_actor_user_id
      and tracked_account.dota_account_id = p_dota_account_id
  ) then
    return jsonb_build_object('recorded', false);
  end if;

  update public.account_match_sync_state
  set status = 'failed',
      consecutive_failures = consecutive_failures + 1,
      last_error_code = left(nullif(btrim(p_error_code), ''), 80),
      last_error_message = left(nullif(btrim(p_error_message), ''), 500),
      next_retry_at = now() + make_interval(mins => least(consecutive_failures + 1, 30)),
      lease_token = null,
      lease_expires_at = null
  where dota_account_id = p_dota_account_id
    and status = 'syncing'
    and lease_token = p_lease_token;

  recorded := found;
  return jsonb_build_object('recorded', recorded);
end;
$function$;

revoke all on function public.claim_match_sync(text, uuid, integer) from public, anon, authenticated;
revoke all on function public.apply_match_sync_page(text, uuid, bigint, uuid, jsonb, integer, boolean)
  from public, anon, authenticated;
revoke all on function public.record_match_sync_failure(text, uuid, bigint, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.claim_match_sync(text, uuid, integer) to service_role;
grant execute on function public.apply_match_sync_page(text, uuid, bigint, uuid, jsonb, integer, boolean)
  to service_role;
grant execute on function public.record_match_sync_failure(text, uuid, bigint, uuid, text, text)
  to service_role;

comment on column public.account_match_sync_state.lease_token is
  'Opaque token proving ownership of the current Worker sync lease.';
comment on column public.account_match_sync_state.lease_expires_at is
  'Expiry time for recovering a sync after a Worker failure.';
comment on function public.claim_match_sync(text, uuid, integer) is
  'Atomically verifies tracked-account ownership, links existing archive rows, and claims one sync lease.';
comment on function public.apply_match_sync_page(text, uuid, bigint, uuid, jsonb, integer, boolean) is
  'Atomically upserts one normalized OpenDota history page and advances sync state.';
comment on function public.record_match_sync_failure(text, uuid, bigint, uuid, text, text) is
  'Records a recoverable Worker sync failure only for the active lease.';
