#!/usr/bin/env bash
# ============================================================
# Rollback Docker vers la version precedente (Linux/Ubuntu)
# Usage: ./rollback.sh [--include-db] [--force]
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INCLUDE_DB=false
FORCE=false

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m'

# Parse args
for arg in "$@"; do
    case "$arg" in
        --include-db) INCLUDE_DB=true ;;
        --force) FORCE=true ;;
    esac
done

log()  { echo -e "${GREEN}$1${NC}"; }
warn() { echo -e "${YELLOW}$1${NC}"; }
info() { echo -e "${CYAN}$1${NC}"; }
err()  { echo -e "${RED}$1${NC}"; }
gray() { echo -e "${GRAY}$1${NC}"; }

echo ""
info "╔══════════════════════════════════════════════╗"
info "║         ROLLBACK DOCKER PRODUCTION           ║"
info "╚══════════════════════════════════════════════╝"
echo ""

# Verifier images previous
backend_previous=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "fullstack_produits-backend:previous" || true)
frontend_previous=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "fullstack_produits-frontend:previous" || true)

if [[ -z "$backend_previous" && -z "$frontend_previous" ]]; then
    err "❌ Aucune image 'previous' trouvee. Impossible de rollback."
    warn "   Astuce: les images sont taggees 'previous' lors du deploy.sh"
    exit 1
fi

# Confirmation
if [[ "$FORCE" != "true" ]]; then
    echo "Cette action va :"
    [[ -n "$backend_previous" ]]  && echo -e "  ${WHITE}• Restaurer BACKEND  → image 'previous'${NC}"
    [[ -n "$frontend_previous" ]] && echo -e "  ${WHITE}• Restaurer FRONTEND → image 'previous'${NC}"
    if [[ "$INCLUDE_DB" == "true" ]]; then
        last_backup=$(ls -t "$SCRIPT_DIR/backups"/*.sql 2>/dev/null | head -1 || true)
        if [[ -n "$last_backup" ]]; then
            echo -e "  ${WHITE}• Restaurer DATABASE → $(basename "$last_backup")${NC}"
        else
            warn "  • ⚠️ Aucun backup DB trouve dans ./backups/"
        fi
    fi
    echo ""
    read -r -p "Confirmer le rollback ? [O/n] " confirm
    if [[ -n "$confirm" && ! "$confirm" =~ ^[Oo]$ ]]; then
        warn "Rollback annule."
        exit 0
    fi
else
    gray "Mode force (pas de confirmation)"
fi

# 1. Stop containers
warn ""
warn "🛑 Arret des conteneurs..."
docker-compose -f "$SCRIPT_DIR/docker-compose.prod.yml" stop backend frontend 2>/dev/null || true

# 2. Rollback Backend
if [[ -n "$backend_previous" ]]; then
    warn "🔙 Rollback BACKEND..."
    docker tag fullstack_produits-backend:previous fullstack_produits-backend:latest
    docker-compose -f "$SCRIPT_DIR/docker-compose.prod.yml" up -d --no-deps --force-recreate backend >/dev/null 2>&1
    log "   ✅ Backend restaure"
fi

# 3. Rollback Frontend
if [[ -n "$frontend_previous" ]]; then
    warn "🔙 Rollback FRONTEND..."
    docker tag fullstack_produits-frontend:previous fullstack_produits-frontend:latest
    docker-compose -f "$SCRIPT_DIR/docker-compose.prod.yml" up -d --no-deps --force-recreate frontend >/dev/null 2>&1
    log "   ✅ Frontend restaure"
fi

# 4. Rollback DB (optionnel)
if [[ "$INCLUDE_DB" == "true" && -n "$last_backup" ]]; then
    warn ""
    warn "🗄️  Restauration DATABASE..."
    warn "   Backup: $last_backup"

    docker-compose -f "$SCRIPT_DIR/docker-compose.prod.yml" stop backend 2>/dev/null || true

    DB_USER="${DB_USER:-fullstack_user}"
    DB_NAME="${DB_NAME:-fullstack_db}"

    docker exec -i fullstack_produits-db-1 psql -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null || true
    cat "$last_backup" | docker exec -i fullstack_produits-db-1 psql -U "$DB_USER" -d "$DB_NAME" 2>/dev/null || true

    log "   ✅ Database restauree"
    docker-compose -f "$SCRIPT_DIR/docker-compose.prod.yml" up -d backend >/dev/null 2>&1
fi

# 5. Healthcheck
warn ""
warn "🔍 Verification..."
sleep 3

backend_health=$(docker inspect --format='{{.State.Status}}' fullstack_produits-backend-1 2>/dev/null || echo "unknown")
frontend_health=$(docker inspect --format='{{.State.Status}}' fullstack_produits-frontend-1 2>/dev/null || echo "unknown")

if [[ "$backend_health" == "running" ]]; then
    log "   ✅ Backend: running"
else
    err "   ❌ Backend: $backend_health"
fi

if [[ "$frontend_health" == "running" ]]; then
    log "   ✅ Frontend: running"
else
    err "   ❌ Frontend: $frontend_health"
fi

echo ""
info "══════════════════════════════════════════════"
log "  Rollback termine !"
info "══════════════════════════════════════════════"
echo ""
echo "Commandes utiles :"
gray "  docker logs fullstack_produits-backend-1 --tail 20"
gray "  docker logs fullstack_produits-frontend-1 --tail 20"
echo ""
