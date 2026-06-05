# 🔧 Guide de Rebuild Sécurisé - Docker Compose

## ⚠️ AVANT TOUT : Ne jamais faire `docker compose up -d --build` directement !

Ce projet utilise maintenant un **dossier local persistant** (`postgres_data/`) pour stocker la base de données. Contrairement à un volume Docker, ce dossier reste même si les conteneurs sont supprimés.

Cependant, le rebuild complet (`--build`) recrée les images et les conteneurs. Si quelque chose tourne mal, la base peut être perdue.

## ✅ La bonne méthode : Rebuild Sécurisé

### Sur Windows (PowerShell)

```powershell
# Ouvrir PowerShell dans le dossier du projet
cd "C:\Projet Fullstack\fullstack_produits"

# Lancer le rebuild sécurisé (backup auto + build + up)
.\safe-rebuild.ps1
```

### Sur Linux / Mac

```bash
cd /chemin/vers/fullstack_produits
chmod +x safe-rebuild.sh
./safe-rebuild.sh
```

## 🛡️ Ce que fait le script

| Étape | Action | Pourquoi |
|---|---|---|
| 1 | Vérifie que la base tourne | Évite le backup d'un conteneur arrêté |
| 2 | **Backup automatique** dans `backups/backup-YYYYMMDD-HHMMSS.sql` | Sauvegarde de secours avant toute opération |
| 3 | Lance `docker compose up -d --build` | Rebuild des images + redémarrage |
| 4 | Vérifie que tout est UP | Confirme que backend, frontend et DB marchent |

## 📂 Structure du projet

```
fullstack_produits/
├── docker-compose.yml         ← Config Docker (DB, Backend, Frontend)
├── postgres_data/             ← 🔒 BASE DE DONNEES PERSISTANTE (ne pas supprimer !)
├── backups/
│   ├── backup-20260604-094302.sql   ← Sauvegardes SQL
│   └── backup-20260604-094302.sql.md5 ← Checksums MD5
├── safe-rebuild.ps1          ← Script sécurisé Windows
├── safe-rebuild.sh           ← Script sécurisé Linux/Mac
└── README-REBUILD.md         ← Ce fichier
```

## 🚨 Interdictions absolues

| Commande | Danger |
|---|---|
| `docker compose down -v` | Supprime les volumes (supprime la base si pas encore migrée vers bind mount) |
| `docker volume prune` | Supprime TOUS les volumes orphelins, y compris ceux avec données |
| `docker compose up -d --build` seul | Pas de backup, pas de sécurité |
| `rm -rf postgres_data/` | Supprime toutes les données à jamais (pas de récupération) |

## 🔁 Restaurer un backup

Si le rebuild a causé un problème :

```powershell
# 1. Arrêter les conteneurs
docker compose down

# 2. Restaurer le backup le plus récent (remplacez par le vrai nom de fichier)
Get-Content backups\backup-20260604-094302.sql | docker exec -i fullstack_produits-db-1 psql -U fullstack_user -d fullstack_db

# 3. Redémarrer
docker compose up -d
```

## 📞 Support

Si tu vois des erreurs lors du rebuild :
1. Vérifier le fichier de backup dans `backups/`
2. Vérifier que `postgres_data/` existe et n'est pas vide
3. Consulter les logs : `docker compose logs db` ou `docker compose logs backend`
