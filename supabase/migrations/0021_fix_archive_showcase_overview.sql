create or replace function public.get_archive_showcase_overview(
  p_dota_account_id bigint,
  p_period text default 'all',
  p_mode text default 'all',
  p_result text default 'all',
  p_party text default 'all',
  p_position text default 'all',
  p_hero_id smallint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_showcase record;
  overview jsonb;
begin
  select
    registry.tracked_account_id,
    account.dota_account_id,
    account.persona_name,
    account.avatar_url,
    account.rank_tier,
    account.profile_refreshed_at
  into v_showcase
  from public.archive_showcases as registry
  join public.tracked_accounts as account
    on (account.id, account.dota_account_id) = (
      registry.tracked_account_id,
      registry.dota_account_id
    )
  where registry.dota_account_id = p_dota_account_id;

  if not found then
    return null;
  end if;

  overview := archive_private.archive_overview(
    v_showcase.tracked_account_id,
    p_period,
    p_mode,
    p_result,
    p_party,
    p_position,
    p_hero_id
  );

  return jsonb_build_object(
    'account', jsonb_build_object(
      'dotaAccountId', v_showcase.dota_account_id,
      'personaName', v_showcase.persona_name,
      'avatarUrl', v_showcase.avatar_url,
      'rankTier', v_showcase.rank_tier,
      'profileRefreshedAt', v_showcase.profile_refreshed_at
    ),
    'overview', overview
  );
end;
$function$;

revoke all on function public.get_archive_showcase_overview(
  bigint,
  text,
  text,
  text,
  text,
  text,
  smallint
) from public;

grant execute on function public.get_archive_showcase_overview(
  bigint,
  text,
  text,
  text,
  text,
  text,
  smallint
) to anon, authenticated;
