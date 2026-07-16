# EntreNous

Application web de suivi de dettes et virements entre deux personnes, avec **double confirmation** des transactions.

Chaque utilisateur inscrit (owner) crée un « compte » par personne avec qui il a des dettes/virements, et partage un lien unique. L'autre partie (invité, sans compte) consulte l'historique et confirme ou conteste les transactions depuis ce lien.

## Stack technique

- **Frontend** : React 18 + Vite + TypeScript + Tailwind CSS v4
- **Backend / BDD** : Supabase (Postgres + Auth + Row Level Security)
- **Graphiques** : Recharts
- **Déploiement** : Vercel

## 1. Créer le projet Supabase

1. Créez un compte sur [supabase.com](https://supabase.com) et un nouveau projet.
2. Ouvrez l'éditeur SQL (`SQL Editor`) et exécutez le contenu de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). Cette migration crée :
   - la table `profiles` (créée automatiquement à l'inscription via un trigger),
   - la table `ledgers` (comptes partagés ou notes privées),
   - la table `transactions`,
   - toutes les policies RLS nécessaires (isolation stricte par owner, accès invité limité au ledger via `share_token`).
3. Dans **Project Settings → API**, récupérez :
   - `Project URL`
   - `anon public key`
4. Dans **Authentication → Providers**, vérifiez que l'authentification par email/mot de passe est activée. Vous pouvez désactiver la confirmation par email pour les tests (Authentication → Settings → « Confirm email »).

## 2. Configuration locale

```bash
npm install
cp .env.example .env
```

Remplissez `.env` avec les valeurs récupérées à l'étape précédente :

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Puis lancez le serveur de développement :

```bash
npm run dev
```

L'application est disponible sur `http://localhost:5173`.

### Alternative : tester sans compte Supabase cloud (CLI + Docker)

Si vous avez Docker installé, vous pouvez faire tourner Supabase entièrement en local, sans créer de projet cloud :

```bash
npx supabase start   # démarre Postgres + Auth + API en local (applique les migrations automatiquement)
```

La commande affiche une `API_URL` (`http://127.0.0.1:54321`) et une `ANON_KEY` à mettre dans `.env`. La confirmation d'email est désactivée par défaut en local (`supabase/config.toml`), donc l'inscription fonctionne immédiatement. Pour réinitialiser les données : `npx supabase db reset`. Pour arrêter : `npx supabase stop`.

## 3. Utilisation

1. **Inscrivez-vous** (prénom, email, mot de passe) — vous devenez owner de vos propres comptes.
2. Depuis le **tableau de bord**, créez un compte : nom de la personne, devise (₪ ou €), partagé ou privé.
3. Sur un compte partagé, cliquez sur **« Copier le lien de partage »** et envoyez-le (WhatsApp, SMS...) à la personne concernée.
4. La personne ouvre le lien `/l/:token` **sans créer de compte**, indique son prénom une fois (stocké en local sur son appareil), et peut consulter le solde, ajouter des transactions, confirmer ou contester celles créées par l'autre partie.
5. Une transaction n'est comptée dans le **solde validé** qu'une fois **confirmée par l'autre partie**. Le solde en attente est affiché séparément.
6. Les comptes marqués **privés** sont des notes personnelles : les transactions sont automatiquement confirmées, sans lien de partage.

## 4. Déploiement sur Vercel

1. Poussez le projet sur un dépôt GitHub.
2. Sur [vercel.com](https://vercel.com), cliquez sur **Add New → Project** et importez le dépôt.
3. Dans les paramètres du projet, ajoutez les variables d'environnement :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Déployez. Le fichier `vercel.json` fourni configure le rewrite SPA nécessaire pour que les routes comme `/l/:token` et `/comptes/:id` fonctionnent après un rafraîchissement de page.

## 5. Installation en PWA (écran d'accueil)

L'application inclut un `manifest.json` (nom, icônes, couleur de thème, mode `standalone`). Sur iPhone (Safari) ou Android (Chrome), utilisez « Partager → Sur l'écran d'accueil » / « Ajouter à l'écran d'accueil » depuis le lien déployé pour l'installer comme une app native.

## Structure du projet

```
src/
  components/     composants UI réutilisables (boutons, cartes, formulaires, graphique...)
  context/        AuthContext (session Supabase, profil utilisateur)
  lib/            client Supabase
  pages/          écrans : Login, Signup, Dashboard, LedgerDetail, GuestLedger, NotFound
  types/          types TypeScript partagés (Ledger, Transaction...)
  utils/          calcul des soldes (validé / en attente), formatage montants et dates
supabase/
  migrations/     schéma SQL (tables + RLS)
public/
  manifest.json, icons/   PWA
```

## Modèle de données (résumé)

- **`ledgers`** : `owner_id`, `owner_display_name`, `counterparty_name`, `share_token` (unique), `currency`, `is_private`.
- **`transactions`** : `ledger_id`, `amount` (> 0), `direction` (`owner_to_counterparty` / `counterparty_to_owner`), `kind` (`virement` / `dette` / `remboursement` / `ajustement`), `created_by` (`owner` / `counterparty`), `status` (`pending` / `confirmed` / `disputed`), `dispute_comment`, `confirmed_at`.

Règle clé : une transaction créée par une partie doit être confirmée par l'**autre** partie (jamais par soi-même) pour compter dans le solde validé.

## Sécurité (RLS)

- Un owner n'a accès (lecture/écriture) qu'à **ses propres** ledgers et transactions (`owner_id = auth.uid()`).
- Un invité anonyme n'a accès qu'aux ledgers **non privés**, via une requête filtrée par `share_token` (valeur secrète connue uniquement du lien partagé) ; il peut créer des transactions (`created_by = 'counterparty'`) et modifier leur statut, mais n'a jamais accès aux autres comptes.
