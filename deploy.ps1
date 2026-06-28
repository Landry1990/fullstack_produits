
#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Déploiement rapide Zenith Pharma - sans rebuild Docker
.DESCRIPTION
    Frontend : npm run build -> docker cp dist/ -> nginx reload.
    Backend  : docker cp de TOUT le dossier api/ -> restart.
               Avec -IncludeModels (backend-full ou all) : migrations + setup_dci_prod.
    Avec -Rebuild : reconstruit les images Docker via docker compose build.
    Usage: .\deploy.ps1 [-Target all|frontend|backend|backend-full] [-BackupDB] [-Rebuild]
#>

param(
    [Parameter()]
    [ValidateSet("frontend", "backend", "backend-full", "all")]
    [string]$Target = "all",
    [switch]$BackupDB,
    [switch]$Rebuild
)

$ErrorActionPreference = "Stop"
$BACKEND_CONTAINER = "fullstack_produits-backend-1"
$FRONTEND_CONTAINER = "fullstack_produits-frontend-1"
$scriptPath = Split-Path -Parent $PSCommandPath

# ── Helpers ───────────────────────────────────────────────────────────────────

function Assert-ContainerRunning {
    param([string]$ContainerName)

    $state = docker inspect --format='{{.State.Status}}' $ContainerName 2>$null
    if (-not $state) {
        Write-Host "  ❌ Conteneur '$ContainerName' introuvable. Vérifie docker compose up." -ForegroundColor Red
        throw "Conteneur '$ContainerName' absent - déploiement annulé."
    }
    if ($state -ne 'running') {
        Write-Host "  ⚠️  Conteneur '$ContainerName' est '$state'. Tentative de démarrage..." -ForegroundColor Yellow
        docker start $ContainerName | Out-Null
        Start-Sleep -Seconds 3
        $state = docker inspect --format='{{.State.Status}}' $ContainerName 2>$null
        if ($state -ne 'running') {
            Write-Host "  ❌ Impossible de démarrer '$ContainerName'. Déploiement annulé." -ForegroundColor Red
            throw "Conteneur '$ContainerName' ne démarre pas."
        }
        Write-Host "  ✅ Conteneur démarré." -ForegroundColor Green
    } else {
        Write-Host "  ✅ $ContainerName : running" -ForegroundColor Green
    }
}

function Backup-Database {
    param([string]$Reason = "pre-deploy")
    Write-Host "💾 Backup DB ($Reason)..." -ForegroundColor Yellow
    $backupScript = Join-Path $scriptPath "backup-db.ps1"
    if (Test-Path $backupScript) { & $backupScript }
    else { Write-Host "   ⚠️  backup-db.ps1 introuvable, skip" -ForegroundColor Yellow }
}

function Set-ImageTag {
    param([string]$ContainerName, [string]$ImageName)
    $img = docker inspect --format='{{.Image}}' $ContainerName 2>$null
    if ($img) {
        docker tag $img "${ImageName}:previous" 2>$null | Out-Null
        Write-Host "    🏷  Tag: ${ImageName}:previous" -ForegroundColor Gray
    }
}

function Invoke-DockerRebuild {
    param([string]$RebuildTarget = "all")
    Write-Host "🔨 Rebuild Docker ($RebuildTarget)..." -ForegroundColor Yellow
    Push-Location $scriptPath
    try {
        switch ($RebuildTarget) {
            "frontend"     { docker compose build frontend; docker compose up -d frontend }
            { $_ -in "backend","backend-full" } {
                             docker compose build backend;  docker compose up -d backend  }
            "all"          { docker compose build;          docker compose up -d          }
        }
        Write-Host "✅ Rebuild terminé" -ForegroundColor Green
    } finally { Pop-Location }
}

# ── Frontend ──────────────────────────────────────────────────────────────────

function Deploy-Frontend {
    Write-Host ""
    Write-Host "🌐 Frontend — vérification conteneur..." -ForegroundColor Cyan
    Assert-ContainerRunning $FRONTEND_CONTAINER
    Set-ImageTag $FRONTEND_CONTAINER "fullstack_produits-frontend"

    Push-Location (Join-Path $scriptPath "frontend/frontend")
    try {
        Write-Host "  npm run build..." -ForegroundColor Yellow
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Build frontend échoué (code $LASTEXITCODE)" }
        Write-Host "  ✅ Build OK" -ForegroundColor Green

        Write-Host "  docker cp dist/ -> nginx..." -ForegroundColor Yellow
        docker cp dist/. "${FRONTEND_CONTAINER}:/usr/share/nginx/html/"
        docker exec $FRONTEND_CONTAINER nginx -s reload
        Write-Host "  ✅ Frontend déployé" -ForegroundColor Green
    } finally { Pop-Location }
}

# ── Backend ───────────────────────────────────────────────────────────────────

function Deploy-Backend {
    param([switch]$IncludeModels)

    Write-Host ""
    Write-Host "⚙️  Backend — vérification conteneur..." -ForegroundColor Cyan
    Assert-ContainerRunning $BACKEND_CONTAINER
    Set-ImageTag $BACKEND_CONTAINER "fullstack_produits-backend"

    Push-Location $scriptPath
    try {
        # Copie intégrale du dossier api/ (vues, modèles, serializers, services, management...)
        # Plus besoin de lister les fichiers un par un : tout est synchronisé d'un coup.
        Write-Host "  Copie backend/api/ -> conteneur /app/api/ ..." -ForegroundColor Yellow
        docker cp backend/api/. "${BACKEND_CONTAINER}:/app/api/"
        Write-Host "  ✅ Copie terminée" -ForegroundColor Green

        if ($IncludeModels) {
            Write-Host "  Migrations..." -ForegroundColor Yellow
            docker exec $BACKEND_CONTAINER python manage.py makemigrations 2>&1 |
                Select-String -Pattern "No changes|Migration|already" |
                ForEach-Object { Write-Host "    $_" }
            docker exec $BACKEND_CONTAINER python manage.py migrate 2>&1 |
                Select-String -Pattern "Applying|OK|No migrations" |
                ForEach-Object { Write-Host "    $_" }

            Write-Host "  Setup DCI / Substances..." -ForegroundColor Yellow
            docker exec $BACKEND_CONTAINER python manage.py setup_dci_prod 2>&1 |
                ForEach-Object { Write-Host "    $_" }
        }

        Write-Host "  Redémarrage conteneur..." -ForegroundColor Yellow
        docker restart $BACKEND_CONTAINER | Out-Null
        Write-Host "  ✅ Backend déployé" -ForegroundColor Green
    } finally { Pop-Location }
}

# ── Main ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Zenith Pharma — Déploiement  [$Target]" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan

if ($BackupDB) { Backup-Database }

if ($Rebuild) {
    Invoke-DockerRebuild -RebuildTarget $Target
} else {
    switch ($Target) {
        "frontend"     { Deploy-Frontend }
        "backend"      { Deploy-Backend }
        "backend-full" { Deploy-Backend -IncludeModels }
        "all"          { Deploy-Frontend; Deploy-Backend -IncludeModels }
    }
}

Write-Host ""
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✅ Déploiement terminé !" -ForegroundColor Green
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor White
Write-Host "  Backup DB :     .\backup-db.ps1" -ForegroundColor Gray
Write-Host "  Rollback :      .\rollback.ps1" -ForegroundColor Gray
Write-Host "  Rollback + DB : .\rollback.ps1 -IncludeDB" -ForegroundColor Gray
Write-Host ""
