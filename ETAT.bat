@echo off
chcp 65001 >nul
title État Pharmacie
cls

echo ╔══════════════════════════════════════════════════════════╗
echo ║              ÉTAT DES SERVICES                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo --- Docker Desktop ---
docker info >nul 2>&1
if %errorlevel% equ 0 (
    echo    ✅ Docker est actif
) else (
    echo    ❌ Docker Desktop est éteint
    echo       Démarrez Docker Desktop d'abord.
    goto :fin
)

echo.
echo --- Conteneurs ---
docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.State}}"

echo.
echo --- Espace disque ---
docker system df 2>&1 | findstr /i "images volumes"

echo.
echo --- Test de l'application ---
curl -s -o nul -w "%%{http_code}" http://localhost > %temp%\health.txt 2>nul
set /p CODE=<%temp%\health.txt
del %temp%\health.txt >nul 2>&1

if "%CODE%"=="200" (
    echo    ✅ Application répond (HTTP 200)
    echo    🌐 http://localhost est accessible
) else (
    echo    ❌ Application ne répond pas (HTTP %CODE%)
    echo       Essayez de relancer avec DEMARRER.bat
)

:fin
echo.
pause
