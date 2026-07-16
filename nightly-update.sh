#!/usr/bin/env bash
# ============================================================
# nightly-update.sh — Mise à jour automatique nocturne (Docker)
# Vérifie si de nouveaux commits sont disponibles sur GitHub.
# Si oui : backup DB → pull → rebuild → migrate → healthcheck.
# Si le healthcheck échoue : rollback automatique.
#
# À planifier via systemd timer (voir zenith-nightly-update.timer)
# ou cron : 0 2 * * * /opt/zenith-pharma/nightly-update.sh
# ============================================================

set -euo pipefail

# ── Configuration ────────────────────────────────────────────
APP_DIR="/opt/zenith-pharma"
BRANCH="main"
COMPOSE_FILE="docker-compose.prod.yml"
LOG_FILE="$APP_DIR/logs/nightly-update.log"
HEALTH_TIMEOUT=120
HEALTH_INTERVAL=5

mkdir -p "$APP_DIR/logs"

# ── Fonctions ────────────────────────────────────────────────
log() {
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

err()  { log "❌ ERREUR : $1"; }
ok()   { log "✅ $1"; }
warn() { log "⚠️  $1"; }

# ── Vérifier la connexion internet ───────────────────────────
if ! ping -c 1 github.com &>/dev/null; then
    log "Pas de connexion internet — mise à jour ignorée"
    exit 0
fi

cd "$APP_DIR" || { err "Dossier $APP_DIR introuvable"; exit 1; }

# ── Vérifier s'il y a des nouveaux commits ───────────────────
log "=== Vérification des mises à jour ==="

git fetch origin "$BRANCH" --quiet 2>>"$LOG_FILE"

LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
    log "Déjà à jour (commit ${LOCAL_COMMIT:0:8}) — rien à faire"
    exit 0
fi

log "Nouvelle version détectée : ${REMOTE_COMMIT:0:8} (local : ${LOCAL_COMMIT:0:8})"

# ── 1. Backup DB ─────────────────────────────────────────────
log "💾 Étape 1/5 — Backup DB"
if [ -f "$APP_DIR/backup-db.sh" ]; then
    bash "$APP_DIR/backup-db.sh" 2>&1 | while read -r line; do log "  $line"; done || warn "Backup échoué (continuation)"
else
    warn "backup-db.sh introuvable — skip"
fi

# ── 2. Tag de sauvegarde ─────────────────────────────────────
BACKUP_TAG="backup-$(date '+%Y%m%d-%H%M%S')"
git tag "$BACKUP_TAG" 2>>"$LOG_FILE" || true
log "🏷️  Étape 2/5 — Tag sauvegarde : $BACKUP_TAG"

# ── 3. Pull ──────────────────────────────────────────────────
log "📥 Étape 3/5 — Git pull"
git reset --hard "origin/$BRANCH" 2>>"$LOG_FILE" || { err "git reset a échoué"; exit 1; }
ok "Code mis à jour"

# ── 4. Rebuild Docker ────────────────────────────────────────
log "🔨 Étape 4/5 — Rebuild & redémarrage Docker"

# Tagger les images actuelles pour rollback
for container in "fullstack_produits-backend-1" "fullstack_produits-frontend-1"; do
    current_image=$(docker inspect --format='{{.Image}}' "$container" 2>/dev/null || true)
    if [ -n "$current_image" ]; then
        image_name="fullstack_produits-${container##fullstack_produits-}"
        image_name="${image_name%-1}"
        docker tag "$current_image" "${image_name}:previous" 2>/dev/null || true
    fi
done

sudo docker compose -f "$COMPOSE_FILE" down 2>>"$LOG_FILE" || { err "docker compose down a échoué"; exit 1; }
sudo docker compose -f "$COMPOSE_FILE" build --no-cache 2>>"$LOG_FILE" || { err "docker build a échoué"; exit 1; }
sudo docker compose -f "$COMPOSE_FILE" up -d --remove-orphans 2>>"$LOG_FILE" || { err "docker up a échoué"; exit 1; }
ok "Conteneurs redémarrés"

# ── 5. Migrate + Healthcheck ─────────────────────────────────
log "🔄 Étape 5/5 — Migrations + Healthcheck"

# Attendre que le backend soit prêt
elapsed=0
backend_ready=false
while [ $elapsed -lt $HEALTH_TIMEOUT ]; do
    sleep $HEALTH_INTERVAL
    elapsed=$((elapsed + HEALTH_INTERVAL))
    if sudo docker compose -f "$COMPOSE_FILE" exec -T backend python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.db import connection
connection.ensure_connection()
print('DB ready')
    " 2>/dev/null; then
        backend_ready=true
        break
    fi
    warn "Attente backend... (${elapsed}s / ${HEALTH_TIMEOUT}s)"
done

if [ "$backend_ready" != "true" ]; then
    err "Backend non accessible après ${HEALTH_TIMEOUT}s"
    log "🔄 Rollback automatique..."
    if [ -f "$APP_DIR/rollback.sh" ]; then
        bash "$APP_DIR/rollback.sh" --force 2>&1 | while read -r line; do log "  $line"; done || true
    fi
    err "Mise à jour ANNULÉE — rollback effectué"
    exit 1
fi

# Migrations
sudo docker compose -f "$COMPOSE_FILE" exec -T backend python manage.py migrate --noinput 2>>"$LOG_FILE" || {
    err "Migrations échouées"
    log "🔄 Rollback automatique..."
    if [ -f "$APP_DIR/rollback.sh" ]; then
        bash "$APP_DIR/rollback.sh" --force 2>&1 | while read -r line; do log "  $line"; done || true
    fi
    err "Mise à jour ANNULÉE — rollback effectué"
    exit 1
}

# Collectstatic
sudo docker compose -f "$COMPOSE_FILE" exec -T backend python manage.py collectstatic --noinput 2>>"$LOG_FILE" || warn "collectstatic échoué (non bloquant)"

# Nettoyage images orphelines
docker image prune -f >/dev/null 2>&1 || true

ok "Mise à jour terminée avec succès — version ${REMOTE_COMMIT:0:8}"
log "=== Fin de la mise à jour ==="
