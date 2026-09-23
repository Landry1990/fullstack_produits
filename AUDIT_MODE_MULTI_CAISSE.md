# Audit du mode multi-caisse et encaissement direct

**Date : 22 septembre 2026**  
**État : chantier différé — ne pas activer en production avant correction**  
**Note actuelle du mode : 5,5/10**

## Objectif métier

Certaines pharmacies ne souhaitent pas utiliser une caisse centrale. Chaque poste doit alors :

1. ouvrir sa propre session avec un fond de caisse ;
2. réaliser les ventes ;
3. encaisser immédiatement les clients ;
4. conserver des recettes strictement séparées des autres postes ;
5. compter sa caisse et saisir son billetage en fin de service ;
6. enregistrer une clôture formelle avec le montant théorique, le montant réel et l’écart.

Configuration envisagée :

```text
Multi-caisse : activé
Caisse centrale : désactivée
```

## Verdict de l’audit

Le moteur backend d’encaissement direct existe et fonctionne lorsqu’il est appelé explicitement. Il sait valider une facture, décrémenter le stock et créer immédiatement les paiements.

Cependant, l’option n’est pas correctement reliée au parcours réel de Facturation. La fermeture d’un poste direct n’est pas non plus une clôture comptable complète. Le mode ne doit donc pas être activé chez un client dans son état actuel.

## Éléments fonctionnels existants

- Modèles `PosteCaisse` et `PosteVente`.
- Ouverture d’un point de vente par utilisateur.
- Unicité pratique d’une session POS active par utilisateur.
- Rattachement des factures à `PosteVente`.
- Validation atomique des ventes.
- Décrémentation des stocks et gestion des lots.
- Création immédiate des paiements lorsque `centralized=False`.
- Paiements multiples.
- Vérification que le vendeur ne peut pas utiliser le poste direct d’un autre utilisateur.
- Protection contre les doubles soumissions par idempotence.
- Calcul d’un récapitulatif lors de la fermeture d’un poste.

## Problèmes identifiés

### 1. Le réglage n’est pas appliqué par Facturation

`frontend/frontend/src/hooks/useMultiCaisse.ts` initialise toujours :

```ts
centralizedCashRegister = true
```

Le hook ne charge pas `InvoiceSettings.centralized_cash_register`. Décocher « Caisse centralisée » dans les paramètres ne modifie donc pas le parcours de vente frontend.

`is_multi_caisse` est également déduit du nombre de postes actifs au lieu d’être piloté par la configuration.

### 2. Le navigateur choisit le mode envoyé au backend

Dans `backend/api/views/ventes/facture_mixins/sales_actions.py`, le mode est déterminé avec :

```python
centralized = data.get('centralized_cash_register', True)
```

Le backend ne lit pas `InvoiceSettings`. Un client HTTP modifié peut donc choisir lui-même le mode de traitement.

La configuration serveur doit être la seule source de vérité.

### 3. La fermeture directe n’est pas une clôture comptable

`PosteVenteViewSet.fermer` :

- calcule le montant encaissé ;
- ferme la session ;
- retourne un récapitulatif.

Mais il ne demande pas :

- le montant réellement compté ;
- le billetage ;
- une observation en cas d’écart.

Il ne crée pas non plus de `ClotureCaisse`. Un vendeur peut donc fermer un poste sans rapprochement entre l’argent physique et le système.

### 4. Les clôtures formelles ne sont pas isolées par session POS

La clôture actuelle filtre principalement par :

- utilisateur ;
- période ;
- éventuellement caisse physique (`PosteCaisse`).

Elle ne filtre pas par session `PosteVente`. Or un POS direct n’a pas de caisse physique. Plusieurs sessions directes d’un même utilisateur peuvent être mélangées.

Autres incohérences associées :

- la dernière clôture est recherchée par utilisateur, pas par session ;
- la détection des périodes en doublon est faite par utilisateur ;
- les mouvements manuels ne sont pas systématiquement filtrés par poste ;
- deux caisses physiques d’un même utilisateur peuvent entrer en conflit sur des périodes qui se chevauchent.

### 5. Le paiement peut être attribué au validateur sudo

En mode direct, `_handle_payments` crée `Caisse.user` avec `validation_user`.

Si un superviseur autorise une opération par sudo, le paiement peut être attribué au superviseur au lieu du vendeur propriétaire du poste. Les recettes et clôtures par caissier peuvent alors devenir incorrectes.

Le paiement doit appartenir au vendeur/session. Le validateur sudo doit rester enregistré séparément dans `Facture.validated_by`.

### 6. Permissions backend trop permissives

Plusieurs endpoints utilisent uniquement `IsAuthenticated` :

- modification de `InvoiceSettings` ;
- création et modification des caisses physiques ;
- création, activation et fermeture des postes de vente.

Les modifications de configuration doivent être réservées aux superusers. Les opérations sur une session doivent être limitées à son propriétaire ou à un superviseur autorisé.

### 7. Sélecteur de poste trompeur dans le paiement

En mode direct, `PaymentModal` peut afficher plusieurs POS. Cliquer sur un POS sans caisse physique ne modifie pas réellement `activePoste`. La vente utilise toujours `myActivePoste`.

Le mode direct doit afficher uniquement la session active du vendeur, sans sélection d’un autre poste.

### 8. Tests incomplets pour le mode réel

Les tests backend existants valident le moteur lorsqu’on force `centralized=False`, mais ils ne couvrent pas :

- le câblage du réglage jusqu’au frontend ;
- l’autorité de la configuration backend ;
- deux POS directs actifs simultanément ;
- la clôture comptable indépendante de chaque POS ;
- l’attribution correcte lorsque le validateur sudo diffère du vendeur.

## Vérifications réalisées

Les suites suivantes ont été exécutées :

```text
api.tests.test_facturation
api.tests.test_cash_closure
api.tests.test_caisse_integrity
api.tests.test_caisse_multi_payment
api.tests.test_caisse_overpayment
```

Résultat : **50 tests réussis**.

Ce résultat confirme la stabilité des briques existantes, mais pas l’effectivité de l’option dans le parcours utilisateur complet.

Configuration locale observée au moment de l’audit :

```text
is_multi_caisse = True
centralized_cash_register = True
postes physiques = 5
sessions actives = 0
```

## Architecture cible

En mode direct, chaque poste doit suivre ce cycle :

1. Le vendeur ouvre un `PosteVente` avec un fond de caisse.
2. Le backend vérifie que la configuration autorise l’encaissement direct.
3. Chaque facture est rattachée à cette session.
4. Chaque paiement est créé immédiatement et attribué au propriétaire de la session.
5. Les mouvements de caisse sont rattachés à la même session.
6. La fermeture ouvre un formulaire de clôture.
7. Le vendeur saisit le billetage et le montant réel.
8. Le backend recalcule le théorique exclusivement pour cette session.
9. Une `ClotureCaisse` est créée avec l’écart et l’audit.
10. Le `PosteVente` est fermé uniquement après réussite de la clôture.

## Plan de correction

### Lot 1 — Appliquer réellement la configuration

Frontend :

- charger `InvoiceSettings` dans `useMultiCaisse` ;
- utiliser `is_multi_caisse` et `centralized_cash_register` ;
- attendre le chargement des réglages avant d’autoriser une vente ;
- rafraîchir la configuration après sa modification.

Backend :

- lire `InvoiceSettings.centralized_cash_register` lors de la finalisation ;
- ne plus faire confiance au booléen envoyé par le frontend ;
- utiliser éventuellement la valeur frontend uniquement pour détecter une incohérence.

### Lot 2 — Sécuriser l’encaissement direct

- Exiger une session `PosteVente` active.
- Vérifier que `mode_pos=True`.
- Vérifier que le poste appartient à l’utilisateur connecté.
- Refuser toute vente sur une session fermée.
- Rattacher facture et paiements à la session.
- Attribuer `Caisse.user` au propriétaire du poste.
- Conserver le validateur sudo séparément.

### Lot 3 — Créer une vraie clôture par session

Ajouter à `ClotureCaisse` une relation vers `PosteVente` :

```python
poste_vente = models.ForeignKey(
    PosteVente,
    null=True,
    blank=True,
    on_delete=models.SET_NULL,
    related_name='clotures',
)
```

Il faudra également décider comment rattacher les mouvements manuels à la session. La solution recommandée est d’ajouter une relation `poste_vente` à `MouvementCaisse`.

La clôture doit filtrer les paiements avec :

```python
facture__poste_vente=poste
```

Calcul espèces recommandé :

```text
Fond initial
+ paiements en espèces
+ entrées manuelles en espèces
- sorties manuelles en espèces
= espèces théoriques
```

Les paiements carte, Mobile Money et Orange Money doivent apparaître dans le récapitulatif, mais ne doivent pas augmenter le montant physique attendu dans le tiroir.

### Lot 4 — Sécuriser les permissions

| Action | Autorisation recommandée |
|---|---|
| Modifier le mode caisse | Superuser |
| Créer ou supprimer un poste | Superuser |
| Ouvrir un poste disponible | Vendeur autorisé |
| Fermer son propre poste | Propriétaire du poste |
| Fermer le poste d’un autre | Superuser ou sudo |
| Voir les recettes d’un autre poste | Permission `can_view_cash_totals` |
| Réaliser une clôture | Propriétaire ou superviseur autorisé |

### Lot 5 — Corriger l’interface

- N’afficher que le poste actif du vendeur en mode direct.
- Supprimer le sélecteur de POS trompeur.
- Afficher le nom du poste, le vendeur, l’heure d’ouverture et le mode actif.
- Masquer la caisse centrale lorsqu’elle est désactivée.
- Bloquer la vente tant que le poste n’est pas ouvert.
- Remplacer la fermeture immédiate par une fenêtre shadcn de clôture avec billetage, montant réel et observation.

### Lot 6 — Ajouter les tests critiques

1. Deux vendeurs ouvrent deux POS simultanément.
2. Chaque vendeur réalise et encaisse une vente.
3. Chaque paiement appartient au bon poste et au bon vendeur.
4. Les totaux restent strictement séparés.
5. Un vendeur ne peut pas utiliser le poste de l’autre.
6. Un validateur sudo ne récupère pas la recette du vendeur.
7. Une fermeture sans comptage réel est refusée.
8. Le billetage et l’écart sont enregistrés.
9. Une session clôturée ne peut plus recevoir de vente.
10. Une seconde clôture de la même session est refusée.
11. Le mode central continue de fonctionner après les changements.
12. Le backend ignore les tentatives du navigateur de contourner le réglage.

## Fichiers principaux concernés lors de la reprise

### Backend

- `backend/api/models/billing.py`
- nouvelle migration Django
- `backend/api/models/settings.py`
- `backend/api/views/settings.py`
- `backend/api/views/ventes/facture_mixins/sales_actions.py`
- `backend/api/services/sale_finalizer.py`
- `backend/api/views/ventes/caisse_poste.py`
- `backend/api/views/ventes/caisse_mixins/cloture_mixin.py`
- serializers des postes, paiements et clôtures
- tests facturation/caisse + nouveaux tests multi-POS

### Frontend

- `frontend/frontend/src/hooks/useMultiCaisse.ts`
- `frontend/frontend/src/hooks/useInvoiceSettings.ts`
- `frontend/frontend/src/hooks/useFacturationState.ts`
- `frontend/frontend/src/context/PosteCaisseModeContext.tsx`
- `frontend/frontend/src/components/facturation/PaymentModal.tsx`
- `frontend/frontend/src/components/facturation/FacturationModals.tsx`
- `frontend/frontend/src/components/Layout.tsx`
- nouvelle fenêtre shadcn de clôture POS
- réglages et traductions fr/en

## Risques du chantier

- Régression du mode caisse centrale actuellement utilisé.
- Mélange de recettes entre anciennes et nouvelles sessions.
- Double clôture si la contrainte d’unicité n’est pas correctement définie.
- Mauvaise attribution des paiements existants pendant la transition.
- Migration des clôtures historiques sans `PosteVente`.
- Incohérence entre paiements électroniques et espèces physiques.

## Stratégie de mise en œuvre recommandée

1. Écrire les tests du comportement cible.
2. Câbler et sécuriser la configuration.
3. Corriger l’attribution vente/paiement/session.
4. Ajouter les relations et migrations de clôture.
5. Implémenter la clôture POS complète.
6. Corriger les permissions.
7. Adapter l’interface et les traductions.
8. Rejouer tous les tests de caisse centrale.
9. Tester manuellement avec deux navigateurs et deux utilisateurs.
10. Déployer uniquement dans une pharmacie pilote.

## Décision actuelle

Le chantier est volontairement reporté. Jusqu’à sa reprise :

- conserver `centralized_cash_register=True` ;
- ne pas proposer l’encaissement direct comme option opérationnelle chez un client ;
- ne pas considérer la simple fermeture de `PosteVente` comme une clôture comptable.
