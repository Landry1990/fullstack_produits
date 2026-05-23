#!/usr/bin/env bash
# ============================================================
# Auto-Deploy Git + Rollback si crash (Linux/Ubuntu)
# Usage: ./auto-deploy.sh [--branch main] [--skip-backup]
# 
# Ce script fait le workflow complet:
#   1. git pull
#   2. backup DB
#   3. tag images current → previous
#   4. build + deploy
#   5. healthcheck (attend healthy)
#   6. si KO → rollback auto
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH="main"
SKIP_BACKUP=false

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m'

log()  { echo -e "${GREEN}$1${NC}"; }
warn() { echo -e "${YELLOW}$1${NC}"; }
info() { echo -e "${CYAN}$1${NC}"; }
err()  { echo -e "${RED}$1${NC}"; }
gray() { echo -e "${GRAY}$1${NC}"; }

# Parse args
while [[ $# -gt 0 ]]; do
    case "$1" in
        --branch)
            BRANCH="$2"
            shift 2
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

echo ""
info "╔═══════════════════════════════════════════════════╗"
info "║         AUTO-DEPLOY + ROLLBACK PROTECTION         ║"
info "╚═══════════════════════════════════════════════════╝"
echo ""

# ===========================================
# ÉTAPE 1: GIT PULL
# ===========================================
info "📥 Étape 1/5 — Git Pull"
cd "$SCRIPT_DIR"

LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse "@{u}" 2>/dev/null || echo "")
BASE=$(git merge-base @ "@{u}" 2>/dev/null || echo "")

if [[ -z "$REMOTE" ]]; then
    warn "   Pas de remote configuré, skip git pull"
elif [[ "$LOCAL" == "$REMOTE" ]]; then
    log "   ✅ Déjà à jour (commit: ${LOCAL:0:8})"
    # Tu peux choisir de quitter ici si pas de nouveaux commits
    # exit 0
else
    warn "   Nouveaux commits détectés"
    git pull origin "$BRANCH" --ff-only
    log "   ✅ Pull terminé"
fi

# ===========================================
# ÉTAPE 2: BACKUP DB
# ===========================================
if [[ "$SKIP_BACKUP" != "true" ]]; then
    info "💾 Étape 2/5 — Backup DB"
    if [[ -f "$SCRIPT_DIR/backup-db.sh" ]]; then
        bash "$SCRIPT_DIR/backup-db.sh"
    else
        warn "   backup-db.sh introuvable"
    fi
else
    warn "   Backup DB skip (--skip-backup)"
fi

# ===========================================
# ÉTAPE 3: TAG IMAGES (pour rollback futur)
# ===========================================
info "🏷️ Étape 3/5 — Tag images → previous"

for container in "fullstack_produits-backend-1" "fullstack_produits-frontend-1"; do
    current_image=$(docker inspect --format='{{.Image}}' "$container" 2>/dev/null || true)
    if [[ -n "$current_image" ]]; then
        image_name="fullstack_produits-${container##fullstack_produits-}"
        image_name="${image_name%-1}"
        docker tag "$current_image" "${image_name}:previous" 2>/dev/null || true
        gray "   ${image_name}:previous taggé"
    fi
done

# ===========================================
# ÉTAPE 4: BUILD + DEPLOY
# ===========================================
info "🚀 Étape 4/5 — Build & Deploy"

DEPLOY_START=$(date +%s)

if [[ -f "$SCRIPT_DIR/deploy.sh" ]]; then
    bash "$SCRIPT_DIR/deploy.sh" all || {
        err "   ❌ Deploy.sh a échoué !"
        echo ""
        info "🔄 Rollback en cours..."
        bash "$SCRIPT_DIR/rollback.sh" --force
        exit 1
    }
else
    err "   deploy.sh introuvable"
    exit 1
fi

# ===========================================
# ÉTAPE 5: HEALTHCHECK + ROLLBACK SI KO
# ===========================================
info "🔍 Étape 5/5 — Healthcheck post-deploy"

HEALTH_TIMEOUT=120
HEALTH_INTERVAL=5
elapsed=0
backend_ok=false
frontend_ok=false

while [[ $elapsed -lt $HEALTH_TIMEOUT ]]; do
    sleep "$HEALTH_INTERVAL"
    elapsed=$((elapsed + HEALTH_INTERVAL))

    backend_status=$(docker inspect --format='{{.State.Status}}' fullstack_produits-backend-1 2>/dev/null || echo "unknown")
    backend_health=$(docker inspect --format='{{.State.Health.Status}}' fullstack_produits-backend-1 2>/dev/null || echo "")
    frontend_status=$(docker inspect --format='{{.State.Status}}' fullstack_produits-frontend-1 2>/dev/null || echo "unknown")
    frontend_health=$(docker inspect --format='{{.State.Health.Status}}' fullstack_produits-frontend-1 2>/dev/null || echo "")

    if [[ "$backend_status" == "running" && ( "$backend_health" == "healthy" || "$backend_health" == "" ) ]]; then
        backend_ok=true
    fi
    if [[ "$frontend_status" == "running" && ( "$frontend_health" == "healthy" || "$frontend_health" == "" ) ]]; then
        frontend_ok=true
    fi

    if [[ "$backend_ok" == "true" && "$frontend_ok" == "true" ]]; then
        break
    fi

    warn "   Attente healthy... (${elapsed}s / ${HEALTH_TIMEOUT}s)"
    gray "   Backend: $backend_status / $backend_health"
    gray "   Frontend: $frontend_status / $frontend_health"
done

if [[ "$backend_ok" != "true" || "$frontend_ok" != "true" ]]; then
    echo ""
    err "❌ Healthcheck ÉCHOUÉ après ${HEALTH_TIMEOUT}s !"
    info "🔄 Rollback automatique en cours..."
    bash "$SCRIPT_DIR/rollback.sh" --force
    echo ""
    err "❌ Déploiement ANNULÉ — rollback effectué"
    exit 1
fi

DEPLOY_END=$(date +%s)
DEPLOY_TIME=$((DEPLOY_END - DEPLOY_START))

echo ""
info "═══════════════════════════════════════════════════"
log "  ✅ Déploiement RÉUSSI (${DEPLOY_TIME}s)"
info "═══════════════════════════════════════════════════"
echo ""
gray "  Backend:  $backend_status / $backend_health"
gray "  Frontend: $frontend_status / $frontend_health"
echo ""

# Nettoyage des images orphelines pour éviter la saturation du disque chez le client
info "🧹 Nettoyage des images Docker orphelines (dangling)..."
docker image prune -f >/dev/null 2>&1 || true
log "  ✅ Nettoyage terminé !"
echo ""
