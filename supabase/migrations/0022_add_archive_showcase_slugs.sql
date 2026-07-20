alter table public.archive_showcases
  add column slug text;

update public.archive_showcases
set slug = dota_account_id::text;

alter table public.archive_showcases
  alter column slug set not null,
  add constraint archive_showcases_slug_key unique (slug),
  add constraint archive_showcases_slug_format_check
    check (
      char_length(slug) between 1 and 64
      and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    );

create or replace function public.resolve_archive_showcase(p_slug text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $function$
  select registry.dota_account_id
  from public.archive_showcases as registry
  where lower(btrim(p_slug)) ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and registry.slug = lower(btrim(p_slug))
  limit 1;
$function$;

revoke all on function public.resolve_archive_showcase(text) from public;
grant execute on function public.resolve_archive_showcase(text) to anon, authenticated;

comment on function public.resolve_archive_showcase(text) is
  'Resolves a public archive showcase slug without exposing the registry.';
