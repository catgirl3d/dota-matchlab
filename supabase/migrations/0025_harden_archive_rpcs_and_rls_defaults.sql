-- Archive owner RPCs rely on table RLS; public showcase RPCs deliberately
-- retain definer privileges because they expose only curated accounts.
alter function archive_private.archive_overview(uuid, text, text, text, text, text, smallint, date, date)
  security invoker;
alter function archive_private.archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)
  security invoker;

alter function public.get_match_archive_overview(uuid, text, text, text, text, text, smallint, date, date)
  security invoker;
alter function public.get_match_archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)
  security invoker;

revoke all on schema archive_private from public, anon, authenticated, service_role;
grant usage on schema archive_private to authenticated;

revoke all on function archive_private.archive_overview(uuid, text, text, text, text, text, smallint, date, date) from public, anon, authenticated, service_role;
revoke all on function archive_private.archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer, date, date) from public, anon, authenticated, service_role;
grant execute on function archive_private.archive_overview(uuid, text, text, text, text, text, smallint, date, date) to authenticated;
grant execute on function archive_private.archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer, date, date) to authenticated;

revoke all on function public.get_match_archive_overview(uuid, text, text, text, text, text, smallint, date, date) from public, anon, authenticated, service_role;
revoke all on function public.get_match_archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer, date, date) from public, anon, authenticated, service_role;
revoke all on function public.get_archive_showcase_overview(bigint, text, text, text, text, text, smallint, date, date) from public, anon, authenticated, service_role;
revoke all on function public.get_archive_showcase_page(bigint, text, text, text, text, text, smallint, bigint, bigint, integer, date, date) from public, anon, authenticated, service_role;
revoke all on function public.resolve_archive_showcase(text) from public, anon, authenticated, service_role;

grant execute on function public.get_match_archive_overview(uuid, text, text, text, text, text, smallint, date, date) to authenticated;
grant execute on function public.get_match_archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer, date, date) to authenticated;
grant execute on function public.get_archive_showcase_overview(bigint, text, text, text, text, text, smallint, date, date) to anon, authenticated;
grant execute on function public.get_archive_showcase_page(bigint, text, text, text, text, text, smallint, bigint, bigint, integer, date, date) to anon, authenticated;
grant execute on function public.resolve_archive_showcase(text) to anon, authenticated;

-- The legacy handler is installed in production outside the migration history.
-- An event trigger depends on its handler, so it must be dropped first.
drop event trigger if exists ensure_rls;
drop function if exists public.rls_auto_enable();

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

create function private.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  command record;
begin
  for command in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if command.schema_name = 'public' then
      begin
        execute format('alter table if exists %s enable row level security', command.object_identity);
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', command.object_identity;
      end;
    end if;
  end loop;
end;
$function$;

revoke all on function private.rls_auto_enable() from public, anon, authenticated, service_role;

create event trigger ensure_rls
on ddl_command_end
when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
execute function private.rls_auto_enable();

-- Per-schema defaults are additive to global defaults, so revoke both. New
-- migrations must grant each required API privilege explicitly.
-- Existing server-side workflows already rely on these service-role grants;
-- make them explicit before disabling the legacy auto-exposure defaults.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter default privileges for role postgres revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres revoke execute on functions from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated, service_role;
