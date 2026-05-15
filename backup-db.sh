#!/usr/bin/env bash
# ============================================================
# Backup PostgreSQL depuis le conteneur Docker (Linux/Ubuntu)
# Usage: ./backup-db.sh [--retention-days 7]
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RETENTION_DAYS=7

# Parse args
for ((i=1; i<=$#; i++)); do
    arg="${!i}"
    if [[ "$arg" == "--retention-days" ]]; then
        next=$((i+1))
        RETENTION_DAYS="${!next:-7}"
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

# Creer le dossier backups
BACKUP_DIR="$SCRIPT_DIR/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup-${TIMESTAMP}.sql"

# Charger .env si existe
ENV_FILE="$SCRIPT_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

DB_USER="${DB_USER:-fullstack_user}"
DB_NAME="${DB_NAME:-fullstack_db}"

info "💾 Backup de la base de donnees..."
gray "   Conteneur: fullstack_produits-db-1"
gray "   DB: $DB_NAME"
gray "   Fichier: $BACKUP_FILE"

if docker exec fullstack_produits-db-1 pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges > "$BACKUP_FILE" 2>/dev/null; then
    if [[ -s "$BACKUP_FILE" ]]; then
        SIZE_MB=$(du -m "$BACKUP_FILE" | cut -f1)
        log "   ✅ Backup OK (${SIZE_MB} MB)"
    else
        err "   ❌ Backup echoue (fichier vide)"
        exit 1
    fi
else
    err "   ❌ Erreur pg_dump"
    exit 1
fi

# Nettoyer vieux backups
warn "🧹 Nettoyage des backups plus anciens que ${RETENTION_DAYS} jours..."
DELETED=$(find "$BACKUP_DIR" -name "backup-*.sql" -type f -mtime +$RETENTION_DAYS -delete -print | wc -l)
log "   $DELETED fichier(s) supprime(s)"

echo ""
echo "Commandes utiles :"
gray "  Lister:  ls backups/"
gray "  Restore: cat backups/backup-XXXXXX.sql | docker exec -i fullstack_produits-db-1 psql -U $DB_USER -d $DB_NAME"
echo ""
