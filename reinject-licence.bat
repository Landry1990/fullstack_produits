@echo off
chcp 65001 >nul
REM Réinjection automatique de la licence Zenith
REM Place la clé dans le fichier licence_key.txt à la racine du projet, puis double-clique ce raccourci.

set "KEY_FILE=%~dp0licence_key.txt"

if not exist "%KEY_FILE%" (
    echo Fichier licence_key.txt non trouvé.
    echo Créez ce fichier et collez-y votre clé de licence.
    pause
    exit /b 1
)

for /f "delims=" %%a in ('type "%KEY_FILE%"') do set "LICENCE_KEY=%%a"

if "%LICENCE_KEY%"=="" (
    echo Le fichier licence_key.txt est vide.
    pause
    exit /b 1
)

echo Réinjection de la licence...
docker compose -f "%~dp0docker-compose.yml" exec backend python manage.py inject_licence --file /app/licence_key.txt

pause
