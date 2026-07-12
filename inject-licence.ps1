#Requires -Version 5.1
<#
.SYNOPSIS
    Injecte une clé de licence JWT dans la base de données Django.

.DESCRIPTION
    Lit la clé depuis :
      1. Le presse-papiers (par défaut)
      2. Un fichier passé en paramètre -FilePath
      3. Le paramètre -Key directement (déconseillé, apparaît dans l'historique)

    La clé est transmise via une variable d'environnement temporaire pour éviter
    qu'elle n'apparaisse dans les logs de processus.

.EXAMPLE
    .\inject-licence.ps1

.EXAMPLE
    .\inject-licence.ps1 -FilePath C:\Secrets\licence_key.txt

.EXAMPLE
    .\inject-licence.ps1 -ValidateOnly -FilePath .\licence_key.txt
#>
[CmdletBinding()]
param(
    [string]$FilePath,
    [string]$Key,
    [switch]$ValidateOnly,
    [switch]$Force,
    [string]$Container = "fullstack_produits-backend-1",
    [string]$EnvVarName = "ZP_LICENCE_KEY"
)

$ErrorActionPreference = "Stop"

function Get-LicenceKey {
    if ($Key) { return $Key.Trim() }
    if ($FilePath) {
        if (-not (Test-Path $FilePath)) { throw "Fichier introuvable : $FilePath" }
        return (Get-Content $FilePath -Raw).Trim()
    }
    # Presse-papiers
    try {
        return (Get-Clipboard).Trim()
    } catch {
        throw "Impossible de lire le presse-papiers. Utilisez -FilePath ou -Key."
    }
}

$licenceKey = Get-LicenceKey
if ([string]::IsNullOrWhiteSpace($licenceKey)) {
    throw "Aucune clé de licence fournie."
}

# On ne garde la clé que dans une variable d'environnement temporaire
try {
    [Environment]::SetEnvironmentVariable($EnvVarName, $licenceKey, "Process")

    $argList = "exec $Container python manage.py inject_licence --from-env $EnvVarName"
    if ($ValidateOnly) { $argList += " --validate-only" }
    if ($Force) { $argList += " --force" }

    Write-Host "Injection de la licence en cours..." -ForegroundColor Cyan
    docker $argList.Split(' ')
}
finally {
    # Nettoyage immédiat de l'environnement
    [Environment]::SetEnvironmentVariable($EnvVarName, $null, "Process")
}

Write-Host "Terminé." -ForegroundColor Green
