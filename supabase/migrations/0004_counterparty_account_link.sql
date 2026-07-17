-- EntreNous — lier le compte d'un invité (counterparty) à un ledger partagé.
-- Jusqu'ici seul l'owner d'un ledger avait un vrai compte utilisateur ; le
-- counterparty n'était qu'un nom texte (counterparty_name), jamais relié à un
-- compte réel. Quand un invité se connectait/s'inscrivait depuis un lien de
-- partage, rien ne rattachait son nouveau compte au ledger consulté : il
-- n'apparaissait jamais dans son propre tableau de bord. On ajoute un lien
-- optionnel counterparty_id, une fonction pour "réclamer" un ledger depuis
-- son lien de partage une fois connecté, et les policies RLS nécessaires
-- pour qu'un counterparty authentifié et lié accède à son ledger et ses
-- transactions directement (comme un owner le fait pour les siens), sans
-- passer par les fonctions guest_* réservées à l'accès anonyme par token.

alter table public.ledgers
  add column if not exists counterparty_id uuid references auth.users (id) on delete set null;

create index if not exists ledgers_counterparty_id_idx on public.ledgers (counterparty_id);

-- ============================================================
-- Réclamer un ledger depuis son lien de partage
-- ============================================================
create or replace function public.claim_ledger_as_counterparty(p_token text)
returns public.ledgers
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.ledgers;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.';
  end if;

  select * into v_row from public.ledgers where share_token = p_token and is_private = false;
  if v_row.id is null then
    raise exception 'Lien invalide.';
  end if;

  if v_row.owner_id = auth.uid() then
    raise exception 'Vous êtes déjà le propriétaire de ce compte.';
  end if;

  if v_row.counterparty_id is not null and v_row.counterparty_id <> auth.uid() then
    raise exception 'Ce lien est déjà associé à un autre compte.';
  end if;

  update public.ledgers set counterparty_id = auth.uid() where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.claim_ledger_as_counterparty(text) to authenticated;

-- ============================================================
-- Accès direct (RLS) pour un counterparty authentifié et lié
-- ============================================================
create policy "ledgers_counterparty_select"
  on public.ledgers for select
  to authenticated
  using (auth.uid() = counterparty_id);

create policy "transactions_counterparty_select"
  on public.transactions for select
  to authenticated
  using (exists (select 1 from public.ledgers l where l.id = ledger_id and l.counterparty_id = auth.uid()));

create policy "transactions_counterparty_insert"
  on public.transactions for insert
  to authenticated
  with check (
    created_by = 'counterparty'
    and status = 'pending'
    and exists (select 1 from public.ledgers l where l.id = ledger_id and l.counterparty_id = auth.uid())
  );

create policy "transactions_counterparty_update"
  on public.transactions for update
  to authenticated
  using (exists (select 1 from public.ledgers l where l.id = ledger_id and l.counterparty_id = auth.uid()));

create policy "transactions_counterparty_delete"
  on public.transactions for delete
  to authenticated
  using (exists (select 1 from public.ledgers l where l.id = ledger_id and l.counterparty_id = auth.uid()));
