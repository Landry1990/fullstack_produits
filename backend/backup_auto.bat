@echo off
REM Automated Backup Trigger for Windows Task Scheduler
REM This script should be scheduled to run every 30 minutes.
REM It will only actually perform a backup if:
REM 1. It's the time configured in the app (Maintenance > Sauvegarde)
REM 2. No backup has been done today yet

echo ========================================
echo Checking for Scheduled Backup - %date% %time%
echo ========================================

cd /d "%~dp0"

REM Activate virtual environment
if exist my_env01\Scripts\activate (
    call my_env01\Scripts\activate
) else if exist venv\Scripts\activate (
    call venv\Scripts\activate
)

REM Run the check and backup command
python manage.py auto_backup >> auto_backup_log.txt 2>&1

if %ERRORLEVEL% EQU 0 (
    echo Check completed successfully
) else (
    echo Check failed with error code %ERRORLEVEL%
)

echo ========================================
