begin;

select plan(33);

select has_table('public', 'archive_showcases', 'curated showcase registry exists');
select col_is_pk('public', 'archive_showcases', 'dota_account_id', 'Dota account is showcase key');
select col_is_unique('public', 'archive_showcases', 'tracked_account_id', 'tracked account can have one showcase');
select has_column('public', 'archive_showcases', 'slug', 'showcase slug exists');
select col_not_null('public', 'archive_showcases', 'slug', 'showcase slug is required');
select col_is_unique('public', 'archive_showcases', 'slug', 'showcase slug is unique');
select has_function('public', 'get_archive_showcase_overview', array['bigint', 'text', 'text', 'text', 'text', 'text', 'smallint', 'date', 'date'], 'public showcase overview RPC exists');
select has_function('public', 'get_archive_showcase_page', array['bigint', 'text', 'text', 'text', 'text', 'text', 'smallint', 'bigint', 'bigint', 'integer', 'date', 'date'], 'public showcase page RPC exists');
select has_function('public', 'resolve_archive_showcase', array['text'], 'public showcase resolver RPC exists');
select ok(has_function_privilege('anon', 'public.get_archive_showcase_overview(bigint, text, text, text, text, text, smallint, date, date)', 'execute'), 'anon can execute overview');
select ok(has_function_privilege('anon', 'public.get_archive_showcase_page(bigint, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)', 'execute'), 'anon can execute page');
select ok(has_function_privilege('anon', 'public.resolve_archive_showcase(text)', 'execute'), 'anon can execute resolver');
select ok(not has_table_privilege('anon', 'public.archive_showcases', 'select'), 'anon cannot read registry');
select ok(not has_table_privilege('anon', 'public.tracked_accounts', 'select'), 'anon cannot read accounts');
select ok(not has_table_privilege('anon', 'public.tracked_account_matches', 'select'), 'anon cannot read match links');
select ok(not has_schema_privilege('anon', 'archive_private', 'usage'), 'anon cannot access archive helpers');
select ok(not has_table_privilege('authenticated', 'public.archive_showcases', 'select'), 'authenticated cannot bypass showcase RPCs');

insert into public.tracked_accounts (id, user_id, steam_id64, persona_name, rank_tier)
values
  ('00000000-0000-0000-0000-000000002001', 'showcase-owner', '76561197960267729', 'Curated player', 54),
  ('00000000-0000-0000-0000-000000002002', 'private-owner', '76561197960267730', 'Private player', 44),
  ('00000000-0000-0000-0000-000000002003', 'constraint-owner', '76561197960267731', 'Constraint player', 34),
  ('00000000-0000-0000-0000-000000002004', 'duplicate-owner', '76561197960267732', 'Duplicate player', 24);
insert into public.archive_showcases (dota_account_id, tracked_account_id, slug)
values (2001, '00000000-0000-0000-0000-000000002001', 'demo');
insert into public.dota_matches (match_id, start_time, duration, radiant_win, game_mode)
values (9000002001, 1700000000, 1800, true, 22);
insert into public.player_match_stats (match_id, account_id, player_slot, hero_id, kills, deaths, assists, gold_per_min, party_size, lane_role)
values (9000002001, 2001, 0, 1, 8, 2, 9, 500, 1, 1);
insert into public.tracked_account_matches (tracked_account_id, match_id)
values ('00000000-0000-0000-0000-000000002001', 9000002001);

set local role anon;
select is(public.get_archive_showcase_overview(2001) #>> '{account,dotaAccountId}', '2001', 'public overview exposes requested account id only');
select is(public.get_archive_showcase_overview(2001) #>> '{account,personaName}', 'Curated player', 'public overview exposes curated profile metadata');
select ok((public.get_archive_showcase_overview(2001) #>> '{overview,syncState}') is null, 'public overview never exposes sync state');
select is(public.get_archive_showcase_page(2001) #>> '{matches,0,matchId}', '9000002001', 'public page reads curated match');
select is((public.get_archive_showcase_overview(2001, 'custom', 'all', 'all', 'all', 'all', null, '2023-11-14', '2023-11-14') #>> '{overview,summary,matches}'), '1', 'public overview applies a custom UTC date range');
select ok(public.get_archive_showcase_overview(2002) is null, 'private profile is indistinguishable from missing');
select ok(public.get_archive_showcase_page(2002) is null, 'private archive page is indistinguishable from missing');
select ok(public.get_archive_showcase_overview(999999) is null, 'missing profile returns SQL null');
select is(public.resolve_archive_showcase(' DEMO '), 2001::bigint, 'resolver normalizes the demo slug');
select ok(public.resolve_archive_showcase('missing-player') is null, 'resolver returns null for a missing slug');
select ok(public.resolve_archive_showcase('not valid') is null, 'resolver returns null for a malformed slug');
reset role;

select throws_ok(
  $$insert into public.archive_showcases (dota_account_id, tracked_account_id, slug) values (2002, '00000000-0000-0000-0000-000000002001', 'mismatched')$$,
  '23503', null, 'mismatched account pair cannot be curated'
);
select throws_ok(
  $$insert into public.archive_showcases (dota_account_id, tracked_account_id, slug) values (2003, '00000000-0000-0000-0000-000000002003', 'Invalid')$$,
  '23514', null, 'showcase slug rejects invalid characters'
);
select throws_ok(
  $$insert into public.archive_showcases (dota_account_id, tracked_account_id, slug) values (2004, '00000000-0000-0000-0000-000000002004', 'demo')$$,
  '23505', null, 'showcase slug rejects duplicates'
);

select set_config('request.jwt.claims', '{"sub":"private-owner"}', true);
set local role authenticated;
select is((public.get_match_archive_overview('00000000-0000-0000-0000-000000002001') #>> '{integrity,linked}'), '0', 'owner RPC still protects another user');
select is(jsonb_array_length(public.get_match_archive_page('00000000-0000-0000-0000-000000002001') -> 'matches'), 0, 'owner page RPC still protects another user');
reset role;

select * from finish();
rollback;
