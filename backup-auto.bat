@echo off
:: Backup automatique toutes les heures
:: Lancer ce fichier en tant qu'Administrateur
:: Il tourne en boucle en arriere-plan

:loop
powershell -NonInteractive -WindowStyle Hidden -File "%~dp0backup-db.ps1" -RetentionDays 14 >> "%~dp0backups\backup-auto.log" 2>&1
timeout /t 3600 /nobreak > nul
goto loop
