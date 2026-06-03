---
description: Déploiement rapide sans rebuild Docker
---

# Déploiement Application Zenith Pharma

Méthode rapide pour déployer les modifications **sans** utiliser `--no-cache` (évite les problèmes réseau Docker).

## Frontend

```bash
# 1. Build local
cd frontend/frontend
npm run build

// turbo
# 2. Copier vers conteneur nginx
docker cp dist/. fullstack_produits-frontend-1:/usr/share/nginx/html/

// turbo
# 3. Recharger nginx
docker exec fullstack_produits-frontend-1 nginx -s reload
```

## Backend (modèles Python)

```bash
# 1. Copier les fichiers modifiés
docker cp backend/api/models/__init__.py fullstack_produits-backend-1:/app/api/models/__init__.py
docker cp backend/api/models/communication.py fullstack_produits-backend-1:/app/api/models/communication.py
docker cp backend/api/serializers.py fullstack_produits-backend-1:/app/api/serializers.py
docker cp backend/api/views/communication.py fullstack_produits-backend-1:/app/api/views/communication.py
docker cp backend/api/urls.py fullstack_produits-backend-1:/app/api/urls.py
docker cp backend/api/telegram_service.py fullstack_produits-backend-1:/app/api/telegram_service.py

// turbo
# 2. Créer et appliquer migrations
docker exec fullstack_produits-backend-1 python manage.py makemigrations
docker exec fullstack_produits-backend-1 python manage.py migrate

// turbo
# 3. Redémarrer le backend
docker restart fullstack_produits-backend-1
```

## Backend (uniquement views/urls sans modèles)

```bash
// turbo
# Copier et redémarrer (pas besoin de migration)
docker cp backend/api/views/mon_fichier.py fullstack_produits-backend-1:/app/api/views/
docker restart fullstack_produits-backend-1
```

## ⚠️ À éviter

- **NE PAS** utiliser `docker build --no-cache` (re-télécharge tout)
- **NE PAS** utiliser `docker system prune` (supprime les images de base)
- **NE PAS** faire `docker compose down` puis `up` (perd les données si pas de volume)

## ✅ Préférer

- `docker cp` pour copier les fichiers
- `docker restart` pour recharger
- `docker exec` pour les commandes Django
