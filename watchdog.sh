#!/usr/bin/env bash
# ============================================================
# Watchdog Docker - Surveillance auto + rollback si crash
# Usage: ./watchdog.sh [--interval 30] [--log logs/watchdog.log] [--dry-run]
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTERVAL=30
LOG_PATH="$SCRIPT_DIR/logs/watchdog.log"
DRY_RUN=false

# Parse args
for ((i=1; i<=$#; i++)); do
    arg="${!i}"
    case "$arg" in
        --interval) next=$((i+1)); INTERVAL="${!next:-30}" ;;
        --log)      next=$((i+1)); LOG_PATH="${!next:-$LOG_PATH}" ;;
        --dry-run)  DRY_RUN=true ;;
    esac
done

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m'

# Creer dossier logs
LOG_DIR="$(dirname "$LOG_PATH")"
mkdir -p "$LOG_DIR"

log() {
    local level="${2:-INFO}"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local line="[$timestamp] [$level] $1"
    echo -e "$line"
    echo "$line" >> "$LOG_PATH" 2>/dev/null || true
}

get_container_health() {
    local name="$1"
    local status health
    status=$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null || echo "unknown")
    health=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo "")
    echo "${status}:${health}"
}

invoke_rollback() {
    log "🚨 DECLENCHEMENT ROLLBACK AUTOMATIQUE" "ALERT"

    local rollback_script="$SCRIPT_DIR/rollback.sh"
    if [[ ! -f "$rollback_script" ]]; then
        log "❌ rollback.sh introuvable !" "ERROR"
        return 1
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY-RUN] Rollback simule - pas d'action reelle" "WARN"
        return 0
    fi

    # Backup DB avant rollback
    local backup_script="$SCRIPT_DIR/backup-db.sh"
    if [[ -f "$backup_script" ]]; then
        log "💾 Backup DB pre-rollback..." "INFO"
        bash "$backup_script" 2>&1 | while read -r line; do log "  $line" "INFO"; done || true
    fi

    # Rollback force
    bash "$rollback_script" --force 2>&1 | while read -r line; do log "  $line" "INFO"; done || true

    log "✅ Rollback auto termine" "INFO"
    return 0
}

# === MAIN LOOP ===
log ""
log "╔═══════════════════════════════════════════════════╗"
log "║         WATCHDOG DOCKER - DEMARRAGE               ║"
log "╚═══════════════════════════════════════════════════╝"
log "Intervalle: ${INTERVAL}s"
log "DryRun: $DRY_RUN"
log "Logs: $LOG_PATH"
log ""

CONSECUTIVE_FAILURES=0
MAX_FAILURES=2

while true; do
    sleep "$INTERVAL"

    backend_info=$(get_container_health "fullstack_produits-backend-1")
    frontend_info=$(get_container_health "fullstack_produits-frontend-1")

    backend_status="${backend_info%%:*}"
    backend_health="${backend_info##*:}"
    frontend_status="${frontend_info%%:*}"
    frontend_health="${frontend_info##*:}"

    backend_ok=false
    frontend_ok=false

    if [[ "$backend_status" == "running" && ( "$backend_health" == "healthy" || "$backend_health" == "" ) ]]; then
        backend_ok=true
    fi
    if [[ "$frontend_status" == "running" && ( "$frontend_health" == "healthy" || "$frontend_health" == "" ) ]]; then
        frontend_ok=true
    fi

    if [[ "$backend_ok" != "true" ]]; then
        log "⚠️ Backend UNHEALTHY (Status=$backend_status, Health=$backend_health)" "WARN"
        ((CONSECUTIVE_FAILURES++)) || true
    elif [[ "$frontend_ok" != "true" ]]; then
        log "⚠️ Frontend UNHEALTHY (Status=$frontend_status, Health=$frontend_health)" "WARN"
        ((CONSECUTIVE_FAILURES++)) || true
    else
        if [[ $CONSECUTIVE_FAILURES -gt 0 ]]; then
            log "✅ Tous les conteneurs sont de nouveau healthy" "INFO"
            CONSECUTIVE_FAILURES=0
        fi
        continue
    fi

    log "Consecutive failures: $CONSECUTIVE_FAILURES / $MAX_FAILURES" "WARN"

    if [[ $CONSECUTIVE_FAILURES -ge $MAX_FAILURES ]]; then
        invoke_rollback
        CONSECUTIVE_FAILURES=0

        log "Attente 60s apres rollback..." "INFO"
        sleep 60
    fi
done
