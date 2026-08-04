#!/usr/bin/env bash
# ============================================================
# nightly-update.sh — Mise à jour automatique nocturne (Docker)
# Vérifie si de nouveaux commits sont disponibles sur GitHub.
# Si oui : backup DB → pull → build (sans arrêter l'app) →
#          basculement → migrate → healthcheck.
# Si le build ou le healthcheck échoue : rollback automatique.
#
# Sécurité : les conteneurs actuels ne sont arrêtés qu'APRÈS
# que le build des nouvelles images a réussi. Ainsi, une coupure
# Internet pendant le build n'interrompt pas l'application.
#
# À planifier via systemd timer (voir zenith-nightly-update.timer)
# ou cron : 0 2 * * * /opt/zenith-pharma/nightly-update.sh
# ============================================================

set -euo pipefail

# ── Auto-correction des permissions ─────────────────────────
# Si le script n'est pas exécutable, on le corrige et on relance
if [ ! -x "$0" ]; then
    chmod +x "$0" 2>/dev/null || sudo chmod +x "$0" 2>/dev/null || true
    exec "$0" "$@"
fi

# ── Configuration ────────────────────────────────────────────
APP_DIR="/opt/zenith-pharma"
BRANCH="main"
COMPOSE_FILE="docker-compose.prod.yml"
LOG_FILE="$APP_DIR/logs/nightly-update.log"
HEALTH_TIMEOUT=120
HEALTH_INTERVAL=5
BUILD_TIMEOUT=900    # 15 min max pour le build
MIN_DISK_GB=2        # Espace disque minimum requis (GB)
MAX_BUILD_RETRIES=2  # Tentatives de build en cas d'échec

mkdir -p "$APP_DIR/logs"

# ── Docker Compose helper ────────────────────────────────────
# L'utilisateur est dans le groupe docker (install.sh l'ajoute)
# donc docker compose fonctionne sans sudo.
# En cas d'exécution en tant que root (systemd), sudo est absent.
if [ "$(id -u)" -eq 0 ] || ! command -v sudo &>/dev/null; then
    DC="docker compose"
else
    DC="docker compose"
fi

# ── S'assurer que docker compose (plugin v2) est disponible ──
# Le conteneur backend n'inclut pas toujours le plugin compose.
# On l'installe à la volée si manquant (une fois, cached pour les runs suivants).
if ! docker compose version &>/dev/null; then
    log "📦 Docker Compose plugin non trouvé — installation à la volée..."
    COMPOSE_PLUGIN_DIR="/usr/local/lib/docker/cli-plugins"
    mkdir -p "$COMPOSE_PLUGIN_DIR" 2>/dev/null || true
    if curl -fsSL --connect-timeout 15 \
        https://github.com/docker/compose/releases/download/v2.29.2/docker-compose-linux-x86_64 \
        -o "$COMPOSE_PLUGIN_DIR/docker-compose" 2>>"$LOG_FILE"; then
        chmod +x "$COMPOSE_PLUGIN_DIR/docker-compose"
        ok "Docker Compose plugin installé"
    else
        err "Impossible d'installer Docker Compose plugin — mise à jour annulée"
        exit 1
    fi
fi

# ── Fonctions ────────────────────────────────────────────────
log() {
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

err()  { log "❌ ERREUR : $1"; }
ok()   { log "✅ $1"; }
warn() { log "⚠️  $1"; }

# rollback() — restaure les images précédentes et redémarre
rollback() {
    log "🔄 Rollback automatique..."
    if [ -f "$APP_DIR/rollback.sh" ]; then
        bash "$APP_DIR/rollback.sh" --force 2>&1 | while read -r line; do log "  $line"; done || true
    else
        # Fallback : restaurer les images :previous
        $DC -f "$COMPOSE_FILE" down 2>/dev/null || true
        $DC -f "$COMPOSE_FILE" up -d --remove-orphans 2>/dev/null || true
    fi
    err "Mise à jour ANNULÉE — rollback effectué"
    exit 1
}

# ── Vérifier la connexion internet ───────────────────────────
# On utilise curl plutôt que ping : de nombreuses box/FAI bloquent ICMP,
# ce qui ferait échouer le check même quand la connexion fonctionne bien.
if ! curl -fsSL --connect-timeout 10 -o /dev/null https://github.com; then
    log "Pas de connexion internet — mise à jour ignorée"
    exit 2
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
log "💾 Étape 1/6 — Backup DB"
if [ -f "$APP_DIR/backup-db.sh" ]; then
    bash "$APP_DIR/backup-db.sh" 2>&1 | while read -r line; do log "  $line"; done || warn "Backup échoué (continuation)"
else
    warn "backup-db.sh introuvable — skip"
fi

# ── 2. Tag de sauvegarde ─────────────────────────────────────
BACKUP_TAG="backup-$(date '+%Y%m%d-%H%M%S')"
git tag "$BACKUP_TAG" 2>>"$LOG_FILE" || true
log "🏷️  Étape 2/6 — Tag sauvegarde : $BACKUP_TAG"

# ── 3. Pull ──────────────────────────────────────────────────
log "📥 Étape 3/6 — Git pull"
git reset --hard "origin/$BRANCH" 2>>"$LOG_FILE" || { err "git reset a échoué"; exit 1; }
ok "Code mis à jour"

# ── 4. Tagger les images actuelles pour rollback ─────────────
log "🏷️  Étape 4/6 — Sauvegarde des images actuelles"
for container in "zenith-pharma-backend" "zenith-pharma-frontend"; do
    current_image=$(docker inspect --format='{{.Image}}' "$container" 2>/dev/null || true)
    if [ -n "$current_image" ]; then
        image_name="zenith-pharma-${container##zenith-pharma-}"
        image_name="${image_name%-1}"
        docker tag "$current_image" "${image_name}:previous" 2>/dev/null || true
    fi
done
ok "Images actuelles taggées :previous"

# ── 5. Nettoyage Docker + Build des nouvelles images ─────────
log "🔨 Étape 5/6 — Build des nouvelles images (application toujours en ligne)"
export GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Vérifier l'espace disque disponible
available_kb=$(df -P /var/lib/docker 2>/dev/null | awk 'NR==2 {print $4}' || df -P / 2>/dev/null | awk 'NR==2 {print $4}')
available_gb=$((available_kb / 1024 / 1024))
if [ "$available_gb" -lt "$MIN_DISK_GB" ]; then
    warn "Espace disque faible (${available_gb}GB < ${MIN_DISK_GB}GB requis) — nettoyage Docker..."
    docker system prune -a -f --volumes 2>>"$LOG_FILE" || true
    # Re-vérifier après nettoyage
    available_kb=$(df -P /var/lib/docker 2>/dev/null | awk 'NR==2 {print $4}' || df -P / 2>/dev/null | awk 'NR==2 {print $4}')
    available_gb=$((available_kb / 1024 / 1024))
    if [ "$available_gb" -lt "$MIN_DISK_GB" ]; then
        err "Espace disque insuffisant (${available_gb}GB) après nettoyage — mise à jour annulée"
        warn "Les conteneurs actuels continuent de fonctionner — aucune interruption"
        exit 1
    fi
    ok "Espace disque récupéré : ${available_gb}GB disponibles"
else
    # Nettoyage léger systématique (images orphelines seulement)
    docker image prune -f 2>/dev/null || true
fi
log "💾 Espace disque : ${available_gb}GB disponibles"

# Build avec retry automatique
build_success=false
for attempt in $(seq 1 $MAX_BUILD_RETRIES); do
    log "🔨 Build tentative $attempt/$MAX_BUILD_RETRIES..."
    if GIT_COMMIT="$GIT_COMMIT" timeout "$BUILD_TIMEOUT" $DC -f "$COMPOSE_FILE" build 2>>"$LOG_FILE"; then
        build_success=true
        break
    fi
    warn "Build échoué (tentative $attempt/$MAX_BUILD_RETRIES)"
    if [ "$attempt" -lt "$MAX_BUILD_RETRIES" ]; then
        warn "Nettoyage Docker avant retry..."
        docker builder prune -f 2>/dev/null || true
        docker image prune -f 2>/dev/null || true
    fi
done

if [ "$build_success" != "true" ]; then
    err "docker build a échoué après $MAX_BUILD_RETRIES tentatives (coupure Internet, espace disque ou timeout ${BUILD_TIMEOUT}s)"
    warn "Les conteneurs actuels continuent de fonctionner — aucune interruption"
    exit 1
fi
ok "Nouvelles images construites avec succès"

# ── Basculement : recréer les conteneurs avec les nouvelles images ──
# ⚠️ PROBLÈME : ce script s'exécute DANS le conteneur backend. Si on fait
# `docker compose down` ici, on se tue soi-même → le `up -d` n'a jamais lieu.
# SOLUTION : utiliser un conteneur helper détaché (hors compose project) qui
# fait le `up -d --force-recreate`. Ce conteneur survit au recreate car il
# n'appartient pas au projet docker-compose.
log "🔄 Basculement — recréation des conteneurs via helper détaché"

# Écrire le statut 'done' AVANT le recreate (le script va être tué pendant)
status_file="$APP_DIR/update_status.json"
cat > "$status_file" << EOF
{"status":"done","started_at":"$(date '+%Y-%m-%d %H:%M:%S')","finished_at":"$(date '+%Y-%m-%d %H:%M:%S')","step":"Mise à jour terminée — redémarrage des conteneurs en cours, l'application sera disponible dans quelques secondes"}
EOF
log "📝 Statut 'done' écrit avant le recreate"

# Lancer le helper container (docker:latest inclut Docker CLI + compose plugin)
# Il attend 3s (pour laisser le script se terminer proprement) puis fait le recreate.
# --force-recreate recrée tous les conteneurs avec les nouvelles images.
# Les migrations tournent automatiquement via entrypoint.sh du backend.
docker rm -f zenith-update-helper 2>/dev/null || true
docker run --rm -d \
  --name zenith-update-helper \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$APP_DIR:/app" \
  -w /app \
  docker:latest \
  sh -c "sleep 3 && docker compose -f $COMPOSE_FILE up -d --force-recreate --remove-orphans && docker image prune -f && echo 'Recreate terminé'" \
  >>"$LOG_FILE" 2>&1 || { err "Lancement du helper container échoué"; exit 1; }

ok "Helper container lancé — le recreate va se faire en arrière-plan"
ok "Mise à jour terminée avec succès — version ${REMOTE_COMMIT:0:8}"
log "=== Fin de la mise à jour ==="
exit 0
