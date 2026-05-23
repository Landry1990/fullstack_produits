#!/usr/bin/env bash
# ============================================================
# Setup cron heureux comme fallback (Linux/Ubuntu)
# Usage: sudo ./setup-cron.sh [--interval hourly]
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTERVAL="hourly"

# Parse args
while [[ $# -gt 0 ]]; do
    case "$1" in
        --interval)
            INTERVAL="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

echo ""
echo "🕐 Configuration du cron de fallback..."
echo "   Intervalle: $INTERVAL"
echo "   Script: $SCRIPT_DIR/auto-deploy.sh"
echo ""

# Creer la ligne cron
CRON_LINE="0 * * * * cd $SCRIPT_DIR && bash $SCRIPT_DIR/auto-deploy.sh >> $SCRIPT_DIR/logs/auto-deploy-cron.log 2>&1"
if [[ "$INTERVAL" == "daily" ]]; then
    CRON_LINE="0 2 * * * cd $SCRIPT_DIR && bash $SCRIPT_DIR/auto-deploy.sh >> $SCRIPT_DIR/logs/auto-deploy-cron.log 2>&1"
fi

# Ajouter au crontab de l utilisateur courant
(crontab -l 2>/dev/null | grep -v "auto-deploy.sh" || true; echo "$CRON_LINE") | crontab -

echo "✅ Cron configure :"
echo "   $CRON_LINE"
echo ""
echo "Commandes utiles :"
echo "   crontab -l     # Lister les taches"
echo "   crontab -e     # Editer"
echo ""
