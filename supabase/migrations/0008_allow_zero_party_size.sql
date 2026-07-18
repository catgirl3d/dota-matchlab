alter table public.player_match_stats
  drop constraint player_match_stats_party_size_range,
  add constraint player_match_stats_party_size_range
    check (party_size is null or party_size between 0 and 10);

comment on column public.player_match_stats.party_size is
  'OpenDota party size; zero is preserved because the provider returns it for some matches.';
