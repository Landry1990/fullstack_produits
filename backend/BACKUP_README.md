# Database Backup System

## Overview
Automated PostgreSQL backup system with compression, rotation, and optional key reorganization.

## Setup Instructions

### Prerequisites
- PostgreSQL `pg_dump` must be in system PATH
- Ensure database credentials in `backend/backend/settings.py` are correct

### Manual Backup
```bash
cd backend
python manage.py backup_database
```

This will create a compressed backup in `backend/backups/backup_YYYYMMDD_HHMMSS.sql.gz`

### Backup + Réorganisation des Clés
```bash
# Voir le plan (sans modifier la base)
python manage.py backup_and_reorg --dry-run

# Exécuter backup + réorganisation
python manage.py backup_and_reorg --confirm

# Réorganiser sans backup (si déjà fait manuellement)
python manage.py backup_and_reorg --confirm --skip-backup
```

**Que fait la réorganisation ?**
- Remet les IDs de toutes les tables transactionnelles en séquence continue (1, 2, 3...)
- Met à jour automatiquement toutes les clés étrangères (FK)
- Réinitialise les séquences PostgreSQL
- Tout s'exécute dans une transaction atomique (rollback en cas d'erreur)

### Automated Daily Backups (Windows)

#### Option 1: Windows Task Scheduler (Recommended)
1. Open **Task Scheduler**
2. Click **Create Basic Task**
3. Name: "Pharma Stock Daily Backup"
4. Trigger: **Daily** at 2:00 AM
5. Action: **Start a program**
   - Program: `C:\Projet Fullstack\fullstack_produits\backend\backup_daily.bat`
   - Start in: `C:\Projet Fullstack\fullstack_produits\backend`
6. Finish and test

#### Option 2: Backup + Reorg Hebdomadaire
1. Open **Task Scheduler**
2. Click **Create Basic Task**
3. Name: "Pharma Stock Weekly Backup + Reorg"
4. Trigger: **Weekly** (Dimanche à 3:00 AM)
5. Action: **Start a program**
   - Program: `C:\Projet Fullstack\fullstack_produits\backend\backup_and_reorg.bat`
   - Start in: `C:\Projet Fullstack\fullstack_produits\backend`

#### Option 3: Manual Execution
Run `backup_daily.bat` or `backup_and_reorg.bat` whenever needed.
Check `backup_log.txt` or `backup_reorg_log.txt` for results.

## Backup Retention
- Automatically keeps last 30 days of backups
- Older backups are deleted during each run

## Restore from Backup
```bash
# Extract compressed backup
gunzip backups/backup_YYYYMMDD_HHMMSS.sql.gz

# Restore to database
psql -h localhost -U postgres -d MyDatabase < backups/backup_YYYYMMDD_HHMMSS.sql
```

## Important Notes
- Backups are stored in `backend/backups/`
- Add `backups/` to `.gitignore` to avoid committing large files
- Consider offsite backup storage for production (AWS S3, Google Drive, etc.)
- Test restore procedure regularly!
- La réorganisation des clés est sûre : transaction atomique avec rollback complet en cas d'erreur
