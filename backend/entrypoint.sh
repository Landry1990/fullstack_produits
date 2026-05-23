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

# ── 0. Générer DJANGO_SECRET_KEY si absent ──
if [ -z "$DJANGO_SECRET_KEY" ]; then
    echo ""
    echo "⚠️  DJANGO_SECRET_KEY non défini — Génération automatique..."
    export DJANGO_SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(50))")
    echo "✓ Clé secrète générée automatiquement"
fi

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
timeout 300 python manage.py migrate --noinput || {
    echo "⚠ Les migrations ont échoué ou pris trop de temps"
    # Ne pas bloquer le démarrage — le serveur peut fonctionner avec des migrations en attente
}

# ── 2b. Charger la fixture produits si la base est vide ──
echo ""
echo "🌱 Vérification seed produits..."
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from api.models import Produit
count = Produit.objects.count()
print(f'  Produits en base: {count}')
exit(0 if count == 0 else 1)
" 2>/dev/null && {
    FIXTURE=/app/fixtures/produits_seed.json
    if [ -f \"\$FIXTURE\" ]; then
        echo "📦 Base vide — chargement de la fixture produits..."
        python manage.py loaddata \"\$FIXTURE\" && echo "✓ Fixture chargée" || echo "⚠️  Échec du chargement fixture"
    else
        echo "  Aucune fixture trouvée ($FIXTURE) — base restera vide"
    fi
} || echo "  ✓ Produits existants — fixture ignorée"

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

# ── 6. Garantir le compte admin par défaut ──
echo ""
echo "👤 Vérification du compte admin..."
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User
from api.models import Profile

username = os.getenv('DEFAULT_ADMIN_USER', 'admin')
password = os.getenv('DEFAULT_ADMIN_PASSWORD', 'admin123')
email    = os.getenv('DEFAULT_ADMIN_EMAIL', 'admin@pharmacie.local')

user, created = User.objects.get_or_create(
    username=username,
    defaults={
        'email': email,
        'first_name': 'Administrateur',
        'last_name': 'Principal',
        'is_superuser': True,
        'is_staff': True,
        'is_active': True,
    }
)

if created:
    user.set_password(password)
    user.save()
    print(f'✓ Compte admin créé: {username} / {password}')
else:
    # S'assurer qu'il reste superuser et actif
    changed = False
    if not user.is_superuser:
        user.is_superuser = True
        changed = True
    if not user.is_staff:
        user.is_staff = True
        changed = True
    if not user.is_active:
        user.is_active = True
        changed = True
    if changed:
        user.save()
        print(f'✓ Privilèges admin restaurés pour {username}')
    else:
        print(f'✓ Compte admin {username} OK')

# Garantir le Profile avec tous les droits
profile, p_created = Profile.objects.get_or_create(user=user)
if p_created or profile.role != 'PHARMACIEN':
    profile.role = 'PHARMACIEN'
    profile.allowed_menus = []
    profile.can_do_returns = True
    profile.can_sell_negative_stock = True
    profile.can_cash_out = True
    profile.can_delete_product = True
    profile.can_adjust_stock = True
    profile.can_delete_fournisseur = True
    profile.can_delete_commande = True
    profile.can_close_commande = True
    profile.can_generate_coupon = True
    profile.can_cancel_invoice = True
    profile.can_modify_invoice = True
    profile.can_cancel_promis = True
    profile.can_manage_perimes = True
    profile.can_manage_avoirs = True
    profile.can_validate_zero_amount = True
    profile.can_modify_price = True
    profile.max_discount_rate = 100
    profile.save()
    print('✓ Profile admin configuré (PHARMACIEN, tous droits)')
"

# ── 6b. Garantir l'existence du compte de secours ──
echo ""
echo "🔐 Vérification du compte de secours..."
python scripts/ensure_emergency_admin.py || echo "⚠️  Vérification du compte de secours échouée"

# ── 7. Import des données fournisseur si spécifié et base vide ──
if [ -n "$SUPPLIER_DATA" ]; then
    echo ""
    echo "📦 Vérification import données fournisseur: $SUPPLIER_DATA"
    python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from api.models import Produit
if Produit.objects.count() == 0:
    print('Base vide - Import nécessaire')
    exit(0)
else:
    print(f'✓ {Produit.objects.count()} produits existants - Import ignoré')
    exit(1)
" 2>/dev/null && {
        echo "🔄 Import des données en cours..."
        python manage.py import_supplier_data --supplier "$SUPPLIER_DATA" || {
            echo "⚠️  Échec import - vérifiez que les données existent dans supplier_data/$SUPPLIER_DATA/"
        }
    }
fi

# ── 8. Démarrage Daphne (ASGI) pour supporter WebSocket ──
echo ""
echo "🔥 Démarrage de Daphne (ASGI) pour HTTP + WebSocket..."
echo "══════════════════════════════════════════════"
echo ""

exec daphne \
    --bind 0.0.0.0 \
    --port 8000 \
    --access-log - \
    -v 2 \
    backend.asgi:application
