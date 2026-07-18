create table public.dota_matches (
  match_id bigint primary key,
  start_time bigint,
  duration integer,
  radiant_win boolean,
  game_mode smallint,
  lobby_type smallint,
  average_rank smallint,
  cluster integer,
  version integer,
  radiant_team_id bigint,
  dire_team_id bigint,
  league_id bigint,
  series_id bigint,
  series_type smallint,
  radiant_score smallint,
  dire_score smallint,
  detail_status text not null default 'not_requested',
  detail_fetched_at timestamptz,
  source text not null default 'opendota',
  source_fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dota_matches_match_id_positive
    check (match_id > 0),
  constraint dota_matches_start_time_nonnegative
    check (start_time is null or start_time >= 0),
  constraint dota_matches_duration_nonnegative
    check (duration is null or duration >= 0),
  constraint dota_matches_average_rank_range
    check (average_rank is null or average_rank between 0 and 99),
  constraint dota_matches_detail_status_valid
    check (detail_status in ('not_requested', 'pending', 'available', 'unavailable', 'failed')),
  constraint dota_matches_source_not_blank
    check (char_length(btrim(source)) between 1 and 40)
);

create table public.player_match_stats (
  match_id bigint not null references public.dota_matches (match_id) on delete cascade,
  account_id bigint not null,
  player_slot smallint,
  hero_id smallint,
  hero_variant smallint,
  kills integer,
  deaths integer,
  assists integer,
  gold_per_min integer,
  xp_per_min integer,
  last_hits integer,
  denies integer,
  hero_damage integer,
  tower_damage integer,
  hero_healing integer,
  level smallint,
  net_worth integer,
  leaver_status smallint,
  party_size smallint,
  lane smallint,
  lane_role smallint,
  is_roaming boolean,
  source_fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_id, account_id),
  constraint player_match_stats_account_id_range
    check (account_id between 0 and 4294967295),
  constraint player_match_stats_player_slot_range
    check (player_slot is null or player_slot between 0 and 255),
  constraint player_match_stats_hero_id_positive
    check (hero_id is null or hero_id > 0),
  constraint player_match_stats_party_size_range
    check (party_size is null or party_size between 1 and 10)
);

create table public.tracked_account_matches (
  tracked_account_id uuid not null references public.tracked_accounts (id) on delete cascade,
  match_id bigint not null references public.dota_matches (match_id) on delete cascade,
  discovered_at timestamptz not null default now(),
  primary key (tracked_account_id, match_id)
);

create table public.account_match_sync_state (
  dota_account_id bigint primary key,
  status text not null default 'pending',
  newest_match_id bigint,
  oldest_match_id bigint,
  backfill_offset integer not null default 0,
  backfill_complete boolean not null default false,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  next_retry_at timestamptz,
  consecutive_failures integer not null default 0,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_match_sync_state_account_id_range
    check (dota_account_id between 0 and 4294967295),
  constraint account_match_sync_state_status_valid
    check (status in ('pending', 'syncing', 'ready', 'partial', 'blocked', 'failed')),
  constraint account_match_sync_state_match_ids_positive
    check (
      (newest_match_id is null or newest_match_id > 0)
      and (oldest_match_id is null or oldest_match_id > 0)
    ),
  constraint account_match_sync_state_backfill_offset_nonnegative
    check (backfill_offset >= 0),
  constraint account_match_sync_state_failures_nonnegative
    check (consecutive_failures >= 0),
  constraint account_match_sync_state_error_code_length
    check (last_error_code is null or char_length(last_error_code) between 1 and 80),
  constraint account_match_sync_state_error_message_length
    check (last_error_message is null or char_length(last_error_message) between 1 and 500)
);

create index tracked_accounts_dota_account_id_idx
  on public.tracked_accounts (dota_account_id);

create index dota_matches_start_time_idx
  on public.dota_matches (start_time desc);

create index player_match_stats_account_match_idx
  on public.player_match_stats (account_id, match_id desc);

create index player_match_stats_hero_id_idx
  on public.player_match_stats (hero_id)
  where hero_id is not null;

create index tracked_account_matches_match_id_idx
  on public.tracked_account_matches (match_id);

create index account_match_sync_state_work_idx
  on public.account_match_sync_state (status, next_retry_at);

create trigger dota_matches_set_updated_at
before update on public.dota_matches
for each row execute function public.set_updated_at();

create trigger player_match_stats_set_updated_at
before update on public.player_match_stats
for each row execute function public.set_updated_at();

create trigger account_match_sync_state_set_updated_at
before update on public.account_match_sync_state
for each row execute function public.set_updated_at();

alter table public.dota_matches enable row level security;
alter table public.player_match_stats enable row level security;
alter table public.tracked_account_matches enable row level security;
alter table public.account_match_sync_state enable row level security;

revoke all on table public.dota_matches from anon, authenticated;
revoke all on table public.player_match_stats from anon, authenticated;
revoke all on table public.tracked_account_matches from anon, authenticated;
revoke all on table public.account_match_sync_state from anon, authenticated;

grant select on table public.dota_matches to authenticated;
grant select on table public.player_match_stats to authenticated;
grant select on table public.tracked_account_matches to authenticated;
grant select on table public.account_match_sync_state to authenticated;

grant select, insert, update, delete on table public.dota_matches to service_role;
grant select, insert, update, delete on table public.player_match_stats to service_role;
grant select, insert, update, delete on table public.tracked_account_matches to service_role;
grant select, insert, update, delete on table public.account_match_sync_state to service_role;

create policy "Users can read archived matches for tracked accounts"
on public.dota_matches
for select
to authenticated
using (
  exists (
    select 1
    from public.tracked_account_matches
    join public.tracked_accounts
      on tracked_accounts.id = tracked_account_matches.tracked_account_id
    where tracked_account_matches.match_id = dota_matches.match_id
      and tracked_accounts.user_id = ((select auth.jwt()) ->> 'sub')
  )
);

create policy "Users can read player stats for tracked matches"
on public.player_match_stats
for select
to authenticated
using (
  exists (
    select 1
    from public.tracked_account_matches
    join public.tracked_accounts
      on tracked_accounts.id = tracked_account_matches.tracked_account_id
    where tracked_account_matches.match_id = player_match_stats.match_id
      and tracked_accounts.user_id = ((select auth.jwt()) ->> 'sub')
  )
);

create policy "Users can read their tracked account match links"
on public.tracked_account_matches
for select
to authenticated
using (
  exists (
    select 1
    from public.tracked_accounts
    where tracked_accounts.id = tracked_account_matches.tracked_account_id
      and tracked_accounts.user_id = ((select auth.jwt()) ->> 'sub')
  )
);

create policy "Users can read sync state for tracked accounts"
on public.account_match_sync_state
for select
to authenticated
using (
  exists (
    select 1
    from public.tracked_accounts
    where tracked_accounts.dota_account_id = account_match_sync_state.dota_account_id
      and tracked_accounts.user_id = ((select auth.jwt()) ->> 'sub')
  )
);

comment on table public.dota_matches is
  'Provider-normalized Dota match metadata shared across tracked accounts.';
comment on table public.player_match_stats is
  'Provider-normalized per-player statistics for an archived Dota match.';
comment on table public.tracked_account_matches is
  'User-scoped visibility link between a tracked account and a deduplicated match.';
comment on table public.account_match_sync_state is
  'Global incremental match-history synchronization cursor for a Dota account.';
comment on column public.account_match_sync_state.backfill_offset is
  'Next OpenDota player matches offset to fetch while backfilling full public history.';
comment on column public.dota_matches.detail_status is
  'Lifecycle state for the future detailed match fetch.';
