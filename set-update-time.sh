#!/usr/bin/env bash
# ============================================================
# set-update-time.sh — Modifie l'heure de mise à jour automatique
# Usage : bash set-update-time.sh HH:MM
# Exemple : bash set-update-time.sh 03:30
# Supporte systemd (prioritaire) et cron (fallback)
# ============================================================

set -euo pipefail

TIME="${1:-02:00}"
APP_DIR="/opt/zenith-pharma"
TIMER_FILE="/etc/systemd/system/zenith-nightly-update.timer"
CONF_FILE="$APP_DIR/update-time.conf"
CRON_MARKER="# zenith-nightly-update"

# Valider le format HH:MM
if ! echo "$TIME" | grep -qE '^[0-2][0-9]:[0-5][0-9]$'; then
    echo "❌ Format invalide. Utilisez HH:MM (ex: 02:00, 03:30)"
    exit 1
fi

# Sauvegarder la préférence
echo "$TIME" > "$CONF_FILE"

# Extraire HH et MM pour cron
HH=$(echo "$TIME" | cut -d: -f1)
MM=$(echo "$TIME" | cut -d: -f2)

# Détection du mode : systemd ou cron
HAS_SYSTEMD=false
if command -v systemctl &>/dev/null && [ -d /etc/systemd/system ]; then
    HAS_SYSTEMD=true
fi

if [ "$HAS_SYSTEMD" = "true" ]; then
    # Mode systemd
    echo "📦 Utilisation de systemd..."

    cat > "$TIMER_FILE" << EOF
[Unit]
Description=Zenith Pharma — Timer mise à jour nocturne (${TIME})

[Timer]
OnCalendar=*-*-* ${TIME}:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

    systemctl daemon-reload
    systemctl restart zenith-nightly-update.timer

    echo "✅ Heure de mise à jour configurée à ${TIME} (systemd)"
    echo "   Le timer systemd a été mis à jour et redémarré"
else
    # Mode cron (fallback)
    echo "📦 systemd non disponible — utilisation de cron..."

    if ! command -v crontab &>/dev/null; then
        echo "❌ Ni systemd ni cron ne sont disponibles sur ce système."
        echo "   Installez cron : sudo apt install cron"
        exit 1
    fi

    # Construire la nouvelle entrée cron
    CRON_LINE="${MM} ${HH} * * * ${APP_DIR}/nightly-update.sh >> ${APP_DIR}/logs/nightly-update.log 2>&1 ${CRON_MARKER}"

    # Supprimer l'ancienne entrée et ajouter la nouvelle
    (crontab -l 2>/dev/null | grep -v "$CRON_MARKER" || true; echo "$CRON_LINE") | crontab -

    echo "✅ Heure de mise à jour configurée à ${TIME} (cron)"
    echo "   Tâche cron ajoutée : ${MM} ${HH} * * * → ${APP_DIR}/nightly-update.sh"
fi
