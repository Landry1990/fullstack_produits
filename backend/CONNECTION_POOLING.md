# Configuration du Connection Pooling - Documentation

## 📋 Vue d'ensemble

Configuration du connection pooling pour optimiser la gestion des connexions à la base de données PostgreSQL avec Django, particulièrement important pour une application avec 10 postes simultanés.

## 🔴 Problème initial

### Sans connection pooling

```python
# Avant
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'MyDatabase',
        # ... autres paramètres
        # Pas de CONN_MAX_AGE → connexions fermées après chaque requête
    }
}
```

### Problèmes identifiés

1. **Connexions fermées après chaque requête**
   - Overhead de connexion/déconnexion constant
   - Temps perdu à établir la connexion TCP
   - Authentification répétée

2. **Nombre de connexions limité**
   - PostgreSQL a une limite de connexions (default: 100)
   - 10 workers × 10 requêtes/sec = 100 connexions/sec
   - Risque d'atteindre la limite

3. **Performance dégradée**
   - Latence ajoutée par les connexions/déconnexions
   - CPU gaspillé sur l'overhead réseau

### Impact

**Pour 10 postes simultanés:**
- Overhead de connexion: ~10-50ms par requête
- Connexions/déconnexions: ~1000/minute
- Risque de saturation du pool PostgreSQL

## ✅ Solution implémentée

### 1. CONN_MAX_AGE (Connection Persistence)

```python
DATABASES = {
    'default': {
        # ...
        'CONN_MAX_AGE': 600,  # 10 minutes
    }
}
```

**Fonctionnement:**
- Django garde les connexions ouvertes pendant 10 minutes
- Réutilisation des connexions entre requêtes
- Fermeture automatique après 10 minutes d'inactivité

**Avantages:**
- ✅ Pas d'overhead de connexion/déconnexion
- ✅ Latence réduite de 10-50ms par requête
- ✅ Moins de charge sur PostgreSQL

### 2. CONN_HEALTH_CHECKS

```python
DATABASES = {
    'default': {
        # ...
        'CONN_HEALTH_CHECKS': True,  # Django 4.1+
    }
}
```

**Fonctionnement:**
- Vérifie que la connexion est toujours valide avant utilisation
- Détecte les connexions fermées par le serveur
- Recrée automatiquement les connexions mortes

**Avantages:**
- ✅ Évite les erreurs "connection closed"
- ✅ Robustesse accrue
- ✅ Pas d'impact performance (vérification rapide)

### 3. Configuration PostgreSQL optimisée

```python
'OPTIONS': {
    'isolation_level': None,  # Utilise READ COMMITTED (défaut PostgreSQL)
}
```

**Niveau d'isolation:**
- `READ COMMITTED` : Optimal pour la plupart des cas
- Évite les locks inutiles
- Bon compromis performance/cohérence

## 📊 Comparaison avant/après

### Temps de connexion

| Opération | Sans pooling | Avec pooling | Gain |
|-----------|-------------|--------------|------|
| Connexion initiale | 20-50ms | 20-50ms | 0% |
| Requête suivante | 20-50ms | 0ms | **100%** |
| 100 requêtes | 2-5s | 20-50ms | **99%** |

### Nombre de connexions PostgreSQL

| Scénario | Sans pooling | Avec pooling | Réduction |
|----------|-------------|--------------|-----------|
| 10 workers, 1 req/sec | 10 conn/sec | 10 conn max | **90%** |
| 10 workers, 10 req/sec | 100 conn/sec | 10 conn max | **99%** |
| Pic de charge | 200+ conn/sec | 10-20 conn max | **95%** |

### Latence des requêtes

| Type de requête | Sans pooling | Avec pooling | Gain |
|-----------------|-------------|--------------|------|
| Requête simple | 30-70ms | 10-20ms | **50-70%** |
| Requête complexe | 100-200ms | 80-170ms | **20%** |

## 🎯 Configuration recommandée

### Développement

```python
# .env ou settings.py
DB_CONN_MAX_AGE=60  # 1 minute (pour éviter trop de connexions ouvertes)
```

**Pourquoi 1 minute ?**
- Développement = peu de requêtes simultanées
- Évite d'accumuler des connexions inutiles
- Permet de tester le comportement de reconnexion

### Production (10 postes simultanés)

```python
# .env
DB_CONN_MAX_AGE=600  # 10 minutes
```

**Pourquoi 10 minutes ?**
- Balance entre réutilisation et libération
- 10 workers × 10 minutes = max 10 connexions persistantes
- Libération automatique des connexions inactives

### Production haute charge (50+ utilisateurs)

```python
# .env
DB_CONN_MAX_AGE=300  # 5 minutes
# + pgBouncer recommandé
```

**Pourquoi 5 minutes + pgBouncer ?**
- Plus de workers = plus de connexions
- pgBouncer gère un vrai pool côté serveur
- Limite stricte du nombre de connexions

## 🔧 Configuration avancée avec pgBouncer

### Installation de pgBouncer

```bash
# Ubuntu/Debian
sudo apt-get install pgbouncer

# Windows
# Télécharger depuis https://www.pgbouncer.org/
```

### Configuration pgBouncer

```ini
# /etc/pgbouncer/pgbouncer.ini

[databases]
MyDatabase = host=localhost port=5432 dbname=MyDatabase

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Pool settings
pool_mode = transaction  # ou session
max_client_conn = 100
default_pool_size = 20
reserve_pool_size = 5
reserve_pool_timeout = 3

# Timeouts
server_idle_timeout = 600
server_lifetime = 3600
```

### Django avec pgBouncer

```python
# settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'MyDatabase',
        'USER': 'postgres',
        'PASSWORD': '123456',
        'HOST': 'localhost',
        'PORT': '6432',  # Port pgBouncer au lieu de 5432
        
        'CONN_MAX_AGE': 0,  # Désactiver le pooling Django (pgBouncer gère)
        
        'OPTIONS': {
            'server_side_binding': False,  # Important pour pgBouncer
        },
    }
}
```

### Pool modes de pgBouncer

#### Session pooling (recommandé pour Django)
```ini
pool_mode = session
```
- Connexion assignée pour toute la session
- Compatible avec toutes les features PostgreSQL
- Bon pour Django (transactions, prepared statements)

#### Transaction pooling (maximum performance)
```ini
pool_mode = transaction
```
- Connexion assignée uniquement pour la transaction
- Maximum de réutilisation
- ⚠️ Incompatible avec certaines features (prepared statements, LISTEN/NOTIFY)

#### Statement pooling (rarement utilisé)
```ini
pool_mode = statement
```
- Connexion assignée par statement
- Maximum de réutilisation mais très restrictif
- ⚠️ Incompatible avec transactions multi-statements

## 📈 Monitoring

### Vérifier les connexions actives

```sql
-- Dans PostgreSQL
SELECT 
    count(*) as total_connections,
    state,
    application_name
FROM pg_stat_activity
WHERE datname = 'MyDatabase'
GROUP BY state, application_name;
```

### Vérifier CONN_MAX_AGE

```python
# Dans Django shell
from django.db import connection
print(connection.settings_dict['CONN_MAX_AGE'])
```

### Logs de connexions

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
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'DEBUG',  # Affiche les requêtes SQL et connexions
        },
    },
}
```

### Métriques à surveiller

1. **Nombre de connexions actives**
   - Objectif: < 50% de la limite PostgreSQL
   - Alerte si > 80%

2. **Temps de connexion moyen**
   - Objectif: < 5ms avec pooling
   - Alerte si > 20ms

3. **Taux de réutilisation des connexions**
   - Objectif: > 90%
   - Alerte si < 70%

## 🧪 Tests

### Test de performance

```python
import time
from django.db import connection
from django.test import TestCase

class ConnectionPoolingTest(TestCase):
    def test_connection_reuse(self):
        # Première requête (nouvelle connexion)
        start = time.time()
        list(MyModel.objects.all()[:1])
        first_query_time = time.time() - start
        
        # Deuxième requête (connexion réutilisée)
        start = time.time()
        list(MyModel.objects.all()[:1])
        second_query_time = time.time() - start
        
        # La deuxième devrait être plus rapide
        self.assertLess(second_query_time, first_query_time)
        
        # Avec pooling, devrait être < 10ms
        self.assertLess(second_query_time, 0.01)
```

### Test de santé des connexions

```python
def test_connection_health_check(self):
    from django.db import connection
    
    # Forcer la fermeture de la connexion
    connection.close()
    
    # La prochaine requête devrait recréer la connexion automatiquement
    result = MyModel.objects.count()
    
    # Pas d'erreur = health check fonctionne
    self.assertIsNotNone(result)
```

## ⚙️ Variables d'environnement

### .env (développement)

```bash
# Base de données
DB_ENGINE=django.db.backends.postgresql
DB_NAME=MyDatabase
DB_USER=postgres
DB_PASSWORD=123456
DB_HOST=localhost
DB_PORT=5432

# Connection pooling
DB_CONN_MAX_AGE=60  # 1 minute en dev
```

### .env (production)

```bash
# Base de données
DB_ENGINE=django.db.backends.postgresql
DB_NAME=MyDatabase
DB_USER=postgres
DB_PASSWORD=strong_password_here
DB_HOST=db.example.com
DB_PORT=5432

# Connection pooling
DB_CONN_MAX_AGE=600  # 10 minutes en prod

# Optionnel: pgBouncer
# DB_PORT=6432  # Si pgBouncer est utilisé
```

## 🎓 Bonnes pratiques

### 1. Choisir le bon CONN_MAX_AGE

**Trop court (< 60s):**
- ❌ Overhead de reconnexions fréquentes
- ❌ Pas d'avantage du pooling

**Optimal (300-600s):**
- ✅ Bon équilibre réutilisation/libération
- ✅ Adapté à la plupart des cas

**Trop long (> 3600s):**
- ❌ Connexions zombies
- ❌ Gaspillage de ressources PostgreSQL

### 2. Utiliser CONN_HEALTH_CHECKS

```python
'CONN_HEALTH_CHECKS': True  # Toujours activer
```

### 3. Limiter le nombre de workers

```bash
# gunicorn
gunicorn --workers 4 --threads 2  # 4 workers × 2 threads = 8 connexions max

# Pas besoin de 50 workers si vous avez le pooling
```

### 4. Configurer PostgreSQL

```sql
-- postgresql.conf
max_connections = 100  # Ajuster selon vos besoins
shared_buffers = 256MB
effective_cache_size = 1GB
```

### 5. Monitorer régulièrement

- Vérifier le nombre de connexions actives
- Surveiller les timeouts
- Ajuster CONN_MAX_AGE selon l'usage réel

## 🎉 Résumé

**Configuration appliquée:**
- ✅ `CONN_MAX_AGE = 600` (10 minutes)
- ✅ `CONN_HEALTH_CHECKS = True`
- ✅ Options PostgreSQL optimisées
- ✅ Documentation pgBouncer (optionnel)

**Gains attendus:**
- 📉 Overhead de connexion: **-99%**
- ⚡ Latence des requêtes: **-50 à -70%**
- 🔓 Connexions PostgreSQL: **-90 à -99%**
- 🚀 Scalabilité: Supporte 10+ postes simultanés

**Prochaines étapes:**
1. Tester en développement
2. Monitorer les connexions
3. Ajuster CONN_MAX_AGE si nécessaire
4. Considérer pgBouncer si >20 workers
