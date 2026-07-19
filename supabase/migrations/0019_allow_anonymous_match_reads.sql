-- Provider match data is shared read-only data. Personal archive membership and
-- every write/import path remain protected separately.
grant select on table public.dota_matches to anon;
grant select on table public.player_match_stats to anon;
grant select on table public.match_provider_payloads to anon;

drop policy "Authenticated users can read Dota matches" on public.dota_matches;
drop policy "Authenticated users can read Dota match stats" on public.player_match_stats;
drop policy "Authenticated users can read Dota match payloads" on public.match_provider_payloads;

create policy "Anyone can read Dota matches"
on public.dota_matches for select to anon, authenticated using (true);

create policy "Anyone can read Dota match stats"
on public.player_match_stats for select to anon, authenticated using (true);

create policy "Anyone can read Dota match payloads"
on public.match_provider_payloads for select to anon, authenticated using (true);
