# Backup incrémental PowerShell - Toutes les 30 minutes
# Tables critiques pour pharmacie

$ErrorActionPreference = "Stop"

# Configuration
$BACKUP_DIR = "C:\backup\incremental"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$DB_NAME = "pharma_db"
$DB_USER = "postgres"
$CONTAINER = "fullstack_produits-postgres-1"
$RETENTION_HOURS = 48

# Créer le dossier
New-Item -ItemType Directory -Force -Path $BACKUP_DIR | Out-Null

# Tables à sauvegarder (par ordre de priorité)
$TABLES = @(
    # Ventes (CRITIQUE)
    "api_facture",
    "api_lignefacture",
    "api_sessionticket",
    
    # Stocks
    "api_mouvementstock",
    "api_inventaire",
    "api_ligneinventaire",
    
    # Comptabilité
    "api_ecriture",
    "api_operation",
    "api_journalcaisse",
    
    # Commandes fournisseurs
    "api_commande",
    "api_lignecommande",
    
    # Coupons monnaie
    "api_couponmonnaie",
    
    # Sessions caisse
    "api_sessioncaisse",
    
    # Clients
    "api_client",
    
    # Paiements
    "api_paiement"
)

Write-Host "=== Backup incrémental $TIMESTAMP ===" -ForegroundColor Cyan
Write-Host ""

# Fonction de backup
function Backup-Table {
    param([string]$Table)
    
    $output = Join-Path $BACKUP_DIR "${TIMESTAMP}_${Table}.sql"
    
    Write-Host "Backup $Table..." -NoNewline
    
    try {
        # Exporter la table
        $result = docker exec $CONTAINER pg_dump -U $DB_USER -d $DB_NAME `
            --data-only --inserts --no-owner --no-privileges --table="$Table" `
            2>$null
        
        if ($result) {
            $result | Out-File -Encoding UTF8 -FilePath $output
            
            # Compresser
            Compress-Archive -Path $output -DestinationPath "$output.zip" -Force 2>$null
            Remove-Item $output -Force 2>$null
            
            $size = (Get-Item "$output.zip").Length / 1KB
            Write-Host " OK ($([math]::Round($size,1)) KB)" -ForegroundColor Green
        } else {
            Write-Host " vide" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host " erreur: $_" -ForegroundColor Red
    }
}

# Backup de chaque table
foreach ($table in $TABLES) {
    Backup-Table -Table $table
}

# Cleanup
Write-Host ""
Write-Host "=== Nettoyage (rétention ${RETENTION_HOURS}h) ===" -ForegroundColor Yellow
$cutoffDate = (Get-Date).AddHours(-$RETENTION_HOURS)
Get-ChildItem $BACKUP_DIR -Filter "*.zip" | Where-Object { $_.CreationTime -lt $cutoffDate } | Remove-Item -Force

# Résumé
Write-Host ""
Write-Host "=== Résumé ===" -ForegroundColor Cyan
$files = Get-ChildItem $BACKUP_DIR -Filter "*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -First 10
$files | ForEach-Object { Write-Host "  $($_.Name) - $([math]::Round($_.Length/1KB,1)) KB" }

$count = (Get-ChildItem $BACKUP_DIR -Filter "*.zip").Count
$totalSize = (Get-ChildItem $BACKUP_DIR | Measure-Object -Property Length -Sum).Sum / 1MB

Write-Host ""
Write-Host "Total: $count fichiers, $([math]::Round($totalSize,2)) MB" -ForegroundColor Green
Write-Host "Backup stocké dans: $BACKUP_DIR"
