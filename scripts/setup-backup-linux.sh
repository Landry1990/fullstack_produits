#!/bin/bash
# Setup automatique du système de backup incrémental pour Linux

set -e

echo "=== SETUP BACKUP INCRÉMENTAL - LINUX ==="
echo ""

# Vérifier les privilèges
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Ce script doit être exécuté avec sudo pour configurer le cron"
    echo "   sudo bash setup-backup-linux.sh"
    echo ""
    read -p "Continuer quand même (sans cron)? (o/N): " choice
    if [[ ! $choice =~ ^[Oo]$ ]]; then
        exit 1
    fi
fi

# Créer les dossiers
echo "1. Création des dossiers de backup..."
mkdir -p /backup/incremental /backup/full
chmod 755 /backup /backup/incremental /backup/full

echo "   ✓ /backup/incremental"
echo "   ✓ /backup/full"
echo ""

# Obtenir le chemin absolu du projet
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "2. Répertoire du projet: $PROJECT_DIR"
echo ""

# Rendre les scripts exécutables
echo "3. Configuration des permissions..."
chmod +x "$PROJECT_DIR/scripts/backup-incremental-linux.sh"
chmod +x "$PROJECT_DIR/scripts/restore-smart.sh"
echo "   ✓ Scripts rendus exécutables"
echo ""

# Vérifier Docker
echo "4. Vérification Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé!"
    exit 1
fi

if ! docker ps &> /dev/null; then
    echo "❌ Docker ne fonctionne pas (vérifiez les permissions)"
    exit 1
fi

echo "   ✓ Docker OK"
echo ""

# Vérifier le container postgres
if docker ps | grep -q "fullstack_produits-postgres-1\|postgres"; then
    echo "   ✓ Container PostgreSQL trouvé"
else
    echo "⚠️  Container PostgreSQL non trouvé. Assurez-vous qu'il est démarré."
    echo "   Containers actifs:"
    docker ps --format "   - {{.Names}} ({{.Image}})" | grep -i postgres || echo "   (aucun)"
fi
echo ""

# Configuration du cron
echo "5. Configuration du cron (automatisation)..."

SCRIPT_PATH="$PROJECT_DIR/scripts/backup-incremental-linux.sh"
CRON_COMMENT="# Pharma backup incrémental - toutes les 30 min"
CRON_JOB="*/30 * * * * $SCRIPT_PATH >> /var/log/pharma-backup.log 2>&1"

# Vérifier si déjà configuré
if crontab -l 2>/dev/null | grep -q "pharma-backup"; then
    echo "   ℹ️  Cron déjà configuré. Mise à jour..."
    crontab -l 2>/dev/null | grep -v "pharma-backup" | crontab - 2>/dev/null || true
fi

# Ajouter le nouveau job
(crontab -l 2>/dev/null; echo ""; echo "$CRON_COMMENT"; echo "$CRON_JOB") | crontab -

echo "   ✓ Cron configuré: Backup toutes les 30 minutes"
echo "   ✓ Log: /var/log/pharma-backup.log"
echo ""

# Créer le fichier log
if [ "$EUID" -eq 0 ]; then
    touch /var/log/pharma-backup.log
    chmod 644 /var/log/pharma-backup.log
fi

# Test initial
echo "6. Test initial du backup..."
echo ""
if docker ps | grep -q "fullstack_produits-postgres-1\|postgres"; then
    bash "$SCRIPT_PATH"
else
    echo "⚠️  PostgreSQL non démarré - test ignoré"
    echo "   Démarrez les containers et relancez:"
    echo "   bash $SCRIPT_PATH"
fi

echo ""
echo "=== ✅ SETUP TERMINÉ ==="
echo ""
echo "─────────────────────────────────────────────────────"
echo "Commandes disponibles:"
echo ""
echo "  📦 Backup manuel:"
echo "    sudo bash $SCRIPT_PATH"
echo ""
echo "  🔄 Restauration intelligente:"
echo "    sudo bash $PROJECT_DIR/scripts/restore-smart.sh <date_backup> [heure_max]"
echo ""
echo "  📋 Exemple restauration:"
echo "    sudo bash $PROJECT_DIR/scripts/restore-smart.sh 20240609_130000 180000"
echo ""
echo "  🔍 Vérifier les backups:"
echo "    ls -lth /backup/incremental/*.sql.gz | head -10"
echo ""
echo "  📊 Voir les logs:"
echo "    tail -f /var/log/pharma-backup.log"
echo ""
echo "  ⏰ Cron actif:"
echo "    crontab -l | grep pharma-backup"
echo ""
echo "─────────────────────────────────────────────────────"
echo ""
echo "Prochain backup automatique dans 30 minutes."
echo ""
