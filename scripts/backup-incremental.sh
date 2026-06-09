#!/bin/bash
# Backup incrémental des transactions - Toutes les 30 minutes
# Tables critiques : ventes, stocks, compta, commandes, coupons

set -e

# Configuration
BACKUP_DIR="/backup/incremental"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="pharma_db"
DB_USER="postgres"
CONTAINER="fullstack_produits-postgres-1"
RETENTION_HOURS=48  # Garder 48h d'historique

# Créer le dossier
mkdir -p "$BACKUP_DIR"

# Fonction de backup d'une table
backup_table() {
    local table=$1
    local output="$BACKUP_DIR/${TIMESTAMP}_${table}.sql"
    
    echo "Backup $table..."
    docker exec $CONTAINER pg_dump -U $DB_USER -d $DB_NAME \
        --data-only \
        --inserts \
        --no-owner \
        --no-privileges \
        --table="$table" \
        > "$output" 2>/dev/null || echo "Table $table vide ou erreur"
    
    # Compresser si fichier non vide
    if [ -s "$output" ]; then
        gzip "$output"
        echo "✓ $table sauvegardé ($(du -h ${output}.gz | cut -f1))"
    else
        rm -f "$output"
        echo "○ $table vide, ignoré"
    fi
}

echo "=== Backup incrémental $TIMESTAMP ==="
echo ""

# 1. Ventes (critique)
backup_table "api_facture"
backup_table "api_lignefacture"
backup_table "api_sessionticket"

# 2. Stocks (mouvements)
backup_table "api_mouvementstock"
backup_table "api_inventaire"
backup_table "api_ligneinventaire"

# 3. Comptabilité
backup_table "api_ecriture"
backup_table "api_operation"
backup_table "api_journalcaisse"

# 4. Commandes fournisseurs
backup_table "api_commande"
backup_table "api_lignecommande"

# 5. Coupons (monnaie)
backup_table "api_couponmonnaie"

# 6. Sessions de caisse (état)
backup_table "api_sessioncaisse"

# 7. Clients (nouveaux)
backup_table "api_client"

# 8. Paiements
backup_table "api_paiement"

# Cleanup : supprimer les backups de plus de 48h
echo ""
echo "=== Nettoyage (retention ${RETENTION_HOURS}h) ==="
find "$BACKUP_DIR" -name "*.sql.gz" -mmin +$((RETENTION_HOURS * 60)) -delete -print | wc -l | xargs echo "Fichiers supprimés:"

# Métriques
echo ""
echo "=== Résumé ==="
ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null | tail -10
echo ""
echo "Total: $(ls -1 $BACKUP_DIR/*.gz 2>/dev/null | wc -l) fichiers"
echo "Espace utilisé: $(du -sh $BACKUP_DIR | cut -f1)"
