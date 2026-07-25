#!/bin/bash
# Détecte le nombre de CPUs et configure les limites Docker automatiquement
# Usage: ./setup-cpu.sh [path/to/.env]

ENV_FILE="${1:-.env}"
CPUS=$(nproc)

echo "CPUs détectés: $CPUS"

if [ "$CPUS" -ge 8 ]; then
    # Machine puissante (8+ CPUs)
    DB_CPUS=2.0
    BACKEND_CPUS=4.0
    REDIS_CPUS=1.0
elif [ "$CPUS" -ge 4 ]; then
    # Machine standard (4-7 CPUs)
    DB_CPUS=2.0
    BACKEND_CPUS=3.0
    REDIS_CPUS=0.5
elif [ "$CPUS" -ge 2 ]; then
    # Machine légère (2-3 CPUs)
    DB_CPUS=1.0
    BACKEND_CPUS=1.5
    REDIS_CPUS=0.5
else
    # Machine très légère (1 CPU)
    DB_CPUS=0.5
    BACKEND_CPUS=0.5
    REDIS_CPUS=0.25
fi

echo "Configuration CPU:"
echo "  DB_CPUS=$DB_CPUS"
echo "  BACKEND_CPUS=$BACKEND_CPUS"
echo "  REDIS_CPUS=$REDIS_CPUS"

# Ajoute ou met à jour les variables dans le .env
touch "$ENV_FILE"
for var in DB_CPUS BACKEND_CPUS REDIS_CPUS; do
    val=$(eval echo "\$$var")
    if grep -q "^${var}=" "$ENV_FILE" 2>/dev/null; then
        sed -i "s/^${var}=.*/${var}=${val}/" "$ENV_FILE"
    else
        echo "${var}=${val}" >> "$ENV_FILE"
    fi
done

echo "Variables écrites dans $ENV_FILE"
