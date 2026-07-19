create table public.match_provider_payloads (
  match_id bigint not null references public.dota_matches (match_id) on delete cascade,
  provider text not null,
  payload_kind text not null default 'history',
  payload_section text not null default 'match',
  payload jsonb not null,
  schema_version text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_id, provider, payload_kind, payload_section),
  constraint match_provider_payloads_provider_valid
    check (provider in ('stratz', 'opendota')),
  constraint match_provider_payloads_kind_valid
    check (payload_kind in ('history', 'detail')),
  constraint match_provider_payloads_section_not_blank
    check (char_length(btrim(payload_section)) between 1 and 80),
  constraint match_provider_payloads_schema_version_not_blank
    check (schema_version is null or char_length(btrim(schema_version)) between 1 and 100)
);

create index match_provider_payloads_provider_fetched_at_idx
  on public.match_provider_payloads (provider, fetched_at desc);

create trigger match_provider_payloads_set_updated_at
before update on public.match_provider_payloads
for each row execute function public.set_updated_at();

alter table public.match_provider_payloads enable row level security;

revoke all on table public.match_provider_payloads from anon, authenticated;
grant select, insert, update, delete on table public.match_provider_payloads to service_role;

create policy "Users can read provider payloads for tracked matches"
on public.match_provider_payloads
for select
to authenticated
using (
  exists (
    select 1
    from public.tracked_account_matches
    join public.tracked_accounts
      on tracked_accounts.id = tracked_account_matches.tracked_account_id
    where tracked_account_matches.match_id = match_provider_payloads.match_id
      and tracked_accounts.user_id = ((select auth.jwt()) ->> 'sub')
  )
);

create function public.apply_match_sync_page_with_boundary_source_and_payloads(
  p_actor_user_id text,
  p_tracked_account_id uuid,
  p_dota_account_id bigint,
  p_lease_token uuid,
  p_matches jsonb,
  p_next_offset integer,
  p_backfill_complete boolean,
  p_backfill_upper_bound_match_id bigint,
  p_source text,
  p_payloads jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  result jsonb;
begin
  if jsonb_typeof(p_payloads) <> 'array' then
    raise exception 'Provider payload page must be a JSON array';
  end if;

  result := public.apply_match_sync_page_with_boundary_and_source(
    p_actor_user_id,
    p_tracked_account_id,
    p_dota_account_id,
    p_lease_token,
    p_matches,
    p_next_offset,
    p_backfill_complete,
    p_backfill_upper_bound_match_id,
    p_source
  );

  insert into public.match_provider_payloads (
    match_id,
    provider,
    payload_kind,
    payload_section,
    payload,
    schema_version,
    fetched_at
  )
  select
    payload_row.match_id,
    payload_row.provider,
    coalesce(payload_row.payload_kind, 'history'),
    coalesce(nullif(btrim(payload_row.payload_section), ''), 'match'),
    payload_row.payload,
    nullif(btrim(payload_row.schema_version), ''),
    now()
  from jsonb_to_recordset(p_payloads) as payload_row(
    match_id bigint,
    provider text,
    payload_kind text,
    payload_section text,
    payload jsonb,
    schema_version text
  )
  join jsonb_to_recordset(p_matches) as match_row(match_id bigint)
    on match_row.match_id = payload_row.match_id
  where payload_row.match_id > 0
    and payload_row.provider = p_source
    and payload_row.payload is not null
  on conflict (match_id, provider, payload_kind, payload_section) do update
  set payload = excluded.payload,
      schema_version = coalesce(excluded.schema_version, public.match_provider_payloads.schema_version),
      fetched_at = excluded.fetched_at;

  return result;
end;
$function$;

revoke all on function public.apply_match_sync_page_with_boundary_source_and_payloads(
  text, uuid, bigint, uuid, jsonb, integer, boolean, bigint, text, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_match_sync_page_with_boundary_source_and_payloads(
  text, uuid, bigint, uuid, jsonb, integer, boolean, bigint, text, jsonb
) to service_role;

comment on table public.match_provider_payloads is
  'Unmodified provider-specific match payloads. History and future detail payloads are retained separately.';
comment on function public.apply_match_sync_page_with_boundary_source_and_payloads(
  text, uuid, bigint, uuid, jsonb, integer, boolean, bigint, text, jsonb
) is
  'Atomically upserts normalized match rows, raw provider payloads, visibility links, and sync state.';
