@echo off
title Lancement Full Stack

echo Demarrage du backend...
start "Backend" cmd /k "cd /d C:\Projet Fullstack\fullstack_produits\backend && my_env01\scripts\activate && python manage.py runserver 0.0.0.0:8000"

echo Demarrage du frontend...
start "Frontend" cmd /k "cd /d C:\Projet Fullstack\fullstack_produits\frontend && npm run dev"

echo Les deux serveurs sont lances dans des fenetres separees.
