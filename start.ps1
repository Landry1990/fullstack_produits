# Démarrage du backend dans un nouveau terminal
Write-Host "Demarrage du backend..." -ForegroundColor Green
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd 'C:\Projet Fullstack\fullstack_produits\backend'; .\my_env01\Scripts\Activate.ps1; python manage.py runserver 0.0.0.0:8000"

# Démarrage du frontend dans un nouveau terminal
Write-Host "Demarrage du frontend..." -ForegroundColor Green
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd 'C:\Projet Fullstack\fullstack_produits\frontend\frontend'; npm run dev"

Write-Host "Les deux serveurs sont lances !" -ForegroundColor Yellow
