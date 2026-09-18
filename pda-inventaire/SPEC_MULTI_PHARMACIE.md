# Spécification — PDA multi-pharmacies

## 1. Objectif

Permettre d’utiliser un même APK PDA dans plusieurs pharmacies sans reconstruire
l’application et sans modifier manuellement un fichier `.env`.

L’opérateur choisit ou renseigne le serveur de la pharmacie avant de se connecter.
Le PDA charge ensuite les utilisateurs, inventaires, produits et lots depuis ce serveur.

La priorité absolue est d’empêcher tout mélange de données entre deux pharmacies.

## 2. Périmètre

La fonctionnalité comprend :

- la saisie et la mémorisation de l’adresse du serveur ;
- le test de disponibilité du serveur ;
- la récupération des utilisateurs actifs ;
- l’authentification sur le serveur sélectionné ;
- le changement de pharmacie ;
- le cloisonnement des tokens, catalogues et lignes hors ligne ;
- la reprise d’un inventaire sur le serveur auquel il appartient ;
- la gestion claire des erreurs réseau et d’authentification.

La fonctionnalité ne comprend pas :

- la découverte automatique des serveurs sur le réseau local ;
- la synchronisation d’un inventaire entre deux pharmacies ;
- la fusion de catalogues provenant de serveurs différents ;
- l’administration des pharmacies depuis le PDA.

## 3. Parcours utilisateur

### 3.1 Premier démarrage

1. Afficher l’écran « Serveur de la pharmacie ».
2. L’utilisateur renseigne une adresse IP ou une URL.
3. Le PDA normalise l’adresse.
4. L’utilisateur appuie sur « Tester et continuer ».
5. Le PDA appelle `GET /api/health/`.
6. Si le serveur répond, il est mémorisé et devient le serveur actif.
7. Le PDA charge les utilisateurs avec `GET /api/users/login_options/`.
8. L’utilisateur choisit son compte, saisit son mot de passe et se connecte.

### 3.2 Démarrages suivants

1. Restaurer le dernier serveur utilisé.
2. Tester sa disponibilité.
3. Vérifier le token correspondant à ce serveur avec `GET /api/users/me/`.
4. Si le token est valide, ouvrir l’accueil.
5. Sinon, afficher la connexion du serveur actif.

### 3.3 Changement de pharmacie

Un bouton « Changer de serveur » doit être disponible :

- sur l’écran de connexion ;
- depuis l’accueil, après confirmation si des lignes ne sont pas synchronisées.

Lors du changement :

1. vérifier les lignes hors ligne du serveur actuel ;
2. empêcher le changement silencieux si des données restent à synchroniser ;
3. proposer de rester, de synchroniser ou de changer en conservant les données localement ;
4. sélectionner ou ajouter un autre serveur ;
5. charger uniquement les données de ce serveur.

## 4. Interface

### 4.1 Écran de sélection du serveur

Champs et actions :

- nom facultatif de la pharmacie ;
- adresse IP ou URL ;
- bouton « Tester et continuer » ;
- liste des serveurs récemment utilisés ;
- action de modification d’un serveur ;
- action de suppression avec confirmation.

Exemples acceptés :

```text
192.168.1.181
http://192.168.1.181
https://pharmacie.exemple.com
```

Normalisation :

- ajouter `http://` si aucun protocole n’est fourni ;
- retirer les `/` finaux ;
- ne pas ajouter `:8000` par défaut ;
- utiliser nginx sur les ports standards 80/443 ;
- accepter un port explicite uniquement s’il est saisi par l’utilisateur.

### 4.2 Connexion

Afficher :

- le nom du serveur actif ;
- son adresse ;
- la liste des utilisateurs actifs ;
- le mot de passe ;
- « Se connecter » ;
- « Changer de serveur ».

L’endpoint public utilisé pour les utilisateurs est :

```text
GET /api/users/login_options/
```

### 4.3 Accueil

Afficher le serveur ou la pharmacie active dans le header afin que l’opérateur sache
toujours où les données seront envoyées.

## 5. Modèle local

### 5.1 Serveur enregistré

```ts
interface PharmacyServer {
  id: string;
  name: string;
  baseUrl: string;
  normalizedOrigin: string;
  lastUsedAt: string;
}
```

`id` doit être dérivé de l’origine normalisée ou être un UUID stable.

### 5.2 Clés globales

```text
pda_servers
pda_active_server_id
```

### 5.3 Clés cloisonnées

Toutes les données propres à une pharmacie doivent intégrer `serverId` :

```text
pda:<serverId>:auth_token
pda:<serverId>:user_info
pda:<serverId>:products_cache_date
pda:<serverId>:offline_inventory_lines
```

Le fichier catalogue doit également être séparé :

```text
pda_products_<serverId>.json
```

## 6. Configuration dynamique Axios

L’instance Axios ne doit plus dépendre uniquement d’une constante évaluée au démarrage.

Le gestionnaire de serveurs doit fournir :

```ts
getActiveServer(): Promise<PharmacyServer | null>
setActiveServer(serverId: string): Promise<void>
normalizeServerUrl(input: string): string
testServer(baseUrl: string): Promise<ServerTestResult>
```

Avant chaque requête :

1. résoudre le serveur actif ;
2. appliquer son `baseUrl` à Axios ;
3. lire le token associé à son `serverId` ;
4. ajouter `Authorization: Token <token>`.

Une requête ne doit jamais réutiliser le token d’un autre serveur.

## 7. Test du serveur

Le test appelle :

```text
GET <baseUrl>/api/health/
```

Résultat attendu : HTTP 200.

Erreurs utilisateur :

- délai dépassé : « Serveur inaccessible. Vérifiez le réseau et l’adresse. » ;
- DNS/IP invalide : « Adresse du serveur invalide. » ;
- réponse non compatible : « Ce serveur n’est pas un serveur Zenith compatible. » ;
- HTTPS invalide : message spécifique au certificat.

Le test doit avoir un délai court, par exemple 5 secondes.

## 8. Authentification

Chaque serveur possède son propre token et son propre utilisateur local.

Le PDA doit :

- valider le token au démarrage avec `/api/users/me/` ;
- supprimer uniquement le token du serveur actif en cas de 401 ;
- revenir à la connexion sans écran rouge Expo ;
- ne pas effacer les tokens des autres pharmacies ;
- ne jamais stocker le mot de passe.

### Contrainte actuelle

Le backend révoque le token précédent à chaque nouvelle connexion d’un même utilisateur.
Un compte utilisé simultanément sur le Web et le PDA peut donc provoquer des 401.

Recommandation : créer un compte terminal dédié par pharmacie, par exemple :

```text
pda-inventaire
```

Une évolution séparée vers des tokens multi-appareils pourra être étudiée ultérieurement.

## 9. Catalogue produits

Le catalogue téléchargé appartient exclusivement au serveur actif.

Au changement de serveur :

- ne jamais lire le fichier catalogue d’un autre serveur ;
- afficher le nombre de produits du serveur actif uniquement ;
- autoriser un téléchargement indépendant pour chaque pharmacie ;
- conserver les autres catalogues pour un retour ultérieur ;
- prévoir une action de nettoyage par serveur.

## 10. Inventaires et mode hors ligne

Chaque ligne locale doit conserver :

- `serverId` ;
- `inventaireId` ;
- produit ;
- lot ;
- stock théorique ;
- quantité physique ;
- mode de synchronisation ;
- date de scan.

Avant toute synchronisation :

1. vérifier que le serveur actif correspond au `serverId` de la ligne ;
2. refuser l’envoi en cas de différence ;
3. ne jamais supposer que deux inventaires ayant le même ID appartiennent à la même pharmacie.

## 11. Migration des données existantes

À la première version multi-pharmacies :

1. lire l’ancienne URL issue de `EXPO_PUBLIC_API_BASE_URL` ;
2. créer automatiquement un serveur « Serveur existant » ;
3. affecter l’ancien token, utilisateur, catalogue et lignes hors ligne à ce serveur ;
4. marquer la migration comme terminée ;
5. ne pas supprimer les anciennes clés avant validation de la migration.

La migration doit être idempotente.

## 12. Sécurité

- N’accepter que `http` et `https`.
- Refuser les schémas comme `file:`, `javascript:` ou autres.
- Ne jamais afficher ou journaliser les tokens.
- Ne jamais inclure les mots de passe dans les logs.
- Préférer HTTPS hors réseau local sécurisé.
- Afficher clairement le serveur actif avant une synchronisation bulk.
- Demander confirmation avant la suppression d’un serveur contenant des données hors ligne.

## 13. Gestion des erreurs

### Serveur indisponible

- conserver les scans localement ;
- afficher « Hors ligne » ;
- ne pas supprimer la configuration ;
- proposer « Réessayer ».

### Token invalide

- supprimer le token du serveur concerné uniquement ;
- conserver le catalogue et les lignes hors ligne ;
- revenir à la connexion de ce serveur.

### Changement d’adresse

Si l’adresse d’un serveur enregistré est modifiée, la traiter comme un nouveau serveur,
sauf confirmation explicite que les deux adresses représentent la même pharmacie.

## 14. Fichiers prévus

Création probable :

```text
src/services/serverConfig.ts
src/screens/ServerSelectionScreen.tsx
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

## 15. Plan d’implémentation

### Étape 1 — Serveur dynamique

- modèle `PharmacyServer` ;
- normalisation URL ;
- persistance des serveurs ;
- serveur actif ;
- test `/api/health/`.

### Étape 2 — Connexion

- écran serveur ;
- baseURL Axios dynamique ;
- récupération de `login_options` ;
- token cloisonné.

### Étape 3 — Données locales

- catalogue par serveur ;
- lignes hors ligne par serveur ;
- migration des données existantes.

### Étape 4 — Sécurité UX

- changement de serveur ;
- avertissement si scans en attente ;
- affichage permanent de la pharmacie active ;
- gestion des erreurs.

### Étape 5 — Vérification

- tests unitaires de normalisation ;
- tests de changement de serveur ;
- test de séparation des tokens ;
- test de séparation des catalogues ;
- test de séparation des lignes hors ligne ;
- test de migration ;
- test réel avec deux serveurs.

## 16. Critères d’acceptation

- Une seule APK fonctionne avec plusieurs pharmacies.
- L’adresse peut être saisie sans protocole.
- Un serveur inaccessible ne peut pas être activé silencieusement.
- Les utilisateurs proviennent du serveur sélectionné.
- Les identifiants sont envoyés uniquement au serveur actif.
- Les produits d’une pharmacie n’apparaissent jamais dans une autre.
- Les lignes hors ligne ne peuvent pas être envoyées au mauvais serveur.
- Le changement de serveur ne supprime pas les données des autres pharmacies.
- Un token 401 ramène proprement à la connexion.
- Le serveur actif est clairement visible.
- La migration des installations existantes ne perd aucune donnée.
