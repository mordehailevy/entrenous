# Livrable — Améliorations UX, notifications et export

Objectif : liste des 9 améliorations identifiées lors de la revue de code du
17/07/2026, à traiter une par une jusqu'à ce que tout soit fait, testé en
local (E2E jetable, cf. `testing_approach.md`) et déployé en production.

Statut global : **EN COURS**

## 1. Confirmation visuelle après une action sur une transaction
- [x] Après `handleConfirm` / `handleDispute` (`src/pages/LedgerDetailPage.tsx`
      et `src/pages/GuestLedgerPage.tsx`), afficher un petit message de succès
      ("✅ Transaction confirmée." / "Contestation envoyée.") qui disparaît
      automatiquement après 2-3 secondes.
- [x] Vérifier que ça ne casse pas l'affichage de `actionError` existant (les
      deux ne doivent pas se chevaucher visuellement).

## 2. Délai d'affichage de "Lien copié !" trop court
- [x] `src/components/ShareLinkButton.tsx` : passer le `setTimeout` de 2000ms
      à 3000ms.

## 3. Recherche du tableau de bord insensible aux accents
- [x] `src/pages/DashboardPage.tsx` : normaliser `search` et `ledgerLabel(...)`
      en supprimant les accents avant comparaison (ex :
      `.normalize('NFD').replace(/[̀-ͯ]/g, '')`) en plus du
      `.toLocaleLowerCase()` déjà en place, pour que "deborah" trouve "Déborah".

## 4. Zones de clic trop petites sur mobile (Modifier / Supprimer)
- [x] `src/components/TransactionList.tsx` : agrandir la zone cliquable des
      boutons "Modifier" / "Supprimer" (padding, `min-height`/`min-width`
      ~44-48px) sans casser la mise en page desktop existante.

## 5. Fermer la modale "Nouveau compte" avec Échap
- [x] `src/components/NewLedgerModal.tsx` : ajouter une écoute clavier
      (`Escape` → `onClose()`), en plus du clic sur le fond ou "Annuler" déjà
      existants.

## 6. Notifications email sur les événements clés
- [x] Déclencheurs retenus (confirmé par l'utilisateur) : "une transaction est
      ajoutée par l'autre partie" ET "une transaction est contestée".
- [x] Design technique : Edge Function `supabase/functions/notify-transaction-event`
      appelée directement depuis le frontend (`src/utils/notify.ts`, best-effort,
      ne bloque jamais l'UI) juste après l'insert/dispute réussi. Elle recalcule
      elle-même le destinataire côté serveur (jamais fourni par le client) et
      envoie l'email via Resend (`RESEND_API_KEY`, à configurer en prod).
- [x] Respecter la vie privée : l'email ne contient aucune donnée sensible
      (pas de montant, pas de note), seulement "vous avez une nouvelle
      transaction / contestation, connectez-vous pour voir". Les comptes
      privés (`is_private`) sont explicitement exclus (`skipped: private_ledger`).
- [x] Migration SQL : `supabase/migrations/0006_service_role_grants.sql` — pas
      liée directement à la fonctionnalité mais nécessaire pour qu'elle
      fonctionne (voir bug ci-dessous).
- [x] Testé en local : suite de tests HTTP directs contre l'Edge Function
      (accès autorisé/refusé, ledger privé, transaction inconnue, invité via
      lien de partage) + test UI Playwright bout-en-bout (ajout d'une
      transaction déclenche bien l'appel, sans erreur console ni blocage). Pas
      de vrai envoi testé localement (pas de clé Resend en local, la fonction
      le détecte et logue au lieu d'échouer) — à vérifier en production après
      déploiement (voir instructions fournies par l'assistant).
- [x] **Bug découvert et corrigé pendant les tests** : le rôle `service_role`
      (utilisé par les Edge Functions) n'avait aucun privilège SQL sur
      `profiles`/`ledgers`/`transactions` (seuls `anon`/`authenticated`
      avaient été couverts par les migrations précédentes) → toute lecture
      via la clé de service échouait avec "permission denied for table".
      Corrigé par `0006_service_role_grants.sql`. **Cette migration doit être
      appliquée en production, sinon la fonction ne marchera pas du tout.**

## 7. Recherche dans les notes des transactions
- [x] `src/components/TransactionList.tsx` : ajouter un champ de recherche
      texte (visible dès que `transactions.length > 1`, comme les filtres
      existants) qui filtre sur `tx.note` (insensible à la casse/accents,
      même normalisation que le point 3).

## 8. Export CSV / PDF de l'historique d'un compte
- [x] Choisir le format prioritaire (CSV d'abord, plus simple, pas de
      dépendance lourde) : bouton "Exporter en CSV" sur
      `src/pages/LedgerDetailPage.tsx` (et éventuellement
      `GuestLedgerPage.tsx`), générant un fichier côté client (colonnes :
      date, montant, sens, type, statut, note) sans dépendance externe
      (`Blob` + lien de téléchargement).
- [ ] PDF : à discuter séparément si demandé (nécessite une dépendance comme
      `jspdf`, impact sur la taille du bundle déjà signalée par Vite à
      828 kB).

## 9. Tri des transactions (au-delà de la date)
- [x] `src/components/TransactionList.tsx` : ajouter un sélecteur de tri
      ("Plus récent", "Plus ancien", "Montant décroissant", "Montant
      croissant") à côté des filtres statut/type existants.

## Tests de bout en bout (à chaque étape, cf. testing-approach)
- [ ] Script Playwright jetable pour chaque fonctionnalité livrée, supprimé
      après usage, `npx supabase db reset` après les tests locaux.
- [ ] Build (`npm run build`) et `tsc --noEmit` propres avant chaque commit.

## Mise en production
- [ ] `git commit` + `git push` par lot cohérent (pas forcément un commit par
      point ci-dessus, regrouper si logique).
- [ ] Si migration SQL nécessaire (point 6) : fournir le SQL exact à coller
      dans le SQL Editor de Supabase Cloud, comme pour les migrations
      précédentes (pas d'accès direct à supabase.com).
- [ ] Vérification finale en production (`entrenous.dev`) une fois chaque lot
      déployé.

**Rien n'est encore livré pour ce plan — à cocher au fur et à mesure.**
