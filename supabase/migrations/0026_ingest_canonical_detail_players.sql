-- Provider payloads are archived verbatim. Only the worker-produced canonical
-- normalized_players contract is parsed by these transactional ingestion RPCs.
create or replace function public.apply_match_detail_batch(
  p_actor_user_id text,
  p_tracked_account_id uuid,
  p_dota_account_id bigint,
  p_lease_token uuid,
  p_results jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  remaining_count integer;
  locked_count integer := 0;
  result_match_id bigint;
begin
  if jsonb_typeof(p_results) <> 'array' then
    raise exception 'Detail results must be a JSON array';
  end if;
  if not exists (
    select 1 from public.tracked_accounts
    where id = p_tracked_account_id and user_id = p_actor_user_id
      and dota_account_id = p_dota_account_id
  ) then
    raise exception 'Tracked account is not owned by the detail sync actor';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_results) as result(
      match_id bigint, status text, error_code text, error_message text,
      payloads jsonb, normalized_players jsonb
    )
    where result.match_id is null or result.match_id <= 0
  ) or exists (
    select 1
    from jsonb_to_recordset(p_results) as result(
      match_id bigint, status text, error_code text, error_message text,
      payloads jsonb, normalized_players jsonb
    )
    group by result.match_id
    having count(*) > 1
  ) then
    raise exception 'Detail results must contain unique match IDs';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_results) as result(
      match_id bigint, status text, error_code text, error_message text,
      payloads jsonb, normalized_players jsonb
    )
    where result.status = 'available'
      and (
        jsonb_typeof(result.normalized_players) <> 'array'
        or jsonb_array_length(result.normalized_players) = 0
        or exists (
          select 1
          from jsonb_to_recordset(result.normalized_players) as player(
            match_id bigint, account_id bigint, player_slot smallint, hero_id smallint,
            kills integer, deaths integer, assists integer, gold_per_min integer,
            xp_per_min integer, last_hits integer, denies integer, hero_damage integer,
            tower_damage integer, hero_healing integer, level smallint, net_worth integer,
            leaver_status smallint
          )
          where player.match_id is distinct from result.match_id
            or player.account_id is null or player.account_id not between 0 and 4294967295
            or (player.player_slot is not null and player.player_slot not between 0 and 255)
            or (player.hero_id is not null and player.hero_id <= 0)
        )
        or not exists (
          select 1
          from jsonb_to_recordset(result.normalized_players) as player(
            match_id bigint, account_id bigint, player_slot smallint, hero_id smallint,
            kills integer, deaths integer, assists integer, gold_per_min integer,
            xp_per_min integer, last_hits integer, denies integer, hero_damage integer,
            tower_damage integer, hero_healing integer, level smallint, net_worth integer,
            leaver_status smallint
          )
          where player.match_id = result.match_id
            and player.account_id between 0 and 4294967295
        )
      )
  ) then
    raise exception 'Available detail result requires projectable normalized players';
  end if;

  -- Lock every requested queue row before writing so a replacement claimant
  -- cannot acquire the lease between raw-payload, stats, and state updates.
  for result_match_id in
    select result.match_id
    from jsonb_to_recordset(p_results) as result(
      match_id bigint, status text, error_code text, error_message text,
      payloads jsonb, normalized_players jsonb
    )
    order by result.match_id
  loop
    perform queue.match_id
    from public.account_match_detail_queue as queue
    where queue.dota_account_id = p_dota_account_id
      and queue.match_id = result_match_id
      and queue.status = 'syncing'
      and queue.lease_token = p_lease_token
      and queue.lease_expires_at > now()
    for update of queue;

    if not found then
      raise exception 'Detail lease is no longer active';
    end if;

    locked_count := locked_count + 1;
  end loop;

  if locked_count <> jsonb_array_length(p_results) then
    raise exception 'Detail lease is no longer active';
  end if;

  insert into public.match_provider_payloads (
    match_id, provider, payload_kind, payload_section, payload, schema_version, fetched_at
  )
  select result.match_id, 'stratz', 'detail',
    coalesce(nullif(btrim(payload.payload_section), ''), 'match'), payload.payload,
    nullif(btrim(payload.schema_version), ''), now()
  from jsonb_to_recordset(p_results) as result(
    match_id bigint, status text, error_code text, error_message text,
    payloads jsonb, normalized_players jsonb
  )
  join public.account_match_detail_queue as queue
    on queue.dota_account_id = p_dota_account_id
    and queue.match_id = result.match_id
    and queue.status = 'syncing'
    and queue.lease_token = p_lease_token
    and queue.lease_expires_at > now()
  cross join lateral jsonb_to_recordset(coalesce(result.payloads, '[]'::jsonb)) as payload(
    payload_section text, payload jsonb, schema_version text
  )
  where result.match_id > 0 and payload.payload is not null
  on conflict (match_id, provider, payload_kind, payload_section) do update
  set payload = excluded.payload, schema_version = excluded.schema_version, fetched_at = excluded.fetched_at;

  insert into public.player_match_stats (
    match_id, account_id, player_slot, hero_id, kills, deaths, assists,
    gold_per_min, xp_per_min, last_hits, denies, hero_damage, tower_damage,
    hero_healing, level, net_worth, leaver_status
  )
  select
    player.match_id, player.account_id, player.player_slot, player.hero_id,
    player.kills, player.deaths, player.assists, player.gold_per_min,
    player.xp_per_min, player.last_hits, player.denies, player.hero_damage,
    player.tower_damage, player.hero_healing, player.level, player.net_worth,
    player.leaver_status
  from jsonb_to_recordset(p_results) as result(
    match_id bigint, status text, error_code text, error_message text,
    payloads jsonb, normalized_players jsonb
  )
  join public.account_match_detail_queue as queue
    on queue.dota_account_id = p_dota_account_id
    and queue.match_id = result.match_id
    and queue.status = 'syncing'
    and queue.lease_token = p_lease_token
    and queue.lease_expires_at > now()
  cross join lateral jsonb_to_recordset(coalesce(result.normalized_players, '[]'::jsonb)) as player(
    match_id bigint, account_id bigint, player_slot smallint, hero_id smallint,
    kills integer, deaths integer, assists integer, gold_per_min integer,
    xp_per_min integer, last_hits integer, denies integer, hero_damage integer,
    tower_damage integer, hero_healing integer, level smallint, net_worth integer,
    leaver_status smallint
  )
  where result.status = 'available'
    and player.match_id = result.match_id
    and player.account_id between 0 and 4294967295
  on conflict (match_id, account_id) do update
  set player_slot = coalesce(excluded.player_slot, public.player_match_stats.player_slot),
      hero_id = coalesce(excluded.hero_id, public.player_match_stats.hero_id),
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
      source_fetched_at = now();

  update public.dota_matches as match
  set detail_status = case result.status
        when 'available' then 'available'
        when 'unavailable' then 'unavailable'
        else 'failed'
      end,
      detail_fetched_at = case when result.status = 'available' then now() else match.detail_fetched_at end
  from jsonb_to_recordset(p_results) as result(
    match_id bigint, status text, error_code text, error_message text,
    payloads jsonb, normalized_players jsonb
  )
  join public.account_match_detail_queue as queue
    on queue.dota_account_id = p_dota_account_id
    and queue.match_id = result.match_id
    and queue.status = 'syncing'
    and queue.lease_token = p_lease_token
    and queue.lease_expires_at > now()
  where match.match_id = result.match_id;

  update public.account_match_detail_queue as queue
  set status = case result.status
        when 'available' then 'available'
        when 'unavailable' then 'unavailable'
        else 'failed'
      end,
      fetched_at = case when result.status = 'available' then now() else queue.fetched_at end,
      next_retry_at = case
        when result.status in ('available', 'unavailable') then null
        else now() + make_interval(mins => least(power(2, least(queue.attempts, 5))::integer, 30))
      end,
      last_error_code = case when result.status = 'failed' then left(nullif(btrim(result.error_code), ''), 80) else null end,
      last_error_message = case when result.status = 'failed' then left(nullif(btrim(result.error_message), ''), 500) else null end,
      lease_token = null,
      lease_expires_at = null
  from jsonb_to_recordset(p_results) as result(
    match_id bigint, status text, error_code text, error_message text,
    payloads jsonb, normalized_players jsonb
  )
  where queue.dota_account_id = p_dota_account_id
    and queue.match_id = result.match_id
    and queue.status = 'syncing'
    and queue.lease_token = p_lease_token
    and queue.lease_expires_at > now();

  select count(*) into remaining_count
  from public.account_match_detail_queue
  where dota_account_id = p_dota_account_id and status in ('pending', 'syncing');

  return jsonb_build_object(
    'processedMatches', jsonb_array_length(p_results),
    'backfillComplete', remaining_count = 0
  );
end;
$function$;

create or replace function public.apply_public_match_import(
  p_match_id bigint,
  p_result jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  normalized jsonb := p_result->'normalized_match';
begin
  if p_match_id <= 0
    or p_result->>'status' <> 'available'
    or jsonb_typeof(normalized) <> 'object'
    or (normalized->>'match_id') !~ '^\d+$'
    or (normalized->>'match_id')::bigint <> p_match_id
    or jsonb_typeof(coalesce(p_result->'payloads', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(p_result->'normalized_players') <> 'array'
    or jsonb_array_length(p_result->'normalized_players') = 0
  then
    raise exception 'Invalid public match import';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_result->'normalized_players') as player(
      match_id bigint, account_id bigint, player_slot smallint, hero_id smallint,
      kills integer, deaths integer, assists integer, gold_per_min integer,
      xp_per_min integer, last_hits integer, denies integer, hero_damage integer,
      tower_damage integer, hero_healing integer, level smallint, net_worth integer,
      leaver_status smallint
    )
    where player.match_id is distinct from p_match_id
      or player.account_id is null or player.account_id not between 0 and 4294967295
      or (player.player_slot is not null and player.player_slot not between 0 and 255)
      or (player.hero_id is not null and player.hero_id <= 0)
  ) or not exists (
    select 1
    from jsonb_to_recordset(p_result->'normalized_players') as player(
      match_id bigint, account_id bigint, player_slot smallint, hero_id smallint,
      kills integer, deaths integer, assists integer, gold_per_min integer,
      xp_per_min integer, last_hits integer, denies integer, hero_damage integer,
      tower_damage integer, hero_healing integer, level smallint, net_worth integer,
      leaver_status smallint
    )
    where player.match_id = p_match_id
      and player.account_id between 0 and 4294967295
  ) then
    raise exception 'Available detail result requires projectable normalized players';
  end if;

  perform pg_advisory_xact_lock(p_match_id);

  insert into public.dota_matches (match_id, source, detail_status)
  values (p_match_id, 'stratz', 'not_requested')
  on conflict (match_id) do nothing;

  insert into public.match_provider_payloads (
    match_id, provider, payload_kind, payload_section, payload,
    schema_version, fetched_at
  )
  select
    p_match_id,
    'stratz',
    'detail',
    coalesce(nullif(btrim(item->>'payload_section'), ''), 'match'),
    item->'payload',
    nullif(btrim(item->>'schema_version'), ''),
    now()
  from jsonb_array_elements(p_result->'payloads') as item
  where item->'payload' is not null
  on conflict (match_id, provider, payload_kind, payload_section) do update
  set payload = excluded.payload,
      schema_version = excluded.schema_version,
      fetched_at = excluded.fetched_at;

  insert into public.player_match_stats (
    match_id, account_id, player_slot, hero_id, kills, deaths, assists,
    gold_per_min, xp_per_min, last_hits, denies, hero_damage, tower_damage,
    hero_healing, level, net_worth, leaver_status
  )
  select
    player.match_id, player.account_id, player.player_slot, player.hero_id,
    player.kills, player.deaths, player.assists, player.gold_per_min,
    player.xp_per_min, player.last_hits, player.denies, player.hero_damage,
    player.tower_damage, player.hero_healing, player.level, player.net_worth,
    player.leaver_status
  from jsonb_to_recordset(p_result->'normalized_players') as player(
    match_id bigint, account_id bigint, player_slot smallint, hero_id smallint,
    kills integer, deaths integer, assists integer, gold_per_min integer,
    xp_per_min integer, last_hits integer, denies integer, hero_damage integer,
    tower_damage integer, hero_healing integer, level smallint, net_worth integer,
    leaver_status smallint
  )
  where player.match_id = p_match_id
    and player.account_id between 0 and 4294967295
  on conflict (match_id, account_id) do update
  set player_slot = coalesce(excluded.player_slot, public.player_match_stats.player_slot),
      hero_id = coalesce(excluded.hero_id, public.player_match_stats.hero_id),
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
      source_fetched_at = now();

  update public.dota_matches as match
  set start_time = coalesce((normalized->>'start_time')::bigint, match.start_time),
      duration = coalesce((normalized->>'duration')::integer, match.duration),
      radiant_win = coalesce((normalized->>'radiant_win')::boolean, match.radiant_win),
      game_mode = coalesce((normalized->>'game_mode')::smallint, match.game_mode),
      lobby_type = coalesce((normalized->>'lobby_type')::smallint, match.lobby_type),
      average_rank = coalesce((normalized->>'average_rank')::smallint, match.average_rank),
      cluster = coalesce((normalized->>'cluster')::integer, match.cluster),
      version = coalesce((normalized->>'version')::integer, match.version),
      radiant_team_id = coalesce((normalized->>'radiant_team_id')::bigint, match.radiant_team_id),
      dire_team_id = coalesce((normalized->>'dire_team_id')::bigint, match.dire_team_id),
      league_id = coalesce((normalized->>'league_id')::bigint, match.league_id),
      series_id = coalesce((normalized->>'series_id')::bigint, match.series_id),
      series_type = coalesce((normalized->>'series_type')::smallint, match.series_type),
      radiant_score = coalesce((normalized->>'radiant_score')::smallint, match.radiant_score),
      dire_score = coalesce((normalized->>'dire_score')::smallint, match.dire_score),
      detail_status = 'available',
      detail_fetched_at = now(),
      source = 'stratz',
      source_fetched_at = now()
  where match.match_id = p_match_id;

  return jsonb_build_object('match_id', p_match_id, 'status', 'available');
end;
$function$;

revoke all on function public.apply_match_detail_batch(text, uuid, bigint, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_match_detail_batch(text, uuid, bigint, uuid, jsonb)
  to service_role;

revoke all on function public.apply_public_match_import(bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_public_match_import(bigint, jsonb)
  to service_role;
