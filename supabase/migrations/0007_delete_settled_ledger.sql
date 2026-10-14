-- ============================================================
-- Suppression d'une dette soldée par l'une ou l'autre des parties
-- ============================================================
-- Le propriétaire peut déjà supprimer ses ledgers (policy ledgers_owner_delete).
-- Cette fonction permet aussi au counterparty (compte associé ou invité via le
-- lien de partage) de supprimer le compte, mais uniquement quand il est soldé :
-- solde confirmé à 0 et aucune transaction en attente. La vérification se fait
-- ici, côté serveur, pour qu'on ne puisse pas effacer une dette en cours.

create or replace function public.delete_settled_ledger(p_token text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_ledger_id uuid;
  v_balance numeric;
  v_pending integer;
begin
  select id into v_ledger_id
  from public.ledgers
  where share_token = p_token and is_private = false
  for update;

  if v_ledger_id is null then
    raise exception 'Lien invalide.';
  end if;

  select
    coalesce(sum(case when direction = 'owner_to_counterparty' then amount else -amount end)
      filter (where status = 'confirmed'), 0),
    count(*) filter (where status = 'pending')
  into v_balance, v_pending
  from public.transactions
  where ledger_id = v_ledger_id;

  if v_pending > 0 then
    raise exception 'Des transactions sont encore en attente de confirmation.';
  end if;

  if v_balance <> 0 then
    raise exception 'Le compte n''est pas soldé : la dette ne peut être supprimée qu''à 0.';
  end if;

  delete from public.ledgers where id = v_ledger_id;
end;
$$;

grant execute on function public.delete_settled_ledger(text) to anon, authenticated;
