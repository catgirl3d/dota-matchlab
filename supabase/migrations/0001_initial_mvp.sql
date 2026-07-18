create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create table public.profiles (
  clerk_user_id text primary key default (auth.jwt() ->> 'sub'),
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_clerk_user_id_not_blank
    check (char_length(btrim(clerk_user_id)) between 1 and 128),
  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) between 1 and 80)
);

create table public.tracked_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt() ->> 'sub'),
  steam_id64 text not null,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracked_accounts_steam_id64_format
    check (steam_id64 ~ '^[0-9]{16,20}$'),
  constraint tracked_accounts_label_length
    check (label is null or char_length(label) between 1 and 60),
  constraint tracked_accounts_user_steam_unique unique (user_id, steam_id64)
);

create index tracked_accounts_user_id_idx
  on public.tracked_accounts (user_id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger tracked_accounts_set_updated_at
before update on public.tracked_accounts
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.tracked_accounts enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.tracked_accounts from anon, authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.tracked_accounts to authenticated;

create policy "Users can read their profile"
on public.profiles
for select
to authenticated
using (((select auth.jwt()) ->> 'sub') = clerk_user_id);

create policy "Users can create their profile"
on public.profiles
for insert
to authenticated
with check (((select auth.jwt()) ->> 'sub') = clerk_user_id);

create policy "Users can update their profile"
on public.profiles
for update
to authenticated
using (((select auth.jwt()) ->> 'sub') = clerk_user_id)
with check (((select auth.jwt()) ->> 'sub') = clerk_user_id);

create policy "Users can delete their profile"
on public.profiles
for delete
to authenticated
using (((select auth.jwt()) ->> 'sub') = clerk_user_id);

create policy "Users can read tracked accounts"
on public.tracked_accounts
for select
to authenticated
using (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users can create tracked accounts"
on public.tracked_accounts
for insert
to authenticated
with check (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users can update tracked accounts"
on public.tracked_accounts
for update
to authenticated
using (((select auth.jwt()) ->> 'sub') = user_id)
with check (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users can delete tracked accounts"
on public.tracked_accounts
for delete
to authenticated
using (((select auth.jwt()) ->> 'sub') = user_id);

create or replace function public.app_healthcheck()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object('status', 'ok');
$$;

revoke all on function public.app_healthcheck() from public;
grant execute on function public.app_healthcheck() to anon, authenticated;

comment on table public.profiles is
  'Application profile keyed by the external Clerk user identifier.';
comment on table public.tracked_accounts is
  'Steam profiles selected by a Clerk user for analysis; ownership is not implied.';
comment on function public.app_healthcheck() is
  'Narrow public readiness probe used by the application Worker.';
