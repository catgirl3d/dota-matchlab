alter table public.account_match_sync_state
  add column history_provider text not null default 'opendota',
  add constraint account_match_sync_state_history_provider_check
    check (history_provider in ('stratz', 'opendota'));

create index account_match_sync_state_history_provider_idx
  on public.account_match_sync_state (dota_account_id, history_provider);

create or replace function public.claim_match_sync_for_provider(
  p_actor_user_id text,
  p_tracked_account_id uuid,
  p_lease_seconds integer default 300,
  p_history_provider text default 'stratz'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  resolved_account_id bigint;
  sync_status text;
  current_provider text;
begin
  if p_history_provider not in ('stratz', 'opendota') then
    raise exception 'Unsupported match history provider';
  end if;

  select tracked_account.dota_account_id
  into resolved_account_id
  from public.tracked_accounts as tracked_account
  where tracked_account.id = p_tracked_account_id
    and tracked_account.user_id = p_actor_user_id;

  if not found or resolved_account_id is null then
    return jsonb_build_object('owned', false, 'claimed', false);
  end if;

  insert into public.account_match_sync_state (dota_account_id, history_provider)
  values (resolved_account_id, p_history_provider)
  on conflict (dota_account_id) do nothing;

  select sync_state.status, sync_state.history_provider
  into sync_status, current_provider
  from public.account_match_sync_state as sync_state
  where sync_state.dota_account_id = resolved_account_id
  for update;

  if sync_status <> 'syncing' and current_provider <> p_history_provider then
    update public.account_match_sync_state
    set history_provider = p_history_provider,
        status = 'pending',
        backfill_offset = 0,
        backfill_complete = false,
        backfill_upper_bound_match_id = null,
        newest_match_id = null,
        oldest_match_id = null,
        next_retry_at = null,
        consecutive_failures = 0,
        last_error_code = null,
        last_error_message = null
    where dota_account_id = resolved_account_id;
  end if;

  return public.claim_match_sync(
    p_actor_user_id,
    p_tracked_account_id,
    p_lease_seconds
  ) || jsonb_build_object('historyProvider', p_history_provider);
end;
$function$;

create or replace function public.apply_match_sync_page_with_source(
  p_actor_user_id text,
  p_tracked_account_id uuid,
  p_dota_account_id bigint,
  p_lease_token uuid,
  p_matches jsonb,
  p_next_offset integer,
  p_backfill_complete boolean,
  p_source text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  result jsonb;
begin
  if p_source not in ('stratz', 'opendota') then
    raise exception 'Unsupported match source';
  end if;

  result := public.apply_match_sync_page(
    p_actor_user_id,
    p_tracked_account_id,
    p_dota_account_id,
    p_lease_token,
    p_matches,
    p_next_offset,
    p_backfill_complete
  );

  update public.dota_matches
  set source = p_source,
      source_fetched_at = now()
  where match_id in (
    select match_row.match_id
    from jsonb_to_recordset(p_matches) as match_row(match_id bigint)
    where match_row.match_id > 0
  );

  return result;
end;
$function$;

create or replace function public.apply_match_sync_page_with_boundary_and_source(
  p_actor_user_id text,
  p_tracked_account_id uuid,
  p_dota_account_id bigint,
  p_lease_token uuid,
  p_matches jsonb,
  p_next_offset integer,
  p_backfill_complete boolean,
  p_backfill_upper_bound_match_id bigint,
  p_source text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  result jsonb;
  page_newest_match_id bigint;
  boundary_match_id bigint;
begin
  boundary_match_id := nullif(p_backfill_upper_bound_match_id, 0);

  result := public.apply_match_sync_page_with_source(
    p_actor_user_id,
    p_tracked_account_id,
    p_dota_account_id,
    p_lease_token,
    p_matches,
    p_next_offset,
    p_backfill_complete,
    p_source
  );

  select max(match_row.match_id)
  into page_newest_match_id
  from jsonb_to_recordset(p_matches) as match_row(match_id bigint)
  where match_row.match_id > 0;

  update public.account_match_sync_state
  set backfill_upper_bound_match_id = case
        when p_backfill_complete then null
        else coalesce(backfill_upper_bound_match_id, boundary_match_id)
      end,
      newest_match_id = case
        when page_newest_match_id is null then newest_match_id
        when newest_match_id is null then page_newest_match_id
        else greatest(newest_match_id, page_newest_match_id)
      end
  where dota_account_id = p_dota_account_id;

  return result;
end;
$function$;

revoke all on function public.claim_match_sync_for_provider(text, uuid, integer, text)
  from public, anon, authenticated;
revoke all on function public.apply_match_sync_page_with_source(
  text, uuid, bigint, uuid, jsonb, integer, boolean, text
) from public, anon, authenticated;
revoke all on function public.apply_match_sync_page_with_boundary_and_source(
  text, uuid, bigint, uuid, jsonb, integer, boolean, bigint, text
) from public, anon, authenticated;

grant execute on function public.claim_match_sync_for_provider(text, uuid, integer, text)
  to service_role;
grant execute on function public.apply_match_sync_page_with_source(
  text, uuid, bigint, uuid, jsonb, integer, boolean, text
) to service_role;
grant execute on function public.apply_match_sync_page_with_boundary_and_source(
  text, uuid, bigint, uuid, jsonb, integer, boolean, bigint, text
) to service_role;

comment on column public.account_match_sync_state.history_provider is
  'Provider owning the current backfill cursor. Switching providers resets the cursor.';
