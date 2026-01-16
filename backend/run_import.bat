@echo off
REM Script pour lancer le traitement d'import avec le bon environnement virtuel

echo Lancement du script d'import...
"my_env01\Scripts\python.exe" "traitement.py"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Une erreur s'est produite.
) else (
    echo.
    echo Traitement termine avec succes.
)
pause
