# Évaluation terrain des suggestions de commandes

## Objectif

Évaluer automatiquement la qualité de l’algorithme de suggestion de commandes dans les conditions réelles de la pharmacie, sans créer ni transmettre automatiquement de commande pendant la phase d’observation.

L’évaluation doit répondre à trois questions :

1. Le système propose-t-il le bon produit ?
2. Propose-t-il la bonne quantité ?
3. Le propose-t-il au bon moment et au bon fournisseur ?

## Principe retenu : mode observation (« shadow mode »)

Le moteur produit et conserve ses recommandations, mais celles-ci n’ont aucun effet automatique sur le stock, les commandes ou la télétransmission.

Le pharmacien continue de préparer et valider ses commandes normalement. Le système compare ensuite :

- la suggestion originale de l’algorithme ;
- la décision du pharmacien ;
- la consommation et les événements réellement constatés jusqu’à la fin du cycle.

La suggestion originale doit être figée afin qu’une modification ultérieure du stock ou de l’algorithme ne change pas rétroactivement l’évaluation.

## Déroulement automatique d’un cycle

### 1. Ouverture du cycle

Lors de chaque génération de suggestions, enregistrer un instantané comprenant au minimum :

- date et heure de génération ;
- utilisateur et fournisseur sélectionné ;
- mode et version de l’algorithme ;
- période d’analyse et couverture demandée ;
- budget éventuel ;
- stock physique et stock vendable ;
- ventes sur 7, 30 et 90 jours ;
- stock minimum et maximum du produit ;
- quantités déjà commandées et non reçues ;
- promis clients en attente ;
- délai et marge de retard du fournisseur ;
- prix d’achat utilisé ;
- rupture fournisseur connue ;
- quantité brute calculée ;
- quantité après contraintes de budget ou conditionnement ;
- score, urgence et explication du calcul.

### 2. Observation de la décision humaine

Lors de la création ou validation de la commande, enregistrer :

- quantité proposée ;
- quantité finalement commandée ;
- produit ajouté manuellement alors qu’il n’était pas suggéré ;
- produit suggéré puis supprimé ;
- changement de fournisseur ;
- prix et conditionnement retenus ;
- motif de modification lorsqu’il est renseigné.

Les motifs possibles pourront inclure :

- surstock estimé ;
- produit vital ;
- rupture fournisseur ;
- colisage ou minimum fournisseur ;
- prix trop élevé ;
- saisonnalité ou épidémie ;
- demande client/promis ;
- produit dormant ;
- erreur de stock ;
- autre.

Le motif ne doit pas être obligatoire pendant la première phase pilote afin de ne pas ralentir le travail du pharmacien.

### 3. Suivi du cycle

Jusqu’à la prochaine commande ou jusqu’à l’horizon défini, suivre :

- ventes réellement effectuées ;
- promis délivrés ou annulés ;
- réceptions totales et partielles ;
- retards ou non-livraisons ;
- ruptures de stock ;
- corrections et inventaires ;
- retours, avaries et péremptions ;
- transferts de stock ;
- annulations de ventes ou commandes ;
- changement de fournisseur ou de conditionnement.

### 4. Clôture et notation

À la fin du cycle, simuler le résultat de la recommandation :

```text
stock simulé = stock initial vendable
             + quantité suggérée reçue
             - consommation réelle
             - promis servis
             ± événements de stock admissibles
```

Classer chaque ligne :

- correcte ;
- produit oublié ;
- sous-commande ;
- surcommande ;
- doublon avec une commande en cours ;
- rupture malgré suggestion ;
- stock dormant probable ;
- mauvais fournisseur ;
- quantité incompatible avec le colisage ;
- non évaluable en raison d’un événement exceptionnel.

## Deux mesures à conserver séparément

### Adhésion humaine

Mesure l’écart entre la suggestion et la commande validée par le pharmacien.

Cette mesure indique la confiance et l’utilité perçue, mais ne prouve pas que l’algorithme ou le pharmacien avait raison.

### Performance réelle

Mesure le résultat de la suggestion face à la consommation et aux événements réellement observés après sa génération.

C’est cette mesure qui doit déterminer la fiabilité de l’algorithme.

## Événements perturbateurs

Les cycles suivants ne doivent pas être comptés comme des erreurs ordinaires :

- inventaire ou correction importante de stock ;
- transfert exceptionnel ;
- commande non reçue ou reçue partiellement ;
- retard fournisseur anormal ;
- rupture fournisseur ;
- produit désactivé ou remplacé ;
- modification de conditionnement ;
- retour, avarie ou péremption ;
- campagne sanitaire ou pic exceptionnel identifié ;
- panne ou période de données incomplètes.

Ils doivent être marqués « perturbés » et rester consultables séparément.

## Indicateurs du tableau de bord

- taux de produits correctement proposés ;
- taux de suggestions acceptées sans modification ;
- taux de produits ajoutés manuellement ;
- erreur absolue moyenne sur les quantités ;
- biais moyen de surcommande ou sous-commande ;
- ruptures évitables ;
- ruptures que la suggestion aurait provoquées ;
- valeur du surstock simulé ;
- argent immobilisé ;
- couverture réelle après réception ;
- produits dormants générés ;
- doublons avec commandes en cours ;
- performance par fournisseur, rayon, classe ABC et produit ;
- performance par version de l’algorithme ;
- proportion de cycles perturbés ou non évaluables.

## Failles à corriger ou mesurer en priorité

1. Les commandes `PREP` et `ATT` ne sont pas déduites du besoin dans le moteur de suggestion.
2. Les promis sont affichés mais ne modifient pas la quantité suggérée.
3. Le cache du mode ventes horaires n’inclut pas les dates de début et de fin.
4. Une rupture fournisseur reste proposée et sélectionnée par défaut.
5. Le fournisseur demandé n’est pas toujours celui dont les délais sont utilisés.
6. Le mode simple et le mode cumulatif remplacent les ventes sans soustraire le stock restant.
7. Les seuils `stock_minimum` et `stock_maximum` ne sont pas intégrés au moteur intelligent.
8. `round()` peut transformer un besoin positif de 0,5 unité en zéro.
9. Les colisages et minimums de commande fournisseur ne sont pas gérés.
10. Le budget privilégie le volume vendu plutôt que la criticité et peut être dépassé de 5 %.
11. La saisonnalité est encore fixée à 1.
12. Les périodes sans stock réduisent artificiellement la demande observée.
13. L’ABC sur la marge peut écarter des produits indispensables à faible marge.
14. Les anciens lots peuvent faire croire qu’un produit est encore disponible chez un fournisseur.
15. Dans l’analyse séparée des ruptures, les commandes en cours sont ajoutées au besoin d’un produit déjà en rupture au lieu d’être soustraites.

## Formule cible à évaluer

```text
VMD prévisionnelle
  = combinaison pondérée VMD 7j / 30j / 90j
  × tendance plafonnée
  × saisonnalité
  × correction des jours de rupture

position de stock
  = stock vendable
  + commandes confirmées non reçues
  - promis et réservations
  - stock bloqué ou non vendable

stock de sécurité
  = sécurité liée à la variabilité de la demande
  + sécurité liée au délai et aux retards fournisseur

stock cible
  = demande prévue pendant le délai fournisseur
  + demande prévue jusqu’au prochain cycle de commande
  + couverture souhaitée
  + stock de sécurité

besoin net
  = max(0, stock cible - position de stock)

quantité finale
  = besoin net arrondi au colisage supérieur
  puis limité par stock maximum, péremption et budget
```

## Déploiement progressif

### Niveau 1 — Observation

- calcul et journalisation automatiques ;
- aucune influence sur la commande ;
- aucune télétransmission ;
- validation du protocole et de la qualité des données.

### Niveau 2 — Assistance

- suggestions visibles et modifiables ;
- validation humaine obligatoire ;
- explication de chaque quantité ;
- avertissements pour commandes en cours, promis et ruptures fournisseur.

### Niveau 3 — Automatisation encadrée

À envisager seulement pour les produits ayant démontré une fiabilité suffisante, par exemple :

- au moins huit cycles évalués ;
- aucune rupture grave provoquée ;
- erreur moyenne sous le seuil retenu ;
- fournisseur suffisamment fiable ;
- exclusion initiale des produits vitaux, thermosensibles ou très coûteux ;
- possibilité permanente de validation et d’arrêt manuel.

## Architecture envisagée

Prévoir :

- une session d’évaluation par génération ;
- une ligne d’évaluation par produit ;
- un instantané immuable des données et paramètres ;
- un identifiant/version de l’algorithme ;
- le lien éventuel avec la commande et sa ligne ;
- un service quotidien de suivi et de clôture ;
- un tableau de bord d’évaluation ;
- une durée de conservation configurable, initialement 12 mois.

La conception détaillée devra vérifier les modèles et mouvements de stock existants avant de créer la migration.

## Plan de reprise

1. Cartographier précisément les événements de stock et les statuts de commande/réception.
2. Définir les modèles d’évaluation et les règles de clôture.
3. Présenter la migration et les impacts avant toute modification.
4. Implémenter d’abord les tests backend du mode observation.
5. Ajouter la capture immuable des suggestions.
6. Relier les décisions humaines et les commandes réelles.
7. Ajouter la clôture automatique des cycles.
8. Construire le tableau de bord et ses traductions fr/en.
9. Lancer un pilote sur un fournisseur et 50 à 100 références.
10. Examiner les premiers cycles avant toute automatisation opérationnelle.
