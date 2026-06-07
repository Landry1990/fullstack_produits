# safe-rebuild.ps1
# Rebuild Docker Compose avec backup automatique de la DB avant rebuild
# Usage: .\safe-rebuild.ps1

$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = "backups/backup-${timestamp}.sql"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SAFE REBUILD - Backup + Build + Up" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier que la DB est accessible
Write-Host "[1/4] Verification de la base de donnees..." -ForegroundColor Yellow
$container = docker ps -q -f name=fullstack_produits-db-1
if (-not $container) {
    Write-Host "   ❌ Conteneur DB non trouve. Demarrage..." -ForegroundColor Red
    docker compose up -d db
    Start-Sleep -Seconds 5
} else {
    Write-Host "   ✅ Conteneur DB actif" -ForegroundColor Green
}

# 2. Backup automatique
Write-Host "[2/4] Backup automatique de la base..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "backups" -Force | Out-Null
try {
    docker exec fullstack_produits-db-1 pg_dump -U fullstack_user -d fullstack_db --no-owner --no-privileges > $backupFile 2>$null
    $size = "{0:N1}" -f ((Get-Item $backupFile).Length / 1MB)
    $md5 = (Get-FileHash $backupFile -Algorithm MD5).Hash.ToLower()
    "$md5  $(Split-Path $backupFile -Leaf)" | Out-File -Encoding ascii "${backupFile}.md5"
    Write-Host "   ✅ Backup OK: $backupFile ($size MB)" -ForegroundColor Green
    Write-Host "   MD5: $md5" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Backup echoue. Arret du rebuild pour securite." -ForegroundColor Red
    Write-Host "   Erreur: $_" -ForegroundColor Red
    exit 1
}

# 3. Rebuild + Up
Write-Host "[3/4] Rebuild des conteneurs..." -ForegroundColor Yellow
docker compose up -d --build

# 4. Verification
Write-Host "[4/4] Verification..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
$backend = docker ps -q -f name=fullstack_produits-backend-1
$frontend = docker ps -q -f name=fullstack_produits-frontend-1
$db = docker ps -q -f name=fullstack_produits-db-1

Write-Host ""
if ($backend -and $frontend -and $db) {
    Write-Host "✅ Tous les services sont UP" -ForegroundColor Green
    Write-Host "   Backend : http://localhost:8000" -ForegroundColor Gray
    Write-Host "   Frontend: http://localhost" -ForegroundColor Gray
} else {
    Write-Host "⚠️ Certains services ne sont pas demarres" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Backup sauvegarde dans: $backupFile" -ForegroundColor Cyan
Write-Host "Commande pour restaurer:" -ForegroundColor Gray
Write-Host "   Get-Content $backupFile | docker exec -i fullstack_produits-db-1 psql -U fullstack_user -d fullstack_db" -ForegroundColor Gray
