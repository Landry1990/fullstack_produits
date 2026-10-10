#!/bin/bash
# ══════════════════════════════════════════════════════════
#  ÉTAT DES SERVICES — Linux/macOS
# ══════════════════════════════════════════════════════════

cd "$(dirname "$0")"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ÉTAT DES SERVICES                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo "--- Docker ---"
if docker info >/dev/null 2>&1; then
    echo "   ✅ Docker est actif"
else
    echo "   ❌ Docker est éteint"
    echo "      Démarrez Docker d'abord."
    exit 1
fi

echo ""
echo "--- Conteneurs ---"
docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.State}}"

echo ""
echo "--- Espace disque ---"
docker system df 2>&1 | grep -iE "images|volumes|Local" || true

echo ""
echo "--- Test de l'application ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Application répond (HTTP 200)"
    echo "   🌐 http://localhost est accessible"
else
    echo "   ❌ Application ne répond pas (HTTP $HTTP_CODE)"
    echo "      Essayez de relancer avec ./demarrer.sh"
fi

echo ""
