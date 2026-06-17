#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Déploiement rapide Zenith Pharma - sans rebuild Docker
.DESCRIPTION
    Copie les fichiers et redémarre les services sans utiliser --no-cache.
    Tags automatiquement les images 'latest' → 'previous' pour rollback rapide.
    Usage: .\deploy.ps1 [-Target all|frontend|backend|backend-full] [-BackupDB]
#>

param(
    [Parameter()]
    [ValidateSet("frontend", "backend", "backend-full", "all")]
    [string]$Target = "all",
    [switch]$BackupDB
)

$ErrorActionPreference = "Stop"

function Backup-Database {
    param([string]$Reason = "pre-deploy")
    Write-Host "💾 Backup DB avant déploiement ($Reason)..." -ForegroundColor Yellow
    $scriptPath = Split-Path -Parent $PSCommandPath
    $backupScript = Join-Path $scriptPath "backup-db.ps1"
    if (Test-Path $backupScript) {
        & $backupScript
    } else {
        Write-Host "   ⚠️ backup-db.ps1 introuvable, skip" -ForegroundColor Yellow
    }
}

function Tag-Image {
    param([string]$ContainerName, [string]$ImageName)
    $currentImage = docker inspect --format='{{.Image}}' $ContainerName 2>$null
    if ($currentImage) {
        docker tag $currentImage "${ImageName}:previous" 2>$null | Out-Null
        Write-Host "   � Image taggee: ${ImageName}:previous" -ForegroundColor Gray
    }
}

function Deploy-Frontend {
    Write-Host "� Déploiement Frontend..." -ForegroundColor Green

    # Tag image actuelle comme previous
    Tag-Image "fullstack_produits-frontend-1" "fullstack_produits-frontend"

    $scriptPath = Split-Path -Parent $PSCommandPath
    Push-Location (Join-Path $scriptPath "frontend/frontend")
    try {
        Write-Host "  Building..." -ForegroundColor Yellow
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ❌ Build échoué!" -ForegroundColor Red
            throw "Build frontend échoué avec le code $LASTEXITCODE"
        }
        Write-Host "  ✅ Build réussi" -ForegroundColor Green

        Write-Host "  Copie vers conteneur..." -ForegroundColor Yellow
        docker cp dist/. fullstack_produits-frontend-1:/usr/share/nginx/html/

        Write-Host "  Reload nginx..." -ForegroundColor Yellow
        docker exec fullstack_produits-frontend-1 nginx -s reload

        Write-Host "  ✅ Frontend déployé!" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

function Deploy-Backend {
    param([switch]$IncludeModels)

    Write-Host "🚀 Déploiement Backend..." -ForegroundColor Green

    # Tag image actuelle comme previous
    Tag-Image "fullstack_produits-backend-1" "fullstack_produits-backend"

    if ($IncludeModels) {
        Write-Host "  Copie des modèles..." -ForegroundColor Yellow
        docker cp backend/api/models/__init__.py fullstack_produits-backend-1:/app/api/models/__init__.py
        docker cp backend/api/models/products.py fullstack_produits-backend-1:/app/api/models/products.py
    }

    Write-Host "  Copie des fichiers..." -ForegroundColor Yellow
    docker cp backend/api/serializers/. fullstack_produits-backend-1:/app/api/serializers/
    docker cp backend/api/urls.py fullstack_produits-backend-1:/app/api/urls.py
    docker cp backend/api/views/substances.py fullstack_produits-backend-1:/app/api/views/substances.py
    docker cp backend/api/views/meds_reference.py fullstack_produits-backend-1:/app/api/views/meds_reference.py
    docker cp backend/api/views/produits.py fullstack_produits-backend-1:/app/api/views/produits.py
    docker cp backend/api/views/dci_admin.py fullstack_produits-backend-1:/app/api/views/dci_admin.py
    docker cp backend/api/views/finance_stats.py fullstack_produits-backend-1:/app/api/views/finance_stats.py
    docker cp backend/api/services/finance_base_queries.py fullstack_produits-backend-1:/app/api/services/finance_base_queries.py
    docker cp backend/api/services/finance_predictions.py fullstack_produits-backend-1:/app/api/services/finance_predictions.py
    docker cp backend/api/services/finance_marges.py fullstack_produits-backend-1:/app/api/services/finance_marges.py
    docker cp backend/api/services/finance_formatters.py fullstack_produits-backend-1:/app/api/services/finance_formatters.py
    docker cp backend/api/idempotency.py fullstack_produits-backend-1:/app/api/idempotency.py
    docker cp backend/api/views/commandes/commandes.py fullstack_produits-backend-1:/app/api/views/commandes/commandes.py
    docker cp backend/api/views/ventes/factures.py fullstack_produits-backend-1:/app/api/views/ventes/factures.py

    if ($IncludeModels) {
        Write-Host "  Migration..." -ForegroundColor Yellow
        docker exec fullstack_produits-backend-1 python manage.py makemigrations 2>&1 | Select-String -Pattern "No changes|Migration" | ForEach-Object { Write-Host "  $_" }
        docker exec fullstack_produits-backend-1 python manage.py migrate 2>&1 | Select-String -Pattern "Applying|OK" | ForEach-Object { Write-Host "  $_" }

        Write-Host "  Setup DCI / Substances..." -ForegroundColor Yellow
        docker cp backend/api/management/commands/setup_dci_prod.py fullstack_produits-backend-1:/app/api/management/commands/setup_dci_prod.py
        docker exec fullstack_produits-backend-1 python manage.py setup_dci_prod 2>&1 | ForEach-Object { Write-Host "  $_" }
    }

    Write-Host "  Redémarrage..." -ForegroundColor Yellow
    docker restart fullstack_produits-backend-1 | Out-Null

    Write-Host "  ✅ Backend déployé!" -ForegroundColor Green
}

# Main
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Zenith Pharma - Déploiement Rapide" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan

if ($BackupDB) {
    Backup-Database
}

switch ($Target) {
    "frontend" { Deploy-Frontend }
    "backend" { Deploy-Backend }
    "backend-full" { Deploy-Backend -IncludeModels }
    "all" {
        Deploy-Frontend
        Deploy-Backend -IncludeModels
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✅ Déploiement terminé!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor White
Write-Host "  Backup DB manuel:  .\backup-db.ps1" -ForegroundColor Gray
Write-Host "  Rollback rapide:   .\rollback.ps1" -ForegroundColor Gray
Write-Host "  Rollback + DB:     .\rollback.ps1 -IncludeDB" -ForegroundColor Gray
Write-Host ""
