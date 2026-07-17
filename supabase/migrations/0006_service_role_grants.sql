-- Le rôle service_role (utilisé par les Edge Functions via la clé de service)
-- contourne RLS, mais Postgres exige quand même des privilèges de table
-- explicites (GRANT) indépendamment de RLS. Les migrations précédentes
-- n'accordaient ces privilèges qu'à anon/authenticated, pas à service_role,
-- ce qui provoquait des erreurs "permission denied for table" dans
-- notify-transaction-event dès qu'il tentait de lire transactions/ledgers.
grant usage on schema public to service_role;

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.ledgers to service_role;
grant select, insert, update, delete on public.transactions to service_role;
