#!/bin/bash
# ═══════════════════════════════════════════════════════
# Zenith Pharma — Installation Automatique (Ubuntu Desktop)
# ═══════════════════════════════════════════════════════
# Ce script installe completement la pharmacie en UNE SEULE commande.
# Usage : curl -sSL https://raw.githubusercontent.com/TON_COMPTE/fullstack_produits/main/install.sh | bash
#          OU  bash install.sh (depuis le repo clone)
# ═══════════════════════════════════════════════════════

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

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

# Spinner qui tourne en arrière-plan pendant les opérations longues
_SPINNER_PID=""
SPINNER_CHARS='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
start_spinner() {
    local msg="$1"
    (
        local i=0
        while true; do
            echo -ne "\r${BLUE}  ${SPINNER_CHARS:$((i % 10)):1}${NC} $msg... "
            i=$((i + 1))
            sleep 0.3
        done
    ) &
    _SPINNER_PID=$!
}
stop_spinner() {
    if [ -n "$_SPINNER_PID" ]; then
        kill "$_SPINNER_PID" 2>/dev/null || true
        wait "$_SPINNER_PID" 2>/dev/null || true
        echo -ne "\r\033[K"
        _SPINNER_PID=""
    fi
}
# Exécuter une commande avec spinner
run_with_spinner() {
    local msg="$1"; shift
    local rc=0
    start_spinner "$msg"
    "$@" || rc=$?
    stop_spinner
    return $rc
}

# ── 0. Vérifier système compatible (Ubuntu ou dérivé) ──
step "0. Vérification du système"
if ! grep -qE "ID_LIKE=.*ubuntu|UBUNTU_CODENAME=" /etc/os-release 2>/dev/null; then
    err "Ce script est conçu pour Ubuntu et ses dérivés (Linux Mint, etc.) uniquement."
    exit 1
fi
DISTRO_PRETTY=$(grep PRETTY_NAME /etc/os-release | cut -d'"' -f2)
ok "Système détecté : $DISTRO_PRETTY"

# Authentifier sudo avant d'utiliser les spinners et garder le cache actif
step "Authentification sudo"
if ! sudo -v; then
    err "Ce script nécessite les droits sudo."
    exit 1
fi
# Rafraîchit le cache sudo toutes les 60s pendant toute la durée du script
( while true; do sudo -n true 2>/dev/null; sleep 60; kill -0 "$$" || exit; done ) 2>/dev/null &
ok "Authentification sudo OK"

# ── 1. Mise à jour ───────────────────────────────────
step "1. Mise à jour du système"
run_with_spinner "Mise à jour des paquets" sudo apt-get update -qq
run_with_spinner "Mise à niveau du système" sudo apt-get upgrade -y -qq
ok "Système à jour"

# ── 2. Installer Docker ────────────────────────────────
step "2. Installation de Docker & Docker Compose"
if command -v docker &>/dev/null && sudo docker compose version &>/dev/null; then
    ok "Docker déjà installé : $(docker --version)"
else
    warn "Docker non trouvé — installation en cours..."
    sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    # Linux Mint n'a pas de repo Docker dédié ; utiliser le codename Ubuntu sous-jacent
    UBUNTU_CODENAME=$(grep UBUNTU_CODENAME /etc/os-release | cut -d'=' -f2)
    DOCKER_CODENAME="${UBUNTU_CODENAME:-$(lsb_release -cs)}"
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $DOCKER_CODENAME stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -qq
    run_with_spinner "Installation des paquets Docker" sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker "$USER"
    ok "Docker installé"
fi

# ── 3. Outils de base ─────────────────────────────────
step "3. Installation de Git, Python3, htop"
run_with_spinner "Installation de Git, Python3, htop" sudo apt-get install -y -qq git python3 python3-pip htop
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
    DB_PASS=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")
    EMERGENCY_PASS=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")
    REDIS_PASS=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")
    cat > .env <<EOF
# Base de données
DB_NAME=pharma_db
DB_USER=pharma_user
DB_PASSWORD=$DB_PASS

# Django
DJANGO_SECRET_KEY=$SECRET_KEY
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend,frontend,*
DJANGO_DEBUG=False

# Frontend
FRONTEND_PORT=80

# CORS (docker-compose.prod.yml force CORS_ALLOW_ALL=false en prod)
CORS_ALLOWED_ORIGINS=http://localhost,http://frontend
CSRF_TRUSTED_ORIGINS=http://localhost,http://frontend

# Cache
REDIS_PASSWORD=$REDIS_PASS
REDIS_URL=redis://:$REDIS_PASS@redis:6379/0

# Admin par défaut (créé automatiquement au 1er démarrage)
DEFAULT_ADMIN_USER=admin
DEFAULT_ADMIN_PASSWORD=admin123
DEFAULT_ADMIN_EMAIL=admin@pharmacie.local

# Admin de secours (accès d'urgence si admin principal bloqué)
EMERGENCY_ADMIN_USER=sysadmin
EMERGENCY_ADMIN_PASSWORD=$EMERGENCY_PASS

# Webhook
DEPLOY_SECRET=$DEPLOY_SECRET

# Tailscale (optionnel — décommentez et ajoutez votre auth key)
# TAILSCALE_AUTHKEY=tskey-auth-xxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TAILSCALE_HOSTNAME=fullstack-app
EOF
    ok ".env créé avec clés auto-générées"
    echo -e "${YELLOW}  → IMPORTANT : Copiez ces valeurs dans un endroit sûr :${NC}"
    echo -e "    DJANGO_SECRET_KEY : ${SECRET_KEY:0:20}..."
    echo -e "    DEPLOY_SECRET     : ${DEPLOY_SECRET:0:20}..."
fi

# ── 6. Détection CPU & configuration des limites Docker ──
step "6. Détection CPU & configuration des limites Docker"
CPU_COUNT=$(nproc)
log "CPUs détectés : $CPU_COUNT"
if [ "$CPU_COUNT" -ge 8 ]; then
    DB_CPUS=2.0; BACKEND_CPUS=4.0; REDIS_CPUS=1.0
elif [ "$CPU_COUNT" -ge 4 ]; then
    DB_CPUS=2.0; BACKEND_CPUS=3.0; REDIS_CPUS=0.5
elif [ "$CPU_COUNT" -ge 2 ]; then
    DB_CPUS=1.0; BACKEND_CPUS=1.5; REDIS_CPUS=0.5
else
    DB_CPUS=0.5; BACKEND_CPUS=0.5; REDIS_CPUS=0.25
fi
ok "Limites CPU → DB: ${DB_CPUS} | Backend: ${BACKEND_CPUS} | Redis: ${REDIS_CPUS}"
# Ajouter ou mettre à jour les variables CPU dans le .env
for _var in DB_CPUS BACKEND_CPUS REDIS_CPUS; do
    _val=$(eval echo "\$$_var")
    if grep -q "^${_var}=" .env 2>/dev/null; then
        sed -i "s/^${_var}=.*/${_var}=${_val}/" .env
    else
        echo "${_var}=${_val}" >> .env
    fi
done
ok "Variables CPU écrites dans .env"

# ── 7. Permissions ────────────────────────────────────
step "7. Permissions des scripts"
chmod +x auto-deploy.sh deploy.sh rollback.sh backup-db.sh watchdog.sh start-watchdog.sh setup-cron.sh init-db.sh 2>/dev/null || true
chmod +x nightly-update.sh zenith-update.sh install-desktop-shortcut.sh set-update-time.sh update-app.sh 2>/dev/null || true
chmod +x webhook-deploy.py 2>/dev/null || true
mkdir -p logs backups
ok "Scripts prêts"

# ── 8. Lancer Docker ──────────────────────────────────
step "8. Construction & démarrage des conteneurs"
sudo docker volume create fullstack_postgres_data_protected 2>/dev/null || true
ok "Volume Docker PostgreSQL prêt"
export GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
run_with_spinner "Build des conteneurs (peut prendre plusieurs minutes)" sudo GIT_COMMIT="$GIT_COMMIT" docker compose -f docker-compose.prod.yml build
run_with_spinner "Démarrage des conteneurs" sudo docker compose -f docker-compose.prod.yml up -d --remove-orphans
ok "Conteneurs démarrés"

# ── 9. Attendre que le backend soit prêt ──────────────
step "9. Attente du backend (max 120s)"
RETRIES=40
log "Vérification du backend en cours..."
until sudo docker compose -f docker-compose.prod.yml exec -T backend python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.db import connection
connection.ensure_connection()
print('DB ready')
" 2>/dev/null; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        err "Le backend n'est pas accessible après 120s"
        err "Vérifiez : sudo docker compose -f docker-compose.prod.yml logs backend --tail 50"
        exit 1
    fi
    echo -ne "\r${BLUE}  ⏳${NC} Attente backend... ($((40 - RETRIES))/40) "
    sleep 3
done
echo -ne "\r\033[K"
ok "Backend et base de données prêts"

# ── 10. Vérification du superuser ──────────────────────
step "10. Vérification du superutilisateur"
# Le entrypoint.sh du backend crée automatiquement l'admin
# avec profil pharmacien complet via DEFAULT_ADMIN_* du .env.
# On vérifie simplement qu'il existe.
SUPERUSER_CHECK=$(sudo docker compose -f docker-compose.prod.yml exec -T backend python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from django.contrib.auth.models import User
admin = User.objects.filter(is_superuser=True).first()
if admin:
    print(f'OK:{admin.username}')
else:
    print('WARN:')
" 2>/dev/null || echo "ERR:")
if [[ "$SUPERUSER_CHECK" == OK:* ]]; then
    SUPERUSER_NAME="${SUPERUSER_CHECK#OK:}"
    ok "Superutilisateur '$SUPERUSER_NAME' vérifié"
else
    warn "Impossible de vérifier le superutilisateur"
fi

# ── 11. Services systemd ──────────────────────────────
step "11. Installation des services auto-démarrage"
if [ -f zenith-webhook.service ]; then
    sudo cp zenith-webhook.service /etc/systemd/system/ 2>/dev/null || true
    # Configurer le secret webhook via un override systemd
    if [ -f .env ]; then
        DEPLOY_SECRET_VAL=$(grep "^DEPLOY_SECRET=" .env | cut -d'=' -f2-)
        if [ -n "$DEPLOY_SECRET_VAL" ]; then
            sudo mkdir -p /etc/systemd/system/zenith-webhook.service.d
            printf "[Service]\nEnvironment=\"DEPLOY_SECRET=%s\"\n" "$DEPLOY_SECRET_VAL" | \
                sudo tee /etc/systemd/system/zenith-webhook.service.d/override.conf >/dev/null
        fi
    fi
fi
if [ -f zenith-watchdog.service ]; then
    sudo cp zenith-watchdog.service /etc/systemd/system/ 2>/dev/null || true
fi
# Service + Timer de mise à jour automatique nocturne
if [ -f zenith-nightly-update.service ] && [ -f zenith-nightly-update.timer ]; then
    sudo cp zenith-nightly-update.service /etc/systemd/system/ 2>/dev/null || true
    sudo cp zenith-nightly-update.timer /etc/systemd/system/ 2>/dev/null || true
    sudo chmod +x "$ZENITH_DIR/nightly-update.sh" 2>/dev/null || true
fi
sudo systemctl daemon-reload 2>/dev/null || true
sudo systemctl enable zenith-webhook 2>/dev/null || warn "zenith-webhook non installé"
sudo systemctl enable zenith-watchdog 2>/dev/null || warn "zenith-watchdog non installé"
sudo systemctl enable zenith-nightly-update.timer 2>/dev/null || warn "zenith-nightly-update non installé"
sudo systemctl start zenith-nightly-update.timer 2>/dev/null || true
ok "Services systemd configurés"

# Sauvegarde automatique (cron : backup horaire + quotidien 02h + vérification 6h)
if [ -f setup-backup-cron.sh ]; then
    sudo chmod +x setup-backup-cron.sh 2>/dev/null || true
    # Lance en tant qu'utilisateur propriétaire du dossier (SUDO_USER si présent)
    if sudo -n true 2>/dev/null; then
        sudo -E ./setup-backup-cron.sh 2>/dev/null || warn "setup-backup-cron.sh a échoué"
    else
        ./setup-backup-cron.sh 2>/dev/null || warn "setup-backup-cron.sh a échoué"
    fi
    ok "Sauvegarde automatique planifiée (cron : horaire + quotidien 02h + vérif 6h)"
else
    warn "setup-backup-cron.sh absent — sauvegarde automatique NON configurée"
fi

# Installer le raccourci "Mettre à jour Zenith Pharma" sur le bureau
if [ -f install-desktop-shortcut.sh ]; then
    bash install-desktop-shortcut.sh 2>/dev/null || true
    ok "Raccourci de mise à jour installé sur le bureau (sans mot de passe)"
fi

# Règle sudoers pour permettre docker sans mot de passe (sécurisé)
SUDOERS_FILE="/etc/sudoers.d/zenith-update"
echo "%docker ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/docker-compose" | sudo tee "$SUDOERS_FILE" > /dev/null 2>/dev/null || true
sudo chmod 440 "$SUDOERS_FILE" 2>/dev/null || true
ok "Règle sudoers : docker sans mot de passe pour le groupe docker"

# ── 12. Portainer (optionnel) ─────────────────────────
step "12. Installation de Portainer (interface web Docker)"
if sudo docker ps --format '{{.Names}}' | grep -q '^portainer$'; then
    ok "Portainer déjà installé"
else
    sudo docker volume create portainer_data 2>/dev/null || true
    sudo docker run -d \
        --name portainer \
        -p 9001:9000 \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v portainer_data:/data \
        --restart always \
        portainer/portainer-ce:latest 2>/dev/null || warn "Portainer non installé"
    ok "Portainer démarré sur http://localhost:9001"
fi

# ── 13. Résumé ────────────────────────────────────────
step "✅ INSTALLATION TERMINÉE"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  🏥  Zenith Pharma est installé et fonctionnel"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BLUE}Accès application :${NC}  http://localhost/"
echo -e "  ${BLUE}Accès Portainer   :${NC}  http://localhost:9001/"
echo -e "  ${BLUE}Webhook deploy    :${NC}  http://localhost:9000/deploy"
echo -e "  ${BLUE}MàJ auto nocturne :${NC}  chaque soir à 02:00 (systemd timer)"
echo -e "  ${BLUE}Backup auto       :${NC}  horaire + 02h00 + vérif 6h (cron)"
echo -e "  ${BLUE}Superutilisateur  :${NC}  admin / admin123"
echo -e "  ${BLUE}Dossier projet    :${NC}  $ZENITH_DIR"

# Warnings services optionnels
if ! grep -q "^TAILSCALE_AUTHKEY=" .env 2>/dev/null || grep -q "^# TAILSCALE_AUTHKEY=" .env 2>/dev/null; then
    echo -e "  ${YELLOW}⚠ Tailscale non configuré — éditez .env si vous avez besoin d'un accès externe${NC}"
fi
echo ""
echo -e "  ${YELLOW}Prochaines étapes manuelles :${NC}"
echo -e "    1. Configurer le webhook GitHub (section 7 du guide)"
echo -e "    2. Changer le mot de passe admin"
echo -e "    3. Installer TeamViewer/AnyDesk pour l'accès distant"
echo ""
echo -e "  ${YELLOW}Commandes utiles :${NC}"
echo -e "    cd $ZENITH_DIR && sudo docker compose -f docker-compose.prod.yml ps"
echo -e "    sudo journalctl -u zenith-webhook -f"
echo -e "    sudo journalctl -u zenith-nightly-update -f   # logs mise à jour auto"
echo -e "    sudo systemctl list-timers                    # voir le timer"
echo -e "    crontab -l | grep ZENITH-BACKUP               # voir les cron backup"
echo -e "    ./backup-db.sh                                # backup manuel"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
