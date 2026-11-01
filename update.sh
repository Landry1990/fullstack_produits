#!/bin/bash
#
# Script de mise à jour production — hot-deploy backend, rebuild frontend
#
# Usage sur le serveur : ./update.sh
#
# Ce script :
#   1. git pull (récupère le code backend + les sources frontend)
#   2. Copie le backend dans le conteneur + migrations + restart
#   3. Rebuild l'image frontend via docker compose UNIQUEMENT si
#      frontend/ a changé (npm tourne dans le builder Docker, pas besoin
#      de npm sur le serveur — mais d'un accès au registry npm)
#
# Le serveur n'a besoin QUE de git et docker.
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

# dist/ n'est plus versionné (artefact de build). Sur les anciens checkouts
# il peut rester tracké/modifié localement et bloquer le merge — on le
# réinitialise + on nettoie les non-trackés. No-op une fois le nouveau
# commit récupéré.
git checkout -- frontend/frontend/dist/ 2>/dev/null || true
git clean -fdq frontend/frontend/dist/ 2>/dev/null || true

git pull --autostash

# Détecter si des fichiers qui exigent un rebuild d'image ont changé :
# - fichiers Cythonisés (.so prioritaires sur .py dans l'image → le
#   docker cp ci-dessous serait ignoré)
# - entrypoint.sh / requirements.txt / Dockerfile (hors du docker cp api/)
CHANGED_FILES=$(git diff --name-only "$BEFORE_HASH" HEAD 2>/dev/null || echo "")
NEEDS_REBUILD=""
echo "$CHANGED_FILES" | grep -Eq 'middleware_licence|utils_licence|entrypoint\.sh|requirements\.txt|backend/Dockerfile' \
    && NEEDS_REBUILD="yes"
# Le frontend n'est plus hot-deployé (dist/ non versionné) : si des sources
# frontend ont changé, on rebuild l'image à l'étape 6.
FRONTEND_CHANGED=""
echo "$CHANGED_FILES" | grep -Eq '^frontend/' && FRONTEND_CHANGED="yes"

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

# 6. Frontend : rebuild de l'image si des sources ont changé.
# dist/ n'est plus versionné — le build se fait dans le stage builder
# Node du Dockerfile.prod (npm install/build à l'intérieur de Docker).
if [ "$FRONTEND_CHANGED" = "yes" ]; then
    echo ""
    echo ">> Sources frontend modifiées — rebuild de l'image..."
    export GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    docker compose -f docker-compose.prod.yml build frontend
    docker compose -f docker-compose.prod.yml up -d frontend
else
    echo ""
    echo ">> Frontend inchangé — skip rebuild"
fi

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
