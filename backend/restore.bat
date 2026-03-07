@echo off
setlocal enabledelayedexpansion

echo ========================================
echo RESTAURATION DE LA BASE DE DONNEES
echo ========================================

REM On se place dans le dossier backend
cd /d "%~dp0"

REM Vérifier l'environnement virtuel
if exist my_env01\Scripts\activate (
    call my_env01\Scripts\activate
) else if exist venv\Scripts\activate (
    call venv\Scripts\activate
)

REM Lister les sauvegardes disponibles
echo Liste des sauvegardes disponibles dans /backups :
set count=0
for %%f in (backups\*.sql.gz) do (
    set /a count+=1
    set "file[!count!]=%%f"
    echo [!count!] %%f
)

if %count%==0 (
    echo Aucune sauvegarde trouvee dans le dossier /backups.
    pause
    exit /b
)

echo.
set /p choice="Choisissez le numero de la sauvegarde a restaurer (ou 'q' pour quitter) : "

if "%choice%"=="q" exit /b

if defined file[%choice%] (
    set "selected_file=!file[%choice%]!"
    echo.
    echo Vous avez choisi : !selected_file!
    echo.
    
    python manage.py restore_database !selected_file!
) else (
    echo Choix invalide.
)

pause
