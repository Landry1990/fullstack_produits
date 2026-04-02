#!/bin/sh

# ═══════════════════════════════════════════════════════
# Entrypoint Docker Résilient — Backend Pharmacie
# ═══════════════════════════════════════════════════════
# - Attend que la DB soit prête
# - Exécute les vérifications d'intégrité
# - Applique les migrations si nécessaire
# - Démarre Gunicorn avec graceful shutdown
# ═══════════════════════════════════════════════════════

set -e

echo "══════════════════════════════════════════════"
echo "   DÉMARRAGE BACKEND — Mode Docker"
echo "══════════════════════════════════════════════"

# ── 1. Attendre la base de données (timeout 30s) ──
echo ""
echo "⏳ Attente de la base de données..."
RETRIES=30
until python -c "
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.db import connection
connection.ensure_connection()
print('DB ready')
" 2>/dev/null; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        echo "✗ ERREUR: La base de données n'est pas accessible après 30 tentatives"
        exit 1
    fi
    echo "  Tentative... ($RETRIES restantes)"
    sleep 1
done
echo "✓ Base de données connectée"

# ── 2. Migrations (avec timeout) ──
echo ""
echo "📥 Application des migrations..."
timeout 120 python manage.py migrate --noinput || {
    echo "⚠ Les migrations ont échoué ou pris trop de temps"
    # Ne pas bloquer le démarrage — le serveur peut fonctionner avec des migrations en attente
}

# ── 3. Vérification d'intégrité ──
echo ""
echo "🔍 Vérification d'intégrité..."
python manage.py check_integrity --fix || {
    echo "⚠ Des problèmes d'intégrité ont été détectés (voir logs)"
}

# ── 4. Collecte des fichiers statiques ──
echo ""
echo "📂 Collecte des fichiers statiques..."
python manage.py collectstatic --noinput

# ── 5. Créer une sauvegarde pré-démarrage si aucune récente ──
echo ""
echo "💾 Vérification des sauvegardes..."
python -c "
import os, time
from pathlib import Path
backup_dir = Path('/app/backups')
backup_dir.mkdir(exist_ok=True)
backups = list(backup_dir.glob('backup_*.sql.gz'))
if backups:
    latest = max(backups, key=lambda f: f.stat().st_mtime)
    age_h = (time.time() - latest.stat().st_mtime) / 3600
    if age_h < 24:
        print(f'✓ Sauvegarde récente trouvée: {latest.name} ({age_h:.0f}h)')
    else:
        print(f'⚠ Dernière sauvegarde: {age_h:.0f}h — Sauvegarde recommandée')
else:
    print('⚠ Aucune sauvegarde — pensez à sauvegarder')
"

# ── 6. Démarrage Gunicorn avec gestion propre des signaux ──
echo ""
echo "🔥 Démarrage de Gunicorn..."
echo "══════════════════════════════════════════════"
echo ""

exec gunicorn \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}" \
    --timeout "${GUNICORN_TIMEOUT:-120}" \
    --graceful-timeout 30 \
    --max-requests 1000 \
    --max-requests-jitter 100 \
    --access-logfile - \
    --error-logfile - \
    --capture-output \
    backend.wsgi:application
