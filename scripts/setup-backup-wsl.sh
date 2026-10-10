#!/bin/bash
# Setup du backup pour WSL (Windows Subsystem for Linux)

set -e

echo "=== SETUP BACKUP - WSL (Windows) ==="
echo ""

# Vérifier qu'on est dans WSL
if [[ ! -f /proc/version ]] || [[ ! $(cat /proc/version) =~ Microsoft|WSL ]]; then
    echo "⚠️  Ce script est conçu pour WSL (Windows Subsystem for Linux)"
    echo ""
    read -p "Continuer quand même? (o/N): " choice
    if [[ ! $choice =~ ^[Oo]$ ]]; then
        exit 1
    fi
fi

echo "🐧 Environnement WSL détecté"
echo ""

# Créer les dossiers sur le disque C:
echo "1. Création des dossiers de backup sur C:\\..."
mkdir -p /mnt/c/backup/incremental
mkdir -p /mnt/c/backup/full
echo "   ✓ C:\backup\incremental"
echo "   ✓ C:\backup\full"
echo ""

# Obtenir le chemin du projet
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WINDOWS_PROJECT_DIR=$(wslpath -w "$PROJECT_DIR" 2>/dev/null || echo "$PROJECT_DIR")

echo "2. Répertoire du projet:"
echo "   Linux: $PROJECT_DIR"
echo "   Windows: $WINDOWS_PROJECT_DIR"
echo ""

# Rendre les scripts exécutables
echo "3. Configuration des permissions..."
chmod +x "$PROJECT_DIR/scripts/backup-incremental-wsl.sh"
chmod +x "$PROJECT_DIR/scripts/restore-smart-wsl.sh"
echo "   ✓ Scripts prêts"
echo ""

# Vérifier Docker
echo "4. Vérification Docker Desktop + WSL..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas accessible depuis WSL"
    echo ""
    echo "Solution:"
    echo "1. Ouvrir Docker Desktop"
    echo "2. Settings → Resources → WSL Integration"
    echo "3. Activer l'intégration pour votre distro WSL"
    echo "4. Redémarrer Docker Desktop"
    exit 1
fi

if ! docker ps &> /dev/null; then
    echo "❌ Docker ne répond pas"
    echo "   Assurez-vous que Docker Desktop est démarré"
    exit 1
fi

echo "   ✓ Docker OK"

# Vérifier le container postgres
CONTAINER=$(docker ps --format "{{.Names}}" | grep -i postgres | head -1)
if [ -n "$CONTAINER" ]; then
    echo "   ✓ Container PostgreSQL trouvé: $CONTAINER"
else
    echo "⚠️  Container PostgreSQL non trouvé"
    echo "   Containers actifs:"
    docker ps --format "   - {{.Names}}" | head -5
fi
echo ""

# Test initial
echo "5. Test initial du backup..."
echo ""
if [ -n "$CONTAINER" ]; then
    bash "$PROJECT_DIR/scripts/backup-incremental-wsl.sh"
else
    echo "⚠️  Test ignoré (PostgreSQL non démarré)"
    echo "   Démarrez Docker et relancez:"
    echo "   bash $PROJECT_DIR/scripts/backup-incremental-wsl.sh"
fi

echo ""
echo "=== ✅ SETUP TERMINÉ ==="
echo ""
echo "─────────────────────────────────────────────────────"
echo ""
echo "📋 Configuration automatique:"
echo ""
echo "Le backup automatique nécessite Task Scheduler Windows:"
echo ""
echo "1. Ouvrir Task Scheduler (Windows):"
echo "   Win + R → taskschd.msc"
echo ""
echo "2. Créer une nouvelle tâche:"
echo "   - Nom: 'Pharma Backup WSL'"
echo "   - Déclencheur: Toutes les 30 minutes"
echo "   - Action: Démarrer un programme"
echo "   - Programme: wsl.exe"
echo "   - Arguments: -d Ubuntu -e bash /mnt/c/Projet\\ Fullstack/fullstack_produits/scripts/backup-incremental-wsl.sh"
echo ""
echo "3. Cocher: 'Exécuter même si utilisateur déconnecté'"
echo ""
echo "─────────────────────────────────────────────────────"
echo ""
echo "🖥️  Commandes manuelles:"
echo ""
echo "  Backup immédiat:"
echo "    wsl -d Ubuntu -e bash \"/mnt/c/Projet Fullstack/fullstack_produits/scripts/backup-incremental-wsl.sh\""
echo ""
echo "  Restauration:"
echo "    wsl -d Ubuntu -e bash \"/mnt/c/Projet Fullstack/fullstack_produits/scripts/restore-smart-wsl.sh\" 20240609_130000"
echo ""
echo "  Voir les backups Windows:"
echo "    dir C:\\backup\\incremental"
echo ""
echo "─────────────────────────────────────────────────────"
echo ""
echo "💡 Astuce: Les backups sont stockés sur C:\\ donc accessibles"
echo "   depuis Windows même si WSL est éteint."
echo ""
