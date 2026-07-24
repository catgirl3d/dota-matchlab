begin;

create extension if not exists pgtap with schema extensions;

select plan(36);

select has_table('public', 'dota_matches', 'dota_matches exists');
select has_table('public', 'player_match_stats', 'player_match_stats exists');
select has_table('public', 'tracked_account_matches', 'tracked_account_matches exists');
select has_table('public', 'account_match_sync_state', 'account_match_sync_state exists');

select has_pk('public', 'dota_matches', 'dota_matches has a primary key');
select has_pk('public', 'player_match_stats', 'player_match_stats has a primary key');
select has_pk('public', 'tracked_account_matches', 'tracked_account_matches has a primary key');
select has_pk('public', 'account_match_sync_state', 'account_match_sync_state has a primary key');
select has_fk('public', 'player_match_stats', 'player_match_stats references archived matches');
select has_fk('public', 'tracked_account_matches', 'tracked_account_matches references its parents');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.dota_matches'::regclass),
  'dota_matches has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.player_match_stats'::regclass),
  'player_match_stats has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.tracked_account_matches'::regclass),
  'tracked_account_matches has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.account_match_sync_state'::regclass),
  'account_match_sync_state has RLS enabled'
);

select ok(
  has_table_privilege('authenticated', 'public.dota_matches', 'select'),
  'authenticated can read archived matches'
);
select ok(
  not has_table_privilege('authenticated', 'public.match_provider_payloads', 'select'),
  'authenticated cannot read raw provider payloads'
);
select ok(
  not has_table_privilege('authenticated', 'public.dota_matches', 'insert'),
  'authenticated cannot insert archived matches'
);
select ok(
  not has_table_privilege('authenticated', 'public.player_match_stats', 'update'),
  'authenticated cannot update player stats'
);
select ok(
  not has_table_privilege('authenticated', 'public.tracked_account_matches', 'delete'),
  'authenticated cannot delete archive links'
);
select ok(
  has_table_privilege('service_role', 'public.dota_matches', 'insert'),
  'service role can insert archived matches'
);
select ok(
  has_table_privilege('service_role', 'public.player_match_stats', 'update'),
  'service role can update player stats'
);
select ok(
  has_table_privilege('service_role', 'public.tracked_account_matches', 'insert'),
  'service role can create archive links'
);
select ok(
  has_table_privilege('service_role', 'public.account_match_sync_state', 'update'),
  'service role can update sync state'
);

insert into public.tracked_accounts (id, user_id, steam_id64)
values ('00000000-0000-0000-0000-000000000101', 'archive-user-a', '76561198083722517');

insert into public.dota_matches (match_id, start_time, duration, radiant_win)
values
  (9000000001, 1700000000, 2400, true),
  (9000000002, 1700001000, 1800, false);

insert into public.player_match_stats (match_id, account_id, player_slot, hero_id)
values
  (9000000001, 123456789, 0, 1),
  (9000000001, 42, 128, 2),
  (9000000002, 987654321, 0, 3);

insert into public.tracked_account_matches (tracked_account_id, match_id)
values ('00000000-0000-0000-0000-000000000101', 9000000001);

insert into public.match_provider_payloads (match_id, provider, payload_kind, payload)
values
  (9000000001, 'stratz', 'history', '{"id":9000000001}'::jsonb),
  (9000000002, 'stratz', 'history', '{"id":9000000002}'::jsonb);

insert into public.account_match_sync_state (dota_account_id, status)
values
  (123456789, 'ready'),
  (987654321, 'ready');

select set_config('request.jwt.claims', '{"sub":"archive-user-a"}', true);
set local role authenticated;

select is(
  (select count(*) from public.dota_matches),
  2::bigint,
  'authenticated users can read shared match metadata'
);
select is(
  (select count(*) from public.player_match_stats),
  3::bigint,
  'authenticated users can read shared player statistics'
);
select is(
  (select count(*) from public.tracked_account_matches),
  1::bigint,
  'a user can read their tracked account match links'
);
select is(
  (select count(*) from public.account_match_sync_state),
  1::bigint,
  'a user can read sync state for their tracked account'
);
select is(
  has_table_privilege('anon', 'public.match_provider_payloads', 'select'),
  false,
  'anonymous users cannot read raw provider payloads'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"archive-user-b"}', true);
set local role authenticated;

select is(
  (select count(*) from public.dota_matches),
  2::bigint,
  'shared match metadata does not depend on archive ownership'
);
select is(
  (select count(*) from public.player_match_stats),
  3::bigint,
  'shared player statistics do not depend on archive ownership'
);
select is(
  (select count(*) from public.tracked_account_matches),
  0::bigint,
  'another user cannot read archive links'
);
select is(
  (select count(*) from public.account_match_sync_state),
  0::bigint,
  'another user cannot read sync state'
);
select is(
  has_table_privilege('authenticated', 'public.match_provider_payloads', 'select'),
  false,
  'raw provider payloads remain unavailable regardless of archive ownership'
);

reset role;

delete from public.tracked_accounts
where id = '00000000-0000-0000-0000-000000000101';

select is(
  (select count(*)
   from public.tracked_account_matches
   where tracked_account_id = '00000000-0000-0000-0000-000000000101'),
  0::bigint,
  'deleting a tracked account removes its archive links'
);
select is(
  (select count(*)
   from public.dota_matches
   where match_id in (9000000001, 9000000002)),
  2::bigint,
  'deleting a tracked account preserves deduplicated matches'
);

delete from public.dota_matches where match_id = 9000000002;

select is(
  (select count(*) from public.player_match_stats where match_id = 9000000002),
  0::bigint,
  'deleting a match removes its player stats'
);

select * from finish();
rollback;
