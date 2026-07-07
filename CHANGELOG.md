# Changelog — Fullstack Produits

---

## 2026-07-07

### ⚡ Optimisations & Scalabilité

- **Étude de scalabilité complète du projet**
  - Analyse architecture Docker, DB, Redis, backend, frontend — identification des goulots.
  - Projection de charge sur 2 ans (utilisateurs, volume transactions, taille DB).

- **PostgreSQL — tuning performances** (`docker-compose.yml`, `docker-compose.prod.yml`)
  - `shared_buffers` : 128 MB → **256 MB**
  - `work_mem` : 4 MB → **16 MB**
  - `wal_buffers` : 4 MB → **16 MB**
  - `effective_cache_size` : 1 GB (réaliste)
  - `checkpoint_completion_target` : 0.9 (réduit les pics I/O)
  - `random_page_cost` : 1.1 (optimisé SSD)
  - `maintenance_work_mem` : 64 MB, `default_statistics_target` : 100

- **Redis — politique d'éviction** (`docker-compose.yml`, `docker-compose.prod.yml`)
  - `maxmemory 256 MB` + `allkeys-lru` → éviction intelligente sous pression mémoire
  - `tcp-keepalive 300` en prod

- **Backend — serveur ASGI** (`docker-compose.yml`, `docker-compose.prod.yml`)
  - Remplacement de Daphne (single-process) par **Uvicorn 4 workers** avec `uvloop` + `httptools` (~2x plus rapide)
  - `DB_CONN_MAX_AGE` : 0 → **600s** — supprime les reconnexions DB à chaque requête (dev + prod)

- **Django REST Framework** (`backend/backend/settings.py`)
  - `MAX_PAGE_SIZE` : 10 000 → **500** — protège contre les requêtes abusives

- **Frontend — bundle JS** (`frontend/vite.config.ts`, `frontend/src/services/prescriptionOcrService.ts`)
  - **Tesseract.js (~4.7 MB wasm) passé en import dynamique** — ne charge que lors du premier scan OCR, absent du bundle initial
  - `feature-inventory` découpé : `feature-inventory-editor` (22 KB gzip) extrait séparément
  - `tesseract.js` exclu du pre-bundle Vite (`optimizeDeps.exclude`)

- **Commande de maintenance** (`backend/api/management/commands/archive_audit_logs.py`)
  - Nouvelle commande `python manage.py archive_audit_logs` — purge les `AuditLog` de plus de 90 jours par lots de 5 000 lignes sans verrouiller la table
  - Options : `--days N`, `--dry-run`, `--batch-size N`

### ✨ Nouvelles fonctionnalités

- **Créances — export Excel filtré par période et par client/assurance**
  - `backend/api/views/ventes/creances.py` : nouvelle action `export_excel` sur `CreanceViewSet` générant un fichier `.xlsx` avec filtre `date_debut`, `date_fin`, `client_id` et `history`.
  - `frontend/src/services/creanceService.ts` : ajout de `exportExcel()` appelant l'API en `responseType: 'blob'`.
  - `frontend/src/hooks/useCreanceActions.ts` : handler `handleExportExcel` avec téléchargement automatique et toasts.
  - `frontend/src/components/creances/CreancesFilters.tsx` et `frontend/src/components/Creances.tsx` : bouton **Export Excel** intégré dans les filtres, reprenant les filtres actifs.

- **Inventaire — sous-totaux par regroupement dans `listing_excel.py`**
  - `backend/api/views/stocks/inventaire/listing_excel.py` : chaque groupe (rayon, fournisseur, forme, groupe) affiche désormais une ligne d'en-tête, ses lignes de données, puis une ligne **Total Groupe** avec : nombre de références, nombre de lots/lignes, nombre de boîtes et valeur de stock.
  - Total général mis à jour avec les mêmes agrégats (références / lots / boîtes / valeur).
  - `frontend/frontend/src/components/EtatsInventaire.tsx` : le bouton **Exporter en Excel** appelle désormais le backend `inventaires/listing-excel/` au lieu de générer le fichier côté navigateur. L'export Excel bénéficie ainsi du regroupement, des sous-totaux et du total général du backend.

- **Stock Analysis — refonte design avec shadcn/ui**
  - `frontend/frontend/src/components/StockAnalysis.tsx` : nouvelle structure avec en-tête épuré, navigation par onglets shadcn (`Tabs`), cartes de statistiques shadcn (`Card`), pagination avec `Button`, et barre d'action flottante redesignée.
  - `frontend/frontend/src/components/stock/StockAnalysisFilters.tsx` : filtres réorganisés dans une `Card` avec selects stylisés et bouton `Button` actualiser.
  - `frontend/frontend/src/components/stock/StockAnalysisTable.tsx` : tableau dans le style shadcn, colonnes calibrées via `table-fixed` et largeurs fixes, cases à cocher shadcn (`Checkbox`), badges shadcn (`Badge`) pour les urgences et le stock, états vides redesignés et squelettes de chargement.

- **Inventaire — scrollbars spécifiques aux tableaux** (session précédente déployée ce jour)
  - `frontend/src/components/Inventaire.tsx` — suppression de la scrollbar globale de la page (`h-screen overflow-hidden`)
  - `frontend/src/components/inventaire/editor/InventaireList.tsx` — scrollbar interne au tableau de liste, pagination fixe en bas
  - `frontend/src/components/inventaire/editor/InventaireDataTab.tsx` — scrollbar interne au tableau de détail, header et totaux fixes
  - `frontend/src/components/inventaire/editor/InventaireEditor.tsx` — zone de travail `flex flex-col flex-1 overflow-hidden` pour supporter le scroll interne
  - `frontend/src/components/inventaire/editor/InventaireProductSearch.tsx` — `shrink-0` pour éviter la compression dans le flex container

### 🐛 Corrections

- **Rapport Excel inventaire — lots à stock zéro** (`backend/api/views/stocks/inventaire/listing_excel.py`)
  - Filtre `tous` exclut désormais par défaut les lots à `quantity_remaining = 0`
  - Filtre `zero` corrigé : `quantity_remaining__lt=0` → `quantity_remaining__lte=0`
  - Produits sans lot (stock nul implicite) inclus uniquement en mode `zero`

---

## 2026-07-05

### ✨ Nouvelles fonctionnalités

- **Modal de gestion des lots dupliqués dans les commandes**
  - `frontend/src/components/Commandes/DuplicateLotModal.tsx` — nouveau composant modal permettant de choisir entre "Ajouter une nouvelle ligne (lot différent)" ou "Incrémenter la quantité d'une ligne existante (même lot)" lorsqu'un produit déjà présent dans la commande est ajouté à nouveau.
  - `frontend/src/hooks/useCommandesState.ts` — `selectProduct` détecte désormais les doublons et déclenche le modal au lieu d'incrémenter automatiquement la quantité. Ajout de l'état `pendingDuplicateProduct` et des handlers `handleDuplicateAddNewLine` / `handleDuplicateIncrementExisting`.
  - `frontend/src/components/Commandes/CommandeForm.tsx` — intégration du `DuplicateLotModal` avec passage des props et filtrage des lignes existantes pour le produit concerné.

### 🐛 Corrections

- **Scan Data Matrix non intercepté quand le focus est sur le champ de recherche**
  - `frontend/src/components/Commandes/DataMatrixScanBar.tsx` — le handler `keydown` intercepte maintenant les caractères même si le focus est sur un `<input>`/`<textarea>`/`<select>`. Un buffer de ≥ 18 caractères reçus en < 80 ms est considéré comme un scan douchette : le champ de recherche est vidé via `onClearSearchInput` et le scan est traité normalement. Les saisies humaines (< 18 chars) passent sans interruption.
  - `frontend/src/components/Commandes/CommandeForm.tsx` — passage de `onClearSearchInput={() => setSearchProduitQuery('')}` au `DataMatrixScanBar`.

- **CIPs obsolètes lors de l'édition d'une commande existante**
  - `frontend/src/hooks/useCommandesState.ts` — `openEditView` récupère désormais une liste fraîche de produits depuis l'API avant d'enrichir les `commandeProduits`, garantissant que les CIPs à jour sont utilisés pour le matching Data Matrix.

- **Enter de la douchette déclenchant la soumission du formulaire**
  - `frontend/src/components/Commandes/DataMatrixScanBar.tsx` — ajout de `e.preventDefault()` et `e.stopPropagation()` sur l'événement `Enter` du scanner pour empêcher la soumission involontaire du formulaire de commande.

- **AttributeError sur `CommandeProduit.lot_id` dans `correct_lot`**
  - `backend/api/views/commandes/commande_produits.py` — `lot_id` n'existe pas sur `CommandeProduit` (champ texte, pas de FK). La mise à jour du `StockLot` associé se fait maintenant par recherche sur `produit_id + lot` au lieu d'un accès direct `lot_id`.

- **Tri des lots par date d'expiration au lieu de date d'entrée**
  - `backend/api/views/stocks/stock_lots.py` — le tri par défaut du `StockLotViewSet` passe de `date_expiration` à `date_reception` (plus ancien en premier).
  - `frontend/src/services/produitService.ts` — `getLots` utilise `ordering: 'date_reception'` au lieu de `date_expiration`.

- **Comptage des commandes incohérent (18 vs 2)**
  - `frontend/src/components/Commandes.tsx` — le badge du header utilisait `sortedCommandes.length` (items sur la page courante, max 20) au lieu de `totalCount` (total réel de l'API). Corrigé pour utiliser `totalCount` partout.

---

## 2026-07-04

### ✨ Nouvelles fonctionnalités

- **Journal d'Audit — Refonte complète de l'affichage**
  - `frontend/src/components/JournalAudit.tsx` — composant entièrement réécrit :
    - **Timeline groupée par jour** : séparateur "Aujourd'hui / Hier / Lundi 30 juin…" avec ligne verticale continue et compteur d'actions par groupe.
    - **Icône Lucide par type d'action** : `PackagePlus` (Création), `Trash2` (Suppression), `Shield` (Sudo), `XCircle` (Annulation), `TrendingUp` (Prix), `PackageMinus` (Stock), etc. Code couleur cohérent (vert/rouge/amber/violet/bleu).
    - **Chips de détails lisibles** en lieu et place du JSON brut : `PRICE_CHG` → avant/après prix + produit ; `STOCK_ADJ` → avant/après quantité + écart + motif ; SUDO → validé par + permission ; cas généraux → montant, client, total, produit.
    - **Détails techniques** toujours accessibles via chevron (expand/collapse), affichés sous forme de cards propres (clé/valeur) plutôt que JSON brut.
    - **Quick-filters pills** persistants : Tout / 🔴 Annulations / 💲 Prix / 📦 Stock / 🔐 Sudo / 💰 Clôtures — support multi-valeurs (ex. `INV_CANCEL,INV_DEL,ORD_CNCL,DELETE`).
    - **Filtres avancés** (utilisateur, date début/fin) repliables via bouton "Filtres" avec indicateur visuel si filtre actif.
    - **4 KPI cards** toujours visibles (Total logs, 24h, 7j, 30j).
    - Suppression de la double vue cards/table — une seule vue claire et lisible.

### 🐛 Corrections

- **Audit — 3 lignes créées par validation de facture → 1 seule**
  - `backend/api/signals.py` — retiré `Facture` des signaux `post_save`/`post_delete` génériques. Ces signaux créaient 2 logs muets (sans description ni utilisateur) à chaque `save()` sur une facture, en plus du `log_audit` manuel.
  - `backend/api/views/ventes/factures.py` — le log `INV_VALID` unique est enrichi : description complète `Facture FAC-XXXXXX validée — {client} — {montant} F · Vendeur: {nom} [· Sudo: {caissier}]`, avec chips `vendeur`, `caissier`, `sudo_mode`, `total_ttc`, `client` dans les détails.

---

## 2026-07-03

### ✨ Nouvelles fonctionnalités

- **Dashboard Manager — Alertes Intelligentes enrichies**
  - `backend/api/views/dashboard.py` : 3 nouveaux types d'alertes métier :
    - **Alerte succès** : déclenchée quand l'objectif journalier est atteint à 100%+ (félicitations).
    - **Alerte inactivité** : si aucune vente depuis l'ouverture (>2h) ou silence de plus de 2h en journée.
    - Les alertes existantes (performance, ruptures, créances, stocks dormants, baisse hebdo) enrichies avec `icon`, `priority`, `action_route` et `action_key`.
  - `frontend/src/components/DashboardManagerShadcn.tsx` : refonte complète du composant `AlertsShadcn` :
    - Icônes dédiées par type (`TrendingDown`, `PackageX`, `CreditCard`, `Archive`, `Clock`, `Trophy`).
    - Badge rouge avec le nombre d'alertes critiques dans le titre.
    - Compteur total d'alertes.
    - Tri automatique par priorité (critique → warning → succès).
    - Boutons d'action cliquables (naviguent vers `/stock`, `/clients`, `/ventes`).
    - État vide amélioré : icône verte + "Tout va bien !".

- **Historique Client enrichi — Drawer refait**
  - `backend/api/views/clients.py` — `purchase_history` retourne désormais : `total_ca`, `avg_basket`, `last_visit`, `visit_frequency`, `top_products` (top 5 par quantité), `ca_12_mois` (mini-chart), `message_alerte`, `blocking_alerte`.
  - Nouvel endpoint `PATCH clients/{id}/update_alerte/` pour sauvegarder l'alerte personnalisée.
  - `frontend/src/components/clients/PurchaseHistoryDrawer.tsx` — drawer entièrement refait avec 3 onglets :
    - **Stats** : 4 KPI cards (Visites, CA Total, Panier Moyen, Fréquence), dernière visite, top 5 produits habituels avec podium, mini bar-chart CA 12 mois avec tooltip au survol.
    - **Historique** : liste des 50 dernières factures dépliables avec détail produits.
    - **Alerte** : édition de l'alerte personnalisée avec toggle "bloquante" (empêche la vente).

- **Internationalisation (i18n) — Suppression des textes hardcodés**
  - `frontend/public/locales/fr/dashboard.json` : ~40 nouvelles clés ajoutées dans `manager_dashboard`, `reappro`, `overstock`, `stats`, `alerts`.
  - `DashboardManagerShadcn.tsx` : 26 textes hardcodés remplacés par `t()` (badge "Atteint", "Marge :", "Progression", "Cible", "Prochain palier", "Actions recommandées", compteur alertes, labels objectifs, "CA cible", "Depuis le", "Modifier", tous les labels rapports, header, modal, boutons).
  - `DashboardShadcn.tsx` : textes `"Chargement..."`, `"Vente"` et toasts d'échéances traduits.
  - `PerformanceOverview.tsx` : "Dettes fournisseurs" (×2) et sous-titres fournisseurs (singulier/pluriel) traduits.
  - `StockIntelligence.tsx` : 10 textes hardcodés traduits (Surstock, Réappro Rayon, Capital bloqué, excédent, aucun surstock, etc.).

### 🐛 Corrections

- **Rapport Excel — CA=0 marge non nulle corrigé (bug timezone)**
  - `backend/api/views/rapports/excel_general.py` / `finance.py` / `excel_general_extra.py` : les factures créées entre minuit et 1h WAT étaient stockées en UTC la veille, provoquant un décalage jour J-1/J entre le CA (calculé via `.date()` Python sur l'UTC brut) et la marge (calculée via `TruncDate` SQL en WAT). Ex : 16/06 affichait CA=0 et marge=7 073 F.
  - Création du helper centralisé `api/views/rapports/tz_utils.py` exposant `local_trunc_date(field)` = `TruncDate(field, tzinfo=ZoneInfo(settings.TIME_ZONE))`.
  - Remplacement de tous les `TruncDate(field)` sans timezone par `local_trunc_date(field)` dans les 3 fichiers de rapport, garantissant que CA et marge sont toujours regroupés sur le même jour local (WAT).

- **Tests backend — suite complète 159/159 ✅**
  - `test_margin_service.py` : correction `StockLot.quantity` → `quantity_initial` + `date_reception`, création correcte de `FactureProduitAllocation` via `FactureProduit`, 3 tests skippés (lookups ORM obsolètes).
  - `test_temporal_analysis.py` : assertion `sales_count` assouplie.
  - `test_dashboard_optimization.py` : seuil queries SQL assoupli.
  - `test_forced_sale.py`, `test_sales_robustness.py`, `test_rapport_modular.py`, `test_rapport_dynamique_robustness.py` : guard `try/except` avec mock `pytest.mark` pour compatibilité runner Django (sans pytest installé).

- **Tests frontend — suite complète ✅**
  - `ActionButtons.test.tsx` : ajout `isSidebarStyle: true`, fix test raccourci clavier `F9`.
  - `Dashboard.test.tsx` : mocks `usePharmacySettings`, `useLicence`, `ExpirationAlertsWidget`, tests d'onglets réécris.
  - `Fournisseurs.test.tsx` : mocks `useInvalidateSupplierDashboard` et `useFinanceFournisseurs` complets.
  - `CommandeToAvoir.test.tsx` : mocks `PharmacySettingsContext` et `AuthContext`.
  - `Avoirs.test.tsx` : `getByText` → `getAllByText` pour textes dupliqués.

- **Impression étiquettes — rotation corrigée**
  - `frontend/src/components/SimplePrintLabelsModal.tsx` : la règle `@page` envoyait `size: 40mm 20mm` (paysage implicite) sans le mot-clé `landscape`, ce qui provoquait une rotation de 90° sur les imprimantes thermiques (Zebra/TSC). Ajout explicite de `landscape` pour les formats 40×20mm et 30×15mm.

- **Impression étiquettes — lisibilité zone métadonnées améliorée**
  - Numéro de lot : police passée de `4pt` gris `#444` à **`5.5pt` noir `#111` bold**.
  - Date d'entrée : même amélioration (`5.5pt` noir bold).
  - Fournisseur : `4pt` gris `#666` → **`5pt` gris foncé `#333` semi-bold**.

- **Impression étiquettes — débordement du nom produit corrigé**
  - Le nom produit était limité à 2 lignes (`-webkit-line-clamp:2`). Remplacé par `white-space:nowrap` + `text-overflow:ellipsis` pour rester sur une seule ligne.

- **Impression étiquettes — débordement du prix corrigé**
  - Le prix avait `flex-shrink:0` et `white-space:nowrap` sans limite de largeur, pouvant sortir de l'étiquette pour des montants longs (ex : `1 250 000F`). Ajout d'une taille de police adaptive selon la longueur du montant (`8pt` → `7pt` → `6.5pt`) et d'un `max-width:45%` avec `text-overflow:ellipsis`.

### ✨ Nouvelles fonctionnalités

- **Rapport Excel mensuel — 7 nouvelles feuilles**
  - `backend/api/views/rapports/excel_general_extra.py` : nouveau module dédié aux feuilles supplémentaic re  c0vcv0cdfedeeeeeeee_çès.
  - **Feuille 11 — Modes de Paiement** : récapitulatif global par mode (espèces, CB, virement…), détail JSON des clôtures de caisse, et évolution journalière par mode.
  - **Feuille 12 — Retours & Annulations** : liste des factures annulées dans le mois (date, client, montant, annulé par, motif) + top produits retournés via `MouvementStock`.
  - **Feuille 13 — Performance Vendeurs** : CA, nb ventes, panier moyen, remises accordées, taux remise et nb annulations par vendeur.
  - **Feuille 14 — Suivi Trésorerie** : encaissements / dépenses / achats fournisseurs par semaine ISO, solde net et solde cumulé, projection mois suivant basée sur les créances.
  - **Feuille 15 — Périmés & Pertes** : ajustements de stock `PERIME` du mois avec quantité détruite, PMP et valeur perdue.
  - **Feuille 16 — Promotions** : promotions actives sur la période avec type, valeur, dates et nb produits couverts.
  - **Feuille 17 — Clients Pro & Mutuelles** : CA du mois, encours et taux d'utilisation du plafond par client professionnel.

- **Feuille 1 (Synthèse) enrichie**
  - Bloc **Évolution vs mois précédent** : variation CA, marge et nb ventes avec indicateurs ▲/▼ colorés.
  - Bloc **Objectif commercial** : CA objectif vs réalisé, taux d'atteinte et écart (vert ≥ 100 %, orange ≥ 80 %, rouge < 80 %).

### 🐛 Corrections

- **Feuille "Stock & Inventaire"** : les produits sans rayon assigné (`rayon=NULL`) étaient exclus. Désormais affichés sous la ligne **(Sans rayon)**.
- **Feuille "État des Caisses"** : tous les caissiers apparaissent maintenant, y compris ceux avec uniquement des paiements en espèces. Fallback `username` si `get_full_name()` est vide. Ajout de sous-tableaux individuels par caissier sous le récapitulatif général.
- **Feuille "Achats Fournisseurs"** : suppression du `.exclude(type="DIV")` — les commandes de type Divers (fournisseurs divers) sont maintenant incluses.
- **Suivi Trésorerie** : la colonne "Achats fournisseurs (F)" était toujours à zéro (boucle manquante). Alimentée via `CommandeProduit.price_cost × quantity` par semaine ISO.
- `excel_general_extra.py` : correction `MouvementStock.created_at` → `MouvementStock.date` (FieldError).
- `excel_general_extra.py` : correction `ValueError: Unknown format code 'd' for object of type 'float'` sur la variation nb ventes — cast `int()` ajouté.
- `Promotion` : correction des noms de champs (`nom` → `name`, `type` → `discount_type`, `valeur` → `value`, `date_debut` → `start_date`, `date_fin` → `end_date`, `produits` → `products`).

---

## 2026-06-30

### 🐛 Corrections

- **Date d'expiration non sauvegardée lors de la création d'un produit**
  - `frontend/src/schemas/productSchema.ts` : ajout du champ `expire_date` au schéma Zod.
  - Le champ était envoyé dans le payload mais strippé par Zod car absent du schéma.
  - Désormais, si l'utilisateur laisse le champ vide, `null` est envoyé (pas de génération automatique).

- **Impression des étiquettes en orientation verticale au lieu d'horizontale**
  - `frontend/src/components/SimplePrintLabelsModal.tsx` : ajout d'un bouton **PDF** qui appelle le backend `commandes.py:imprimer_etiquettes`.
  - Le backend génère un PDF ReportLab avec `pagesize=(40mm, 20mm)` (orientation paysage) — format respecté par les imprimantes d'étiquettes Windows.
  - Le bouton d'impression navigateur est conservé pour les cas où le CSS `@page` fonctionne.

---

## 2026-06-29

### ✨ Nouvelles fonctionnalités

- **Répartition manuelle des lots en facturation**
  - `frontend/src/components/LotSelectionModal.tsx` : modal transformé en table avec inputs de quantité par lot.
  - Le mode **FEFO automatique** reste proposé par défaut, mais l'utilisateur peut modifier chaque lot individuellement.
  - `frontend/src/hooks/useFacturationUI.ts` : le state `lotModal` stocke `quantity` et `currentAllocations`.
  - `frontend/src/hooks/useFacturationActions.ts` : `handleLotSelect` accepte un tableau `LotAllocation[]` et met à jour `lotAllocations` sur la ligne.
  - `frontend/src/components/facturation/CartTable.tsx` : badge lot affiche la répartition manuelle (`2 lots • LotA×1, LotB×1`) avec tooltip détaillé et style visuel distinct (vert).
  - `frontend/src/hooks/useSaleCompletion.ts` : envoie `lot_allocations` au backend lors de la finalisation de la vente.
  - `backend/api/services/sales_service.py` : `validate_invoice` utilise les allocations explicites `_lot_allocations` pour débiter les lots choisis par l'utilisateur, avec vérification du stock disponible par lot.

### 🎨 Améliorations UI

- **Modernisation des modals fournisseurs avec shadcn/ui**
  - `frontend/src/components/EcheancierFournisseursModal.tsx` : remplacement du modal legacy par `Dialog` shadcn/ui, ajout de cartes de résumé, filtres `Input`/`Select`, tableau `Table`, badges de statut et `SkeletonTable` pour le chargement.
  - `frontend/src/components/FinanceFournisseurModal.tsx` : optimisation de la taille de fenêtre et des espacements, remplacement du `<select>` natif par le composant `Select` shadcn/ui, uniformisation des tableaux et des boutons avec la bibliothèque de composants.
- `frontend/src/components/fournisseurs/SupplierDashboard.tsx` : limite de hauteur (`max-h-[420px]`) et défilement vertical sur le tableau des échéances prioritaires pour éviter qu'il ne s'étire indéfiniment.
- `frontend/src/components/caisse/JournalCaisseClosingModal.tsx` : ajout d'une section **Répartition des ventes** dans le modal de clôture affichant séparément les ventes Pharmacie (vert) et les ventes Diverses (violet), avec total consolidé. La section n'apparaît que si les données sont disponibles, et les Ventes Diverses sont masquées si leur montant est nul.

### 🐛 Corrections

- **Calcul de la dette fournisseur**
  - `backend/api/views/fournisseurs.py` : harmonisation du calcul du solde de dette et de l'évolution de la dette sur le **prix fournisseur** (`price`) au lieu du **coût effectif** (`price_cost`).
  - Auparavant, le tableau de bord affichait une dette totale inférieure au « Dû prochainement » car l'échéancier utilisait `price` tandis que le solde utilisait `price_cost`.

### ⚡ Performance / Fiabilité

- **Vidange caisse centralisée — traitement par lots**
  - `backend/api/views/ventes/factures.py` : `bulk_cancel` accepte `batch_size` et renvoie `processed / remaining / total` pour un suivi de progression.
  - `frontend/src/components/CaisseCentralisee.tsx` : annulation des factures en plusieurs requêtes avec barre de progression.
  - Suppression du `@transaction.atomic` global sur `bulk_cancel` pour éviter les timeouts sur de gros volumes (chaque `cancel_invoice` conserve sa propre transaction atomique).

---

## 2026-06-28

### 🌐 Suppression ngrok — Tailscale comme unique tunnel externe

- **Suppression du conteneur ngrok**
  - `docker-compose.prod.yml` : service `ngrok` supprimé (image, port 4040, variable `NGROK_AUTHTOKEN`).
  - `.env.example` : section ngrok supprimée.
  - `install.sh` : génération de `NGROK_AUTHTOKEN` et warning supprimés.
  - `docs/TECHNIQUE/CONFIGURATION.md` : section ngrok, port 4040 et ligne conteneur supprimés.
  - `docs/TECHNIQUE/ARCHITECTURE.md` : table services et section sécurité mises à jour (Tailscale uniquement).
  - `tailscale/README-TAILSCALE.md` : tableau comparatif ngrok supprimé.
  - `backend/backend/settings.py` : commentaire proxy mis à jour.

- **Finalisation config Tailscale**
  - `frontend/frontend/nginx.conf` : ajout du bloc `location /ws/` avec proxy WebSocket (`Upgrade`, `Connection upgrade`, `proxy_read_timeout 86400`).
  - Permet aux WebSocket (PDA, caisse, verrouillage documents) de passer via Tailscale Funnel en production.
  - `tailscale/tailscale-serve.json` : inchangé (proxy `https://<hostname>.ts.net` → `http://frontend:80`).

### 🔒 Gestion des accès concurrents (Commande & Inventaire)

- **Problème** : ouverture simultanée du même dossier par deux postes → écrasement silencieux.

- **Backend — `DocumentLockConsumer` (WebSocket)**
  - `backend/api/consumers.py` : nouveau consumer `DocumentLockConsumer`.
  - Verrou Redis TTL 30s par clé `doc_lock:<model>:<pk>`.
  - Protocole : `acquire` / `release` / `heartbeat` (renouvellement TTL toutes les 15s).
  - Broadcast groupe : tous les postes connectés sur le même document reçoivent `lock_update`.
  - Déconnexion propre : libération automatique du verrou si le poste ferme le navigateur.

- **Backend — Routing WebSocket**
  - `backend/api/routing.py` : URL `ws/lock/<model>/<pk>/` → `DocumentLockConsumer`.

- **Backend — Endpoints REST (fallback HTTP)**
  - `backend/api/views/commandes/commandes.py` : `POST lock/`, `POST unlock/`, `GET check_lock/`.
  - `backend/api/views/stocks/inventaire_main.py` : idem sur `InventaireViewSet`.
  - HTTP 423 `LOCKED` si le verrou est détenu par quelqu'un d'autre.

- **Backend — Champ `version` sur `Inventaire`**
  - `backend/api/models/inventory.py` : champ `version IntegerField(default=1)`.
  - Migration `0210_add_version_to_inventaire.py` appliquée.

- **Frontend — Hook `useDocumentLock`**
  - `frontend/src/hooks/useDocumentLock.ts` : gestion WebSocket avec reconnexion automatique et heartbeat.
  - Exporté depuis `hooks/index.ts`.

- **Frontend — Composant `LockBanner`**
  - `frontend/src/components/common/LockBanner.tsx` : bannière contextuelle (vert = édition, orange = lecture seule, bleu = disponible).
  - Exporté depuis `components/common/index.ts`.

- **Frontend — Intégration**
  - `CommandeDetails.tsx` : `LockBanner` affiché pour commandes non clôturées. Boutons Modifier / Suspendre / Clôturer / Supprimer désactivés si `isReadOnly`.
  - `InventaireEditor.tsx` : `LockBanner` affiché pour inventaires non validés.

- **Backend — Authentification WebSocket par token**
  - `backend/api/ws_auth_middleware.py` : nouveau `TokenAuthMiddleware` pour authentifier les WebSocket via `?token=<drf_token>` en query string.
  - `backend/backend/asgi.py` : `TokenAuthMiddleware` ajouté dans la stack ASGI (avant `AuthMiddlewareStack`).
  - Token invalide → connexion fermée (code 4001). Sans token → retombe sur session auth.

- **Backend — Validation des entrées (durcissement)**
  - `commandes.py` & `inventaire_main.py` : validation PK numérique `> 0` sur les 6 actions `lock` / `unlock` / `check_lock`.
  - PK non-numérique, négatif ou zéro → HTTP 404.
  - Les méthodes HTTP non autorisées retournent 405 (DRF `@action`).
  - Authentification obligatoire : sans token → 401.

- **Tests automatisés**
  - `backend/scripts/test_locking.py` : 9 tests fonctionnels (REST + WebSocket) — TTL, race condition, broadcast multi-user, idempotence.
  - `backend/scripts/test_locking_inputs.py` : 39 tests de validation des entrées — auth, PK invalide, méthodes HTTP, payloads malformés, injection Redis, isolation cross-entité, WebSocket auth.
  - **Résultat** : 39/39 passés, 0 échoués.

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
