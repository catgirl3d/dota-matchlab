create table public.account_match_detail_queue (
  dota_account_id bigint not null,
  match_id bigint not null references public.dota_matches (match_id) on delete cascade,
  status text not null default 'pending',
  lease_token uuid,
  lease_expires_at timestamptz,
  attempts integer not null default 0,
  next_retry_at timestamptz,
  last_error_code text,
  last_error_message text,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (dota_account_id, match_id),
  constraint account_match_detail_queue_account_id_range
    check (dota_account_id between 0 and 4294967295),
  constraint account_match_detail_queue_status_valid
    check (status in ('pending', 'syncing', 'available', 'unavailable', 'failed')),
  constraint account_match_detail_queue_attempts_nonnegative check (attempts >= 0),
  constraint account_match_detail_queue_error_code_length
    check (last_error_code is null or char_length(last_error_code) between 1 and 80),
  constraint account_match_detail_queue_error_message_length
    check (last_error_message is null or char_length(last_error_message) between 1 and 500)
);

create index account_match_detail_queue_work_idx
  on public.account_match_detail_queue (dota_account_id, status, next_retry_at, match_id desc);

create trigger account_match_detail_queue_set_updated_at
before update on public.account_match_detail_queue
for each row execute function public.set_updated_at();

alter table public.account_match_detail_queue enable row level security;
revoke all on table public.account_match_detail_queue from anon, authenticated;
grant select, insert, update, delete on table public.account_match_detail_queue to service_role;

create policy "Users can read detail queue for tracked accounts"
on public.account_match_detail_queue
for select to authenticated
using (
  exists (
    select 1 from public.tracked_accounts
    where tracked_accounts.dota_account_id = account_match_detail_queue.dota_account_id
      and tracked_accounts.user_id = ((select auth.jwt()) ->> 'sub')
  )
);

create function public.enqueue_stratz_match_detail()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.provider <> 'stratz' or new.payload_kind <> 'history' then
    return new;
  end if;

  insert into public.account_match_detail_queue (dota_account_id, match_id)
  select stats.account_id, new.match_id
  from public.player_match_stats as stats
  where stats.match_id = new.match_id
  on conflict (dota_account_id, match_id) do update
  set status = case
        when public.account_match_detail_queue.status in ('available', 'syncing')
          then public.account_match_detail_queue.status
        else 'pending'
      end,
      next_retry_at = case
        when public.account_match_detail_queue.status in ('available', 'syncing')
          then public.account_match_detail_queue.next_retry_at
        else null
      end;
  return new;
end;
$function$;

create trigger match_provider_payloads_enqueue_stratz_detail
after insert or update of payload on public.match_provider_payloads
for each row execute function public.enqueue_stratz_match_detail();

insert into public.account_match_detail_queue (dota_account_id, match_id)
select distinct stats.account_id, payload.match_id
from public.match_provider_payloads as payload
join public.player_match_stats as stats on stats.match_id = payload.match_id
where payload.provider = 'stratz' and payload.payload_kind = 'history'
on conflict (dota_account_id, match_id) do nothing;

create or replace function public.claim_match_detail_batch(
  p_actor_user_id text,
  p_tracked_account_id uuid,
  p_lease_seconds integer default 300,
  p_batch_size integer default 2
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  resolved_account_id bigint;
  token uuid;
  claimed_matches jsonb;
  remaining_count integer;
begin
  if p_lease_seconds not between 30 and 600 or p_batch_size not between 1 and 5 then
    raise exception 'Invalid detail sync claim limits';
  end if;

  select dota_account_id into resolved_account_id
  from public.tracked_accounts
  where id = p_tracked_account_id and user_id = p_actor_user_id;

  if not found or resolved_account_id is null then
    return jsonb_build_object('owned', false, 'claimed', false);
  end if;

  token := extensions.gen_random_uuid();
  with candidates as (
    select queue.match_id
    from public.account_match_detail_queue as queue
    where queue.dota_account_id = resolved_account_id
      and queue.status in ('pending', 'failed')
      and (queue.next_retry_at is null or queue.next_retry_at <= now())
    order by queue.match_id desc
    limit p_batch_size
    for update skip locked
  ), claimed as (
    update public.account_match_detail_queue as queue
    set status = 'syncing', lease_token = token,
        lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        attempts = queue.attempts + 1
    from candidates
    where queue.dota_account_id = resolved_account_id
      and queue.match_id = candidates.match_id
    returning queue.match_id
  )
  select coalesce(jsonb_agg(match_id order by match_id desc), '[]'::jsonb)
  into claimed_matches from claimed;

  select count(*) into remaining_count
  from public.account_match_detail_queue
  where dota_account_id = resolved_account_id
    and status in ('pending', 'syncing');

  return jsonb_build_object(
    'owned', true,
    'claimed', jsonb_array_length(claimed_matches) > 0,
    'dotaAccountId', resolved_account_id,
    'leaseToken', token,
    'matchIds', claimed_matches,
    'backfillComplete', remaining_count = 0
  );
end;
$function$;

create or replace function public.apply_match_detail_batch(
  p_actor_user_id text,
  p_tracked_account_id uuid,
  p_dota_account_id bigint,
  p_lease_token uuid,
  p_results jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  remaining_count integer;
begin
  if jsonb_typeof(p_results) <> 'array' then
    raise exception 'Detail results must be a JSON array';
  end if;
  if not exists (
    select 1 from public.tracked_accounts
    where id = p_tracked_account_id and user_id = p_actor_user_id
      and dota_account_id = p_dota_account_id
  ) then
    raise exception 'Tracked account is not owned by the detail sync actor';
  end if;

  update public.account_match_detail_queue as queue
  set status = case result.status
        when 'available' then 'available'
        when 'unavailable' then 'unavailable'
        else 'failed'
      end,
      fetched_at = case when result.status = 'available' then now() else queue.fetched_at end,
      next_retry_at = case
        when result.status in ('available', 'unavailable') then null
        else now() + make_interval(mins => least(power(2, least(queue.attempts, 5))::integer, 30))
      end,
      last_error_code = case when result.status = 'failed' then left(nullif(btrim(result.error_code), ''), 80) else null end,
      last_error_message = case when result.status = 'failed' then left(nullif(btrim(result.error_message), ''), 500) else null end,
      lease_token = null,
      lease_expires_at = null
  from jsonb_to_recordset(p_results) as result(
    match_id bigint, status text, error_code text, error_message text, payloads jsonb
  )
  where queue.dota_account_id = p_dota_account_id
    and queue.match_id = result.match_id
    and queue.status = 'syncing'
    and queue.lease_token = p_lease_token;

  insert into public.match_provider_payloads (
    match_id, provider, payload_kind, payload_section, payload, schema_version, fetched_at
  )
  select result.match_id, 'stratz', 'detail',
    coalesce(nullif(btrim(payload.payload_section), ''), 'match'), payload.payload,
    nullif(btrim(payload.schema_version), ''), now()
  from jsonb_to_recordset(p_results) as result(
    match_id bigint, status text, error_code text, error_message text, payloads jsonb
  )
  cross join lateral jsonb_to_recordset(coalesce(result.payloads, '[]'::jsonb)) as payload(
    payload_section text, payload jsonb, schema_version text
  )
  where result.match_id > 0 and payload.payload is not null
  on conflict (match_id, provider, payload_kind, payload_section) do update
  set payload = excluded.payload, schema_version = excluded.schema_version, fetched_at = excluded.fetched_at;

  insert into public.player_match_stats (
    match_id, account_id, player_slot, hero_id, kills, deaths, assists,
    gold_per_min, xp_per_min, last_hits, denies, hero_damage, tower_damage,
    hero_healing, level, net_worth, leaver_status
  )
  select
    player."matchId", player."steamAccountId", player."playerSlot", player."heroId",
    player.kills, player.deaths, player.assists, player."goldPerMinute",
    player."experiencePerMinute", player."numLastHits", player."numDenies",
    player."heroDamage", player."towerDamage", player."heroHealing", player.level,
    player.networth, case when player."leaverStatus" = 'NONE' then 0 else null end
  from jsonb_to_recordset(p_results) as result(
    match_id bigint, status text, error_code text, error_message text, payloads jsonb
  )
  cross join lateral jsonb_to_recordset(coalesce(result.payloads, '[]'::jsonb)) as payload(
    payload_section text, payload jsonb, schema_version text
  )
  cross join lateral jsonb_to_recordset(payload.payload #> '{data,match,players}') as player(
    "matchId" bigint, "steamAccountId" bigint, "playerSlot" smallint, "heroId" smallint,
    kills integer, deaths integer, assists integer, "goldPerMinute" integer,
    "experiencePerMinute" integer, "numLastHits" integer, "numDenies" integer,
    "heroDamage" integer, "towerDamage" integer, "heroHealing" integer, level smallint,
    networth integer, "leaverStatus" text
  )
  where payload.payload_section = 'players'
    and player."matchId" = result.match_id
    and player."steamAccountId" between 0 and 4294967295
  on conflict (match_id, account_id) do update
  set player_slot = coalesce(excluded.player_slot, public.player_match_stats.player_slot),
      hero_id = coalesce(excluded.hero_id, public.player_match_stats.hero_id),
      kills = coalesce(excluded.kills, public.player_match_stats.kills),
      deaths = coalesce(excluded.deaths, public.player_match_stats.deaths),
      assists = coalesce(excluded.assists, public.player_match_stats.assists),
      gold_per_min = coalesce(excluded.gold_per_min, public.player_match_stats.gold_per_min),
      xp_per_min = coalesce(excluded.xp_per_min, public.player_match_stats.xp_per_min),
      last_hits = coalesce(excluded.last_hits, public.player_match_stats.last_hits),
      denies = coalesce(excluded.denies, public.player_match_stats.denies),
      hero_damage = coalesce(excluded.hero_damage, public.player_match_stats.hero_damage),
      tower_damage = coalesce(excluded.tower_damage, public.player_match_stats.tower_damage),
      hero_healing = coalesce(excluded.hero_healing, public.player_match_stats.hero_healing),
      level = coalesce(excluded.level, public.player_match_stats.level),
      net_worth = coalesce(excluded.net_worth, public.player_match_stats.net_worth),
      leaver_status = coalesce(excluded.leaver_status, public.player_match_stats.leaver_status),
      source_fetched_at = now();

  update public.dota_matches as match
  set detail_status = case result.status
        when 'available' then 'available'
        when 'unavailable' then 'unavailable'
        else 'failed'
      end,
      detail_fetched_at = case when result.status = 'available' then now() else match.detail_fetched_at end
  from jsonb_to_recordset(p_results) as result(
    match_id bigint, status text, error_code text, error_message text, payloads jsonb
  )
  where match.match_id = result.match_id;

  select count(*) into remaining_count
  from public.account_match_detail_queue
  where dota_account_id = p_dota_account_id and status in ('pending', 'syncing');

  return jsonb_build_object(
    'processedMatches', jsonb_array_length(p_results),
    'backfillComplete', remaining_count = 0
  );
end;
$function$;

revoke all on function public.claim_match_detail_batch(text, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.apply_match_detail_batch(text, uuid, bigint, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.claim_match_detail_batch(text, uuid, integer, integer) to service_role;
grant execute on function public.apply_match_detail_batch(text, uuid, bigint, uuid, jsonb) to service_role;
