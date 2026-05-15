#!/usr/bin/env bash
# ============================================================
# Zenith Pharma - Deploiement Docker (Linux/Ubuntu)
# Usage: ./deploy.sh [frontend|backend|backend-full|all] [--backup-db]
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-all}"
BACKUP_DB=false

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

# Parse args
for arg in "$@"; do
    if [[ "$arg" == "--backup-db" ]]; then
        BACKUP_DB=true
    fi
done

# Fonctions
log()  { echo -e "${GREEN}$1${NC}"; }
warn() { echo -e "${YELLOW}$1${NC}"; }
info() { echo -e "${CYAN}$1${NC}"; }
gray() { echo -e "${GRAY}$1${NC}"; }

tag_image() {
    local container="$1"
    local image_name="$2"
    local current_image
    current_image=$(docker inspect --format='{{.Image}}' "$container" 2>/dev/null || true)
    if [[ -n "$current_image" ]]; then
        docker tag "$current_image" "${image_name}:previous" 2>/dev/null || true
        gray "   Image taggee: ${image_name}:previous"
    fi
}

backup_database() {
    warn "💾 Backup DB avant deploiement..."
    if [[ -f "$SCRIPT_DIR/backup-db.sh" ]]; then
        bash "$SCRIPT_DIR/backup-db.sh"
    else
        warn "   backup-db.sh introuvable, skip"
    fi
}

deploy_frontend() {
    log "🚀 Deploiement Frontend..."
    tag_image "fullstack_produits-frontend-1" "fullstack_produits-frontend"

    cd "$SCRIPT_DIR/frontend/frontend"
    warn "  Building..."
    npm run build 2>&1 | grep -E "error|built" || true

    warn "  Copie vers conteneur..."
    docker cp dist/. fullstack_produits-frontend-1:/usr/share/nginx/html/

    warn "  Reload nginx..."
    docker exec fullstack_produits-frontend-1 nginx -s reload

    log "  ✅ Frontend deploye !"
    cd "$SCRIPT_DIR"
}

deploy_backend() {
    local include_models="$1"
    log "🚀 Deploiement Backend..."
    tag_image "fullstack_produits-backend-1" "fullstack_produits-backend"

    if [[ "$include_models" == "true" ]]; then
        warn "  Copie des modeles..."
        docker cp backend/api/models/__init__.py fullstack_produits-backend-1:/app/api/models/__init__.py
        docker cp backend/api/models/products.py fullstack_produits-backend-1:/app/api/models/products.py
    fi

    warn "  Copie des fichiers..."
    docker cp backend/api/serializers.py fullstack_produits-backend-1:/app/api/serializers.py
    docker cp backend/api/urls.py fullstack_produits-backend-1:/app/api/urls.py
    docker cp backend/api/views/substances.py fullstack_produits-backend-1:/app/api/views/substances.py
    docker cp backend/api/views/meds_reference.py fullstack_produits-backend-1:/app/api/views/meds_reference.py
    docker cp backend/api/views/produits.py fullstack_produits-backend-1:/app/api/views/produits.py
    docker cp backend/api/views/dci_admin.py fullstack_produits-backend-1:/app/api/views/dci_admin.py

    if [[ "$include_models" == "true" ]]; then
        warn "  Migration..."
        docker exec fullstack_produits-backend-1 python manage.py makemigrations 2>&1 | grep -E "No changes|Migration" || true
        docker exec fullstack_produits-backend-1 python manage.py migrate 2>&1 | grep -E "Applying|OK" || true

        warn "  Setup DCI / Substances..."
        docker cp backend/api/management/commands/setup_dci_prod.py fullstack_produits-backend-1:/app/api/management/commands/setup_dci_prod.py
        docker exec fullstack_produits-backend-1 python manage.py setup_dci_prod 2>&1 || true
    fi

    warn "  Redemarrage..."
    docker restart fullstack_produits-backend-1 >/dev/null 2>&1

    log "  ✅ Backend deploye !"
}

# === MAIN ===
info "═══════════════════════════════════════"
info "   Zenith Pharma - Deploiement Rapide"
info "═══════════════════════════════════════"

if [[ "$BACKUP_DB" == "true" ]]; then
    backup_database
fi

case "$TARGET" in
    frontend)
        deploy_frontend
        ;;
    backend)
        deploy_backend false
        ;;
    backend-full)
        deploy_backend true
        ;;
    all)
        deploy_frontend
        deploy_backend true
        ;;
    *)
        echo "Usage: $0 [frontend|backend|backend-full|all] [--backup-db]"
        exit 1
        ;;
esac

echo ""
info "═══════════════════════════════════════"
log "  ✅ Deploiement termine !"
info "═══════════════════════════════════════"
echo ""
echo "Commandes utiles :"
gray "  Backup DB : ./backup-db.sh"
gray "  Rollback  : ./rollback.sh"
gray "  Rollback+DB: ./rollback.sh --include-db"
echo ""
