create or replace function public.claim_specific_match_detail(
  p_actor_user_id text,
  p_tracked_account_id uuid,
  p_match_id bigint,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  resolved_account_id bigint;
  queue_status text;
  current_lease_expires_at timestamptz;
  token uuid;
begin
  if p_lease_seconds not between 30 and 600 then
    raise exception 'Invalid detail sync lease duration';
  end if;

  select tracked_account.dota_account_id
  into resolved_account_id
  from public.tracked_accounts as tracked_account
  join public.tracked_account_matches as tracked_match
    on tracked_match.tracked_account_id = tracked_account.id
  where tracked_account.id = p_tracked_account_id
    and tracked_account.user_id = p_actor_user_id
    and tracked_match.match_id = p_match_id;

  if not found or resolved_account_id is null then
    return jsonb_build_object('owned', false, 'claimed', false);
  end if;

  insert into public.account_match_detail_queue (dota_account_id, match_id)
  values (resolved_account_id, p_match_id)
  on conflict (dota_account_id, match_id) do nothing;

  select queue.status, queue.lease_expires_at
  into queue_status, current_lease_expires_at
  from public.account_match_detail_queue as queue
  where queue.dota_account_id = resolved_account_id
    and queue.match_id = p_match_id
  for update;

  if queue_status = 'available' or queue_status = 'unavailable' then
    return jsonb_build_object(
      'owned', true,
      'claimed', false,
      'status', queue_status,
      'dotaAccountId', resolved_account_id,
      'matchIds', '[]'::jsonb,
      'backfillComplete', true
    );
  end if;

  if queue_status = 'syncing'
    and current_lease_expires_at is not null
    and current_lease_expires_at > now()
  then
    return jsonb_build_object(
      'owned', true,
      'claimed', false,
      'status', 'syncing',
      'dotaAccountId', resolved_account_id,
      'matchIds', '[]'::jsonb,
      'backfillComplete', false
    );
  end if;

  token := extensions.gen_random_uuid();
  update public.account_match_detail_queue
  set status = 'syncing',
      lease_token = token,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempts = attempts + 1,
      next_retry_at = null,
      last_error_code = null,
      last_error_message = null
  where dota_account_id = resolved_account_id
    and match_id = p_match_id;

  return jsonb_build_object(
    'owned', true,
    'claimed', true,
    'status', 'syncing',
    'dotaAccountId', resolved_account_id,
    'leaseToken', token,
    'matchIds', jsonb_build_array(p_match_id),
    'backfillComplete', false
  );
end;
$function$;

revoke all on function public.claim_specific_match_detail(text, uuid, bigint, integer)
  from public, anon, authenticated;
grant execute on function public.claim_specific_match_detail(text, uuid, bigint, integer)
  to service_role;
