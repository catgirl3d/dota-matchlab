begin;

select plan(65);

select ok(not (select prosecdef from pg_proc where oid = 'public.get_match_archive_overview(uuid, text, text, text, text, text, smallint, date, date)'::regprocedure), 'owner overview RPC is SECURITY INVOKER');
select ok(not (select prosecdef from pg_proc where oid = 'public.get_match_archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)'::regprocedure), 'owner page RPC is SECURITY INVOKER');
select ok((select prosecdef from pg_proc where oid = 'public.get_archive_showcase_overview(bigint, text, text, text, text, text, smallint, date, date)'::regprocedure), 'showcase overview RPC remains SECURITY DEFINER');
select ok((select prosecdef from pg_proc where oid = 'public.get_archive_showcase_page(bigint, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)'::regprocedure), 'showcase page RPC remains SECURITY DEFINER');
select ok((select prosecdef from pg_proc where oid = 'public.resolve_archive_showcase(text)'::regprocedure), 'showcase resolver remains SECURITY DEFINER');

select ok(has_function_privilege('authenticated', 'public.get_match_archive_overview(uuid, text, text, text, text, text, smallint, date, date)', 'execute'), 'authenticated can execute owner overview RPC');
select ok(not has_function_privilege('anon', 'public.get_match_archive_overview(uuid, text, text, text, text, text, smallint, date, date)', 'execute'), 'anon cannot execute owner overview RPC');
select ok(not exists (select 1 from pg_proc as proc cross join lateral aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) as acl where proc.oid = 'public.get_match_archive_overview(uuid, text, text, text, text, text, smallint, date, date)'::regprocedure and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'), 'PUBLIC cannot execute owner overview RPC');
select ok(not has_function_privilege('service_role', 'public.get_match_archive_overview(uuid, text, text, text, text, text, smallint, date, date)', 'execute'), 'service role cannot execute owner overview RPC');
select ok(has_function_privilege('authenticated', 'public.get_match_archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)', 'execute'), 'authenticated can execute owner page RPC');
select ok(not has_function_privilege('anon', 'public.get_match_archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)', 'execute'), 'anon cannot execute owner page RPC');
select ok(not exists (select 1 from pg_proc as proc cross join lateral aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) as acl where proc.oid = 'public.get_match_archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)'::regprocedure and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'), 'PUBLIC cannot execute owner page RPC');
select ok(not has_function_privilege('service_role', 'public.get_match_archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)', 'execute'), 'service role cannot execute owner page RPC');

select ok(has_function_privilege('anon', 'public.get_archive_showcase_overview(bigint, text, text, text, text, text, smallint, date, date)', 'execute'), 'anon can execute showcase overview RPC');
select ok(has_function_privilege('authenticated', 'public.get_archive_showcase_overview(bigint, text, text, text, text, text, smallint, date, date)', 'execute'), 'authenticated can execute showcase overview RPC');
select ok(not exists (select 1 from pg_proc as proc cross join lateral aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) as acl where proc.oid = 'public.get_archive_showcase_overview(bigint, text, text, text, text, text, smallint, date, date)'::regprocedure and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'), 'PUBLIC cannot execute showcase overview RPC');
select ok(not has_function_privilege('service_role', 'public.get_archive_showcase_overview(bigint, text, text, text, text, text, smallint, date, date)', 'execute'), 'service role cannot execute showcase overview RPC');
select ok(has_function_privilege('anon', 'public.get_archive_showcase_page(bigint, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)', 'execute'), 'anon can execute showcase page RPC');
select ok(has_function_privilege('authenticated', 'public.get_archive_showcase_page(bigint, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)', 'execute'), 'authenticated can execute showcase page RPC');
select ok(not exists (select 1 from pg_proc as proc cross join lateral aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) as acl where proc.oid = 'public.get_archive_showcase_page(bigint, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)'::regprocedure and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'), 'PUBLIC cannot execute showcase page RPC');
select ok(not has_function_privilege('service_role', 'public.get_archive_showcase_page(bigint, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)', 'execute'), 'service role cannot execute showcase page RPC');
select ok(has_function_privilege('anon', 'public.resolve_archive_showcase(text)', 'execute'), 'anon can execute showcase resolver RPC');
select ok(has_function_privilege('authenticated', 'public.resolve_archive_showcase(text)', 'execute'), 'authenticated can execute showcase resolver RPC');
select ok(not exists (select 1 from pg_proc as proc cross join lateral aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) as acl where proc.oid = 'public.resolve_archive_showcase(text)'::regprocedure and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'), 'PUBLIC cannot execute showcase resolver RPC');
select ok(not has_function_privilege('service_role', 'public.resolve_archive_showcase(text)', 'execute'), 'service role cannot execute showcase resolver RPC');

select ok(not (select prosecdef from pg_proc where oid = 'archive_private.archive_overview(uuid, text, text, text, text, text, smallint, date, date)'::regprocedure), 'archive overview helper is SECURITY INVOKER');
select ok(not (select prosecdef from pg_proc where oid = 'archive_private.archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)'::regprocedure), 'archive page helper is SECURITY INVOKER');
select ok(not has_schema_privilege('anon', 'archive_private', 'usage'), 'anon cannot use archive_private');
select ok(has_schema_privilege('authenticated', 'archive_private', 'usage'), 'authenticated has required archive_private usage');
select ok(has_function_privilege('authenticated', 'archive_private.archive_overview(uuid, text, text, text, text, text, smallint, date, date)', 'execute'), 'authenticated can execute required archive overview helper');
select ok(not has_function_privilege('anon', 'archive_private.archive_overview(uuid, text, text, text, text, text, smallint, date, date)', 'execute'), 'anon cannot execute archive overview helper');
select ok(not exists (select 1 from pg_proc as proc cross join lateral aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) as acl where proc.oid = 'archive_private.archive_overview(uuid, text, text, text, text, text, smallint, date, date)'::regprocedure and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'), 'PUBLIC cannot execute archive overview helper');
select ok(not has_function_privilege('service_role', 'archive_private.archive_overview(uuid, text, text, text, text, text, smallint, date, date)', 'execute'), 'service role cannot execute archive overview helper');
select ok(has_function_privilege('authenticated', 'archive_private.archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)', 'execute'), 'authenticated can execute required archive page helper');
select ok(not has_function_privilege('anon', 'archive_private.archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)', 'execute'), 'anon cannot execute archive page helper');
select ok(not exists (select 1 from pg_proc as proc cross join lateral aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) as acl where proc.oid = 'archive_private.archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)'::regprocedure and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'), 'PUBLIC cannot execute archive page helper');
select ok(not has_function_privilege('service_role', 'archive_private.archive_page(uuid, text, text, text, text, text, smallint, bigint, bigint, integer, date, date)', 'execute'), 'service role cannot execute archive page helper');

select ok(to_regprocedure('public.rls_auto_enable()') is null, 'legacy public RLS handler is absent');
select ok(to_regprocedure('private.rls_auto_enable()') is not null, 'private RLS handler exists');
select ok((select prosecdef from pg_proc where oid = 'private.rls_auto_enable()'::regprocedure), 'private RLS handler is SECURITY DEFINER');
select ok((select proconfig @> array['search_path=pg_catalog'] from pg_proc where oid = 'private.rls_auto_enable()'::regprocedure), 'private RLS handler has a secure search path');
select ok(not exists (select 1 from pg_proc as proc cross join lateral aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) as acl where proc.oid = 'private.rls_auto_enable()'::regprocedure and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'), 'PUBLIC cannot execute private RLS handler');
select ok(not has_function_privilege('anon', 'private.rls_auto_enable()', 'execute'), 'anon cannot execute private RLS handler');
select ok(not has_function_privilege('authenticated', 'private.rls_auto_enable()', 'execute'), 'authenticated cannot execute private RLS handler');
select ok(not has_function_privilege('service_role', 'private.rls_auto_enable()', 'execute'), 'service role cannot execute private RLS handler');
select ok(not exists (select 1 from pg_namespace as namespace cross join lateral aclexplode(coalesce(namespace.nspacl, acldefault('n', namespace.nspowner))) as acl where namespace.nspname = 'private' and acl.grantee = 0 and acl.privilege_type = 'USAGE'), 'PUBLIC cannot use private schema');
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon cannot use private schema');
select ok(not has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated cannot use private schema');
select ok(not has_schema_privilege('service_role', 'private', 'usage'), 'service role cannot use private schema');
select ok(exists (select 1 from pg_event_trigger where evtname = 'ensure_rls'), 'ensure_rls event trigger exists');
select ok((select evtfoid = 'private.rls_auto_enable()'::regprocedure from pg_event_trigger where evtname = 'ensure_rls'), 'ensure_rls invokes the private handler');
select ok((select evttags @> array['CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO']::text[] and cardinality(evttags) = 3 from pg_event_trigger where evtname = 'ensure_rls'), 'ensure_rls covers every supported table creation command');

create table public.default_privileges_table_probe (
  id bigint generated by default as identity primary key
);

select ok((select relrowsecurity from pg_class where oid = 'public.default_privileges_table_probe'::regclass), 'RLS handler enables RLS on future public tables');
select ok(not exists (select 1 from pg_class as relation cross join lateral aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) as acl where relation.oid = 'public.default_privileges_table_probe'::regclass and acl.grantee = 0), 'future public tables grant no privileges to PUBLIC');
select ok(not exists (select 1 from pg_class as relation cross join lateral aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) as acl join pg_roles as role on role.oid = acl.grantee where relation.oid = 'public.default_privileges_table_probe'::regclass and role.rolname = 'anon'), 'future public tables grant no privileges to anon');
select ok(not exists (select 1 from pg_class as relation cross join lateral aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) as acl join pg_roles as role on role.oid = acl.grantee where relation.oid = 'public.default_privileges_table_probe'::regclass and role.rolname = 'authenticated'), 'future public tables grant no privileges to authenticated');
select ok(not exists (select 1 from pg_class as relation cross join lateral aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) as acl join pg_roles as role on role.oid = acl.grantee where relation.oid = 'public.default_privileges_table_probe'::regclass and role.rolname = 'service_role'), 'future public tables grant no privileges to service role');
select ok(not exists (select 1 from pg_class as relation cross join lateral aclexplode(coalesce(relation.relacl, acldefault('S', relation.relowner))) as acl where relation.oid = 'public.default_privileges_table_probe_id_seq'::regclass and acl.grantee = 0), 'future public sequences grant no privileges to PUBLIC');
select ok(not exists (select 1 from pg_class as relation cross join lateral aclexplode(coalesce(relation.relacl, acldefault('S', relation.relowner))) as acl join pg_roles as role on role.oid = acl.grantee where relation.oid = 'public.default_privileges_table_probe_id_seq'::regclass and role.rolname = 'anon'), 'future public sequences grant no privileges to anon');
select ok(not exists (select 1 from pg_class as relation cross join lateral aclexplode(coalesce(relation.relacl, acldefault('S', relation.relowner))) as acl join pg_roles as role on role.oid = acl.grantee where relation.oid = 'public.default_privileges_table_probe_id_seq'::regclass and role.rolname = 'authenticated'), 'future public sequences grant no privileges to authenticated');
select ok(not exists (select 1 from pg_class as relation cross join lateral aclexplode(coalesce(relation.relacl, acldefault('S', relation.relowner))) as acl join pg_roles as role on role.oid = acl.grantee where relation.oid = 'public.default_privileges_table_probe_id_seq'::regclass and role.rolname = 'service_role'), 'future public sequences grant no privileges to service role');

create function public.default_privileges_probe()
returns integer
language sql
as $function$
  select 1;
$function$;

select ok(not exists (select 1 from pg_proc as proc cross join lateral aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) as acl where proc.oid = 'public.default_privileges_probe()'::regprocedure and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'), 'future public functions deny EXECUTE to PUBLIC');
select ok(not has_function_privilege('anon', 'public.default_privileges_probe()', 'execute'), 'future public functions deny EXECUTE to anon');
select ok(not has_function_privilege('authenticated', 'public.default_privileges_probe()', 'execute'), 'future public functions deny EXECUTE to authenticated');
select ok(not has_function_privilege('service_role', 'public.default_privileges_probe()', 'execute'), 'future public functions deny EXECUTE to service role');

select * from finish();
rollback;
