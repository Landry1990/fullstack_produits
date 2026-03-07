#!/bin/bash

# Script pour déployer une nouvelle instance de pharmacie
# Usage: ./deploy_client.sh <nom_client> <port_externe>

CLIENT_NAME=$1
PORT=$2

if [ -z "$CLIENT_NAME" ] || [ -z "$PORT" ]; then
    echo "Usage: $0 <nom_client> <port_externe>"
    echo "Exemple: $0 pharmacie_viva 8081"
    exit 1
fi

# Nettoyer le nom du client (minuscules, pas d'espaces)
STACK_NAME=$(echo "$CLIENT_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '_')
ENV_FILE=".env.$STACK_NAME"

echo "🛠️ Préparation du déploiement pour : $STACK_NAME sur le port $PORT"

# 1. Créer le fichier .env spécifique s'il n'existe pas
if [ ! -f "$ENV_FILE" ]; then
    echo "📝 Création du fichier de configuration $ENV_FILE..."
    cat > "$ENV_FILE" <<EOF
STACK_NAME=$STACK_NAME
FRONTEND_PORT=$PORT
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=$(openssl rand -base64 32)
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,$STACK_NAME.pharmacie.com
DB_NAME=${STACK_NAME}_db
DB_USER=admin_$STACK_NAME
DB_PASSWORD=$(openssl rand -base64 12)
EOF
else
    echo "ℹ️ Le fichier $ENV_FILE existe déjà. Utilisation de la config existante."
fi

# 2. Lancer la pile Docker avec un nom de projet unique
echo "🚀 Lancement des conteneurs pour $STACK_NAME..."
docker compose -f docker-compose.prod.yml -p "$STACK_NAME" --env-file "$ENV_FILE" up -d --build

echo "✅ Déploiement terminé !"
echo "🌐 L'instance est accessible sur : http://localhost:$PORT"
echo "📜 Pour voir les journaux : docker compose -p $STACK_NAME logs -f"
