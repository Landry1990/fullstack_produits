# Exemples de requêtes pour le fix is_divers - 11/05/2025

## Scénario
Facture **FAC-000039** du 11/05/2025 avec :
- 6 produits au total
- 1 produit **LANZOP** avec lot `is_divers=True`
- 5 produits normaux

---

## 1. ANCIENNE MÉTHODE (BUG)

```python
# ❌ Exclut TOUTE la facture si AU MOINS UN produit est is_divers
factures = Facture.objects.filter(
    date__date='2025-05-11',
    status__in=['V', 'P']
).exclude(
    produits__allocations__stock_lot__is_divers=True  # ← PROBLÈME !
).distinct()

# Résultat: FAC-000039 est COMPLÈTEMENT EXCLUE
# Les 6 produits sont ignorés, pas seulement le LANZOP !
```

**Problème:** Si une facture contient 1 produit divers + 5 produits normaux, toute la facture est exclue.

---

## 2. NOUVELLE MÉTHODE (FIX)

### 2.1 Sous-requête pour calculer le montant is_divers

```python
from django.db.models import OuterRef, Subquery, Sum, F, DecimalField, Coalesce
from decimal import Decimal

# Sous-requête: calcule le total is_divers par facture
divers_total_sub = FactureProduitAllocation.objects.filter(
    facture_produit__facture=OuterRef('pk'),
    stock_lot__is_divers=True
).values('facture_produit__facture').annotate(
    total_divers=Coalesce(
        Sum(F('selling_price') * F('quantity'), output_field=DecimalField()),
        Decimal('0')
    )
).values('total_divers')
```

### 2.2 Requête principale avec adjusted_total

```python
factures = Facture.objects.filter(
    date__date='2025-05-11',
    status__in=['V', 'P']
).annotate(
    # Montant des produits is_divers pour cette facture
    divers_amount=Coalesce(
        Subquery(divers_total_sub, output_field=DecimalField()),
        Decimal('0')
    ),
    # Total ajusté = total TTC - montant is_divers
    adjusted_total=F('total_ttc') - F('divers_amount')
)

# Résultat pour FAC-000039:
#   total_ttc = 100 000 FCFA
#   divers_amount = 15 000 FCFA (LANZOP)
#   adjusted_total = 85 000 FCFA (5 autres produits)
```

### 2.3 Calcul du CA

```python
ca = factures.aggregate(
    ca=Coalesce(Sum('adjusted_total'), Decimal('0'))
)['ca']

# Résultat: 85 000 FCFA (sans le LANZOP)
# → FAC-000039 est INCLUSE mais avec le bon montant
```

---

## 3. EXEMPLES PRATIQUES POUR LE 11/05

### 3.1 Stats vendeurs du 11/05

```python
stats = factures.values('created_by_id').annotate(
    nbre_ventes=Count('id'),
    chiffre_affaires=Coalesce(Sum('adjusted_total'), Decimal('0'))
).order_by('-chiffre_affaires')

# Résultat:
#   Vendeur A: 5 ventes | CA: 450 000 FCFA (inclut FAC-000039 avec 85 000 FCFA)
```

### 3.2 Meilleurs clients du 11/05

```python
clients = factures.filter(client__isnull=False).values(
    'client_id', 'client__name'
).annotate(
    nb_ventes=Count('id'),
    chiffre_affaires=Coalesce(Sum('adjusted_total'), Decimal('0'))
).order_by('-chiffre_affaires')[:10]
```

### 3.3 Top produits (excluant is_divers)

```python
# Méthode 1: Via les allocations (exclure is_divers au niveau des lignes)
top_produits = FactureProduitAllocation.objects.filter(
    facture_produit__facture__date__date='2025-05-11',
    facture_produit__facture__status__in=['V', 'P']
).exclude(
    stock_lot__is_divers=True  # ← Filtre au niveau des allocations
).values('facture_produit__produit__name').annotate(
    qty=Sum('quantity'),
    revenue=Sum(F('quantity') * F('selling_price'))
).order_by('-qty')[:5]

# Résultat: LANZOP n'apparaît pas dans le top
```

### 3.4 Calcul de marge du 11/05

```python
# 1. Coût des produits alloués (sans is_divers)
margin_allocated = FactureProduitAllocation.objects.filter(
    facture_produit__facture__date__date='2025-05-11',
    facture_produit__facture__status__in=['V', 'P']
).exclude(
    stock_lot__is_divers=True
).aggregate(
    total=Coalesce(Sum(F('cost_price') * F('quantity')), Decimal('0'))
)['total']

# 2. Coût des produits non alloués (sans is_divers)
from django.db.models import Exists, OuterRef

unallocated_cost = FactureProduit.objects.filter(
    facture__date__date='2025-05-11',
    facture__status__in=['V', 'P']
).annotate(
    has_alloc=Exists(
        FactureProduitAllocation.objects.filter(facture_produit=OuterRef('pk'))
    )
).filter(
    has_alloc=False
).exclude(
    produit__lots__is_divers=True  # ← Exclure produits avec lots is_divers
).aggregate(
    total=Coalesce(Sum(F('produit__pmp') * F('quantity')), Decimal('0'))
)['total']

# 3. Marge
ca_total = factures.aggregate(ca=Sum('adjusted_total'))['ca']
margin = ca_total - (margin_allocated + unallocated_cost)
```

### 3.5 TVA collectée du 11/05

```python
# Filtrer au niveau des lignes de facture
lignes_tva = FactureProduit.objects.filter(
    facture__date__date='2025-05-11',
    facture__status__in=['V', 'P'],
    tva__gt=0
).exclude(
    allocations__stock_lot__is_divers=True  # ← Filtre au niveau lignes
).values('produit__name', 'tva').annotate(
    total_qty=Sum('quantity'),
    total_ttc=Sum(F('quantity') * (F('selling_price') - F('discount')))
)
```

### 3.6 Remises accordées le 11/05

```python
# Total des remises sur les factures (is_divers n'affecte pas les remises)
remises = factures.aggregate(
    total=Coalesce(Sum('remise'), Decimal('0'))
)['total']

# Détail par facture
for f in factures:
    print(f"{f.code}: Remise={f.remise}, CA ajusté={f.adjusted_total}")
```

---

## 4. REQUÊTES SQL ÉQUIVALENTES

### 4.1 Sous-requête divers_amount

```sql
-- Sous-requête pour calculer le montant is_divers par facture
SELECT 
    f.id,
    f.total_ttc,
    COALESCE(
        (SELECT SUM(fpa.selling_price * fpa.quantity)
         FROM api_factureproduitallocation fpa
         JOIN api_factureproduit fp ON fpa.facture_produit_id = fp.id
         JOIN api_stocklot sl ON fpa.stock_lot_id = sl.id
         WHERE fp.facture_id = f.id AND sl.is_divers = TRUE),
        0
    ) as divers_amount,
    f.total_ttc - COALESCE(...) as adjusted_total
FROM api_facture f
WHERE DATE(f.date) = '2025-05-11'
  AND f.status IN ('V', 'P');
```

### 4.2 CA par vendeur

```sql
SELECT 
    f.created_by_id,
    COUNT(*) as nbre_ventes,
    SUM(
        f.total_ttc - COALESCE(
            (SELECT SUM(fpa.selling_price * fpa.quantity)
             FROM api_factureproduitallocation fpa
             JOIN api_factureproduit fp ON fpa.facture_produit_id = fp.id
             JOIN api_stocklot sl ON fpa.stock_lot_id = sl.id
             WHERE fp.facture_id = f.id AND sl.is_divers = TRUE),
            0
        )
    ) as chiffre_affaires
FROM api_facture f
WHERE DATE(f.date) = '2025-05-11'
  AND f.status IN ('V', 'P')
GROUP BY f.created_by_id
ORDER BY chiffre_affaires DESC;
```

### 4.3 Marges (allouées)

```sql
SELECT 
    SUM(fpa.cost_price * fpa.quantity) as total_cost
FROM api_factureproduitallocation fpa
JOIN api_factureproduit fp ON fpa.facture_produit_id = fp.id
JOIN api_facture f ON fp.facture_id = f.id
JOIN api_stocklot sl ON fpa.stock_lot_id = sl.id
WHERE DATE(f.date) = '2025-05-11'
  AND f.status IN ('V', 'P')
  AND sl.is_divers = FALSE;  -- ← Exclure is_divers
```

---

## 5. RÉCAPITULATIF

| Rapport | Avant (Bug) | Après (Fix) |
|---------|-------------|-------------|
| CA journalier | FAC-000039 exclue (0 FCFA) | FAC-000039 incluse (85 000 FCFA) |
| Stats vendeurs | Manque 1 vente | Compte la vente avec CA ajusté |
| Top produits | Données faussées | Exclut uniquement LANZOP |
| Marges | Manque les marges de 5 produits | Inclut toutes les marges |
| TVA | Manque la TVA de 5 produits | Inclut toute la TVA |

**Règle d'or:** Ne jamais utiliser `.exclude(produits__allocations__stock_lot__is_divers=True)` au niveau des factures. Toujours filtrer au niveau des lignes (`FactureProduitAllocation`) ou utiliser la sous-requête `adjusted_total`.
