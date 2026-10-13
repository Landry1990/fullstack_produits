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
# Les chmod +x faits par install.sh/update-app.sh ne doivent pas être vus
# comme des modifications locales (bloqueraient le merge).
git config --local core.fileMode false

# Hash AVANT le pull — pour détecter les fichiers protégés modifiés.
BEFORE_HASH=$(git rev-parse HEAD)

# dist/ est un artefact de build tracké : il peut être localement "modifié"
# (rebuild sur place, fins de ligne) et bloque le merge — autostash ne
# s'applique qu'aux rebases, pas aux merges. On le réinitialise, le pull
# ramène la version commitée.
git checkout -- frontend/frontend/dist/ 2>/dev/null || true
# Idem pour les fichiers NON trackés dans dist/ (assets hashés générés
# localement) : s'ils entrent en collision avec le merge ("untracked
# working tree files would be overwritten"), le pull avorterait aussi.
git clean -fdq frontend/frontend/dist/ 2>/dev/null || true

git pull --autostash

# Détecter si des fichiers qui exigent un rebuild d'image ont changé :
# - fichiers Cythonisés (.so prioritaires sur .py dans l'image → le
#   docker cp ci-dessous serait ignoré)
# - entrypoint.sh / requirements.txt / Dockerfile (hors du docker cp api/)
CHANGED_FILES=$(git diff --name-only "$BEFORE_HASH" HEAD 2>/dev/null || echo "")
NEEDS_REBUILD=""
echo "$CHANGED_FILES" | grep -Eq 'middleware_licence|utils_licence|entrypoint\.sh|requirements\.txt|Dockerfile' \
    && NEEDS_REBUILD="yes"

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
if [ "$NEEDS_REBUILD" = "yes" ]; then
    echo "============================================================"
    echo "  ⚠️  REBUILD D'IMAGE REQUIS"
    echo "  Des fichiers compilés/système ont changé (middleware_licence,"
    echo "  utils_licence, entrypoint.sh, requirements ou Dockerfile)."
    echo "  Le hot-deploy ci-dessus NE les applique PAS. Lance :"
    echo ""
    echo "    docker compose -f docker-compose.prod.yml build backend"
    echo "    docker compose -f docker-compose.prod.yml up -d backend"
    echo "============================================================"
fi

echo ""
echo "========================================"
echo "  Mise à jour terminée !"
echo "========================================"
echo ""
echo "Pense à faire Ctrl+F5 dans le navigateur."
