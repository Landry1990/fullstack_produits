# 🚀 Feuille de Route - Fullstack Produits (Pharmacie)

Ce document suit les évolutions, les optimisations et les corrections à apporter au projet.

## 🔴 PRIORITÉ 1 : Stabilité & Fiabilité (Urgent)
- [/] **Audit des calculs financiers** : (En cours) Effectué sur `dashboard.py` et `finance_stats.py`. Reste à vérifier les services de vente.
- [/] **Optimisation SQL (N+1)** : (En cours) Effectué sur Factures, Communication et Ruptures.
- [ ] **Gestion des erreurs frontend** : Implémenter des Skeletons de chargement pour les tableaux lourds.
- [x] **Validation des formulaires** : `Zod` intégré pour la création client en facturation et la configuration Stock Health (pondérations).

## 🟡 PRIORITÉ 2 : Performance & Expérience (Moyen terme)
- [x] **Lazy Loading** : Bundle initial allégé via `React.lazy()` sur toutes les pages secondaires.
- [x] **État Global (Zustand)** : Migration de `useCommandesState` et `useAvoirsData` vers des stores globaux (`useCommandesStore`, `useAvoirsStore`).
- [ ] **Raccourcis Clavier** : Créer un hook global pour gérer les raccourcis (F1, F2, etc.) en caisse et facturation.
- [ ] **Recherche Avancée** : Améliorer l'Omnisearch pour inclure les clients et les factures directement.

## 🟢 PRIORITÉ 3 : Maintenance & Futur (Long terme)
- [ ] **Tests d'intégration** : Écrire des tests critiques pour le flux de vente (Cypress ou Playwright).
- [ ] **Système de Notification (Sentry)** : Connecter un service de monitoring d'erreurs.
- [ ] **Documentation API** : Générer une doc Swagger/OpenAPI propre pour le backend.
- [/] **Support Mobile** : Optimiser les vues de rapports pour une consultation sur tablette/smartphone.
  - (En cours) `CentreRapports` : menu mobile (drawer) + actions empilées sur petit écran.
  - (En cours) `RapportMensuel` + `Rapport UG` : padding responsive + CTA moins "large écran only".
  - (En cours) `CentreRapports` (filtres) : champs en colonne + pleine largeur sur mobile.
  - (En cours) `CentreRapports` (résultats) : pagination + boutons full-width sur mobile.
  - (En cours) `Dashboard` : onglets scrollables (évite le débordement horizontal) + padding mobile.
  - (En cours) `HistoriqueVentes` + `HistoriqueAchats` + `StatistiquesFournisseur` : headers/filtres/pagination moins "desktop-only" sur mobile.
  - (En cours) `HistoriqueClotures` : padding + en-têtes (ex. performance) + zone tableau moins serrée sur petit écran.
  - (En cours) `JournalAjustements` : hauteur de page allégée sur mobile + actions filtres en pleine largeur (touch).
  - (En cours) `JournalAudit` : barre d’actions + toggle vue + défilement horizontal du mode tableau.
  - (En cours) `JournalCaisse` : déjà en grande partie responsive (cartes mobile + table desktop) — revue finale des filtres dates si besoin.
  - (En cours) `StockAnalysis` : onglets scrollables (évite le débordement horizontal) + hauteur de contenu moins "600px imposé" sur mobile.
  - (Reste) Autres vues denses (scan global + ajustements finition : grilles KPI, `overflow-x`, modales).

## 🧩 PRIORITÉ TRANSVERSE : Qualité du code & Release
- [ ] **Build TypeScript vert** : Corriger les erreurs `tsc -b` restantes et stabiliser le pipeline frontend.
- [ ] **Normalisation Zod v4** : Remplacer les usages legacy (`error.errors`) par `error.issues` et unifier le format des messages.
- [ ] **Contrat de types Frontend/Backend** : Aligner les champs sensibles (`Client`, nullables, numériques en string) pour réduire les casts.
- [ ] **Standard Zustand** : Documenter une convention de store (`state/actions/selectors`) et migrer les hooks complexes restants.
- [ ] **Gestion d'erreurs API unifiée** : Centraliser le parsing d'erreurs backend + toasts cohérents dans toute l'app.
- [ ] **Tests critiques UI** : Couvrir les flux à risque (création client, ajout panier, validation facture, création avoir).

## 🎨 PRIORITÉ TRANSVERSE : Refonte UI/UX Pro Max
- [ ] **Étape 0 - Audit UX/UI** : Cartographier les irritants des écrans clés (`Facturation`, `Dashboard`, `Stock`, `Commandes`, `Avoirs`, `Clients`).
- [ ] **Étape 1 - Fondation visuelle** : Mettre en place tokens globaux (couleurs, typo, spacing, radius, ombres, thèmes).
- [ ] **Étape 2 - UI Kit** : Standardiser les composants de base (`Button`, `Input`, `Select`, `Modal`, `Table`, `Toast`, `Skeleton`).
- [ ] **Étape 3 - Refonte écrans critiques** : Refaire en priorité `Facturation`, puis `Dashboard`, puis `Stock`.
- [ ] **Étape 4 - Généralisation** : Étendre la refonte à `Commandes`, `Avoirs`, `Clients`, `Produits`, `Maintenance`.
- [ ] **Étape 5 - QA finale** : Accessibilité, responsive desktop/tablette, performance perçue et non-régression métier.
- [ ] **Plan détaillé** : Suivi opérationnel dans `UI_UX_REDESIGN_PLAN.md`.

---

## ✅ AMÉLIORATIONS TERMINÉES
- [x] **Lazy Loading** : Optimisation du temps de premier chargement frontend.
- [x] **Calculs Décimaux** : Correction des erreurs de type (Decimal vs Float) dans le dashboard.
- [x] **Optimisation SQL** : Suppression des requêtes N+1 sur les factures et la messagerie.
- [x] **Fix Axios Headers** : Suppression du Content-Type fixe qui bloquait les envois de fichiers.
- [x] **Supervision Admin** : Ajout de l'onglet Supervision pour consulter toutes les conversations.
- [x] **Correctif Proxy Media** : Configuration du proxy Vite pour charger les pièces jointes sur les postes clients.
- [x] **URLs Relatives** : Modification des serializers pour supporter le multi-poste via des chemins relatifs.
- [x] **Validation Zod (Stock & Facturation)** : Ajout de schémas dédiés et validation côté client avant envoi API.
- [x] **Refactor Zustand (Commandes & Avoirs)** : État extrait des hooks lourds vers un store global plus léger.

---
## ✅ Definition of Done (pour chaque ticket)
- [ ] Build TypeScript OK
- [ ] Lint OK
- [ ] Tests ciblés OK
- [ ] i18n FR/EN vérifiée
- [ ] Pas de régression UI sur les écrans clés

---
*Dernière mise à jour : 24 Avril 2026*

