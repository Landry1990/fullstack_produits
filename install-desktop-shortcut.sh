#!/usr/bin/env bash
# ============================================================
# install-desktop-shortcut.sh — Installe un raccourci "Mettre à jour Zenith Pharma" sur le bureau
# Usage : bash install-desktop-shortcut.sh (peut être lancé avec ou sans sudo)
# ============================================================

set -euo pipefail

APP_DIR="/opt/zenith-pharma"
DESKTOP_DIR="/usr/share/applications"
DESKTOP_FILE="$DESKTOP_DIR/zenith-update.desktop"

# Créer la règle sudoers pour permettre docker sans mot de passe
# (au cas où l'utilisateur n'est pas dans le groupe docker)
SUDOERS_FILE="/etc/sudoers.d/zenith-update"
if [ "$(id -u)" -eq 0 ]; then
    echo "%docker ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/docker-compose" > "$SUDOERS_FILE"
    chmod 440 "$SUDOERS_FILE"
elif command -v sudo &>/dev/null; then
    echo "%docker ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/docker-compose" | sudo tee "$SUDOERS_FILE" > /dev/null
    sudo chmod 440 "$SUDOERS_FILE"
fi

# Créer le raccourci
cat > "$DESKTOP_FILE" << 'EOF'
[Desktop Entry]
Name=Mettre à jour Zenith Pharma
Comment=Mise à jour automatique de Zenith Pharma
Exec=bash -c 'cd /opt/zenith-pharma && git pull origin main 2>/dev/null; chmod +x nightly-update.sh 2>/dev/null; bash nightly-update.sh; echo ""; echo "Mise à jour terminée. Appuyez sur Entrée pour fermer."; read -r _'
Icon=system-software-update
Terminal=true
Type=Application
Categories=Utility;
EOF

chmod +x "$DESKTOP_FILE"

# Copier sur les bureaux existants
for user_home in /home/*; do
    if [ -d "$user_home/Desktop" ]; then
        cp "$DESKTOP_FILE" "$user_home/Desktop/" 2>/dev/null || true
        chown "$(stat -c '%U' "$user_home")":"$(stat -c '%G' "$user_home")" "$user_home/Desktop/zenith-update.desktop" 2>/dev/null || true
        chmod +x "$user_home/Desktop/zenith-update.desktop" 2>/dev/null || true
    fi
done

echo "✅ Raccourci 'Mettre à jour Zenith Pharma' installé sur le bureau"
echo "   Double-cliquez dessus pour lancer la mise à jour (sans mot de passe)"
