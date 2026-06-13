# 💾 Backup & Restauration

## 🚨 Criticité : CAPITALE

Les données de votre pharmacie (ventes, stocks, clients) sont **irremplaçables**. Une sauvegarde régulière est **obligatoire**.

---

## 📋 Stratégie de Backup

| Type | Fréquence | Rétention | Tables | Usage |
|------|-----------|-----------|--------|-------|
| **Incrémental** | Toutes les 30 min | 48 heures | Critiques (ventes, stocks) | Récupération rapide |
| **Complet** | Quotidien | 7 jours | Toutes | Restauration totale |

---

## 🛠️ Scripts de Backup

### Windows (PowerShell)

```powershell
# Backup manuel
.\scripts\backup-incremental.ps1

# Backup universel (détecte WSL/Linux)
bash scripts/backup-universal.sh
```

### Linux / WSL (Bash)

```bash
# Backup incrémental
bash scripts/backup-incremental.sh

# Backup complet
bash scripts/backup-full.sh

# Universel (recommandé)
bash scripts/backup-universal.sh
```

---

## 📁 Emplacement des Backups

### Windows
```
C:\backup\
├── incremental\          # Backups toutes les 30 min
│   ├── 20240609_120000_api_facture.sql.zip
│   ├── 20240609_120000_api_lignefacture.sql.zip
│   └── ...
└── full\                 # Backups quotidiens
    └── full_20240609_080000.sql.gz
```

### Linux
```
/backup/
├── incremental/
│   └── ...
└── full/
    └── ...
```

---

## ⚙️ Automatisation

### Windows - Task Scheduler

```powershell
# 1. Ouvrir Task Scheduler (taskshed.msc)

# 2. Créer une tâche
Nom: Pharma Backup Incrémental
Déclencheur: Toutes les 30 minutes
Action: Démarrer un programme
Programme: PowerShell
Arguments: -File "C:\Projet Fullstack\fullstack_produits\scripts\backup-incremental.ps1"

# 3. Cocher "Exécuter même si utilisateur non connecté"
```

### Linux - Cron

```bash
# Éditer crontab
sudo crontab -e

# Ajouter ligne pour backup toutes les 30 minutes
*/30 * * * * /opt/pharma-gestion/scripts/backup-incremental.sh >> /var/log/backup.log 2>&1

# Vérifier
sudo crontab -l
```

---

## 🔄 Procédure de Restauration

### Restauration Incrémentale (Point dans le temps)

```bash
# Restaurer jusqu'à une heure spécifique (ex: 18h)
bash scripts/restore-universal.sh 20240609_120000 180000

# Restaurer tous les incrémentaux depuis le complet
bash scripts/restore-universal.sh 20240609_120000
```

### Restauration Complète (Urgence)

```bash
# 1. Arrêter les services
docker compose down

# 2. Restaurer le backup complet
docker exec -i fullstack_produits-db-1 psql -U postgres -d pharma_db < backup_full.sql

# 3. Redémarrer
docker compose up -d
```

### Windows - PowerShell

```powershell
# Restauration depuis un backup complet
$container = "fullstack_produits-postgres-1"
$backup = "C:\backup\full\full_20240609_080000.sql.gz"

# Décompresser et restaurer
gunzip -c $backup | docker exec -i $container psql -U postgres -d pharma_db
```

---

## ✅ Checklist Backup

### Avant mise en production

- [ ] Dossier `C:\backup\` créé (Windows) ou `/backup/` (Linux)
- [ ] Test backup manuel réussi
- [ ] Test restauration réussi (sur base test)
- [ ] Task Scheduler / Cron configuré
- [ ] Notification en cas d'échec configurée (optionnel)
- [ ] Backup cloud secondaire configuré (optionnel)

### Maintenance hebdomadaire

- [ ] Vérifier espace disque backup
- [ ] Vérifier derniers backups créés
- [ ] Tester un fichier backup (intégrité)

---

## 🔍 Vérification

### Vérifier les backups existants

```powershell
# Windows PowerShell
Get-ChildItem "C:\backup\incremental\*.zip" | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object -First 10 Name, LastWriteTime, @{Name="SizeKB";Expression={[math]::Round($_.Length/1KB,1)}}
```

```bash
# Linux/WSL
ls -lh /backup/incremental/*.zip | head -10
du -sh /backup/
```

### Vérifier intégrité

```bash
# Tester un fichier zip
unzip -t 20240609_120000_api_facture.sql.zip

# Vérifier contenu SQL
zcat 20240609_120000_api_facture.sql.zip | head -20
```

---

## 🆘 Scénarios de Récupération

### Scénario 1 : Crash PC (Base intacte)

```bash
# Redémarrer simplement
docker compose up -d
```

### Scénario 2 : Corruption données (Hier)

```bash
# Restaurer backup complet d'hier + incrémentaux
bash scripts/restore-universal.sh 20240608_080000
```

### Scénario 3 : Corruption données (Aujourd'hui 14h)

```bash
# Restaurer jusqu'à 13h (avant le problème)
bash scripts/restore-universal.sh 20240609_080000 130000
```

### Scénario 4 : Base totalement perdue

```bash
# 1. Recréer les volumes
docker compose down -v  # ATTENTION: supprime tout
docker compose up -d db

# 2. Attendre que PostgreSQL soit prêt
sleep 10

# 3. Restaurer le dernier backup complet
docker exec -i fullstack_produits-db-1 psql -U postgres < /backup/full/full_20240609_080000.sql

# 4. Appliquer les incrémentaux
for f in /backup/incremental/20240609_*.sql; do
    docker exec -i fullstack_produits-db-1 psql -U postgres < $f
done
```

---

## 📊 Tables Sauvegardées (Priorité)

### CRITIQUE (sauvegardées toutes les 30 min)

| Table | Description | Impact si perdu |
|-------|-------------|-----------------|
| `api_facture` | Tickets de caisse | **IRREMPLAÇABLE** |
| `api_lignefacture` | Lignes de vente | **IRREMPLAÇABLE** |
| `api_sessionticket` | Sessions tickets | Moyen |
| `api_mouvementstock` | Mouvements stock | Important |
| `api_ecriture` | Écritures comptables | **LÉGAL** |
| `api_operation` | Opérations compta | **LÉGAL** |
| `api_journalcaisse` | Journal caisse | **LÉGAL** |
| `api_sessioncaisse` | Sessions caisse | Moyen |
| `api_paiement` | Paiements | Important |

### IMPORTANT (backup quotidien)

| Table | Description |
|-------|-------------|
| `api_produit` | Catalogue produits |
| `api_client` | Clients |
| `api_fournisseur` | Fournisseurs |
| `api_commande` | Commandes fournisseurs |

---

## ⚠️ Points d'Attention

### À NE JAMAIS FAIRE

❌ Supprimer `postgres_data/` sans backup  
❌ Modifier les fichiers de backup manuellement  
❌ Couper le PC pendant un backup  
❌ Ignorer les erreurs de backup

### À FAIRE RÉGULIÈREMENT

✅ Tester la restauration (1x/mois minimum)  
✅ Vérifier l'espace disque  
✅ Archiver les backups anciens (cloud)  
✅ Documenter les procédures de récupération

---

## 🔗 Ressources

- [BACKUP-GUIDE.md](../../BACKUP-GUIDE.md) - Guide détaillé WSL/Linux
- [README-REBUILD.md](../../README-REBUILD.md) - Reconstruction complète
- `scripts/restore-smart.sh` - Restauration intelligente

---

**Contact support** : Vérifier [MAINTENANCE.md](MAINTENANCE.md#emergency) pour procédures d'urgence
