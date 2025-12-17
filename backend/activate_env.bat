@echo off
REM Script batch pour activer l'environnement virtuel
REM Usage: activate_env.bat

echo Activation de l'environnement virtuel...
call my_env01\Scripts\activate.bat

echo.
echo ✅ Environnement virtuel activé!
echo Vous pouvez maintenant utiliser 'python' et 'pip' directement.
echo.
python --version
