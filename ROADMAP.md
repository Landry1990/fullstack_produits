# 🗓️ Feuille de Route - Prochaines Étapes

**Date** : 25 Décembre 2025

---

## 🔴 Priorité Haute - À faire en premier

### 1. Bug Critique : Nouvelles factures non sauvegardées ⚠️
- **Problème** : Les ventes créées via Facturation ne s'enregistrent pas
- **Impact** : Bloque les ventes quotidiennes
- **Action** : Investiguer et corriger en priorité

### 2. Alerte lors de la validation de facture
- **Objectif** : Prévenir les dépassements de plafond client
- **Fonctionnalités** :
  - Bloquer/avertir quand un client va dépasser son plafond
  - Permettre aux superusers de forcer la validation
  - Afficher : dette actuelle + montant facture + nouveau total vs plafond
- **Backend** : Modifier `FactureViewSet.valider` pour vérifier le plafond
- **Frontend** : Modal d'avertissement dans `Facturation.tsx`

---

## 🟡 Priorité Moyenne

### 3. Amélioration Commande REASSORT_AUTO
- Permettre de répartir les produits par fournisseur
- Générer plusieurs commandes depuis REASSORT_AUTO (une par fournisseur)
- Bouton "Éclater par fournisseur"

### 4. Rapport de créances détaillé
- Liste complète des factures impayées par client
- Ancienneté des créances (< 30j, 30-60j, > 60j)
- Export PDF/Excel

### 5. Optimisation Dashboard
- Graphique d'évolution des créances
- Top 5 clients avec plus grosse dette
- Indicateur de santé financière

---

## 🟢 Améliorations Futures

### 6. Éditeur d'étiquettes personnalisables
- **Options** :
  - Option 1 : Système drag & drop complet (complexe, ~2-3 jours)
  - Option 2 : Paramètres d'ajustement simples avec sliders (~1 jour) ⭐ Recommandé
  - Option 3 : Templates prédéfinis (Compact/Standard/Grande police) (~2-3h)
- **Bénéfices** : Adaptation aux différentes imprimantes et préférences
- **Décision** : Reporter à la fin du projet

### 7. Système de rappels automatiques
- Emails/SMS pour clients en dépassement
- Historique des relances

### 8. Gestion des promis
- Notification quand produit arrive en stock
- Conversion automatique promis → vente

---

## 📊 Plan d'Implémentation - Analyse ABC des Produits

### Concept
L'**analyse ABC** est une méthode de classification des produits basée sur le principe de Pareto (80/20) pour optimiser la gestion des stocks.

#### Classification
- **🔴 Catégorie A** (Produits Vitaux)
  - 20% des produits → 80% du CA
  - Stock de sécurité élevé, surveillance quotidienne
  - Exemple : Paracétamol, antibiotiques courants

- **🟡 Catégorie B** (Produits Importants)
  - 30% des produits → 15% du CA
  - Stock modéré, surveillance hebdomadaire
  - Exemple : Vitamines, sirops

- **🟢 Catégorie C** (Produits Secondaires)
  - 50% des produits → 5% du CA
  - Stock minimal, commande à la demande
  - Exemple : Produits de niche, spécialités rares

### Implémentation Technique

#### Backend

1. **Nouvel endpoint** `/api/produits/analyse_abc/`
   ```python
   @action(detail=False, methods=['get'])
   def analyse_abc(self, request):
       """
       Calcule la classification ABC des produits.
       Paramètres:
       - periode: nombre de mois (défaut: 6)
       - rayon_id: filtrer par rayon (optionnel)
       - fournisseur_id: filtrer par fournisseur (optionnel)
       """
       # Calcul du CA par produit sur période
       # Classification automatique A/B/C
       # Retourne : produit, CA, % du CA total, catégorie ABC
   ```

2. **Champ dans modèle Produit** (optionnel)
   ```python
   categorie_abc = models.CharField(
       max_length=1, 
       choices=[('A', 'A'), ('B', 'B'), ('C', 'C')],
       null=True, blank=True
   )
   date_derniere_analyse = models.DateTimeField(null=True, blank=True)
   ```

3. **Commande de gestion Django**
   ```python
   # python manage.py calculer_abc
   # Recalcul automatique mensuel via cron
   ```

#### Frontend

1. **Page dédiée "Analyse ABC"** (`/analyse-abc`)
   - Filtres : période, rayon, fournisseur
   - 3 tableaux distincts (A, B, C) avec couleurs
   - Graphiques :
     - Répartition CA par catégorie (camembert)
     - Top 20 produits A (barres)
   - Export Excel/PDF

2. **Indicateur dans liste produits**
   - Badge coloré (🔴 A, 🟡 B, 🟢 C) à côté de chaque produit
   - Colonne triable "Catégorie ABC"
   - Filtre par catégorie

3. **Widget Dashboard**
   - Résumé : X produits A, Y produits B, Z produits C
   - Alerte si produit A en rupture de stock
   - Lien vers analyse complète

### Paramètres Configurables

```typescript
interface AnalyseABCParams {
  seuilA: number;      // % CA pour catégorie A (défaut: 80)
  seuilB: number;      // % CA pour catégorie B (défaut: 15)
  periode: number;     // Mois d'analyse (défaut: 6)
  autoRecalcul: boolean; // Recalcul auto mensuel
}
```

### Bénéfices Attendus

1. **Optimisation du stock** : Concentrer l'argent sur les produits A
2. **Gain de temps** : Focus sur ce qui rapporte
3. **Réduction des ruptures** : Surveiller les produits critiques
4. **Meilleure trésorerie** : Moins d'argent immobilisé en produits C
5. **Négociation fournisseurs** : Arguments pour les produits A

### Estimation
- **Temps de développement** : 2-3 heures
- **Complexité** : Moyenne
- **Impact** : Élevé sur la gestion des stocks

---

## ✅ Travaux Réalisés - 24 Décembre 2025

### Système de Réassort Automatique
- ✅ Commande unique "REASSORT_AUTO" qui se remplit automatiquement avec les ventes
- ✅ Gestion des annulations (retrait automatique des quantités)
- ✅ Support des commandes sans fournisseur spécifique

### Corrections Rapport Mensuel
- ✅ Calcul correct des créances réelles (soldes impayés)
- ✅ Prise en compte de tous les paiements (y compris "en_compte")

### Alertes de Créances
- ✅ Widget dashboard affichant les clients dépassant leur plafond
- ✅ Badge orange avec nombre de clients en dépassement
- ✅ Détails : dette actuelle vs plafond pour chaque client

### Corrections Techniques
- ✅ Fix erreur 500 lors modification commande REASSORT_AUTO
- ✅ Support fournisseur nullable dans les commandes
- ✅ Gestion correcte des lots de stock avec fournisseur null

---

**Dernière mise à jour** : 25 Décembre 2025, 00:24
