#!/bin/bash
# =============================================================================
# auto_update.sh — Mise à jour automatique Zenith PMS
# À planifier via cron : 0 2 * * * /opt/zenith/auto_update.sh
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
APP_DIR="/opt/zenith/fullstack_produits"
FRONTEND_DIR="$APP_DIR/frontend/frontend"
BACKEND_DIR="$APP_DIR/backend"
LOG_FILE="/var/log/zenith_update.log"
BRANCH="main"
VENV_PATH="$BACKEND_DIR/venv"
BACKEND_SERVICE="zenith-backend"   # nom du service systemd
NGINX_SERVICE="nginx"

# ── Fonctions utilitaires ──────────────────────────────────────────────────────
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

notify_error() {
    log "ERREUR : $1"
    # Optionnel : envoyer un e-mail ou un webhook ici
    exit 1
}

# ── Vérification de la connexion internet ─────────────────────────────────────
log "=== Démarrage de la vérification de mise à jour ==="

if ! ping -c 1 github.com &>/dev/null; then
    log "Pas de connexion internet — mise à jour ignorée"
    exit 0
fi

# ── Vérification si une mise à jour est disponible ────────────────────────────
cd "$APP_DIR" || notify_error "Dossier $APP_DIR introuvable"

git fetch origin "$BRANCH" --quiet 2>>"$LOG_FILE"

LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
    log "Déjà à jour (commit $LOCAL_COMMIT) — rien à faire"
    exit 0
fi

log "Nouvelle version détectée : $REMOTE_COMMIT (local : $LOCAL_COMMIT)"
log "Démarrage de la mise à jour..."

# ── Sauvegarde de la version actuelle ─────────────────────────────────────────
BACKUP_TAG="backup-$(date '+%Y%m%d-%H%M%S')"
git tag "$BACKUP_TAG" 2>>"$LOG_FILE" || true
log "Tag de sauvegarde créé : $BACKUP_TAG"

# ── Pull du code ──────────────────────────────────────────────────────────────
git pull origin "$BRANCH" --ff-only 2>>"$LOG_FILE" || notify_error "git pull a échoué"
log "Code mis à jour avec succès"

# ── Backend : dépendances Python ──────────────────────────────────────────────
log "Mise à jour des dépendances Python..."
source "$VENV_PATH/bin/activate"
pip install -r "$BACKEND_DIR/requirements.txt" --quiet 2>>"$LOG_FILE" || notify_error "pip install a échoué"

# ── Backend : migrations Django ───────────────────────────────────────────────
log "Application des migrations Django..."
python "$BACKEND_DIR/manage.py" migrate --noinput 2>>"$LOG_FILE" || notify_error "migrate a échoué"

# ── Frontend : build ──────────────────────────────────────────────────────────
log "Build du frontend..."
cd "$FRONTEND_DIR"
npm ci --silent 2>>"$LOG_FILE" || notify_error "npm ci a échoué"
npm run build 2>>"$LOG_FILE" || notify_error "npm run build a échoué"
log "Frontend compilé"

# ── Redémarrage des services ──────────────────────────────────────────────────
log "Redémarrage du backend..."
systemctl restart "$BACKEND_SERVICE" || notify_error "Redémarrage du service $BACKEND_SERVICE échoué"
systemctl reload "$NGINX_SERVICE" 2>/dev/null || true
log "Services redémarrés"

# ── Mise à jour du fichier VERSION ────────────────────────────────────────────
VERSION=$(cat "$APP_DIR/VERSION" 2>/dev/null || echo "inconnue")
log "Mise à jour terminée — version $VERSION installée"
log "=== Fin de la mise à jour ==="
