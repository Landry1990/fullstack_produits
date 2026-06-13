# 📋 Dossier Technique - Pharmacie Gestion

## 🎯 Documentation Technique Centralisée

Ce dossier contient toute la documentation technique pour l'installation, la configuration et la maintenance du système de gestion pharmacie.

---

## 📑 Table des Matières

| Document | Description |
|----------|-------------|
| [**Configuration**](CONFIGURATION.md) | Variables d'environnement, paramètres système, ports |
| [**Architecture**](ARCHITECTURE.md) | Schéma backend/frontend/base de données, flux de données |
| [**Backup & Restauration**](BACKUP.md) | Procédures de sauvegarde incrémentale et complète |
| [**Maintenance**](MAINTENANCE.md) | Commandes utiles, troubleshooting, mises à jour |
| [**Déploiement**](../README_DEPLOIEMENT.md) | Guide de démarrage rapide (externe) |
| [**Emergency**](../../backend/docs/EMERGENCY_ADMIN.md) | Procédures d'urgence (externe) |

---

## 🚀 Démarrage Rapide

```bash
# Windows
cd "C:\Projet Fullstack\fullstack_produits"
.\DEMARRER.bat

# Linux
cd /opt/pharma-gestion
./demarrer.sh
```

**Accès** : http://localhost  
**Admin** : http://localhost/admin (admin/admin123)

---

## 🆘 Support

En cas de problème :
1. Consulter [MAINTENANCE.md](MAINTENANCE.md#troubleshooting)
2. Vérifier l'état : `ETAT.bat` (Windows) ou `./etat.sh` (Linux)
3. Logs : `docker compose logs -f [service]`

---

**Dernière mise à jour** : Juin 2026  
**Version** : 1.0
