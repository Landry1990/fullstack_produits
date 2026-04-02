# ═══════════════════════════════════════════════════════
# Script de démarrage résilient — Pharmacie Fullstack
# ═══════════════════════════════════════════════════════
# - Vérifie l'intégrité du système avant le démarrage
# - Lance le backend avec un watchdog (redémarrage auto)
# - Lance le frontend
# ═══════════════════════════════════════════════════════

$ErrorActionPreference = "Continue"

$backendDir = "C:\Projet Fullstack\fullstack_produits\backend"
$frontendDir = "C:\Projet Fullstack\fullstack_produits\frontend\frontend"
$venvActivate = "$backendDir\my_env01\Scripts\Activate.ps1"

# ── Couleurs ──
function Write-Step($msg) { Write-Host "`n[$((Get-Date).ToString('HH:mm:ss'))] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  ✗ $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "   DÉMARRAGE PHARMACIE — Mode Résilient" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta

# ── 1. Vérification d'intégrité ──
Write-Step "Vérification d'intégrité du système..."
Start-Process pwsh -ArgumentList "-NoProfile", "-Command", @"
    Set-Location '$backendDir'
    & '$venvActivate'
    python manage.py check_integrity --fix
    if (`$LASTEXITCODE -ne 0) {
        Write-Host '  ✗ Intégrité compromise — veuillez corriger les erreurs' -ForegroundColor Red
    }
    Start-Sleep -Seconds 3
"@ -Wait -NoNewWindow

Write-Ok "Vérification terminée"

# ── 2. Vérification de backup récent ──
Write-Step "Vérification des sauvegardes récentes..."
$backupDir = Join-Path $backendDir "backups"
$recentBackup = $false

if (Test-Path $backupDir) {
    $latestBackup = Get-ChildItem -Path $backupDir -Filter "backup_*.sql.gz" | 
                    Sort-Object LastWriteTime -Descending | 
                    Select-Object -First 1
    
    if ($latestBackup) {
        $ageHours = ((Get-Date) - $latestBackup.LastWriteTime).TotalHours
        if ($ageHours -lt 24) {
            Write-Ok "Dernière sauvegarde : $($latestBackup.Name) (il y a $([math]::Round($ageHours, 1))h)"
            $recentBackup = $true
        } else {
            Write-Warn "Dernière sauvegarde date de $([math]::Round($ageHours, 0))h — Sauvegarde rapide en cours..."
        }
    } else {
        Write-Warn "Aucune sauvegarde trouvée — Sauvegarde en cours..."
    }
}

if (-not $recentBackup) {
    Start-Process pwsh -ArgumentList "-NoProfile", "-Command", @"
        Set-Location '$backendDir'
        & '$venvActivate'
        python manage.py backup_database
"@ -Wait -NoNewWindow
    Write-Ok "Sauvegarde pré-démarrage effectuée"
}

# ── 3. Démarrage Backend avec Watchdog ──
Write-Step "Démarrage du backend (avec surveillance automatique)..."

$watchdogScript = @"
`$maxRestarts = 5
`$restartCount = 0
`$restartWindow = 300  # Réinitialiser le compteur après 5 min de stabilité

Set-Location '$backendDir'
& '$venvActivate'

while (`$restartCount -lt `$maxRestarts) {
    `$startTime = Get-Date
    Write-Host "[`$(Get-Date -Format 'HH:mm:ss')] Démarrage du serveur Django... (tentative `$(`$restartCount + 1))" -ForegroundColor Green

    python manage.py runserver 0.0.0.0:8000
    `$exitCode = `$LASTEXITCODE

    # Si arrêt propre (Ctrl+C), ne pas redémarrer
    if (`$exitCode -eq 0) {
        Write-Host "[`$(Get-Date -Format 'HH:mm:ss')] Serveur arrêté proprement." -ForegroundColor Yellow
        break
    }

    # Si le serveur a tourné > 5 min, réinitialiser le compteur (c'est stable)
    `$runtime = ((Get-Date) - `$startTime).TotalSeconds
    if (`$runtime -gt `$restartWindow) {
        `$restartCount = 0
    }

    `$restartCount++
    Write-Host "[`$(Get-Date -Format 'HH:mm:ss')] CRASH détecté (code: `$exitCode) — Redémarrage dans 5s... (`$restartCount/`$maxRestarts)" -ForegroundColor Red
    Start-Sleep -Seconds 5
}

if (`$restartCount -ge `$maxRestarts) {
    Write-Host "" -ForegroundColor Red
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "  ALERTE: Le serveur a crashé `$maxRestarts fois de suite !" -ForegroundColor Red
    Write-Host "  Vérifiez les logs dans : $backendDir\logs\" -ForegroundColor Red
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour fermer"
}
"@

Start-Process pwsh -ArgumentList "-NoExit", "-Command", $watchdogScript

# ── 4. Démarrage Frontend ──
Write-Step "Démarrage du frontend..."
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendDir'; npm run dev"

# ── Résumé ──
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✓ Backend lancé avec surveillance automatique" -ForegroundColor Green
Write-Host "  ✓ Frontend lancé" -ForegroundColor Green
Write-Host "  ✓ Health check : http://localhost:8000/api/health/" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
