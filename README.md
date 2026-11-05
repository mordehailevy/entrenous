# EntreNous

**Live demo:** [entrenous.dev](https://entrenous.dev)

A web app to track money owed between two people, where **every transaction must be confirmed by the other side** before it counts. Both people always agree on the same balance.

The interface is in French ("entre nous" means "between us").

## How it works

1. A user signs up and creates a **ledger** for each person they share expenses or loans with (currency ₪ or €, shared or private).
2. They send that person a **share link**. The other person opens it **without creating an account**.
3. Either side can add a transaction (transfer, debt, repayment, adjustment).
4. A transaction only counts in the **confirmed balance** once the **other** party confirms it. They can also dispute it with a comment. Pending amounts are shown separately.
5. **Private ledgers** work as personal notes: transactions are confirmed automatically, with no share link.

The app is installable as a **PWA** on iPhone and Android.

## Tech stack

React 18 · TypeScript · Vite · Tailwind CSS v4 · Supabase (Postgres, Auth, Row Level Security) · Recharts · Vercel

## Security model (Row Level Security)

- An owner can only read and write **their own** ledgers and transactions (`owner_id = auth.uid()`).
- An anonymous guest can only reach a **non-private** ledger through its secret `share_token`. They can add transactions as the counterparty and confirm or dispute the owner's, but never see any other ledger.
- A transaction can never be confirmed by the party who created it.

## Data model

- **`ledgers`**: `owner_id`, `owner_display_name`, `counterparty_name`, `share_token` (unique), `currency`, `is_private`
- **`transactions`**: `ledger_id`, `amount` (> 0), `direction`, `kind` (transfer / debt / repayment / adjustment), `created_by` (`owner` / `counterparty`), `status` (`pending` / `confirmed` / `disputed`), `dispute_comment`, `confirmed_at`

## Getting started

### 1. Create the Supabase project

1. Create a project on [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). It creates the `profiles`, `ledgers` and `transactions` tables and all RLS policies.
3. In **Project Settings → API**, copy the `Project URL` and the `anon public key`.
4. In **Authentication → Providers**, make sure email/password sign-in is enabled.

### 2. Run locally

```bash
git clone https://github.com/mordehailevy/entrenous.git
cd entrenous
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5173
```

**Without a cloud project:** with Docker installed, `npx supabase start` runs Postgres, Auth and the API locally and applies the migrations. It prints an `API_URL` and an `ANON_KEY` to put in `.env`.

### 3. Deploy on Vercel

Import the repository on Vercel and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables. The included `vercel.json` handles the SPA rewrites for routes like `/l/:token`.

## Project structure

```
src/
  components/   Reusable UI (buttons, cards, forms, charts)
  context/      AuthContext (Supabase session, user profile)
  lib/          Supabase client
  pages/        Login, Signup, Dashboard, LedgerDetail, GuestLedger, NotFound
  types/        Shared TypeScript types
  utils/        Balance calculation (confirmed / pending), formatting
supabase/
  migrations/   SQL schema (tables + RLS)
public/         PWA manifest and icons
```

**Author:** [Mordehai Levy](https://github.com/mordehailevy) · [LinkedIn](https://www.linkedin.com/in/mordehailevy)
