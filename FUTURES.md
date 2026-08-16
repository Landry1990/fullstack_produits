# Fonctionnalités futures / Pistes d'évolution

> Ce fichier sert de bac à sable pour les idées à creuser et implémenter plus tard.
> Chaque entrée doit être suffisamment détaillée pour pouvoir être reprise sans perdre le contexte.

---

## Serveur auxiliaire (haute disponibilité / failover automatique)

**Date d'idéation :** 2026-08-16

**Auteur :** User

### Besoin
Disposer d'un serveur auxiliaire dans le réseau local de la pharmacie qui prend le relais automatiquement en cas de perte du serveur principal, puis reconstitue / resynchronise les données une fois le serveur principal de retour.

### Objectifs
- Basculement automatique (failover) si le serveur principal tombe.
- Le serveur auxiliaire devient le primary temporaire.
- Une fois le principal de retour, bascule inverse et resynchronisation des données.
- Continuité de la caisse et des ventes pendant la panne.

### Pistes techniques
- PostgreSQL **streaming replication** (replica hot-standby).
- Promotion via `pg_promote()`.
- Surveillance + switch automatique (`repmgr`, `pg_auto_failover` ou script maison).
- VIP flottante avec **Keepalived** / **HAProxy** pour diriger le frontend/backend sans modification du client.
- Gestion du **split-brain** (quorum, witness, timeout conservateur).

### Points de vigilance
- Matériel secondaire à installer chez le client (mini-PC, NAS, poste secondaire).
- Nécessité d'un LAN stable, idéalement lien dédié principal ↔ auxiliaire.
- Resynchronisation : un primary repassé en secondary nécessite un `pg_basebackup` / `pg_rewind`.
- Ne pas remplacer le système PITR/WAL déjà en place, mais le compléter.

### Statut
Idée en discussion. À revenir pour un **POC minimal** en test interne.

