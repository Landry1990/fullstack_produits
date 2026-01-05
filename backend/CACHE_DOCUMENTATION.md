# Système de Cache pour les Recherches de Produits

## 📋 Vue d'ensemble

Ce système implémente un cache Redis (ou LocMemCache en développement) pour optimiser les performances des recherches fréquentes de produits. Le cache réduit la charge sur la base de données et améliore les temps de réponse.

## 🎯 Objectifs

- **Réduire les requêtes DB** : Les recherches fréquentes sont mises en cache
- **Améliorer les performances** : Temps de réponse réduit de 80-95% pour les requêtes en cache
- **TTL configurable** : Durée de vie du cache ajustable (défaut: 5 minutes)
- **Invalidation automatique** : Le cache est invalidé lors des modifications

## 🏗️ Architecture

### Composants

1. **`cache_utils.py`** : Utilitaires de base pour gérer le cache
2. **`cache_mixins.py`** : Mixins DRF pour intégrer le cache dans les ViewSets
3. **`cache_signals.py`** : Signaux Django pour invalider automatiquement le cache
4. **`settings.py`** : Configuration Redis/LocMemCache

### Flux de données

```
┌─────────────┐
│   Request   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐      ┌──────────┐
│  Check Cache    │─Yes─▶│  Return  │
└────────┬────────┘      └──────────┘
         │ No
         ▼
┌─────────────────┐
│  Query Database │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Store Cache   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Return      │
└─────────────────┘
```

## 🚀 Utilisation

### Activation du cache pour ProduitViewSet

#### Option 1 : Utiliser le Mixin (Recommandé)

```python
# Dans api/views.py
from .cache_mixins import CachedSearchMixin

class ProduitViewSet(CachedSearchMixin, viewsets.ModelViewSet):
    queryset = Produit.objects.select_related('rayon', 'fournisseur')
    serializer_class = ProduitSerializer
    cache_ttl = 300  # 5 minutes (optionnel, 300 par défaut)
```

#### Option 2 : Utilisation manuelle

```python
from .cache_utils import SearchCache

def list(self, request, *args, **kwargs):
    search_query = request.query_params.get('search', '')
    
    # Vérifier le cache
    cached_results = SearchCache.get_search_results(search_query)
    if cached_results:
        return Response(cached_results)
    
    # Exécuter la requête
    response = super().list(request, *args, **kwargs)
    
    # Mettre en cache
    SearchCache.set_search_results(search_query, response.data)
    return response
```

### Vérifier si une réponse vient du cache

Les réponses incluent un header `X-Cache-Hit`:
- `X-Cache-Hit: true` → Données du cache
- `X-Cache-Hit: false` → Données de la DB

```javascript
// Frontend
const response = await fetch('/api/produits/?search=paracetamol');
const isCached = response.headers.get('X-Cache-Hit') === 'true';
console.log('From cache:', isCached);
```

## ⚙️ Configuration

### Variables d'environnement

```bash
# Production avec Redis
REDIS_URL=redis://localhost:6379/1

# Développement (LocMemCache automatique si REDIS_URL absent)
# Pas de configuration nécessaire
```

### Ajuster le TTL

```python
# Par ViewSet
class ProduitViewSet(CachedSearchMixin, viewsets.ModelViewSet):
    cache_ttl = 600  # 10 minutes

# Globalement
# Dans cache_utils.py
class SearchCache:
    DEFAULT_TTL = 600  # 10 minutes
```

## 🔄 Invalidation du cache

### Automatique (via signaux)

Le cache est automatiquement invalidé lors de :
- Création/modification/suppression d'un produit
- Changement de stock (StockLot)
- Clôture de commande
- Validation de facture

```python
# Les signaux sont enregistrés dans cache_signals.py
@receiver(post_save, sender=Produit)
def invalidate_product_cache_on_change(sender, instance, **kwargs):
    SearchCache.invalidate_product(instance.id)
```

### Manuelle

```python
from api.cache_utils import SearchCache

# Invalider un produit spécifique
SearchCache.invalidate_product(product_id=123)

# Invalider tout le cache des produits
SearchCache.invalidate_all_products()
```

### Via API (Admin uniquement)

```python
# Ajouter une action admin
@action(detail=False, methods=['post'], permission_classes=[IsAdminUser])
def clear_cache(self, request):
    SearchCache.invalidate_all_products()
    return Response({'status': 'Cache cleared'})
```

## 📊 Monitoring

### Statistiques du cache

```python
from api.cache_utils import SearchCache

stats = SearchCache.get_cache_stats()
# Retourne:
# {
#     'backend': 'redis',
#     'used_memory': '2.5M',
#     'connected_clients': 3,
#     'total_commands_processed': 15234
# }
```

### Logs

Activer le logging pour monitorer les hits/miss :

```python
# settings.py
LOGGING = {
    'version': 1,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'cache_monitor': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}
```

## 🧪 Tests

### Tester le cache

```python
# tests.py
from django.test import TestCase
from api.cache_utils import SearchCache
from api.models import Produit

class CacheTestCase(TestCase):
    def test_search_cache(self):
        # Créer un produit
        produit = Produit.objects.create(name='Test Product')
        
        # Première requête (miss)
        response1 = self.client.get('/api/produits/?search=Test')
        self.assertEqual(response1['X-Cache-Hit'], 'false')
        
        # Deuxième requête (hit)
        response2 = self.client.get('/api/produits/?search=Test')
        self.assertEqual(response2['X-Cache-Hit'], 'true')
        
        # Modifier le produit (invalide le cache)
        produit.name = 'Modified Product'
        produit.save()
        
        # Troisième requête (miss après invalidation)
        response3 = self.client.get('/api/produits/?search=Test')
        self.assertEqual(response3['X-Cache-Hit'], 'false')
```

## 📈 Performances attendues

### Avant cache
- Recherche simple : ~200-500ms
- Liste paginée : ~100-300ms
- Détail produit : ~50-100ms

### Après cache (hit)
- Recherche simple : ~10-30ms (90% plus rapide)
- Liste paginée : ~5-15ms (95% plus rapide)
- Détail produit : ~5-10ms (90% plus rapide)

### Métriques clés
- **Hit Rate cible** : >70% pour les recherches fréquentes
- **TTL optimal** : 5 minutes (balance fraîcheur/performance)
- **Taille mémoire** : ~2-5MB pour 8000 produits

## 🔧 Dépannage

### Le cache ne fonctionne pas

1. Vérifier que les signaux sont enregistrés :
```python
# Dans api/apps.py
def ready(self):
    import api.cache_signals
```

2. Vérifier la configuration Redis :
```bash
# Tester la connexion
redis-cli ping
# Devrait retourner: PONG
```

3. Vérifier les logs :
```bash
# Activer DEBUG dans settings.py
DEBUG = True
```

### Le cache n'est pas invalidé

Vérifier que les signaux sont connectés :
```python
from django.db.models.signals import post_save
from api.models import Produit

# Vérifier les receivers
print(post_save.receivers)
```

### Performances dégradées

1. Augmenter le TTL pour réduire les miss
2. Vérifier la taille du cache Redis
3. Monitorer les hits/miss avec les logs

## 🎓 Bonnes pratiques

1. **Ne pas cacher les données sensibles** : Éviter de cacher les prix si ils changent fréquemment
2. **TTL adapté** : Court pour données volatiles, long pour données stables
3. **Invalidation sélective** : Invalider seulement ce qui change
4. **Monitoring** : Surveiller le hit rate et ajuster le TTL
5. **Tests** : Tester l'invalidation du cache dans les tests

## 📚 Références

- [Django Cache Framework](https://docs.djangoproject.com/en/stable/topics/cache/)
- [Django Redis](https://github.com/jazzband/django-redis)
- [DRF Caching](https://www.django-rest-framework.org/api-guide/caching/)

## 🔄 Évolutions futures

- [ ] Cache distribué pour multi-serveurs
- [ ] Compression des données en cache
- [ ] Warm-up du cache au démarrage
- [ ] Dashboard de monitoring du cache
- [ ] Cache prédictif basé sur les patterns d'utilisation
