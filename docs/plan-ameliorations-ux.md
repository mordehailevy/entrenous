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
- [ ] Décider du déclencheur minimal viable : au moins "une transaction est
      ajoutée par l'autre partie" et "une transaction est contestée".
- [ ] Design technique : Supabase Edge Function déclenchée par un trigger DB
      (ou appelée directement depuis le frontend juste après l'insert/update
      réussi), envoyant un email via Resend (déjà configuré pour les emails
      d'auth, cf. `deployment_status.md`).
- [ ] Respecter la vie privée : l'email ne doit pas fuiter d'informations
      sensibles au-delà de ce que l'app affiche déjà à cette personne.
- [ ] Migration SQL si besoin (nouvelle fonction/trigger), à ajouter en
      `supabase/migrations/0006_...sql`.
- [ ] Tester en local avec Mailpit (inbox de test locale), puis en production
      une fois le SQL appliqué manuellement par l'utilisateur (comme pour les
      migrations précédentes).

## 7. Recherche dans les notes des transactions
- [ ] `src/components/TransactionList.tsx` : ajouter un champ de recherche
      texte (visible dès que `transactions.length > 1`, comme les filtres
      existants) qui filtre sur `tx.note` (insensible à la casse/accents,
      même normalisation que le point 3).

## 8. Export CSV / PDF de l'historique d'un compte
- [ ] Choisir le format prioritaire (CSV d'abord, plus simple, pas de
      dépendance lourde) : bouton "Exporter en CSV" sur
      `src/pages/LedgerDetailPage.tsx` (et éventuellement
      `GuestLedgerPage.tsx`), générant un fichier côté client (colonnes :
      date, montant, sens, type, statut, note) sans dépendance externe
      (`Blob` + lien de téléchargement).
- [ ] PDF : à discuter séparément si demandé (nécessite une dépendance comme
      `jspdf`, impact sur la taille du bundle déjà signalée par Vite à
      828 kB).

## 9. Tri des transactions (au-delà de la date)
- [ ] `src/components/TransactionList.tsx` : ajouter un sélecteur de tri
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
