# Projet de kit d'installation hors Internet — Zenith Pharma

Date : 2026-11-09
Statut : proposition sauvegardée, réalisation reportée. Aucune implémentation approuvée à ce stade.

## Cible confirmée

- Serveur : Linux Mint 22.3 Cinnamon.
- Matériel : PC Intel 64 bits, architecture x86_64 ; images Docker linux/amd64.
- Postes clients : accès à l'application depuis le navigateur sur le réseau local.
- Accès distant : Tailscale/VPN lorsque la connectivité le permet.

## Objectif

Préparer le kit sur une machine disposant d'Internet, le transporter sur clé USB ou disque externe et installer Zenith sur le serveur client sans aucun téléchargement.

Conserver Docker et l'architecture actuelle. Fournir les images de production déjà construites, compilation Cython comprise. Ne pas installer séparément Python, Node, PostgreSQL ou Redis sur le système hôte.

Le kit doit être copié sur le disque du serveur avant installation. Le fonctionnement ne doit pas dépendre de la présence de la clé USB.

## Organisation proposée

```text
ZENITH-OFFLINE/
├── installer.sh
├── mettre-a-jour.sh
├── verifier.sh
├── prerequis/          # Docker Engine, Compose et dépendances système
├── images/             # Backend, frontend, PostgreSQL et Redis
├── configuration/      # Compose et fichiers support nécessaires
├── outils/             # Sauvegarde et diagnostic
└── manifeste.json      # Versions, architecture et empreintes
```

Cette structure est une proposition, pas un ensemble de fichiers déjà générés.

## Deux livrables

1. Installation complète : prérequis système, images, configuration modèle et scripts.
2. Mise à jour : nouvelles images Zenith et fichiers support nécessaires, sans réinstaller systématiquement les prérequis.

Les sauvegardes, médias et secrets d'une pharmacie restent séparés du kit générique.

## Préparation avec Internet

- Vérifier les versions exactes de Mint, de Docker et de Compose à supporter.
- Rassembler les paquets système compatibles et leurs dépendances ; tester sur une installation propre, pas seulement sur une machine déjà équipée.
- Construire les images de production pour linux/amd64, en conservant la compilation Cython.
- Utiliser des versions précises et identifiables des images, sans tags flottants pour le kit livré.
- Exporter toutes les images nécessaires avec leurs références exactes.
- Embarquer tous les fichiers montés par Compose et tous les outils requis par les scripts.
- Produire un manifeste et des empreintes de contrôle. Les empreintes seules ne prouvent pas l'authenticité si le manifeste peut être remplacé ; prévoir un mécanisme de confiance pour la distribution.
- Bloquer la préparation si un élément obligatoire manque.

## Installation hors Internet

Commande cible proposée :

```bash
sudo bash installer.sh
```

Parcours attendu :

1. Détecter la distribution et l'architecture ; vérifier ressources, disque, ports et droits.
2. Refuser une nouvelle installation si une instance existante est détectée ; orienter vers la mise à jour.
3. Installer Docker Engine et Compose depuis les paquets locaux si nécessaire.
4. Charger les images embarquées.
5. Installer les fichiers dans /opt/zenith-pharma.
6. Préparer une configuration propre à la pharmacie, avec secrets locaux uniques et persistants, jamais des secrets génériques distribués dans le kit.
7. Démarrer les services sans build ni pull.
8. Initialiser la base et appliquer les migrations ; ne pas annoncer un succès si une étape obligatoire échoue.
9. Configurer le compte administrateur et vérifier la procédure de licence hors ligne sans affaiblir ses contrôles.
10. Installer le démarrage automatique, les sauvegardes locales et les outils de diagnostic.
11. Vérifier l'état réel des services et afficher les informations d'accès.

## Services

Obligatoires pour le cœur local :

- Backend Zenith.
- Frontend/Nginx.
- PostgreSQL.
- Redis, notamment pour les protections de connexion.
- Sauvegardes locales.

Facultatifs, sans blocage du fonctionnement local :

- Tailscale et accès distant.
- Portainer.
- Sauvegardes cloud.
- Notifications et services fournisseurs externes.
- Mise à jour automatique par Internet.

Auditer les dépendances réseau au démarrage, la licence, le watchdog et les tâches de fond. Ne pas présumer que tous ces parcours sont déjà autonomes.

## Protection des installations existantes

- Séparer explicitement installation, mise à jour et restauration.
- Conserver les volumes et leur identité, les médias, la licence et les secrets lors d'une mise à jour.
- Vérifier une sauvegarde avant les migrations.
- Ne jamais restaurer automatiquement une base parce qu'un dump est présent dans le dossier.
- Une restauration est une opération explicite nécessitant confirmation.
- Conserver la version précédente des images ; un retour arrière applicatif ne suffit pas toujours après migration de la base.
- Définir et tester la procédure de récupération avant livraison.

## État du dépôt à reprendre

Une première base existe dans offline-install/ :

- prepare-offline.ps1
- install-offline.ps1
- README-offline.txt

Ces scripts sont orientés PowerShell et ne constituent pas un parcours Linux validé.

Points constatés lors de la lecture :

- Les prérequis système ne sont pas embarqués.
- La préparation peut ignorer des images absentes.
- Le Compose de production conserve des instructions de construction et le lancement n'interdit pas explicitement les téléchargements/constructions.
- Des fichiers montés, notamment init-db.sh, ne sont pas copiés par la préparation actuelle.
- La restauration proposée intervient après le démarrage du backend et ses initialisations.
- Les indications de comptes et de conteneurs dans le guide doivent être revérifiées avant toute réutilisation.

Références utiles : docker-compose.prod.yml, backend/entrypoint.sh, docs/agent/deploiement.md, docs/agent/securite-licence.md et les scripts de mise à jour/watchdog existants.

## Réalisation proposée par étapes

1. Auditer et préparer un premier kit Linux avec Docker déjà installé, séparé du déploiement actuellement utilisé chez les clients.
2. Valider installation, licence, démarrage, sauvegardes et mise à jour sans Internet.
3. Ajouter les paquets Docker/Compose et leurs dépendances pour une machine Mint vierge.
4. Valider le kit complet sur une installation propre de Mint 22.3 Cinnamon x86_64.

Cette progression a été proposée, mais n'a pas encore été approuvée pour implémentation. Reconfirmer le périmètre avant de modifier les scripts de production.

## Critères de validation

Sur une machine propre, Internet effectivement coupé :

- Installation sans téléchargement ni compilation.
- Connexion à l'application et activation de licence selon la procédure prévue.
- Vente de test, caisse et opérations locales de stock sur des données de test.
- Impression locale avec les prérequis nécessaires sur le poste concerné.
- Redémarrage du serveur et reprise automatique des services, clé USB retirée.
- Sauvegarde et restauration contrôlée dans un environnement de test.
- Mise à jour hors ligne avec conservation des données et vérification des migrations.
- Détection explicite d'un kit incomplet, d'une architecture incompatible ou d'une installation existante.
- Absence d'impact bloquant des services Internet indisponibles.
