# ⚙️ Configuration Système

## Variables d'Environnement

### Fichier `.env` (Racine du projet)

```env
# ====================
# BASE DE DONNÉES
# ====================
DB_NAME=fullstack_db
DB_USER=fullstack_user
DB_PASSWORD=fullstack_password
DB_HOST=db
DB_PORT=5432

# ====================
# DJANGO BACKEND
# ====================
DJANGO_SECRET_KEY=votre_cle_secrete_ici
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,frontend

# CORS (Cross-Origin Resource Sharing)
CORS_ALLOWED_ORIGINS=http://localhost,http://127.0.0.1,http://frontend
CSRF_TRUSTED_ORIGINS=http://localhost,http://127.0.0.1,http://frontend
CORS_ALLOW_ALL=false

# Import automatique fournisseurs
SUPPLIER_DATA=FOURNISSEUR1

# ====================
# CACHE REDIS
# ====================
REDIS_URL=redis://redis:6379/0

# ====================
# FRONTEND
# ====================
FRONTEND_PORT=80

# ====================
# TAILSCALE (Accès externe)
# ====================
TAILSCALE_AUTHKEY=tskey-auth-xxx
TAILSCALE_HOSTNAME=fullstack-app

# ====================
# NGROK (Tunnel alternatif)
# ====================
NGROK_AUTHTOKEN=votre_token_ngrok
```

---

## Ports Réseau

| Service | Port Interne | Port Externe | Description |
|---------|--------------|--------------|-------------|
| **Frontend** | 80 | 80 | Interface utilisateur |
| **Backend** | 8000 | 8000 | API Django |
| **PostgreSQL** | 5432 | - | Base de données |
| **Redis** | 6379 | - | Cache |
| **Ngrok** | 4040 | 4040 | Dashboard tunnel |

---

## Conteneurs Docker

| Service | Image | Mémoire Limite | CPU |
|---------|-------|----------------|-----|
| **frontend** | nginx:alpine | 512M | 0.5 |
| **backend** | python:3.11 | 4G | 3.0 |
| **db** | postgres:15-alpine | 2G | 2.0 |
| **redis** | redis:7-alpine | 512M | 0.5 |
| **tailscale** | tailscale/tailscale | 256M | 0.25 |
| **ngrok** | ngrok/ngrok | 256M | 0.25 |

---

## Chemins Importants

### Windows (WSL)
```
C:\Projet Fullstack\fullstack_produits\    # Projet
C:\backup\incremental\                      # Backups incrémentaux
C:\backup\full\                             # Backups complets
```

### Linux
```
/opt/pharma-gestion/                         # Projet
/backup/incremental/                        # Backups incrémentaux
/backup/full/                                # Backups complets
```

### Dans les Conteneurs
```
/app/                                       # Backend Django
/app/staticfiles/                           # Fichiers statiques
/app/media/                                 # Uploads utilisateurs
/var/lib/postgresql/data/                   # Données PostgreSQL
```

---

## Configuration Backup

### Rétention
- **Backups incrémentaux** : 48 heures
- **Backups complets** : 7 jours

### Tables sauvegardées (priorité)
1. **Ventes** (CRITIQUE) : `api_facture`, `api_lignefacture`, `api_sessionticket`
2. **Stocks** : `api_mouvementstock`, `api_inventaire`, `api_ligneinventaire`
3. **Comptabilité** : `api_ecriture`, `api_operation`, `api_journalcaisse`
4. **Commandes** : `api_commande`, `api_lignecommande`
5. **Autres** : `api_couponmonnaie`, `api_sessioncaisse`, `api_client`, `api_paiement`

---

## Fichiers de Configuration Clés

| Fichier | Description |
|---------|-------------|
| `.env` | Variables d'environnement principales |
| `docker-compose.yml` | Configuration Docker développement |
| `docker-compose.prod.yml` | Configuration Docker production |
| `backend/backend/settings.py` | Configuration Django |
| `frontend/frontend/Dockerfile.prod` | Build production frontend |

---

## Paramètres Backend (settings.py)

### Sécurité
- `DEBUG = False` (production)
- `SECURE_SSL_REDIRECT = True` (HTTPS)
- `SESSION_COOKIE_SECURE = True`
- `CSRF_COOKIE_SECURE = True`

### Performance
- Connection pooling : 20 connexions max
- Cache Redis activé
- Query optimization (select_related, prefetch_related)

### Planificateur (Scheduler)
- Exécution toutes les heures
- Tâches : Rotation stock, Seuils min/max, Alertes licence

---

## Notes Importantes

⚠️ **Ne jamais modifier** :
- `postgres_data/` directement
- Les volumes Docker sans sauvegarde préalable
- Le fichier `.env` sans backup

✅ **À faire régulièrement** :
- Vérifier les logs : `docker compose logs -f`
- Tester les backups : `scripts/backup-universal.sh`
- Mettre à jour les dépendances : `pip install -r requirements.txt`
