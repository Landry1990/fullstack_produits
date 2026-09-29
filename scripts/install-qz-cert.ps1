#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Installe le certificat de signature ZENITH dans QZ Tray (poste caisse client).
.DESCRIPTION
    - Télécharge le certificat public depuis le serveur ZENITH.
    - Le copie dans le dossier d'installation QZ Tray sous le nom override.crt.
    - Crée le fichier qz-tray.properties dans %ProgramData%\qz pour forcer QZ Tray
      à utiliser ce certificat.
    - Redémarre QZ Tray.
.PARAMETER ServerUrl
    URL du serveur ZENITH (par défaut : http://localhost).
.EXAMPLE
    .\install-qz-cert.ps1
    .\install-qz-cert.ps1 -ServerUrl "http://192.168.1.181"
#>
param(
    [string]$ServerUrl = "http://localhost"
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[ZENITH] $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[OK]   $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Find-QzTrayDirectory {
    $candidates = @(
        "${env:ProgramFiles}\QZ Tray",
        "${env:ProgramFiles(x86)}\QZ Tray",
        "${env:LOCALAPPDATA}\Programs\QZ Tray",
        "${env:LOCALAPPDATA}\QZ Tray"
    )
    foreach ($dir in $candidates) {
        if (Test-Path "$dir\qz-tray.jar") {
            return $dir
        }
    }
    return $null
}

# --- 1. Vérifier droits admin ---
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warn "Ce script doit être exécuté en tant qu'administrateur."
    exit 1
}

# --- 2. Trouver QZ Tray ---
Write-Step "Recherche de l'installation QZ Tray..."
$qzDir = Find-QzTrayDirectory
if (-not $qzDir) {
    Write-Warn "QZ Tray n'a pas été trouvé. Installe-le d'abord depuis https://qz.io/"
    exit 1
}
Write-Ok "QZ Tray trouvé : $qzDir"

# --- 3. Télécharger le certificat ---
$certUrl = "$ServerUrl/api/qz/certificate/"
$certPath = "$qzDir\override.crt"

Write-Step "Téléchargement du certificat depuis $certUrl ..."
try {
    $cert = Invoke-RestMethod -Uri $certUrl -UseBasicParsing -TimeoutSec 30
} catch {
    Write-Warn "Impossible de télécharger le certificat : $($_.Exception.Message)"
    Write-Warn "Vérifie que le serveur ZENITH est accessible à l'adresse $ServerUrl"
    exit 1
}

if (-not ($cert -match "BEGIN CERTIFICATE")) {
    Write-Warn "Le contenu téléchargé ne ressemble pas à un certificat PEM."
    exit 1
}

# --- 4. Écrire override.crt ---
Write-Step "Installation du certificat dans $certPath ..."
$cert | Out-File -FilePath $certPath -Encoding ascii -Force
Write-Ok "Certificat installé."

# --- 5. Créer qz-tray.properties ---
$propsDir = "${env:ProgramData}\qz"
$propsPath = "$propsDir\qz-tray.properties"

Write-Step "Configuration de QZ Tray ($propsPath) ..."
if (-not (Test-Path $propsDir)) {
    New-Item -ItemType Directory -Path $propsDir -Force | Out-Null
}

# Java properties interprète le backslash comme caractère d'échappement,
# on utilise donc des slashs pour le chemin du certificat.
$certPathForProps = $certPath -replace '\\', '/'
"authcert.override=$certPathForProps" | Out-File -FilePath $propsPath -Encoding ascii -Force
Write-Ok "Fichier de configuration créé."

# --- 6. Redémarrer QZ Tray ---
Write-Step "Redémarrage de QZ Tray..."
$qzProcess = Get-Process -Name "qz-tray" -ErrorAction SilentlyContinue
if ($qzProcess) {
    Stop-Process -Name "qz-tray" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

$qzExe = "$qzDir\qz-tray.exe"
if (Test-Path $qzExe) {
    Start-Process -FilePath $qzExe -WorkingDirectory $qzDir
    Write-Ok "QZ Tray redémarré."
} else {
    Write-Warn "qz-tray.exe introuvable. Redémarre QZ Tray manuellement."
}

Write-Host ""
Write-Ok "Installation terminée."
Write-Host "Ouvre ZENITH ($ServerUrl) et teste l'impression." -ForegroundColor White
Write-Host "Au premier popup QZ Tray : coche 'Remember this decision' puis 'Allow'." -ForegroundColor White
