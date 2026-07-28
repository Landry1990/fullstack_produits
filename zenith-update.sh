#!/usr/bin/env bash
# ============================================================
# zenith-update.sh — Mise à jour Zenith Pharma en une commande
# Usage : bash zenith-update.sh
# ============================================================

set -euo pipefail

APP_DIR="/opt/zenith-pharma"

# Auto-correction des permissions
if [ ! -x "$0" ]; then
    chmod +x "$0" 2>/dev/null || sudo chmod +x "$0" 2>/dev/null || true
    exec "$0" "$@"
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Mise à jour de Zenith Pharma           ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Vérifier la connexion internet
if ! ping -c 1 github.com &>/dev/null; then
    echo "⚠ Pas de connexion Internet. Branchez le câble réseau ou le Wi-Fi, puis relancez cette commande."
    echo ""
    read -p "Appuyez sur Entrée pour quitter..."
    exit 0
fi

cd "$APP_DIR" || {
    echo "❌ Dossier Zenith Pharma introuvable ($APP_DIR)"
    read -p "Appuyez sur Entrée pour quitter..."
    exit 1
}

# Récupérer les dernières mises à jour
echo "📥 Récupération des mises à jour..."
git pull origin main 2>/dev/null || true

# Corriger les permissions du script principal
chmod +x nightly-update.sh 2>/dev/null || sudo chmod +x nightly-update.sh 2>/dev/null || true

# Lancer la mise à jour
echo "🔄 Lancement de la mise à jour..."
echo ""
bash nightly-update.sh

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Mise à jour terminée !                 ║"
echo "╚══════════════════════════════════════════╝"
echo ""
read -p "Appuyez sur Entrée pour quitter..."
