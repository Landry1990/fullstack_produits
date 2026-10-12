#!/usr/bin/env bash
# ============================================================
# Rollback Docker vers la version precedente (Linux/Ubuntu)
# Usage: ./rollback.sh [--include-db] [--force]
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INCLUDE_DB=false
FORCE=false

# Noms des images Docker et des conteneurs.
# Prod (zenith) : images et conteneurs zenith-pharma-* (nightly-update.sh
# tag les images courantes en zenith-pharma-{backend,frontend}:previous).
# Dev : surcharger par variable d'env, ex :
#   BACKEND_IMAGE=fullstack_produits-backend FRONTEND_IMAGE=fullstack_produits-frontend \
#   BACKEND_CONTAINER=fullstack_produits-backend-1 ./rollback.sh
BACKEND_IMAGE="${BACKEND_IMAGE:-zenith-pharma-backend}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-zenith-pharma-frontend}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-zenith-pharma-backend}"
FRONTEND_CONTAINER="${FRONTEND_CONTAINER:-zenith-pharma-frontend}"
DB_CONTAINER="${DB_CONTAINER:-zenith-pharma-db}"

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
backend_previous=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep -x "${BACKEND_IMAGE}:previous" || true)
frontend_previous=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep -x "${FRONTEND_IMAGE}:previous" || true)

if [[ -z "$backend_previous" && -z "$frontend_previous" ]]; then
    err "❌ Aucune image 'previous' trouvee (${BACKEND_IMAGE}:previous / ${FRONTEND_IMAGE}:previous). Impossible de rollback."
    warn "   Astuce: les images sont taggees 'previous' par nightly-update.sh avant chaque mise a jour"
    exit 1
fi

# Découverte du backup DB (avant la confirmation pour être disponible en mode --force)
last_backup=""
if [[ "$INCLUDE_DB" == "true" ]]; then
    last_backup=$(ls -t "$SCRIPT_DIR/backups"/*.sql 2>/dev/null | head -1 || true)
fi

# Confirmation
if [[ "$FORCE" != "true" ]]; then
    echo "Cette action va :"
    [[ -n "$backend_previous" ]]  && echo -e "  ${WHITE}• Restaurer BACKEND  → image 'previous'${NC}"
    [[ -n "$frontend_previous" ]] && echo -e "  ${WHITE}• Restaurer FRONTEND → image 'previous'${NC}"
    if [[ "$INCLUDE_DB" == "true" ]]; then
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
docker compose -f "$SCRIPT_DIR/docker-compose.prod.yml" stop backend frontend 2>/dev/null || true

# 2. Rollback Backend
if [[ -n "$backend_previous" ]]; then
    warn "🔙 Rollback BACKEND..."
    docker tag "${BACKEND_IMAGE}:previous" "${BACKEND_IMAGE}:latest"
    docker compose -f "$SCRIPT_DIR/docker-compose.prod.yml" up -d --no-deps --force-recreate backend >/dev/null 2>&1
    log "   ✅ Backend restaure"
fi

# 3. Rollback Frontend
if [[ -n "$frontend_previous" ]]; then
    warn "🔙 Rollback FRONTEND..."
    docker tag "${FRONTEND_IMAGE}:previous" "${FRONTEND_IMAGE}:latest"
    docker compose -f "$SCRIPT_DIR/docker-compose.prod.yml" up -d --no-deps --force-recreate frontend >/dev/null 2>&1
    log "   ✅ Frontend restaure"
fi

# 4. Rollback DB (optionnel)
if [[ "$INCLUDE_DB" == "true" && -n "$last_backup" ]]; then
    warn ""
    warn "🗄️  Restauration DATABASE..."
    warn "   Backup: $last_backup"

    # Vérification d'intégrité : le backup doit être non vide
    backup_size=$(wc -c < "$last_backup" 2>/dev/null || echo 0)
    if [[ "$backup_size" -lt 100 ]]; then
        err "   ❌ Backup corrompu ou vide ($backup_size octets). Rollback DB annulé."
    else
        docker compose -f "$SCRIPT_DIR/docker-compose.prod.yml" stop backend 2>/dev/null || true

        DB_USER="${DB_USER:-fullstack_user}"
        DB_NAME="${DB_NAME:-fullstack_db}"

        # Backup de sécurité avant le DROP
        safety_backup="$SCRIPT_DIR/backups/safety_before_rollback_$(date +%Y%m%d_%H%M%S).sql"
        warn "   💾 Backup de sécurité: $(basename "$safety_backup")"
        docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" > "$safety_backup" 2>/dev/null || true

        # Restore
        docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null || true
        cat "$last_backup" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" 2>/dev/null || true

        log "   ✅ Database restaurée"
        docker compose -f "$SCRIPT_DIR/docker-compose.prod.yml" up -d backend >/dev/null 2>&1
    fi
fi

# 5. Healthcheck
warn ""
warn "🔍 Verification..."
sleep 3

backend_health=$(docker inspect --format='{{.State.Status}}' "$BACKEND_CONTAINER" 2>/dev/null || echo "unknown")
frontend_health=$(docker inspect --format='{{.State.Status}}' "$FRONTEND_CONTAINER" 2>/dev/null || echo "unknown")

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
gray "  docker logs $BACKEND_CONTAINER --tail 20"
gray "  docker logs $FRONTEND_CONTAINER --tail 20"
echo ""
