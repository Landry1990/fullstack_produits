# Plan de Tests Global — Facturation / Commandes / Caisse / Inventaire

> Fichier de suivi. Cocher `[x]` et ~~barrer~~ les items terminés et concluants.
> Objectif : 2 jours maximum. Baseline de départ : 269 tests passent, 5 échouent, 7 skip.

---

## Baseline (état initial confirmé)

| Couche        | Fichiers | Tests                                   | Échecs                                                                                  |
| ------------- | -------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| Frontend unit | 39       | 269 passent, 5 échouent, 7 skip         | `Commandes.test.tsx` (2 — `reconditionnement.modal`), `CommandeToAvoir.test.tsx` (3 — `ResizeObserver`) |
| Frontend E2E  | 5        | ~22 (non exécutés ce cycle)             | —                                                                                       |
| Backend       | 52       | ~305 (DB Docker requise)                | —                                                                                       |

---

## Phase 0 — Stabilisation baseline (~30 min)

- [x] **0.1** Fix `Commandes.test.tsx` : ajouter `reconditionnement` au mock `useCommandeActions` (champ manquant → `undefined.modal.open` plante) ✅
- [x] **0.2** Fix `ResizeObserver` dans `src/test/setup.ts` : remplacer la factory par une vraie classe ES (Radix fait `new ResizeObserver(...)`) ✅
- [x] **0.3** Vérifier que `CommandeToAvoir.test.tsx` passe après 0.2 ✅ (5/5 tests passent)
- [x] **0.4** Re-run suite frontend complète → 0 échec ✅ (38 passed, 1 skipped, 274 tests passent, 7 skip)

---

## Phase 1 — Facturation (Jour 1, ~3-4h)

### Frontend

**Améliorer l'existant :**
- [x] `CartTable.test.tsx` : ajouter cas **lot avec prix ≠ prix global** (régression Cifran 5100 vs 7000) ✅
- [x] `Facturation.test.tsx` : ajouter recherche produit + ajout panier + vérif `prix_unitaire` = prix lot ✅
- [x] `useCart.test.tsx` : ajouter test **multi-lot = une ligne par lot** (régression « une ligne par lot ») ✅
- [ ] `PaymentModal.test.tsx` : ajouter **paiement multi-modes** + **tiers-payant partiel**

**Nouveaux tests (régressions critiques) :**
- [x] `utils/fefo.test.ts` : `sortLotsByFEFO` (tri par expiration), `allocateLotsFEFO` (1 lot suffit, 2 lots nécessaires, qty > stock total) ✅ (9 tests)
- [x] `utils/lotPricing.test.ts` : `getLotPrice` (prix lot présent, fallback prix produit, lot sans prix) ✅ (6 tests)
- [x] `utils/uuid.test.ts` : vérifier unicité sur 1000 générations (existant 5 tests, à compléter) ✅
- [ ] Test intégration `addProduit` : mock `stock-lots/` → allocation FEFO auto + ouverture modal si qty > lot
- [ ] Test `handleLotSelect` : sélection lot → `prix_unitaire` = prix lot, `total_ligne` recalculé, ligne ciblée par `lineId`

### Backend

**Compléter l'existant :**
- [x] `test_facturation.py` : vente avec **lot spécifique prix ≠ prix produit** → marge correcte ✅
- [x] `test_invoice_validation.py` : **annulation après paiement multi-lots** → restauration stock par lot ✅
- [x] `test_lot_allocation_service.py` : **allocation FEFO avec prix lot différent** → `prix_vente` par ligne ✅
- [x] `test_sale_finalizer.py` : **payload multi-lots** (une ligne par lot) → `LigneFacture` + `MouvementStock` par lot ✅

**Nouveau :**
- [x] `test_facturation_contract.py` : valider payload frontend (`lineId`, `lotId`, `prix_unitaire`, `quantite`, `remise`) accepté par `POST /api/ventes/finaliser/` ✅ (6 tests)

**Bug découvert et corrigé :**
- [x] `PromotionService.apply_promotions_to_invoice()` n'écrase plus les remises manuelles quand il n'y a pas de promo active ✅

---

## Phase 2 — Commandes (Jour 1, ~3h) ✅

### Frontend (18 tests ajoutés, 36/36 passent)

**Améliorer l'existant :**
- [x] `Commandes.test.tsx` (2 → 6) : bouton clôturer, transition PREP→CLOT, modal reconditionnement caché par défaut, rendu CommandeForm en EDIT ✅ (4 tests)
- [x] `commandeCalculs.test.ts` : **taux change avec décimales**, **répartition paiement multi-fournisseurs**, **gratuités (unités offertes)** ✅ (5 tests)
- [x] `useCommandeFournisseurs.test.tsx` : **filtre divers/non-divers combiné** + **pagination sans truncation** ✅ (2 tests)

**Nouveaux tests :**
- [x] `ReconditionnementModal.test.tsx` : ouverture, liste transformations, sélection/désélection, modification quantité, appel endpoint `transformer/`, blocage si stock source = 0 ✅ (7 tests)
- [-] `CommandeForm.test.tsx` : reporté (couverture UI suffisante via Commandes.test.tsx)

### Backend (10 tests ajoutés, 25/25 passent)

**Compléter l'existant :**
- [x] `test_order_management.py` : **transition PREP→CLOT explicite** + **création lots de stock après clôture** ✅ (2 tests)
- [x] `test_mise_en_place.py` : **échéance échue + paiement différé** + **paiement comptant** ✅ (2 tests)
- [-] `test_bulk_delete_fix.py` : non modifié (passe déjà)

**Nouveaux tests :**
- [x] `test_reconditionnement_flow.py` : clôturer → `HistoriqueTransformation` créé → `MouvementStock` TRANSFORMATION → blocage si stock source insuffisant → décrémente source/incrémente cible ✅ (4 tests)
- [x] `test_commande_cloture_status.py` : garantir statut `CLOT` après clôture (régression bug historique) + double clôture rejetée ✅ (2 tests)

---

## Phase 3 — Caisse (Jour 2, ~3h) ✅

### Frontend (8 tests ajoutés, 43/43 passent)

**Améliorer l'existant :**
- [x] `useCaisseCoupons.test.ts` : **coupon expiré**, **coupon sur produit en promotion** (stacking) ✅
- [x] `useCaisseKeyboard.test.ts` : **raccourci paiement rapide** (Enter → PaymentModal) ✅
- [x] `useCaisseStats.test.ts` : **stats par mode de paiement** (espèces/CB/mobile) ✅
- [x] `JournalCaisse.test.tsx` : **filtre par mode**, **écart caisse affiché** ✅

**Nouveaux tests :**
- [-] `caisse/PaymentFlow.test.tsx` : reporté (couverture backend suffisante sur capping/partial/multi)
- [-] `caisse/CashClosure.test.tsx` : reporté (couverture backend suffisante sur clôture)

### Backend (11 tests ajoutés, 17/17 passent)

**Compléter l'existant :**
- [x] `test_cash_closure.py` : **clôture avec ventes en attente** (échec 400) + **double clôture même jour** (échec 409) ✅ (2 tests)
- [x] `test_caisse_integrity.py` : **multi-modes + recouvrements + avoirs** + **avoir impacte négativement le total coupon** ✅ (2 tests)

**Nouveaux tests :**
- [x] `test_caisse_multi_payment.py` : facture payée en 3 fois → `PAYEE`, paiement partiel → `VALIDEE`, atomicité (paiement négatif rejeté) ✅ (4 tests)
- [x] `test_caisse_overpayment.py` : paiement > total → cappé au reste, rendu monnaie implicite, surpaiement sur facture partielle ✅ (3 tests)

---

## Phase 4 — Inventaire (Jour 2, ~2-3h)

### Frontend

**Améliorer l'existant :**
- [ ] `Inventaire.test.tsx` (1 → 6+) : création inventaire, pré-remplissage, saisie écarts, validation, fusion doublons
- [ ] `StockAnalysis.test.tsx` : **filtre périmés**, **export Excel**, **tri par valeur stock**

**Nouveaux tests :**
- [ ] `inventaire/InventoryAdjustment.test.tsx` : ajustement positif/négatif, permission requise, mode Sudo, `MouvementStock` AJUSTEMENT
- [ ] `inventaire/ExpiredLots.test.tsx` : affichage lots expirés, filtre, mise au rebut

### Backend

**Compléter l'existant :**
- [ ] `test_stock_inventory.py` : **écarts positifs ET négatifs** + **validation mode Sudo**
- [ ] `test_stock_management.py` : **ajustement sans permission** (403), **PMP recalculé après ajustement**
- [ ] `test_stock_movements_comprehensive.py` : **cohérence `Produit.stock` = Σ `StockLot.quantity_remaining`** après chaque mouvement
- [ ] `test_stock_transformations.py` : **transformation avec lot source périmé** (doit échouer)

**Nouveaux tests :**
- [ ] `test_inventory_consistency.py` : après vente + annulation + ajustement, `Produit.stock` == Σ lots + historique cohérent
- [ ] `test_expired_lot_handling.py` : lot expiré non allouable en vente FEFO, marquage, mise au rebut

---

## Phase 5 — Contrôle final (~1h)

- [ ] **5.1** Run full frontend suite : `npm run test -- --run` → 0 échec attendu
- [ ] **5.2** Run backend tests critiques :
  ```
  pytest api/tests/test_facturation.py api/tests/test_invoice_validation.py \
         api/tests/test_order_management.py api/tests/test_cash_closure.py \
         api/tests/test_stock_management.py api/tests/test_stock_inventory.py -v
  ```
- [ ] **5.3** Build frontend : `npm run build` → 0 erreur
- [ ] **5.4** Vérifier traductions fr/en pour tout nouveau label de test
- [ ] **5.5** Entrée `CHANGELOG.md` datée

---

## Stratégie d'exécution

| Créneau             | Travail              | Méthode                              |
| ------------------- | -------------------- | ------------------------------------ |
| Jour 1 — 0h-0h30    | Phase 0 (baseline)   | Direct (trivial)                     |
| Jour 1 — 0h30-4h    | Phase 1 Facturation  | 2 subagents parallèles (FE + BE)     |
| Jour 1 — 4h-7h      | Phase 2 Commandes    | 2 subagents parallèles (FE + BE)     |
| Jour 2 — 0h-3h      | Phase 3 Caisse       | 2 subagents parallèles (FE + BE)     |
| Jour 2 — 3h-6h      | Phase 4 Inventaire   | 2 subagents parallèles (FE + BE)     |
| Jour 2 — 6h-7h      | Phase 5 Contrôle     | Subagent de contrôle + moi           |

---

## Légende

- `[ ]` — à faire
- `[x]` — fait et test concluant
- `[~]` — fait mais test encore instable / à revoir
- `[-]` — abandonné (raison à documenter)
