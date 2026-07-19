begin;

select plan(30);

select has_function('public', 'get_match_archive_overview', array['uuid', 'text', 'text', 'text', 'text', 'text', 'smallint'], 'overview RPC exists');
select has_function('public', 'get_match_archive_page', array['uuid', 'text', 'text', 'text', 'text', 'text', 'smallint', 'bigint', 'bigint', 'integer'], 'page RPC exists');
select ok(has_function_privilege('authenticated', 'public.get_match_archive_overview(uuid, text, text, text, text, text, smallint)', 'execute'), 'authenticated can execute overview RPC');
select ok(not has_function_privilege('anon', 'public.get_match_archive_overview(uuid, text, text, text, text, text, smallint)', 'execute'), 'anon cannot execute overview RPC');
select ok(has_function_privilege('authenticated', 'public.get_match_archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer)', 'execute'), 'authenticated can execute page RPC');
select ok(not has_function_privilege('anon', 'public.get_match_archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer)', 'execute'), 'anon cannot execute page RPC');

insert into public.tracked_accounts (id, user_id, steam_id64, dota_account_id)
values
  ('00000000-0000-0000-0000-000000001601', 'archive-rpc-a', '76561198083722517', 1601),
  ('00000000-0000-0000-0000-000000001602', 'archive-rpc-b', '76561198083722518', 1602);

insert into public.dota_matches (match_id, start_time, duration, radiant_win, game_mode)
values
  (9000001601, 1700000000, 2400, true, 22),
  (9000001600, 1700000000, 1800, true, 23),
  (9000001599, null, 1200, true, 1),
  (9000001598, 1690000000, 1800, true, 22);

insert into public.player_match_stats (match_id, account_id, player_slot, hero_id, kills, deaths, assists, gold_per_min, party_size, lane_role)
values
  (9000001601, 1601, 0, 1, 10, 2, 8, 600, 0, 1),
  (9000001600, 1601, 128, 2, null, 4, 6, null, 3, 2),
  (9000001599, 1601, null, null, 2, 1, 9, 400, 1, 5);

insert into public.tracked_account_matches (tracked_account_id, match_id)
values
  ('00000000-0000-0000-0000-000000001601', 9000001601),
  ('00000000-0000-0000-0000-000000001601', 9000001600),
  ('00000000-0000-0000-0000-000000001601', 9000001599),
  ('00000000-0000-0000-0000-000000001601', 9000001598);

select set_config('request.jwt.claims', '{"sub":"archive-rpc-a"}', true);
set local role authenticated;

create temp table overview as
select public.get_match_archive_overview('00000000-0000-0000-0000-000000001601') as value;

select is((select value #>> '{integrity,linked}' from overview), '4', 'overview counts every linked match');
select is((select value #>> '{integrity,complete}' from overview), '3', 'overview counts rows with tracked player stats');
select is((select value #>> '{integrity,missing_stats}' from overview), '1', 'overview exposes missing stats rows');
select is((select value #>> '{integrity,missing_match}' from overview), '0', 'overview explicitly reports impossible missing match links');
select is((select value #>> '{summary,win_rate}' from overview), '50.0', 'unknown results do not reduce win rate');
select is((select value #>> '{summary,average_kills}' from overview), '6.0', 'null metrics are excluded from their denominator');
select is((select jsonb_array_length(value -> 'heroes') from overview), 2, 'hero breakdown excludes null hero IDs');
select is((public.get_match_archive_overview('00000000-0000-0000-0000-000000001601', 'all', 'ranked') #>> '{summary,matches}'), '1', 'mode filter is applied in the database');
select is((public.get_match_archive_overview('00000000-0000-0000-0000-000000001601', 'all', 'all', 'wins') #>> '{summary,matches}'), '1', 'result filter excludes losses and unknown results');
select is((public.get_match_archive_overview('00000000-0000-0000-0000-000000001601', 'all', 'all', 'all', 'solo') #>> '{summary,matches}'), '2', 'party filter preserves zero and one as solo');
select is((public.get_match_archive_overview('00000000-0000-0000-0000-000000001601', 'all', 'all', 'all', 'all', 'mid') #>> '{summary,matches}'), '1', 'position filter is applied in the database');
select is((public.get_match_archive_overview('00000000-0000-0000-0000-000000001601', 'all', 'all', 'all', 'all', 'all', 1::smallint) #>> '{summary,matches}'), '1', 'hero filter is applied in the database');
select is((public.get_match_archive_overview('00000000-0000-0000-0000-000000001601', '30d') #>> '{summary,matches}'), '0', 'period filter excludes old matches');

create temp table first_page as
select public.get_match_archive_page('00000000-0000-0000-0000-000000001601', 'all', 'all', 'all', 'all', 'all', null, null, null, 2) as value;

select is((select value #>> '{matches,0,matchId}' from first_page), '9000001601', 'page orders equal timestamps by match id descending');
select is((select value #>> '{matches,1,matchId}' from first_page), '9000001600', 'page uses deterministic second row order');
select is((select value #>> '{matches,0,dataStatus}' from first_page), 'complete', 'page marks rows with player stats as complete');
select is((select value #>> '{nextCursor,matchId}' from first_page), '9000001600', 'page returns cursor from final row');
select is((select (public.get_match_archive_page('00000000-0000-0000-0000-000000001601', 'all', 'all', 'all', 'all', 'all', null, 1700000000, 9000001600, 2) -> 'matches' -> 0 ->> 'matchId')), '9000001598', 'cursor includes linked matches without player stats');
select is((select (public.get_match_archive_page('00000000-0000-0000-0000-000000001601', 'all', 'all', 'all', 'all', 'all', null, 1690000000, 9000001598, 2) -> 'matches' -> 0 ->> 'matchId')), '9000001599', 'cursor continues through null timestamps after an incomplete match');

create temp table full_page as
select public.get_match_archive_page('00000000-0000-0000-0000-000000001601', 'all', 'all', 'all', 'all', 'all', null, null, null, 4) as value;

select is((select jsonb_array_length(value -> 'matches') from full_page), 4, 'default filters preserve every linked match on the page');
select is(
  (
    select match ->> 'dataStatus'
    from full_page, jsonb_array_elements(value -> 'matches') as match
    where match ->> 'matchId' = '9000001598'
  ),
  'missing_player_stats',
  'page explicitly marks a linked match without player stats'
);
select throws_ok(
  $$select public.get_match_archive_page('00000000-0000-0000-0000-000000001601', 'all', 'all', 'all', 'all', 'all', null, null, null, null::integer)$$,
  'P0001',
  'Archive page limit must be between 1 and 100',
  'null page limit cannot bypass the response cap'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"archive-rpc-b"}', true);
set local role authenticated;
select is((public.get_match_archive_overview('00000000-0000-0000-0000-000000001601') #>> '{integrity,linked}'), '0', 'RLS prevents another user reading account overview');
select is(jsonb_array_length(public.get_match_archive_page('00000000-0000-0000-0000-000000001601') -> 'matches'), 0, 'RLS prevents another user reading archive pages');

reset role;
select * from finish();
rollback;
