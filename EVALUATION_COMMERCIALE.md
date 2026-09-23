# Évaluation commerciale — Zenith Pharma

**Date de l’évaluation : 22 septembre 2026**  
**Note générale : 8/10**

## Avis général

Zenith Pharma est commercialisable dès maintenant dans le cadre d’un déploiement progressif et accompagné.

L’application n’est plus un prototype : elle couvre les principaux besoins opérationnels d’une pharmacie et dispose d’une base technique sérieuse. La stratégie recommandée consiste à commencer avec quelques pharmacies pilotes, installation et support inclus, avant une diffusion à grande échelle.

## Évaluation par domaine

| Domaine | Note | Appréciation |
|---|---:|---|
| Fonctionnalités métier | 9/10 | Couverture très riche : ventes, caisse, stock, commandes, inventaire, créances, fournisseurs, rapports, comptabilité, utilisateurs et audit |
| Interface et ergonomie | 8,5/10 | Interface cohérente et responsive, dark mode, composants shadcn, bilingue et bonne identité visuelle |
| Fiabilité métier | 8/10 | Bons contrôles sur la caisse, le stock et la facturation ; plusieurs tests critiques sont déjà présents |
| Sécurité et permissions | 7,5/10 | Sudo, rôles, journal d’audit et routes protégées ; un audit systématique des autorisations backend reste recommandé |
| Documents et rapports | 8,5/10 | Documents PDF/Excel complets et langue documentaire indépendante de la langue d’interface |
| Déploiement et maintenance | 8/10 | Docker, sauvegarde, rollback, mise à jour intégrée et protection Cython |
| Tests automatisés | 7/10 | Bonne base, mais les parcours métier complets doivent encore être couverts par des tests de bout en bout |
| Exploitation commerciale | 7/10 | Les procédures de support, restauration, documentation client et conformité locale doivent encore être consolidées |

## Points forts commercialisables

- Facturation, ventes et gestion de caisse.
- Gestion des stocks, lots et dates de péremption.
- Inventaires et correction des écarts.
- Commandes fournisseurs et réceptions.
- Créances, règlements et avoirs.
- Rapports financiers, PDF, Excel et CSV.
- Comptabilité et suivi des mouvements.
- Gestion des utilisateurs et droits d’accès granulaires.
- Journal d’audit et validations sensibles par sudo.
- Sauvegarde, rollback et mécanisme de mise à jour intégré.
- Interface bilingue français/anglais.
- Langue des documents définie au niveau de la pharmacie, indépendamment des préférences de chaque utilisateur.
- Déploiement Linux reproductible avec Docker.
- Fonctionnement PWA et identité visuelle professionnelle.

## Priorités avant commercialisation à grande échelle

### 1. Tester réellement la restauration

- Restaurer une sauvegarde dans un environnement séparé.
- Vérifier l’intégrité des ventes, stocks, règlements, utilisateurs et pièces comptables.
- Documenter la procédure complète et les critères de réussite.

### 2. Ajouter des tests de bout en bout

Parcours prioritaires :

1. Ouvrir une caisse, vendre, encaisser puis clôturer.
2. Créer une commande, la réceptionner et contrôler le stock obtenu.
3. Réaliser un inventaire et appliquer les écarts.
4. Créer une créance, enregistrer un règlement puis vérifier le solde.
5. Annuler ou retourner une vente et vérifier les mouvements de stock et de caisse.
6. Vérifier les permissions avec plusieurs profils utilisateurs.
7. Générer les documents critiques dans les deux langues documentaires.

### 3. Auditer les autorisations backend

La visibilité dans la sidebar et les protections frontend ne doivent pas constituer l’unique barrière. Chaque endpoint sensible doit vérifier côté serveur :

- l’authentification ;
- le rôle ou la permission ;
- la portée des données accessibles ;
- les validations sudo nécessaires ;
- la traçabilité dans le journal d’audit.

### 4. Valider la conformité fiscale et réglementaire

Faire contrôler par un professionnel local :

- les mentions obligatoires sur les factures et tickets ;
- la gestion de la TVA ;
- les identifiants fiscaux et commerciaux ;
- l’archivage des pièces ;
- les règles d’annulation et d’avoir ;
- les éventuelles obligations de certification ou de transmission fiscale.

### 5. Formaliser le support client

Préparer des procédures pour :

- l’installation initiale ;
- les sauvegardes et restaurations ;
- les mises à jour ;
- la perte d’un mot de passe administrateur ;
- une panne serveur ou réseau ;
- le remplacement du poste principal ;
- l’assistance à distance ;
- l’escalade des incidents critiques.

### 6. Organiser un pilote multi-pharmacies

Déployer la version actuelle dans deux ou trois pharmacies présentant des pratiques différentes. Collecter notamment :

- les difficultés quotidiennes ;
- les écarts de processus ;
- les performances sur des volumes réels ;
- les besoins de formation ;
- les incidents et demandes de support ;
- les fonctions réellement utilisées.

## Positionnement commercial recommandé

À court terme, Zenith Pharma devrait être proposé comme une solution professionnelle avec :

- installation et configuration ;
- reprise ou import initial des données ;
- formation des utilisateurs ;
- sauvegarde configurée ;
- maintenance et mises à jour ;
- assistance technique.

Une vente totalement autonome en libre-service est prématurée. Le modèle accompagné réduit les risques opérationnels et permet d’améliorer le produit à partir de retours réels.

## Objectif pour atteindre 9/10

- Réussir un exercice complet de sauvegarde et restauration.
- Couvrir les principaux parcours métier par des tests de bout en bout.
- Terminer l’audit des autorisations backend.
- Faire valider les documents et règles fiscales.
- Réaliser un pilote concluant dans plusieurs pharmacies.
- Formaliser les engagements et procédures de support.

## Conclusion

Zenith Pharma est déjà une application métier exploitable et vendable dans le cadre d’un déploiement contrôlé. Sa couverture fonctionnelle, son interface, ses documents, ses mécanismes d’administration et son architecture de déploiement lui donnent une base commerciale crédible.

La priorité n’est plus d’ajouter beaucoup de fonctionnalités. Elle est désormais de renforcer la validation terrain, la sécurité backend, les tests de parcours complets et l’organisation du support afin de passer d’un bon produit métier à une solution commercialisable à grande échelle.
