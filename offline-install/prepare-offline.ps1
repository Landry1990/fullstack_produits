# ═══════════════════════════════════════════════════════════
#  Zenith Pharma — Préparation du paquet d'installation hors-ligne
#  À exécuter sur la machine de développement (avec Internet)
# ═══════════════════════════════════════════════════════════
#  Usage:  pwsh -File offline-install\prepare-offline.ps1
# ═══════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$OutputDir = Join-Path $ProjectRoot "offline-install\zenith-offline-package"

Write-Host ""
Write-Host "  Zenith Pharma — Préparation du paquet hors-ligne" -ForegroundColor Cyan
Write-Host "  ══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# 1. Créer le dossier de sortie
if (Test-Path $OutputDir) {
    Remove-Item $OutputDir -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
New-Item -ItemType Directory -Path "$OutputDir\docker-images" -Force | Out-Null
New-Item -ItemType Directory -Path "$OutputDir\config" -Force | Out-Null
New-Item -ItemType Directory -Path "$OutputDir\backups" -Force | Out-Null

Write-Host "  [1/5] Export des images Docker..." -ForegroundColor Yellow

# Lister les images utilisées par docker-compose
$Images = @(
    "fullstack_produits-backend",
    "fullstack_produits-frontend",
    "postgres:15-alpine",
    "redis:7-alpine",
    "portainer/portainer-ce:latest",
    "tailscale/tailscale:latest"
)

$ExportedImages = @()
foreach ($img in $Images) {
    # Vérifier si l'image existe localement
    $exists = docker image inspect $img 2>$null
    if ($LASTEXITCODE -eq 0) {
        $safeName = $img -replace '[/:]', '_'
        $tarPath = "$OutputDir\docker-images\$safeName.tar"
        Write-Host "    Export: $img -> $safeName.tar" -ForegroundColor Gray
        docker save -o $tarPath $img
        if ($LASTEXITCODE -ne 0) {
            Write-Host "    ATTENTION: Impossible d'exporter $img (image absente?)" -ForegroundColor DarkYellow
        } else {
            $ExportedImages += $img
        }
    } else {
        Write-Host "    SKIP: $img (image non trouvee localement)" -ForegroundColor DarkYellow
    }
}

Write-Host ""
Write-Host "  [2/5] Copie des fichiers de configuration..." -ForegroundColor Yellow

# Copier docker-compose.prod.yml
Copy-Item "$ProjectRoot\docker-compose.prod.yml" "$OutputDir\docker-compose.prod.yml"

# Copier .env.example
Copy-Item "$ProjectRoot\.env.example" "$OutputDir\config\.env.example"

# Copier backup-db.sh
if (Test-Path "$ProjectRoot\backup-db.sh") {
    Copy-Item "$ProjectRoot\backup-db.sh" "$OutputDir\config\backup-db.sh"
}

# Copier les Dockerfiles (au cas où un rebuild est nécessaire)
New-Item -ItemType Directory -Path "$OutputDir\backend" -Force | Out-Null
Copy-Item "$ProjectRoot\backend\Dockerfile" "$OutputDir\backend\Dockerfile"
Copy-Item "$ProjectRoot\backend\requirements.txt" "$OutputDir\backend\requirements.txt"
if (Test-Path "$ProjectRoot\backend\entrypoint.sh") {
    Copy-Item "$ProjectRoot\backend\entrypoint.sh" "$OutputDir\backend\entrypoint.sh"
}

New-Item -ItemType Directory -Path "$OutputDir\frontend" -Force | Out-Null
Copy-Item "$ProjectRoot\frontend\frontend\Dockerfile.prod" "$OutputDir\frontend\Dockerfile.prod"

Write-Host "  [3/5] Export de la base de donnees (optionnel)..." -ForegroundColor Yellow

# Proposer d'exporter la DB
$exportDb = Read-Host "  Exporter la base de donnees actuelle? (o/N)"
if ($exportDb -eq "o" -or $exportDb -eq "O" -or $exportDb -eq "y" -or $exportDb -eq "Y") {
    $dbContainer = "fullstack_produits-db-1"
    $dbExists = docker inspect $dbContainer 2>$null
    if ($LASTEXITCODE -eq 0) {
        $dumpPath = "$OutputDir\backups\initial-db.sql"
        Write-Host "    Dump de la base..." -ForegroundColor Gray
        docker exec $dbContainer pg_dump -U fullstack_user -d fullstack_db --no-owner --no-acl -f /tmp/init.sql
        docker cp "$dbContainer`:/tmp/init.sql" $dumpPath
        docker exec $dbContainer rm /tmp/init.sql
        Write-Host "    Base exportee: backups\initial-db.sql" -ForegroundColor Green
    } else {
        Write-Host "    Conteneur DB non trouve, skip" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "    Skip (base vierge a l'installation)" -ForegroundColor Gray
}

Write-Host "  [4/5] Copie du script d'installation..." -ForegroundColor Yellow

# Copier le script d'installation
Copy-Item "$PSScriptRoot\install-offline.ps1" "$OutputDir\install-offline.ps1"
Copy-Item "$PSScriptRoot\README-offline.txt" "$OutputDir\README.txt"

Write-Host "  [5/5] Calcul de la taille..." -ForegroundColor Yellow

$totalSize = (Get-ChildItem $OutputDir -Recurse | Measure-Object -Property Length -Sum).Sum
$sizeMB = [math]::Round($totalSize / 1MB, 1)
$sizeGB = [math]::Round($totalSize / 1GB, 2)

if ($sizeGB -ge 1) {
    Write-Host "    Taille totale: $sizeGB GB" -ForegroundColor Green
} else {
    Write-Host "    Taille totale: $sizeMB MB" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Paquet pret: $OutputDir" -ForegroundColor Green
Write-Host ""
Write-Host "  Prochaines etapes:" -ForegroundColor Cyan
Write-Host "    1. Copier le dossier 'zenith-offline-package' sur une cle USB" -ForegroundColor White
Write-Host "    2. Sur la pharmacie: installer Docker Desktop" -ForegroundColor White
Write-Host "    3. Lancer: pwsh -File install-offline.ps1" -ForegroundColor White
Write-Host ""
