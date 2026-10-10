#!/usr/bin/env bash
# ============================================================
# Lance le watchdog Docker en arriere-plan (Linux/Ubuntu)
# Usage: ./start-watchdog.sh [--background] [--dry-run] [--interval 30]
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKGROUND=false
DRY_RUN=false
INTERVAL=30

# Parse args
for arg in "$@"; do
    case "$arg" in
        --background) BACKGROUND=true ;;
        --dry-run)    DRY_RUN=true ;;
        --interval)   INTERVAL="${2:-30}" ;;
    esac
done

WATCHDOG_SCRIPT="$SCRIPT_DIR/watchdog.sh"
if [[ ! -f "$WATCHDOG_SCRIPT" ]]; then
    echo -e "\033[0;31m❌ watchdog.sh introuvable\033[0m"
    exit 1
fi

LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/watchdog.log"

if [[ "$BACKGROUND" == "true" ]]; then
    echo -e "\033[0;36m🐕 Lancement du watchdog en ARRIERE-PLAN...\033[0m"
    echo -e "   Logs: $LOG_FILE"
    echo -e "   Intervalle: ${INTERVAL}s"
    echo -e "   DryRun: $DRY_RUN"
    echo ""

    nohup bash "$WATCHDOG_SCRIPT" --interval "$INTERVAL" --log "$LOG_FILE" $([[ "$DRY_RUN" == "true" ]] && echo "--dry-run") > /dev/null 2>&1 &
    PID=$!

    sleep 2
    if kill -0 $PID 2>/dev/null; then
        echo -e "\033[0;32m✅ Watchdog lance (PID: $PID)\033[0m"
        echo ""
        echo "Commandes :"
        echo "  Voir logs : tail -f $LOG_FILE"
        echo "  Stopper   : kill $PID"
        echo "  Status    : ps aux | grep watchdog"
    else
        echo -e "\033[0;31m❌ Erreur de demarrage du watchdog\033[0m"
    fi
else
    echo -e "\033[0;36m🐕 Lancement du watchdog en PREMIER PLAN...\033[0m"
    echo -e "   Appuyez sur Ctrl+C pour arreter"
    echo ""

    bash "$WATCHDOG_SCRIPT" --interval "$INTERVAL" --log "$LOG_FILE" $([[ "$DRY_RUN" == "true" ]] && echo "--dry-run")
fi
