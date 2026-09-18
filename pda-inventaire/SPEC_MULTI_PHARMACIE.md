# Spécification — PDA itinérant, une pharmacie à la fois

## 1. Objectif

Permettre d’utiliser un même APK PDA successivement dans plusieurs pharmacies,
sans reconstruire l’application et sans modifier un fichier `.env`.

Le fonctionnement est volontairement séquentiel : le PDA ne conserve les données que
d’une seule pharmacie active. Avant de passer à une autre pharmacie, l’opérateur doit
synchroniser l’inventaire puis réinitialiser les données locales.

## 2. Principe retenu

```text
Pharmacie A
  → renseigner le serveur
  → se connecter
  → télécharger le catalogue
  → réaliser et synchroniser l’inventaire
  → réinitialiser le PDA

Pharmacie B
  → renseigner le nouveau serveur
  → se connecter
  → télécharger le nouveau catalogue
  → réaliser et synchroniser l’inventaire
```

Le PDA ne doit jamais conserver simultanément plusieurs tokens, catalogues ou files de
synchronisation provenant de pharmacies différentes.

## 3. Périmètre

La fonctionnalité comprend :

- la saisie de l’adresse IP ou de l’URL du serveur actif ;
- la normalisation et le test de cette adresse ;
- la récupération des utilisateurs actifs du serveur ;
- l’authentification ;
- le téléchargement du catalogue produits ;
- le travail en ligne ou hors ligne pour la pharmacie active ;
- la synchronisation obligatoire avant changement de pharmacie ;
- une fonction « Réinitialiser le PDA » ;
- la suppression contrôlée des données locales ;
- le retour à l’écran de saisie du serveur après réinitialisation.

La fonctionnalité ne comprend pas :

- la conservation simultanée de plusieurs pharmacies ;
- une liste de profils de pharmacies avec plusieurs caches ;
- la découverte automatique des serveurs du réseau ;
- la synchronisation entre deux pharmacies ;
- la fusion de catalogues ou d’inventaires.

## 4. Premier démarrage

1. Afficher l’écran « Serveur de la pharmacie ».
2. L’utilisateur saisit une IP ou une URL.
3. Le PDA normalise l’adresse.
4. L’utilisateur appuie sur « Tester et continuer ».
5. Le PDA appelle `GET /api/health/`.
6. Si le serveur répond, l’adresse devient le serveur actif.
7. Le PDA charge les utilisateurs avec `GET /api/users/login_options/`.
8. L’utilisateur choisit son compte et saisit son mot de passe.
9. Après connexion, l’accueil affiche les inventaires de ce serveur.
10. L’utilisateur télécharge le catalogue de cette pharmacie.

## 5. Démarrage normal

Tant que le PDA n’a pas été réinitialisé :

1. restaurer l’adresse du serveur actif ;
2. valider le token via `GET /api/users/me/` ;
3. ouvrir l’accueil si le token est valide ;
4. revenir à la connexion si le token est invalide ;
5. conserver le catalogue et les lignes hors ligne de la pharmacie active.

## 6. Écran serveur

### Champs

- adresse IP ou URL ;
- nom facultatif de la pharmacie, uniquement pour l’affichage ;
- bouton « Tester et continuer ».

### Exemples acceptés

```text
192.168.1.181
http://192.168.1.181
https://pharmacie.exemple.com
```

### Normalisation

- ajouter `http://` si aucun protocole n’est fourni ;
- retirer les `/` finaux ;
- ne pas ajouter `:8000` automatiquement ;
- utiliser nginx sur le port 80 ou 443 ;
- conserver un port uniquement s’il est explicitement saisi ;
- n’accepter que les protocoles `http` et `https`.

## 7. Test du serveur

Requête :

```text
GET <baseUrl>/api/health/
```

Résultat attendu : HTTP 200 dans un délai maximal d’environ 5 secondes.

Messages :

- adresse incorrecte : « Adresse du serveur invalide. » ;
- serveur inaccessible : « Vérifiez l’adresse et le réseau Wi-Fi. » ;
- délai dépassé : « Le serveur ne répond pas. » ;
- serveur non compatible : « Ce serveur n’est pas un serveur Zenith compatible. ».

Une adresse ne doit pas être activée silencieusement si le test échoue.

## 8. Connexion

L’écran affiche :

- le nom facultatif de la pharmacie ;
- l’adresse du serveur actif ;
- les utilisateurs actifs ;
- le mot de passe ;
- « Se connecter » ;
- « Modifier le serveur » uniquement si aucune donnée locale n’est en attente.

Endpoint des utilisateurs :

```text
GET /api/users/login_options/
```

Le mot de passe ne doit jamais être conservé localement.

### Contrainte d’authentification actuelle

Le backend révoque l’ancien token lorsqu’un même utilisateur se reconnecte. Utiliser
simultanément `admin` sur le Web et le PDA peut donc provoquer un `401` sur le PDA.

Recommandation : créer un compte terminal dédié dans chaque pharmacie :

```text
pda-inventaire
```

## 9. Configuration dynamique de l’API

L’instance Axios doit utiliser l’adresse enregistrée à l’exécution et non uniquement
`EXPO_PUBLIC_API_BASE_URL`.

Service prévu :

```ts
interface ActiveServer {
  name?: string;
  baseUrl: string;
}

normalizeServerUrl(input: string): string
getActiveServer(): Promise<ActiveServer | null>
setActiveServer(server: ActiveServer): Promise<void>
testServer(baseUrl: string): Promise<boolean>
clearActiveServer(): Promise<void>
```

Avant chaque requête :

1. récupérer le serveur actif ;
2. appliquer son `baseUrl` à Axios ;
3. lire le token courant ;
4. ajouter `Authorization: Token <token>` si disponible.

## 10. Données locales de la pharmacie active

Une seule copie de chaque donnée est conservée :

```text
pda_active_server
pda_auth_token
pda_user_info
pda_products_cache_date
pda_products_cache.json
pda_offline_lignes
```

Ces données appartiennent toutes au serveur actif. Elles doivent être supprimées lors
de la réinitialisation, uniquement après contrôle des synchronisations en attente.

## 11. Fin d’inventaire

Avant de quitter une pharmacie :

1. sauvegarder le produit actuellement affiché ;
2. envoyer les lignes locales via le bulk ;
3. vérifier la réponse du serveur ;
4. confirmer que le compteur de lignes en attente vaut zéro ;
5. revenir à l’accueil ;
6. utiliser « Réinitialiser le PDA ».

La validation définitive de l’inventaire et l’ajustement du stock peuvent rester sous le
contrôle de l’application Web.

## 12. Réinitialiser le PDA

### Emplacement

Ajouter une action « Réinitialiser le PDA » sur l’accueil, visuellement distincte de la
déconnexion simple.

### Protection obligatoire

Avant toute suppression :

```text
if (offlineCount > 0) {
  bloquer la réinitialisation
}
```

Message :

```text
Réinitialisation impossible
2 lignes restent à envoyer au serveur.
Synchronisez l’inventaire avant de changer de pharmacie.
```

### Confirmation

Si aucune ligne n’est en attente :

```text
Réinitialiser le PDA ?

Le catalogue, la session et les données locales de cette pharmacie seront supprimés.
Les données déjà envoyées au serveur resteront disponibles.

[Annuler] [Réinitialiser]
```

### Données supprimées

- token d’authentification ;
- utilisateur local ;
- adresse et nom du serveur ;
- fichier catalogue produits ;
- date et compteur du catalogue ;
- lignes locales déjà synchronisées ;
- état temporaire du scanner ;
- éventuels caches applicatifs liés à la pharmacie.

### Résultat

Après suppression :

1. remettre l’état React à zéro ;
2. afficher l’écran « Serveur de la pharmacie » ;
3. ne lancer aucune requête vers l’ancien serveur ;
4. demander la nouvelle adresse.

## 13. Données hors ligne

Chaque ligne locale conserve au minimum :

- inventaire ;
- produit ;
- lot ;
- stock théorique ;
- quantité physique ;
- mode `add` ou `replace` ;
- date du scan ;
- état de synchronisation.

La réinitialisation est interdite tant qu’une ligne non synchronisée existe. Il n’est donc
pas nécessaire de gérer plusieurs files locales séparées par pharmacie.

## 14. Catalogue produits

- Un seul catalogue est conservé.
- Il correspond toujours au serveur actif.
- Le téléchargement d’un nouveau catalogue n’est possible qu’après activation d’un serveur.
- La réinitialisation supprime le fichier catalogue.
- La pharmacie suivante doit télécharger son propre catalogue.
- Aucun produit de la pharmacie précédente ne doit rester disponible après réinitialisation.

## 15. Gestion des erreurs

### Serveur momentanément indisponible

- conserver les scans ;
- afficher « Hors ligne » ;
- proposer de réessayer ;
- ne pas proposer la réinitialisation si des lignes restent en attente.

### Token invalide

- supprimer le token et l’utilisateur ;
- conserver le serveur, le catalogue et les scans ;
- revenir à la connexion du même serveur ;
- ne pas afficher d’écran rouge Expo pour un `401` attendu.

### Réinitialisation incomplète

Si une suppression locale échoue :

- ne pas afficher l’écran du nouveau serveur comme si tout était propre ;
- signaler l’erreur ;
- permettre de réessayer ;
- journaliser uniquement les informations techniques non sensibles.

## 16. Sécurité

- Ne jamais stocker le mot de passe.
- Ne jamais afficher ou journaliser le token.
- Refuser les protocoles autres que `http` et `https`.
- Préférer HTTPS hors réseau local sécurisé.
- Toujours afficher la pharmacie ou le serveur actif.
- Demander confirmation avant la réinitialisation.
- Ne jamais autoriser la suppression de scans non synchronisés.
- Après réinitialisation, vérifier que le catalogue précédent est réellement absent.

## 17. Fichiers prévus

Création probable :

```text
src/services/serverConfig.ts
src/screens/ServerSelectionScreen.tsx
src/services/appReset.ts
```

Adaptations probables :

```text
App.tsx
src/config/index.ts
src/services/api.ts
src/services/auth.ts
src/services/productCache.ts
src/services/localStorage.ts
src/screens/LoginScreen.tsx
src/screens/HomeScreen.tsx
```

## 18. Plan d’implémentation

### Étape 1 — Serveur dynamique

- créer le stockage du serveur actif ;
- normaliser les URL ;
- tester `/api/health/` ;
- rendre `baseURL` Axios dynamique.

### Étape 2 — Connexion au serveur actif

- créer l’écran de saisie du serveur ;
- charger `login_options` ;
- afficher l’utilisateur et le mot de passe ;
- valider le token au démarrage.

### Étape 3 — Réinitialisation sûre

- calculer le nombre de lignes non synchronisées ;
- bloquer si ce nombre est supérieur à zéro ;
- demander une double confirmation claire ;
- supprimer session, catalogue, serveur et stockage local ;
- revenir à l’écran serveur.

### Étape 4 — Migration de l’installation actuelle

- utiliser provisoirement `EXPO_PUBLIC_API_BASE_URL` comme serveur initial ;
- mémoriser cette adresse au premier démarrage ;
- conserver le token, le catalogue et les lignes actuelles ;
- ne demander une nouvelle adresse qu’après réinitialisation.

### Étape 5 — Vérification

- tests de normalisation d’adresse ;
- test d’un serveur inaccessible ;
- test de chargement des utilisateurs ;
- test de blocage avec lignes en attente ;
- test de réinitialisation sans ligne en attente ;
- vérification de suppression du catalogue et du token ;
- test réel complet Pharmacie A → réinitialisation → Pharmacie B.

## 19. Critères d’acceptation

- Une seule APK fonctionne successivement dans plusieurs pharmacies.
- Une seule pharmacie est active à la fois.
- L’adresse peut être saisie sans protocole.
- Le serveur est testé avant activation.
- Les utilisateurs proviennent du serveur actif.
- Le PDA ne stocke jamais le mot de passe.
- La réinitialisation est impossible avec des lignes non synchronisées.
- Une confirmation est obligatoire avant suppression.
- Le catalogue et la session sont supprimés après confirmation.
- Les données déjà synchronisées restent disponibles sur le serveur.
- Après réinitialisation, aucune donnée de la pharmacie précédente n’est visible.
- Le PDA revient automatiquement à la saisie du nouveau serveur.
- La pharmacie suivante peut charger ses utilisateurs et son catalogue.
