# Guide de Déploiement & Maintenance — Serveur Client

## 1. Connexion au serveur

```bash
ssh utilisateur@ip_du_serveur
cd /opt/zenith-pharma
```

## 2. Vérifier l'état des conteneurs

```bash
docker compose -f docker-compose.prod.yml ps
```

## 3. Voir les logs

```bash
# Logs complets du backend (100 dernières lignes)
docker compose -f docker-compose.prod.yml logs backend --tail 100

# Suivre les logs en temps réel
docker compose -f docker-compose.prod.yml logs backend -f

# Chercher une erreur dans les logs
docker compose -f docker-compose.prod.yml logs backend 2>&1 | grep -i "error\|traceback" | tail -30

# Logs du frontend
docker compose -f docker-compose.prod.yml logs frontend --tail 50
```

## 4. Mise à jour manuelle (méthode simple — recommandée)

Cette méthode ne nécessite **pas npm** ni **d'internet vers Docker Hub** sur le serveur.
Le frontend est déjà buildé sur le PC du développeur et commité sur GitHub.

```bash
cd /opt/zenith-pharma

# 1ère fois seulement : rendre le script exécutable
chmod +x update.sh

# Récupérer le nouveau code + frontend buildé
git pull

# Lancer la mise à jour (copie backend + frontend + migrations + restart)
./update.sh
```

C'est tout. Le script `update.sh` :
- Copie le code backend dans le conteneur
- Applique les migrations Django
- Collecte les fichiers statiques
- Copie le frontend (dist/) dans le conteneur nginx
- Redémarre le backend et recharge nginx

> **Attention** : si `requirements.txt` a changé (nouvelle librairie Python),
> il FAUT faire un rebuild Docker complet (voir section 4b ci-dessous).

### 4b. Rebuild Docker complet (uniquement si requirements.txt a changé)

```bash
cd /opt/zenith-pharma
git pull

# Rebuild sans re-télécharger les images de base depuis Docker Hub
docker compose -f docker-compose.prod.yml build --no-pull backend
docker compose -f docker-compose.prod.yml up -d backend

# Puis lancer les migrations
docker exec zenith-pharma-backend python manage.py migrate --noinput
```

## 5. Mise à jour automatique (nightly-update.sh)

Le script tourne automatiquement la nuit (par défaut à 02:00).
Il peut aussi être lancé manuellement :

```bash
cd /opt/zenith-pharma
bash nightly-update.sh
```

Le script :
- Vérifie s'il y a des nouveaux commits sur GitHub
- Backup la base de données
- Build les nouvelles images (sans arrêter l'app)
- Bascule les conteneurs
- Lance les migrations
- Fait un rollback automatique si le healthcheck échoue

Logs de mise à jour :
```bash
cat /opt/zenith-pharma/logs/nightly-update.log
```

## 6. Vérifier la version installée

```bash
# Version locale (commit actuel)
git rev-parse HEAD

# Version distante (dernier commit sur GitHub)
git fetch origin main
git rev-parse origin/main

# Comparer
git log --oneline HEAD..origin/main
```

## 7. Tester le check_update depuis le conteneur

```bash
docker compose -f docker-compose.prod.yml exec backend python -c "
import subprocess, os
app_dir = os.environ.get('APP_DIR', '/opt/zenith-pharma')
local = subprocess.run(['git', 'rev-parse', 'HEAD'], capture_output=True, text=True, cwd=app_dir)
print('Local:', local.stdout.strip()[:12])
print('Git error:', local.stderr.strip() if local.stderr else 'none')
"
```

## 8. Problème de permissions .git

Si erreur `Permission denied` sur `.git/FETCH_HEAD` :

```bash
cd /opt/zenith-pharma
sudo chmod -R 777 .git
```

## 9. Espace disque

```bash
# Vérifier l'espace disque
df -h

# Espace utilisé par Docker
docker system df

# Nettoyer les images/couches orphelines
docker system prune -a -f

# Nettoyer uniquement les images non utilisées
docker image prune -f

# Nettoyer le cache de build
docker builder prune -f
```

## 10. Backup de la base de données

```bash
# Backup manuel
bash /opt/zenith-pharma/backup-db.sh

# Voir les backups
ls -la /opt/zenith-pharma/backups/

# Restaurer un backup
docker compose -f docker-compose.prod.yml exec -T db psql -U fullstack_user -d fullstack_db < /opt/zenith-pharma/backups/backup-XXXX.sql
```

## 11. Base de données — commandes utiles

```bash
# Accéder à PostgreSQL
docker compose -f docker-compose.prod.yml exec db psql -U fullstack_user -d fullstack_db

# Lister les tables
\dt

# Compter les produits
SELECT COUNT(*) FROM api_produit;

# Quitter
\q
```

## 12. Migrations Django

```bash
# Appliquer les migrations
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate

# Voir les migrations en attente
docker compose -f docker-compose.prod.yml exec backend python manage.py showmigrations

# Créer de nouvelles migrations
docker compose -f docker-compose.prod.yml exec backend python manage.py makemigrations
```

## 13. Purge des données de test

```bash
# Voir ce qui serait supprimé (dry-run)
docker compose -f docker-compose.prod.yml exec backend python manage.py purge_loadtest_data --dry-run

# Supprimer les données de test
docker compose -f docker-compose.prod.yml exec backend python manage.py purge_loadtest_data
```

## 14. Redémarrer un service

```bash
# Redémarrer le backend
docker compose -f docker-compose.prod.yml restart backend

# Redémarrer le frontend
docker compose -f docker-compose.prod.yml restart frontend

# Redémarrer tout
docker compose -f docker-compose.prod.yml restart
```

## 15. En cas de crash — Rollback

```bash
cd /opt/zenith-pharma

# Rollback vers la version précédente
bash rollback.sh

# Rollback + restauration DB
bash rollback.sh -IncludeDB
```

## 16. Gestion des conteneurs

```bash
# Arrêter tous les conteneurs
docker compose -f docker-compose.prod.yml down

# Démarrer tous les conteneurs
docker compose -f docker-compose.prod.yml up -d

# Arrêter un seul service
docker compose -f docker-compose.prod.yml stop backend

# Démarrer un seul service
docker compose -f docker-compose.prod.yml start backend
```

## 17. Déploiement depuis Windows (développeur)

### Méthode production (serveurs clients — via GitHub)

```powershell
# 1. Builder le frontend sur ton PC
cd frontend/frontend
npm run build
cd ../..

# 2. Commiter le frontend buildé + le code backend
git add -A
git commit -m "feat: description des changements"
git push
```

Puis sur chaque serveur client :
```bash
cd /opt/zenith-pharma
git pull
chmod +x /opt/zenith-pharma/update.sh(executable une seule fois:la premiere fois)
./update.sh
```

### Méthode développement local (Docker Desktop)

```powershell
# Frontend + backend (rapide, usage courant)
.\deploy.ps1 -Target all

# Frontend + backend + migrations + setup DCI
.\deploy.ps1 -Target all-full

# Frontend seul
.\deploy.ps1 -Target frontend

# Backend seul (sans migrations)
.\deploy.ps1 -Target backend

# Backend + migrations + DCI
.\deploy.ps1 -Target backend-full

# Avec backup DB avant déploiement
.\deploy.ps1 -Target all -BackupDB

# Reconstruire les images Docker (changement de requirements.txt, Dockerfile)
.\deploy.ps1 -Target all -Rebuild
```

## 18. Tailscale (accès distant)

```bash
# Voir le statut Tailscale
docker compose -f docker-compose.prod.yml exec tailscale tailscale status

# Voir l'URL d'accès
docker compose -f docker-compose.prod.yml exec tailscale tailscale serve status
```

## 19. Portainer (interface web Docker)

Accessible sur le port 9443 du serveur :
```
https://ip_du_serveur:9443
```

## 20. En cas d'urgence

```bash
# Tout arrêter
docker compose -f docker-compose.prod.yml down

# Tout redémarrer from scratch
docker compose -f docker-compose.prod.yml up -d --remove-orphans

# Vérifier que le backend répond
curl http://localhost:8000/api/health/

# Vérifier que le frontend répond
curl http://localhost/
```
