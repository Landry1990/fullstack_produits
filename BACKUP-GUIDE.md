# 📋 Guide Backup - WSL & Linux

## ✅ Compatibilité

| Environnement | Statut | Chemin des backups |
|--------------|--------|-------------------|
| **WSL (Windows)** | ✅ Fonctionne | `C:\backup\` (accessible Windows) |
| **Linux natif** | ✅ Fonctionne | `/backup/` (standard Linux) |
| **MacOS** | ✅ Devrait fonctionner | `/backup/` |

---

## 🚀 Utilisation rapide

### 1. Backup manuel (marche partout)

```bash
# Allez dans le dossier du projet
cd /chemin/vers/fullstack_produits

# Lancez le backup universel
bash scripts/backup-universal.sh
```

**Résultat** :
- Détecte automatiquement WSL ou Linux
- Sauvegarde dans le bon dossier
- Affiche le résumé

---

### 2. Restauration (marche partout)

```bash
# Restaurer backup du 9 juin 13h + tous les incrémentaux
bash scripts/restore-universal.sh 20240609_130000

# Restaurer jusqu'à une heure spécifique (crash à 18h)
bash scripts/restore-universal.sh 20240609_130000 180000
```

---

## 🐧 Différences WSL vs Linux

### WSL (Votre cas actuel)

```
Docker Desktop (Windows)
    ↓
WSL2 (Ubuntu/Debian)
    ↓
Backup stocké sur C:\backup\  ← Visible depuis Windows
```

**Avantages** :
- ✅ Backups accessibles depuis Windows Explorer
- ✅ Persiste même si WSL crash
- ✅ Facile à copier sur clé USB

### Linux natif (Serveur de production)

```
Docker (Linux natif)
    ↓
Backup stocké sur /backup/  ← Standard Linux
```

**Avantages** :
- ✅ Plus performant
- ✅ Cron natif fiable
- ✅ Permissions Linux standard

---

## ⚙️ Configuration automatique

### Option A: WSL + Task Scheduler Windows

```powershell
# 1. Ouvrir Task Scheduler (Windows)
taskschd.msc

# 2. Créer une tâche
Nom: Pharma Backup
Déclencheur: Toutes les 30 minutes
Action: wsl.exe -d Ubuntu -e bash /mnt/c/Projet\ Fullstack/fullstack_produits/scripts/backup-universal.sh
```

### Option B: Linux natif + Cron

```bash
# 1. Éditer le crontab
crontab -e

# 2. Ajouter cette ligne
*/30 * * * * /opt/pharma-gestion/scripts/backup-universal.sh >> /var/log/backup.log 2>&1
```

---

## 📁 Structure des dossiers

### Sur WSL (Windows)

```
C:\backup\
├── incremental\
│   ├── 20240609_130000_api_facture.sql.gz
│   ├── 20240609_130000_api_lignefacture.sql.gz
│   └── ...
└── full\
    └── full_20240609_080000.sql.gz
```

### Sur Linux natif

```
/backup/
├── incremental/
│   └── ...
└── full/
    └── ...
```

---

## 🔍 Vérification

### Sur WSL

```powershell
# Voir les backups depuis Windows
ls C:\backup\incremental

# Voir depuis WSL
wsl ls /mnt/c/backup/incremental
```

### Sur Linux

```bash
# Voir les backups
ls -lh /backup/incremental

# Taille totale
du -sh /backup
```

---

## 🆘 En cas de migration WSL → Linux

Si vous passez de WSL à Linux natif :

```bash
# 1. Copier les backups existants
cp -r /mnt/c/backup/* /backup/

# 2. Changer les permissions
chown -R root:root /backup
chmod -R 755 /backup

# 3. Le script détecte auto Linux et utilise /backup/
bash scripts/backup-universal.sh
```

---

## ✅ Checklist avant mise en prod

| Vérification | WSL | Linux |
|-------------|-----|-------|
| Docker fonctionne | `docker ps` | `docker ps` |
| Container PostgreSQL | ✅ | ✅ |
| Dossiers créés | `C:\backup\` | `/backup/` |
| Script exécutable | ✅ | ✅ |
| Automatisation | Task Scheduler | Cron |
| Test restauration | ✅ | ✅ |

---

## 💡 Résumé

**Le script `backup-universal.sh` détecte automatiquement votre environnement** et s'adapte :

- **WSL** → Backup sur `C:\backup\` (visible Windows)
- **Linux** → Backup sur `/backup/` (standard)

**Pas besoin de modifier quoi que ce soit** quand vous migrerez de WSL vers Linux ! 🎉
