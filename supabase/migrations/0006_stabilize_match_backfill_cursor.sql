alter table public.account_match_sync_state
  add column backfill_upper_bound_match_id bigint,
  add constraint account_match_sync_state_upper_bound_positive
    check (
      backfill_upper_bound_match_id is null
      or backfill_upper_bound_match_id > 0
    );

create index account_match_sync_state_backfill_upper_bound_idx
  on public.account_match_sync_state (dota_account_id, backfill_upper_bound_match_id);

create or replace function public.claim_match_sync(
  p_actor_user_id text,
  p_tracked_account_id uuid,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  resolved_account_id bigint;
  sync_status text;
  sync_offset integer;
  sync_complete boolean;
  current_lease_expires_at timestamptz;
  current_next_retry_at timestamptz;
  current_upper_bound_match_id bigint;
  next_lease_token uuid;
begin
  if p_lease_seconds not between 30 and 600 then
    raise exception 'Lease duration is outside the allowed range';
  end if;

  select tracked_account.dota_account_id
  into resolved_account_id
  from public.tracked_accounts as tracked_account
  where tracked_account.id = p_tracked_account_id
    and tracked_account.user_id = p_actor_user_id;

  if not found or resolved_account_id is null then
    return jsonb_build_object(
      'owned', false,
      'claimed', false
    );
  end if;

  insert into public.account_match_sync_state (dota_account_id)
  values (resolved_account_id)
  on conflict (dota_account_id) do nothing;

  insert into public.tracked_account_matches (tracked_account_id, match_id)
  select p_tracked_account_id, player_stats.match_id
  from public.player_match_stats as player_stats
  where player_stats.account_id = resolved_account_id
  on conflict (tracked_account_id, match_id) do nothing;

  select
    sync_state.status,
    sync_state.backfill_offset,
    sync_state.backfill_complete,
    sync_state.lease_expires_at,
    sync_state.next_retry_at,
    sync_state.backfill_upper_bound_match_id
  into
    sync_status,
    sync_offset,
    sync_complete,
    current_lease_expires_at,
    current_next_retry_at,
    current_upper_bound_match_id
  from public.account_match_sync_state as sync_state
  where sync_state.dota_account_id = resolved_account_id
  for update;

  if sync_status = 'syncing'
    and current_lease_expires_at is not null
    and current_lease_expires_at > now()
  then
    return jsonb_build_object(
      'owned', true,
      'claimed', false,
      'status', 'syncing',
      'dotaAccountId', resolved_account_id
    );
  end if;

  if sync_status = 'failed'
    and current_next_retry_at is not null
    and current_next_retry_at > now()
  then
    return jsonb_build_object(
      'owned', true,
      'claimed', false,
      'status', 'failed',
      'dotaAccountId', resolved_account_id,
      'retryAt', current_next_retry_at
    );
  end if;

  next_lease_token := extensions.gen_random_uuid();

  update public.account_match_sync_state
  set status = 'syncing',
      lease_token = next_lease_token,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      last_attempt_at = now(),
      next_retry_at = null,
      last_error_code = null,
      last_error_message = null
  where dota_account_id = resolved_account_id;

  return jsonb_build_object(
    'owned', true,
    'claimed', true,
    'status', 'syncing',
    'dotaAccountId', resolved_account_id,
    'offset', case when sync_complete then 0 else sync_offset end,
    'backfillComplete', sync_complete,
    'backfillUpperBoundMatchId', case
      when sync_complete then null
      else current_upper_bound_match_id
    end,
    'leaseToken', next_lease_token
  );
end;
$function$;

create or replace function public.apply_match_sync_page_with_boundary(
  p_actor_user_id text,
  p_tracked_account_id uuid,
  p_dota_account_id bigint,
  p_lease_token uuid,
  p_matches jsonb,
  p_next_offset integer,
  p_backfill_complete boolean,
  p_backfill_upper_bound_match_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  result jsonb;
  page_newest_match_id bigint;
begin
  if p_backfill_upper_bound_match_id is not null
    and p_backfill_upper_bound_match_id <= 0
  then
    raise exception 'Backfill upper bound must be positive';
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

  select max(match_row.match_id)
  into page_newest_match_id
  from jsonb_to_recordset(p_matches) as match_row(match_id bigint)
  where match_row.match_id > 0;

  update public.account_match_sync_state
  set backfill_upper_bound_match_id = case
        when p_backfill_complete then null
        else coalesce(backfill_upper_bound_match_id, p_backfill_upper_bound_match_id)
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

revoke all on function public.claim_match_sync(text, uuid, integer) from public, anon, authenticated;
revoke all on function public.apply_match_sync_page_with_boundary(
  text, uuid, bigint, uuid, jsonb, integer, boolean, bigint
) from public, anon, authenticated;

grant execute on function public.claim_match_sync(text, uuid, integer) to service_role;
grant execute on function public.apply_match_sync_page_with_boundary(
  text, uuid, bigint, uuid, jsonb, integer, boolean, bigint
) to service_role;

comment on column public.account_match_sync_state.backfill_upper_bound_match_id is
  'High-water match ID captured at backfill start so new matches cannot shift the history cursor.';
comment on function public.apply_match_sync_page_with_boundary(
  text, uuid, bigint, uuid, jsonb, integer, boolean, bigint
) is
  'Applies a history page and preserves a stable backfill high-water boundary.';
