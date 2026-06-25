$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$batPath = Join-Path $projectRoot 'reinject-licence.bat'
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Reinjecter Licence Zenith.lnk'

if (-not (Test-Path $batPath)) {
    Write-Error "Fichier reinject-licence.bat non trouvé."
    exit 1
}

$WshShell = New-Object -ComObject WScript.Shell
$shortcut = $WshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $batPath
$shortcut.WorkingDirectory = $projectRoot
$shortcut.IconLocation = 'shell32.dll,154'
$shortcut.Description = 'Réinjecter la licence Zenith dans la base de données'
$shortcut.Save()

Write-Host "Raccourci créé sur le bureau : $shortcutPath"
