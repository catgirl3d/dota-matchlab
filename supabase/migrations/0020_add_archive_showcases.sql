create schema if not exists archive_private;
revoke all on schema archive_private from public, anon, authenticated;

alter table public.tracked_accounts
  add constraint tracked_accounts_id_dota_account_id_key unique (id, dota_account_id);

create table public.archive_showcases (
  dota_account_id bigint primary key,
  tracked_account_id uuid not null unique,
  constraint archive_showcases_account_pair_fkey
    foreign key (tracked_account_id, dota_account_id)
    references public.tracked_accounts (id, dota_account_id)
    on delete cascade
);

alter table public.archive_showcases enable row level security;
revoke all on table public.archive_showcases from public, anon, authenticated;
grant select, insert, update, delete on table public.archive_showcases to service_role;

create or replace function archive_private.archive_overview(
  p_tracked_account_id uuid,
  p_period text default 'all', p_mode text default 'all', p_result text default 'all',
  p_party text default 'all', p_position text default 'all', p_hero_id smallint default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare result jsonb;
begin
  if p_period not in ('all', '30d', '90d', 'year') or p_mode not in ('all', 'ranked', 'turbo', 'all-pick') or p_result not in ('all', 'wins', 'losses') or p_party not in ('all', 'solo', 'party') or p_position not in ('all', 'carry', 'mid', 'offlane', 'support', 'hard-support') then
    raise exception 'Invalid archive filter';
  end if;
  with base as (
    select linked.match_id as linked_match_id, match.match_id, stats.match_id as stats_match_id, match.start_time, match.duration, match.radiant_win, match.game_mode, stats.player_slot, stats.hero_id, stats.kills, stats.deaths, stats.assists, stats.gold_per_min, stats.xp_per_min, stats.last_hits, stats.hero_damage, stats.party_size, stats.lane, stats.lane_role,
      case when stats.player_slot is null or match.radiant_win is null then null else (stats.player_slot < 128) = match.radiant_win end as won
    from public.tracked_account_matches linked
    join public.tracked_accounts account on account.id = linked.tracked_account_id
    left join public.dota_matches match on match.match_id = linked.match_id
    left join public.player_match_stats stats on stats.match_id = linked.match_id and stats.account_id = account.dota_account_id
    where linked.tracked_account_id = p_tracked_account_id
  ), complete_matches as (
    select * from base where match_id is not null and stats_match_id is not null
  ), filtered as (
    select * from complete_matches
    where (p_period = 'all' or start_time >= extract(epoch from now() - case p_period when '30d' then interval '30 days' when '90d' then interval '90 days' when 'year' then interval '365 days' end)::bigint)
      and (p_mode = 'all' or game_mode = case p_mode when 'ranked' then 22 when 'turbo' then 23 when 'all-pick' then 1 end)
      and (p_result = 'all' or (p_result = 'wins' and won is true) or (p_result = 'losses' and won is false))
      and (p_party = 'all' or (p_party = 'solo' and party_size in (0, 1)) or (p_party = 'party' and party_size > 1))
      and (p_position = 'all' or lane_role = case p_position when 'carry' then 1 when 'mid' then 2 when 'offlane' then 3 when 'support' then 4 when 'hard-support' then 5 end)
      and (p_hero_id is null or hero_id = p_hero_id)
  ), summary as (
    select count(*)::integer matches, count(*) filter (where won is true)::integer wins, count(*) filter (where won is false)::integer losses, count(*) filter (where won is null)::integer unknown_results,
      coalesce(round(100.0 * count(*) filter (where won is true) / nullif(count(*) filter (where won is not null), 0), 1), 0) win_rate,
      coalesce(round(avg(kills) filter (where kills is not null), 1), 0) average_kills, coalesce(round(avg(deaths) filter (where deaths is not null), 1), 0) average_deaths, coalesce(round(avg(assists) filter (where assists is not null), 1), 0) average_assists,
      coalesce(round(avg((kills + assists)::numeric / greatest(deaths, 1)) filter (where kills is not null and deaths is not null and assists is not null), 1), 0) average_kda,
      coalesce(round(avg(gold_per_min) filter (where gold_per_min is not null)), 0)::integer average_gpm, coalesce(round(avg(xp_per_min) filter (where xp_per_min is not null)), 0)::integer average_xpm, coalesce(round(avg(last_hits) filter (where last_hits is not null)), 0)::integer average_last_hits, coalesce(round(avg(hero_damage) filter (where hero_damage is not null)), 0)::integer average_damage,
      coalesce(round(avg(duration) filter (where duration is not null) / 60.0, 1), 0) average_duration_minutes, min(start_time) first_match_at, max(start_time) latest_match_at from filtered
  ), integrity as (
    select count(*)::integer linked, count(*) filter (where match_id is not null and stats_match_id is not null)::integer complete, count(*) filter (where match_id is not null and stats_match_id is null)::integer missing_stats, count(*) filter (where match_id is null)::integer missing_match from base
  )
  select jsonb_build_object(
    'summary', (select to_jsonb(summary) from summary),
    'form', coalesce((select jsonb_agg(case when won is true then 'win' when won is false then 'loss' else 'unknown' end order by start_time desc nulls last, match_id desc) from (select * from filtered order by start_time desc nulls last, match_id desc limit 20) recent), '[]'::jsonb),
    'modes', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'matches', matches, 'wins', wins, 'winRate', win_rate) order by matches desc, key) from (select case when game_mode = 22 then 'ranked' when game_mode = 23 then 'turbo' when game_mode = 1 then 'all-pick' else 'other' end key, case when game_mode = 22 then 'Ranked' when game_mode = 23 then 'Turbo' when game_mode = 1 then 'All Pick' else 'Other' end label, count(*)::integer matches, count(*) filter (where won is true)::integer wins, coalesce(round(100.0 * count(*) filter (where won is true) / nullif(count(*) filter (where won is not null), 0), 1), 0) win_rate from filtered group by 1, 2) modes), '[]'::jsonb),
    'heroes', coalesce((select jsonb_agg(jsonb_build_object('key', hero_id::text, 'heroId', hero_id, 'matches', matches, 'wins', wins, 'winRate', win_rate, 'averageKda', average_kda, 'averageGpm', average_gpm) order by matches desc, win_rate desc, hero_id) from (select hero_id, count(*)::integer matches, count(*) filter (where won is true)::integer wins, coalesce(round(100.0 * count(*) filter (where won is true) / nullif(count(*) filter (where won is not null), 0), 1), 0) win_rate, coalesce(round(avg((kills + assists)::numeric / greatest(deaths, 1)) filter (where kills is not null and deaths is not null and assists is not null), 1), 0) average_kda, coalesce(round(avg(gold_per_min) filter (where gold_per_min is not null)), 0)::integer average_gpm from filtered where hero_id is not null group by hero_id) heroes), '[]'::jsonb),
    'positions', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'matches', matches, 'wins', wins, 'winRate', win_rate) order by matches desc, key) from (select case lane_role when 1 then 'carry' when 2 then 'mid' when 3 then 'offlane' when 4 then 'support' when 5 then 'hard-support' else 'unknown' end key, case lane_role when 1 then 'Carry' when 2 then 'Mid' when 3 then 'Offlane' when 4 then 'Soft support' when 5 then 'Hard support' else 'Unknown position' end label, count(*)::integer matches, count(*) filter (where won is true)::integer wins, coalesce(round(100.0 * count(*) filter (where won is true) / nullif(count(*) filter (where won is not null), 0), 1), 0) win_rate from filtered group by 1, 2) positions), '[]'::jsonb),
    'lanes', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'matches', matches, 'wins', wins, 'winRate', win_rate) order by matches desc, key) from (select case lane when 1 then 'safe' when 2 then 'mid' when 3 then 'offlane' else 'unknown' end key, case lane when 1 then 'Safe lane' when 2 then 'Mid lane' when 3 then 'Off lane' else 'Unknown lane' end label, count(*)::integer matches, count(*) filter (where won is true)::integer wins, coalesce(round(100.0 * count(*) filter (where won is true) / nullif(count(*) filter (where won is not null), 0), 1), 0) win_rate from filtered group by 1, 2) lanes), '[]'::jsonb),
    'party', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'matches', matches, 'wins', wins, 'winRate', win_rate) order by matches desc, key) from (select case when party_size in (0, 1) then 'solo' when party_size > 1 then 'party' else 'unknown' end key, case when party_size in (0, 1) then 'Solo' when party_size > 1 then 'Party' else 'Unknown' end label, count(*)::integer matches, count(*) filter (where won is true)::integer wins, coalesce(round(100.0 * count(*) filter (where won is true) / nullif(count(*) filter (where won is not null), 0), 1), 0) win_rate from filtered group by 1, 2) party), '[]'::jsonb),
    'tempo', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'matches', matches, 'wins', wins, 'winRate', win_rate) order by matches desc, key) from (select case when coalesce(duration, 0) < 1800 then 'early' when coalesce(duration, 0) >= 2400 then 'late' else 'standard' end key, case when coalesce(duration, 0) < 1800 then 'Under 30 min' when coalesce(duration, 0) >= 2400 then '40+ min' else '30-40 min' end label, count(*)::integer matches, count(*) filter (where won is true)::integer wins, coalesce(round(100.0 * count(*) filter (where won is true) / nullif(count(*) filter (where won is not null), 0), 1), 0) win_rate from filtered group by 1, 2) tempo), '[]'::jsonb),
    'heroOptions', coalesce((select jsonb_agg(hero_id order by hero_id) from (select distinct hero_id from complete_matches where hero_id is not null) heroes), '[]'::jsonb),
    'syncState', null,
    'integrity', (select to_jsonb(integrity) from integrity)
  ) into result;
  return result;
end;
$function$;

create or replace function archive_private.archive_page(
  p_tracked_account_id uuid, p_period text default 'all', p_mode text default 'all', p_result text default 'all', p_party text default 'all', p_position text default 'all', p_hero_id smallint default null, p_cursor_start_time bigint default null, p_cursor_match_id bigint default null, p_limit integer default 100
)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare result jsonb;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Archive page limit must be between 1 and 100'; end if;
  if p_cursor_start_time is not null and p_cursor_match_id is null then raise exception 'Archive cursor is invalid'; end if;
  if p_period not in ('all', '30d', '90d', 'year') or p_mode not in ('all', 'ranked', 'turbo', 'all-pick') or p_result not in ('all', 'wins', 'losses') or p_party not in ('all', 'solo', 'party') or p_position not in ('all', 'carry', 'mid', 'offlane', 'support', 'hard-support') then raise exception 'Invalid archive filter'; end if;
  with filtered as (
    select match.match_id, match.start_time, match.duration duration_seconds, match.radiant_win, match.game_mode, match.lobby_type, match.average_rank, match.radiant_score, match.dire_score, stats.player_slot, stats.hero_id, stats.hero_variant, stats.kills, stats.deaths, stats.assists, stats.gold_per_min, stats.xp_per_min, stats.last_hits, stats.denies, stats.hero_damage, stats.tower_damage, stats.hero_healing, stats.level, stats.net_worth, stats.leaver_status, stats.party_size, stats.lane, stats.lane_role, stats.is_roaming,
      case when stats.match_id is null then 'missing_player_stats' else 'complete' end data_status,
      case when stats.player_slot is null or match.radiant_win is null then null else (stats.player_slot < 128) = match.radiant_win end won
    from public.tracked_account_matches linked join public.tracked_accounts account on account.id = linked.tracked_account_id join public.dota_matches match on match.match_id = linked.match_id left join public.player_match_stats stats on stats.match_id = linked.match_id and stats.account_id = account.dota_account_id
    where linked.tracked_account_id = p_tracked_account_id
      and (p_period = 'all' or match.start_time >= extract(epoch from now() - case p_period when '30d' then interval '30 days' when '90d' then interval '90 days' when 'year' then interval '365 days' end)::bigint)
      and (p_mode = 'all' or match.game_mode = case p_mode when 'ranked' then 22 when 'turbo' then 23 when 'all-pick' then 1 end)
      and (p_result = 'all' or (p_result = 'wins' and ((stats.player_slot < 128) = match.radiant_win)) or (p_result = 'losses' and ((stats.player_slot < 128) <> match.radiant_win)))
      and (p_party = 'all' or (p_party = 'solo' and stats.party_size in (0, 1)) or (p_party = 'party' and stats.party_size > 1))
      and (p_position = 'all' or stats.lane_role = case p_position when 'carry' then 1 when 'mid' then 2 when 'offlane' then 3 when 'support' then 4 when 'hard-support' then 5 end)
      and (p_hero_id is null or stats.hero_id = p_hero_id)
  ), cursor_filtered as (
    select * from filtered where p_cursor_match_id is null or (p_cursor_start_time is not null and (start_time < p_cursor_start_time or (start_time = p_cursor_start_time and match_id < p_cursor_match_id) or start_time is null)) or (p_cursor_start_time is null and start_time is null and match_id < p_cursor_match_id)
  ), page_window as (select * from cursor_filtered order by start_time desc nulls last, match_id desc limit p_limit + 1), page as (select * from page_window order by start_time desc nulls last, match_id desc limit p_limit), boundary as (select start_time, match_id from page order by start_time asc nulls first, match_id asc limit 1)
  select jsonb_build_object('matches', coalesce((select jsonb_agg(jsonb_build_object('matchId', match_id, 'startTime', start_time, 'durationSeconds', duration_seconds, 'radiantWin', radiant_win, 'gameMode', game_mode, 'lobbyType', lobby_type, 'averageRank', average_rank, 'radiantScore', radiant_score, 'direScore', dire_score, 'playerSlot', player_slot, 'heroId', hero_id, 'heroVariant', hero_variant, 'kills', kills, 'deaths', deaths, 'assists', assists, 'goldPerMinute', gold_per_min, 'xpPerMinute', xp_per_min, 'lastHits', last_hits, 'denies', denies, 'heroDamage', hero_damage, 'towerDamage', tower_damage, 'heroHealing', hero_healing, 'level', level, 'netWorth', net_worth, 'leaverStatus', leaver_status, 'partySize', party_size, 'lane', lane, 'laneRole', lane_role, 'isRoaming', is_roaming, 'won', won, 'dataStatus', data_status) order by start_time desc nulls last, match_id desc) from page), '[]'::jsonb), 'nextCursor', case when (select count(*) from page_window) > p_limit then (select jsonb_build_object('startTime', start_time, 'matchId', match_id) from boundary) else null end) into result;
  return result;
end;
$function$;

create or replace function public.get_match_archive_overview(p_tracked_account_id uuid, p_period text default 'all', p_mode text default 'all', p_result text default 'all', p_party text default 'all', p_position text default 'all', p_hero_id smallint default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare result jsonb;
begin
  if exists (select 1 from public.tracked_accounts where id = p_tracked_account_id and user_id = ((select auth.jwt()) ->> 'sub')) then
    result := archive_private.archive_overview(p_tracked_account_id, p_period, p_mode, p_result, p_party, p_position, p_hero_id);
    return jsonb_set(result, '{syncState}', coalesce((select to_jsonb(sync_state) from public.account_match_sync_state sync_state join public.tracked_accounts account on account.dota_account_id = sync_state.dota_account_id where account.id = p_tracked_account_id and account.user_id = ((select auth.jwt()) ->> 'sub') limit 1), 'null'::jsonb));
  end if;
  return archive_private.archive_overview(null, p_period, p_mode, p_result, p_party, p_position, p_hero_id);
end;
$function$;

create or replace function public.get_match_archive_page(p_tracked_account_id uuid, p_period text default 'all', p_mode text default 'all', p_result text default 'all', p_party text default 'all', p_position text default 'all', p_hero_id smallint default null, p_cursor_start_time bigint default null, p_cursor_match_id bigint default null, p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
begin
  if exists (select 1 from public.tracked_accounts where id = p_tracked_account_id and user_id = ((select auth.jwt()) ->> 'sub')) then
    return archive_private.archive_page(p_tracked_account_id, p_period, p_mode, p_result, p_party, p_position, p_hero_id, p_cursor_start_time, p_cursor_match_id, p_limit);
  end if;
  return archive_private.archive_page(null, p_period, p_mode, p_result, p_party, p_position, p_hero_id, p_cursor_start_time, p_cursor_match_id, p_limit);
end;
$function$;

create or replace function public.get_archive_showcase_overview(p_dota_account_id bigint, p_period text default 'all', p_mode text default 'all', p_result text default 'all', p_party text default 'all', p_position text default 'all', p_hero_id smallint default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_showcase record; overview jsonb;
begin
  select registry.tracked_account_id, account.dota_account_id, account.persona_name, account.avatar_url, account.rank_tier, account.profile_refreshed_at into v_showcase
  from public.archive_showcases registry join public.tracked_accounts account on (account.id, account.dota_account_id) = (registry.tracked_account_id, registry.dota_account_id)
  where registry.dota_account_id = p_dota_account_id;
  if not found then return null; end if;
  overview := archive_private.archive_overview(v_showcase.tracked_account_id, p_period, p_mode, p_result, p_party, p_position, p_hero_id);
  return jsonb_build_object('account', jsonb_build_object('dotaAccountId', v_showcase.dota_account_id, 'personaName', v_showcase.persona_name, 'avatarUrl', v_showcase.avatar_url, 'rankTier', v_showcase.rank_tier, 'profileRefreshedAt', v_showcase.profile_refreshed_at), 'overview', overview);
end;
$function$;

create or replace function public.get_archive_showcase_page(p_dota_account_id bigint, p_period text default 'all', p_mode text default 'all', p_result text default 'all', p_party text default 'all', p_position text default 'all', p_hero_id smallint default null, p_cursor_start_time bigint default null, p_cursor_match_id bigint default null, p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_tracked_account_id uuid;
begin
  select tracked_account_id into v_tracked_account_id from public.archive_showcases where dota_account_id = p_dota_account_id;
  if not found then return null; end if;
  return archive_private.archive_page(v_tracked_account_id, p_period, p_mode, p_result, p_party, p_position, p_hero_id, p_cursor_start_time, p_cursor_match_id, p_limit);
end;
$function$;

revoke all on function archive_private.archive_overview(uuid, text, text, text, text, text, smallint) from public, anon, authenticated;
revoke all on function archive_private.archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer) from public, anon, authenticated;
revoke all on function public.get_match_archive_overview(uuid, text, text, text, text, text, smallint) from public, anon, authenticated;
revoke all on function public.get_match_archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer) from public, anon, authenticated;
grant execute on function public.get_match_archive_overview(uuid, text, text, text, text, text, smallint) to authenticated;
grant execute on function public.get_match_archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer) to authenticated;
revoke all on function public.get_archive_showcase_overview(bigint, text, text, text, text, text, smallint) from public;
revoke all on function public.get_archive_showcase_page(bigint, text, text, text, text, text, smallint, bigint, bigint, integer) from public;
grant execute on function public.get_archive_showcase_overview(bigint, text, text, text, text, text, smallint) to anon, authenticated;
grant execute on function public.get_archive_showcase_page(bigint, text, text, text, text, text, smallint, bigint, bigint, integer) to anon, authenticated;
