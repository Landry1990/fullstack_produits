---
description: Mise à jour automatique du CHANGELOG.md après une fonctionnalité ou correction
---

# Workflow — Mise à jour du CHANGELOG

À exécuter à la fin d'une session de développement ayant ajouté ou modifié une fonctionnalité visible/corrective significative.

## 1. Lire le format actuel

Ouvrir `CHANGELOG.md` et identifier :
- La date du jour au format `YYYY-MM-DD`.
- Les sections existantes (`### ✨ Nouvelles fonctionnalités`, `### 🐛 Corrections`, `### ⚡ Performance / Fiabilité`, etc.).

## 2. Déterminer la section

Classifier la modification :
- **Nouvelle fonctionnalité** → `### ✨ Nouvelles fonctionnalités`
- **Correction de bug** → `### 🐛 Corrections`
- **Optimisation / Scalabilité / Fiabilité** → `### ⚡ Performance / Fiabilité`
- **Refonte UI / UX** → `### 🎨 Améliorations UI`
- **Nettoyage technique** → `### 🧹 Nettoyage du code mort`

## 3. Rédiger l'entrée

Chaque entrée doit contenir :
- Un **titre clair** en gras.
- Une **liste de sous-points** avec le fichier modifié et ce qui a changé.
- Un **contexte** (problème résolu ou comportement attendu) si pertinent.

Exemple :

```markdown
### ✨ Nouvelles fonctionnalités

- **Répartition manuelle des lots en facturation**
  - `frontend/src/components/LotSelectionModal.tsx` : modal transformé en table avec inputs de quantité par lot.
  - Le mode FEFO automatique reste proposé par défaut, mais l'utilisateur peut modifier chaque lot.
  - `frontend/src/hooks/useFacturationActions.ts` : `handleLotSelect` accepte `LotAllocation[]` et met à jour `lotAllocations`.
  - `backend/api/services/sales_service.py` : `validate_invoice` utilise `_lot_allocations` pour débiter les lots choisis.
```

## 4. Insérer au bon endroit

- Si une section `## YYYY-MM-DD` existe déjà pour aujourd'hui, ajouter l'entrée dans la sous-section appropriée.
- Sinon, créer une nouvelle section `## YYYY-MM-DD` juste après le titre et le séparateur `---`.

## 5. Vérifier la cohérence

// turbo
Relire les 35 premières lignes du `CHANGELOG.md` pour s'assurer que le format est respecté et que les liens de fichiers sont corrects.
