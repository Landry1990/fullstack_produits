# Changelog — Fullstack Produits

---

## 2026-06-28

### 🧹 Nettoyage du code mort

- **Backend — code commenté / mort supprimé**
  - `backend/api/signals.py` : debug `print` commenté.
  - `backend/backend/settings.py` : bloc `DATABASES` SQLite commenté.
  - `backend/diag_march.py` : filtre coupons commenté + imports `timezone`/`datetime` inutilisés.
  - `backend/api/management/commands/send_monthly_report.py` : calcul dettes fournisseurs commenté + import `Fournisseur` inutilisé.
  - `backend/api/views/commandes/commandes.py` : validation sudo commentée.
  - `backend/api/services/sms.py` : `time.sleep` commenté + correction du bug `sms_type`/`user` non définis dans `_mock_provider_send`.
  - `backend/scripts/benchmark_server.py` : `time.sleep` commenté.
  - `backend/scripts/verify_sudo_perimes.py` : `assert` commenté + import `Decimal` inutilisé.

- **Backend — imports inutilisés retirés (facturation)**
  - `backend/api/services/sales_service.py` : `Q`, `DecimalField`, `time`, `ConcurrentModificationError`.
  - `backend/api/views/ventes/factures.py` : `Q`, `StandardResultsSetPagination`, `SQLAnnotations`.
  - `backend/api/views/ventes/caisse.py` : `filters`, `parse_date`, `Facture`, `CommonFilterFields`.
  - `backend/api/views/ventes/creances.py` : `filters`, `AuditLog`, `log_audit`, `ClientDebtCache`.
  - `backend/api/models/billing.py` : `Q`, `Value`, `Coalesce`, `Self`.

- **Backend — imports inutilisés retirés (tests facturation)**
  - `backend/api/tests/test_facturation.py` : `StockLot`, `FactureProduitAllocation`.
  - `backend/api/tests/test_cash_closure.py` : `TestCase`.
  - `backend/api/tests/test_invoice_validation.py` : `TestCase`, `TransactionTestCase`.

- **Frontend — code commenté / mort supprimé**
  - `frontend/src/components/HistoriqueClotures.tsx` : `usePharmacySettings` commenté.
  - `frontend/src/utils/__tests__/finance.test.ts` : anciennes lignes de calcul HT/TVA commentées.
  - `frontend/src/App.test.tsx` : `import App` commenté.
  - `frontend/src/components/GestionUtilisateurs.tsx` : `fetchUsers()` commenté.
  - `frontend/src/hooks/useCommandesState.ts` : `handleBackToList()` commenté.
  - `frontend/src/hooks/inventaire/useInventaireList.ts` : import `Inventaire` commenté + `fetchInventaires()` commenté.
  - `frontend/src/utils/dateUtils.ts` : alias `formatDateLongFr` commenté.

- **Vérification** : compilation `py_compile` réussie sur tous les fichiers Python modifiés.

### ⚡ Performance / Test de charge backend

- **Script de test de charge** : `backend/scripts/load_test_api.py`
  - Scénario réaliste : auth + recherche produits + liste factures + finalisation vente.
  - Création d'un utilisateur et d'une session de caisse dédiés pour le test.

- **Optimisation de la génération des tickets de caisse**
  - `backend/api/models/stock.py` : `get_next_ticket_session()` passé de `select_for_update()` (verrouillage global) à un compteur Redis (`cache.incr()`), sur le même modèle que `generate_lot_number()`.
  - Cette séquence était le principal goulot d'étranglement sous forte concurrence.

- **Optimisation infrastructure (Docker Compose)**
  - `docker-compose.yml` : `max_connections` PostgreSQL passé à 300.
  - `docker-compose.yml` : `UVICORN_WORKERS=4` pour plus de workers parallèles.
  - `docker-compose.yml` : `DB_CONN_MAX_AGE=0` pour libérer les connexions DB rapidement sous forte charge.

- **Résultats du test de charge**
  - **10 clients** : ~46 RPS, 0 échec, temps finales ~0.5s.
  - **30 clients** (5 min) : ~31 RPS stable, 0 échec, 1360 ventes finalisées.
  - **40 clients** : ~36 RPS, quelques erreurs de connexion.
  - **50 clients** : ~30 RPS, 0 échec mais latence élevée (finales ~3.6s).
  - **Limite actuelle** : environ 30 clients simultanés avant dégradation.

### 🐛 Corrections

- **Avoir — "Décharge stock" : erreur `StockLot is not defined`**
  - `StockLot` utilisé dans `decharger_stock` mais manquant dans l'import du fichier.
  - Ajout de `StockLot` dans les imports de `backend/api/views/commandes/avoirs.py`.

- **Journal de caisse — ventes manquantes quand on sélectionne un caissier**
  - `get_user_shift` partait de la date de la dernière clôture, excluant les ventes antérieures de la journée (ex: vente à 00:53).
  - Le shift part maintenant de **minuit** (`today_start`) pour inclure toutes les ventes du jour.
  - Fichier : `backend/api/views/ventes/caisse.py`

- **FEFO multi-lots — facturation**
  - `useCart.ts` : ne force plus `lotId` par défaut, garde `null` pour que le backend applique le FEFO automatiquement.
  - `CartTable.tsx` : badge prévisualise les lots FEFO consommés (multi-lots) au lieu d'en afficher un seul.
  - Fichiers : `frontend/src/hooks/useCart.ts`, `frontend/src/components/facturation/CartTable.tsx`

- **Timezone UTC+1 — données du jour incorrectes (dashboard, journal caisse, stats)**
  - `timezone.now().date()` retournait la date en **UTC** (23:xx la veille en UTC+1), causant des listes vides et un dashboard affichant les données d'hier.
  - Remplacé par `timezone.localtime(timezone.now()).date()` dans **14 fichiers** backend :
    - `dashboard.py` (stats, manager_stats, hourly_traffic, revenue_chart, stock_health)
    - `ventes/caisse.py` (get_user_shift)
    - `ventes/factures.py` (stats_jour)
    - `temporal_analysis.py`, `stocks/stock_lots.py`, `stocks/analysis.py`
    - `settings.py`, `rapports/inventory.py`, `produit_actions/stats.py`
    - `fournisseurs.py`, `finance_stats.py`
    - `models/objectif.py`, `models/configuration_objectifs.py`, `models/stock.py`, `models/inventory.py`

- **Dashboard manager — impossible d'ajouter un objectif commercial**
  - Le modal shadcn n'était pas relié à l'état `editingObjectif` : le montant et la période restaient vides.
  - Câblé `Tabs` et l'input à `editingObjectif` / `setEditingObjectif`.
  - Corrigé les dates initiales en UTC (`new Date().toISOString().split('T')[0]`) par `getLocalDateString()` pour utiliser UTC+1.
  - Fichiers : `frontend/src/components/DashboardManagerShadcn.tsx`, `frontend/src/hooks/useManagerDashboard.ts`

- **Indicateur marge faible — saisie de commande (entrée stock)**
  - Ajout du champ `min_margin_threshold` dans `PharmacySettings` (défaut 1.34, configurable).
  - Dans le tableau de commande, la cellule **Marge** devient orange et affiche un icône `AlertTriangle` quand le taux de marge est inférieur au seuil.
  - Fichiers : `backend/api/models/settings.py`, `frontend/src/context/PharmacySettingsContext.tsx`, `frontend/src/components/Commandes/CommandeProductTable.tsx`

---

## 2026-06-27

### 🎨 Améliorations UI

- **Tableau des avoirs — refonte**
  - Colonne **Type** séparée de la colonne Fournisseur, avec badge coloré par type (rouge=Périmé, orange=Cassé, jaune=Erreur livraison, bleu=Non facturé…).
  - Colonne **Lignes** ajoutée avec compteur circulaire (nombre de produits dans l'avoir).
  - Montant affiché en gris pâle quand = 0 F pour éviter la confusion.
  - Actions (Voir / Éditer / Valider / Supprimer) visibles uniquement au hover.
  - Filtres **Statut** (Tous / Brouillon / Validé) et **Type** ajoutés dans la barre de filtres.
  - Fichiers :
    - `frontend/src/components/avoirs/AvoirsTable.tsx`
    - `frontend/src/components/avoirs/AvoirsFilters.tsx`
    - `frontend/src/components/Avoirs.tsx`

---

### 🐛 Corrections

- **SalesTable — colonne Remise vide**
  - `remise` absent du `FactureListSerializer` (sérialiseur allégé utilisé pour la liste).
  - Ajout de `'remise'` dans les `fields` de `FactureListSerializer`.
  - Fichier : `backend/api/serializers_optimized.py`

### ✨ Nouvelles fonctionnalités

- **Édition inline Lot / Date péremption — Fiche produit (onglet Lots)**
  - Bouton ✏️ sur chaque ligne de lot → édition inline N° lot + date péremption.
  - Sauvegarde via `PATCH stock-lots/{id}/`.
  - Après sauvegarde, invalide le cache React Query `['produit-lots', produitId]`.
  - Fichier : `frontend/src/components/products/ProductTabsContent.tsx`

- **Édition inline Lot / Date péremption — Commande clôturée**
  - Bouton ✏️ visible uniquement sur les commandes `CLOT` dans la vue détail.
  - Sauvegarde via `PATCH commande-produits/{id}/correct_lot/`.
  - Met à jour aussi le `StockLot` associé côté backend.
  - Invalide le cache `['produit-lots', produitId]` pour synchronisation avec la fiche produit.
  - Fichiers :
    - `backend/api/views/commandes/commande_produits.py` (endpoint `correct_lot`)
    - `frontend/src/components/Commandes/CommandeDetails.tsx`

- **Contrôle de la remise globale à la facturation**
  - Toute remise globale > 0 déclenche une validation **sudo** obligatoire.
  - Plafond basé sur `max_discount_rate` du profil utilisateur :
    - Si dépassé → remise cappée au maximum autorisé + sudo quand même requis.
    - Superuser → plafond 100% (aucune restriction).
  - Annulation sudo → remise remise à `0`.
  - Fichiers :
    - `frontend/src/hooks/useSecureCartOperations.ts` (ajout `secureSetRemiseGlobale`)
    - `frontend/src/hooks/useFacturationState.ts` (exposition `secureSetRemiseGlobale`)
    - `frontend/src/components/facturation/TotalsSection.tsx` (saisie locale + `onRemiseChange`)
    - `frontend/src/components/Facturation.tsx` (branchement `onRemiseChange`)

---

## 2026-06-26

### 🐛 Corrections

- **Import CSV commande — quantité ignorée**
  - Le parseur lisait la quantité en colonne 4 au lieu de la colonne 1.
  - Nouveau format fixe : `CIP (col 0) | Qté (col 1) | Prix cession (col 2)` — reste facultatif.
  - Fichier : `frontend/src/hooks/useCommandesState.ts`

- **Dashboard — délai de mise à jour des ventes**
  - Intervalle de polling `useDashboardStats` réduit de 60 s à **15 s**.
  - Fichier : `frontend/src/hooks/useDashboard.ts`

### ✅ Vérifications

- **Import CSV — prix d'achat en fallback**
  - Confirmé : si la colonne prix est absente, le système utilise automatiquement `cost_price` de la fiche produit.
  - Aucune modification nécessaire.
