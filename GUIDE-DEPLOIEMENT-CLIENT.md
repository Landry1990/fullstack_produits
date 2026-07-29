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

## 4. Mise à jour manuelle (depuis le serveur)

```bash
cd /opt/zenith-pharma

# Récupérer le code
git pull origin main

# Reconstruire le backend (utilise le cache, rapide ~1-3 min)
docker compose -f docker-compose.prod.yml build backend

# Reconstruire le frontend (~2-5 min)
docker compose -f docker-compose.prod.yml build frontend

# Reconstruire les deux
docker compose -f docker-compose.prod.yml build

# Redémarrer les conteneurs
docker compose -f docker-compose.prod.yml up -d

# Redémarrer uniquement le backend
docker compose -f docker-compose.prod.yml up -d backend
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

```powershell
# Déployer le frontend uniquement
pwsh -File "c:\Projet Fullstack\fullstack_produits\deploy.ps1" -Target frontend

# Déployer le backend uniquement
pwsh -File "c:\Projet Fullstack\fullstack_produits\deploy.ps1" -Target backend

# Déployer tout (sans migrations)
pwsh -File "c:\Projet Fullstack\fullstack_produits\deploy.ps1" -Target all

# Déployer tout + migrations + DCI
pwsh -File "c:\Projet Fullstack\fullstack_produits\deploy.ps1" -Target all-full

# Avec backup DB avant déploiement
pwsh -File "c:\Projet Fullstack\fullstack_produits\deploy.ps1" -Target all -BackupDB

# Reconstruire les images Docker
pwsh -File "c:\Projet Fullstack\fullstack_produits\deploy.ps1" -Target all -Rebuild
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
