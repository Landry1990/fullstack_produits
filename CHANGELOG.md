# Changelog — Fullstack Produits

---

## 2026-06-27

### 🎨 Améliorations UI

- **Tableau des avoirs — refonte**
  - Colonne **Type** séparée de la colonne Fournisseur, avec badge coloré par type (rouge=Périmé, orange=Cassé, jaune=Erreur livraison, bleu=Non facturé…).
  - Colonne **Lignes** ajoutée avec compteur circulaire (nombre de produits dans l'avoir).
  - Montant affiché en gris pâle quand = 0 F pour éviter la confusion.
  - Actions (Voir / Éditer / Valider / Supprimer) visibles uniquement au hover.
  - Filtres **Statut** (Tous / Brouillon / Validé) et **Type** ajoutés dans la barre de filtres.
  - Fichiers :
    - `frontend/src/components/avoirs/AvoirsTable.tsx`
    - `frontend/src/components/avoirs/AvoirsFilters.tsx`
    - `frontend/src/components/Avoirs.tsx`

---

### 🐛 Corrections

- **SalesTable — colonne Remise vide**
  - `remise` absent du `FactureListSerializer` (sérialiseur allégé utilisé pour la liste).
  - Ajout de `'remise'` dans les `fields` de `FactureListSerializer`.
  - Fichier : `backend/api/serializers_optimized.py`

### ✨ Nouvelles fonctionnalités

- **Édition inline Lot / Date péremption — Fiche produit (onglet Lots)**
  - Bouton ✏️ sur chaque ligne de lot → édition inline N° lot + date péremption.
  - Sauvegarde via `PATCH stock-lots/{id}/`.
  - Après sauvegarde, invalide le cache React Query `['produit-lots', produitId]`.
  - Fichier : `frontend/src/components/products/ProductTabsContent.tsx`

- **Édition inline Lot / Date péremption — Commande clôturée**
  - Bouton ✏️ visible uniquement sur les commandes `CLOT` dans la vue détail.
  - Sauvegarde via `PATCH commande-produits/{id}/correct_lot/`.
  - Met à jour aussi le `StockLot` associé côté backend.
  - Invalide le cache `['produit-lots', produitId]` pour synchronisation avec la fiche produit.
  - Fichiers :
    - `backend/api/views/commandes/commande_produits.py` (endpoint `correct_lot`)
    - `frontend/src/components/Commandes/CommandeDetails.tsx`

- **Contrôle de la remise globale à la facturation**
  - Toute remise globale > 0 déclenche une validation **sudo** obligatoire.
  - Plafond basé sur `max_discount_rate` du profil utilisateur :
    - Si dépassé → remise cappée au maximum autorisé + sudo quand même requis.
    - Superuser → plafond 100% (aucune restriction).
  - Annulation sudo → remise remise à `0`.
  - Fichiers :
    - `frontend/src/hooks/useSecureCartOperations.ts` (ajout `secureSetRemiseGlobale`)
    - `frontend/src/hooks/useFacturationState.ts` (exposition `secureSetRemiseGlobale`)
    - `frontend/src/components/facturation/TotalsSection.tsx` (saisie locale + `onRemiseChange`)
    - `frontend/src/components/Facturation.tsx` (branchement `onRemiseChange`)

---

## 2026-06-26

### 🐛 Corrections

- **Import CSV commande — quantité ignorée**
  - Le parseur lisait la quantité en colonne 4 au lieu de la colonne 1.
  - Nouveau format fixe : `CIP (col 0) | Qté (col 1) | Prix cession (col 2)` — reste facultatif.
  - Fichier : `frontend/src/hooks/useCommandesState.ts`

- **Dashboard — délai de mise à jour des ventes**
  - Intervalle de polling `useDashboardStats` réduit de 60 s à **15 s**.
  - Fichier : `frontend/src/hooks/useDashboard.ts`

### ✅ Vérifications

- **Import CSV — prix d'achat en fallback**
  - Confirmé : si la colonne prix est absente, le système utilise automatiquement `cost_price` de la fiche produit.
  - Aucune modification nécessaire.
