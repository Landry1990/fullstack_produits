# Script PowerShell - Lancer la démo PDA WebSocket
# Double-clique sur ce fichier pour tout lancer automatiquement

Write-Host "🚀 Lancement de la démo PDA WebSocket..." -ForegroundColor Green
Write-Host ""

# Vérifier si on est dans le bon dossier
if (-not (Test-Path "./backend")) {
    Write-Host "❌ Erreur: Lance ce script depuis c:\Projet Fullstack\fullstack_produits" -ForegroundColor Red
    pause
    exit
}

Write-Host "📦 Étape 1/3: Lancement Backend (WebSocket)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; activate_env.bat; python -m daphne -b 0.0.0.0 -p 8000 backend.asgi:application; pause"

Write-Host "⏳ Attente 5 secondes pour le backend..."
Start-Sleep -Seconds 5

Write-Host "📦 Étape 2/3: Lancement Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend/frontend; npm run dev; pause"

Write-Host "⏳ Attente 3 secondes pour le frontend..."
Start-Sleep -Seconds 3

Write-Host "📱 Étape 3/3: Lancement Mobile PDA..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd mobile-facturation; npx expo start; pause"

Write-Host ""
Write-Host "✅ Tout est lancé !" -ForegroundColor Green
Write-Host ""
Write-Host "📋 URLs de test :" -ForegroundColor Cyan
Write-Host "   - Web Caisse: http://localhost:5173" -ForegroundColor White
Write-Host "   - Backend API: http://localhost:8000" -ForegroundColor White
Write-Host "   - WebSocket: ws://localhost:8000/ws/cashier/" -ForegroundColor White
Write-Host ""
Write-Host "📱 PDA: Scan le QR code dans le terminal Expo avec l'app Expo Go" -ForegroundColor Cyan
Write-Host ""
Write-Host "🧪 Test rapide: Ouvre http://localhost:5173 dans Chrome et teste !" -ForegroundColor Yellow
Write-Host ""
pause
