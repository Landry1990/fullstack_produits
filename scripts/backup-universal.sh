#!/bin/bash
# Script de backup universel - Fonctionne sur Linux natif ET WSL
# Détection automatique de l'environnement

set -e

# ═══════════════════════════════════════════════════════════
# DÉTECTION DE L'ENVIRONNEMENT
# ═══════════════════════════════════════════════════════════

IS_WSL=false
if [[ -f /proc/version ]] && [[ $(cat /proc/version) =~ Microsoft|WSL ]]; then
    IS_WSL=true
fi

# Configuration des chemins selon l'environnement
if [ "$IS_WSL" = true ]; then
    # WSL: Backup sur le disque Windows (C:)
    BACKUP_DIR="/mnt/c/backup/incremental"
    FULL_BACKUP_DIR="/mnt/c/backup/full"
    ENV_NAME="WSL"
else
    # Linux natif: Backup standard
    BACKUP_DIR="/backup/incremental"
    FULL_BACKUP_DIR="/backup/full"
    ENV_NAME="Linux"
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="pharma_db"
DB_USER="postgres"
RETENTION_HOURS=48

# ═══════════════════════════════════════════════════════════
# DÉTECTION DU CONTAINER DOCKER
# ═══════════════════════════════════════════════════════════

CONTAINER=$(docker ps --format "{{.Names}}" | grep -E "postgres|db" | head -1)

if [ -z "$CONTAINER" ]; then
    echo "❌ Container PostgreSQL non trouvé!"
    echo ""
    echo "Containers actifs:"
    docker ps --format "  - {{.Names}} ({{.Image}})" | head -10
    exit 1
fi

# ═══════════════════════════════════════════════════════════
# CRÉATION DES DOSSIERS
# ═══════════════════════════════════════════════════════════

mkdir -p "$BACKUP_DIR" "$FULL_BACKUP_DIR"

# ═══════════════════════════════════════════════════════════
# TABLES À SAUVEGARDER
# ═══════════════════════════════════════════════════════════

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

# ═══════════════════════════════════════════════════════════
# HEADER
# ═══════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════"
echo "  BACKUP INCRÉMENTAL - $ENV_NAME"
echo "═══════════════════════════════════════════════════════"
echo "Date:       $(date '+%d/%m/%Y %H:%M:%S')"
echo "Container:  $CONTAINER"
echo "Backup:     $BACKUP_DIR"
echo "Tables:     ${#TABLES[@]}"
echo "═══════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════
# FONCTION DE BACKUP
# ═══════════════════════════════════════════════════════════

backup_table() {
    local table=$1
    local output="$BACKUP_DIR/${TIMESTAMP}_${table}.sql"
    
    echo -n "  → $table ... "
    
    if docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" \
        --data-only --inserts --no-owner --no-privileges \
        --table="$table" > "$output" 2>/dev/null; then
        
        if [ -s "$output" ]; then
            gzip -f "$output"
            local size=$(du -h "${output}.gz" 2>/dev/null | cut -f1)
            echo "✓ ($size)"
        else
            rm -f "$output"
            echo "○ (vide)"
        fi
    else
        rm -f "$output"
        echo "✗ (erreur)"
    fi
}

# ═══════════════════════════════════════════════════════════
# EXÉCUTION DES BACKUPS
# ═══════════════════════════════════════════════════════════

echo "Sauvegarde des tables:"
for table in "${TABLES[@]}"; do
    backup_table "$table"
done

# ═══════════════════════════════════════════════════════════
# NETTOYAGE (48h)
# ═══════════════════════════════════════════════════════════

echo ""
echo "Nettoyage des vieux backups (>48h)..."
DELETED=$(find "$BACKUP_DIR" -name "*.sql.gz" -mmin +$((RETENTION_HOURS * 60)) -delete -print | wc -l)
echo "  $DELETED fichier(s) supprimé(s)"

# ═══════════════════════════════════════════════════════════
# RÉSUMÉ
# ═══════════════════════════════════════════════════════════

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  RÉSULTAT"
echo "═══════════════════════════════════════════════════════"

TOTAL_FILES=$(ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)

echo "Fichiers:   $TOTAL_FILES"
echo "Espace:     $TOTAL_SIZE"
echo "Derniers:"
ls -lt "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -3 | awk '{print "  " $9 " (" $5 ")"}'

echo ""
if [ "$IS_WSL" = true ]; then
    echo "📁 Accès Windows: C:\\backup\\incremental"
else
    echo "📁 Dossier: $BACKUP_DIR"
fi
echo "═══════════════════════════════════════════════════════"
