@echo off
chcp 65001 >nul
title Arrêt Pharmacie
cls

echo ╔══════════════════════════════════════════════════════════╗
echo ║           ARRÊT APPLICATION PHARMACIE                 ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo [1/2] Arrêt des conteneurs...
docker compose stop 2>&1 | findstr /i "Stopped"
echo    ✅ Services arrêtés

echo.
echo [2/2] Vérification...
docker compose ps 2>&1 | findstr /i "running" >nul
if %errorlevel% neq 0 (
    echo    ✅ Tous les conteneurs sont bien arrêtés.
) else (
    echo    ⚠️  Certains conteneurs tournent encore.
    echo       Utilisez ARRETER_TOTAL.bat pour tout fermer.
)

echo.
pause
