# EntreNous — Suivi de dettes & virements confirmés à deux

## Livrable pour Claude Code (VS Code)

---

## 1. Vision du projet

Application web **multi-utilisateurs** : chaque personne inscrite peut :

1. **Tenir des comptes partagés** avec d'autres personnes (dettes, remboursements, virements).
2. **Partager un lien unique** par personne : l'autre partie voit l'historique et le solde, **sans créer de compte**.
3. **Double confirmation** : chaque transaction saisie par une partie doit être **confirmée par l'autre** pour être comptée dans le "solde validé". Tant qu'elle n'est pas confirmée, elle apparaît "en attente".
4. **Notes privées** : un espace perso (non partagé) pour noter "je dois X à untel / untel me doit Y".

---

## 2. Stack technique (identique à MaasserFlow)

- **Frontend** : React 18 + Vite + TypeScript + Tailwind CSS
- **Backend / BDD** : Supabase (Postgres + Auth + Row Level Security)
- **Graphiques** : Recharts (évolution du solde)
- **Déploiement** : Vercel (gratuit) + GitHub
- **Auth** : Supabase Auth (email/mot de passe), **inscription ouverte à tous** — chaque utilisateur devient owner de ses propres comptes. Les invités accèdent via **lien à token secret**, sans compte, avec invitation à s'inscrire ensuite.

---

## 3. Modèle de données (Supabase)

### Table `ledgers` (comptes partagés)
| colonne | type | description |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid FK auth.users | l'utilisateur créateur du compte |
| owner_display_name | text | prénom affiché aux invités |
| counterparty_name | text | "Mendel", "Annah"... |
| share_token | text unique | token aléatoire 32 chars pour le lien public |
| currency | text default 'ILS' | ILS / EUR |
| is_private | boolean default false | true = note perso, pas de partage ni confirmation |
| created_at | timestamptz | |

### Table `transactions`
| colonne | type | description |
|---|---|---|
| id | uuid PK | |
| ledger_id | uuid FK ledgers | |
| amount | numeric | toujours positif |
| direction | text | 'owner_to_counterparty' ou 'counterparty_to_owner' |
| kind | text | 'virement', 'dette', 'remboursement', 'ajustement' |
| note | text | description libre |
| created_by | text | 'owner' ou 'counterparty' |
| status | text | 'pending' / 'confirmed' / 'disputed' |
| confirmed_at | timestamptz nullable | |
| created_at | timestamptz | |

### Règles métier
- **Solde validé** = somme des transactions `confirmed` uniquement (signe selon `direction`).
- **Solde en attente** affiché séparément ("+250 ₪ en attente de confirmation").
- Une transaction créée par l'owner doit être confirmée par le counterparty, et inversement. **On ne peut pas confirmer sa propre transaction.**
- `disputed` : bouton "Contester" avec commentaire → l'owner voit une alerte.
- Ledger `is_private = true` : les transactions sont auto-`confirmed`, pas de share_token affiché.

### Sécurité (RLS)
- Owner : accès complet à ses ledgers via auth.
- Invité : accès en lecture + création/confirmation de transactions **uniquement** via une Edge Function ou des policies basées sur le `share_token` passé dans l'URL (`/l/:share_token`). Jamais d'accès aux autres ledgers.

---

## 4. Écrans

### A. Dashboard (Mordehai, connecté)
- Liste des comptes : nom, solde validé (vert si on me doit, rouge si je dois), badge "X en attente".
- Section séparée "Mes notes privées".
- Bouton "+ Nouveau compte" (nom, devise, privé ou partagé).
- Total global : "On me doit X / Je dois Y".

### B. Détail d'un compte (owner)
- Solde validé en grand + solde incluant le pending.
- Bouton "Copier le lien de partage" (`https://app.vercel.app/l/{share_token}`).
- Formulaire ajout transaction : montant, sens ("J'ai envoyé" / "J'ai reçu"), type, note, date.
- Historique chronologique avec statut : ✅ confirmé / ⏳ en attente / ⚠️ contesté.
- Bouton "Confirmer" sur les transactions créées par l'autre partie.
- Mini-graphique Recharts de l'évolution du solde validé.

### C. Vue invité (`/l/:share_token`, sans compte)
- "Compte entre vous et {owner_display_name}" — solde du point de vue de l'invité ("Vous devez X" / "{Prénom} vous doit X").
- Bannière discrète : "Créez votre compte gratuit pour gérer vos propres dettes et envoyer vos liens" → page d'inscription.
- Historique complet.
- Boutons **Confirmer** / **Contester** sur les transactions en attente créées par Mordehai.
- Formulaire pour ajouter une transaction (ex: "J'ai fait un virement de 300 ₪") → arrive en `pending` chez Mordehai.
- L'invité renseigne son prénom la première fois (stocké en localStorage pour l'affichage).

### D. Notes privées
- Même écran que B mais sans lien de partage ni statuts : ajout instantané, solde direct.

---

## 5. Design

- Style épuré type Linear/Stripe : fond ivoire `#FAF8F5`, accent violet→bleu (identité MordehAI), police Inter.
- Vert `#16A34A` pour créances, rouge `#DC2626` pour dettes, ambre pour "en attente".
- Mobile-first (les invités ouvriront le lien sur téléphone via WhatsApp).
- Interface 100 % en français.

---

## 6. Plan de build (ordre pour Claude Code)

1. Init Vite + React + TS + Tailwind, structure de dossiers.
2. Setup client Supabase, schéma SQL (tables + RLS) dans `supabase/migrations/`.
3. Auth Mordehai (login simple).
4. CRUD ledgers + dashboard.
5. Transactions + logique de solde (validé vs pending).
6. Page invité `/l/:token` + confirmation/contestation.
7. Notes privées.
8. Graphique Recharts + polish UI.
9. Déploiement Vercel + variables d'environnement.

---

## 7. PROMPT À COLLER DANS CLAUDE CODE

```
Crée une application web complète nommée "EntreNous" : suivi de dettes et virements avec confirmation mutuelle.

STACK : React 18 + Vite + TypeScript + Tailwind CSS + Supabase (Postgres, Auth, RLS) + Recharts. Interface entièrement en français, mobile-first.

CONCEPT :
- Application MULTI-UTILISATEURS : inscription ouverte (email/mot de passe + prénom affiché). Chaque utilisateur connecté (owner) crée des "comptes" (ledgers), un par personne avec qui il a des dettes/virements, et partage ses propres liens.
- Chaque ledger partagé a un share_token unique donnant accès à une page publique /l/:token où l'autre personne (sans compte) voit l'historique et le solde de son point de vue. La page invité affiche le prénom de l'owner et une bannière "Créez votre compte gratuit" menant à l'inscription.
- Chaque transaction (montant, sens owner→counterparty ou inverse, type : virement/dette/remboursement/ajustement, note, date) est créée par l'une des deux parties avec status "pending". L'AUTRE partie doit la confirmer (status "confirmed") ou la contester (status "disputed" + commentaire). On ne peut jamais confirmer sa propre transaction.
- Le "solde validé" ne compte que les transactions confirmed ; le pending est affiché séparément.
- Ledgers privés (is_private=true) : notes perso de l'owner, transactions auto-confirmées, pas de partage.

ÉCRANS :
1. Login / Inscription (email, mot de passe, prénom affiché).
2. Dashboard : liste des comptes avec soldes (vert = on me doit, rouge = je dois), badges pending, section notes privées, totaux globaux, création de compte.
3. Détail compte (owner) : solde validé + pending, bouton copier le lien de partage, formulaire d'ajout, historique avec statuts (✅/⏳/⚠️), boutons confirmer/contester sur les transactions de l'autre, graphique Recharts de l'évolution du solde.
4. Page invité /l/:token : solde de son point de vue ("Vous devez X ₪" / "Mordehai vous doit X ₪"), historique, confirmer/contester, ajouter une transaction (arrive en pending). Prénom demandé une fois, stocké en localStorage.

SCHÉMA SUPABASE (fournis les migrations SQL) :
- profiles(id uuid FK auth.users, display_name text) — créé automatiquement à l'inscription (trigger).
- ledgers(id uuid, owner_id uuid, counterparty_name text, share_token text unique, currency text default 'ILS', is_private bool, created_at)
- transactions(id uuid, ledger_id uuid, amount numeric>0, direction text, kind text, note text, created_by text 'owner'|'counterparty', status text 'pending'|'confirmed'|'disputed', dispute_comment text, confirmed_at, created_at)
RLS : chaque owner n'accède qu'à SES ledgers (owner_id = auth.uid()) — isolation stricte entre utilisateurs ; accès invité limité au ledger correspondant au share_token (lecture + insert + update de status uniquement), jamais aux autres ledgers.

PWA : ajoute un manifest.json (nom "EntreNous", icônes 192/512, theme color, display standalone) pour installation sur écran d'accueil iPhone/Android.

DESIGN : fond ivoire #FAF8F5, accent dégradé violet→bleu, police Inter, vert #16A34A / rouge #DC2626 / ambre pour pending, cartes arrondies, style épuré type Linear.

Livre : structure complète du projet, migrations SQL, .env.example, README en français avec les étapes de setup Supabase et déploiement Vercel.
```

---

## 8. Étapes après le build

1. Créer le projet Supabase → exécuter les migrations SQL.
2. Copier URL + anon key dans `.env`.
3. `npm run dev` pour tester en local.
4. Push GitHub → importer dans Vercel → ajouter les variables d'env → déployer.
5. Tester le lien de partage sur ton téléphone via WhatsApp.
