

Spécifications Techniques : Moteur de Calcul
## Restock
Modélisation mathématique et algorithmique pour la génération automatisée des
commandes
Ce document détaille les fondements mathématiques et logiques du moteur de réapprovisionnement
automatisé. Conçu pour répondre aux exigences de rigueur et de fiabilité des clients les plus pointilleux, ce
modèle articule trois axes de performance majeurs : la  fiabilité   absolue   des   données, la     simplicité
opérationnelle et l'automatisation intelligente des tâches à faible valeur ajoutée.
- Le Cœur du Moteur : La Formule Étalon
Pour assurer une couverture des stocks optimale sans générer de surstockage coûteux, la quantité
commandée repose sur la détermination d'un  Stock   Objectif  théorique calculé en fonction du cycle
d'exploitation, duquel est soustrait le stock immédiatement disponible.
## Q
commander
## = Stock Objectif − Stock Disponible
En développant l'intégralité des variables de flux et de couverture logistique, la formule maîtresse s'établit
comme suit :
## Q
commander
## = [ VMD
ajustée
## × (D
livraison
## + D
couverture
## ) ] + S
sécurité
## − S
restant
Documentation Technique - Algorithme de Réapprovisionnement & Seuils Dynamiques1 / 4

Dictionnaire des Variables Éléments :
VariableUnitéDescription Fonctionnelle
## VMD
ajustée
Unités / jour
Vitesse Moyenne de Rotation ajustée selon les tendances
et la saisonnalité prévisionnelle.
## D
livraison
## Jours
Délai moyen constaté entre la validation de la commande
et la réception physique en stock.
## D
couverture
## Jours
Période cible de vente que la commande doit couvrir
(autonomie souhaitée).
## S
sécurité
## Unités
Stock tampon destiné à absorber les anomalies de
livraison et les pics de demande.
## S
restant
## Unités
Stock physique réel disponible en magasin (ou en transit
valorisé).
- Modélisation des Seuils Dynamiques (Min / Max)
Plutôt que de figer arbitrairement des valeurs empiriques fixes « à la volée », le système recalcule de manière
autonome les seuils critiques pour optimiser la trésorerie et éliminer le risque de rupture de stock.
A. Le Stock Minimum (Seuil d'Alerte Logistique)
Il représente le point critique en deçà duquel une commande doit immédiatement être déclenchée pour
couvrir la consommation pendant le délai d'approvisionnement du fournisseur.
Stock Minimum = (VMD
ajustée
## × D
livraison
## ) + S
sécurité
B. Le Stock Maximum (Plafond de Protection Financière)
Il s'agit du niveau supérieur destiné à brider les propositions d'achat afin de surcharger inutilement l'espace
de stockage et de pénaliser la trésorerie de l'entreprise.
Stock Maximum = Stock Minimum + (VMD
ajustée
## × D
couverture
## )
- L'Ajustement Prévisionnel (Intelligence Métier)
Une simple moyenne historique induit des ruptures lors des hausses d'activité ou des surstocks lors des
baisses. Le modèle intègre donc un facteur dynamique d'ajustement :
Documentation Technique - Algorithme de Réapprovisionnement & Seuils Dynamiques2 / 4

## VMD
ajustée
## = VMD
historique
## × K
ajustement
Où le coefficient K
ajustement
est déterminé par deux composantes majeures :
L'indice de saisonnalité : Analyse comparative de la même période sur les années N-1 et N-2 (ex: pics
de pathologies saisonnières).
La tendance court terme : Accélération ou décélération des ventes observée sur les 4 dernières
semaines.
- Modélisation du Stock de Sécurité Prévoyant
Pour éliminer toute approche empirique, le stock de sécurité est indexé sur la fragilité de la chaîne
d'approvisionnement (retards fournisseurs fréquents) :
## S
sécurité
## = VMD
ajustée
× Marge de Retard
Exemple : Si un fournisseur livre habituellement en 7 jours mais présente ponctuellement des retards de 2
jours, la Marge de Retard est fixée à 2. Le système garantit ainsi la continuité de service sans surcharger
l'entrepôt.
- Architecture de l'Algorithme de Décision Élargi
Le pseudo-code ci-dessous illustre le traitement automatisé incluant la détection des alertes de seuil et la
suggestion d'achat :
## •
## •
Documentation Technique - Algorithme de Réapprovisionnement & Seuils Dynamiques3 / 4

Posture face au client exigeant : Le mode "Suggestion Approuvée"
Il est capital de valoriser le fait que l'algorithme ne court-circuite pas la décision humaine. Le système
génère une  proposition   optimisée   en   un   clic. L'acheteur garde le contrôle souverain (validation,
ajustement manuel ou rejet), alliant la puissance de l'automatisation à la sécurité métier.
POUR CHAQUE produit X DU catalogue :
// 1. Extraction et lissage des données sources
VMD_historique = Ventes_90_derniers_jours / 90
VMD_ajustee = VMD_historique * K_ajustement
// 2. Recalcul Dynamique des Seuils Critiques
Stock_Securite = VMD_ajustee * Marge_Retard_Fournisseur
Stock_Minimum  = (VMD_ajustee * Delai_Livraison) + Stock_Securite
Stock_Maximum  = Stock_Minimum + (VMD_ajustee * Delai_Couverture)
// 3. Analyse du besoin et arbitrage de commande
SI Stock_Restant <= Stock_Minimum ALORS
// Le niveau d'alerte est atteint : calcul pour atteindre la cible idéale
Stock_Objectif = Stock_Maximum
Besoin_Net = Stock_Objectif - Stock_Restant
Quantite_Proposee = Arron_Conditionnement_Fournisseur(Besoin_Net)
Generer_Suggestion_Commande(produit X, Quantite_Proposee, "Alerte Seuil Minimum")
## SINON
Quantite_Proposee = 0 // Couverture sécurisée en cours
## FIN SI
Documentation Technique - Algorithme de Réapprovisionnement & Seuils Dynamiques4 / 4