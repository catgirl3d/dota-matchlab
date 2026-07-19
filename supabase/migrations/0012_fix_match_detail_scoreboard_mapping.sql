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
    match_id bigint, status text, error_code text, error_message text, payloads jsonb
  )
  where queue.dota_account_id = p_dota_account_id
    and queue.match_id = result.match_id
    and queue.status = 'syncing'
    and queue.lease_token = p_lease_token;

  insert into public.match_provider_payloads (
    match_id, provider, payload_kind, payload_section, payload, schema_version, fetched_at
  )
  select result.match_id, 'stratz', 'detail',
    coalesce(nullif(btrim(payload.payload_section), ''), 'match'), payload.payload,
    nullif(btrim(payload.schema_version), ''), now()
  from jsonb_to_recordset(p_results) as result(
    match_id bigint, status text, error_code text, error_message text, payloads jsonb
  )
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
    player."matchId", player."steamAccountId", player."playerSlot", player."heroId",
    player.kills, player.deaths, player.assists, player."goldPerMinute",
    player."experiencePerMinute", player."numLastHits", player."numDenies",
    player."heroDamage", player."towerDamage", player."heroHealing", player.level,
    player.networth, case when player."leaverStatus" = 'NONE' then 0 else null end
  from jsonb_to_recordset(p_results) as result(
    match_id bigint, status text, error_code text, error_message text, payloads jsonb
  )
  cross join lateral jsonb_to_recordset(coalesce(result.payloads, '[]'::jsonb)) as payload(
    payload_section text, payload jsonb, schema_version text
  )
  cross join lateral jsonb_to_recordset(payload.payload #> '{data,match,players}') as player(
    "matchId" bigint, "steamAccountId" bigint, "playerSlot" smallint, "heroId" smallint,
    kills integer, deaths integer, assists integer, "goldPerMinute" integer,
    "experiencePerMinute" integer, "numLastHits" integer, "numDenies" integer,
    "heroDamage" integer, "towerDamage" integer, "heroHealing" integer, level smallint,
    networth integer, "leaverStatus" text
  )
  where payload.payload_section = 'players'
    and player."matchId" = result.match_id
    and player."steamAccountId" between 0 and 4294967295
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
    match_id bigint, status text, error_code text, error_message text, payloads jsonb
  )
  where match.match_id = result.match_id;

  select count(*) into remaining_count
  from public.account_match_detail_queue
  where dota_account_id = p_dota_account_id and status in ('pending', 'syncing');

  return jsonb_build_object(
    'processedMatches', jsonb_array_length(p_results),
    'backfillComplete', remaining_count = 0
  );
end;
$function$;
