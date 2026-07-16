-- EntreNous — durcissement sécurité :
-- 1) L'accès invité (rôle anon) ne doit jamais pouvoir lire/écrire un ledger
--    autre que celui désigné par son share_token. Les anciennes policies
--    "to anon ... using (is_private = false)" autorisaient un accès à TOUS
--    les ledgers/transactions partagés du système (le filtrage par token
--    n'était fait que côté client). On remplace cet accès par des fonctions
--    RPC security definer qui valident le token côté serveur avant toute
--    lecture/écriture, et on retire les droits directs du rôle anon sur les
--    tables. Ces fonctions sont aussi accessibles au rôle authenticated,
--    pour qu'un utilisateur déjà connecté puisse ouvrir le lien de partage
--    de quelqu'un d'autre (cas non couvert par les anciennes policies
--    scopées "to anon").
-- 2) La règle métier « on ne peut pas confirmer sa propre transaction » et
--    « on ne peut plus éditer une transaction après confirmation » n'étaient
--    vérifiées que côté UI, donc contournables via un appel direct à l'API
--    Supabase. On les fait respecter par un trigger BEFORE UPDATE sur
--    public.transactions, qui s'applique à tout appelant (owner authentifié
--    ou invité via RPC) puisqu'il est indépendant du rôle Postgres.

-- ============================================================
-- 1. Retrait de l'accès direct anon (remplacé par les RPC ci-dessous)
-- ============================================================
drop policy if exists "ledgers_guest_select_by_token" on public.ledgers;
drop policy if exists "transactions_guest_select" on public.transactions;
drop policy if exists "transactions_guest_insert" on public.transactions;
drop policy if exists "transactions_guest_update" on public.transactions;
drop policy if exists "transactions_guest_delete" on public.transactions;

revoke select on public.ledgers from anon;
revoke select, insert, update, delete on public.transactions from anon;

-- ============================================================
-- 2. L'insert owner doit respecter l'invariant "pending sauf ledger privé"
-- ============================================================
drop policy if exists "transactions_owner_insert" on public.transactions;
create policy "transactions_owner_insert"
  on public.transactions for insert
  with check (
    created_by = 'owner'
    and exists (select 1 from public.ledgers l where l.id = ledger_id and l.owner_id = auth.uid())
    and (
      (status = 'pending' and confirmed_at is null)
      or (
        status = 'confirmed'
        and exists (select 1 from public.ledgers l where l.id = ledger_id and l.is_private = true)
      )
    )
  );

-- ============================================================
-- 3. Trigger : règles de transition de statut, valables pour tout appelant
-- ============================================================
create or replace function public.transactions_enforce_transition()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner_id uuid;
  v_is_private boolean;
  v_actor text;
begin
  select owner_id, is_private into v_owner_id, v_is_private
  from public.ledgers where id = new.ledger_id;

  -- L'invité (rôle anon, ou un utilisateur connecté qui n'est pas owner de ce
  -- ledger) agit toujours en tant que 'counterparty'.
  if auth.uid() is not null and auth.uid() = v_owner_id then
    v_actor := 'owner';
  else
    v_actor := 'counterparty';
  end if;

  -- Édition du contenu (montant/sens/type/note) : uniquement le créateur,
  -- tant que la transaction est en attente. Les notes privées restent
  -- toujours modifiables (pas de logique de confirmation).
  if (new.amount, new.direction, new.kind, coalesce(new.note, ''))
     is distinct from (old.amount, old.direction, old.kind, coalesce(old.note, '')) then
    if not v_is_private and (old.status <> 'pending' or old.created_by <> v_actor) then
      raise exception 'Cette transaction ne peut plus être modifiée.';
    end if;
  end if;

  -- Changement de statut (confirmation / contestation).
  if new.status <> old.status then
    if v_is_private then
      raise exception 'Statut non modifiable sur une note privée.';
    end if;
    if old.status <> 'pending' then
      raise exception 'Cette transaction a déjà été finalisée.';
    end if;
    if old.created_by = v_actor then
      raise exception 'Vous ne pouvez pas confirmer ou contester votre propre transaction.';
    end if;
    if new.status = 'confirmed' then
      new.confirmed_at := now();
    elsif new.status <> 'disputed' then
      raise exception 'Transition de statut invalide.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_before_update on public.transactions;
create trigger transactions_before_update
  before update on public.transactions
  for each row execute procedure public.transactions_enforce_transition();

-- ============================================================
-- 4. Accès invité via fonctions RPC validant le share_token côté serveur
-- ============================================================
-- returns setof (plutôt qu'un seul public.ledgers) pour que le client puisse
-- utiliser .single() côté supabase-js et obtenir une erreur PostgREST propre
-- si aucune ligne ne correspond, au lieu d'un enregistrement "tout à null".
create or replace function public.guest_get_ledger(p_token text)
returns setof public.ledgers
language sql
security definer set search_path = public
stable
as $$
  select * from public.ledgers where share_token = p_token and is_private = false;
$$;

create or replace function public.guest_get_transactions(p_token text)
returns setof public.transactions
language sql
security definer set search_path = public
stable
as $$
  select t.* from public.transactions t
  join public.ledgers l on l.id = t.ledger_id
  where l.share_token = p_token and l.is_private = false;
$$;

create or replace function public.guest_add_transaction(
  p_token text,
  p_amount numeric,
  p_direction text,
  p_kind text,
  p_note text
)
returns public.transactions
language plpgsql
security definer set search_path = public
as $$
declare
  v_ledger_id uuid;
  v_row public.transactions;
begin
  select id into v_ledger_id from public.ledgers where share_token = p_token and is_private = false;
  if v_ledger_id is null then
    raise exception 'Lien invalide.';
  end if;

  insert into public.transactions (ledger_id, amount, direction, kind, note, created_by, status)
  values (v_ledger_id, p_amount, p_direction, p_kind, p_note, 'counterparty', 'pending')
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.guest_update_transaction_status(
  p_token text,
  p_tx_id uuid,
  p_status text,
  p_dispute_comment text default null
)
returns public.transactions
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.transactions;
begin
  update public.transactions t
  set status = p_status,
      dispute_comment = coalesce(p_dispute_comment, t.dispute_comment)
  from public.ledgers l
  where t.id = p_tx_id and l.id = t.ledger_id and l.share_token = p_token and l.is_private = false
  returning t.* into v_row;

  if v_row.id is null then
    raise exception 'Transaction introuvable pour ce lien.';
  end if;

  return v_row;
end;
$$;

create or replace function public.guest_edit_transaction(
  p_token text,
  p_tx_id uuid,
  p_amount numeric,
  p_direction text,
  p_kind text,
  p_note text
)
returns public.transactions
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.transactions;
begin
  update public.transactions t
  set amount = p_amount,
      direction = p_direction,
      kind = p_kind,
      note = p_note
  from public.ledgers l
  where t.id = p_tx_id and l.id = t.ledger_id and l.share_token = p_token and l.is_private = false
  returning t.* into v_row;

  if v_row.id is null then
    raise exception 'Transaction introuvable pour ce lien.';
  end if;

  return v_row;
end;
$$;

create or replace function public.guest_delete_transaction(p_token text, p_tx_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.transactions t
  using public.ledgers l
  where t.id = p_tx_id
    and l.id = t.ledger_id
    and l.share_token = p_token
    and l.is_private = false
    and t.status = 'pending'
    and t.created_by = 'counterparty';
end;
$$;

grant execute on function public.guest_get_ledger(text) to anon, authenticated;
grant execute on function public.guest_get_transactions(text) to anon, authenticated;
grant execute on function public.guest_add_transaction(text, numeric, text, text, text) to anon, authenticated;
grant execute on function public.guest_update_transaction_status(text, uuid, text, text) to anon, authenticated;
grant execute on function public.guest_edit_transaction(text, uuid, numeric, text, text, text) to anon, authenticated;
grant execute on function public.guest_delete_transaction(text, uuid) to anon, authenticated;
