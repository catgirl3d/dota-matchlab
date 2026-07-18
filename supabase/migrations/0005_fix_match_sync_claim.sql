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
    sync_state.lease_expires_at
  into
    sync_status,
    sync_offset,
    sync_complete,
    current_lease_expires_at
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

  next_lease_token := extensions.gen_random_uuid();

  update public.account_match_sync_state
  set status = 'syncing',
      lease_token = next_lease_token,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      last_attempt_at = now(),
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
    'leaseToken', next_lease_token
  );
end;
$function$;

revoke all on function public.claim_match_sync(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_match_sync(text, uuid, integer) to service_role;
