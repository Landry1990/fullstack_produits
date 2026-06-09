#!/bin/bash
# Setup automatique du système de backup incrémental

set -e

echo "=== SETUP BACKUP INCRÉMENTAL ==="
echo ""

# Créer les dossiers
sudo mkdir -p /backup/incremental
sudo mkdir -p /backup/full
sudo chmod 777 /backup/incremental
sudo chmod 777 /backup/full

# Rendre les scripts exécutables
chmod +x /c/Projet\ Fullstack/fullstack_produits/scripts/backup-incremental.sh
chmod +x /c/Projet\ Fullstack/fullstack_produits/scripts/restore-smart.sh

echo "✓ Dossiers créés:"
echo "  - /backup/incremental (transactions fréquentes)"
echo "  - /backup/full (backup quotidien complet)"
echo ""

# Vérifier Docker
echo "✓ Vérification Docker..."
if ! docker ps | grep -q "fullstack_produits-postgres-1"; then
    echo "❌ Container postgres non trouvé!"
    exit 1
fi
echo "  Container postgres: OK"
echo ""

# Windows (WSL) : utiliser Task Scheduler ou cron WSL
if grep -q Microsoft /proc/version 2>/dev/null || [ -n "$WSL_DISTRO_NAME" ]; then
    echo "🪟 Environnement Windows/WSL détecté"
    echo ""
    echo "Pour automatiser le backup toutes les 30 minutes:"
    echo ""
    echo "Option 1 - WSL cron:"
    echo "  crontab -e"
    echo "  Ajouter: */30 * * * * /c/Projet\\ Fullstack/fullstack_produits/scripts/backup-incremental.sh >> /var/log/backup.log 2>&1"
    echo ""
    echo "Option 2 - Windows Task Scheduler:"
    echo "  Créer une tâche qui exécute:"
    echo "  wsl -d Ubuntu -e /c/Projet\\ Fullstack/fullstack_produits/scripts/backup-incremental.sh"
    echo "  Fréquence: Toutes les 30 minutes"
    echo ""
else
    echo "🐧 Environnement Linux natif"
    echo ""
    echo "Installation du cron..."
    
    # Installer cron si nécessaire
    if ! command -v crontab &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y cron
    fi
    
    # Ajouter le job cron
    SCRIPT_PATH="/c/Projet Fullstack/fullstack_produits/scripts/backup-incremental.sh"
    
    # Supprimer l'ancien job si existe
    crontab -l 2>/dev/null | grep -v "backup-incremental" | crontab - 2>/dev/null || true
    
    # Ajouter le nouveau job
    (crontab -l 2>/dev/null; echo "*/30 * * * * \"$SCRIPT_PATH\" >> /var/log/backup.log 2>&1") | crontab -
    
    echo "✓ Cron configuré: Backup toutes les 30 minutes"
    echo ""
    echo "Vérification:"
    crontab -l | grep backup-incremental || echo "  (non installé)"
fi

echo ""
echo "=== TEST INITIAL ==="
echo ""
echo "Lancement d'un backup test..."
bash "/c/Projet Fullstack/fullstack_produits/scripts/backup-incremental.sh"

echo ""
echo "=== ✅ SETUP TERMINÉ ==="
echo ""
echo "Commandes disponibles:"
echo ""
echo "  Backup manuel:"
echo "    bash /c/Projet\\ Fullstack/fullstack_produits/scripts/backup-incremental.sh"
echo ""
echo "  Restauration intelligente:"
echo "    bash /c/Projet\\ Fullstack/fullstack_produits/scripts/restore-smart.sh <date_backup>"
echo ""
echo "  Exemple restauration:"
echo "    bash /c/Projet\\ Fullstack/fullstack_produits/scripts/restore-smart.sh 20240609_130000"
echo ""
echo "  Lister les backups:"
echo "    ls -lth /backup/incremental/*.sql.gz | head -10"
echo ""
