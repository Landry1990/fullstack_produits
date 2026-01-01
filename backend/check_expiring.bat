@echo off
REM Script pour vérifier les produits en péremption
cd /d "C:\Projet Fullstack\fullstack_produits\backend"
call my_env01\Scripts\activate.bat
python manage.py check_expiring_products --days 30
pause
