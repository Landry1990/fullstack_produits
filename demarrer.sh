#!/bin/bash
# ══════════════════════════════════════════════════════════
#  LANCEMENT APPLICATION PHARMACIE — Linux/macOS
# ══════════════════════════════════════════════════════════

set -e

cd "$(dirname "$0")"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║           LANCEMENT APPLICATION PHARMACIE               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# --- Vérifier que Docker est démarré ---
echo "[1/3] Vérification de Docker..."
if ! docker info >/dev/null 2>&1; then
    echo ""
    echo "⚠️  Docker n'est pas démarré !"
    echo "   Veuillez lancer Docker et attendre qu'il soit prêt."
    echo "   Puis relancez ce script."
    echo ""
    exit 1
fi
echo "   ✅ Docker est actif"

# --- Lancer les conteneurs ---
echo ""
echo "[2/3] Démarrage des services..."
docker compose up -d --build 2>&1 | grep -iE "Created|Starting|Started" || true

# --- Attendre que le backend réponde ---
echo ""
echo "[3/3] Vérification que tout fonctionne..."
sleep 5

if curl -s http://localhost/api/health/ >/dev/null 2>&1; then
    echo "   ✅ Application prête !"
    echo ""
    echo "══════════════════════════════════════════════════════════"
    echo "   🌐 Ouvrez votre navigateur : http://localhost"
    echo "   👤 Compte par défaut : admin / admin123"
    echo "══════════════════════════════════════════════════════════"
else
    echo "   ⏳ Le backend démarre encore, réessayez dans 30 secondes."
    echo "      Puis ouvrez http://localhost dans votre navigateur."
fi

echo ""
