-- EntreNous — correction : une transaction contestée était une impasse.
-- Une fois `status = 'disputed'`, ni le trigger (édition de contenu bloquée
-- dès que old.status <> 'pending'), ni le RPC invité `guest_delete_transaction`
-- (restreint à status = 'pending') ne permettaient au créateur de corriger ou
-- de retirer sa transaction. On permet désormais au créateur de modifier ou
-- supprimer une transaction contestée ; la corriger la repasse automatiquement
-- en attente (pour une nouvelle confirmation par l'autre partie) et efface le
-- commentaire de contestation.

create or replace function public.transactions_enforce_transition()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner_id uuid;
  v_is_private boolean;
  v_actor text;
  v_content_changed boolean;
  v_auto_reset boolean;
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

  v_content_changed := (new.amount, new.direction, new.kind, coalesce(new.note, ''))
    is distinct from (old.amount, old.direction, old.kind, coalesce(old.note, ''));

  -- Édition du contenu (montant/sens/type/note) : uniquement le créateur, tant
  -- que la transaction n'est pas confirmée. Les notes privées restent toujours
  -- modifiables (pas de logique de confirmation). Corriger une transaction
  -- contestée la renvoie en attente de confirmation par l'autre partie.
  v_auto_reset := false;
  if v_content_changed and not v_is_private then
    if old.created_by <> v_actor then
      raise exception 'Cette transaction ne peut plus être modifiée.';
    end if;
    if old.status = 'confirmed' then
      raise exception 'Cette transaction ne peut plus être modifiée.';
    end if;
    if old.status = 'disputed' then
      new.status := 'pending';
      new.dispute_comment := null;
      v_auto_reset := true;
    end if;
  end if;

  -- Changement de statut (confirmation / contestation), en excluant la
  -- réinitialisation automatique ci-dessus qui n'est pas une action manuelle
  -- de confirmation/contestation et ne doit donc pas être soumise aux mêmes
  -- règles (auteur/rôle).
  if new.status <> old.status and not v_auto_reset then
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

-- Le créateur (invité) doit pouvoir retirer sa transaction si elle a été
-- contestée par l'autre partie, pas seulement tant qu'elle est en attente.
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
    and t.status in ('pending', 'disputed')
    and t.created_by = 'counterparty';
end;
$$;
