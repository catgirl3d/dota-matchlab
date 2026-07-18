alter table public.tracked_accounts
  add column dota_account_id bigint generated always as (
    (steam_id64::numeric - 76561197960265728)::bigint
  ) stored,
  add column persona_name text,
  add column avatar_url text,
  add column rank_tier smallint,
  add column profile_refreshed_at timestamptz;

alter table public.tracked_accounts
  add constraint tracked_accounts_dota_account_id_range
    check (dota_account_id between 0 and 4294967295),
  add constraint tracked_accounts_persona_name_length
    check (persona_name is null or char_length(persona_name) between 1 and 128),
  add constraint tracked_accounts_rank_tier_range
    check (rank_tier is null or rank_tier between 0 and 99),
  add constraint tracked_accounts_user_account_unique
    unique (user_id, dota_account_id);

comment on column public.tracked_accounts.dota_account_id is
  '32-bit Dota account ID derived deterministically from SteamID64.';
comment on column public.tracked_accounts.profile_refreshed_at is
  'Last time profile metadata was validated against OpenDota.';
