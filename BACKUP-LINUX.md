# 🛡️ Système de Backup Incrémental - Linux Server

## ✅ Solution : Backup toutes les 30 minutes via Cron

**Architecture** : Linux natif + Docker + PostgreSQL + Cron

---

## 📦 Installation rapide

### 1. Sur le serveur Linux, clonez le projet :
```bash
cd /opt
sudo git clone https://github.com/votre-repo/pharma-gestion.git
# ou copiez via SCP/FTP
```

### 2. Lancer le setup :
```bash
cd /opt/pharma-gestion
sudo bash scripts/setup-backup-linux.sh
```

**Le setup configure automatiquement** :
- ✅ Dossiers `/backup/incremental` et `/backup/full`
- ✅ Cron job (toutes les 30 minutes)
- ✅ Permissions
- ✅ Log `/var/log/pharma-backup.log`
- ✅ Test initial

---

## 🔄 Architecture du backup

```
Serveur Linux
├── Docker
│   ├── fullstack_produits-postgres-1  ← Backup depuis ici
│   └── fullstack_produits-backend-1
│
├── Cron (toutes les 30 min)
│   └── backup-incremental-linux.sh
│       └── /backup/incremental/*.sql.gz
│
└── /backup/
    ├── incremental/     ← Backups fréquents (48h rétention)
    └── full/            ← Backups complets (à vous de les gérer)
```

---

## 📋 Commandes essentielles

### **Backup manuel (maintenant)**
```bash
sudo bash /opt/pharma-gestion/scripts/backup-incremental-linux.sh
```

### **Restauration intelligente**
```bash
# Scénario: Crash à 18h, dernier backup complet à 13h
# Restaurer 13h + tous les incrémentaux jusqu'à 17h30

sudo bash /opt/pharma-gestion/scripts/restore-smart.sh 20240609_130000 173000
```

### **Voir les backups**
```bash
# Lister les 10 derniers backups
ls -lth /backup/incremental/*.sql.gz | head -10

# Taille totale
du -sh /backup/incremental
```

### **Voir les logs**
```bash
# Logs en temps réel
tail -f /var/log/pharma-backup.log

# Dernier backup
grep "Backup incrémental" /var/log/pharma-backup.log | tail -5
```

### **Gérer le cron**
```bash
# Voir la configuration
crontab -l

# Désactiver temporairement
sudo crontab -l | grep -v "pharma-backup" | sudo crontab -

# Réactiver (relancer setup)
sudo bash /opt/pharma-gestion/scripts/setup-backup-linux.sh
```

---

## 🆘 Scénario de crise

### **Situation** : Crash à 18h00, base corrompue

```bash
# 1. Se connecter au serveur
ssh user@serveur-pharma

# 2. Lister les backups disponibles
ls -lth /backup/incremental/*.sql.gz | head -20

# 3. Trouver le dernier backup complet avant le crash
# (à vous de faire des backups complets quotidiens avec pg_dumpall)
ls -lth /backup/full/*.sql.gz

# 4. Restaurer
sudo bash /opt/pharma-gestion/scripts/restore-smart.sh \
    20240609_080000   # Backup complet 8h \
    180000            # Jusqu'à 18h (crash)

# 5. Vérifier
sudo docker exec fullstack_produits-postgres-1 psql -U postgres -d pharma_db -c "
    SELECT COUNT(*) as ventes, MAX(date) as derniere FROM api_facture;
"
```

**Résultat** : 
- ✅ Backup 08h00 restauré
- ✅ + 20 backups incrémentaux (08h30 → 17h30)
- ✅ **Perte max** : 30 minutes (17h30 → 18h00)
- ✅ **Au lieu de** : 10 heures perdues !

---

## 💾 Script de backup complet quotidien

**À ajouter au cron** pour les backups complets (structure + données) :

```bash
# /etc/cron.d/pharma-backup-full
# Tous les jours à 2h du matin
0 2 * * * root /opt/pharma-gestion/scripts/backup-full-linux.sh
```

**backup-full-linux.sh** :
```bash
#!/bin/bash
BACKUP_DIR="/backup/full"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONTAINER="fullstack_produits-postgres-1"

mkdir -p "$BACKUP_DIR"

docker exec "$CONTAINER" pg_dumpall -U postgres | gzip > "$BACKUP_DIR/full_${TIMESTAMP}.sql.gz"

# Rétention 7 jours
find "$BACKUP_DIR" -name "full_*.sql.gz" -mtime +7 -delete
```

---

## 🔍 Monitoring

### **Vérifier que le backup fonctionne**
```bash
# Test manuel
sudo bash /opt/pharma-gestion/scripts/backup-incremental-linux.sh

# Vérifier les fichiers créés
ls -lh /backup/incremental/$(date +%Y%m%d)*_api_facture.sql.gz

# Taille > 0 ?
find /backup/incremental -name "$(date +%Y%m%d)*_api_facture.sql.gz" -size +0
```

### **Alerte si backup échoue**
```bash
# Ajouter à la fin du script backup-incremental-linux.sh :
if [ ! -f "/backup/incremental/${TIMESTAMP}_api_facture.sql.gz" ]; then
    echo "ERREUR BACKUP" | mail -s "Pharma Backup Failed" admin@pharma.com
    # ou webhook Slack/Teams
fi
```

---

## 📊 Espace disque estimé

| Type | Fréquence | Taille/backup | Rétention | Total |
|------|-----------|---------------|-----------|-------|
| Incrémental | 30 min | ~100 KB | 48h | ~5 MB |
| Complet | Quotidien | ~50 MB | 7 jours | ~350 MB |
| **Total** | - | - | - | **~400 MB** |

**Conseil** : Montez un volume dédié `/backup` de 10 GB minimum.

---

## 🔐 Sécurité

### **Permissions**
```bash
# Seul root doit pouvoir lire les backups
chmod 700 /backup
chmod 600 /backup/incremental/*.sql.gz

# Logs lisibles par tous
chmod 644 /var/log/pharma-backup.log
```

### **Chiffrement (optionnel)**
```bash
# Backup chiffré avec GPG
gpg -c --cipher-algo AES256 backup.sql
# Déchiffrement
gpg -d backup.sql.gpg
```

### **Sync vers S3 (optionnel)**
```bash
# Installer AWS CLI
aws s3 sync /backup/incremental s3://pharma-backups/incremental/
aws s3 sync /backup/full s3://pharma-backups/full/
```

---

## ✅ Checklist mise en production

- [ ] Disque `/backup` monté avec 10 GB+
- [ ] Setup lancé : `sudo bash scripts/setup-backup-linux.sh`
- [ ] Test backup manuel réussi
- [ ] Vérifier cron actif : `crontab -l | grep pharma`
- [ ] Test restauration sur base de test
- [ ] Documenter le process dans le runbook
- [ ] Configurer monitoring/alertes

---

## 📞 Support

**Si le backup échoue** :
```bash
# 1. Vérifier Docker
docker ps | grep postgres

# 2. Vérifier logs
tail -20 /var/log/pharma-backup.log

# 3. Test manuel
docker exec fullstack_produits-postgres-1 pg_dump -U postgres -d pharma_db --table=api_facture
```

**Problèmes courants** :
- Container non trouvé → Vérifier le nom avec `docker ps`
- Permission denied → Lancer avec `sudo`
- Espace disque → Nettoyer avec `find /backup -mtime +2 -delete`

---

## 🎯 Résumé

| Caractéristique | Valeur |
|-----------------|--------|
| **Fréquence** | Toutes les 30 minutes |
| **Perte max** | 30 minutes de données |
| **Rétention** | 48 heures |
| **Automatisation** | Cron |
| **Restauration** | Une commande |
| **Espace** | ~5 MB |
| **Complexité** | ⭐ Facile |

**Vos données sont sécurisées !** 🛡️
