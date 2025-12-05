@echo off
echo ========================================
echo SCRIPT DE CORRECTION AUTOMATIQUE
echo ========================================
echo.

cd /d "c:\Projet Fullstack\fullstack_produits\backend"

echo [1/2] Application des migrations...
python manage.py migrate
if %ERRORLEVEL% NEQ 0 (
    echo ERREUR: La migration a echoue!
    pause
    exit /b 1
)

echo.
echo [2/2] Verification...
python manage.py showmigrations api | findstr "0016"

echo.
echo ========================================
echo TERMINE!
echo ========================================
echo.
echo Les ayants droit devraient maintenant s'afficher correctement.
echo Rafraichissez votre page web (F5) et testez!
echo.
pause
