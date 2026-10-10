#!/usr/bin/env bash
# ============================================================
# Configuration du cron de backup automatique (Ubuntu/Linux)
# Usage: sudo ./setup-backup-cron.sh [--user ubuntu] [--hour 2]
# ============================================================
# Installe 3 tâches cron:
#   - Backup toutes les heures (rétention 7 jours)
#   - Backup quotidien à 2h du matin (rétention 30 jours)
#   - Vérification des backups toutes les 6h (alerte si trop ancien)
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRON_USER="${SUDO_USER:-$(whoami)}"
DAILY_HOUR=2
REMOVE_MODE=false

# Parse args
while [[ $# -gt 0 ]]; do
    case "$1" in
        --user) CRON_USER="$2"; shift 2 ;;
        --hour) DAILY_HOUR="$2"; shift 2 ;;
        --remove) REMOVE_MODE=true; shift ;;
        *) shift ;;
    esac
done

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}$1${NC}"; }
warn() { echo -e "${YELLOW}$1${NC}"; }
info() { echo -e "${CYAN}$1${NC}"; }
err()  { echo -e "${RED}$1${NC}"; }

BACKUP_SCRIPT="$SCRIPT_DIR/backup-db.sh"
VERIFY_SCRIPT="$SCRIPT_DIR/verify-backup.sh"
LOG_DIR="$SCRIPT_DIR/logs"
CRON_LOG="$LOG_DIR/cron-backup.log"
CRON_TAG="# ZENITH-BACKUP-AUTO"

# Vérifier que le script de backup existe
if [[ ! -f "$BACKUP_SCRIPT" ]]; then
    err "❌ Script manquant: $BACKUP_SCRIPT"
    exit 1
fi

# Rendre les scripts exécutables
chmod +x "$BACKUP_SCRIPT"
[[ -f "$VERIFY_SCRIPT" ]] && chmod +x "$VERIFY_SCRIPT"

mkdir -p "$LOG_DIR"

if [[ "$REMOVE_MODE" == true ]]; then
    info "🗑️  Suppression des tâches cron Zenith Backup..."
    crontab -u "$CRON_USER" -l 2>/dev/null | grep -v "$CRON_TAG" | crontab -u "$CRON_USER" - || true
    log "✅ Tâches cron supprimées"
    exit 0
fi

info "⚙️  Configuration du cron de backup automatique"
info "   Utilisateur: $CRON_USER"
info "   Répertoire:  $SCRIPT_DIR"
info "   Backup quotidien à: ${DAILY_HOUR}h00"
echo ""

# Script de vérification d'ancienneté (alerte si le backup date de plus de 2h)
CHECK_SCRIPT="$SCRIPT_DIR/check-backup-age.sh"
cat > "$CHECK_SCRIPT" << 'CHECKSCRIPT'
#!/usr/bin/env bash
BACKUP_DIR="$(dirname "$0")/backups"
LOG_DIR="$(dirname "$0")/logs"
LOG_FILE="$LOG_DIR/backup.log"
MAX_AGE_HOURS=2

mkdir -p "$LOG_DIR"

latest=$(find "$BACKUP_DIR" -name "backup-*.sql" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)

if [[ -z "$latest" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ALERT] Aucun backup trouvé dans $BACKUP_DIR !" >> "$LOG_FILE"
    exit 1
fi

age_seconds=$(( $(date +%s) - $(stat -c %Y "$latest") ))
age_hours=$(( age_seconds / 3600 ))

if [[ $age_hours -gt $MAX_AGE_HOURS ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ALERT] Backup trop ancien: ${age_hours}h (max: ${MAX_AGE_HOURS}h) - Dernier: $(basename "$latest")" >> "$LOG_FILE"
    exit 1
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [OK] Backup récent: ${age_hours}h - $(basename "$latest")" >> "$LOG_FILE"
fi
CHECKSCRIPT
chmod +x "$CHECK_SCRIPT"

# Supprimer les anciennes entrées cron Zenith Backup
EXISTING_CRON=$(crontab -u "$CRON_USER" -l 2>/dev/null | grep -v "$CRON_TAG" || true)

# Nouvelles entrées cron
NEW_ENTRIES=$(cat << EOF
$EXISTING_CRON
# ── Zenith Backup Auto ────────────────────────────────── $CRON_TAG
# Backup horaire (rétention 7 jours)
0 * * * * $BACKUP_SCRIPT --retention-days 7 >> $CRON_LOG 2>&1 $CRON_TAG
# Backup quotidien profond à ${DAILY_HOUR}h (rétention 30 jours)
0 ${DAILY_HOUR} * * * $BACKUP_SCRIPT --retention-days 30 >> $CRON_LOG 2>&1 $CRON_TAG
# Vérification d'ancienneté toutes les 6h
0 */6 * * * $CHECK_SCRIPT $CRON_TAG
# ─────────────────────────────────────────────────────────
EOF
)

echo "$NEW_ENTRIES" | crontab -u "$CRON_USER" -
log "✅ Tâches cron installées pour l'utilisateur '$CRON_USER'"
echo ""

# Afficher le cron actuel
info "📋 Crontab actuelle:"
crontab -u "$CRON_USER" -l | grep "$CRON_TAG" | grep -v "^#.*CRON_TAG" | head -10
echo ""

warn "📌 Pour vérifier les logs de backup:"
echo "   tail -f $LOG_DIR/backup.log"
echo "   tail -f $CRON_LOG"
echo ""
warn "📌 Pour supprimer les tâches cron:"
echo "   sudo $0 --remove"
echo ""
log "✅ Setup terminé. Premier backup automatique à la prochaine heure pleine."
