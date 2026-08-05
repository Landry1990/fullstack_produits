$ErrorActionPreference = "Continue"
& ".\deploy.ps1" -Target all *>&1 | ForEach-Object { Write-Host $_ }
