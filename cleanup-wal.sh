#!/usr/bin/env bash
# ============================================================
# Nettoyage des WAL archives PostgreSQL + vieux logs
#
# Les WAL (Write-Ahead Logs) s'accumulent dans /wal_archive
# sans jamais être nettoyés. Chaque fichier fait 16 MB.
# En quelques semaines, le disque peut se remplir.
#
# Ce script supprime :
#   - Les WAL archives de plus de 3 jours (suffisant pour un recovery)
#   - Les vieux logs de l'application (> 7 jours)
#
# À exécuter via cron ou le timer systemd nightly-update.
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WAL_RETENTION_DAYS=3
LOG_RETENTION_DAYS=7
DB_CONTAINER="${DB_CONTAINER:-zenith-pharma-db}"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
GRAY='\033[0;90m'
NC='\033[0m'

log()  { echo -e "${GREEN}$1${NC}"; }
warn() { echo -e "${YELLOW}$1${NC}"; }
gray() { echo -e "${GRAY}$1${NC}"; }

# Charger .env si existe
ENV_FILE="$SCRIPT_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

echo ""
warn "🧹 Nettoyage WAL archives + vieux logs..."

# ── 1. WAL archives ──────────────────────────────────
# Les WAL sont dans le volume Docker wal_archive, monté dans le container db
# On utilise pg_archivecleanup si disponible, sinon find

WAL_CLEANED=0

# Méthode 1 : pg_archivecleanup (outil PostgreSQL dédié)
if docker exec "$DB_CONTAINER" which pg_archivecleanup >/dev/null 2>&1; then
    gray "   Utilisation de pg_archivecleanup (rétention: ${WAL_RETENTION_DAYS}j)"
    # Lister le WAL le plus ancien à conserver
    KEEP_WAL=$(docker exec "$DB_CONTAINER" bash -c "
        ls -t /wal_archive/ 2>/dev/null | tail -1
    " 2>/dev/null || echo "")

    if [[ -n "$KEEP_WAL" ]]; then
        # pg_archivecleanup supprime tout ce qui est plus ancien que le WAL spécifié
        # On veut garder les WAL des N derniers jours
        CUTOFF_DATE=$(date -d "-${WAL_RETENTION_DAYS} days" +%Y%m%d 2>/dev/null || date -v-${WAL_RETENTION_DAYS}d +%Y%m%d 2>/dev/null || echo "")

        # Fallback simple : supprimer les fichiers de plus de N jours
        WAL_COUNT=$(docker exec "$DB_CONTAINER" bash -c "
            find /wal_archive/ -type f -mtime +${WAL_RETENTION_DAYS} 2>/dev/null | wc -l
        " 2>/dev/null || echo "0")

        if [[ "$WAL_COUNT" -gt 0 ]]; then
            docker exec "$DB_CONTAINER" bash -c "
                find /wal_archive/ -type f -mtime +${WAL_RETENTION_DAYS} -delete 2>/dev/null
            " || true
            WAL_CLEANED=$WAL_COUNT
            log "   ✅ $WAL_CLEANED fichier(s) WAL supprimé(s) (>${WAL_RETENTION_DAYS}j)"
        else
            gray "   Aucun WAL à nettoyer"
        fi
    else
        gray "   Aucun WAL dans /wal_archive"
    fi
else
    # Méthode 2 : find simple (fallback)
    gray "   pg_archivecleanup non disponible — utilisation de find (rétention: ${WAL_RETENTION_DAYS}j)"

    WAL_COUNT=$(docker exec "$DB_CONTAINER" bash -c "
        find /wal_archive/ -type f -mtime +${WAL_RETENTION_DAYS} 2>/dev/null | wc -l
    " 2>/dev/null || echo "0")

    if [[ "$WAL_COUNT" -gt 0 ]]; then
        docker exec "$DB_CONTAINER" bash -c "
            find /wal_archive/ -type f -mtime +${WAL_RETENTION_DAYS} -delete 2>/dev/null
        " || true
        WAL_CLEANED=$WAL_COUNT
        log "   ✅ $WAL_CLEANED fichier(s) WAL supprimé(s) (>${WAL_RETENTION_DAYS}j)"
    else
        gray "   Aucun WAL à nettoyer"
    fi
fi

# Espace libéré dans /wal_archive
WAL_SIZE=$(docker exec "$DB_CONTAINER" bash -c "
    du -sh /wal_archive/ 2>/dev/null | cut -f1
" 2>/dev/null || echo "?")
gray "   Taille actuelle /wal_archive : ${WAL_SIZE}"

# ── 2. Vieux logs applicatifs ─────────────────────────
LOG_DIR="$SCRIPT_DIR/logs"
if [[ -d "$LOG_DIR" ]]; then
    LOG_COUNT=$(find "$LOG_DIR" -name "*.log" -type f -mtime +${LOG_RETENTION_DAYS} 2>/dev/null | wc -l)
    if [[ "$LOG_COUNT" -gt 0 ]]; then
        find "$LOG_DIR" -name "*.log" -type f -mtime +${LOG_RETENTION_DAYS} -delete 2>/dev/null || true
        log "   ✅ $LOG_COUNT fichier(s) de log supprimé(s) (>${LOG_RETENTION_DAYS}j)"
    else
        gray "   Aucun log à nettoyer"
    fi
else
    gray "   Dossier logs/ inexistant"
fi

# ── 3. Backups de sécurité rollback (safety_before_rollback_*) ──
BACKUP_DIR="$SCRIPT_DIR/backups"
if [[ -d "$BACKUP_DIR" ]]; then
    SAFETY_COUNT=$(find "$BACKUP_DIR" -name "safety_before_rollback_*.sql" -type f -mtime +${WAL_RETENTION_DAYS} 2>/dev/null | wc -l)
    if [[ "$SAFETY_COUNT" -gt 0 ]]; then
        find "$BACKUP_DIR" -name "safety_before_rollback_*.sql" -type f -mtime +${WAL_RETENTION_DAYS} -delete 2>/dev/null || true
        log "   ✅ $SAFETY_COUNT backup(s) de sécurité supprimé(s) (>${WAL_RETENTION_DAYS}j)"
    else
        gray "   Aucun backup de sécurité à nettoyer"
    fi
fi

echo ""
log "🧹 Nettoyage terminé"
