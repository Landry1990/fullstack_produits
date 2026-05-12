#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Déploiement rapide Zenith Pharma - sans rebuild Docker
.DESCRIPTION
    Copie les fichiers et redémarre les services sans utiliser --no-cache
#>

param(
    [Parameter()]
    [ValidateSet("frontend", "backend", "backend-full", "all")]
    [string]$Target = "all"
)

$ErrorActionPreference = "Stop"

function Deploy-Frontend {
    Write-Host "🚀 Déploiement Frontend..." -ForegroundColor Green
    
    $scriptPath = Split-Path -Parent $PSCommandPath
    Push-Location (Join-Path $scriptPath "frontend/frontend")
    try {
        Write-Host "  Building..." -ForegroundColor Yellow
        npm run build 2>&1 | Select-String -Pattern "error|built" | ForEach-Object { Write-Host "  $_" }
        
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
    
    if ($IncludeModels) {
        Write-Host "  Copie des modèles..." -ForegroundColor Yellow
        docker cp backend/api/models/__init__.py fullstack_produits-backend-1:/app/api/models/__init__.py
        docker cp backend/api/models/communication.py fullstack_produits-backend-1:/app/api/models/communication.py
    }
    
    Write-Host "  Copie des fichiers..." -ForegroundColor Yellow
    docker cp backend/api/serializers.py fullstack_produits-backend-1:/app/api/serializers.py
    docker cp backend/api/views/communication.py fullstack_produits-backend-1:/app/api/views/communication.py
    docker cp backend/api/urls.py fullstack_produits-backend-1:/app/api/urls.py
    docker cp backend/api/telegram_service.py fullstack_produits-backend-1:/app/api/telegram_service.py
    
    if ($IncludeModels) {
        Write-Host "  Migration..." -ForegroundColor Yellow
        docker exec fullstack_produits-backend-1 python manage.py makemigrations 2>&1 | Select-String -Pattern "No changes|Migration" | ForEach-Object { Write-Host "  $_" }
        docker exec fullstack_produits-backend-1 python manage.py migrate 2>&1 | Select-String -Pattern "Applying|OK" | ForEach-Object { Write-Host "  $_" }
    }
    
    Write-Host "  Redémarrage..." -ForegroundColor Yellow
    docker restart fullstack_produits-backend-1 | Out-Null
    
    Write-Host "  ✅ Backend déployé!" -ForegroundColor Green
}

# Main
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Zenith Pharma - Déploiement Rapide" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan

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
Write-Host "✅ Déploiement terminé!" -ForegroundColor Green
