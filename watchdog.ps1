#Requires -Version 5.1
<#
.SYNOPSIS
    Watchdog Docker - Surveillance auto + rollback si crash
.DESCRIPTION
    Surveille les conteneurs backend/frontend toutes les 30s.
    Si un conteneur devient unhealthy ou exited → backup DB + rollback auto.
    Usage: .\watchdog.ps1 [-Interval 30] [-LogPath "logs/watchdog.log"]
#>
param(
    [int]$Interval = 30,
    [string]$LogPath = "logs/watchdog.log",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Creer le dossier logs
$logDir = Split-Path -Parent $LogPath
if ($logDir -and -not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] [$Level] $Message"
    Write-Host $line
    Add-Content -Path $LogPath -Value $line -ErrorAction SilentlyContinue
}

function Get-ContainerHealth {
    param([string]$Name)
    $status = docker inspect --format='{{.State.Status}}' $Name 2>$null
    $health = docker inspect --format='{{.State.Health.Status}}' $Name 2>$null
    return @{ Status = $status; Health = $health }
}

function Invoke-Rollback {
    Write-Log "🚨 DECLENCHEMENT ROLLBACK AUTOMATIQUE" "ALERT"

    $rollbackScript = Join-Path $PSScriptRoot "rollback.ps1"
    if (-not (Test-Path $rollbackScript)) {
        Write-Log "❌ rollback.ps1 introuvable !" "ERROR"
        return $false
    }

    try {
        if ($DryRun) {
            Write-Log "[DRY-RUN] Rollback simule - pas d'action reelle" "WARN"
            return $true
        }

        # Backup DB avant rollback si possible
        $backupScript = Join-Path $PSScriptRoot "backup-db.ps1"
        if (Test-Path $backupScript) {
            Write-Log "💾 Backup DB pre-rollback..." "INFO"
            & $backupScript 2>&1 | ForEach-Object { Write-Log "  $_" "INFO" }
        }

        # Rollback force sans confirmation
        & $rollbackScript -Force 2>&1 | ForEach-Object { Write-Log "  $_" "INFO" }

        Write-Log "✅ Rollback auto termine" "INFO"
        return $true
    } catch {
        Write-Log "❌ Erreur rollback: $_" "ERROR"
        return $false
    }
}

# === MAIN LOOP ===
Write-Log ""
Write-Log "╔═══════════════════════════════════════════════════╗"
Write-Log "║         WATCHDOG DOCKER - DEMARRAGE               ║"
Write-Log "╚═══════════════════════════════════════════════════╝"
Write-Log "Intervalle: ${Interval}s"
Write-Log "DryRun: $DryRun"
Write-Log "Logs: $LogPath"
Write-Log ""

$consecutiveFailures = 0
$maxFailuresBeforeRollback = 2

while ($true) {
    Start-Sleep -Seconds $Interval

    $backend = Get-ContainerHealth "fullstack_produits-backend-1"
    $frontend = Get-ContainerHealth "fullstack_produits-frontend-1"

    $backendOk = ($backend.Status -eq "running") -and ($backend.Health -in @("healthy", ""))
    $frontendOk = ($frontend.Status -eq "running") -and ($frontend.Health -in @("healthy", ""))

    if (-not $backendOk) {
        Write-Log "⚠️ Backend UNHEALTHY (Status=$($backend.Status), Health=$($backend.Health))" "WARN"
        $consecutiveFailures++
    } elseif (-not $frontendOk) {
        Write-Log "⚠️ Frontend UNHEALTHY (Status=$($frontend.Status), Health=$($frontend.Health))" "WARN"
        $consecutiveFailures++
    } else {
        if ($consecutiveFailures -gt 0) {
            Write-Log "✅ Tous les conteneurs sont de nouveau healthy" "INFO"
            $consecutiveFailures = 0
        }
        continue
    }

    Write-Log "Consecutive failures: $consecutiveFailures / $maxFailuresBeforeRollback" "WARN"

    if ($consecutiveFailures -ge $maxFailuresBeforeRollback) {
        Invoke-Rollback
        $consecutiveFailures = 0

        # Attendre un peu apres rollback pour eviter boucle infinie
        Write-Log "Attente 60s apres rollback..." "INFO"
        Start-Sleep -Seconds 60
    }
}
