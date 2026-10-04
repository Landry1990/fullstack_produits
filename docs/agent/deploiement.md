# Déploiement

> Référence détaillée — l'essentiel est dans AGENTS.md à la racine.

### Déploiement

#### En développement (local, Docker Desktop)

Utiliser `deploy.ps1` (sans rebuild Docker, copie directe dans les conteneurs) :

```powershell
# Frontend + backend (rapide, usage courant)
.\deploy.ps1 -Target all

# Frontend + backend + migrations + setup DCI (changements de modèles)
.\deploy.ps1 -Target all-full

# Frontend seul
.\deploy.ps1 -Target frontend

# Backend seul (sans migrations)
.\deploy.ps1 -Target backend

# Backend + migrations + DCI
.\deploy.ps1 -Target backend-full

# Avec backup DB avant déploiement
.\deploy.ps1 -Target all -BackupDB

# Rebuild complet des images Docker (changement de requirements.txt, Dockerfile)
.\deploy.ps1 -Target all -Rebuild
```

Le script `deploy.ps1` :
- **Frontend** : `npm run build` → `docker cp dist/` → `nginx -s reload`
- **Backend** : `docker cp backend/api/` → `docker restart`
- Détecte automatiquement les noms des conteneurs (dev ou prod)
- Avec `-Rebuild` : reconstruit les images via `docker compose build`

⚠️ En dev, le volume `./backend:/app` remet les `.py` sources à chaque démarrage.
La compilation Cython ne s'applique pas en dev — seulement en prod via le build Docker.

#### En production (serveur client)

```bash
cd /opt/zenith-pharma
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Le build Docker prod :
- Compile les fichiers critiques en `.so` via Cython (cf. section Compilation Cython)
- Le client ne reçoit que les binaires — impossible de modifier le code source

⚠️ Après un déploiement, le client doit faire un **Ctrl+F5** (hard reload) pour
invalider le cache PWA du navigateur.

### Noms des containers Docker

#### En développement (`docker-compose.yml`)

Les noms sont auto-générés : `fullstack_produits-<service>-1` (ex: `fullstack_produits-backend-1`).

#### En production (`docker-compose.prod.yml`)

Les noms sont explicites (`container_name`) :

| Service    | Nom du container           |
|------------|----------------------------|
| Backend    | `zenith-pharma-backend`    |
| Frontend   | `zenith-pharma-frontend`   |
| DB         | `zenith-pharma-db`         |
| Redis      | `zenith-pharma-redis`      |
| Tailscale  | `zenith-pharma-tailscale`  |

### Checklist déploiement client

Avant toute release en production :

- [ ] `npm run build` passe sans erreur
- [ ] `python manage.py test` (ou tests backend pertinents) passent
- [ ] `git status` et `git diff` revus
- [ ] Pas de secrets dans les diff
- [ ] Backup DB si le changement touche les données
- [ ] Build Docker prod : `docker compose -f docker-compose.prod.yml build backend [frontend]`
- [ ] Redémarrage : `docker compose -f docker-compose.prod.yml up -d`
- [ ] Client prévenu de faire **Ctrl+F5** pour invalider le cache PWA
