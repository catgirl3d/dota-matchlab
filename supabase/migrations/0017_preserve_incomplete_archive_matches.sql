create or replace function public.get_match_archive_page(
  p_tracked_account_id uuid,
  p_period text default 'all',
  p_mode text default 'all',
  p_result text default 'all',
  p_party text default 'all',
  p_position text default 'all',
  p_hero_id smallint default null,
  p_cursor_start_time bigint default null,
  p_cursor_match_id bigint default null,
  p_limit integer default 100
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
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'Archive page limit must be between 1 and 100';
  end if;
  if p_cursor_start_time is not null and p_cursor_match_id is null then
    raise exception 'Archive cursor is invalid';
  end if;
  if p_period not in ('all', '30d', '90d', 'year')
    or p_mode not in ('all', 'ranked', 'turbo', 'all-pick')
    or p_result not in ('all', 'wins', 'losses')
    or p_party not in ('all', 'solo', 'party')
    or p_position not in ('all', 'carry', 'mid', 'offlane', 'support', 'hard-support')
  then
    raise exception 'Invalid archive filter';
  end if;

  with filtered as (
    select
      match.match_id,
      match.start_time,
      match.duration as duration_seconds,
      match.radiant_win,
      match.game_mode,
      match.lobby_type,
      match.average_rank,
      match.radiant_score,
      match.dire_score,
      stats.player_slot,
      stats.hero_id,
      stats.hero_variant,
      stats.kills,
      stats.deaths,
      stats.assists,
      stats.gold_per_min,
      stats.xp_per_min,
      stats.last_hits,
      stats.denies,
      stats.hero_damage,
      stats.tower_damage,
      stats.hero_healing,
      stats.level,
      stats.net_worth,
      stats.leaver_status,
      stats.party_size,
      stats.lane,
      stats.lane_role,
      stats.is_roaming,
      case
        when stats.match_id is null then 'missing_player_stats'
        else 'complete'
      end as data_status,
      case
        when stats.player_slot is null or match.radiant_win is null then null
        else (stats.player_slot < 128) = match.radiant_win
      end as won
    from public.tracked_account_matches as linked
    join public.tracked_accounts as account
      on account.id = linked.tracked_account_id
      and account.user_id = ((select auth.jwt()) ->> 'sub')
    join public.dota_matches as match
      on match.match_id = linked.match_id
    left join public.player_match_stats as stats
      on stats.match_id = linked.match_id
      and stats.account_id = account.dota_account_id
    where linked.tracked_account_id = p_tracked_account_id
      and (p_period = 'all' or match.start_time >= extract(epoch from now() - case p_period
        when '30d' then interval '30 days'
        when '90d' then interval '90 days'
        when 'year' then interval '365 days'
      end)::bigint)
      and (p_mode = 'all' or match.game_mode = case p_mode when 'ranked' then 22 when 'turbo' then 23 when 'all-pick' then 1 end)
      and (p_result = 'all' or (p_result = 'wins' and ((stats.player_slot < 128) = match.radiant_win)) or (p_result = 'losses' and ((stats.player_slot < 128) <> match.radiant_win)))
      and (p_party = 'all' or (p_party = 'solo' and stats.party_size in (0, 1)) or (p_party = 'party' and stats.party_size > 1))
      and (p_position = 'all' or stats.lane_role = case p_position when 'carry' then 1 when 'mid' then 2 when 'offlane' then 3 when 'support' then 4 when 'hard-support' then 5 end)
      and (p_hero_id is null or stats.hero_id = p_hero_id)
  ), cursor_filtered as (
    select *
    from filtered
    where p_cursor_match_id is null
      or (p_cursor_start_time is not null and (
        start_time < p_cursor_start_time
        or (start_time = p_cursor_start_time and match_id < p_cursor_match_id)
        or start_time is null
      ))
      or (p_cursor_start_time is null and start_time is null and match_id < p_cursor_match_id)
  ), page_window as (
    select *
    from cursor_filtered
    order by start_time desc nulls last, match_id desc
    limit p_limit + 1
  ), page as (
    select *
    from page_window
    order by start_time desc nulls last, match_id desc
    limit p_limit
  ), boundary as (
    select start_time, match_id
    from page
    order by start_time asc nulls first, match_id asc
    limit 1
  )
  select jsonb_build_object(
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'matchId', match_id,
        'startTime', start_time,
        'durationSeconds', duration_seconds,
        'radiantWin', radiant_win,
        'gameMode', game_mode,
        'lobbyType', lobby_type,
        'averageRank', average_rank,
        'radiantScore', radiant_score,
        'direScore', dire_score,
        'playerSlot', player_slot,
        'heroId', hero_id,
        'heroVariant', hero_variant,
        'kills', kills,
        'deaths', deaths,
        'assists', assists,
        'goldPerMinute', gold_per_min,
        'xpPerMinute', xp_per_min,
        'lastHits', last_hits,
        'denies', denies,
        'heroDamage', hero_damage,
        'towerDamage', tower_damage,
        'heroHealing', hero_healing,
        'level', level,
        'netWorth', net_worth,
        'leaverStatus', leaver_status,
        'partySize', party_size,
        'lane', lane,
        'laneRole', lane_role,
        'isRoaming', is_roaming,
        'won', won,
        'dataStatus', data_status
      ) order by start_time desc nulls last, match_id desc)
      from page
    ), '[]'::jsonb),
    'nextCursor', case
      when (select count(*) from page_window) > p_limit
      then (select jsonb_build_object('startTime', start_time, 'matchId', match_id) from boundary)
      else null
    end
  ) into result;

  return result;
end;
$function$;

revoke all on function public.get_match_archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer)
from public, anon, authenticated;

grant execute on function public.get_match_archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer)
to authenticated;
