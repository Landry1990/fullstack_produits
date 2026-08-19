#!/usr/bin/env bash
# ============================================================
# update-app.sh — Mise à jour rapide (hot deploy) depuis l'app
#
# Contrairement à nightly-update.sh qui fait un full rebuild Docker,
# ce script copie directement le code dans les conteneurs existants :
#   1. git pull
#   2. docker cp backend → conteneur backend
#   3. migrate + collectstatic
#   4. docker restart backend (redémarrage bref ~5s)
#   5. docker cp frontend/dist → conteneur nginx + reload
#
# Avantages :
#   - Pas de rebuild Docker (30s au lieu de 10-15 min)
#   - Le frontend ne redémarre jamais (nginx reload = instantané)
#   - Si internet coupe pendant git pull → on annule, l'app continue
#   - Le statut est écrit dans update_status.json à chaque étape
#
# Écrit un statut JSON dans update_status.json à chaque étape
# pour que le frontend puisse afficher la progression.
# ============================================================

set -uo pipefail  # pas de -e : on gère les erreurs manuellement

APP_DIR="${APP_DIR:-/opt/zenith-pharma}"
STATUS_FILE="$APP_DIR/update_status.json"
LOG_FILE="$APP_DIR/logs/update-app.log"
BACKEND_CONTAINER="zenith-pharma-backend"
FRONTEND_CONTAINER="zenith-pharma-frontend"

mkdir -p "$APP_DIR/logs"

# ── Helpers ──────────────────────────────────────────────────

write_status() {
    local status="$1"
    local step="$2"
    local extra="${3:-}"
    local ts
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    local json="{\"status\":\"$status\",\"step\":\"$step\",\"started_at\":\"$ts\""
    if [ "$status" = "done" ] || [ "$status" = "failed" ]; then
        json="$json,\"finished_at\":\"$ts\""
    fi
    if [ -n "$extra" ]; then
        json="$json,\"error\":\"$extra\""
    fi
    json="$json}"
    echo "$json" > "$STATUS_FILE"
}

log() {
    echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# ── Étape 0 : Démarrage ──────────────────────────────────────

write_status "running" "Démarrage de la mise à jour..."
log "========================================"
log "  Mise à jour Zenith Pharma (hot deploy)"
log "========================================"

# ── Étape 1 : Vérifier connexion Internet ────────────────────

write_status "running" "Vérification de la connexion Internet..."
if ! curl -fsSL --connect-timeout 10 -o /dev/null https://github.com 2>/dev/null; then
    write_status "failed" "Pas de connexion Internet" "Connexion à GitHub impossible"
    log "✗ Pas de connexion Internet — mise à jour annulée"
    exit 2
fi
log "✓ Connexion Internet OK"

# ── Étape 2 : Git pull ───────────────────────────────────────

write_status "running" "Récupération du nouveau code (git pull)..."
cd "$APP_DIR" || {
    write_status "failed" "Impossible d'accéder au dossier $APP_DIR"
    exit 1
}

# Capturer le hash de requirements.txt AVANT le pull
REQUIREMENTS_HASH_BEFORE=""
if [ -f "$APP_DIR/backend/requirements.txt" ]; then
    REQUIREMENTS_HASH_BEFORE=$(sha256sum "$APP_DIR/backend/requirements.txt" 2>/dev/null | cut -d' ' -f1)
fi

if ! git pull origin main >> "$LOG_FILE" 2>&1; then
    write_status "failed" "Échec du git pull" "Vérifiez la connexion ou les conflits"
    log "✗ Échec du git pull"
    exit 1
fi
log "✓ Git pull terminé"

# ── Étape 2b : Détection changement requirements.txt ─────────
# Si requirements.txt a changé, il faut un rebuild Docker complet
# (nouvelles dépendances Python à installer dans l'image).
# On délègue à nightly-update.sh qui gère le rebuild + basculement.
REQUIREMENTS_HASH_AFTER=""
if [ -f "$APP_DIR/backend/requirements.txt" ]; then
    REQUIREMENTS_HASH_AFTER=$(sha256sum "$APP_DIR/backend/requirements.txt" 2>/dev/null | cut -d' ' -f1)
fi

if [ -n "$REQUIREMENTS_HASH_BEFORE" ] && [ -n "$REQUIREMENTS_HASH_AFTER" ] && [ "$REQUIREMENTS_HASH_BEFORE" != "$REQUIREMENTS_HASH_AFTER" ]; then
    log "⚠ requirements.txt a changé — rebuild Docker complet nécessaire"
    log "  Avant : ${REQUIREMENTS_HASH_BEFORE:0:12}..."
    log "  Après  : ${REQUIREMENTS_HASH_AFTER:0:12}..."
    write_status "running" "requirements.txt modifié — rebuild Docker complet en cours..."

    # Déléguer à nightly-update.sh (rebuild + basculement + rollback auto)
    NIGHTLY_SCRIPT="$APP_DIR/nightly-update.sh"
    if [ -f "$NIGHTLY_SCRIPT" ]; then
        chmod +x "$NIGHTLY_SCRIPT" 2>/dev/null || true
        log "→ Délégation à nightly-update.sh pour le rebuild complet"
        # nightly-update.sh écrit lui-même le statut dans update_status.json
        exec bash "$NIGHTLY_SCRIPT"
        # exec remplace le processus — les lignes suivantes ne s'exécutent pas
    else
        write_status "failed" "requirements.txt modifié mais nightly-update.sh introuvable" \
            "Rebuild Docker nécessaire — contactez le support"
        log "✗ nightly-update.sh introuvable — impossible de faire le rebuild"
        exit 1
    fi
fi
log "✓ requirements.txt inchangé — hot deploy possible"

# ── Étape 3 : Backup DB ──────────────────────────────────────

write_status "running" "Sauvegarde de la base de données..."
if [ -f "$APP_DIR/backup-db.sh" ]; then
    chmod +x "$APP_DIR/backup-db.sh" 2>/dev/null || true
    if bash "$APP_DIR/backup-db.sh" >> "$LOG_FILE" 2>&1; then
        log "✓ Backup DB terminé"
    else
        log "⚠ Backup DB échoué — on continue quand même"
    fi
else
    log "⚠ backup-db.sh introuvable — skip backup"
fi

# ── Étape 4 : Copie backend dans le conteneur ────────────────

write_status "running" "Copie du code backend..."
if ! docker cp "$APP_DIR/backend/api/." "$BACKEND_CONTAINER:/app/api/" >> "$LOG_FILE" 2>&1; then
    write_status "failed" "Échec de la copie backend" "docker cp a échoué"
    log "✗ Échec copie backend"
    exit 1
fi
docker cp "$APP_DIR/backend/manage.py" "$BACKEND_CONTAINER:/app/manage.py" >> "$LOG_FILE" 2>&1 || true
log "✓ Code backend copié"

# ── Étape 5 : Migrations ─────────────────────────────────────

write_status "running" "Application des migrations..."
if ! docker exec "$BACKEND_CONTAINER" python manage.py migrate --noinput >> "$LOG_FILE" 2>&1; then
    log "⚠ Migrations échouées — on continue"
else
    log "✓ Migrations appliquées"
fi

# ── Étape 6 : Collectstatic ──────────────────────────────────

write_status "running" "Collecte des fichiers statiques..."
docker exec "$BACKEND_CONTAINER" python manage.py collectstatic --noinput --clear >> "$LOG_FILE" 2>&1 || true
log "✓ Fichiers statiques collectés"

# ── Étape 7 : Redémarrage backend ────────────────────────────

# IMPORTANT : écrire le statut "done" AVANT le restart
# car le restart va tuer temporairement le backend et le thread qui exécute ce script
write_status "done" "Mise à jour terminée avec succès"
log "✓ Statut 'done' écrit — redémarrage du backend..."

docker restart "$BACKEND_CONTAINER" >> "$LOG_FILE" 2>&1 || {
    log "⚠ docker restart a échoué mais le statut done a déjà été écrit"
}
log "✓ Backend redémarré"

# ── Étape 8 : Copie frontend + reload nginx ───────────────────

# Le frontend n'est PAS encore copié à ce point. On le fait après le restart backend
# car le statut "done" est déjà écrit et le frontend peut déjà afficher le succès.
# Mais on copie quand même le nouveau frontend pour que le Ctrl+F5 charge la nouvelle version.

if [ -d "$APP_DIR/frontend/frontend/dist" ]; then
    docker cp "$APP_DIR/frontend/frontend/dist/." "$FRONTEND_CONTAINER:/usr/share/nginx/html/" >> "$LOG_FILE" 2>&1 || true
    docker exec "$FRONTEND_CONTAINER" nginx -s reload >> "$LOG_FILE" 2>&1 || true
    log "✓ Frontend copié et nginx rechargé"
else
    log "⚠ Pas de dist/ trouvé — le frontend n'est pas mis à jour"
fi

log "========================================"
log "  Mise à jour terminée !"
log "  Pense à faire Ctrl+F5 dans le navigateur."
log "========================================"

exit 0
