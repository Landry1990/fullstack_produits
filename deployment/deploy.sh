#!/bin/bash

# Configuration
PROJECT_DIR="/var/www/fullstack"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend/frontend"
USER="ubuntu"

echo "🚀 Démarrage du déploiement..."

# 1. Update Code
echo "📥 Git Pull..."
cd $PROJECT_DIR
git pull origin main

# 2. Backend
echo "🐍 Mise à jour Backend..."
cd $BACKEND_DIR
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput

# 3. Frontend
echo "⚛️ Mise à jour Frontend..."
cd $FRONTEND_DIR
npm install
npm run build

# 4. Restart Services
echo "🔄 Redémarrage des services..."
sudo systemctl restart gunicorn
sudo systemctl restart nginx

echo "✅ Déploiement terminé avec succès !"
