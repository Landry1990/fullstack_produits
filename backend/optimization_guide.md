# Guide d'Optimisation Backend

## Problèmes détectés

- Timeouts: 30s+ sur certaines requêtes
- Worker kills: Out of memory (OOM)
- Lenteurs: Requêtes DB non optimisées

---

## 1. Gunicorn Configuration

Modifier gunicorn.conf.py:

```python
import multiprocessing

workers = multiprocessing.cpu_count() * 2 + 1
timeout = 60
max_requests = 1000
preload_app = True
```

## 2. Database Index

```sql
CREATE INDEX CONCURRENTLY idx_factures_date ON factures(date DESC);
CREATE INDEX CONCURRENTLY idx_produits_name_trgm ON produits USING gin (name gin_trgm_ops);
```

## 3. Django Query Optimization

```python
# Utiliser select_related et prefetch_related
factures = Facture.objects.select_related('client').prefetch_related('lignes__produit').all()
```

## 4. Caching avec Redis

```python
from django.core.cache import cache

result = cache.get('key')
if not result:
    result = expensive_query()
    cache.set('key', result, 300)
```

## 5. Connection Pooling

```python
DATABASES = {
    'default': {
        'CONN_MAX_AGE': 60,
        'CONN_HEALTH_CHECKS': True,
    }
}
```
