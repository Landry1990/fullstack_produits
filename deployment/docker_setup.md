# Guide de Déploiement Multi-Sites (Docker)

Ce guide est conçu pour déployer l'application rapidement sur **plusieurs serveurs** (Pharmacie 1, Pharmacie 2, ..., Pharmacie 100) sans configuration manuelle complexe.

## 1. Pré-requis (Sur chaque serveur)

Il suffit d'avoir **Docker** et **Git**.

Sur un serveur Ubuntu vierge :
```bash
# Script d'installation automatique de Docker (officiel)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Installer Git & Docker Compose
sudo apt update && sudo apt install -y git docker-compose-plugin
```

## 2. Installation de l'Application

```bash
# 1. Cloner le projet
git clone <VOTRE_URL_REPO_GIT> app
cd app

# 2. Lancer l'installation (tout est automatique)
sudo docker compose up -d --build
```
> **C'est tout !** L'application est maintenant accessible sur le port 80 (http://IP-DU-SERVEUR).

La commande va automatiquement :
1.  Télécharger et installer PostgreSQL.
2.  Construire le Backend Python.
3.  Construire le Frontend React.
4.  Relier tout le monde ensemble.

## 3. Maintenance & Mises à Jour

Pour mettre à jour les 100 pharmacies, connectez-vous et lancez :

```bash
cd app
git pull                 # Récupérer le nouveau code
sudo docker compose up -d --build  # Reconstruire et relancer
```

## 4. Dépannage

- **Voir les logs :** `sudo docker compose logs -f`
- **Voir les logs backend seulement :** `sudo docker compose logs -f backend`
- **Redémarrer :** `sudo docker compose restart`
- **Arrêter tout :** `sudo docker compose down`

## 5. Persistence des Données

Les données de la base de données sont stockées dans un "docker volume" sécurisé (`fullstack_produits_postgres_data`). Même si vous arrêtez ou supprimez les conteneurs, les données restent sauves.
