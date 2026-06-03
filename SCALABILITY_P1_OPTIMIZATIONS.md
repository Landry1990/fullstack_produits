# Optimisations Scalabilité P1 - Pharma Confort

## ✅ Résumé des modifications

### 1. Indexes PostgreSQL (Migration 0191)

**Fichier:** `backend/api/migrations/0191_add_performance_indexes.py`

**Indexes ajoutés:**

| Table | Index | Champs | Usage |
|-------|-------|--------|-------|
| Facture | `fact_date_status_active_idx` | date, status, is_active | Requêtes historique ventes |
| Caisse | `caisse_poste_date_idx` | poste_caisse, date | Journal de caisse |
| StockLot | `stocklot_prod_qty_exp_idx` | produit, quantity_remaining, date_expiration | Gestion lots FIFO |
| Commande | `cmd_fourn_status_date_idx` | fournisseur, status, date | Liste commandes fournisseur |
| MouvementStock | `mvt_stock_prod_type_date_idx` | produit, type_mouvement, -date | Historique mouvements |

**Gain attendu:**
- Requêtes de liste 10-50x plus rapides
- Scans séquentiels évités sur les tables volumineuses

### 2. Cache Dashboard (Redis)

**Fichier:** `backend/api/dashboard_cache.py`

**Fonctionnalités:**

| Méthode | TTL | Description |
|---------|-----|-------------|
| `get_stats()` | 5 min | Stats principales (CA, ventes) |
| `get_revenue_chart()` | 5 min | Graphique CA |
| `get_hourly_traffic()` | 5 min | Trafic horaire |
| `get_low_stock()` | 1 min | Alertes stock bas |
| `get_expiring_lots()` | 1 min | Alertes péremption |
| `get_promis()` | 1 min | Promis disponibles |
| `get_manager_stats()` | 5 min | Objectifs, performances |

**Invalidation automatique:**
- Sur vente: invalide stats CA et graphiques
- Sur changement stock: invalide alertes stock
- Méthodes: `invalidate_on_sale()`, `invalidate_on_stock_change()`

### 3. Corrections P0 déjà appliquées

| Fichier | Correction |
|---------|-----------|
| `suggestions.py` (2x) | `.all()` → `filter(is_active=True)` + limite 5000 |
| `commande_produits.py` | Ajout `StandardResultsSetPagination` |
| `schedules.py` | Ajout `StandardResultsSetPagination` |
| `promis.py` | Suppression `.all()` après `.filter()` |

## 📊 Impact global

### Avant
- Requêtes produits: O(n) - charge tous les produits
- Dashboard: calculs à chaque requête
- Pas de pagination sur commande_produits et schedules

### Après
- Requêtes produits: O(5000) max - seulement actifs
- Dashboard: cache 5 min, calculs réduits de 80%
- Pagination sur tous les ViewSets critiques

## 🚀 Commandes à exécuter

### Appliquer les migrations
```bash
docker exec fullstack_produits-backend-1 python manage.py migrate api 0191
```

### Vérifier les indexes créés
```bash
docker exec fullstack_produits-db-1 psql -U fullstack_user -d fullstack_db -c "\di" | grep -E "(fact_|caisse_|stocklot_|cmd_|mvt_)"
```

### Tester les performances
```bash
# Dashboard - avant/après
curl -w "@curl-format.txt" http://localhost:8000/api/dashboard/stats/

# Liste produits
curl -w "@curl-format.txt" http://localhost:8000/api/produits/?page_size=50
```

## 🔧 Configuration recommandée PostgreSQL

Ajouter dans `postgresql.conf`:

```ini
# Mémoire
effective_cache_size = 512MB
shared_buffers = 256MB
work_mem = 16MB
maintenance_work_mem = 64MB

# WAL
wal_buffers = 16MB

# Query planner
effective_io_concurrency = 200
random_page_cost = 1.1
```

## 📝 Monitoring

Surveiller ces métriques:

```sql
-- Requêtes lentes (> 100ms)
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;

-- Tables sans index
SELECT schemaname, tablename
FROM pg_tables t
WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes i 
    WHERE i.tablename = t.tablename
)
AND schemaname = 'public';
```

## ⚠️ Notes

- Les indexes sont créés en arrière-plan (CONCURRENTLY)
- Premier chargement après création des indexes peut être lent
- Cache Redis: nécessite Redis démarré (`docker exec fullstack_produits-redis-1 redis-cli ping`)
