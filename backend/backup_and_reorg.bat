@echo off
REM ========================================
REM Sauvegarde + Réorganisation des clés
REM Planifier hebdomadaire (dimanche nuit)
REM ========================================

echo ========================================
echo Backup + Reorg - %date% %time%
echo ========================================

cd /d "%~dp0"

REM Activer l'environnement virtuel
call my_env01\Scripts\activate

REM Exécuter la commande
python manage.py backup_and_reorg --confirm >> backup_reorg_log.txt 2>&1

if %ERRORLEVEL% EQU 0 (
    echo Backup + Reorg completed successfully
) else (
    echo Backup + Reorg failed with error code %ERRORLEVEL%
)

echo ========================================
