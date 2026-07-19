create or replace function public.get_match_archive_overview(
  p_tracked_account_id uuid,
  p_period text default 'all',
  p_mode text default 'all',
  p_result text default 'all',
  p_party text default 'all',
  p_position text default 'all',
  p_hero_id smallint default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  result jsonb;
begin
  if p_period not in ('all', '30d', '90d', 'year')
    or p_mode not in ('all', 'ranked', 'turbo', 'all-pick')
    or p_result not in ('all', 'wins', 'losses')
    or p_party not in ('all', 'solo', 'party')
    or p_position not in ('all', 'carry', 'mid', 'offlane', 'support', 'hard-support')
  then
    raise exception 'Invalid archive filter';
  end if;

  with base as (
    select
      linked.match_id as linked_match_id,
      match.match_id,
      stats.match_id as stats_match_id,
      match.start_time,
      match.duration,
      match.radiant_win,
      match.game_mode,
      stats.player_slot,
      stats.hero_id,
      stats.kills,
      stats.deaths,
      stats.assists,
      stats.gold_per_min,
      stats.xp_per_min,
      stats.last_hits,
      stats.hero_damage,
      stats.party_size,
      stats.lane,
      stats.lane_role,
      case
        when stats.player_slot is null or match.radiant_win is null then null
        else (stats.player_slot < 128) = match.radiant_win
      end as won
    from public.tracked_account_matches as linked
    join public.tracked_accounts as account
      on account.id = linked.tracked_account_id
      and account.user_id = ((select auth.jwt()) ->> 'sub')
    left join public.dota_matches as match
      on match.match_id = linked.match_id
    left join public.player_match_stats as stats
      on stats.match_id = linked.match_id
      and stats.account_id = account.dota_account_id
    where linked.tracked_account_id = p_tracked_account_id
  ), complete_matches as (
    select *
    from base
    where match_id is not null and stats_match_id is not null
  ), filtered as (
    select *
    from complete_matches
    where (p_period = 'all' or start_time >= extract(epoch from now() - case p_period
      when '30d' then interval '30 days'
      when '90d' then interval '90 days'
      when 'year' then interval '365 days'
    end)::bigint)
      and (p_mode = 'all' or game_mode = case p_mode when 'ranked' then 22 when 'turbo' then 23 when 'all-pick' then 1 end)
      and (p_result = 'all' or (p_result = 'wins' and won is true) or (p_result = 'losses' and won is false))
      and (p_party = 'all' or (p_party = 'solo' and party_size in (0, 1)) or (p_party = 'party' and party_size > 1))
      and (p_position = 'all' or lane_role = case p_position when 'carry' then 1 when 'mid' then 2 when 'offlane' then 3 when 'support' then 4 when 'hard-support' then 5 end)
      and (p_hero_id is null or hero_id = p_hero_id)
  ), summary as (
    select
      count(*)::integer as matches,
      count(*) filter (where won is true)::integer as wins,
      count(*) filter (where won is false)::integer as losses,
      count(*) filter (where won is null)::integer as unknown_results,
      coalesce(round(100.0 * count(*) filter (where won is true) / nullif(count(*) filter (where won is not null), 0), 1), 0) as win_rate,
      coalesce(round(avg(kills) filter (where kills is not null), 1), 0) as average_kills,
      coalesce(round(avg(deaths) filter (where deaths is not null), 1), 0) as average_deaths,
      coalesce(round(avg(assists) filter (where assists is not null), 1), 0) as average_assists,
      coalesce(round(avg((kills + assists)::numeric / greatest(deaths, 1)) filter (where kills is not null and deaths is not null and assists is not null), 1), 0) as average_kda,
      coalesce(round(avg(gold_per_min) filter (where gold_per_min is not null)), 0)::integer as average_gpm,
      coalesce(round(avg(xp_per_min) filter (where xp_per_min is not null)), 0)::integer as average_xpm,
      coalesce(round(avg(last_hits) filter (where last_hits is not null)), 0)::integer as average_last_hits,
      coalesce(round(avg(hero_damage) filter (where hero_damage is not null)), 0)::integer as average_damage,
      coalesce(round(avg(duration) filter (where duration is not null) / 60.0, 1), 0) as average_duration_minutes,
      min(start_time) as first_match_at,
      max(start_time) as latest_match_at
    from filtered
  ), integrity as (
    select
      count(*)::integer as linked,
      count(*) filter (where match_id is not null and stats_match_id is not null)::integer as complete,
      count(*) filter (where match_id is not null and stats_match_id is null)::integer as missing_stats,
      count(*) filter (where match_id is null)::integer as missing_match
    from base
  )
  select jsonb_build_object(
    'summary', (select to_jsonb(summary) from summary),
    'form', coalesce((select jsonb_agg(case when won is true then 'win' when won is false then 'loss' else 'unknown' end order by start_time desc nulls last, match_id desc) from (select * from filtered order by start_time desc nulls last, match_id desc limit 20) as recent), '[]'::jsonb),
    'modes', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'matches', matches, 'wins', wins, 'winRate', win_rate) order by matches desc, key) from (select case when game_mode = 22 then 'ranked' when game_mode = 23 then 'turbo' when game_mode = 1 then 'all-pick' else 'other' end as key, case when game_mode = 22 then 'Ranked' when game_mode = 23 then 'Turbo' when game_mode = 1 then 'All Pick' else 'Other' end as label, count(*)::integer as matches, count(*) filter (where won is true)::integer as wins, coalesce(round(100.0 * count(*) filter (where won is true) / nullif(count(*) filter (where won is not null), 0), 1), 0) as win_rate from filtered group by 1, 2) as modes), '[]'::jsonb),
    'heroes', coalesce((select jsonb_agg(jsonb_build_object('key', hero_id::text, 'heroId', hero_id, 'matches', matches, 'wins', wins, 'winRate', win_rate, 'averageKda', average_kda, 'averageGpm', average_gpm) order by matches desc, win_rate desc, hero_id) from (select hero_id, count(*)::integer as matches, count(*) filter (where won is true)::integer as wins, coalesce(round(100.0 * count(*) filter (where won is true) / nullif(count(*) filter (where won is not null), 0), 1), 0) as win_rate, coalesce(round(avg((kills + assists)::numeric / greatest(deaths, 1)) filter (where kills is not null and deaths is not null and assists is not null), 1), 0) as average_kda, coalesce(round(avg(gold_per_min) filter (where gold_per_min is not null)), 0)::integer as average_gpm from filtered where hero_id is not null group by hero_id) as heroes), '[]'::jsonb),
    'positions', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'matches', matches, 'wins', wins, 'winRate', win_rate) order by matches desc, key) from (select case lane_role when 1 then 'carry' when 2 then 'mid' when 3 then 'offlane' when 4 then 'support' when 5 then 'hard-support' else 'unknown' end as key, case lane_role when 1 then 'Carry' when 2 then 'Mid' when 3 then 'Offlane' when 4 then 'Soft support' when 5 then 'Hard support' else 'Unknown position' end as label, count(*)::integer as matches, count(*) filter (where won is true)::integer as wins, coalesce(round(100.0 * count(*) filter (where won is true) / nullif(count(*) filter (where won is not null), 0), 1), 0) as win_rate from filtered group by 1, 2) as positions), '[]'::jsonb),
    'lanes', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'matches', matches, 'wins', wins, 'winRate', win_rate) order by matches desc, key) from (select case lane when 1 then 'safe' when 2 then 'mid' when 3 then 'offlane' else 'unknown' end as key, case lane when 1 then 'Safe lane' when 2 then 'Mid lane' when 3 then 'Off lane' else 'Unknown lane' end as label, count(*)::integer as matches, count(*) filter (where won is true)::integer as wins, coalesce(round(100.0 * count(*) filter (where won is true) / nullif(count(*) filter (where won is not null), 0), 1), 0) as win_rate from filtered group by 1, 2) as lanes), '[]'::jsonb),
    'party', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'matches', matches, 'wins', wins, 'winRate', win_rate) order by matches desc, key) from (select case when party_size in (0, 1) then 'solo' when party_size > 1 then 'party' else 'unknown' end as key, case when party_size in (0, 1) then 'Solo' when party_size > 1 then 'Party' else 'Unknown' end as label, count(*)::integer as matches, count(*) filter (where won is true)::integer as wins, coalesce(round(100.0 * count(*) filter (where won is true) / nullif(count(*) filter (where won is not null), 0), 1), 0) as win_rate from filtered group by 1, 2) as party), '[]'::jsonb),
    'tempo', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'matches', matches, 'wins', wins, 'winRate', win_rate) order by matches desc, key) from (select case when coalesce(duration, 0) < 1800 then 'early' when coalesce(duration, 0) >= 2400 then 'late' else 'standard' end as key, case when coalesce(duration, 0) < 1800 then 'Under 30 min' when coalesce(duration, 0) >= 2400 then '40+ min' else '30-40 min' end as label, count(*)::integer as matches, count(*) filter (where won is true)::integer as wins, coalesce(round(100.0 * count(*) filter (where won is true) / nullif(count(*) filter (where won is not null), 0), 1), 0) as win_rate from filtered group by 1, 2) as tempo), '[]'::jsonb),
    'heroOptions', coalesce((select jsonb_agg(hero_id order by hero_id) from (select distinct hero_id from complete_matches where hero_id is not null) as heroes), '[]'::jsonb),
    'syncState', (select to_jsonb(sync_state) from public.account_match_sync_state as sync_state join public.tracked_accounts as account on account.dota_account_id = sync_state.dota_account_id where account.id = p_tracked_account_id and account.user_id = ((select auth.jwt()) ->> 'sub') limit 1),
    'integrity', (select to_jsonb(integrity) from integrity)
  ) into result;

  return result;
end;
$function$;

create or replace function public.get_match_archive_page(
  p_tracked_account_id uuid,
  p_period text default 'all', p_mode text default 'all', p_result text default 'all',
  p_party text default 'all', p_position text default 'all', p_hero_id smallint default null,
  p_cursor_start_time bigint default null, p_cursor_match_id bigint default null, p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  result jsonb;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Archive page limit must be between 1 and 100'; end if;
  if p_cursor_start_time is not null and p_cursor_match_id is null then raise exception 'Archive cursor is invalid'; end if;
  if p_period not in ('all', '30d', '90d', 'year') or p_mode not in ('all', 'ranked', 'turbo', 'all-pick') or p_result not in ('all', 'wins', 'losses') or p_party not in ('all', 'solo', 'party') or p_position not in ('all', 'carry', 'mid', 'offlane', 'support', 'hard-support') then raise exception 'Invalid archive filter'; end if;

  with filtered as (
    select match.match_id, match.start_time, match.duration as duration_seconds, match.radiant_win, match.game_mode, match.lobby_type, match.average_rank, match.radiant_score, match.dire_score, stats.player_slot, stats.hero_id, stats.hero_variant, stats.kills, stats.deaths, stats.assists, stats.gold_per_min, stats.xp_per_min, stats.last_hits, stats.denies, stats.hero_damage, stats.tower_damage, stats.hero_healing, stats.level, stats.net_worth, stats.leaver_status, stats.party_size, stats.lane, stats.lane_role, stats.is_roaming, case when stats.player_slot is null or match.radiant_win is null then null else (stats.player_slot < 128) = match.radiant_win end as won
    from public.tracked_account_matches as linked
    join public.tracked_accounts as account on account.id = linked.tracked_account_id and account.user_id = ((select auth.jwt()) ->> 'sub')
    join public.dota_matches as match on match.match_id = linked.match_id
    join public.player_match_stats as stats on stats.match_id = linked.match_id and stats.account_id = account.dota_account_id
    where linked.tracked_account_id = p_tracked_account_id
      and (p_period = 'all' or match.start_time >= extract(epoch from now() - case p_period when '30d' then interval '30 days' when '90d' then interval '90 days' when 'year' then interval '365 days' end)::bigint)
      and (p_mode = 'all' or match.game_mode = case p_mode when 'ranked' then 22 when 'turbo' then 23 when 'all-pick' then 1 end)
      and (p_result = 'all' or (p_result = 'wins' and ((stats.player_slot < 128) = match.radiant_win)) or (p_result = 'losses' and ((stats.player_slot < 128) <> match.radiant_win)))
      and (p_party = 'all' or (p_party = 'solo' and stats.party_size in (0, 1)) or (p_party = 'party' and stats.party_size > 1))
      and (p_position = 'all' or stats.lane_role = case p_position when 'carry' then 1 when 'mid' then 2 when 'offlane' then 3 when 'support' then 4 when 'hard-support' then 5 end)
      and (p_hero_id is null or stats.hero_id = p_hero_id)
  ), cursor_filtered as (
    select * from filtered
    where p_cursor_match_id is null
      or (p_cursor_start_time is not null and (start_time < p_cursor_start_time or (start_time = p_cursor_start_time and match_id < p_cursor_match_id) or start_time is null))
      or (p_cursor_start_time is null and start_time is null and match_id < p_cursor_match_id)
  ), page_window as (
    select * from cursor_filtered order by start_time desc nulls last, match_id desc limit p_limit + 1
  ), page as (
    select * from page_window order by start_time desc nulls last, match_id desc limit p_limit
  ), boundary as (
    select start_time, match_id from page order by start_time asc nulls first, match_id asc limit 1
  )
  select jsonb_build_object(
    'matches', coalesce((select jsonb_agg(jsonb_build_object('matchId', match_id, 'startTime', start_time, 'durationSeconds', duration_seconds, 'radiantWin', radiant_win, 'gameMode', game_mode, 'lobbyType', lobby_type, 'averageRank', average_rank, 'radiantScore', radiant_score, 'direScore', dire_score, 'playerSlot', player_slot, 'heroId', hero_id, 'heroVariant', hero_variant, 'kills', kills, 'deaths', deaths, 'assists', assists, 'goldPerMinute', gold_per_min, 'xpPerMinute', xp_per_min, 'lastHits', last_hits, 'denies', denies, 'heroDamage', hero_damage, 'towerDamage', tower_damage, 'heroHealing', hero_healing, 'level', level, 'netWorth', net_worth, 'leaverStatus', leaver_status, 'partySize', party_size, 'lane', lane, 'laneRole', lane_role, 'isRoaming', is_roaming, 'won', won) order by start_time desc nulls last, match_id desc) from page), '[]'::jsonb),
    'nextCursor', case when (select count(*) from page_window) > p_limit then (select jsonb_build_object('startTime', start_time, 'matchId', match_id) from boundary) else null end
  ) into result;
  return result;
end;
$function$;

revoke all on function public.get_match_archive_overview(uuid, text, text, text, text, text, smallint) from public, anon, authenticated;
revoke all on function public.get_match_archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer) from public, anon, authenticated;
grant execute on function public.get_match_archive_overview(uuid, text, text, text, text, text, smallint) to authenticated;
grant execute on function public.get_match_archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer) to authenticated;
