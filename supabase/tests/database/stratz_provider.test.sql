begin;

select plan(17);

insert into public.tracked_accounts (id, user_id, steam_id64)
values (
  '00000000-0000-0000-0000-000000000203',
  'sync-user-stratz',
  '76561198183610284'
);

set local role service_role;

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

create temp table detail_claim as
select public.claim_match_detail_batch(
  'sync-user-stratz',
  '00000000-0000-0000-0000-000000000203',
  300,
  2
) as value;

select is(
  (select value ->> 'claimed' from detail_claim),
  'true',
  'detail queue claims a bounded continuation batch independently from history'
);

select public.apply_match_detail_batch(
  'sync-user-stratz',
  '00000000-0000-0000-0000-000000000203',
  223344556,
  ((select value ->> 'leaseToken' from detail_claim))::uuid,
  '[{
    "match_id": 9000000203,
    "status": "available",
    "payloads": [{
      "payload_section": "match_playback",
      "schema_version": "stratz.match.detail.v2",
      "payload": {"data": {"match": {"id": 9000000203, "playbackData": {"runeEvents": [{"time": 120}]}}}}
    }, {
      "payload_section": "players",
      "schema_version": "stratz.match.detail.v2",
      "payload": {"data": {"match": {"id": 9000000203, "players": [{
        "matchId": 9000000203, "steamAccountId": 111, "playerSlot": 128, "heroId": 2,
        "kills": 4, "deaths": 5, "assists": 6, "goldPerMinute": 700,
        "experiencePerMinute": 800, "numLastHits": 90, "numDenies": 3,
        "heroDamage": 10000, "towerDamage": 2000, "heroHealing": 50,
        "level": 18, "networth": 15000, "leaverStatus": "NONE"
      }]}}}
    }]
  }]'::jsonb
);

select is(
  (select detail_status from public.dota_matches where match_id = 9000000203),
  'available',
  'detail apply updates the normalized detail lifecycle'
);
select is(
  (select payload #>> '{data,match,playbackData,runeEvents,0,time}'
   from public.match_provider_payloads
   where match_id = 9000000203 and provider = 'stratz' and payload_kind = 'detail'
     and payload_section = 'match_playback'),
  '120',
  'detail apply stores the raw nested STRATZ payload'
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

reset role;
select * from finish();
rollback;
