#!/bin/bash
# Backup incrémental pour WSL (Windows Subsystem for Linux)
# Compatible avec Docker Desktop + WSL2

set -e

# Configuration pour WSL
# Le backup se fait dans le filesystem Windows via /mnt/c/
BACKUP_DIR="/mnt/c/backup/incremental"
FULL_BACKUP_DIR="/mnt/c/backup/full"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="pharma_db"
DB_USER="postgres"

# Détection auto du container PostgreSQL
# Sur WSL/Docker Desktop, le nom peut varier
CONTAINER=$(docker ps --format "{{.Names}}" | grep -i postgres | head -1)

if [ -z "$CONTAINER" ]; then
    echo "❌ Container PostgreSQL non trouvé!"
    echo "Containers actifs:"
    docker ps --format "  - {{.Names}}"
    exit 1
fi

echo "✓ Container PostgreSQL trouvé: $CONTAINER"

# Créer les dossiers (sur C: via /mnt/c/)
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

echo "=== Backup incrémental WSL $TIMESTAMP ==="
echo "Container: $CONTAINER"
echo "Backup dir: $BACKUP_DIR"
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

# Cleanup (48h)
echo ""
echo "=== Nettoyage (rétention 48h) ==="
find "$BACKUP_DIR" -name "*.sql.gz" -mmin +2880 -delete -print | wc -l | xargs echo "Fichiers supprimés:"

# Résumé
echo ""
echo "=== Résumé ==="
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -10
echo ""
echo "Total: $(ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l) fichiers"
echo "Espace utilisé: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"
echo ""
echo "📁 Backups accessibles sur Windows:"
echo "   C:\backup\incremental"
