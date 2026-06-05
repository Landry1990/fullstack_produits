@echo off
chcp 65001 >nul
title Rebuild Sécurisé - Zenith Pharma
cls
echo ========================================================
echo   REBUILD SECURISE - Zenith Pharma
echo ========================================================
echo.
echo   Ce script va :
echo     1. Sauvegarder la base de données
echo     2. Rebuilder les conteneurs Docker
echo     3. Redémarrer l'application
echo.
echo   ⚠️  Ne JAMAIS faire "docker compose up -d --build" directement !
echo.
pause

powershell -ExecutionPolicy Bypass -File "%~dp0safe-rebuild.ps1"

echo.
pause
