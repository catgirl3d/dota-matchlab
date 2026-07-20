begin;

select plan(38);

insert into public.tracked_accounts (id, user_id, steam_id64)
values (
  '00000000-0000-0000-0000-000000000203',
  'sync-user-stratz',
  '76561198183610284'
);

set local role service_role;

select is(
  (select exists (
    select 1 from pg_trigger
    where tgrelid = 'public.match_provider_payloads'::regclass
      and tgname = 'match_provider_payloads_enqueue_stratz_detail'
      and not tgisinternal
  )),
  false,
  'STRATZ history payload trigger is removed'
);
select ok(
  to_regprocedure('public.enqueue_stratz_match_detail()') is null,
  'automatic STRATZ detail enqueue function is removed'
);
select ok(
  to_regprocedure('public.claim_match_detail_batch(text,uuid,integer,integer)') is null,
  'batch detail claim function is removed'
);

create temp table stratz_claim as
select public.claim_match_sync_for_provider(
  'sync-user-stratz',
  '00000000-0000-0000-0000-000000000203',
  300,
  'stratz'
) as value;

select is(
  (select value ->> 'claimed' from stratz_claim),
  'true',
  'STRATZ claim acquires a lease'
);
select is(
  (select value ->> 'historyProvider' from stratz_claim),
  'stratz',
  'STRATZ claim returns the selected provider'
);
select is(
  (select history_provider
   from public.account_match_sync_state
   where dota_account_id = 223344556),
  'stratz',
  'sync state stores the STRATZ provider'
);

select public.apply_match_sync_page_with_boundary_source_and_payloads(
  'sync-user-stratz',
  '00000000-0000-0000-0000-000000000203',
  223344556,
  ((select value ->> 'leaseToken' from stratz_claim))::uuid,
  '[
    {
      "match_id": 9000000203,
      "start_time": 1700001000,
      "duration": 1800,
      "radiant_win": true,
      "game_mode": 22,
      "player_slot": 0,
      "hero_id": 1,
      "kills": 10,
      "deaths": 2,
      "assists": 8
    }
  ]'::jsonb,
  0,
  true,
  9000000203,
  'stratz',
  '[
    {
      "match_id": 9000000203,
      "provider": "stratz",
      "payload_kind": "history",
      "schema_version": "stratz.match.history.v1",
      "payload": {
        "id": 9000000203,
        "pickBans": [{"heroId": 1, "isPick": true}],
        "providerOnly": {"preserved": true}
      }
    }
  ]'::jsonb
);

select is(
  (select source from public.dota_matches where match_id = 9000000203),
  'stratz',
  'source wrapper records STRATZ as the match source'
);
select is(
  (select status from public.account_match_sync_state where dota_account_id = 223344556),
  'ready',
  'a complete STRATZ page marks the sync ready'
);
select is(
  (select payload #>> '{providerOnly,preserved}'
   from public.match_provider_payloads
   where match_id = 9000000203 and provider = 'stratz' and payload_kind = 'history'),
  'true',
  'atomic apply stores raw provider fields outside the normalized schema'
);
select is(
  (select schema_version
   from public.match_provider_payloads
   where match_id = 9000000203 and provider = 'stratz' and payload_kind = 'history'),
  'stratz.match.history.v1',
  'raw payload records its provider schema version'
);
select is(
  (select count(*)::integer from public.account_match_detail_queue
   where dota_account_id = 223344556 and match_id = 9000000203),
  0,
  'inserting a STRATZ history payload does not enqueue detail'
);

update public.account_match_sync_state
set status = 'syncing',
    lease_token = extensions.gen_random_uuid(),
    lease_expires_at = now() + interval '5 minutes'
where dota_account_id = 223344556;

select public.apply_match_sync_page_with_boundary_source_and_payloads(
  'sync-user-stratz',
  '00000000-0000-0000-0000-000000000203',
  223344556,
  (select lease_token from public.account_match_sync_state where dota_account_id = 223344556),
  '[{"match_id": 9000000203, "radiant_win": true, "player_slot": 0, "hero_id": 1}]'::jsonb,
  0,
  true,
  9000000203,
  'stratz',
  '[{"match_id": 9000000203, "provider": "stratz", "payload_kind": "history", "payload": {"id": 9000000203, "providerOnly": {"preserved": false}}}]'::jsonb
);

select is(
  (select payload #>> '{providerOnly,preserved}'
   from public.match_provider_payloads
   where match_id = 9000000203 and provider = 'stratz' and payload_kind = 'history'),
  'false',
  'raw payload upsert updates the current provider payload atomically'
);
select is(
  (select count(*)::integer from public.account_match_detail_queue
   where dota_account_id = 223344556 and match_id = 9000000203),
  0,
  'updating a STRATZ history payload does not enqueue detail'
);

create temp table opendota_claim as
select public.claim_match_sync_for_provider(
  'sync-user-stratz',
  '00000000-0000-0000-0000-000000000203',
  300,
  'opendota'
) as value;

select is(
  (select value ->> 'historyProvider' from opendota_claim),
  'opendota',
  'switching provider updates the returned provider'
);
select is(
  (select value ->> 'offset' from opendota_claim),
  '0',
  'switching provider resets the history cursor'
);
select is(
  (select backfill_complete
   from public.account_match_sync_state
   where dota_account_id = 223344556),
  false,
  'switching provider resets completion state'
);

create temp table specific_detail_claim as
select public.claim_specific_match_detail(
  'sync-user-stratz',
  '00000000-0000-0000-0000-000000000203',
  9000000203,
  300
) as value;

select is(
  (select value ->> 'claimed' from specific_detail_claim),
  'true',
  'manual detail claim creates and leases the selected match'
);
select is(
  (select value -> 'matchIds' from specific_detail_claim),
  '[9000000203]'::jsonb,
  'manual detail claim returns exactly one selected match'
);
select is(
  (select status from public.account_match_detail_queue
   where dota_account_id = 223344556 and match_id = 9000000203),
  'syncing',
  'manual detail claim creates exactly one syncing queue row'
);

select public.apply_match_detail_batch(
  'sync-user-stratz',
  '00000000-0000-0000-0000-000000000203',
  223344556,
  ((select value ->> 'leaseToken' from specific_detail_claim))::uuid,
  '[{
    "match_id": 9000000203,
    "status": "available",
    "normalized_players": [{
      "match_id": 9000000203, "account_id": 111, "player_slot": 128, "hero_id": 2,
      "kills": 4, "deaths": 5, "assists": 6, "gold_per_min": 700,
      "xp_per_min": 800, "last_hits": 90, "denies": 3,
      "hero_damage": 10000, "tower_damage": 2000, "hero_healing": 50,
      "level": 18, "net_worth": 15000, "leaver_status": 0
    }],
    "payloads": [{
      "payload_section": "opaque_detail",
      "schema_version": "stratz.match.detail.v2",
      "payload": {"opaque": {"preserved": true, "sourceShape": "unrelated"}}
    }]
  }]'::jsonb
);

select is(
  (select detail_status from public.dota_matches where match_id = 9000000203),
  'available',
  'detail apply updates the normalized detail lifecycle'
);
select is(
  (select payload #>> '{opaque,sourceShape}'
   from public.match_provider_payloads
   where match_id = 9000000203 and provider = 'stratz' and payload_kind = 'detail'
      and payload_section = 'opaque_detail'),
  'unrelated',
  'detail apply stores opaque raw payload without inspecting its provider shape'
);
select is(
  (select status from public.account_match_detail_queue
   where dota_account_id = 223344556 and match_id = 9000000203),
  'available',
  'detail queue marks only the completed match available'
);
select is(
  (select gold_per_min::text from public.player_match_stats where match_id = 9000000203 and account_id = 111),
  '700',
  'detail player section normalizes the complete scoreboard when account IDs are available'
);
select is(
  (select backfill_complete from public.account_match_sync_state where dota_account_id = 223344556),
  false,
  'detail processing does not mutate the history cursor completion state'
);

insert into public.dota_matches (match_id)
values (9000000204), (9000000205), (9000000206), (9000000207), (9000000208), (9000000209), (9000000210), (9000000211);
insert into public.account_match_detail_queue (
  dota_account_id, match_id, status, lease_token, lease_expires_at
)
values
  (223344556, 9000000204, 'syncing', '00000000-0000-0000-0000-000000000204', now() + interval '5 minutes'),
  (223344556, 9000000205, 'syncing', '00000000-0000-0000-0000-000000000205', now() + interval '5 minutes'),
  (223344556, 9000000206, 'syncing', '00000000-0000-0000-0000-000000000206', now() + interval '5 minutes'),
  (223344556, 9000000207, 'syncing', '00000000-0000-0000-0000-000000000207', now() + interval '5 minutes'),
  (223344556, 9000000208, 'syncing', '00000000-0000-0000-0000-000000000208', now() + interval '5 minutes'),
  (223344556, 9000000209, 'syncing', '00000000-0000-0000-0000-000000000209', now() + interval '5 minutes'),
  (223344556, 9000000210, 'syncing', '00000000-0000-0000-0000-000000000210', now() - interval '1 minute'),
  (223344556, 9000000211, 'syncing', '00000000-0000-0000-0000-000000000211', now() + interval '5 minutes');

select throws_ok(
  $$select public.apply_match_detail_batch('sync-user-stratz', '00000000-0000-0000-0000-000000000203', 223344556, '00000000-0000-0000-0000-000000000204', '[{"match_id":9000000204,"status":"available","payloads":[{"payload_section":"opaque","payload":{"unrelated":true}}]}]'::jsonb)$$,
  'Available detail result requires projectable normalized players',
  'tracked available result without normalized players is rejected'
);
select is(
  (select jsonb_build_object(
    'queueStatus', queue.status,
    'detailStatus', match.detail_status,
    'payloads', (select count(*) from public.match_provider_payloads where match_id = 9000000204),
    'players', (select count(*) from public.player_match_stats where match_id = 9000000204)
  ) from public.account_match_detail_queue as queue join public.dota_matches as match on match.match_id = queue.match_id where queue.dota_account_id = 223344556 and queue.match_id = 9000000204),
  '{"queueStatus":"syncing","detailStatus":"not_requested","payloads":0,"players":0}'::jsonb,
  'tracked missing normalized players rejection leaves lifecycle, raw payload, and stats unchanged'
);

select throws_ok(
  $$select public.apply_match_detail_batch('sync-user-stratz', '00000000-0000-0000-0000-000000000203', 223344556, '00000000-0000-0000-0000-000000000205', '[{"match_id":9000000205,"status":"available","normalized_players":[],"payloads":[{"payload_section":"opaque","payload":{"unrelated":true}}]}]'::jsonb)$$,
  'Available detail result requires projectable normalized players',
  'tracked available result with empty normalized players is rejected'
);
select is(
  (select jsonb_build_object(
    'queueStatus', queue.status,
    'detailStatus', match.detail_status,
    'payloads', (select count(*) from public.match_provider_payloads where match_id = 9000000205),
    'players', (select count(*) from public.player_match_stats where match_id = 9000000205)
  ) from public.account_match_detail_queue as queue join public.dota_matches as match on match.match_id = queue.match_id where queue.dota_account_id = 223344556 and queue.match_id = 9000000205),
  '{"queueStatus":"syncing","detailStatus":"not_requested","payloads":0,"players":0}'::jsonb,
  'tracked empty normalized players rejection leaves lifecycle, raw payload, and stats unchanged'
);

select throws_ok(
  $$select public.apply_match_detail_batch('sync-user-stratz', '00000000-0000-0000-0000-000000000203', 223344556, '00000000-0000-0000-0000-000000000208', '[{"match_id":9000000208,"status":"available","normalized_players":[{"match_id":9000000208,"account_id":222,"player_slot":256}],"payloads":[{"payload_section":"opaque","payload":{"unrelated":true}}]}]'::jsonb)$$,
  'Available detail result requires projectable normalized players',
  'tracked available result with malformed normalized players is rejected'
);
select is(
  (select jsonb_build_object(
    'queueStatus', queue.status,
    'detailStatus', match.detail_status,
    'payloads', (select count(*) from public.match_provider_payloads where match_id = 9000000208),
    'players', (select count(*) from public.player_match_stats where match_id = 9000000208)
  ) from public.account_match_detail_queue as queue join public.dota_matches as match on match.match_id = queue.match_id where queue.dota_account_id = 223344556 and queue.match_id = 9000000208),
  '{"queueStatus":"syncing","detailStatus":"not_requested","payloads":0,"players":0}'::jsonb,
  'tracked malformed normalized players rejection leaves lifecycle, raw payload, and stats unchanged'
);

select public.apply_match_detail_batch(
  'sync-user-stratz',
  '00000000-0000-0000-0000-000000000203',
  223344556,
  '00000000-0000-0000-0000-000000000206',
  '[{"match_id":9000000206,"status":"unavailable"}]'::jsonb
);
select public.apply_match_detail_batch(
  'sync-user-stratz',
  '00000000-0000-0000-0000-000000000203',
  223344556,
  '00000000-0000-0000-0000-000000000207',
  '[{"match_id":9000000207,"status":"failed","error_code":"STRATZ_502","error_message":"provider error"}]'::jsonb
);
select is(
  (select jsonb_build_object(
    'unavailableQueue', (select status from public.account_match_detail_queue where dota_account_id = 223344556 and match_id = 9000000206),
    'unavailableMatch', (select detail_status from public.dota_matches where match_id = 9000000206),
    'failedQueue', (select status from public.account_match_detail_queue where dota_account_id = 223344556 and match_id = 9000000207),
    'failedMatch', (select detail_status from public.dota_matches where match_id = 9000000207)
  )),
  '{"failedMatch":"failed","failedQueue":"failed","unavailableMatch":"unavailable","unavailableQueue":"unavailable"}'::jsonb,
  'tracked unavailable and failed results remain accepted without players'
);

select throws_ok(
  $$select public.apply_match_detail_batch('sync-user-stratz', '00000000-0000-0000-0000-000000000203', 223344556, '00000000-0000-0000-0000-000000000999', '[{"match_id":9000000209,"status":"available","normalized_players":[{"match_id":9000000209,"account_id":333,"kills":1}],"payloads":[{"payload_section":"opaque","payload":{"unrelated":true}}]}]'::jsonb)$$,
  'Detail lease is no longer active',
  'wrong tracked detail lease is rejected'
);
select is(
  (select jsonb_build_object(
    'queueStatus', queue.status,
    'detailStatus', match.detail_status,
    'payloads', (select count(*) from public.match_provider_payloads where match_id = 9000000209),
    'players', (select count(*) from public.player_match_stats where match_id = 9000000209)
  ) from public.account_match_detail_queue as queue join public.dota_matches as match on match.match_id = queue.match_id where queue.dota_account_id = 223344556 and queue.match_id = 9000000209),
  '{"queueStatus":"syncing","detailStatus":"not_requested","payloads":0,"players":0}'::jsonb,
  'wrong tracked detail lease cannot persist raw payloads, stats, or lifecycle state'
);

select throws_ok(
  $$select public.apply_match_detail_batch('sync-user-stratz', '00000000-0000-0000-0000-000000000203', 223344556, '00000000-0000-0000-0000-000000000210', '[{"match_id":9000000210,"status":"available","normalized_players":[{"match_id":9000000210,"account_id":444,"kills":1}],"payloads":[{"payload_section":"opaque","payload":{"unrelated":true}}]}]'::jsonb)$$,
  'Detail lease is no longer active',
  'expired tracked detail lease is rejected'
);
select is(
  (select jsonb_build_object(
    'queueStatus', queue.status,
    'detailStatus', match.detail_status,
    'payloads', (select count(*) from public.match_provider_payloads where match_id = 9000000210),
    'players', (select count(*) from public.player_match_stats where match_id = 9000000210)
  ) from public.account_match_detail_queue as queue join public.dota_matches as match on match.match_id = queue.match_id where queue.dota_account_id = 223344556 and queue.match_id = 9000000210),
  '{"queueStatus":"syncing","detailStatus":"not_requested","payloads":0,"players":0}'::jsonb,
  'expired tracked detail lease cannot persist raw payloads, stats, or lifecycle state'
);

select throws_ok(
  $$select public.apply_match_detail_batch('sync-user-stratz', '00000000-0000-0000-0000-000000000203', 223344556, '00000000-0000-0000-0000-000000000211', '[{"match_id":9000000211,"status":"failed"},{"match_id":9000000211,"status":"failed"}]'::jsonb)$$,
  'Detail results must contain unique match IDs',
  'duplicate detail result match IDs are rejected before writes'
);

create temp table completed_specific_detail_claim as
select public.claim_specific_match_detail(
  'sync-user-stratz',
  '00000000-0000-0000-0000-000000000203',
  9000000203,
  300
) as value;

select is(
  (select value ->> 'claimed' from completed_specific_detail_claim),
  'false',
  'specific detail claim does not refetch an available match'
);
select is(
  (select value ->> 'status' from completed_specific_detail_claim),
  'available',
  'specific detail claim reports the existing detail status'
);

reset role;
select * from finish();
rollback;
