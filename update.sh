#!/bin/bash
#
# Script de mise à jour production — sans rebuild Docker, sans npm
# Tout vient de git (backend + frontend déjà buildé).
#
# Usage sur le serveur : ./update.sh
#
# Ce script :
#   1. git pull (récupère le code backend + le frontend buildé)
#   2. Copie le backend dans le conteneur + migrations + restart
#   3. Copie le frontend (dist/) dans le conteneur nginx + reload
#
# Le serveur n'a besoin QUE de git et docker. Pas de npm, pas d'internet
# vers Docker Hub.
#
# Si requirements.txt a changé, il FAUT faire un rebuild Docker complet :
#   docker compose -f docker-compose.prod.yml build --no-pull backend
#   docker compose -f docker-compose.prod.yml up -d backend
#

set -e

cd /opt/zenith-pharma

echo "========================================"
echo "  Mise à jour Zenith Pharma (prod)"
echo "========================================"

# 1. Récupérer le nouveau code (backend + frontend buildé)
echo ""
echo ">> Git pull..."
git pull

# 2. Backend : copier le code api/ dans le conteneur
echo ""
echo ">> Copie du code backend..."
docker cp backend/api/. zenith-pharma-backend:/app/api/
docker cp backend/manage.py zenith-pharma-backend:/app/manage.py 2>/dev/null || true

# 3. Migrations
echo ""
echo ">> Application des migrations..."
docker exec zenith-pharma-backend python manage.py migrate --noinput

# 4. Fichiers statiques
echo ""
echo ">> Collecte des fichiers statiques..."
docker exec zenith-pharma-backend python manage.py collectstatic --noinput --clear

# 5. Redémarrer le backend
echo ""
echo ">> Redémarrage backend..."
docker restart zenith-pharma-backend

# 6. Frontend : copier dist/ dans le conteneur nginx
echo ""
echo ">> Copie du frontend..."
docker cp frontend/frontend/dist/. zenith-pharma-frontend:/usr/share/nginx/html/
docker exec zenith-pharma-frontend nginx -s reload

echo ""
echo "========================================"
echo "  Mise à jour terminée !"
echo "========================================"
echo ""
echo "Pense à faire Ctrl+F5 dans le navigateur."
