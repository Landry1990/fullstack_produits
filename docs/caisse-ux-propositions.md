# Propositions UI/UX - Caisse Centrale

> Analyse des frictions actuelles et plan d'amélioration du module **Caisse Centrale**.

---

## 1. Vue d'ensemble

Le module Caisse Centrale permet à la caissière de :
- Ouvrir/fermer une caisse physique.
- Visualiser les ventes en attente de règlement.
- Encaisser (espèces, carte, mobile money, coupons, dépôts).
- Appliquer des coupons monnaie.
- Consulter le récapitulatif live et le journal.

**Fichiers clés analysés :**
- `frontend/frontend/src/components/CaisseCentralisee.tsx`
- `frontend/frontend/src/components/caisse/CaisseHeader.tsx`
- `frontend/frontend/src/components/caisse/FacturesTable.tsx`
- `frontend/frontend/src/components/caisse/PaymentModal.tsx`
- `frontend/frontend/src/components/caisse/CaisseModals.tsx`
- `frontend/frontend/src/components/caisse/CaisseStatsCards.tsx`
- `frontend/frontend/src/components/caisse/OpenCashSessionModal.tsx`
- `frontend/frontend/src/components/caisse/SessionRecapBar.tsx`
- `frontend/frontend/src/hooks/useCaisseKeyboard.ts`
- `frontend/frontend/src/components/JournalCaisse.tsx`

---

## 2. Ce qui fonctionne déjà bien

- **Architecture modulaire** : `CaisseCentralisee` délègue à des sous-composants, modales lazy-loadées (`CaisseModals.tsx`).
- **Raccourcis clavier** : `↑↓`, `j/k`, `Enter`, `Espace`, `C`, `R`, `1-9`, `Esc`.
- **Stats cards** : indicateurs visuels clairs (factures en attente, montant total, coupons actifs).
- **Mode sécurité** : possibilité de masquer les montants aux caissières.
- **Récap live** : session en cours avec détails par mode de règlement.
- **Aperçu produits** : preview des articles d'une facture via `FacturesTable`.

---

## 3. Frictions identifiées

### 3.1 Tableau des factures (`FacturesTable.tsx`)

| Problème | Impact |
|----------|--------|
| 4 boutons d'action par ligne sans hiérarchie visuelle | Charge cognitive, risque de clic sur le mauvais bouton |
| Double-clic pour encaisser, simple clic pour sélectionner | Découverte difficile, confusion clavier/souris |
| Checkbox de masse rouge + ligne sélectionnée bleue | Double sémantique, confusion entre sélection et annulation |
| Pagination au-delà de 100 factures | Ralentissement à la caisse, besoin de navigation rapide |
| Date affichée sans format de locale unifiée | Risque de mauvaise interprétation AM/PM, timezone |
| Pas de tooltip sur les actions | Caissière doit deviner l'icône |

### 3.2 Modal de paiement (`PaymentModal.tsx`)

| Problème | Impact |
|----------|--------|
| Pas de validation globale par `Enter` | La caissiere doit cliquer ou tabber jusqu'au bouton |
| Pas de boutons de montants arrondis rapides | Saisie manuelle lente, risque d'erreur |
| Modes de paiement affichés à plat | Espèces/carte/mobile money non mis en avant |
| Rendu monnaie invisible avant d'ajouter un paiement | La caissiere ne sait pas combien rendre en temps réel |
| Zone "reste" en ambre au lieu de rouge vif | Signal visuel faible quand le montant est insuffisant |
| Focus mal orchestré entre montant, modes et valider | Perte de temps à la caisse |

### 3.3 Header & statut de caisse (`CaisseHeader.tsx`)

| Problème | Impact |
|----------|--------|
| Boutons mal groupés (session, coupons, vidange, sécurité) | Pas de hiérarchie d'action |
| État "caisse fermée" peu visible | Bouton vert "Ouvrir" seul, manque d'indicateur clair |
| Checkbox mode sécurité avec emojis et couleurs incohérentes | Aspect non professionnel, moins lisible |
| Pas de tooltip pédagogique | Formation difficile pour nouvelles caissières |

### 3.4 Raccourcis clavier (`useCaisseKeyboard.ts`)

| Problème | Impact |
|----------|--------|
| Pas de raccourci `?` pour l'aide | La caissiere doit chercher l'aide |
| `Home`/`End`, `PageUp`/`PageDown` non gérés | Navigation lente sur de longues listes |
| Ligne sélectionnée sans `focus`/`tabindex` | Mauvaise accessibilité, pas de retour visuel clair |

### 3.5 Ouverture de caisse (`OpenCashSessionModal.tsx`)

| Problème | Impact |
|----------|--------|
| Auto-open si une seule caisse disponible | Comportement surprenant, risque d'ouverture involontaire |
| Fond de caisse optionnel mais visuellement identique aux champs obligatoires | Confusion sur le caractère facultatif |
| `Enter` ne sélectionne pas la caisse | Navigation clavier incomplète |

### 3.6 Journal & clôture

- `JournalCaisse.tsx` est un assemblage de 4 composants sans transitions ni layout unifié.
- Le rapport de clôture doit être vérifié : le mode sécurité doit masquer tous les montants tout en conservant la confirmation de clôture.

---

## 4. Propositions d'amélioration

### 4.1 Quick wins (à implémenter en priorité)

#### P1 - PaymentModal : montants rapides + validation `Enter`
- Ajouter des boutons de montants rapides (`+500`, `+1000`, `+5000`, `+10000`, etc.).
- Autoriser `Enter` global pour valider dès que le total est atteint.
- Réorganiser les modes de paiement par fréquence : espèces, mobile money, carte, chèque, dépôt, coupon.
- Afficher le rendu monnaie en temps réel avant ajout.
- Bordure/background rouge vif si montant payé insuffisant.
- Focus automatique sur le bouton "Valider" quand le montant est atteint.

**Fichiers :** `PaymentModal.tsx`

#### P2 - FacturesTable : hiérarchiser les actions
- CTA principal `Encaisser` en bouton large et visible.
- Actions secondaires (modifier, annuler, coupon) regroupées dans un menu `…` ou sous forme d'icônes avec tooltip.
- Clic sur toute la ligne = ouvrir le paiement si caisse ouverte, sinon toast explicite.
- Ajouter des tooltips sur chaque action et sur le vendeur.
- Améliorer le contraste de la ligne sélectionnée (focus clavier).

**Fichiers :** `FacturesTable.tsx`

#### P3 - Aide clavier `?`
- Ajouter le raccourci `?` pour ouvrir une modale/liste des raccourcis caisse.
- Afficher la modale d'aide avec les raccourcis `Enter`, `Espace`, `C`, `R`, `1-9`, `↑↓`, `Esc`.

**Fichiers :** `useCaisseKeyboard.ts`, `CaisseCentralisee.tsx`

### 4.2 Améliorations moyennes

#### P4 - Refonte du `CaisseHeader`
- Grouper visuellement :
  - **Gauche** : titre + poste de caisse + statut.
  - **Centre** : actions de session (Ouvrir/Fermer).
  - **Droite** : actions secondaires (coupons, vidange, mode sécurité).
- Badge d'état plus visible (vert = ouverte, gris = fermée).
- Remplacer les emojis par des icônes `lucide-react` cohérentes.
- Afficher un message si aucune session active : "Ouvrez votre caisse pour encaisser".

**Fichiers :** `CaisseHeader.tsx`

#### P5 - Navigation table enrichie
- Ajouter `Home` / `End`, `PageUp` / `PageDown`.
- Pagination infinie ou virtuelle au-delà de 100 lignes.
- Couleur de ligne selon l'ancienneté de la vente (vert → ambre → rouge).
- Afficher un badge vendeur coloré (similaire aux ventes en attente).

**Fichiers :** `FacturesTable.tsx`, `useCaisseKeyboard.ts`

### 4.3 Gros chantiers

#### P6 - Dark mode et transitions
- Refonte du thème sombre cohérent pour toutes les modales de caisse.
- Transitions douces entre la liste, la modale de paiement et le ticket.

**Fichiers :** multiples, nécessite un chantier dédié.

---

## 5. Recommandation de démarrage

Commencer par **P1 (PaymentModal)** + **P2 (FacturesTable)** + **P3 (aide `?`)**.  
Ces trois quick wins apportent le plus de fluidité perçue à la caissière sans refactoring lourd.

---

**Version** : 1.0  
**Date** : Août 2026
