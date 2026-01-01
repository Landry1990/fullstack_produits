@echo off
REM Script pour créer et appliquer la migration pour lot-specific returns
cd /d "C:\Projet Fullstack\fullstack_produits\backend"
call my_env01\Scripts\activate.bat

echo Creating migration for LigneAvoir.stock_lot field...
python manage.py makemigrations api --name add_stocklot_to_ligneavoir

echo.
echo Running migration...
python manage.py migrate

pause
