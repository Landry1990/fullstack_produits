#!/usr/bin/env bash
# ============================================================
# Backup PostgreSQL depuis le conteneur Docker (Linux/Ubuntu)
# Usage: ./backup-db.sh [--retention-days 7] [--gdrive-dir /mnt/gdrive]
#
# Pour Google Drive : monter via rclone ou volume Docker,
# puis passer --gdrive-dir ou définir GDRIVE_DIR dans .env
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RETENTION_DAYS=7
GDRIVE_DIR=""
EXIT_CODE=0

# Parse args
for ((i=1; i<=$#; i++)); do
    arg="${!i}"
    if [[ "$arg" == "--retention-days" ]]; then
        next=$((i+1))
        RETENTION_DAYS="${!next:-7}"
    elif [[ "$arg" == "--gdrive-dir" ]]; then
        next=$((i+1))
        GDRIVE_DIR="${!next:-}"
    fi
done

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

# Creer les dossiers
BACKUP_DIR="$SCRIPT_DIR/backups"
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$BACKUP_DIR" "$LOG_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup-${TIMESTAMP}.sql"
CHECKSUM_FILE="${BACKUP_FILE}.md5"
LOG_FILE="$LOG_DIR/backup.log"

# Charger .env si existe
ENV_FILE="$SCRIPT_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

DB_USER="${DB_USER:-fullstack_user}"
DB_NAME="${DB_NAME:-fullstack_db}"
CONTAINER="${DB_CONTAINER:-fullstack_produits-db-1}"

# Chemin Google Drive depuis .env si non passé en argument
if [[ -z "$GDRIVE_DIR" && -n "${GDRIVE_DIR:-}" ]]; then
    GDRIVE_DIR="$GDRIVE_DIR"
fi

log_entry() {
    local level="$1"
    local msg="$2"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $msg" >> "$LOG_FILE"
}

info "💾 Backup de la base de donnees..."
gray "   Conteneur: $CONTAINER"
gray "   DB: $DB_NAME"
gray "   Fichier: $BACKUP_FILE"
log_entry "INFO" "Debut backup - DB: $DB_NAME - Fichier: $(basename "$BACKUP_FILE")"

# Vérifier que le conteneur est actif
if ! docker inspect --format='{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q "true"; then
    err "   ❌ Conteneur $CONTAINER non démarré"
    log_entry "ERROR" "Conteneur $CONTAINER non démarré - backup annulé"
    exit 1
fi

# Dump PostgreSQL
if docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges > "$BACKUP_FILE" 2>>"$LOG_FILE"; then
    if [[ -s "$BACKUP_FILE" ]]; then
        SIZE_MB=$(du -m "$BACKUP_FILE" | cut -f1)
        log "   ✅ Backup OK (${SIZE_MB} MB)"
        log_entry "INFO" "Backup OK - Taille: ${SIZE_MB}MB - Fichier: $(basename "$BACKUP_FILE")"

        # Générer le checksum MD5
        md5sum "$BACKUP_FILE" > "$CHECKSUM_FILE"
        CHECKSUM=$(cut -d' ' -f1 "$CHECKSUM_FILE")
        gray "   MD5: $CHECKSUM"
        log_entry "INFO" "Checksum MD5: $CHECKSUM"

        # Copie vers Google Drive (si configuré)
        if [[ -n "$GDRIVE_DIR" ]]; then
            if [[ -d "$GDRIVE_DIR" ]]; then
                GDRIVE_BACKUP_DIR="$GDRIVE_DIR/pharmacie-backups"
                mkdir -p "$GDRIVE_BACKUP_DIR"
                cp "$BACKUP_FILE" "$GDRIVE_BACKUP_DIR/"
                cp "$CHECKSUM_FILE" "$GDRIVE_BACKUP_DIR/"
                log "   ☁️  Copie Google Drive OK: $(basename "$BACKUP_FILE")"
                log_entry "INFO" "Copie Google Drive OK: $(basename "$BACKUP_FILE")"
            else
                warn "   ⚠️ Dossier Google Drive introuvable: $GDRIVE_DIR"
                log_entry "WARN" "Dossier Google Drive introuvable: $GDRIVE_DIR"
            fi
        fi
    else
        err "   ❌ Backup echoue (fichier vide)"
        log_entry "ERROR" "Backup échoué - fichier vide"
        rm -f "$BACKUP_FILE"
        EXIT_CODE=1
    fi
else
    err "   ❌ Erreur pg_dump"
    log_entry "ERROR" "Erreur pg_dump - voir logs Docker"
    rm -f "$BACKUP_FILE"
    EXIT_CODE=1
fi

# Nettoyer vieux backups locaux (SQL + MD5)
if [[ $EXIT_CODE -eq 0 ]]; then
    warn "🧹 Nettoyage des backups plus anciens que ${RETENTION_DAYS} jours..."
    DELETED=$(find "$BACKUP_DIR" -name "backup-*.sql" -type f -mtime +$RETENTION_DAYS -print | wc -l)
    find "$BACKUP_DIR" -name "backup-*.sql" -type f -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "backup-*.sql.md5" -type f -mtime +$RETENTION_DAYS -delete
    log "   $DELETED fichier(s) supprime(s)"
    log_entry "INFO" "Nettoyage: $DELETED ancien(s) backup(s) supprimé(s)"

    # Nettoyer aussi sur Google Drive si configuré
    if [[ -n "$GDRIVE_DIR" && -d "$GDRIVE_DIR" ]]; then
        GDRIVE_BACKUP_DIR="$GDRIVE_DIR/pharmacie-backups"
        GDRIVE_DELETED=$(find "$GDRIVE_BACKUP_DIR" -name "backup-*.sql" -type f -mtime +$RETENTION_DAYS -print 2>/dev/null | wc -l)
        find "$GDRIVE_BACKUP_DIR" -name "backup-*.sql" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
        find "$GDRIVE_BACKUP_DIR" -name "backup-*.sql.md5" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
        if [[ $GDRIVE_DELETED -gt 0 ]]; then
            log "   ☁️  $GDRIVE_DELETED fichier(s) supprimé(s) sur Google Drive"
            log_entry "INFO" "Nettoyage Google Drive: $GDRIVE_DELETED fichier(s) supprimé(s)"
        fi
    fi
fi

# Résumé
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "backup-*.sql" -type f | wc -l)
log_entry "INFO" "Fin backup - $BACKUP_COUNT backup(s) au total - Code: $EXIT_CODE"

echo ""
echo "Commandes utiles :"
gray "  Lister:    ls -lh backups/"
gray "  Vérifier:  ./verify-backup.sh backups/backup-XXXXXX.sql"
gray "  Restaurer: cat backups/backup-XXXXXX.sql | docker exec -i $CONTAINER psql -U $DB_USER -d $DB_NAME"
echo ""

exit $EXIT_CODE
