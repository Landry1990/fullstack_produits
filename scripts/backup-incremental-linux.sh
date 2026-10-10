#!/bin/bash
# Backup incrémental Linux - Toutes les 30 minutes
# Tables critiques pour pharmacie

set -e

# Configuration
BACKUP_DIR="/backup/incremental"
FULL_BACKUP_DIR="/backup/full"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="pharma_db"
DB_USER="postgres"
CONTAINER="fullstack_produits-postgres-1"
RETENTION_HOURS=48

# Créer les dossiers
mkdir -p "$BACKUP_DIR" "$FULL_BACKUP_DIR"

# Tables à sauvegarder (par ordre de priorité)
TABLES=(
    # Ventes (CRITIQUE)
    "api_facture"
    "api_lignefacture"
    "api_sessionticket"
    
    # Stocks
    "api_mouvementstock"
    "api_inventaire"
    "api_ligneinventaire"
    
    # Comptabilité
    "api_ecriture"
    "api_operation"
    "api_journalcaisse"
    
    # Commandes fournisseurs
    "api_commande"
    "api_lignecommande"
    
    # Coupons monnaie
    "api_couponmonnaie"
    
    # Sessions caisse
    "api_sessioncaisse"
    
    # Clients
    "api_client"
    
    # Paiements
    "api_paiement"
)

echo "=== Backup incrémental $TIMESTAMP ==="
echo ""

# Fonction de backup
backup_table() {
    local table=$1
    local output="$BACKUP_DIR/${TIMESTAMP}_${table}.sql"
    
    echo -n "Backup $table..."
    
    if docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" \
        --data-only --inserts --no-owner --no-privileges \
        --table="$table" > "$output" 2>/dev/null; then
        
        if [ -s "$output" ]; then
            gzip -f "$output"
            local size=$(du -h "${output}.gz" 2>/dev/null | cut -f1)
            echo " OK ($size)"
        else
            rm -f "$output"
            echo " vide"
        fi
    else
        rm -f "$output"
        echo " erreur"
    fi
}

# Backup de chaque table
for table in "${TABLES[@]}"; do
    backup_table "$table"
done

# Cleanup
echo ""
echo "=== Nettoyage (rétention ${RETENTION_HOURS}h) ==="
find "$BACKUP_DIR" -name "*.sql.gz" -mmin +$((RETENTION_HOURS * 60)) -delete -print | wc -l | xargs echo "Fichiers supprimés:"

# Résumé
echo ""
echo "=== Résumé ==="
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -10
echo ""
echo "Total: $(ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l) fichiers"
echo "Espace utilisé: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"
echo "Backup stocké dans: $BACKUP_DIR"
