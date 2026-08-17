# Propositions d'amélioration UI/UX — Module Commandes

**Date** : 2026-08-16  
**Scope** : `frontend/frontend/src/components/Commandes/` + traductions `orders.json`  
**Objectif** : aligner le module Commandes sur le design system shadcn/ui, éliminer les restes DaisyUI / emojis, améliorer l'accessibilité et la lisibilité.

---

## 1. Points forts actuels

- `SuggestionCommandeModal.tsx`, `ExportCommandeModal.tsx` et `CommandeDeleteModals.tsx` utilisent déjà `Dialog` / `Table` / `Button` shadcn/ui.
- `CommandeList.tsx` utilise le composant `Table` partagé (`../ui/Table`).
- La sémantique des statuts est cohérente : bleu = `PREP`, ambre = `ATT`, vert = `CLOT`.
- Le raccourci clavier et le scan Data Matrix sont intégrés.

---

## 2. Problèmes identifiés

### 2.1 Incohérences de bibliothèques de composants

| Fichier | Problème constaté |
|---|---|
| `CommandeProductTable.tsx` | Utilise un `<table>` natif au lieu des composants `Table` shadcn/ui. |
| `CommandeProductToolbar.tsx` | Importe `Button` depuis `../ui/Button` (legacy) et `Select` depuis `../ui/Select` (legacy). |
| `CommandeProductRow.tsx` | `Button` importé de `../ui/Button` (legacy). |
| `TransferCommandeModal.tsx` | Modale faite main (`fixed inset-0`), `<select>` natif, classes `bg-base-*`. |
| `MergeCommandesModal.tsx` | Modale faite main, `<select>` natif, `<button>` natif pour le CTA principal. |
| `QuickCreateProductModal.tsx` | `<select>` natifs pour TVA et Rayon. |
| `CommandeForm.tsx` | `<input type="checkbox">` natifs pour "Mise en place" et "Payé au comptant". |
| `DuplicateLotModal.tsx` | Modale faite main, textes FR en dur, `<button>` natifs. |

### 2.2 Restes DaisyUI / thème `base-*`

- `TransferCommandeModal.tsx` : `bg-base-100`, `text-base-content/60`, `border-base-300`, `bg-base-200`.
- `MergeCommandesModal.tsx` : `bg-base-*`, `text-success`, `text-error`, `bg-primary/20`.
- `CommandeProductToolbar.tsx` : dépend du `Select` legacy (`slate-*`/`indigo-*`).
- `../ui/Button.tsx` et `../ui/Select.tsx` sont des wrappers legacy à éliminer si le module en est le dernier utilisateur.

### 2.3 Emojis utilisés comme icônes UI

| Fichier | Ligne | Contenu à remplacer |
|---|---|---|
| `CommandeProductToolbar.tsx` | 42 | `📦 {count}` |
| `CommandeProductToolbar.tsx` | 63-66 | `🕒 📦 🔢` dans options de tri |
| `CommandeProductToolbar.tsx` | 88 | `➡️` bouton transfert |
| `DataMatrixScanBar.tsx` | 67 | `✓` message scan |
| `CommandeProductExpandedRow.tsx` | 61 | `⚠️` alerte rupture |

Remplacement : utiliser `lucide-react` (`Package`, `Clock`, `Hash`, `ArrowRight`, `Check`, `AlertTriangle`).

### 2.4 Textes en dur / `defaultValue` non traduits

- `DuplicateLotModal.tsx` : "Produit déjà dans la commande", "Incrémenter — Ligne", "Lot non encore saisi", etc.
- `QuickCreateProductModal.tsx` : `defaultValue` FR dans `t()`.
- `CommandeProductRow.tsx` : tooltip `Marge faible (seuil: …)` en FR.
- `DataMatrixScanBar.tsx` : "Scan Data Matrix actif — pointez la douchette sur un code" en dur.
- `CommandeProductToolbar.tsx` : "Suppr." en dur.

### 2.5 Accessibilité

- `<select>` natifs sans `id`/`htmlFor` associé.
- Checkboxes natives sans `Label` shadcn.
- Boutons d'action avec seulement `title` / icône, sans `aria-label` explicite.
- Modales faites main : pas de `role="dialog"`, `aria-modal`, focus-trap, gestion `Escape`.

### 2.6 UX des tableaux

- `CommandeProductTable.tsx` : 14/15 colonnes sur une ligne, largeurs fixes (`w-16`, `w-24`). Débordement horizontal probable sur 13-14".
- Inputs `h-8` + polices `text-[10px]`/`text-[11px]` : saisie à haute cadence difficile.
- Totaux fixes en bas avec `text-[10px]` difficiles à lire.

### 2.7 Densité du header `CommandeForm.tsx`

- Trop d'éléments sur une seule ligne `flex-wrap` : fournisseur, N° facture, checkboxes, taux, recherche, boutons d'action.
- Sur petit écran les éléments se chevauchent et le flux de saisie est confus.

---

## 3. Design system cible

### Principes

- **Tout composant graphique via shadcn/ui** (règle projet AGENTS.md).
- **Plus d'emojis** : utiliser `lucide-react`.
- **Palette pharmacie** : `emerald-600/700` primary, `slate-50/100/200` neutre, `amber` warning, `red` danger.
- **Taille de base 14px**, inputs `h-10` minimum.
- **Modales** : `Dialog` shadcn avec `aria-labelledby`.
- **Tableaux** : `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableCell` shadcn.

### Mapping des composants à remplacer

| Actuel | Remplacement |
|---|---|
| `../ui/Button` | `../shadcn/button` |
| `../ui/Select` | `../shadcn/select` |
| `<select>` natif | `shadcn/select` |
| `<input type="checkbox">` natif | `shadcn/checkbox` + `shadcn/label` |
| Modale `fixed inset-0` maison | `Dialog` shadcn |
| `<table>` natif | `Table` shadcn |

---

## 4. Plan d'action

### P0 — Fondamentaux (impact immédiat)

1. **Remplacer `../ui/Button` par `../shadcn/button`** dans `CommandeProductToolbar.tsx`, `CommandeProductRow.tsx`, `CommandeDeleteModals.tsx`.
2. **Remplacer `../ui/Select` par `shadcn/select`** dans `CommandeProductToolbar.tsx` et `CommandeForm.tsx`.
3. **Convertir les checkboxes natives** en `shadcn/checkbox` avec `Label` dans `CommandeForm.tsx`.
4. **Supprimer tous les emojis** du module ; remplacer par des icônes `lucide-react`.
5. **Convertir les modales faites main** (`TransferCommandeModal.tsx`, `MergeCommandesModal.tsx`, `QuickCreateProductModal.tsx`, `DuplicateLotModal.tsx`) en `Dialog` shadcn.
6. **Convertir `<select>` natifs** en `shadcn/select` dans `TransferCommandeModal.tsx`, `MergeCommandesModal.tsx`, `QuickCreateProductModal.tsx`, `SuggestionCommandeModal.tsx`.

### P1 — Cohérence visuelle

7. **Refactor `CommandeProductTable.tsx`** de `<table>` natif vers `Table` shadcn.
8. **Harmoniser les couleurs** : supprimer `bg-base-*`, `text-base-content`, `text-success`, `text-error` au profit de `slate-*`/`emerald-*`/`red-*` explicites.
9. **Supprimer `../ui/Button.tsx` et `../ui/Select.tsx`** si le module Commandes est leur dernier utilisateur.
10. **Uniformiser les inputs** à `h-10`/`text-sm` minimum dans le tableau produit.

### P2 — i18n et accessibilité

11. **Traduire tous les textes en dur** dans `DuplicateLotModal.tsx`, `DataMatrixScanBar.tsx`, `QuickCreateProductModal.tsx`.
12. **Ajouter `aria-label`** sur les boutons icônes du header `CommandeForm.tsx`.
13. **Relier labels et champs** (`htmlFor`/`id`) dans `CommandeForm.tsx` et `QuickCreateProductModal.tsx`.

### P3 — UX avancée

14. **Refaire le layout du header `CommandeForm.tsx`** : regrouper les paramètres (fournisseur, facture, options de paiement) dans une `Card` secondaire, dégager la barre de recherche principale.
15. **Simplifier `CommandeProductTable.tsx`** : réduire le nombre de colonnes affichées par défaut, déplacer `lot`/`expiration` dans l'expansion, ajouter des tooltips d'en-tête.
16. **Améliorer les états vides** : illustration + texte explicite dans `CommandeProductTable.tsx` et `CommandeList.tsx`.

---

## 5. Fichiers à modifier

### Composants

- `frontend/frontend/src/components/Commandes/CommandeProductTable.tsx`
- `frontend/frontend/src/components/Commandes/CommandeProductRow.tsx`
- `frontend/frontend/src/components/Commandes/CommandeProductToolbar.tsx`
- `frontend/frontend/src/components/Commandes/CommandeForm.tsx`
- `frontend/frontend/src/components/Commandes/TransferCommandeModal.tsx`
- `frontend/frontend/src/components/Commandes/MergeCommandesModal.tsx`
- `frontend/frontend/src/components/Commandes/QuickCreateProductModal.tsx`
- `frontend/frontend/src/components/Commandes/DuplicateLotModal.tsx`
- `frontend/frontend/src/components/Commandes/CommandeProductExpandedRow.tsx`
- `frontend/frontend/src/components/Commandes/DataMatrixScanBar.tsx`
- `frontend/frontend/src/components/Commandes/CommandeList.tsx` (vérifications mineures)
- `frontend/frontend/src/components/Commandes/CommandeDetails.tsx` (vérifications mineures)

### Wrappers legacy à évaluer pour suppression

- `frontend/frontend/src/components/ui/Button.tsx`
- `frontend/frontend/src/components/ui/Select.tsx`

### Traductions

- `frontend/frontend/public/locales/fr/orders.json`
- `frontend/frontend/public/locales/en/orders.json`

---

## 6. Métriques de succès

- Aucune classe `bg-base-*` / `text-base-content` dans `src/components/Commandes/`.
- Aucun emoji dans les composants du module.
- 100% des labels et placeholders du module dans `fr/orders.json` et `en/orders.json`.
- Tous les `<table>`, `<select>` natifs et checkboxes natives convertis en shadcn/ui.
- Build `npm run build` et lint `npm run lint` sans erreur.
