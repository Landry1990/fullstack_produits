# Guide d'Optimisation SQL - Pharmacie

## 🎯 Problèmes Critiques Identifiés

### 1. ProduitSerializer - N+1 Sévère (PRIORITÉ MAXIMALE)

**Localisation:** `backend/api/serializers.py:429-499`

**Problème:**
```python
class ProduitSerializer(serializers.ModelSerializer):
    valeur_stock = serializers.SerializerMethodField()      # +1 requête/produit
    stock_lots = serializers.SerializerMethodField()      # +1 requête/produit
    next_expiring_date = serializers.SerializerMethodField() # +1 requête/produit
    active_promotion = serializers.SerializerMethodField()  # +1 requête/produit
```

**Impact:** Pour 100 produits = **400 requêtes SQL** au lieu de 2-3!

**Solution:**
```python
# Dans la VUE (views/produits.py):
from django.db.models import Prefetch, Sum, Min, F
from django.db.models.functions import Coalesce

queryset = Produit.objects.prefetch_related(
    Prefetch('stock_lots', 
             queryset=StockLot.objects.filter(quantity_remaining__gt=0),
             to_attr='active_lots'),
    'promotions'  # Si PromotionService le permet
).annotate(
    valeur_stock_calc=Coalesce(
        Sum(F('stock_lots__quantity_remaining') * F('stock_lots__price_cost')),
        Value(0)
    ),
    next_expiring=Min('stock_lots__date_expiration', 
                      filter=Q(stock_lots__quantity_remaining__gt=0))
)

# Dans le SERIALIZER:
class ProduitSerializer(serializers.ModelSerializer):
    valeur_stock = serializers.DecimalField(
        source='valeur_stock_calc',  # Utilise l'annotation
        max_digits=15, decimal_places=2, read_only=True
    )
    
    stock_lots = serializers.SerializerMethodField()
    
    def get_stock_lots(self, obj):
        # Utilise le prefetch (obj.active_lots)
        if hasattr(obj, 'active_lots'):
            return StockLotSerializer(obj.active_lots, many=True).data
        return []
```

---

### 2. PromotionSerializer - Count N+1

**Localisation:** `backend/api/serializers.py:30-32`

**Problème:**
```python
products_count = serializers.IntegerField(source='products.count', read_only=True)
rayons_count = serializers.IntegerField(source='rayons.count', read_only=True)
```

**Solution:**
```python
# Dans la VUE:
queryset = Promotion.objects.annotate(
    products_count=Count('products', distinct=True),
    rayons_count=Count('rayons', distinct=True)
)

# Dans le SERIALIZER:
products_count = serializers.IntegerField(read_only=True)  # Utilise l'annotation
rayons_count = serializers.IntegerField(read_only=True)
```

---

### 3. CaisseViewSet.get_totals() - Requêtes en Cascade

**Localisation:** `backend/api/views/ventes/caisse.py:216-351`

**Problème:** 11 requêtes séparées pour calculer les totaux

**Solution:**
```python
@action(detail=False, methods=['get'], url_path='get_totals')
def get_totals(self, request):
    # ... date parsing ...
    
    # UNE SEULE requête avec aggregates multiples
    result = Caisse.objects.filter(
        statut='completee',
        date_paiement__range=(start_date, end_date)
    ).aggregate(
        # Ventes (hors recouvrement)
        total_ventes=Sum('montant', 
                        filter=~Q(mode_paiement__in=['en_compte', 'depot', 'recouvrement'])),
        total_ventes_especes=Sum('montant', filter=Q(mode_paiement='especes')),
        
        # Recouvrement
        total_recouvrement=Sum('montant', filter=Q(mode_paiement='recouvrement')),
        total_recouv_especes=Sum('montant', 
                                filter=Q(mode_paiement='especes', reference__icontains='[RECOUV]')),
        
        # Coupons
        total_coupons=-Sum('montant', filter=Q(mode_paiement='coupon'))
    )
    
    # Mouvements en UNE requête
    mouvements = MouvementCaisse.objects.filter(
        date__range=(start_date, end_date)
    ).aggregate(
        entrees=Coalesce(Sum('montant', filter=Q(type='ENTREE')), Value(0)),
        sorties=Coalesce(Sum('montant', filter=Q(type='SORTIE')), Value(0))
    )
    
    # Réduction de 11 à 2 requêtes!
    return Response({
        'total_ventes': result['total_ventes'] or 0,
        'total_recouvrement': result['total_recouvrement'] or 0,
        'total_entrees': mouvements['entrees'],
        'total_sorties': mouvements['sorties'],
        ...
    })
```

---

### 4. Rapport de Ventes - Export CSV

**Localisation:** `backend/api/views/rapports/finance.py:300-330`

**Problème:**
```python
for f in factures:  # Chargement en mémoire de TOUTES les factures
    modes = ", ".join(
        str(modes_dict.get(m, m))
        for m in f.paiements.filter(statut='completee')  # +1 requête/facture
        .values_list('mode_paiement', flat=True).distinct()
    )
```

**Solution:**
```python
# Avec prefetch et iterator pour streaming
factures = Facture.objects.filter(
    date__range=(date_debut, date_fin),
    status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
).select_related('client', 'created_by').prefetch_related(
    Prefetch('paiements', 
             queryset=Caisse.objects.filter(statut='completee').only('mode_paiement'),
             to_attr='completed_paiements')
).iterator(chunk_size=100)  # Streaming pour grandes tables

for f in factures:
    modes = ", ".join(set(
        modes_dict.get(p.mode_paiement, p.mode_paiement) 
        for p in f.completed_paiements  # Utilise le prefetch
    ))
```

---

## 🛠️ Optimisations Frontend (React)

### 1. useSalesData.ts - Pagination Obligatoire

```typescript
// ❌ AVANT: Charge tout
const { data: allSales } = useQuery(['sales'], () => 
  api.get('/api/factures/')  // 10 000+ factures!
)

// ✅ APRÈS: Pagination côté serveur
const useSalesData = (page: number, pageSize: number = 50) => {
  return useQuery(['sales', page, pageSize], () =>
    api.get('/api/factures/', {
      params: { page, page_size: pageSize }
    })
  )
}
```

### 2. useJournalCaisse.ts - Debounce + Cache

```typescript
// ✅ Déjà optimisé - À conserver
const useJournalCaisse = (filters: Filters) => {
  return useQuery(
    ['journal', filters], 
    () => api.get('/api/caisse/', { params: filters }),
    {
      staleTime: 30000,  // Cache 30s
      keepPreviousData: true,  // Affiche données précédentes pendant chargement
    }
  )
}
```

---

## 📊 Optimisations Base de Données

### Index Recommandés

```sql
-- Pour les requêtes fréquentes sur factures par date
CREATE INDEX CONCURRENTLY idx_facture_date_status 
ON api_facture(date DESC, status) 
WHERE is_active = true;

-- Pour les recherches de produits
CREATE INDEX CONCURRENTLY idx_produit_name_trgm 
ON api_produit USING gin (name gin_trgm_ops);

-- Pour les requêtes de caisse par date
CREATE INDEX CONCURRENTLY idx_caisse_date_paiement 
ON api_caisse(date_paiement DESC) 
WHERE statut = 'completee';
```

### Maintenance Automatique

```python
# Dans crontab ou Celery Beat
@periodic_task(run_every=crontab(hour=3, minute=0))
def maintenance_optimisation():
    """Maintenance quotidienne des tables"""
    from django.db import connection
    
    with connection.cursor() as cursor:
        # VACUUM ANALYZE pour tables fréquemment modifiées
        cursor.execute("VACUUM ANALYZE api_facture;")
        cursor.execute("VACUUM ANALYZE api_caisse;")
        cursor.execute("VACUUM ANALYZE api_produit;")
        cursor.execute("VACUUM ANALYZE api_stocklot;")
```

---

## 🎯 Plan d'Action Prioritaire

| Priorité | Fichier | Action | Impact |
|----------|---------|--------|--------|
| 🔴 **CRITIQUE** | `serializers.py:429-499` | Optimiser ProduitSerializer | -400 requêtes pour 100 produits |
| 🔴 **CRITIQUE** | `serializers.py:30-32` | Fix PromotionSerializer counts | -2 requêtes par promotion |
| 🟠 **HAUTE** | `caisse.py:216-351` | Regrouper aggregates | -9 requêtes par appel |
| 🟠 **HAUTE** | `finance.py:300-330` | Prefetch paiements + iterator | -N requêtes sur export |
| 🟡 **MOYENNE** | `factures.py:648-733` | Cache stats_jour (Redis) | -100% requêtes répétées |
| 🟡 **MOYENNE** | Frontend | Pagination toutes les listes | -90% données transférées |

---

## 📈 Monitoring

### Activer Django Debug Toolbar (dev uniquement)

```python
# settings.py DEBUG
INSTALLED_APPS += ['debug_toolbar']
MIDDLEWARE = ['debug_toolbar.middleware.DebugToolbarMiddleware'] + MIDDLEWARE

DEBUG_TOOLBAR_PANELS = [
    'debug_toolbar.panels.sql.SQLPanel',
    'debug_toolbar.panels.cache.CachePanel',
]
```

### Logging des Requêtes Lentes

```python
# settings.py
LOGGING = {
    'loggers': {
        'django.db.backends': {
            'level': 'DEBUG' if DEBUG else 'WARNING',
            'handlers': ['console'],
            'propagate': False,
        },
    }
}
```

---

## ✅ Validation des Optimisations

Après chaque modification, tester avec :

```bash
# 1. Script d'analyse
python manage.py shell -c "
from scripts.optimize_queries import main
main()
"

# 2. Test de charge (si installé)
python -m locust -f locustfile.py --headless -u 10 -r 2 --run-time 30s

# 3. Compteur de requêtes dans les tests
python manage.py test api.tests.test_performance --verbosity=2
```

---

**Document créé le:** 2025-01-12  
**Prochaine revue:** Après implémentation des optimisations prioritaires
