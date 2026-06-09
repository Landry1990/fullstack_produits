#!/bin/bash
# Restauration intelligente : Backup complet + Incrémentaux
# Récupère toutes les transactions jusqu'au crash

set -e

# Configuration
BACKUP_DIR="/backup/incremental"
FULL_BACKUP="/backup/full"  # Votre backup quotidien ici
DB_NAME="pharma_db"
DB_USER="postgres"
CONTAINER="fullstack_produits-postgres-1"

echo "=== RESTAURATION INTELLIGENTE ==="
echo ""
echo "Ce script va:"
echo "1. Restaurer le backup complet"
echo "2. Appliquer tous les backups incrémentaux dans l'ordre"
echo "3. Récupérer les transactions manquantes"
echo ""

# Vérifier les arguments
if [ -z "$1" ]; then
    echo "Usage: $0 <date_backup_complet> [heure_max_restaurer]"
    echo ""
    echo "Exemples:"
    echo "  $0 20240609_130000           # Restaurer depuis 13h jusqu'à maintenant"
    echo "  $0 20240609_130000 180000     # Restaurer jusqu'à 18h (heure du crash)"
    echo ""
    echo "Backups disponibles:"
    ls -1 $FULL_BACKUP/*.sql.gz 2>/dev/null | tail -5
    exit 1
fi

FULL_BACKUP_FILE="$FULL_BACKUP/backup_$1.sql.gz"
RESTORE_UP_TO="${2:-999999}"  # Par défaut: jusqu'à maintenant

if [ ! -f "$FULL_BACKUP_FILE" ]; then
    echo "❌ Backup complet non trouvé: $FULL_BACKUP_FILE"
    echo ""
    echo "Backups disponibles:"
    ls -1 $FULL_BACKUP/*.sql.gz 2>/dev/null | tail -10
    exit 1
fi

echo "✓ Backup complet trouvé: $(basename $FULL_BACKUP_FILE)"

# Compter les incrémentaux disponibles
INCREMENTAL_COUNT=$(find $BACKUP_DIR -name "*.sql.gz" -newer $FULL_BACKUP_FILE 2>/dev/null | wc -l)
echo "✓ Incrémentaux trouvés: $INCREMENTAL_COUNT"

if [ "$INCREMENTAL_COUNT" -eq 0 ]; then
    echo ""
    echo "⚠️  Aucun backup incrémental trouvé après cette date!"
    echo "   Vous allez perdre des données. Continuer quand même?"
    read -p "Continuer (o/N): " confirm
    if [[ $confirm != [oO] ]]; then
        exit 1
    fi
fi

echo ""
echo "=== DÉMARRAGE DE LA RESTAURATION ==="
echo ""

# 1. Arrêter l'application (sécurité)
echo "1. Arrêt du backend..."
docker stop fullstack_produits-backend-1 2>/dev/null || true
sleep 2

# 2. Sauvegarder l'état actuel (si base existe)
echo "2. Sauvegarde de sécurité de l'état actuel..."
docker exec $CONTAINER pg_dump -U $DB_USER -d $DB_NAME --inserts 2>/dev/null | gzip > "$BACKUP_DIR/emergency_backup_$(date +%Y%m%d_%H%M%S).sql.gz" || echo "   Base vide ou non accessible"

# 3. Supprimer et recréer la base
echo "3. Recréation de la base de données..."
docker exec $CONTAINER psql -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
docker exec $CONTAINER psql -U $DB_USER -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true

# 4. Restaurer le backup complet
echo "4. Restauration du backup complet ($1)..."
gunzip -c "$FULL_BACKUP_FILE" | docker exec -i $CONTAINER psql -U $DB_USER -d $DB_NAME 2>&1 | grep -E "(INSERT|ERROR|SET)" | head -5 || echo "   ✓ Complet restauré"

# 5. Appliquer les incrémentaux dans l'ordre chronologique
echo ""
echo "5. Application des backups incrémentaux..."
echo ""

# Trier par date et filtrer jusqu'à l'heure cible
count=0
for file in $(ls -1 $BACKUP_DIR/*.sql.gz 2>/dev/null | sort | awk -v ts="$RESTORE_UP_TO" '
    BEGIN { 
        # Extraire timestamp du fichier: 20240609_143000
        split(ts, a, "_")
        target_date = substr(a[1], 1, 4) "-" substr(a[1], 5, 2) "-" substr(a[1], 7, 2)
        target_time = substr(a[2], 1, 2) ":" substr(a[2], 3, 2) ":" substr(a[2], 5, 2)
        target_epoch = mktime(substr(a[1], 1, 4) " " substr(a[1], 5, 2) " " substr(a[1], 7, 2) " " substr(a[2], 1, 2) " " substr(a[2], 3, 2) " " substr(a[2], 5, 2))
    }
    {
        # Extraire timestamp du nom de fichier
        match($0, /[0-9]{8}_[0-9]{6}/, arr)
        if (arr[0] != "") {
            split(arr[0], b, "_")
            file_epoch = mktime(substr(b[1], 1, 4) " " substr(b[1], 5, 2) " " substr(b[1], 7, 2) " " substr(b[2], 1, 2) " " substr(b[2], 3, 2) " " substr(b[2], 5, 2))
            if (file_epoch <= target_epoch) print $0
        }
    }
' 2>/dev/null || ls -1 $BACKUP_DIR/*.sql.gz 2>/dev/null | sort); do
    
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "   [$((++count))] $filename..."
        
        # Appliquer le backup incrémental (ignore les erreurs de clés étrangères)
        gunzip -c "$file" | docker exec -i $CONTAINER psql -U $DB_USER -d $DB_NAME 2>&1 | grep -E "ERROR.*duplicate" | head -3 || true
    fi
done

echo ""
echo "   ✓ $count backups incrémentaux appliqués"

# 6. Vérifier la cohérence
echo ""
echo "6. Vérification de la restauration..."

# Compter les factures
FACTURE_COUNT=$(docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM api_facture;" 2>/dev/null | xargs)
echo "   • Factures restaurées: $FACTURE_COUNT"

# Dernière vente
LAST_SALE=$(docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "
    SELECT TO_CHAR(MAX(date), 'YYYY-MM-DD HH24:MI') FROM api_facture;
" 2>/dev/null | xargs)
echo "   • Dernière vente: $LAST_SALE"

# Stock actuel
STOCK_COUNT=$(docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM api_mouvementstock;" 2>/dev/null | xargs)
echo "   • Mouvements stock: $STOCK_COUNT"

# 7. Redémarrer l'application
echo ""
echo "7. Redémarrage du backend..."
docker start fullstack_produits-backend-1

echo ""
echo "=== ✅ RESTAURATION TERMINÉE ==="
echo ""
echo "Résumé:"
echo "  • Backup complet: $(basename $FULL_BACKUP_FILE)"
echo "  • Incrémentaux appliqués: $count"
echo "  • Dernière transaction: $LAST_SALE"
echo ""
echo "Application accessible sur: http://localhost"
