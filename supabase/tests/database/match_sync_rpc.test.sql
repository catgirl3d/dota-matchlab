begin;

select plan(22);

insert into public.tracked_accounts (id, user_id, steam_id64)
values ('00000000-0000-0000-0000-000000000202', 'sync-user-a', '76561198083722517');

insert into public.dota_matches (match_id, start_time, duration, radiant_win)
values (9000000200, 1700000000, 2400, true);

insert into public.player_match_stats (match_id, account_id, hero_id)
values (9000000200, 123456789, 1);

set local role service_role;

create temp table first_claim as
select public.claim_match_sync(
  'sync-user-a',
  '00000000-0000-0000-0000-000000000202',
  300
) as value;

select is(
  (select value ->> 'owned' from first_claim),
  'true',
  'claim accepts the tracked account owner'
);
select is(
  (select value ->> 'claimed' from first_claim),
  'true',
  'claim acquires an available lease'
);
select is(
  (select value ->> 'dotaAccountId' from first_claim),
  '123456789',
  'claim returns the database account id'
);
select is(
  (select count(*)
   from public.tracked_account_matches
   where tracked_account_id = '00000000-0000-0000-0000-000000000202'),
  1::bigint,
  'claim links previously archived matches for a new tracker'
);

create temp table busy_claim as
select public.claim_match_sync(
  'sync-user-a',
  '00000000-0000-0000-0000-000000000202',
  300
) as value;

select is(
  (select value ->> 'claimed' from busy_claim),
  'false',
  'an active lease prevents a concurrent claim'
);

select public.apply_match_sync_page_with_boundary(
  'sync-user-a',
  '00000000-0000-0000-0000-000000000202',
  123456789,
  ((select value ->> 'leaseToken' from first_claim))::uuid,
  '[
    {
      "match_id": 9000000201,
      "start_time": 1700001000,
      "duration": 1800,
      "radiant_win": false,
      "game_mode": 22,
      "lobby_type": 0,
      "player_slot": 0,
      "hero_id": 5,
      "kills": 7,
      "deaths": 2,
      "assists": 11,
      "gold_per_min": 500,
      "xp_per_min": 600,
      "last_hits": 180,
      "hero_damage": 24000,
      "tower_damage": 5000,
      "hero_healing": 0,
      "party_size": 0,
      "lane_role": 1
    }
  ]'::jsonb,
  1,
  false,
  9000000201
);

select is(
  (select count(*) from public.dota_matches where match_id = 9000000201),
  1::bigint,
  'apply inserts the match row'
);
select is(
  (select count(*) from public.player_match_stats where match_id = 9000000201),
  1::bigint,
  'apply inserts the tracked player stats'
);
select is(
  (select hero_damage from public.player_match_stats where match_id = 9000000201),
  24000,
  'apply preserves extended match statistics'
);
select is(
  (select status from public.account_match_sync_state where dota_account_id = 123456789),
  'partial',
  'apply marks an incomplete page as partial'
);
select is(
  (select lease_token from public.account_match_sync_state where dota_account_id = 123456789),
  null::uuid,
  'apply releases the lease'
);
select is(
  (select backfill_upper_bound_match_id
   from public.account_match_sync_state
   where dota_account_id = 123456789),
  9000000201::bigint,
  'apply stores the stable backfill upper bound'
);

create temp table second_claim as
select public.claim_match_sync(
  'sync-user-a',
  '00000000-0000-0000-0000-000000000202',
  300
) as value;

select is(
  (select value ->> 'offset' from second_claim),
  '1',
  'a subsequent claim resumes from the next offset'
);
select is(
  (select value ->> 'backfillUpperBoundMatchId' from second_claim),
  '9000000201',
  'a subsequent claim preserves the stable upper bound'
);

select is(
  (
    public.record_match_sync_failure(
      'sync-user-a',
      '00000000-0000-0000-0000-000000000202',
      123456789,
      ((select value ->> 'leaseToken' from second_claim))::uuid,
      'OPEN_DOTA_TIMEOUT',
      'temporary provider timeout'
    ) ->> 'recorded'
  ),
  'true',
  'failure recording accepts the active lease'
);

select is(
  (select status from public.account_match_sync_state where dota_account_id = 123456789),
  'failed',
  'failure recording marks the state as failed'
);
select is(
  (select consecutive_failures from public.account_match_sync_state where dota_account_id = 123456789),
  1,
  'failure recording increments the failure counter'
);
select is(
  (select (next_retry_at is not null)::text
   from public.account_match_sync_state
   where dota_account_id = 123456789),
  'true',
  'failure recording schedules a retry'
);
select is(
  (select last_error_code from public.account_match_sync_state where dota_account_id = 123456789),
  'OPEN_DOTA_TIMEOUT',
  'failure recording preserves a safe error code'
);

create temp table retry_claim as
select public.claim_match_sync(
  'sync-user-a',
  '00000000-0000-0000-0000-000000000202',
  300
) as value;

select is(
  (select value ->> 'claimed' from retry_claim),
  'false',
  'retry backoff blocks an immediate claim'
);
select is(
  (select value ->> 'status' from retry_claim),
  'failed',
  'retry backoff returns the failed status'
);

create temp table unauthorized_claim as
select public.claim_match_sync(
  'sync-user-b',
  '00000000-0000-0000-0000-000000000202',
  300
) as value;

select is(
  (select value ->> 'owned' from unauthorized_claim),
  'false',
  'claim rejects a different user'
);
select is(
  (select value ->> 'claimed' from unauthorized_claim),
  'false',
  'unauthorized claim cannot acquire a lease'
);

reset role;
select * from finish();
rollback;
