-- Dota match data is public provider data. Authentication protects API usage;
-- archive membership remains private through tracked_account_matches.
drop policy "Users can read archived matches for tracked accounts" on public.dota_matches;
drop policy "Users can read player stats for tracked matches" on public.player_match_stats;
drop policy "Users can read provider payloads for tracked matches" on public.match_provider_payloads;

create policy "Authenticated users can read Dota matches"
on public.dota_matches for select to authenticated using (true);

create policy "Authenticated users can read Dota match stats"
on public.player_match_stats for select to authenticated using (true);

create policy "Authenticated users can read Dota match payloads"
on public.match_provider_payloads for select to authenticated using (true);

create function public.apply_public_match_import(
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
  then
    raise exception 'Invalid public match import';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_result->'payloads') as item
    where item->'payload' #>> '{data,match,id}' is not null
      and item->'payload' #>> '{data,match,id}' <> p_match_id::text
  ) or exists (
    select 1
    from jsonb_array_elements(p_result->'payloads') as item
    cross join lateral jsonb_array_elements(
      coalesce(item->'payload' #> '{data,match,players}', '[]'::jsonb)
    ) as player
    where player->>'matchId' is not null
      and player->>'matchId' <> p_match_id::text
  ) then
    raise exception 'STRATZ detail result does not match requested match';
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
    hero_healing, level, net_worth
  )
  select
    p_match_id,
    player."steamAccountId",
    player."playerSlot",
    player."heroId",
    player.kills,
    player.deaths,
    player.assists,
    player."goldPerMinute",
    player."experiencePerMinute",
    player."numLastHits",
    player."numDenies",
    player."heroDamage",
    player."towerDamage",
    player."heroHealing",
    player.level,
    player.networth
  from jsonb_array_elements(p_result->'payloads') as item
  cross join lateral jsonb_to_recordset(
    item->'payload' #> '{data,match,players}'
  ) as player(
    "matchId" bigint,
    "steamAccountId" bigint,
    "playerSlot" smallint,
    "heroId" smallint,
    kills integer,
    deaths integer,
    assists integer,
    "goldPerMinute" integer,
    "experiencePerMinute" integer,
    "numLastHits" integer,
    "numDenies" integer,
    "heroDamage" integer,
    "towerDamage" integer,
    "heroHealing" integer,
    level smallint,
    networth integer
  )
  where item->>'payload_section' = 'players'
    and player."matchId" = p_match_id
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

  return jsonb_build_object('matchId', p_match_id, 'status', 'available');
end;
$function$;

revoke all on function public.apply_public_match_import(bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_public_match_import(bigint, jsonb)
  to service_role;
