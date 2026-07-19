begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select has_function(
  'public',
  'apply_public_match_import',
  array['bigint', 'jsonb'],
  'public match import RPC exists'
);

select public.apply_public_match_import(
  8749050700,
  '{"status":"available","normalized_match":{"match_id":8749050700,"duration":2100,"radiant_win":true,"game_mode":23,"radiant_score":31,"dire_score":20},"payloads":[{"payload_section":"players","schema_version":"stratz.match.detail.v2","payload":{"data":{"match":{"id":8749050700,"players":[{"matchId":8749050700,"steamAccountId":77,"playerSlot":0,"heroId":1,"kills":9}]}}}}]}'::jsonb
);

select is(
  (select detail_status from public.dota_matches where match_id = 8749050700),
  'available',
  'import marks match available'
);
select is(
  (select game_mode from public.dota_matches where match_id = 8749050700),
  23::smallint,
  'import stores normalized metadata'
);
select is(
  (select kills from public.player_match_stats where match_id = 8749050700 and account_id = 77),
  9,
  'import stores player stats'
);
select ok(
  exists (select 1 from public.match_provider_payloads where match_id = 8749050700 and payload_section = 'players'),
  'import stores provider payload'
);
select is(
  (select count(*) from public.tracked_account_matches where match_id = 8749050700),
  0::bigint,
  'public import does not add archive membership'
);
select throws_ok(
  $$select public.apply_public_match_import(8749050701, '{"status":"available","normalized_match":{"match_id":8749050702},"payloads":[]}'::jsonb)$$,
  'Invalid public match import',
  'mismatched match ID is rejected'
);
select ok(
  not has_table_privilege('anon', 'public.tracked_account_matches', 'select'),
  'anonymous users cannot read private archive membership'
);
select ok(
  not has_function_privilege('anon', 'public.apply_public_match_import(bigint, jsonb)', 'execute'),
  'anonymous users cannot execute public match import writes'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"public-match-reader"}', true);
select is(
  (select count(*) from public.dota_matches where match_id = 8749050700),
  1::bigint,
  'authenticated users can read public match data'
);
reset role;

set local role anon;
select is(
  (select count(*) from public.dota_matches where match_id = 8749050700),
  1::bigint,
  'anonymous users can read public match metadata'
);
select is(
  (select count(*) from public.player_match_stats where match_id = 8749050700),
  1::bigint,
  'anonymous users can read public match stats'
);
select is(
  (select count(*) from public.match_provider_payloads where match_id = 8749050700),
  1::bigint,
  'anonymous users can read public match detail payloads'
);
reset role;

select * from finish();
rollback;
