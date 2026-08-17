# Propositions UI/UX - Module Inventaire

> Analyse des frictions actuelles et plan d'amélioration du module **Inventaire**.

---

## 1. Vue d'ensemble

Le module Inventaire permet de :
- Lister, filtrer et paginer les inventaires passés.
- Créer un nouvel inventaire (saisie ou vérification) par rayon, forme, groupe ou stock global.
- Saisir et valider les quantités physiques, comparer avec le stock théorique.
- Analyser les écarts, fusionner deux inventaires, et partager un rapport.
- Consulter un audit visuel des pertes et gains.

**Fichiers clés analysés :**
- `frontend/frontend/src/components/Inventaire.tsx`
- `frontend/frontend/src/components/inventaire/editor/InventaireList.tsx`
- `frontend/frontend/src/components/inventaire/InventaireListTable.tsx`
- `frontend/frontend/src/components/inventaire/InventaireFilters.tsx`
- `frontend/frontend/src/components/inventaire/InventaireQuickStats.tsx`
- `frontend/frontend/src/components/inventaire/editor/InventaireEditor.tsx`
- `frontend/frontend/src/components/inventaire/modals/InventaireCreateModal.tsx`
- `frontend/frontend/src/components/inventaire/modals/InventaireMergeModal.tsx`
- `frontend/frontend/src/components/inventaire/audit/InventaireAudit.tsx`

---

## 2. Ce qui fonctionne déjà bien

- **Architecture modulaire** : `Inventaire.tsx` orchestre clairement la liste, l'édition, l'audit et les modales.
- **Statuts visuels** : badges brouillon/validé et étiquettes de type d'inventaire lisibles.
- **Verrou pessimiste** : `LockBanner` affiche l'utilisateur qui modifie l'inventaire.
- **Sauvegarde auto** : indicateur "enregistrement auto" apaise l'utilisateur.
- **Export multi-format** : impression PDF, Telegram, WhatsApp et import CSV disponibles.
- **Recherche de produits intégrée** : ajout rapide d'un produit dans l'éditeur.

---

## 3. Frictions identifiées

### 3.1 Tableau des inventaires (`InventaireListTable.tsx`)

| Problème | Impact |
|----------|--------|
| Actions de ligne cachées par défaut (`opacity-0` au repos) | L'utilisateur ne découvre les actions qu'au survol ; manque d'affordance |
| Clic sur toute la ligne = ouvrir l'édition | Conflit avec la sélection de checkbox et les boutons d'action |
| Checkbox en première colonne + actions en dernière colonne | Écart visuel important entre la sélection et l'action associée |
| Bouton "Supprimer" toujours affiché mais désactivé pour un inventaire validé | Occupe de la place et crée de la confusion |
| Pas de badge "type d'inventaire" dans la liste | Difficile de distinguer global, rayon ou réserve d'un coup d'œil |

### 3.2 Filtres (`InventaireFilters.tsx`)

| Problème | Impact |
|----------|--------|
| Champ de recherche sans indication du périmètre | L'utilisateur ne sait pas s'il cherche ID, description, auteur... |
| Sélecteur de tri noyé dans les filtres avancés | Le tri, pourtant fréquent, demande un clic dans un select |
| Bouton "Supprimer les brouillons" passé en prop mais non affiché | Action attendue absente, nettoyage fastidieux ligne par ligne |
| Période sans libellé explicite | Les champs `type="date"` seuls ne justifient pas leur rôle |

### 3.3 En-tête de liste (`InventaireList.tsx`)

| Problème | Impact |
|----------|--------|
| Bouton "Fusionner" désactivé sans message visible | L'utilisateur doit survoler pour savoir pourquoi |
| Bouton d'audit (bleu) et bouton de fusion (blanc) au même niveau | Hiérarchie visuelle peu claire entre actions principales et secondaires |
| Pas de contexte quand aucun inventaire n'est sélectionné pour la fusion | Le wording du bouton ne change pas selon la sélection |

### 3.4 Quick stats (`InventaireQuickStats.tsx`)

| Problème | Impact |
|----------|--------|
| 3 cartes uniquement sans comparatif temporel | Impossible de voir la tendance d'un inventaire à l'autre |
| Écart global affiché en vert si positif | Sémantique subjective : un écart positif (surplus) n'est pas forcément "bon" |

### 3.5 Création d'inventaire (`InventaireCreateModal.tsx`)

| Problème | Impact |
|----------|--------|
| Termes "Vérifier" vs "Saisie" peu explicites | Un opérateur peut hésiter sur le mode à choisir |
| Filtres rayon/groupe/forme masqués en mode "Saisie" | Disparition brutale sans explication |
| Pas d'étape récapitulative | L'utilisateur confirme sans revue du périmètre |
| Aucun indicateur de chargement sur les listes de filtres | Risque d'options vides sans feedback |

### 3.6 Éditeur d'inventaire (`InventaireEditor.tsx`)

| Problème | Impact |
|----------|--------|
| Onglets `Saisie` / `Analyse` sans tooltip | Rôle de l'onglet Analyse pas immédiat |
| Groupement d'impression mélangé avec les actions d'export | Select `printGroupBy` isolé, peu visible |
| Import CSV représenté par un simple bouton "Importer" | Pas d'aperçu, pas de feedback de structure attendue |
| Actions de validation et de sauvegarde non hiérarchisées | Bouton `Valider` potentiellement loin de la zone de travail |

### 3.7 Audit (`InventaireAudit.tsx`)

| Problème | Impact |
|----------|--------|
| Pas de titre explicite sur le graphique | L'utilisateur ne sait pas s'il voit pertes, gains ou les deux |
| Tri par valeur par défaut | Les opérateurs préfèrent souvent trier par nom de rayon/groupe |

---

## 4. Propositions d'amélioration

### 4.1 Quick wins (à implémenter en priorité)

#### P1 - Tableau des inventaires : actions toujours visibles
- Afficher en permanence au moins l'icône d'édition et un menu `…` pour les actions secondaires (WhatsApp, suppression).
- Remplacer le clic ligne entière par un bouton "Ouvrir" explicite pour éviter le conflit avec la sélection.
- Ajouter un badge du type d'inventaire dans la première cellule (`Global`, `Rayon`, `Réserve`).
- Masquer le bouton "Supprimer" dès qu'un inventaire est validé, ou le regrouper dans le menu `…`.

**Fichiers :** `InventaireListTable.tsx`

#### P2 - Filtres : rechercher et trier plus vite
- Ajouter un placeholder explicite dans la recherche : "ID, description, auteur".
- Sortir le sélecteur de tri du bloc avancé pour le placer à côté de la barre de recherche.
- Ajouter un libellé "Période" au-dessus des champs date.
- Afficher le bouton "Supprimer les brouillons" s'il est fonctionnellement supporté.

**Fichiers :** `InventaireFilters.tsx`, `InventaireList.tsx`

#### P3 - Bouton Fusionner : feedback explicite
- Afficher un badge/chip du nombre d'inventaires sélectionnés à côté du bouton Fusionner.
- Afficher le motif de désactivation sous forme de tooltip ou de texte secondaire au survol.
- Grouper visuellement les actions secondaires (audit, fusion) à droite et l'action principale (créer) à gauche.

**Fichiers :** `InventaireList.tsx`

### 4.2 Améliorations moyennes

#### P4 - Création d'inventaire : assistant à 2 étapes
- Étape 1 : choix du mode avec description du périmètre.
- Étape 2 : sélection du type de stock et filtres éventuels, avec récapitulatif avant validation.
- Ajouter un état de chargement pour les dropdowns rayon/groupe/forme.
- Renommer "Vérifier" / "Saisie" en libellés plus métier (ex : "Contrôle partiel", "Inventaire complet").

**Fichiers :** `InventaireCreateModal.tsx`

#### P5 - Éditeur : regrouper les actions d'export
- Transformer le select de groupement d'impression en simple `ToggleGroup`.
- Regrouper les boutons PDF, Telegram, CSV dans une dropdown "Exporter / Partager" pour alléger l'en-tête.
- Ajouter un tooltip sur l'onglet Analyse : "Écarts par rayon et par produit".
- Conserver le bouton `Valider` visible en bas de l'éditeur, pas seulement en haut.

**Fichiers :** `InventaireEditor.tsx`

#### P6 - Quick stats : tendance et sémantique des écarts
- Ajouter une mini variation par rapport au dernier inventaire validé.
- Utiliser une couleur ambre pour les écarts non nuls au lieu du vert/rouge binaire, sauf pour les pertes importantes.
- Ajouter une info-bulle sur le calcul de l'écart global.

**Fichiers :** `InventaireQuickStats.tsx`

### 4.3 Gros chantiers

#### P7 - Audit visuel
- Ajouter un titre et une légende au graphique des écarts.
- Permettre de basculer entre pertes, gains et les deux.
- Proposer un tri par nom de rayon/groupe par défaut.

**Fichiers :** `InventaireAudit.tsx`

---

## 5. Recommandation de démarrage

Commencer par **P1 (tableau)** + **P2 (filtres)** + **P3 (bouton fusionner)**.  
Ces trois quick wins améliorent la lisibilité et la rapidité de l'opérateur sans toucher à la logique métier.

---

**Version** : 1.0  
**Date** : Août 2026
