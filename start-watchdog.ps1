#Requires -Version 5.1
<#
.SYNOPSIS
    Lance le watchdog Docker en arriere-plan
.DESCRIPTION
    Demarre le watchdog dans une fenetre PowerShell separee ou en arriere-plan.
    Usage: .\start-watchdog.ps1 [-Background] [-DryRun]
#>
param(
    [switch]$Background,
    [switch]$DryRun,
    [int]$Interval = 30
)

$ErrorActionPreference = "Stop"
$watchdogScript = Join-Path $PSScriptRoot "watchdog.ps1"

if (-not (Test-Path $watchdogScript)) {
    Write-Host "❌ watchdog.ps1 introuvable" -ForegroundColor Red
    exit 1
}

# Creer le dossier logs
$logDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$logFile = Join-Path $logDir "watchdog.log"

if ($Background) {
    Write-Host "🐕 Lancement du watchdog en ARRIERE-PLAN..." -ForegroundColor Cyan
    Write-Host "   Logs: $logFile" -ForegroundColor Gray
    Write-Host "   Intervalle: ${Interval}s" -ForegroundColor Gray
    Write-Host "   DryRun: $DryRun" -ForegroundColor Gray
    Write-Host ""

    $args = "-File `"$watchdogScript`" -Interval $Interval -LogPath `"$logFile`""
    if ($DryRun) { $args += " -DryRun" }

    $job = Start-Job -ScriptBlock {
        param($cmd)
        Invoke-Expression $cmd
    } -ArgumentList $args -Name "DockerWatchdog"

    Start-Sleep -Seconds 2
    $jobState = (Get-Job -Name "DockerWatchdog" -ErrorAction SilentlyContinue).State

    if ($jobState -eq "Running") {
        Write-Host "✅ Watchdog lance (Job ID: $($job.Id))" -ForegroundColor Green
        Write-Host ""
        Write-Host "Commandes:" -ForegroundColor White
        Write-Host "  Voir logs:  Get-Content $logFile -Wait" -ForegroundColor Gray
        Write-Host "  Stopper:   Stop-Job -Name DockerWatchdog" -ForegroundColor Gray
        Write-Host "  Status:    Get-Job -Name DockerWatchdog" -ForegroundColor Gray
    } else {
        Write-Host "❌ Erreur de demarrage du watchdog" -ForegroundColor Red
        Receive-Job -Name "DockerWatchdog" -ErrorAction SilentlyContinue | Write-Host
    }
} else {
    Write-Host "🐕 Lancement du watchdog en PREMIER PLAN..." -ForegroundColor Cyan
    Write-Host "   Appuyez sur Ctrl+C pour arreter" -ForegroundColor Yellow
    Write-Host ""

    $params = @{
        Interval = $Interval
        LogPath = $logFile
    }
    if ($DryRun) { $params['DryRun'] = $true }

    & $watchdogScript @params
}
