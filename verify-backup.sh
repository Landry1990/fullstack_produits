#!/usr/bin/env bash
# ============================================================
# Vérification d'intégrité d'un backup avant restauration
# Usage: ./verify-backup.sh <fichier_backup.sql>
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

log()  { echo -e "${GREEN}$1${NC}"; }
err()  { echo -e "${RED}$1${NC}"; }
info() { echo -e "${CYAN}$1${NC}"; }
gray() { echo -e "${GRAY}$1${NC}"; }

BACKUP_FILE="${1:-}"

if [[ -z "$BACKUP_FILE" ]]; then
    err "Usage: $0 <fichier_backup.sql>"
    echo ""
    echo "Exemples:"
    gray "  $0 backups/backup-20260523-144630.sql"
    gray "  $0 backups/backup-20260523-144630.sql --restore"
    exit 1
fi

# Résoudre le chemin absolu
if [[ ! "$BACKUP_FILE" = /* ]]; then
    BACKUP_FILE="$SCRIPT_DIR/$BACKUP_FILE"
fi

CHECKSUM_FILE="${BACKUP_FILE}.md5"
RESTORE_MODE="${2:-}"

info "🔍 Vérification du backup: $(basename "$BACKUP_FILE")"
echo ""

# 1. Existence du fichier
if [[ ! -f "$BACKUP_FILE" ]]; then
    err "❌ Fichier introuvable: $BACKUP_FILE"
    exit 1
fi
log "✅ Fichier présent"

# 2. Taille non nulle
SIZE_MB=$(du -m "$BACKUP_FILE" | cut -f1)
SIZE_BYTES=$(wc -c < "$BACKUP_FILE")
if [[ "$SIZE_BYTES" -eq 0 ]]; then
    err "❌ Fichier vide (0 octets)"
    exit 1
fi
log "✅ Taille: ${SIZE_MB} MB ($SIZE_BYTES octets)"

# 3. Format PostgreSQL valide (première ligne)
FIRST_LINE=$(head -1 "$BACKUP_FILE" 2>/dev/null || echo "")
if echo "$FIRST_LINE" | grep -qE "(PostgreSQL|--\s*Dumped|^\\\\|^SET|^CREATE|^COPY)"; then
    log "✅ Format PostgreSQL valide"
elif echo "$FIRST_LINE" | grep -q "PGDMP"; then
    log "✅ Format PostgreSQL binary valide"
else
    err "⚠️  Avertissement: format non reconnu (première ligne: $FIRST_LINE)"
fi

# 4. Checksum MD5
if [[ -f "$CHECKSUM_FILE" ]]; then
    EXPECTED_MD5=$(cut -d' ' -f1 "$CHECKSUM_FILE")
    ACTUAL_MD5=$(md5sum "$BACKUP_FILE" | cut -d' ' -f1)
    if [[ "$EXPECTED_MD5" == "$ACTUAL_MD5" ]]; then
        log "✅ Checksum MD5 OK: $ACTUAL_MD5"
    else
        err "❌ Checksum MD5 INVALIDE!"
        err "   Attendu:  $EXPECTED_MD5"
        err "   Calculé:  $ACTUAL_MD5"
        err "   Le fichier est peut-être corrompu ou altéré."
        exit 1
    fi
else
    echo -e "${GRAY}⚠️  Pas de fichier .md5 associé (backup ancien). Génération...${NC}"
    md5sum "$BACKUP_FILE" > "$CHECKSUM_FILE"
    CHECKSUM=$(cut -d' ' -f1 "$CHECKSUM_FILE")
    gray "   MD5 généré: $CHECKSUM"
fi

# 5. Contenu minimal (tables présentes)
TABLE_COUNT=$(grep -c "^CREATE TABLE" "$BACKUP_FILE" 2>/dev/null || echo "0")
gray "   Tables trouvées: $TABLE_COUNT"
if [[ "$TABLE_COUNT" -gt 0 ]]; then
    log "✅ Structure SQL présente ($TABLE_COUNT tables)"
else
    err "⚠️  Aucune instruction CREATE TABLE trouvée"
fi

# 6. Résumé
echo ""
log "═══════════════════════════════════════"
log "  ✅ Backup VALIDE - prêt à restaurer"
log "═══════════════════════════════════════"
echo ""

# 7. Mode restauration (optionnel)
if [[ "$RESTORE_MODE" == "--restore" ]]; then
    ENV_FILE="$SCRIPT_DIR/.env"
    if [[ -f "$ENV_FILE" ]]; then
        set -a
        source "$ENV_FILE"
        set +a
    fi
    DB_USER="${DB_USER:-fullstack_user}"
    DB_NAME="${DB_NAME:-fullstack_db}"
    CONTAINER="${DB_CONTAINER:-fullstack_produits-db-1}"

    echo -e "${RED}⚠️  RESTAURATION EN COURS - Cette action va ÉCRASER la base $DB_NAME !${NC}"
    read -r -p "Confirmer (oui/non): " CONFIRM
    if [[ "$CONFIRM" != "oui" ]]; then
        err "Restauration annulée."
        exit 0
    fi

    info "🔄 Restauration de $DB_NAME..."
    if cat "$BACKUP_FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q; then
        log "✅ Restauration réussie !"
    else
        err "❌ Erreur lors de la restauration"
        exit 1
    fi
fi
