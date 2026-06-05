# Déploiement Application Pharmacie

## Prérequis

- Docker Desktop (Windows) ou Docker Engine (Linux)
- Au moins 4 Go de RAM disponible

## Lancer l'application

### 🖥️ Windows (double-cliquez)

| Fichier | Action |
|---------|--------|
| `DEMARRER.bat` | Démarre tout et affiche l'URL |
| `ARRETER.bat` | Arrête les services |
| `ETAT.bat` | Vérifie si tout fonctionne |

### 🐧 Linux / macOS (terminal)

```bash
chmod +x demarrer.sh arreter.sh etat.sh
./demarrer.sh   # Démarrer
./arreter.sh    # Arrêter
./etat.sh       # Vérifier l'état
```

### 🔧 Manuel (tous OS)

```bash
docker compose up -d --build    # Démarrer
docker compose stop              # Arrêter
docker compose down -v           # Arrêter + supprimer volumes (ATTENTION)
```

## Accès

- **Application** : http://localhost
- **Admin** : http://localhost/admin
- **Compte par défaut** : `admin` / `admin123`

## Dossiers importants

| Dossier | Contenu |
|---------|---------|
| `backups/` | Sauvegardes automatiques de la base |
| `logs/` | Fichiers de log |
| `postgres_data/` | Données PostgreSQL |

## Redémarrage automatique

Les conteneurs sont configurés pour redémarrer automatiquement si Docker Desktop redémarre. Pour désactiver :

```bash
docker compose stop
```

## Support

En cas de problème, exécutez `ETAT.bat` (Windows) ou `./etat.sh` (Linux) pour diagnostiquer.
