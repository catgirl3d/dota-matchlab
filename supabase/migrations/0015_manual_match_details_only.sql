drop trigger if exists match_provider_payloads_enqueue_stratz_detail
  on public.match_provider_payloads;

drop function if exists public.enqueue_stratz_match_detail();
drop function if exists public.claim_match_detail_batch(text, uuid, integer, integer);

truncate table public.account_match_detail_queue;
