#!/bin/bash
# Postgres init script — exécuté automatiquement par postgres:15-alpine
# avant le démarrage (entrypoint officiel).

set -e

# SÉCURITÉ : les anciennes règles ci-dessous ont été retirées.
#   host replication all 0.0.0.0/0 trust
#   host replication all ::/0      trust
# 'trust' permettait à TOUTE machine pouvant joindre le port 5432 de se
# connecter en réplication sans mot de passe (dump complet de la base).
# Si la réplication est nécessaire un jour, utiliser scram-sha-256 avec un
# utilisateur dédié et un réseau restreint, ex :
#   host replication replicator 172.18.0.0/16 scram-sha-256

# Exécuter l'entrypoint original de PostgreSQL (gère le passage à l'utilisateur postgres)
exec /usr/local/bin/docker-entrypoint.sh "$@"
