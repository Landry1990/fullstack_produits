#!/usr/bin/env bash
# ============================================================
# Zenith Pharma - Mise à jour poste client (docker-compose.prod.yml)
# Usage: ./update-client.sh [backend|frontend|all] [--no-pull]
#   backend   = git pull + build + restart backend uniquement
#   frontend  = git pull + build + restart frontend uniquement
#   all       = git pull + build + restart backend + frontend (défaut)
#   --no-pull = skip git pull (déjà fait manuellement)
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TARGET="${1:-all}"
DO_PULL=true

for arg in "$@"; do
    if [[ "$arg" == "--no-pull" ]]; then
        DO_PULL=false
    fi
done

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

log()  { echo -e "${GREEN}$1${NC}"; }
warn() { echo -e "${YELLOW}$1${NC}"; }
info() { echo -e "${CYAN}$1${NC}"; }
gray() { echo -e "${GRAY}$1${NC}"; }

COMPOSE_FILE="docker-compose.prod.yml"

info "═══════════════════════════════════════"
info "   Zenith Pharma - Mise à jour client"
info "═══════════════════════════════════════"

# 1. Git pull
if [[ "$DO_PULL" == "true" ]]; then
    warn "📥 Git pull..."
    git pull
    log "  ✅ Code à jour"
else
    gray "  Skip git pull (--no-pull)"
fi

# 2. Export GIT_COMMIT pour le frontend
export GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
info "  Git commit: $GIT_COMMIT"

# 3. Build + restart
case "$TARGET" in
    backend)
        warn "🔨 Build backend..."
        docker compose -f "$COMPOSE_FILE" build backend
        warn "🔄 Restart backend..."
        docker compose -f "$COMPOSE_FILE" up -d backend
        log "  ✅ Backend mis à jour"
        ;;
    frontend)
        warn "🔨 Build frontend..."
        docker compose -f "$COMPOSE_FILE" build frontend
        warn "🔄 Restart frontend..."
        docker compose -f "$COMPOSE_FILE" up -d frontend
        log "  ✅ Frontend mis à jour"
        ;;
    all)
        warn "🔨 Build backend + frontend..."
        docker compose -f "$COMPOSE_FILE" build backend frontend
        warn "🔄 Restart backend + frontend..."
        docker compose -f "$COMPOSE_FILE" up -d backend frontend
        log "  ✅ Backend + Frontend mis à jour"
        ;;
    *)
        echo "Usage: $0 [backend|frontend|all] [--no-pull]"
        exit 1
        ;;
esac

echo ""
info "═══════════════════════════════════════"
log "  ✅ Mise à jour terminée !"
info "═══════════════════════════════════════"
echo ""
gray "  Logs backend :  docker compose -f $COMPOSE_FILE logs -f backend"
gray "  Logs frontend:  docker compose -f $COMPOSE_FILE logs -f frontend"
echo ""
