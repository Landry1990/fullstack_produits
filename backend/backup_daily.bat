@echo off
REM Daily Database Backup Script for Windows
REM Schedule this with Windows Task Scheduler

echo ========================================
echo Database Backup - %date% %time%
echo ========================================

cd /d "%~dp0"

REM Activate virtual environment if needed
REM call venv\Scripts\activate

REM Run backup command
python manage.py backup_database >> backup_log.txt 2>&1

if %ERRORLEVEL% EQU 0 (
    echo Backup completed successfully
) else (
    echo Backup failed with error code %ERRORLEVEL%
)

echo ========================================
