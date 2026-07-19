══════════════════════════════════════════════════════════════
  ZENITH PHARMA — INSTALLATION HORS-LIGNE
══════════════════════════════════════════════════════════════

  Ce paquet contient tout ce qu'il faut pour installer
  Zenith Pharma sur une machine SANS connexion Internet.

══════════════════════════════════════════════════════════════
  PRÉREQUIS
══════════════════════════════════════════════════════════════

  1. Windows 10/11 (64-bit) ou Linux
  2. Docker Desktop installé
     - Télécharger sur une machine avec Internet:
       https://www.docker.com/products/docker-desktop/
     - Installer sur la pharmacie avant de continuer
  3. PowerShell 7+ (pwsh)
     - Télécharger: https://github.com/PowerShell/PowerShell/releases

══════════════════════════════════════════════════════════════
  CONTENU DU PAQUET
══════════════════════════════════════════════════════════════

  docker-images/       → Images Docker exportées (.tar)
  config/              → .env.example, backup-db.sh
  backups/             → Dump base de données (optionnel)
  backend/             → Dockerfile + requirements.txt (rebuild)
  frontend/            → Dockerfile.prod (rebuild)
  docker-compose.prod.yml
  .env.example
  install-offline.ps1  → Script d'installation
  README.txt           → Ce fichier

══════════════════════════════════════════════════════════════
  ÉTAPES D'INSTALLATION
══════════════════════════════════════════════════════════════

  1. Copier tout le dossier "zenith-offline-package" sur la
     machine cible (via clé USB, disque externe, etc.)

  2. Vérifier que Docker Desktop est installé et démarré

  3. Ouvrir PowerShell 7 en tant qu'administrateur:
     → Clic droit sur PowerShell → "Exécuter en tant qu'admin"

  4. Aller dans le dossier du paquet:
     cd C:\zenith-offline-package

  5. Lancer l'installation:
     pwsh -File install-offline.ps1

  6. Suivre les instructions à l'écran

══════════════════════════════════════════════════════════════
  APRÈS INSTALLATION
══════════════════════════════════════════════════════════════

  Application:    http://localhost
  Portainer:      https://localhost:9443
  Compte admin:   admin / admin123

  Arrêter:    docker compose -f docker-compose.prod.yml down
  Démarrer:   docker compose -f docker-compose.prod.yml up -d
  Logs:       docker compose -f docker-compose.prod.yml logs -f

══════════════════════════════════════════════════════════════
  SAUVEGARDE
══════════════════════════════════════════════════════════════

  Sauvegarde manuelle:
    docker exec fullstack_produits-db-1 pg_dump -U fullstack_user -d fullstack_db > backup.sql

  Restauration:
    docker exec -i fullstack_produits-db-1 psql -U fullstack_user -d fullstack_db < backup.sql

══════════════════════════════════════════════════════════════
