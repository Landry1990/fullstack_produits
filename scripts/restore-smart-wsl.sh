#!/bin/bash
# Restauration intelligente pour WSL

set -e

BACKUP_DIR="/mnt/c/backup/incremental"
FULL_BACKUP_DIR="/mnt/c/backup/full"
DB_NAME="pharma_db"
DB_USER="postgres"

# Détection auto du container
CONTAINER=$(docker ps --format "{{.Names}}" | grep -i postgres | head -1)

if [ -z "$CONTAINER" ]; then
    echo "❌ Container PostgreSQL non trouvé!"
    docker ps --format "Containers: {{.Names}}"
    exit 1
fi

usage() {
    echo "Usage: $0 <date_backup_complet> [heure_max_restaurer]"
    echo ""
    echo "Exemples:"
    echo "  $0 20240609_080000           # Restaurer depuis 08h jusqu'à maintenant"
    echo "  $0 20240609_080000 180000     # Restaurer jusqu'à 18h (heure du crash)"
    echo ""
    echo "Backups disponibles dans C:\\backup\\:"
    ls -1 "$FULL_BACKUP_DIR"/full_*.sql.gz 2>/dev/null | xargs -n1 basename || echo "  (aucun)"
    exit 1
}

if [ -z "$1" ]; then
    usage
fi

FULL_BACKUP_PATTERN="$1"
RESTORE_UP_TO="${2:-999999}"

# Chercher le backup complet
FULL_BACKUP_FILE=$(ls -1 "$FULL_BACKUP_DIR"/full_*${FULL_BACKUP_PATTERN}*.sql.gz 2>/dev/null | head -1)

if [ -z "$FULL_BACKUP_FILE" ] || [ ! -f "$FULL_BACKUP_FILE" ]; then
    echo "❌ Backup complet non trouvé: pattern '$FULL_BACKUP_PATTERN'"
    echo ""
    echo "Dans C:\\backup\\full\\:"
    ls -1 "$FULL_BACKUP_DIR"/*.sql.gz 2>/dev/null | xargs -n1 basename || echo "  (vide)"
    exit 1
fi

echo "=== RESTAURATION WSL ==="
echo "Container: $CONTAINER"
echo "Backup: $(basename "$FULL_BACKUP_FILE")"
echo ""

INCREMENTAL_COUNT=$(find "$BACKUP_DIR" -name "*.sql.gz" -newer "$FULL_BACKUP_FILE" 2>/dev/null | wc -l)
echo "Incrémentaux trouvés: $INCREMENTAL_COUNT"

echo ""
echo "=== DÉMARRAGE ==="
echo ""

# 1. Arrêter le backend
echo "1. Arrêt du backend..."
BACKEND=$(docker ps --format "{{.Names}}" | grep -i backend | head -1)
if [ -n "$BACKEND" ]; then
    docker stop "$BACKEND" 2>/dev/null || true
fi
sleep 2

# 2. Backup de sécurité
echo "2. Sauvegarde de sécurité..."
EMERGENCY="$BACKUP_DIR/emergency_$(date +%Y%m%d_%H%M%S).sql.gz"
docker exec "$CONTAINER" pg_dumpall -U "$DB_USER" 2>/dev/null | gzip > "$EMERGENCY" || echo "   Base vide/inaccessible"

# 3. Recréer la base
echo "3. Recréation de la base..."
docker exec "$CONTAINER" psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
docker exec "$CONTAINER" psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true

# 4. Restaurer backup complet
echo "4. Restauration backup complet..."
gunzip -c "$FULL_BACKUP_FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" 2>&1 | tail -3

# 5. Appliquer incrémentaux
echo ""
echo "5. Application des incrémentaux..."
count=0
for file in $(ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null | sort); do
    filename=$(basename "$file")
    if [[ $filename =~ ([0-9]{8}_[0-9]{6}) ]]; then
        file_timestamp="${BASH_REMATCH[1]}"
        if [[ "$file_timestamp" < "$RESTORE_UP_TO" ]] || [[ "$file_timestamp" == "$RESTORE_UP_TO" ]]; then
            if [ "$file" -nt "$FULL_BACKUP_FILE" ]; then
                echo "   [$((++count))] $filename"
                gunzip -c "$file" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" 2>/dev/null || true
            fi
        fi
    fi
done

echo "   ✓ $count incrémentaux appliqués"

# 6. Vérification
echo ""
echo "6. Vérification..."
FACTURE_COUNT=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM api_facture;" 2>/dev/null | xargs || echo "N/A")
LAST_SALE=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT TO_CHAR(MAX(date), 'DD/MM HH24:MI') FROM api_facture;" 2>/dev/null | xargs || echo "N/A")

echo "   • Factures: $FACTURE_COUNT"
echo "   • Dernière vente: $LAST_SALE"

# 7. Redémarrer backend
echo ""
echo "7. Redémarrage..."
if [ -n "$BACKEND" ]; then
    docker start "$BACKEND" 2>/dev/null || true
fi

echo ""
echo "=== ✅ RESTAURATION TERMINÉE ==="
echo ""
echo "💾 Sauvegarde de sécurité: $(basename "$EMERGENCY")"
echo ""
echo "📁 Backups sur Windows: C:\backup\\"
echo ""
