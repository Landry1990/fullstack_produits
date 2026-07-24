#!/bin/bash
# Postgres init script — ajoute la règle replication pour le réseau Docker
# Exécuté automatiquement par postgres:15-alpine avant le démarrage

set -e

PG_HBA="$PGDATA/pg_hba.conf"

# Ajouter la règle replication pour le réseau Docker si absente
if [ -f "$PG_HBA" ]; then
    if ! grep -q "host.*replication.*all.*0.0.0.0/0" "$PG_HBA"; then
        echo "host replication all 0.0.0.0/0 trust" >> "$PG_HBA"
    fi
    if ! grep -q "host.*replication.*all.*::/0" "$PG_HBA"; then
        echo "host replication all ::/0 trust" >> "$PG_HBA"
    fi
fi

# Exécuter l'entrypoint original de PostgreSQL
exec "$@"
