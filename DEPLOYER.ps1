# Script PowerShell - Déploiement Production
# Lance tout automatiquement avec Docker

Write-Host "DEPLOIEMENT PRODUCTION" -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green
Write-Host ""

# Vérifier Docker
$dockerInstalled = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerInstalled) {
    Write-Host "❌ Docker n'est pas installé!" -ForegroundColor Red
    Write-Host "Installe Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
}

# Vérifier si Docker Desktop est en marche
try {
    docker info | Out-Null
} catch {
    Write-Host "❌ Docker Desktop n'est pas démarré!" -ForegroundColor Red
    Write-Host "Démarre Docker Desktop puis relance ce script."
    exit 1
}

Write-Host "Docker OK" -ForegroundColor Green
Write-Host ""

# Nettoyer les anciens conteneurs (optionnel)
$clean = Read-Host "Nettoyer les anciens conteneurs? (o/n) [n]"
if ($clean -eq 'o' -or $clean -eq 'O') {
    Write-Host "Nettoyage..." -ForegroundColor Yellow
    docker-compose -f docker-compose.deploy.yml down -v
    docker system prune -f
}

Write-Host ""
Write-Host "Etape 1/3: Build des images..." -ForegroundColor Yellow
Write-Host "⏳ Cela prend 5-10 minutes la première fois..." -ForegroundColor Gray

# Build
docker-compose -f docker-compose.deploy.yml build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Échec du build" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Etape 2/3: Demarrage des services..." -ForegroundColor Yellow

# Start
docker-compose -f docker-compose.deploy.yml up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Échec du démarrage" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Etape 3/3: Attente des services..." -ForegroundColor Yellow

# Attendre que tout soit prêt
$maxAttempts = 30
$attempt = 0
$backendReady = $false

while ($attempt -lt $maxAttempts -and -not $backendReady) {
    $attempt++
    Write-Host "  Tentative $attempt/$maxAttempts..." -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/api/" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $backendReady = $true
        }
    } catch {
        Start-Sleep -Seconds 2
    }
}

if (-not $backendReady) {
    Write-Host ""
    Write-Host "⚠️  Le backend met du temps à démarrer..." -ForegroundColor Yellow
    Write-Host "Continue quand même? (o/n) [o]" -ForegroundColor Yellow
    $continue = Read-Host
    if ($continue -eq 'n' -or $continue -eq 'N') {
        docker-compose -f docker-compose.deploy.yml down
        exit 1
    }
}

Write-Host ""
Write-Host "DEPLOIEMENT REUSSI!" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green
Write-Host ""
Write-Host "Applications disponibles:" -ForegroundColor Cyan
Write-Host "   🌐 Web Caisse: http://localhost" -ForegroundColor White
Write-Host "   🔌 API Backend: http://localhost:8000" -ForegroundColor White
Write-Host "   📊 WebSocket: ws://localhost:8000/ws/cashier/" -ForegroundColor White
Write-Host ""
Write-Host "Test rapide:" -ForegroundColor Cyan
Write-Host "   1. Ouvre http://localhost dans Chrome" -ForegroundColor White
Write-Host "   2. Connecte-toi" -ForegroundColor White
Write-Host "   3. Va dans Facturation" -ForegroundColor White
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Cyan
Write-Host "   Voir logs: docker-compose -f docker-compose.deploy.yml logs -f" -ForegroundColor Gray
Write-Host "   Arrêter: docker-compose -f docker-compose.deploy.yml down" -ForegroundColor Gray
Write-Host "   Redémarrer: docker-compose -f docker-compose.deploy.yml restart" -ForegroundColor Gray
Write-Host ""
Write-Host "C'est pret! Appuie sur une touche pour ouvrir Chrome..." -ForegroundColor Green
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Ouvrir Chrome
Start-Process "chrome.exe" "http://localhost"
