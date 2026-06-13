# 🔧 Maintenance & Troubleshooting

## 🚀 Commandes Essentielles

### Démarrage / Arrêt

```bash
# Windows (PowerShell)
.\DEMARRER.bat        # Démarrer tout
.\ARRETER.bat         # Arrêter tout
.\ETAT.bat            # Vérifier l'état

# Linux / macOS (Bash)
./demarrer.sh
./arreter.sh
./etat.sh

# Manuel (tous OS)
docker compose up -d --build
docker compose stop
docker compose down -v   # ⚠️ Supprime aussi les volumes
```

### Vérification d'État

```bash
# Voir les conteneurs en cours
docker ps

# Voir les logs en temps réel
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db

# Voir tous les logs
docker compose logs --tail=100
```

---

## 📊 Monitoring & Santé

### Health Checks

```bash
# Backend
http://localhost/api/health/

# Frontend (Nginx)
wget -qO- http://localhost/ > /dev/null && echo "OK" || echo "FAIL"

# PostgreSQL
docker exec fullstack_produits-db-1 pg_isready -U postgres

# Redis
docker exec fullstack_produits-redis-1 redis-cli ping
```

### Métriques Docker

```bash
# Statistiques ressources
docker stats --no-stream

# Espace disque utilisé par Docker
docker system df -v
```

---

## 🔍 Troubleshooting

### Problème 1 : Impossible de se connecter

**Symptômes** : Page blanche, "Connexion refusée"

**Vérifications** :
```bash
# 1. Conteneurs tournent ?
docker ps

# 2. Ports libres ?
netstat -ano | findstr :80
netstat -ano | findstr :8000

# 3. Logs erreurs ?
docker compose logs backend | tail -50
```

**Solutions** :
```bash
# Redémarrer tout
docker compose down
docker compose up -d

# Si conflit port 80
# Modifier .env : FRONTEND_PORT=8080
```

### Problème 2 : Base de données inaccessible

**Symptômes** : "FATAL: database does not exist", erreurs 500 sur API

**Vérifications** :
```bash
# Vérifier PostgreSQL
docker exec fullstack_produits-db-1 pg_isready -U postgres

# Voir logs PostgreSQL
docker compose logs db | tail -50
```

**Solutions** :
```bash
# Si base corrompue (avec backup !)
docker compose down -v
docker compose up -d db
sleep 10
docker exec -i fullstack_produits-db-1 psql -U postgres -d pharma_db < backup.sql
```

### Problème 3 : Frontend ne se met pas à jour

**Symptômes** : Ancienne version affichée après modification

**Solutions** :
```bash
# Rebuild complet
docker compose down frontend
docker compose build --no-cache frontend
docker compose up -d frontend

# Ou forcer reload navigateur
Ctrl + F5  (Windows/Linux)
Cmd + Shift + R  (Mac)
```

### Problème 4 : Lentesse extrême

**Vérifications** :
```bash
# Ressources système
docker stats --no-stream

# Connexions DB
docker exec fullstack_produits-db-1 psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Logs requêtes lentes
docker compose logs backend | grep -i "slow\|timeout"
```

**Solutions** :
```bash
# Redémarrer services
docker compose restart backend redis

# Vider cache Redis
docker exec fullstack_produits-redis-1 redis-cli FLUSHALL

# Si persistant : augmenter RAM/CPU dans docker-compose.prod.yml
```

### Problème 5 : Erreurs 500 sur API

**Vérifications** :
```bash
# Logs backend
docker compose logs backend --tail=100

# Vérifier migrations
docker exec fullstack_produits-backend-1 python manage.py showmigrations
```

**Solutions** :
```bash
# Appliquer migrations manquantes
docker exec fullstack_produits-backend-1 python manage.py migrate

# Si erreur migration
docker exec fullstack_produits-backend-1 python manage.py migrate --fake-initial
```

### Problème 6 : Caisse bloquée / Session caisse

**Vérifications** :
```bash
# Voir sessions caisse actives
docker exec fullstack_produits-db-1 psql -U postgres -d pharma_db -c "SELECT * FROM api_sessioncaisse WHERE est_ouverte = true;"
```

**Solutions** :
```bash
# Forcer fermeture session
docker exec fullstack_produits-db-1 psql -U postgres -d pharma_db -c "UPDATE api_sessioncaisse SET est_ouverte = false WHERE caisse_id = X;"
```

---

## 🧹 Maintenance Régulière

### Quotidienne

```bash
# Vérifier l'état
docker ps

# Vérifier logs erreurs
docker compose logs --since=24h | grep -i "error\|exception\|fail"
```

### Hebdomadaire

```bash
# Nettoyer images/conteneurs inutilisés
docker system prune -f

# Vérifier espace disque
df -h  # Linux
Get-PSDrive C  # Windows PowerShell

# Rotation des logs
docker logs --tail=0 fullstack_produits-backend-1 > /dev/null 2>&1
```

### Mensuelle

```bash
# Mise à jour images de base
docker compose pull
docker compose up -d

# Test backup restauration
bash scripts/backup-universal.sh
bash scripts/restore-universal.sh [date_backup]  # Sur environnement test

# Analyse performance
docker exec fullstack_produits-db-1 psql -U postgres -c "SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del FROM pg_stat_user_tables ORDER BY n_tup_ins DESC LIMIT 10;"
```

---

## 🆘 Emergency Procedures

### Procédure 1 : Reset Complet (DANGER)

⚠️ **PERD TOUTES LES DONNÉES** - Nécessite backup

```bash
# 1. Backup avant (si possible)
bash scripts/backup-universal.sh

# 2. Arrêter et supprimer tout
docker compose down -v
docker volume prune -f

# 3. Recréer
docker compose up -d --build

# 4. Restaurer backup
docker exec -i fullstack_produits-db-1 psql -U postgres < backup.sql
```

### Procédure 2 : Réinstallation Propre

```bash
# 1. Sauvegarder données si possible
docker exec fullstack_produits-db-1 pg_dump -U postgres pharma_db > sauvegarde_urgence.sql

# 2. Supprimer ancien environnement
docker compose down -v
docker rmi -f $(docker images -q)
docker volume rm $(docker volume ls -q)

# 3. Recloner / Réextraire le projet
# (si nécessaire)

# 4. Rebuild complet
docker compose -f docker-compose.prod.yml up -d --build

# 5. Restaurer données
docker exec -i fullstack_produits-db-1 psql -U postgres -d pharma_db < sauvegarde_urgence.sql
```

### Procédure 3 : Récupération Backup

Voir [BACKUP.md](BACKUP.md) pour procédures détaillées.

---

## 🔧 Commandes Avancées

### Base de Données

```bash
# Se connecter à PostgreSQL
docker exec -it fullstack_produits-db-1 psql -U postgres -d pharma_db

# Exécuter une requête SQL
docker exec fullstack_produits-db-1 psql -U postgres -d pharma_db -c "SELECT * FROM api_produit LIMIT 5;"

# Exporter une table
docker exec fullstack_produits-db-1 pg_dump -U postgres -d pharma_db --table=api_facture > factures.sql

# Vider une table (ATTENTION)
docker exec fullstack_produits-db-1 psql -U postgres -d pharma_db -c "TRUNCATE TABLE api_test;"
```

### Redis

```bash
# Se connecter à Redis
docker exec -it fullstack_produits-redis-1 redis-cli

# Vider tout le cache
FLUSHALL

# Voir clés
KEYS *

# Supprimer une clé
DEL nom_de_la_cle
```

### Backend Django

```bash
# Shell Django
docker exec -it fullstack_produits-backend-1 python manage.py shell

# Créer superutilisateur
docker exec -it fullstack_produits-backend-1 python manage.py createsuperuser

# Collecter fichiers statiques
docker exec fullstack_produits-backend-1 python manage.py collectstatic --noinput

# Tester email
docker exec fullstack_produits-backend-1 python -c "from django.core.mail import send_mail; send_mail('Test', 'Message', 'from@example.com', ['to@example.com'], fail_silently=False)"
```

### Fichiers & Volumes

```bash
# Copier depuis conteneur vers hôte
docker cp fullstack_produits-backend-1:/app/media/ ./backup-media/

# Copier depuis hôte vers conteneur
docker cp ./fichier.sql fullstack_produits-db-1:/tmp/

# Voir contenu volume
docker run --rm -v fullstack_produits_postgres_data:/data alpine ls -la /data
```

---

## 📞 Support & Debug

### Outils de Debug

```bash
# Network debugging
docker network ls
docker network inspect fullstack_produits_app-network

# Process dans conteneur
docker exec fullstack_produits-backend-1 top

# Fichiers ouverts
docker exec fullstack_produits-backend-1 lsof | wc -l
```

### Où chercher de l'aide

1. **Logs** : Toujours la première source d'information
2. **Documentation** : Ce dossier et fichiers .md associés
3. **Docker** : `docker inspect [container]` pour configuration
4. **PostgreSQL** : Logs dans `docker compose logs db`

---

## 📋 Checklist Maintenance Mensuelle

- [ ] Vérifier espace disque (>20% libre)
- [ ] Vérifier mémoire disponible (>2GB libre)
- [ ] Tester backup et restauration
- [ ] Vérifier erreurs dans les logs
- [ ] Mettre à jour images Docker (test d'abord)
- [ ] Vérifier performances API (temps réponse)
- [ ] Nettoyer anciens conteneurs/images
- [ ] Documenter changements effectués

---

**Dernière mise à jour** : Juin 2026

Pour modifications majeures, consulter [ARCHITECTURE.md](ARCHITECTURE.md) et tester sur environnement de développement d'abord.
