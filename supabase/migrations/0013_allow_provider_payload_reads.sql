grant select on table public.match_provider_payloads to authenticated;

comment on policy "Users can read provider payloads for tracked matches"
on public.match_provider_payloads is
  'Authenticated users can read raw provider sections only for matches linked to their tracked accounts.';
