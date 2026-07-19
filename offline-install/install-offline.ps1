# ═══════════════════════════════════════════════════════════
#  Zenith Pharma — Installation hors-ligne (sur la pharmacie)
#  À exécuter sur la machine cible (sans Internet)
# ═══════════════════════════════════════════════════════════
#  Prérequis: Docker Desktop installé
#  Usage:  pwsh -File install-offline.ps1
# ═══════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "  Zenith Pharma — Installation hors-ligne" -ForegroundColor Cyan
Write-Host "  ══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier que Docker est installé
Write-Host "  [1/6] Verification de Docker..." -ForegroundColor Yellow
$dockerOk = $false
try {
    $null = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) { $dockerOk = $true }
} catch {}

if (-not $dockerOk) {
    Write-Host "  ERREUR: Docker n'est pas installe ou n'est pas demarre." -ForegroundColor Red
    Write-Host "  Installez Docker Desktop avant de continuer." -ForegroundColor Red
    Write-Host "  https://www.docker.com/products/docker-desktop/" -ForegroundColor Red
    exit 1
}

$null = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERREUR: Docker Desktop n'est pas demarre." -ForegroundColor Red
    Write-Host "  Lancez Docker Desktop puis relancez ce script." -ForegroundColor Red
    exit 1
}
Write-Host "    Docker OK" -ForegroundColor Green

# 2. Charger les images Docker
Write-Host "  [2/6] Chargement des images Docker..." -ForegroundColor Yellow
$imageDir = Join-Path $ScriptDir "docker-images"
if (-not (Test-Path $imageDir)) {
    Write-Host "  ERREUR: Dossier 'docker-images' introuvable." -ForegroundColor Red
    exit 1
}

$tarFiles = Get-ChildItem $imageDir -Filter "*.tar"
if ($tarFiles.Count -eq 0) {
    Write-Host "  ERREUR: Aucune image Docker trouvee dans 'docker-images'." -ForegroundColor Red
    exit 1
}

foreach ($tar in $tarFiles) {
    Write-Host "    Chargement: $($tar.Name)" -ForegroundColor Gray
    docker load -i $tar.FullName 2>&1 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
}
Write-Host "    $($tarFiles.Count) images chargees" -ForegroundColor Green

# 3. Préparer le fichier .env
Write-Host "  [3/6] Configuration (.env)..." -ForegroundColor Yellow
$envFile = Join-Path $ScriptDir ".env"
$envExample = Join-Path $ScriptDir "config\.env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "    Fichier .env cree depuis .env.example" -ForegroundColor Green
    } else {
        Write-Host "  ERREUR: Aucun fichier .env ou .env.example trouve." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "    Fichier .env existant conserve" -ForegroundColor Gray
}

# 4. Copier docker-compose.prod.yml et backup-db.sh
Write-Host "  [4/6] Copie des fichiers de configuration..." -ForegroundColor Yellow
$composeFile = Join-Path $ScriptDir "docker-compose.prod.yml"
if (-not (Test-Path $composeFile)) {
    Write-Host "  ERREUR: docker-compose.prod.yml introuvable." -ForegroundColor Red
    exit 1
}

# Copier backup-db.sh si present
$backupScript = Join-Path $ScriptDir "config\backup-db.sh"
if (Test-Path $backupScript) {
    Copy-Item $backupScript (Join-Path $ScriptDir "backup-db.sh") -Force
}

# Créer le dossier backups
New-Item -ItemType Directory -Path (Join-Path $ScriptDir "backups") -Force | Out-Null
Write-Host "    Configuration prete" -ForegroundColor Green

# 5. Créer le volume Docker pour PostgreSQL
Write-Host "  [5/6] Creation du volume PostgreSQL..." -ForegroundColor Yellow
$volumeName = "fullstack_postgres_data_protected"
docker volume inspect $volumeName 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    docker volume create $volumeName
    Write-Host "    Volume cree: $volumeName" -ForegroundColor Green
} else {
    Write-Host "    Volume existant conserve: $volumeName" -ForegroundColor Gray
}

# 6. Démarrer les conteneurs
Write-Host "  [6/6] Demarrage des conteneurs..." -ForegroundColor Yellow
Push-Location $ScriptDir
try {
    docker compose -f docker-compose.prod.yml --env-file .env up -d 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    
    Write-Host ""
    Write-Host "  Attente du demarrage (30s)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    # Vérifier le statut
    docker compose -f docker-compose.prod.yml ps --format json 2>$null | Out-Null
    Write-Host ""
    docker compose -f docker-compose.prod.yml ps
    Write-Host ""
    
    # Restaurer la DB si un dump existe
    $dbDump = Join-Path $ScriptDir "backups\initial-db.sql"
    if (Test-Path $dbDump) {
        $restore = Read-Host "  Restaurer la base de donnees depuis le dump? (O/n)"
        if ($restore -ne "n" -and $restore -ne "N") {
            Write-Host "  Restauration de la base..." -ForegroundColor Yellow
            $dbContainer = docker compose -f docker-compose.prod.yml ps -q db
            docker cp $dbDump "$dbContainer`:/tmp/init.sql"
            docker exec $dbContainer psql -U fullstack_user -d fullstack_db -f /tmp/init.sql 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
            docker exec $dbContainer rm /tmp/init.sql
            Write-Host "  Base restauree" -ForegroundColor Green
        }
    }
    
    Write-Host ""
    Write-Host "  ══════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  Installation terminee!" -ForegroundColor Green
    Write-Host "  ══════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Application accessible sur: http://localhost" -ForegroundColor Cyan
    Write-Host "  Portainer (gestion):       http://localhost:9443" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Comptes par defaut:" -ForegroundColor Yellow
    Write-Host "    Admin: admin / admin123" -ForegroundColor White
    Write-Host ""
    Write-Host "  Pour arreter:   docker compose -f docker-compose.prod.yml down" -ForegroundColor Gray
    Write-Host "  Pour demarrer:  docker compose -f docker-compose.prod.yml up -d" -ForegroundColor Gray
    Write-Host ""
} finally {
    Pop-Location
}
