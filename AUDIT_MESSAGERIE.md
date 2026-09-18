# Audit et plan d’amélioration — Messagerie interne

> Document de suivi créé le 18 septembre 2026.
>
> Statut global : **phases 1 à 3 terminées le 18 septembre 2026 — temps réel Channels à poursuivre**.

## 1. Périmètre actuel

La messagerie interne repose actuellement sur :

- le modèle Django `InternalMessage` : expéditeur, destinataire individuel ou diffusion générale, contenu, pièce jointe, lectures, archivages et réponse à un message parent ;
- le modèle `MessageTemplate` pour les messages prédéfinis ;
- les endpoints REST `/internal-messages/` et `/message-templates/` ;
- les actions `mark_as_read`, `archive` et `unread_count` ;
- le service frontend `communicationService.ts` ;
- le composant monolithique `MessagingModal.tsx` ;
- le compteur et les notifications dans `UserHeader.tsx` ;
- les traductions `public/locales/fr/messaging.json` et `public/locales/en/messaging.json`.

Le système ne dispose pas d’un temps réel WebSocket dédié. Le modal recharge ses données toutes les 5 secondes et le compteur global toutes les 30 secondes.

## 2. Fichiers principaux

### Backend

- `backend/api/models/communication.py`
- `backend/api/serializers/communication.py`
- `backend/api/views/communication.py`
- `backend/api/urls.py`
- `backend/api/migrations/0143_internalmessage_messagetemplate.py`
- `backend/api/migrations/0144_remove_internalmessage_is_read_and_more.py`
- `backend/api/migrations/0145_internalmessage_archived_by_and_more.py`

### Frontend

- `frontend/frontend/src/components/common/MessagingModal.tsx`
- `frontend/frontend/src/components/common/UserHeader.tsx`
- `frontend/frontend/src/services/communicationService.ts`
- `frontend/frontend/public/locales/fr/messaging.json`
- `frontend/frontend/public/locales/en/messaging.json`

## 3. Diagnostic général

Le système est fonctionnel comme boîte de notifications interne, mais il ne constitue pas encore une messagerie conversationnelle complète.

Principales limites :

- autorisations objet insuffisamment strictes ;
- pièces jointes peu encadrées ;
- polling fréquent et coûteux ;
- absence de pagination exploitable dans l’interface ;
- réponses affichées comme messages indépendants ;
- composant frontend de plus de 700 lignes ;
- UI partiellement déconnectée du design system du reste de Zenith ;
- accessibilité et traductions incomplètes ;
- couverture de tests insuffisante.

---

## 4. Priorité P0 — Sécurité et intégrité

### 4.1 Sécuriser la suppression des messages

**Problème**

Le `ModelViewSet` expose la suppression standard. Le queryset d’un utilisateur contient les messages envoyés, reçus et les diffusions. Un destinataire peut donc potentiellement supprimer physiquement un message partagé depuis la base.

**Recommandations**

- [x] Ajouter des contrôles d’autorisation explicites sur la suppression.
- [x] Autoriser la suppression physique uniquement au staff.
- [x] Empêcher un destinataire de supprimer globalement une diffusion.
- [ ] Préférer un masquage individuel ou un soft-delete à la suppression physique.
- [x] Ajouter des tests pour les messages individuels, envoyés, reçus et diffusés.

### 4.2 Valider strictement le message parent

**Problème**

Le champ `parent` peut référencer un message arbitraire. Les champs sérialisés `parent_content` et `parent_sender_name` pourraient exposer un message hors du périmètre accessible à l’utilisateur.

**Recommandations**

- [x] Vérifier que le parent est visible par l’utilisateur courant.
- [ ] Vérifier la cohérence entre parent, expéditeur et destinataire.
- [ ] Interdire les références circulaires ou incohérentes.
- [x] Ajouter des tests de non-divulgation entre utilisateurs.

### 4.3 Restreindre la gestion des modèles

**Problème**

Tous les utilisateurs authentifiés peuvent potentiellement modifier ou supprimer les modèles créés par d’autres utilisateurs.

**Décision métier à prendre**

- modèles globaux administrés uniquement par les responsables ;
- modèles personnels modifiables uniquement par leur créateur ;
- ou coexistence des deux avec un champ `scope`.

**Recommandations**

- [x] Définir la règle métier : modèles globaux administrés par le staff.
- [x] Restreindre les mutations au staff ; conserver la lecture pour les utilisateurs authentifiés.
- [x] Masquer dans l’UI les actions non autorisées.
- [x] Tester les rôles utilisateur et staff ; le superuser hérite du statut staff.

### 4.4 Encadrer les pièces jointes

**Problème**

Aucune validation métier spécifique n’est visible pour la taille, l’extension, le type MIME ou la consultation des pièces jointes.

**Recommandations**

- [x] Limiter chaque pièce jointe à 10 Mo.
- [x] Mettre en place une liste blanche : PDF, JPEG, PNG et WebP.
- [x] Vérifier l’extension et le type MIME déclaré côté backend.
- [x] Vérifier la signature réelle du contenu du fichier.
- [x] Ne jamais exposer le chemin de stockage dans les réponses API.
- [x] Protéger les médias par authentification et périmètre du message.
- [x] Distinguer visuellement images et documents.
- [x] Ajouter des tests de format et taille invalides.
- [x] Ajouter des tests d’accès non autorisé aux médias.

---

## 5. Priorité P1 — Fiabilité et performances

### 5.1 Remplacer le faux temps réel

**Problème**

Quand le modal est ouvert, il recharge toutes les 5 secondes les messages, modèles, utilisateurs et, pour un administrateur, tous les messages du système. Le compteur est interrogé séparément toutes les 30 secondes.

**Recommandations**

- [ ] Ajouter un consumer Channels dédié à la messagerie.
- [ ] Utiliser un groupe WebSocket par utilisateur.
- [ ] Émettre les événements `message_created`, `message_read` et `message_archived`.
- [ ] Émettre les événements uniquement après le commit de la transaction.
- [ ] Conserver un polling lent comme secours en cas de déconnexion.
- [ ] Charger les modèles et utilisateurs séparément avec cache.
- [ ] Invalider uniquement les données concernées.

### 5.2 Gérer réellement la pagination

**Problème**

Le frontend extrait `results` des réponses paginées sans proposer de navigation ou de chargement supplémentaire. Les anciens messages deviennent invisibles et les compteurs affichés dans le modal sont partiels.

**Recommandations**

- [x] Ajouter une pagination serveur.
- [x] Utiliser le champ `count` du backend pour les totaux.
- [x] Paginer séparément reçus, envoyés, archives et supervision.
- [x] Ajouter des contrôles de fin de pagination.
- [x] Tester avec plusieurs pages de messages.

### 5.3 Utiliser les identifiants numériques

**Problème**

Le frontend identifie actuellement certains messages reçus ou envoyés en comparant les noms d’utilisateur.

**Recommandations**

- [ ] Filtrer avec `sender` et `recipient` plutôt qu’avec `sender_name` et `recipient_name`.
- [ ] Réserver les noms aux besoins d’affichage.
- [ ] Ajouter l’identifiant utilisateur courant aux sélecteurs et filtres concernés.

### 5.4 Corriger le contrat TypeScript

- [x] Supprimer le champ obsolète `read_at`.
- [x] Remplacer les réponses non typées par des interfaces paginées.
- [x] Centraliser les types des payloads de création et des réponses.
- [ ] Ajouter des tests frontend du service.

### 5.5 Améliorer les opérations utilisateur

- [ ] Ajouter « Restaurer » pour les messages archivés.
- [ ] Ajouter « Marquer comme non lu ».
- [ ] Ajouter « Tout marquer comme lu ».
- [x] Ajouter recherche par auteur et contenu.
- [x] Ajouter filtres : non-lus et pièces jointes.
- [ ] Conserver le brouillon localement.
- [ ] Désactiver l’envoi pendant la requête pour éviter les doublons.
- [ ] Afficher un état d’envoi, d’échec et une action de nouvelle tentative.

---

## 6. Priorité P1 — Refonte UI/UX

### 6.1 Objectif

Transformer le panneau actuel en une boîte de réception rapide et claire, adaptée au travail en pharmacie : lecture immédiate, identification de l’émetteur, réponse rapide et retour au flux métier.

### 6.2 Structure desktop recommandée

#### Colonne gauche — Navigation

- boîte de réception avec compteur ;
- non lus ;
- envoyés ;
- archivés ;
- modèles dans une section secondaire ;
- supervision réservée aux administrateurs ;
- bouton principal « Nouveau message ».

#### Colonne centrale — Liste

Chaque ligne devrait afficher :

- avatar ou initiales ;
- nom de l’expéditeur ;
- aperçu du message ;
- date ou heure relative ;
- indicateur de pièce jointe ;
- badge de diffusion ;
- indicateur non-lu discret ;
- menu d’actions accessible.

En tête :

- recherche ;
- filtres ;
- action « Tout marquer comme lu ».

#### Colonne droite — Lecture et composition

- expéditeur, destinataire et date ;
- contenu complet ;
- pièce jointe correctement typée ;
- contexte de réponse ;
- zone de réponse fixe en bas.

### 6.3 Comportement mobile

- [x] Afficher d’abord la liste.
- [x] Ouvrir le détail sur un second niveau.
- [x] Ouvrir la composition sur un troisième niveau.
- [x] Fournir un bouton retour explicite.
- [x] Garder les actions accessibles sans survol.
- [ ] Vérifier la hauteur visible et les zones sûres sur appareils réels.
- [ ] Vérifier visuellement l’absence de défilement horizontal à 375 px.

### 6.4 Alignement avec le design Zenith

- [ ] Utiliser l’émeraude pour les actions principales et la sélection.
- [ ] Réserver le bleu à l’information et aux diffusions.
- [ ] Réserver le rouge aux erreurs et actions destructrices.
- [ ] Réserver l’ambre à la supervision et aux avertissements.
- [ ] Utiliser les tokens du thème plutôt que des couleurs Tailwind codées directement.
- [ ] Conserver Lucide comme bibliothèque d’icônes.
- [ ] Éviter les animations pulsantes permanentes.
- [ ] Utiliser des transitions de 150 à 300 ms sans déplacement de mise en page.

### 6.5 Utiliser shadcn/ui

Remplacer les éléments manuels par les composants déjà présents :

- [x] `Dialog` pour l’aperçu des images jointes ;
- [x] `Button` pour les actions ;
- [x] navigation sémantique adaptée ;
- [x] `Select` pour le destinataire ;
- [x] `Textarea` pour la composition ;
- [x] `Badge` pour les statuts ;
- [x] `Skeleton` pour les chargements ;
- [x] `EmptyState` pour les listes vides.

### 6.6 Découper le composant monolithique

Structure proposée :

- `MessagingDialog.tsx`
- `MessagingSidebar.tsx`
- `MessageList.tsx`
- `MessageListItem.tsx`
- `MessageDetail.tsx`
- `MessageComposer.tsx`
- `MessageAttachment.tsx`
- `MessageTemplatesPanel.tsx`
- `MessagingAdminPanel.tsx`
- hooks dédiés aux données et au temps réel

Le découpage exact devra respecter les conventions constatées au moment de l’implémentation.

---

## 7. Accessibilité

- [ ] Utiliser le pattern ARIA approprié pour la navigation.
- [ ] Ajouter un `aria-label` à chaque bouton icône.
- [ ] Rendre toutes les actions disponibles au clavier et au tactile.
- [ ] Utiliser des cibles interactives d’au moins 44 × 44 px.
- [ ] Fournir des focus rings visibles.
- [ ] Éviter les textes essentiels de 9 ou 10 px.
- [ ] Ne pas utiliser uniquement la couleur pour indiquer un statut.
- [ ] Respecter `prefers-reduced-motion`.
- [ ] Piéger correctement le focus dans les dialogues.
- [ ] Restaurer le focus à la fermeture.
- [ ] Tester avec lecteur d’écran et navigation clavier.
- [ ] Garantir un contraste d’au moins 4,5:1 pour le texte courant.

---

## 8. Internationalisation

Les chaînes visibles suivantes sont actuellement codées directement dans le composant et doivent être traduites en français et en anglais :

- « Messages non lus » ;
- « non lu(s) » ;
- « Pièce jointe » ;
- « Voir la pièce jointe » ;
- « Supervision – Tous les messages » ;
- « Réponse à » ;
- « Joindre un fichier ou une image » ;
- textes alternatifs et libellés accessibles associés.

Checklist :

- [ ] Recenser toutes les chaînes visibles.
- [ ] Ajouter les clés françaises.
- [ ] Ajouter les clés anglaises.
- [ ] Gérer correctement les pluriels i18next.
- [ ] Vérifier visuellement les deux langues.

---

## 9. États d’interface à ajouter

- [x] Chargement initial avec skeleton.
- [x] Rafraîchissement discret sans effacer la liste.
- [x] Erreur de chargement avec nouvelle tentative.
- [ ] Envoi en cours.
- [ ] Échec d’envoi avec conservation du brouillon.
- [ ] Téléversement en cours.
- [ ] Erreur de pièce jointe.
- [x] État vide après filtre.
- [x] Fin de pagination.
- [ ] État hors ligne ou WebSocket déconnecté.

---

## 10. Architecture conversationnelle — Option ultérieure

Deux stratégies sont possibles.

### Option A — Évolution légère recommandée à court terme

Conserver `InternalMessage` et regrouper visuellement les messages par interlocuteur ou fil parent.

**Avantages**

- migration limitée ;
- compatibilité avec les messages existants ;
- risque de production réduit.

**Limites**

- modèle moins adapté aux discussions longues ;
- non-lus par conversation plus complexes.

### Option B — Vraies conversations

Introduire notamment :

- `Conversation` ;
- `ConversationParticipant` ;
- rattachement des messages à une conversation ;
- compteur ou curseur de lecture par participant.

**Avantages**

- architecture propre pour un véritable chat ;
- regroupement, recherche et non-lus plus fiables.

**Risques**

- migration des messages existants ;
- évolution importante du contrat API ;
- gestion spécifique des diffusions ;
- risque de régression plus élevé.

**Recommandation**

Ne pas commencer par cette migration. Sécuriser, refondre l’UI, paginer et mettre en place le temps réel avant de décider si une vraie entité `Conversation` est nécessaire.

---

## 11. Plan d’implémentation proposé

### Phase 1 — Sécurisation et contrat — Terminée

- [x] contrôle de la suppression physique des messages ;
- [x] restriction des diffusions au staff ;
- [x] validation de l’accès au message parent ;
- [x] permissions des modèles globaux ;
- [x] validation initiale des pièces jointes ;
- [x] protection authentifiée des médias et validation de signature ;
- [x] filtrage frontend par IDs ;
- [x] nettoyage des types TypeScript ;
- [x] tests backend ciblés.

**Risque : modéré.** Le contrat principal peut être conservé.

### Phase 2 — Refonte UI shadcn — Terminée

- [x] découpage du composant monolithique ;
- [x] nouvelle structure liste/détail/composition ;
- [x] composants shadcn ;
- [x] alignement visuel Zenith ;
- [x] navigation responsive liste/détail ;
- [x] accessibilité des actions et dialogues ;
- [x] traductions fr/en.

**Risque : modéré**, principalement visuel et comportemental.

### Phase 3 — Pagination et cache — Terminée

- [x] pagination serveur par boîte ;
- [x] recherche et filtres backend composables ;
- [x] cache et invalidations React Query ;
- [x] cache séparé pour utilisateurs et modèles ;
- [x] tests multi-pages et contrôle indépendant.

**Risque : modéré à élevé** selon les données de production.

### Phase 4 — Temps réel Channels

- consumer de messagerie ;
- authentification et groupes utilisateur ;
- événements après commit ;
- reconnexion ;
- polling de secours ;
- tests WebSocket.

**Risque : élevé**, car l’infrastructure temps réel est concernée.

### Phase 5 — Conversations structurées, si validées

- nouveaux modèles ;
- migration des données ;
- nouveau contrat API ;
- adaptation frontend ;
- tests de migration et de régression.

**Risque : élevé.**

---

## 12. Stratégie de tests

### Backend

- [ ] Un utilisateur voit uniquement son périmètre autorisé.
- [ ] Un utilisateur ne supprime pas un message reçu ou diffusé globalement.
- [ ] Un expéditeur peut effectuer les actions autorisées.
- [ ] Un parent inaccessible est rejeté.
- [ ] Les lectures de diffusion sont individuelles.
- [ ] Les archives sont individuelles.
- [ ] Les permissions des modèles sont respectées.
- [ ] Les pièces jointes invalides sont rejetées.
- [x] Les compteurs de non-lus sont corrects.
- [x] La pagination et les filtres sont cohérents.

### Frontend

- [ ] Chargement et affichage de la boîte de réception.
- [ ] Lecture, réponse, archivage et restauration.
- [ ] Envoi individuel et diffusion.
- [ ] Prévention des doubles envois.
- [ ] Conservation du brouillon après erreur.
- [ ] Pagination ou défilement infini.
- [ ] États de chargement, vide et erreur.
- [ ] Navigation clavier.
- [ ] Traductions françaises et anglaises.

### Vérifications finales

- [ ] `npm run build`
- [ ] typecheck frontend
- [ ] lint frontend pertinent
- [ ] tests backend ciblés avec `--noinput`
- [ ] tests frontend pertinents
- [ ] responsive à 375, 768, 1024 et 1440 px
- [ ] thème clair et thème sombre
- [ ] vérification du contrat backend/frontend
- [ ] mise à jour de `CHANGELOG.md`

---

## 13. Décisions à valider avant implémentation

- [ ] Refonte légère conservant `InternalMessage`, ou ajout immédiat de conversations ?
- [ ] Les modèles sont-ils globaux, personnels ou mixtes ?
- [ ] Qui peut envoyer une diffusion à tous les utilisateurs ?
- [ ] Qui peut accéder à la supervision ?
- [ ] Quelles pièces jointes sont autorisées et avec quelle taille maximale ?
- [ ] Quelle durée de conservation des messages et pièces jointes ?
- [ ] La suppression doit-elle être impossible, logique ou physique ?
- [ ] Faut-il des accusés de lecture individuels visibles pour les diffusions ?

## 14. Recommandation finale

Ordre conseillé :

1. sécuriser le backend ;
2. refondre l’interface avec shadcn/ui ;
3. ajouter pagination, recherche et cache ;
4. intégrer Channels pour le temps réel ;
5. évaluer ensuite le besoin d’une vraie entité `Conversation`.

L’ensemble pourrait toucher environ 10 à 18 fichiers critiques. Toute implémentation doit donc être découpée par phase, validée avant modification et vérifiée à chaque étape afin de limiter les régressions en production.
