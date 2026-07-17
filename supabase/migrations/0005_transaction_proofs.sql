-- EntreNous — pièce jointe (photo/document) de preuve de virement sur une
-- transaction. Fonctionnalité disponible pour tout le monde : owner et
-- counterparty authentifiés (mise à jour directe de la table, déjà couverte
-- par les policies existantes qui n'ont pas de "with check" bloquant une
-- simple mise à jour de ces deux colonnes), et invité anonyme via une
-- nouvelle fonction RPC security definer, sur le même modèle que les
-- fonctions guest_* existantes (0002/0003).

alter table public.transactions
  add column if not exists proof_path text,
  add column if not exists proof_name text;

-- ============================================================
-- Bucket de stockage pour les fichiers de preuve.
-- Public en lecture : quiconque possède déjà le share_token d'un ledger a de
-- toute façon accès à son contenu (même modèle de confiance que le reste de
-- l'accès invité, cf. 0002), et le chemin de fichier inclut ce token donc
-- n'est pas devinable de l'extérieur.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('transaction-proofs', 'transaction-proofs', true)
on conflict (id) do nothing;

-- Convention de chemin : "{share_token}/{transaction_id}/{filename}".
-- security definer car le rôle anon n'a aucun droit SELECT direct sur
-- ledgers/transactions (révoqué en 0002) — cette fonction reproduit, pour le
-- Storage, le même modèle de confiance que les RPC guest_* : connaître le
-- share_token suffit à accéder au ledger correspondant.
create or replace function public.storage_proof_path_allowed(object_name text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
    from public.transactions t
    join public.ledgers l on l.id = t.ledger_id
    where l.share_token = (storage.foldername(object_name))[1]
      and l.is_private = false
      and t.id::text = (storage.foldername(object_name))[2]
  );
$$;

grant execute on function public.storage_proof_path_allowed(text) to anon, authenticated;

create policy "transaction_proofs_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'transaction-proofs' and public.storage_proof_path_allowed(name));

create policy "transaction_proofs_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'transaction-proofs' and public.storage_proof_path_allowed(name));

create policy "transaction_proofs_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'transaction-proofs' and public.storage_proof_path_allowed(name));

-- ============================================================
-- RPC invité : associer / retirer une preuve sur une transaction d'un ledger
-- partagé (non privé). Le trigger transactions_enforce_transition n'inspecte
-- que (amount, direction, kind, note) et status ; il ignore proof_path/
-- proof_name, donc aucune règle de transition supplémentaire à répliquer
-- ici. On n'impose pas non plus que l'appelant soit le créateur de la
-- transaction : une preuve peut être ajoutée par n'importe quelle des deux
-- parties, à tout moment (y compris après confirmation).
-- ============================================================
create or replace function public.guest_set_transaction_proof(
  p_token text,
  p_tx_id uuid,
  p_proof_path text,
  p_proof_name text
)
returns public.transactions
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.transactions;
begin
  update public.transactions t
  set proof_path = p_proof_path,
      proof_name = p_proof_name
  from public.ledgers l
  where t.id = p_tx_id and l.id = t.ledger_id and l.share_token = p_token and l.is_private = false
  returning t.* into v_row;

  if v_row.id is null then
    raise exception 'Transaction introuvable pour ce lien.';
  end if;

  return v_row;
end;
$$;

grant execute on function public.guest_set_transaction_proof(text, uuid, text, text) to anon, authenticated;
