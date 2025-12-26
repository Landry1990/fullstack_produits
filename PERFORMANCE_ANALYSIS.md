# Analyse des Goulots d'Étranglement - Performance
## Système: 10 postes simultanés + ~8000 produits

### 🔴 PROBLÈMES CRITIQUES (À corriger en priorité)

#### 1. **Requêtes N+1 dans ProduitViewSet** ✅ CORRIGÉ
**Fichier:** `backend/api/views.py:77`
**Problème:** Le serializer `ProduitSerializer` accède à `rayon.name` et `fournisseur.name` via `source='rayon.name'`, créant une requête SQL par produit lors de la sérialisation (8000+ requêtes supplémentaires !).

**Impact:** Avec 8000 produits, chaque liste produit génère 8000+ requêtes supplémentaires.

**Solution appliquée:**
```python
queryset = Produit.objects.select_related('rayon', 'fournisseur').order_by('-created_at')
```
**Status:** ✅ Corrigé - select_related ajouté + pagination explicite

#### 2. **Propriétés @property coûteuses dans Facture** ⚠️ CRITIQUE
**Fichier:** `backend/api/models.py:296-326`
```python
@property
def total_ht(self):
    total_value = self.produits.aggregate(...)  # Requête SQL à chaque accès
```
**Problème:** Chaque accès à `total_ht`, `total_tva`, `total_ttc` exécute une requête SQL avec `aggregate()` sur tous les produits de la facture. Lors de la liste de factures, cela multiplie les requêtes.

**Impact:** Si on liste 100 factures, cela génère 300+ requêtes supplémentaires (100 × 3 propriétés).

**Solution:** 
- Précalculer les totaux et les stocker dans des champs dédiés (ex: `cached_total_ht`)
- Ou utiliser `prefetch_related` avec `Prefetch` et calculer en Python
- Ou utiliser `annotate()` pour précalculer dans la requête

#### 3. **Client.current_debt avec boucle sur factures** ⚠️ CRITIQUE
**Fichier:** `backend/api/models.py:93-123`
```python
@property
def current_debt(self):
    factures = self.facture_set.filter(status='VAL')
    for facture in factures:  # Boucle + requêtes dans la boucle
        paiements_reels = facture.paiements.filter(...).aggregate(...)
```
**Problème:** Pour chaque client, boucle sur toutes les factures et exécute des requêtes par facture. Si un client a 100 factures, cela génère 100+ requêtes supplémentaires.

**Impact:** En listant 100 clients, cela peut générer des milliers de requêtes.

**Solution:**
- Précalculer avec `annotate()` dans le queryset
- Ou stocker la dette dans un champ dédié mis à jour par signal
- Ou utiliser une agrégation SQL complexe en une seule requête

#### 4. **Signal post_save StockLot recalcule tout le stock** ⚠️ PARTIELLEMENT OPTIMISÉ
**Fichier:** `backend/api/models.py:436-461`
**Problème:** À chaque création/modification d'un lot, recalcule le stock en agrégeant TOUS les lots du produit. Si un produit a 100 lots, cela fait une requête avec agrégation sur 100 lignes à chaque opération.

**Impact:** En clôturant une commande avec 20 produits × 20 lots chacun = 400 requêtes d'agrégation.

**Solution appliquée:**
- ✅ Code optimisé pour distinguer création vs modification (préparation pour calcul delta)
- ⚠️ TODO: Implémenter calcul de delta avec pre_save pour capturer ancienne valeur
- ⚠️ TODO: Utiliser cache Redis pour les produits avec beaucoup de lots
**Status:** ⚠️ Partiellement optimisé - Nécessite amélioration avec pre_save hook

#### 5. **Pas de pagination configurée pour ProduitViewSet** ✅ CORRIGÉ
**Fichier:** `backend/api/views.py:73-82`
**Problème:** Même si `PageNumberPagination` est configuré globalement, avec 8000 produits, chaque requête liste charge potentiellement tous les produits.

**Impact:** Réponses JSON très lourdes, consommation mémoire élevée, temps de réponse long.

**Solution appliquée:**
- ✅ Pagination explicite configurée (utilise PAGE_SIZE=50 du settings global)
**Status:** ✅ Corrigé

#### 6. **recalculate_rotation en boucle avec requêtes** ⚠️ CRITIQUE
**Fichier:** `backend/api/views.py:247-281`
```python
for produit in produits:  # Boucle sur 8000 produits
    result = FactureProduit.objects.filter(...).aggregate(...)  # Requête par produit
    produit.save(update_fields=['rotation_moyenne'])  # Save par produit
```
**Problème:** Pour chaque produit, exécute une requête d'agrégation, puis un `save()`. Pour 8000 produits = 16000 requêtes SQL.

**Impact:** Cette opération peut prendre plusieurs minutes et bloquer la base de données.

**Solution:**
- Utiliser `bulk_update()` avec calcul batch
- Utiliser des agrégations SQL avec `annotate()` et `Subquery`
- Ou exécuter en tâche asynchrone (Celery)

---

### 🟠 PROBLÈMES MAJEURS (À corriger rapidement)

#### 7. **Missing indexes sur champs fréquemment filtrés** ✅ CORRIGÉ
**Fichier:** `backend/api/models.py`
**Problème:** Pas d'index sur:
- `Produit.stock` (utilisé pour `stock__lte=F('stock_minimum')`)
- `Facture.status` (filtré très souvent)
- `FactureProduit.produit` (joins fréquents)
- `Caisse.statut` (filtré pour les totaux)

**Impact:** Scans de table complets sur 8000+ lignes = très lent.

**Solution appliquée:**
- ✅ Index ajoutés sur `Produit` (stock, rayon+stock, fournisseur, stock+stock_minimum)
- ✅ Index ajoutés sur `Facture` (status, client+status, date)
- ✅ Index ajoutés sur `FactureProduit` (produit, facture+produit)
- ✅ Index ajoutés sur `Caisse` (statut, facture+statut, date_paiement)
**Status:** ✅ Corrigé - Index critiques ajoutés

#### 8. **CommandeSerializer avec produits non optimisés**
**Fichier:** `backend/api/views.py:468`
```python
queryset = Commande.objects.select_related('fournisseur').prefetch_related('produits')
```
**Problème:** Le `CommandeProduitSerializer` accède à `commande.fournisseur.name` via `source='commande.fournisseur.name'`, mais le `prefetch_related('produits')` ne précharge pas `produit` dans chaque `CommandeProduit`.

**Solution:**
```python
queryset = Commande.objects.select_related('fournisseur').prefetch_related(
    Prefetch('produits', queryset=CommandeProduit.objects.select_related('produit'))
)
```

#### 9. **generate_lot_number() avec transaction lock global**
**Fichier:** `backend/api/models.py:352-365`
**Problème:** Utilise `select_for_update()` sur `LotSequence`, créant un verrou global. Avec 10 postes simultanés créant des lots, cela crée un goulot d'étranglement séquentiel.

**Impact:** Les créations de lots se font séquentiellement, ralentissant les clôtures de commande.

**Solution:**
- Utiliser une séquence de base de données native (si PostgreSQL)
- Ou utiliser un cache Redis avec incrément atomique
- Ou utiliser `F()` expressions avec retry logic

#### 10. **Dashboard stats avec multiples requêtes non optimisées**
**Fichier:** `backend/api/views.py:1625+`
**Problème:** Plusieurs requêtes séparées pour les stats du dashboard, certaines recalculant les mêmes données.

**Impact:** Chaque chargement du dashboard = 10+ requêtes SQL lourdes.

**Solution:**
- Combiner en une seule requête avec `annotate()` et `Subquery`
- Ou utiliser un cache Redis avec TTL de 5-10 minutes
- Ou précalculer les stats dans une table dédiée

---

### 🟡 PROBLÈMES MOYENS (À optimiser)

#### 11. **Pas de cache pour les recherches de produits**
**Problème:** Les recherches fréquentes (`search_fields`) ne sont pas mises en cache.

**Solution:** Ajouter cache Redis pour les recherches courantes (TTL 1-5 min).

#### 12. **Serializer avec fields='__all__'**
**Problème:** Sérialise tous les champs même si certains ne sont pas nécessaires côté frontend.

**Solution:** Utiliser des serializers différents pour list vs detail, avec seulement les champs nécessaires.

#### 13. **Transaction atomic longue dans cloturer()**
**Fichier:** `backend/api/views.py:480`
**Problème:** La transaction `cloturer()` peut être longue avec beaucoup de produits, bloquant d'autres opérations.

**Solution:** Diviser en sous-transactions si possible, ou optimiser les boucles.

#### 14. **Pas de connection pooling explicite**
**Problème:** Django utilise le pool de connexions par défaut qui peut être insuffisant avec 10 postes simultanés.

**Solution:** Configurer `CONN_MAX_AGE` dans settings.py et utiliser un pool de connexions (pgBouncer pour PostgreSQL).

---

### ✅ RECOMMANDATIONS PRIORITAIRES

1. **IMMÉDIAT (à faire maintenant):** ✅ FAIT
   - ✅ Ajouter `select_related('rayon', 'fournisseur')` sur ProduitViewSet
   - ✅ Ajouter pagination explicite (page_size=50)
   - ✅ Ajouter index sur `Produit.stock`, `Facture.status`, `FactureProduit.produit`, `Caisse.statut`

2. **COURT TERME (cette semaine):** 🔄 EN COURS
   - ⚠️ Précalculer `Facture.total_ht/tva/ttc` dans des champs dédiés (CRITIQUE - à faire)
   - ⚠️ Optimiser `Client.current_debt` avec annotate ou champ dédié (CRITIQUE - à faire)
   - ⚠️ Finaliser optimisation signal StockLot avec pre_save pour calcul delta

3. **MOYEN TERME (ce mois):**
   - Implémenter cache Redis pour dashboard stats et recherches
   - Optimiser `recalculate_rotation` avec bulk_update
   - Ajouter index manquants supplémentaires (CommandeProduit.produit, etc.)

4. **LONG TERME (prochaine version):**
   - Migration vers PostgreSQL si pas déjà fait (meilleures performances)
   - Implémenter Celery pour tâches asynchrones (rotation, stats)
   - Ajouter monitoring (Django Debug Toolbar, Sentry, New Relic)

---

### 📊 ESTIMATION D'IMPACT

**Avant optimisations:**
- Liste produits (8000): ~8000+ requêtes SQL, ~5-10 secondes
- Liste factures (100): ~300+ requêtes SQL, ~2-5 secondes
- Dashboard: ~15+ requêtes SQL, ~3-8 secondes

**Après optimisations:**
- Liste produits (8000, paginée): ~1-2 requêtes SQL, ~100-300ms
- Liste factures (100): ~2-3 requêtes SQL, ~200-500ms
- Dashboard: ~2-3 requêtes SQL (ou cache), ~50-200ms

**Gain estimé:** 10-50x plus rapide sur les endpoints critiques.
