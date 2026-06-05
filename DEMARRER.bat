@echo off
chcp 65001 >nul
title Lancement Pharmacie
cls

echo ╔══════════════════════════════════════════════════════════╗
echo ║           LANCEMENT APPLICATION PHARMACIE               ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM --- Vérifier que Docker Desktop est démarré ---
echo [1/3] Vérification de Docker...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ⚠️  Docker Desktop n'est pas démarré !
    echo    Veuillez lancer Docker Desktop et attendre qu'il soit prêt.
    echo    Puis relancez ce script.
    echo.
    pause
    exit /b 1
)
echo    ✅ Docker est actif

REM --- Aller dans le dossier du projet ---
cd /d "%~dp0"

REM --- Lancer les conteneurs ---
echo.
echo [2/3] Démarrage des services...
docker compose up -d --build 2>&1 | findstr /i "Created Starting Started"
if %errorlevel% neq 0 (
    echo    ⏳ Les services démarrent, veuillez patienter...
)

REM --- Attendre que le backend réponde ---
echo.
echo [3/3] Vérification que tout fonctionne...
timeout /t 5 /nobreak >nul

curl -s http://localhost/api/health/ >nul 2>&1
if %errorlevel% equ 0 (
    echo    ✅ Application prête !
    echo.
    echo ══════════════════════════════════════════════════════════
    echo   🌐 Ouvrez votre navigateur : http://localhost
    echo   👤 Compte par défaut : admin / admin123
    echo ══════════════════════════════════════════════════════════
) else (
    echo    ⏳ Le backend démarre encore, réessayez dans 30 secondes.
    echo       Puis ouvrez http://localhost dans votre navigateur.
)

echo.
pause
