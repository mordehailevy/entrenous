# Livrable — Lier le compte de l'invité au ledger partagé

Objectif : quand quelqu'un reçoit un lien de partage et crée/utilise un vrai compte, le
compte partagé (ledger) doit apparaître dans **son propre tableau de bord**, avec le bon
solde de son point de vue. Le mode "invité anonyme, sans inscription" reste disponible en
option, il n'est pas supprimé.

Statut global : **LIVRÉ ET VÉRIFIÉ EN LOCAL — reste à appliquer en production (voir note en bas)**

## 1. Base de données (migration `0004_counterparty_account_link.sql`)
- [x] Ajouter colonne `ledgers.counterparty_id uuid null references auth.users(id) on delete set null`
- [x] Index sur `counterparty_id`
- [x] Nouvelle policy RLS `ledgers_counterparty_select` (authenticated, `counterparty_id = auth.uid()`)
- [x] Nouvelles policies RLS `transactions_counterparty_select/insert/update/delete` (authenticated,
      via jointure sur `ledgers.counterparty_id = auth.uid()`, `created_by = 'counterparty'` pour l'insert)
- [x] Fonction RPC `claim_ledger_as_counterparty(p_token text)` (security definer) :
      trouve le ledger par token, refuse si privé, refuse si `owner_id = auth.uid()`,
      refuse si `counterparty_id` déjà pris par quelqu'un d'autre, sinon fixe
      `counterparty_id = auth.uid()` et renvoie le ledger.
- [x] Migration appliquée en local (`npx supabase db reset` en dev). **Pas encore appliquée en
      production** — reste à fournir en copier-coller pour le SQL Editor de Supabase Cloud
      (pas d'access token CLI pour la pousser directement).

## 2. Types
- [x] `src/types/index.ts` : ajouté `counterparty_id: string | null` sur `Ledger`

## 3. Page invité (`src/pages/GuestLedgerPage.tsx`)
- [x] Avant le formulaire "prénom", affiche en premier deux boutons clairs
      "Se connecter" / "Créer un compte" (en plus de l'option existante
      "continuer sans compte" qui reste disponible mais secondaire)
- [x] Conserve le token à travers la redirection auth (query param `?next=/l/<token>`
      vers `/connexion` et `/inscription` — le vrai préfixe de route est `/l/`, pas `/lien/`)
- [x] Si l'utilisateur est authentifié sur cette page et n'est pas le propriétaire :
      affiche un bouton "Associer ce compte à ce suivi" appelant la RPC
      `claim_ledger_as_counterparty`, puis redirection vers `/comptes/{ledger.id}`

## 4. Connexion / Inscription (`src/pages/LoginPage.tsx`, `src/pages/SignupPage.tsx`)
- [x] Après succès, si un paramètre `next` est présent, redirige vers cette URL au lieu
      du tableau de bord par défaut

## 5. Tableau de bord (`src/pages/DashboardPage.tsx`)
- [x] La requête `ledgers.select('*')` remonte aussi les ledgers où
      `counterparty_id = auth.uid()` (géré par la nouvelle policy RLS) — vérifié en E2E
- [x] Détermine le rôle du viewer par ledger (`owner` si `owner_id === user.id`, sinon
      `counterparty`) et adapte :
  - le calcul de solde (`computeOwnerBalance` vs `computeGuestBalance` pour un viewer
    counterparty)
  - le nom affiché sur la carte (nom du propriétaire si on est counterparty, au lieu de
    `counterparty_name`)

## 6. Détail d'un compte (`src/pages/LedgerDetailPage.tsx`)
- [x] Adapté pour fonctionner correctement quand le viewer est le counterparty
      (déjà un vrai compte, plus un invité anonyme) : bon sens des soldes, bons labels,
      permissions d'édition/suppression cohérentes avec les règles existantes
      (au passage : correction d'un bug préexistant, `ownerLabel` utilisait le profil du
      viewer courant au lieu du nom réel du propriétaire stocké sur le ledger)

## 7. Tests de bout en bout (Playwright, jetable, cf. testing-approach)
- [x] Deux comptes réels de test : A crée un ledger partagé, B ouvre le lien
- [x] B crée un compte depuis le lien → le ledger apparaît bien dans le tableau de bord de B
      (et dans sa page de détail, avec le bon nom du propriétaire affiché)
- [x] Solde affiché chez B est l'inverse exact du solde affiché chez A (vérifié via
      `computeGuestBalance`/sens des transactions, transaction de test confirmée en DB)
- [x] Un ledger déjà "claim" par B ne peut pas être détourné par un troisième compte C
      (RPC renvoie une erreur 400, C n'est pas redirigé vers `/comptes/...`)
- [x] Un ledger privé ne peut pas être "claim" du tout (vérifié par lecture du code de la
      RPC : `where share_token = p_token and is_private = false`)
- [x] Le mode "continuer sans compte" (invité anonyme classique) fonctionne toujours sans
      régression
- [x] Nettoyage : `npx supabase db reset` après les tests locaux ; script Playwright jetable
      et la dépendance `playwright` supprimés du repo après usage. **Un compte de test a été
      créé par erreur en production avant que le bug de `.env` (pointait vers le cloud au
      lieu du local) ne soit détecté et corrigé — l'utilisateur a été prévenu et doit
      supprimer `owner-e2e-...@icloud.com` depuis le dashboard Supabase Cloud si ce n'est
      pas déjà fait.**

## 8. Documentation / mémoire
- [x] Mettre à jour `project_status.md` une fois livré et vérifié (fait dans cette session)

## Note — reste à faire pour une mise en production complète
Le code frontend et la migration DB sont vérifiés en local uniquement. Pour que la
fonctionnalité soit active sur `https://entrenous.dev`, il reste :
1. Appliquer `supabase/migrations/0004_counterparty_account_link.sql` sur le projet
   Supabase Cloud (copier-coller dans le SQL Editor, l'assistant n'y a pas d'accès direct).
2. `git push` des changements frontend + déploiement Vercel (automatique si le repo est
   connecté, sinon déclenchement manuel).
