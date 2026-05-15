#Requires -Version 5.1
<#
.SYNOPSIS
    Backup PostgreSQL depuis le conteneur Docker
.DESCRIPTION
    Cree un dump SQL dans le dossier .\backups\ avec timestamp.
    Usage: .\backup-db.ps1 [-RetentionDays 7]
#>
param(
    [int]$RetentionDays = 7
)

$ErrorActionPreference = "Stop"

# Creer le dossier backups
$backupDir = Join-Path $PSScriptRoot "backups"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $backupDir "backup-${timestamp}.sql"
$envFile = Join-Path $PSScriptRoot ".env"

# Charger .env s'il existe
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "fullstack_user" }
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "fullstack_db" }

Write-Host "💾 Backup de la base de donnees..." -ForegroundColor Cyan
Write-Host "   Conteneur: fullstack_produits-db-1" -ForegroundColor Gray
Write-Host "   DB: $DB_NAME" -ForegroundColor Gray
Write-Host "   Fichier: $backupFile" -ForegroundColor Gray

try {
    docker exec fullstack_produits-db-1 pg_dump -U $DB_USER -d $DB_NAME --no-owner --no-privileges > $backupFile

    if ($LASTEXITCODE -eq 0 -and (Test-Path $backupFile) -and (Get-Item $backupFile).Length -gt 0) {
        $size = [math]::Round((Get-Item $backupFile).Length / 1MB, 2)
        Write-Host "   ✅ Backup OK (${size} MB)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Backup echoue (fichier vide ou erreur pg_dump)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ Erreur: $_" -ForegroundColor Red
    exit 1
}

# Nettoyer les vieux backups
Write-Host "🧹 Nettoyage des backups plus anciens que ${RetentionDays} jours..." -ForegroundColor Yellow
$oldBackups = Get-ChildItem $backupDir -Filter "backup-*.sql" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) }
$count = 0
foreach ($b in $oldBackups) {
    Remove-Item $b.FullName -Force
    $count++
}
Write-Host "   $count fichier(s) supprime(s)" -ForegroundColor Green

Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor White
Write-Host "  Lister:  Get-ChildItem backups\ -Name" -ForegroundColor Gray
Write-Host "  Restore: docker exec -i fullstack_produits-db-1 psql -U $DB_USER -d $DB_NAME < backups\backup-XXXXXX.sql" -ForegroundColor Gray
