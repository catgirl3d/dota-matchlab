begin;

select plan(8);

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

select public.apply_match_sync_page_with_boundary_and_source(
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
  'stratz'
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

reset role;
select * from finish();
rollback;
