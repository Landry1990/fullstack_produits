#!/usr/bin/env bash
# ============================================================
# set-update-time.sh — Modifie l'heure de mise à jour automatique
# Usage : bash set-update-time.sh HH:MM
# Exemple : bash set-update-time.sh 03:30
# ============================================================

set -euo pipefail

TIME="${1:-02:00}"
APP_DIR="/opt/zenith-pharma"
TIMER_FILE="/etc/systemd/system/zenith-nightly-update.timer"
CONF_FILE="$APP_DIR/update-time.conf"

# Valider le format HH:MM
if ! echo "$TIME" | grep -qE '^[0-2][0-9]:[0-5][0-9]$'; then
    echo "❌ Format invalide. Utilisez HH:MM (ex: 02:00, 03:30)"
    exit 1
fi

# Sauvegarder la préférence
echo "$TIME" > "$CONF_FILE"

# Mettre à jour le timer systemd
cat > "$TIMER_FILE" << EOF
[Unit]
Description=Zenith Pharma — Timer mise à jour nocturne (${TIME})

[Timer]
OnCalendar=*-*-* ${TIME}:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Recharger systemd et redémarrer le timer
systemctl daemon-reload
systemctl restart zenith-nightly-update.timer

echo "✅ Heure de mise à jour configurée à ${TIME}"
echo "   Le timer systemd a été mis à jour et redémarré"
