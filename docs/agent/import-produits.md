# Import produits

> Référence détaillée — l'essentiel est dans AGENTS.md à la racine.

### Import/Export produits

- `backend/api/management/commands/import_excel_csv.py` — commande d'import Excel/CSV
- `backend/api/views/purge.py` — endpoint `maintenance/import_produits/` et `maintenance/export_produits/`
- `backend/api/models/products.py` — modèle `Produit`
- `frontend/frontend/src/components/Maintenance.tsx` — écran de maintenance (import/export/purge)
- `frontend/frontend/src/components/products/ImportProductsModal.tsx` — modal d'import alternatif (non utilisé par l'écran Maintenance)

### Import Produits — Pièges connus

Le workflow UI actuel passe par `maintenance/import_produits/` (dans `PurgeViewSet`), qui invoque la commande `import_excel_csv`. Le fichier `backend/api/views/import_views.py` existe mais n'est pas la route active de l'écran Maintenance.

#### Format attendu

Colonnes supportées (ordre et noms) :
```
cip1, cip2, cip3, nom, prix_achat, prix_vente, tva, stock
```

#### Normalisations gérées

- CIP flottants (`8017017.0`) → convertis en entier chaîne
- Cellules vides → `None`, jamais `"nan"`, `"none"` ou `"0"`
- Prix et TVA lus comme nombres
- Stock entier

#### Règles de matching

- On matche uniquement par `cip1` et `cip2`
- `cip3` est ignoré pour le matching car il s'agit souvent d'un code partagé/référence
- Si un CIP entrant (`cip2` ou `cip3`) entre en conflit avec un autre produit, on saute ce CIP plutôt que de fusionner
- `cip1` absent → `None` (autorise plusieurs produits sans `cip1`)

#### Tests de référence (base vide)

| Fichier | Créés | Mis à jour | Erreurs |
|---------|-------|------------|---------|
| `Listing_Laborex_Mapped_FINAL.xlsx` (4 934 lignes) | 4 930 | 4 | 0 |
| `Listing_Ubipharm_Mapped_FINAL.xlsx` (8 251 lignes) | 8 237 | 14 | 0 |
| Laborex puis Ubipharm | 5 837 | 2 414 | 0 |
