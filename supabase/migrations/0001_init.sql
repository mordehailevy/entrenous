-- EntreNous — schéma initial : profils, ledgers, transactions, RLS

create extension if not exists "pgcrypto";

-- ============================================================
-- profiles
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ledgers
-- ============================================================
create table if not exists public.ledgers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_display_name text not null,
  counterparty_name text not null,
  share_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  currency text not null default 'ILS' check (currency in ('ILS', 'EUR')),
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.ledgers enable row level security;

create index if not exists ledgers_owner_id_idx on public.ledgers (owner_id);
create index if not exists ledgers_share_token_idx on public.ledgers (share_token);

-- Owner : accès complet à ses propres ledgers
create policy "ledgers_owner_select"
  on public.ledgers for select
  using (auth.uid() = owner_id);

create policy "ledgers_owner_insert"
  on public.ledgers for insert
  with check (auth.uid() = owner_id);

create policy "ledgers_owner_update"
  on public.ledgers for update
  using (auth.uid() = owner_id);

create policy "ledgers_owner_delete"
  on public.ledgers for delete
  using (auth.uid() = owner_id);

-- Invité anonyme : lecture seule d'un ledger partagé (le filtrage par token
-- se fait côté client via .eq('share_token', token) ; RLS autorise la lecture
-- de tout ledger non privé pour permettre cette recherche par token unique).
create policy "ledgers_guest_select_by_token"
  on public.ledgers for select
  to anon
  using (is_private = false);

-- ============================================================
-- transactions
-- ============================================================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers (id) on delete cascade,
  amount numeric not null check (amount > 0),
  direction text not null check (direction in ('owner_to_counterparty', 'counterparty_to_owner')),
  kind text not null check (kind in ('virement', 'dette', 'remboursement', 'ajustement')),
  note text,
  created_by text not null check (created_by in ('owner', 'counterparty')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'disputed')),
  dispute_comment text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create index if not exists transactions_ledger_id_idx on public.transactions (ledger_id);

-- Owner : accès complet aux transactions de ses ledgers
create policy "transactions_owner_select"
  on public.transactions for select
  using (exists (select 1 from public.ledgers l where l.id = ledger_id and l.owner_id = auth.uid()));

create policy "transactions_owner_insert"
  on public.transactions for insert
  with check (exists (select 1 from public.ledgers l where l.id = ledger_id and l.owner_id = auth.uid()));

create policy "transactions_owner_update"
  on public.transactions for update
  using (exists (select 1 from public.ledgers l where l.id = ledger_id and l.owner_id = auth.uid()));

create policy "transactions_owner_delete"
  on public.transactions for delete
  using (exists (select 1 from public.ledgers l where l.id = ledger_id and l.owner_id = auth.uid()));

-- Invité anonyme : lecture, création et mise à jour de statut sur les
-- transactions d'un ledger partagé (non privé). L'isolation entre comptes
-- repose sur le caractère secret du share_token, connu uniquement du lien.
create policy "transactions_guest_select"
  on public.transactions for select
  to anon
  using (exists (select 1 from public.ledgers l where l.id = ledger_id and l.is_private = false));

create policy "transactions_guest_insert"
  on public.transactions for insert
  to anon
  with check (
    created_by = 'counterparty'
    and exists (select 1 from public.ledgers l where l.id = ledger_id and l.is_private = false)
  );

create policy "transactions_guest_update"
  on public.transactions for update
  to anon
  using (exists (select 1 from public.ledgers l where l.id = ledger_id and l.is_private = false));

create policy "transactions_guest_delete"
  on public.transactions for delete
  to anon
  using (exists (select 1 from public.ledgers l where l.id = ledger_id and l.is_private = false));

-- ============================================================
-- Privilèges de table (Postgres GRANT)
-- RLS restreint les LIGNES visibles/modifiables, mais Postgres exige en plus
-- que le rôle ait le droit d'accéder à la table elle-même. Sans ces GRANT,
-- authenticated/anon reçoivent "permission denied for table" même quand une
-- policy RLS les autoriserait.
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;

grant select, insert, update, delete on public.ledgers to authenticated;
grant select on public.ledgers to anon;

grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.transactions to anon;
