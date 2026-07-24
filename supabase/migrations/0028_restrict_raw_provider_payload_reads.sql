-- Raw provider payloads are an internal archive. Public consumers receive the
-- Worker-produced MatchDetailSnapshot instead of provider-specific JSON.
revoke select on table public.match_provider_payloads from anon, authenticated;

drop policy if exists "Anyone can read Dota match payloads"
  on public.match_provider_payloads;

comment on table public.match_provider_payloads is
  'Unmodified provider-specific match payloads retained for service-role ingestion and normalized Worker read models.';
