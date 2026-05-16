#!/bin/bash
# ═══════════════════════════════════════════════════════
# Zenith Pharma — Installation Automatique (Ubuntu Desktop)
# ═══════════════════════════════════════════════════════
# Ce script installe completement la pharmacie en UNE SEULE commande.
# Usage : curl -sSL https://raw.githubusercontent.com/TON_COMPTE/fullstack_produits/main/install.sh | bash
#          OU  bash install.sh (depuis le repo clone)
# ═══════════════════════════════════════════════════════

set -euo pipefail

ZENITH_DIR="/opt/zenith-pharma"
REPO_URL="${REPO_URL:-https://github.com/Landry1990/fullstack_produits.git}"
BRANCH="${BRANCH:-main}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*" >&2; }

step() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
}

# ── 0. Vérifier Ubuntu ─────────────────────────────────
step "0. Vérification du système"
if ! grep -q "Ubuntu" /etc/os-release 2>/dev/null; then
    err "Ce script est conçu pour Ubuntu Desktop/Server uniquement."
    exit 1
fi
ok "Ubuntu détecté : $(grep PRETTY_NAME /etc/os-release | cut -d'"' -f2)"

# ── 1. Mise à jour ───────────────────────────────────
step "1. Mise à jour du système"
sudo apt-get update -qq && sudo apt-get upgrade -y -qq
ok "Système à jour"

# ── 2. Installer Docker ────────────────────────────────
step "2. Installation de Docker & Docker Compose"
if command -v docker &>/dev/null && docker compose version &>/dev/null; then
    ok "Docker déjà installé : $(docker --version)"
else
    warn "Docker non trouvé — installation en cours..."
    sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker "$USER"
    ok "Docker installé"
fi

# ── 3. Outils de base ─────────────────────────────────
step "3. Installation de Git, Python3, htop"
sudo apt-get install -y -qq git python3 python3-pip htop
ok "Outils installés"

# ── 4. Cloner le projet ───────────────────────────────
step "4. Clonage du projet Zenith Pharma"
if [ -d "$ZENITH_DIR/.git" ]; then
    warn "Dossier $ZENITH_DIR existe déjà — mise à jour..."
    cd "$ZENITH_DIR"
    git fetch origin
    git reset --hard "origin/$BRANCH"
else
    sudo mkdir -p "$ZENITH_DIR"
    sudo chown "$USER:$USER" "$ZENITH_DIR"
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$ZENITH_DIR"
fi
ok "Projet cloné dans $ZENITH_DIR"
cd "$ZENITH_DIR"

# ── 5. Créer le .env ──────────────────────────────────
step "5. Configuration du fichier .env"
if [ -f .env ]; then
    warn ".env existe déjà — conservé"
else
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
    DEPLOY_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    cat > .env <<EOF
# Base de données
DB_NAME=pharma_db
DB_USER=pharma_user
DB_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")

# Django
DJANGO_SECRET_KEY=$SECRET_KEY
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend,frontend
DJANGO_DEBUG=False

# Frontend
FRONTEND_PORT=80

# CORS
CORS_ALLOWED_ORIGINS=http://localhost,http://frontend
CSRF_TRUSTED_ORIGINS=http://localhost,http://frontend
CORS_ALLOW_ALL=false

# Cache
REDIS_URL=redis://redis:6379/0

# Webhook
DEPLOY_SECRET=$DEPLOY_SECRET

# Ngrok (optionnel)
# NGROK_AUTHTOKEN=ton_token_ngrok
EOF
    ok ".env créé avec clés auto-générées"
    echo -e "${YELLOW}  → IMPORTANT : Copiez ces valeurs dans un endroit sûr :${NC}"
    echo -e "    DJANGO_SECRET_KEY : ${SECRET_KEY:0:20}..."
    echo -e "    DEPLOY_SECRET     : ${DEPLOY_SECRET:0:20}..."
fi

# ── 6. Permissions ────────────────────────────────────
step "6. Permissions des scripts"
chmod +x auto-deploy.sh deploy.sh rollback.sh backup-db.sh watchdog.sh start-watchdog.sh 2>/dev/null || true
chmod +x webhook-deploy.py 2>/dev/null || true
mkdir -p logs backups
ok "Scripts prêts"

# ── 7. Lancer Docker ──────────────────────────────────
step "7. Construction & démarrage des conteneurs"
sudo docker compose -f docker-compose.prod.yml pull 2>/dev/null || true
sudo docker compose -f docker-compose.prod.yml build --quiet 2>/dev/null || sudo docker compose -f docker-compose.prod.yml build
sudo docker compose -f docker-compose.prod.yml up -d
ok "Conteneurs démarrés"

# ── 8. Attendre la DB ─────────────────────────────────
step "8. Attente de la base de données (max 60s)"
RETRIES=30
until sudo docker exec "${ZENITH_DIR##*/}-backend-1" python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.db import connection
connection.ensure_connection()
print('DB ready')
" 2>/dev/null; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        err "La base de données n'est pas accessible après 60s"
        err "Vérifiez : sudo docker logs ${ZENITH_DIR##*/}-db-1 --tail 50"
        exit 1
    fi
    sleep 2
done
ok "Base de données prête"

# ── 9. Migrations + superuser ─────────────────────────
step "9. Migrations Django et superutilisateur"
sudo docker exec "${ZENITH_DIR##*/}-backend-1" python manage.py migrate --noinput
ok "Migrations appliquées"

# Créer superuser si inexistant
sudo docker exec "${ZENITH_DIR##*/}-backend-1" python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.contrib.auth.models import User
from django.utils import timezone
if not User.objects.filter(is_superuser=True).exists():
    User.objects.create_superuser('admin', 'admin@pharmacie.local', 'admin123', last_login=timezone.now())
    print('CREATED: admin / admin123')
else:
    print('EXISTING: superuser déjà présent')
" 2>/dev/null || true
ok "Superutilisateur : admin / admin123 (à changer !)"

# ── 10. Services systemd ──────────────────────────────
step "10. Installation des services auto-démarrage"
if [ -f zenith-webhook.service ]; then
    sudo cp zenith-webhook.service /etc/systemd/system/ 2>/dev/null || true
fi
if [ -f zenith-watchdog.service ]; then
    sudo cp zenith-watchdog.service /etc/systemd/system/ 2>/dev/null || true
fi
sudo systemctl daemon-reload 2>/dev/null || true
sudo systemctl enable zenith-webhook 2>/dev/null || warn "zenith-webhook non installé"
sudo systemctl enable zenith-watchdog 2>/dev/null || warn "zenith-watchdog non installé"
ok "Services systemd configurés"

# ── 11. Portainer (optionnel) ─────────────────────────
step "11. Installation de Portainer (interface web Docker)"
if docker ps --format '{{.Names}}' | grep -q '^portainer$'; then
    ok "Portainer déjà installé"
else
    docker volume create portainer_data 2>/dev/null || true
    docker run -d \
        --name portainer \
        -p 9000:9000 \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v portainer_data:/data \
        --restart always \
        portainer/portainer-ce:latest 2>/dev/null || warn "Portainer non installé"
    ok "Portainer démarré sur http://localhost:9000"
fi

# ── 12. Résumé ────────────────────────────────────────
step "✅ INSTALLATION TERMINÉE"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  🏥  Zenith Pharma est installé et fonctionnel"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BLUE}Accès application :${NC}  http://localhost/"
echo -e "  ${BLUE}Accès Portainer   :${NC}  http://localhost:9000/"
echo -e "  ${BLUE}Superutilisateur  :${NC}  admin / admin123"
echo -e "  ${BLUE}Dossier projet    :${NC}  $ZENITH_DIR"
echo ""
echo -e "  ${YELLOW}Prochaines étapes manuelles :${NC}"
echo -e "    1. Configurer le webhook GitHub (section 7 du guide)"
echo -e "    2. Changer le mot de passe admin"
echo -e "    3. Installer TeamViewer/AnyDesk pour l'accès distant"
echo ""
echo -e "  ${YELLOW}Commandes utiles :${NC}"
echo -e "    cd $ZENITH_DIR && sudo docker compose -f docker-compose.prod.yml ps"
echo -e "    sudo journalctl -u zenith-webhook -f"
echo -e "    ./backup-db.sh"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
