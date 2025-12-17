# Script PowerShell pour activer l'environnement virtuel
# Usage: . .\activate_env.ps1

$env:Path = "C:\Projet Fullstack\fullstack_produits\backend\my_env01\Scripts;" + $env:Path
Write-Host "✅ Environnement virtuel activé!" -ForegroundColor Green
Write-Host "Vous pouvez maintenant utiliser 'python' directement" -ForegroundColor Cyan

# Test
python --version
