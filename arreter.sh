#!/bin/bash
# ══════════════════════════════════════════════════════════
#  ARRÊT APPLICATION PHARMACIE — Linux/macOS
# ══════════════════════════════════════════════════════════

cd "$(dirname "$0")"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║           ARRÊT APPLICATION PHARMACIE                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

echo "[1/2] Arrêt des conteneurs..."
docker compose stop 2>&1 | grep -i "Stopped" || true
echo "   ✅ Services arrêtés"

echo ""
echo "[2/2] Vérification..."
RUNNING=$(docker compose ps -q 2>/dev/null | wc -l)
if [ "$RUNNING" -eq 0 ]; then
    echo "   ✅ Tous les conteneurs sont bien arrêtés."
else
    echo "   ⚠️  $RUNNING conteneur(s) tournent encore."
    echo "      Utilisez ./arreter_total.sh pour tout fermer."
fi

echo ""
