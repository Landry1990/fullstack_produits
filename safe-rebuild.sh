#!/usr/bin/env bash
# safe-rebuild.sh
# Rebuild Docker Compose avec backup automatique de la DB avant rebuild
# Usage: ./safe-rebuild.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$SCRIPT_DIR/backups/backup-${TIMESTAMP}.sql"

echo "========================================"
echo "  SAFE REBUILD - Backup + Build + Up"
echo "========================================"
echo ""

# 1. Verifier que la DB est accessible
echo "[1/4] Verification de la base de donnees..."
if ! docker inspect --format='{{.State.Running}}' fullstack_produits-db-1 2>/dev/null | grep -q "true"; then
    echo "   Conteneur DB non demarre. Demarrage..."
    docker compose up -d db
    sleep 5
else
    echo "   Conteneur DB actif"
fi

# 2. Backup automatique
echo "[2/4] Backup automatique de la base..."
mkdir -p "$SCRIPT_DIR/backups"
if docker exec fullstack_produits-db-1 pg_dump -U fullstack_user -d fullstack_db --no-owner --no-privileges > "$BACKUP_FILE" 2>/dev/null; then
    SIZE_MB=$(du -m "$BACKUP_FILE" | cut -f1)
    echo "   Backup OK: $BACKUP_FILE (${SIZE_MB} MB)"
else
    echo "   Backup echoue. Arret du rebuild pour securite."
    rm -f "$BACKUP_FILE"
    exit 1
fi

# 3. Rebuild + Up
echo "[3/4] Rebuild des conteneurs..."
cd "$SCRIPT_DIR"
docker compose up -d --build

# 4. Verification
echo "[4/4] Verification..."
sleep 3
if docker ps -q -f name=fullstack_produits-backend-1 >/dev/null && \
   docker ps -q -f name=fullstack_produits-frontend-1 >/dev/null && \
   docker ps -q -f name=fullstack_produits-db-1 >/dev/null; then
    echo ""
    echo "Tous les services sont UP"
    echo "   Backend : http://localhost:8000"
    echo "   Frontend: http://localhost"
else
    echo ""
    echo "Certains services ne sont pas demarres"
fi

echo ""
echo "Backup sauvegarde dans: $BACKUP_FILE"
echo "Commande pour restaurer:"
echo "   cat $BACKUP_FILE | docker exec -i fullstack_produits-db-1 psql -U fullstack_user -d fullstack_db"
