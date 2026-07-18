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
  boundary_match_id bigint;
begin
  boundary_match_id := nullif(p_backfill_upper_bound_match_id, 0);

  if boundary_match_id is not null and boundary_match_id < 0 then
    raise exception 'Backfill upper bound must not be negative';
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

revoke all on function public.apply_match_sync_page_with_boundary(
  text, uuid, bigint, uuid, jsonb, integer, boolean, bigint
) from public, anon, authenticated;
grant execute on function public.apply_match_sync_page_with_boundary(
  text, uuid, bigint, uuid, jsonb, integer, boolean, bigint
) to service_role;
