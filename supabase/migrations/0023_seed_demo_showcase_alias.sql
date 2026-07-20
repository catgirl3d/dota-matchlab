-- Dota account IDs are stable external identifiers; the tracked-account UUID
-- remains environment-specific and is never embedded in the migration.
update public.archive_showcases
set slug = 'demo'
where dota_account_id = 93447624;
