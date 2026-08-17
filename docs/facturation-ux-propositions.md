# Propositions d'améliorations UI/UX — Facturation

Fichier de travail listant les pistes d'amélioration de l'expérience utilisateur sur l'écran de facturation.

## 1. Recherche produit (`ProductSearchSection`)

- Placeholder contextuel avec exemple de produit + raccourci (`F2`).
- Squelette de chargement pendant la recherche produit (image, nom, prix).
- Navigation clavier : `↑`/`↓` dans le dropdown + `Entrée` pour ajouter au panier.
- Section "Derniers produits vendus" quand le champ est vide.
- Badge stock faible (orange/rouge) directement dans les résultats.

## 2. Panier (`CartTable` / `CartRow`)

- Total par ligne au survol.
- Modification rapide de quantité au clavier (`Ctrl+↑` / `Ctrl+↓` ou champ direct).
- Feedback visuel à l'ajout d'un produit (animation/couleur).
- Réordonnancement drag & drop des lignes si besoin.
- Affichage prix barré et prix net en promotion.

## 3. Totaux (`TotalsSection`)

- Total TTC en gros format et plus contrasté.
- Répartition assurance / patient avec barre visuelle ou badges couleur.
- Boutons de remise rapide (5% / 10% / 15%).
- Avertissement si remise > plafond autorisé.

## 4. Boutons d'action (`ActionButtons`)

- Groupement visuel par usage : Valider (principal), Documents, Gestion.
- Tooltips avec raccourcis (`F9`, `F10`, `F8`) au survol.
- Bouton Valider sticky en bas si le panier est long.
- État désactivé explicite avec message quand la validation n'est pas possible.

## 5. Paiement / Encaissement (`PaymentModal`)

- Boutons de montants arrondis et calcul du rendu automatique.
- Modes de paiement favoris en premier.
- Validation par `Entrée`.
- Bordure rouge si le montant versé est insuffisant.

## 6. Modales et alertes

- Option "Ne plus afficher pour cette session" sur les alertes produit.
- Feedback sonore + visuel sur le scanner d'ordonnance.
- Focus automatique sur le bouton principal des modales de confirmation.

## 7. Ventes en attente (`PendingSalesDrawer`)

- Aperçu article + total au survol.
- Couleur ou badge par opérateur/vendeur.
- Badge de durée ("il y a 5 min") pour repérer les vieilles ventes.

## 8. Général / fluidité

- Feedback sonore ou vibration (mobile) à l'ajout d'un produit.
- Raccourci `?` pour afficher la liste des raccourcis.
- Thème sombre cohérent (dark mode actuellement problématique).
- Transitions douces entre panier, paiement et ticket.
