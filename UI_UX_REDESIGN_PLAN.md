# 🎨 Plan Pas à Pas - Refonte UI/UX Pro Max

Ce document décrit une méthode concrète pour refaire l'interface graphique de manière professionnelle, progressive et sans casser le métier.

---

## 1) Objectif global

- Moderniser toute l'interface avec une identité visuelle forte et cohérente.
- Améliorer la vitesse d'utilisation en caisse et sur les écrans de gestion.
- Réduire la dette UI (styles hétérogènes, composants dupliqués, UX incohérente).
- Garder la logique métier stable pendant la refonte.

---

## 2) Principes de mise en oeuvre

- **Progressif** : écran par écran, pas de big bang.
- **Mesurable** : chaque étape a des critères de validation.
- **Réutilisable** : création d'un Design System interne.
- **Sûr** : aucun changement métier non demandé pendant la refonte visuelle.

---

## 3) Roadmap de refonte (pas à pas)

## Étape 0 - Audit express (1 à 2 jours)

### Actions
- Lister les écrans critiques: `Facturation`, `Dashboard`, `Stock`, `Commandes`, `Avoirs`, `Clients`.
- Photographier les problèmes UX: lisibilité, surcharge visuelle, actions cachées, temps d'accès.
- Cartographier les composants existants (inputs, boutons, modals, tables, alertes).

### Livrables
- Mini rapport d'audit (forces/faiblesses/priorités).
- Priorisation des écrans à refaire en premier.

### Critères de validation
- Top 3 écrans prioritaires validé.
- Liste des composants à standardiser validée.

---

## Étape 1 - Fondation visuelle (3 à 5 jours)

### Actions
- Définir des **design tokens**:
  - couleurs (primary/secondary/success/warning/error),
  - typographie (tailles, poids, interlignes),
  - espacements, rayons, ombres, transitions.
- Mettre en place les variables globales (thème clair/sombre).
- Fixer les règles de hiérarchie visuelle (titres, sous-titres, zones d'actions).

### Livrables
- Fichier de tokens global.
- Guide visuel court (1 page): couleurs, typo, boutons, cartes, tables.

### Critères de validation
- Les nouvelles pages utilisent les mêmes tokens.
- Plus de styles "hardcodés" dispersés sur les écrans refondus.

---

## Étape 2 - UI Kit (5 à 7 jours)

### Actions
- Créer/normaliser les composants de base:
  - `Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `Switch`,
  - `Modal`, `Drawer`, `Badge`, `Toast`,
  - `Table`, `Card`, `EmptyState`, `Skeleton`.
- Ajouter les variantes standards (taille, couleur, loading, disabled, danger).
- Uniformiser les états:
  - loading,
  - empty,
  - erreur,
  - succès.

### Livrables
- Dossier `src/components/ui` consolidé.
- Exemples d'usage par composant.

### Critères de validation
- Les écrans refondus n'utilisent plus de composants ad hoc pour les bases UI.
- Même comportement visuel sur tous les formulaires.

---

## Étape 3 - Refondre les écrans critiques (2 semaines)

### Ordre recommandé
1. `Facturation` (impact business maximal)
2. `Dashboard` (pilotage quotidien)
3. `Stock` (analyse et décisions d'achat)

### Actions
- Refaire les layouts pour privilégier lisibilité + rapidité d'action.
- Réduire la profondeur visuelle inutile (trop d'encadrements, badges, bruit).
- Clarifier les CTA principaux (1 primaire, 1 secondaire max par zone).
- Introduire raccourcis et focus clavier cohérents.

### Livrables
- 3 écrans complètement refondus.
- Documentation des choix UX.

### Critères de validation
- Temps de prise en main réduit.
- Parcours critiques réalisables avec moins de clics.
- Aucune régression fonctionnelle.

---

## Étape 4 - Étendre au reste de l'application (2 à 3 semaines)

### Actions
- Refonte des modules secondaires:
  - `Commandes`,
  - `Avoirs`,
  - `Clients`,
  - `Produits`,
  - `Maintenance`.
- Harmoniser les formulaires longs et les tableaux denses.
- Uniformiser les modals de confirmation/sudo/erreurs.

### Livrables
- Interface homogène sur l'ensemble du périmètre.

### Critères de validation
- Plus d'écart visuel majeur entre modules.
- Même logique UX pour les actions similaires.

---

## Étape 5 - Qualité finale & performance (3 à 5 jours)

### Actions
- Audit accessibilité:
  - contrastes,
  - focus visible,
  - navigation clavier,
  - libellés.
- Optimiser les rendus:
  - code splitting des modals lourds,
  - skeletons sur tableaux volumineux.
- QA cross-résolution (desktop + tablette).

### Livrables
- Checklist QA UI/UX complétée.
- Correctifs finaux.

### Critères de validation
- UX stable, fluide, cohérente.
- Performance perçue améliorée.

---

## 4) Gouvernance de la refonte

### Rythme conseillé
- Sprint hebdomadaire avec démo visuelle.
- Validation de chaque écran avant passage au suivant.

### Règle d'or
- Une PR UI = un périmètre clair (ex: "Refonte Dashboard seulement").

### Suivi
- Ajouter une section "Refonte UI/UX" dans `ROADMAP.md` avec progression %.

---

## 5) Définition of Done (pour chaque écran refondu)

- [ ] Identité visuelle alignée Design System
- [ ] États loading/empty/error gérés
- [ ] Accessibilité clavier correcte
- [ ] Responsive desktop/tablette vérifié
- [ ] Régression métier testée
- [ ] Validation utilisateur finale

---

## 6) Démarrage immédiat recommandé

### Sprint 1 (cette semaine)
- Étape 0 complète
- Étape 1 complète
- Début Étape 2 (composants de base)

### Sprint 2
- Fin Étape 2
- Étape 3 sur `Facturation` (V1)

### Sprint 3
- Étape 3 sur `Dashboard` + `Stock`

