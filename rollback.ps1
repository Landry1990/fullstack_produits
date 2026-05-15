#Requires -Version 5.1
<#
.SYNOPSIS
    Rollback Docker vers la version precedente (images + DB optionnel)
.DESCRIPTION
    Restaure les images Docker taggees 'previous' et optionnellement la DB.
    Usage: .\rollback.ps1 [-IncludeDB]
#>
param(
    [switch]$IncludeDB,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         ROLLBACK DOCKER PRODUCTION           ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Verifier que les images previous existent
$backendPrevious = docker images --format "{{.Repository}}:{{.Tag}}" | Select-String "fullstack_produits-backend:previous"
$frontendPrevious = docker images --format "{{.Repository}}:{{.Tag}}" | Select-String "fullstack_produits-frontend:previous"

if (-not $backendPrevious -and -not $frontendPrevious) {
    Write-Host "❌ Aucune image 'previous' trouvee. Impossible de rollback." -ForegroundColor Red
    Write-Host "   Astuce: les images sont taggees 'previous' lors du deploy.ps1" -ForegroundColor Yellow
    exit 1
}

# Confirmation
if (-not $Force) {
    Write-Host "Cette action va:"
    if ($backendPrevious) { Write-Host "  • Restaurer BACKEND  → image 'previous'" -ForegroundColor White }
    if ($frontendPrevious) { Write-Host "  • Restaurer FRONTEND → image 'previous'" -ForegroundColor White }
    if ($IncludeDB) {
        $lastBackup = Get-ChildItem "backups\*.sql" -ErrorAction SilentlyIgnore | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($lastBackup) {
            Write-Host "  • Restaurer DATABASE → $($lastBackup.Name)" -ForegroundColor White
        } else {
            Write-Host "  • ⚠️ Aucun backup DB trouve dans .\backups\" -ForegroundColor Yellow
        }
    }
    Write-Host ""

    $confirm = Read-Host "Confirmer le rollback ? [O/n]"
    if ($confirm -and $confirm -notmatch '^[Oo]$') {
        Write-Host "Rollback annule." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "Mode force (pas de confirmation)" -ForegroundColor Gray
}

# 1. Stop containers
Write-Host ""
Write-Host "🛑 Arret des conteneurs..." -ForegroundColor Yellow
docker-compose -f docker-compose.prod.yml stop backend frontend 2>$null | Out-Null

# 2. Rollback Backend
if ($backendPrevious) {
    Write-Host "🔙 Rollback BACKEND..." -ForegroundColor Yellow
    docker tag fullstack_produits-backend:previous fullstack_produits-backend:latest
    docker-compose -f docker-compose.prod.yml up -d --no-deps --force-recreate backend | Out-Null
    Write-Host "   ✅ Backend restaure" -ForegroundColor Green
}

# 3. Rollback Frontend
if ($frontendPrevious) {
    Write-Host "🔙 Rollback FRONTEND..." -ForegroundColor Yellow
    docker tag fullstack_produits-frontend:previous fullstack_produits-frontend:latest
    docker-compose -f docker-compose.prod.yml up -d --no-deps --force-recreate frontend | Out-Null
    Write-Host "   ✅ Frontend restaure" -ForegroundColor Green
}

# 4. Rollback Database (optionnel)
if ($IncludeDB -and $lastBackup) {
    Write-Host ""
    Write-Host "🗄️  Restauration DATABASE..." -ForegroundColor Yellow
    Write-Host "   Backup: $($lastBackup.FullName)" -ForegroundColor White

    # Arreter le backend pendant le restore
    docker-compose -f docker-compose.prod.yml stop backend 2>$null | Out-Null

    # Restore
    docker exec -i fullstack_produits-db-1 psql -U ${env:DB_USER:-fullstack_user} -d ${env:DB_NAME:-fullstack_db} -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>$null | Out-Null
    Get-Content $lastBackup.FullName | docker exec -i fullstack_produits-db-1 psql -U ${env:DB_USER:-fullstack_user} -d ${env:DB_NAME:-fullstack_db} 2>$null | Out-Null

    Write-Host "   ✅ Database restauree" -ForegroundColor Green

    # Redemarrer backend
    docker-compose -f docker-compose.prod.yml up -d backend | Out-Null
}

# 5. Healthcheck
Write-Host ""
Write-Host "🔍 Verification..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

$backendHealth = docker inspect --format='{{.State.Status}}' fullstack_produits-backend-1 2>$null
$frontendHealth = docker inspect --format='{{.State.Status}}' fullstack_produits-frontend-1 2>$null

if ($backendHealth -eq "running") {
    Write-Host "   ✅ Backend: running" -ForegroundColor Green
} else {
    Write-Host "   ❌ Backend: $backendHealth" -ForegroundColor Red
}

if ($frontendHealth -eq "running") {
    Write-Host "   ✅ Frontend: running" -ForegroundColor Green
} else {
    Write-Host "   ❌ Frontend: $frontendHealth" -ForegroundColor Red
}

Write-Host ""
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Rollback termine !" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor White
Write-Host "  docker logs fullstack_produits-backend-1 --tail 20" -ForegroundColor Gray
Write-Host "  docker logs fullstack_produits-frontend-1 --tail 20" -ForegroundColor Gray
Write-Host ""
