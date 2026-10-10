#!/bin/bash
# Restauration intelligente Linux : Backup complet + Incrémentaux

set -e

# Configuration
BACKUP_DIR="/backup/incremental"
FULL_BACKUP_DIR="/backup/full"
DB_NAME="pharma_db"
DB_USER="postgres"
CONTAINER="fullstack_produits-postgres-1"

usage() {
    echo "Usage: $0 <date_backup_complet> [heure_max_restaurer]"
    echo ""
    echo "Exemples:"
    echo "  $0 20240609_080000           # Restaurer depuis 08h jusqu'à maintenant"
    echo "  $0 20240609_080000 180000     # Restaurer jusqu'à 18h (heure du crash)"
    echo ""
    echo "Backups complets disponibles:"
    ls -1 "$FULL_BACKUP_DIR"/full_*.sql.gz 2>/dev/null | tail -5 | xargs -n1 basename
    exit 1
}

# Vérifier arguments
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
    echo "Backups disponibles:"
    ls -1 "$FULL_BACKUP_DIR"/full_*.sql.gz 2>/dev/null | tail -10 | xargs -n1 basename || echo "  (aucun)"
    exit 1
fi

echo "=== RESTAURATION INTELLIGENTE ==="
echo ""
echo "Backup complet: $(basename "$FULL_BACKUP_FILE")"

# Compter les incrémentaux
INCREMENTAL_COUNT=$(find "$BACKUP_DIR" -name "*.sql.gz" -newer "$FULL_BACKUP_FILE" 2>/dev/null | wc -l)
echo "Incrémentaux trouvés: $INCREMENTAL_COUNT"

if [ "$INCREMENTAL_COUNT" -eq 0 ]; then
    echo ""
    echo "⚠️  Aucun backup incrémental trouvé après cette date!"
    read -p "Continuer quand même? (o/N): " confirm
    [[ $confirm =~ ^[Oo]$ ]] || exit 1
fi

echo ""
echo "=== DÉMARRAGE ==="
echo ""

# 1. Arrêter le backend
echo "1. Arrêt du backend..."
docker stop fullstack_produits-backend-1 2>/dev/null || true
sleep 2

# 2. Sauvegarde de sécurité
echo "2. Sauvegarde de sécurité..."
docker exec "$CONTAINER" pg_dumpall -U postgres 2>/dev/null | gzip > "$BACKUP_DIR/emergency_$(date +%Y%m%d_%H%M%S).sql.gz" || echo "   Base inaccessible ou vide"

# 3. Recréer la base
echo "3. Recréation de la base..."
docker exec "$CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
docker exec "$CONTAINER" psql -U postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true
docker exec "$CONTAINER" psql -U postgres -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" 2>/dev/null || true

# 4. Restaurer backup complet
echo "4. Restauration du backup complet..."
gunzip -c "$FULL_BACKUP_FILE" | docker exec -i "$CONTAINER" psql -U postgres -d "$DB_NAME" 2>&1 | grep -E "(CREATE|INSERT|ERROR|SET)" | head -5 || echo "   ✓ Complet restauré"

# 5. Appliquer les incrémentaux
echo ""
echo "5. Application des incrémentaux..."
echo ""

count=0
for file in $(ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null | sort); do
    # Extraire timestamp du nom: 20240609_143000_api_facture.sql.gz
    filename=$(basename "$file")
    if [[ $filename =~ ([0-9]{8}_[0-9]{6}) ]]; then
        file_timestamp="${BASH_REMATCH[1]}"
        
        # Comparer avec la limite
        if [[ "$file_timestamp" < "$RESTORE_UP_TO" ]] || [[ "$file_timestamp" == "$RESTORE_UP_TO" ]]; then
            echo "   [$((++count))] $(basename "$file")..."
            
            # Extraire table concernée
            table=$(echo "$filename" | grep -oP '(?<=_)[a-z_]+(?=\.sql)')
            
            # Appliquer (ignore erreurs de doublons)
            gunzip -c "$file" | docker exec -i "$CONTAINER" psql -U postgres -d "$DB_NAME" 2>&1 | grep -E "ERROR.*(duplicate|violates)" | head -2 || true
        fi
    fi
done

echo ""
echo "   ✓ $count backups incrémentaux appliqués"

# 6. Vérification
echo ""
echo "6. Vérification..."

FACTURE_COUNT=$(docker exec "$CONTAINER" psql -U postgres -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM api_facture;" 2>/dev/null | xargs || echo "N/A")
LAST_SALE=$(docker exec "$CONTAINER" psql -U postgres -d "$DB_NAME" -t -c "SELECT TO_CHAR(MAX(date), 'YYYY-MM-DD HH24:MI') FROM api_facture;" 2>/dev/null | xargs || echo "N/A")
STOCK_COUNT=$(docker exec "$CONTAINER" psql -U postgres -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM api_mouvementstock;" 2>/dev/null | xargs || echo "N/A")

echo "   • Factures: $FACTURE_COUNT"
echo "   • Dernière vente: $LAST_SALE"
echo "   • Mouvements stock: $STOCK_COUNT"

# 7. Redémarrer
echo ""
echo "7. Redémarrage du backend..."
docker start fullstack_produits-backend-1

echo ""
echo "=== ✅ RESTAURATION TERMINÉE ==="
echo ""
echo "Résumé:"
echo "  • Backup: $(basename "$FULL_BACKUP_FILE")"
echo "  • Incrémentaux: $count"
echo "  • Dernière transaction: $LAST_SALE"
echo ""
echo "Application: http://$(hostname -I | awk '{print $1}'):80"
