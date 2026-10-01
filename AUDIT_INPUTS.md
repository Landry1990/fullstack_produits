# Audit de validation des inputs — Fullstack Produits

> Audit statique réalisé le 2026-10-01. Périmètre : frontend React (`frontend/frontend/src/`) + backend DRF (`backend/api/`). Aucune modification de code — rapport uniquement.
>
> **Constat central** : les garde-fous sont presque exclusivement dans les *vues* et le frontend. Les modèles financiers/stock (`billing.py`, `stock.py`, `products.py`, `orders.py`) n'ont **aucun `MinValueValidator`, aucun `CheckConstraint`, aucun `full_clean()`**. La plupart des `ModelViewSet` exposent `PATCH/PUT/DELETE` avec `fields='__all__'` → **la validation frontend peut être entièrement contournée par un simple appel API authentifié.**

---

## 1. Synthèse

| Catégorie | Nb de findings | Sévérité dominante |
|---|---|---|
| Mass assignment (PATCH/DELETE libres sur données financières) | ~12 ViewSets | 🔴 CRITIQUE |
| Valeurs négatives / non bornées acceptées en base | ~20 chemins | 🔴 CRITIQUE |
| Bypass sudo / permissions | 4 | 🔴 CRITIQUE |
| `NaN` / `Infinity` → 500 ou persisté en `numeric` | ~10 chemins | 🔴 CRITIQUE |
| Casts `int()/Decimal()` non protégés → 500 | ~44 occurrences | 🟠 MOYEN |
| Champs texte > `max_length` → `DataError` → 500 | ~8 champs | 🟠 MOYEN |
| Frontend : saisies permises mais dangereuses | ~15 points | 🟠 MOYEN |

---

## 2. 🔴 CRITIQUE — Mass assignment : PATCH/DELETE libres

Ces `ModelViewSet` sont en `IsAuthenticated` seul (ou sans surcharge de `update`/`partial_update`/`destroy`) avec des serializers `fields='__all__'` sans `read_only_fields`. **Tout utilisateur authentifié peut réécrire les données financières.**

| Endpoint | Fichier | Champs falsifiables | Impact |
|---|---|---|---|
| `PATCH /factures/{id}/` | `serializers/billing.py:126-145`, `views/ventes/factures.py` | `status`, `numero_facture`, `remise`, `tva`, `montant_verse`, `montant_rendu`, `part_client`, `points_fidelite_*`, `created_by`, `validated_by`, `remise_validated_by`, `prix_validated_by`, `date`, `poste_caisse` | Statut PAY sans encaissement, falsification du validateur et de l'audit, réécriture des dates |
| `PATCH /caisse/{id}/` + `DELETE` | `views/ventes/caisse.py` (update non surchargé), `serializers/billing.py:43-52` | `montant`, `statut`, `facture`, `mode_paiement`, `reference` | Modification d'encaissements passés — vol dissimulé |
| `POST/PATCH/DELETE /mouvements-caisse/` | `views/ventes/mouvements.py:17`, `serializers/audit.py:25-31` | `montant` (négatif ok), `type`, `motif` | Entrées fictives gonflant `total_entrees` de la clôture ; suppression physique de mouvements |
| `POST/PATCH /facture-produits/` | `views/ventes/facture_produits.py:18` | `quantity`, `selling_price`, `discount`, `tva`, `free_quantity`, `facture` | Lignes négatives / ajout sur facture **validée** → recalcul auto des totaux via signal |
| `PATCH /coupons/{id}/` | `views/coupons.py:17` (`perform_update` non surchargé) | `montant`, `status`, `utilise_par` | Réactivation d'un coupon utilisé, gonflage du montant |
| `POST/PATCH/DELETE /paiements-fournisseurs/` | `views/paiements.py:14-120`, `serializers/orders.py:44-71` | `montant` (négatif ok) | Dette fournisseur effacée ou gonflée artificiellement |
| `PATCH /clients/{id}/` | `serializers/clients.py:35-46` (aucun `read_only_fields`) | `solde_depot`, `points_fidelite`, `taux_couverture`, `plafond`, `solde_factures` | **Monnaie fictive** : `solde_depot` utilisable directement en caisse (`caisse.py:109`) |
| `PATCH /produits/{id}/` | `views/produits.py:43`, `serializers/products.py` | `stock`, `stock_reserve`, `selling_price`, `cost_price`, `pmp`, `tva`, `use_lot_management` | Stock fantôme sans `MouvementStock`, prix à 0, PMP falsifié |
| `PATCH /stock-lots/{id}/` | `views/stocks/stock_lots.py:21` | `quantity_remaining`, `quantity_initial`, `price_cost` | Gonflage de lot avec traçabilité "légitime" |
| `PATCH /inventaires/{id}/` + `/lignes-inventaire/` | `serializers/inventory.py:31-50` | `status` (`VALIDEE` direct), `quantite_physique`, `pmp_snapshot` | Court-circuit du flux de validation d'inventaire |
| `PATCH /avoirs/{id}/` + `/lignes-avoir/` | `serializers/inventory.py:79-100`, `views/commandes/avoirs.py:353` | `status`, `validated_by`, `est_cloture`, `quantity`, `price` | Falsification d'avoirs, retour stock sauté |
| `PATCH /promis/{id}/` | `views/commandes/promis.py` | `status` (`DEL` direct sans mouvement de stock) | Livraison fictive |

---

## 3. 🔴 CRITIQUE — Valeurs négatives / non bornées → corruption stock & finance

| Chemin | Fichier:ligne | Effet |
|---|---|---|
| `POST stock-lots/{id}/sortir_perimes/` | `stocks/stock_lots.py:59-85` | `quantity=-5` → `quantity_remaining -= (-5)` → **+5 de stock** (inflation) |
| `POST produits/{id}/adjust_stock/` | `produit_actions/stock.py:198-278` | `new_quantity=-5` accepté → `produit.stock=-5`, divergence stock/lots permanente |
| `POST promis/` | `commandes/promis.py:56-71`, `serializers/promis.py` | `quantite=-500` → `produit.stock += 500` (création de stock) |
| `bulk_sync commande-produits/` | `commandes/commande_produits.py:113-248` | `to_int`/`to_decimal` acceptent négatifs silencieusement (`'abc'`→0 !) ; prix négatifs propagés sur la **fiche produit** ; à la clôture → lots/stock négatifs |
| `LigneAvoir` + `decharger_stock` | `serializers/inventory.py:79-85`, `commandes/avoirs.py:111-193` | `quantity=-5` → `stock = F('stock') - (-5)` → **+5** au lieu de retirer |
| `POST /caisse/cloturer/` + `mouvements-caisse` | `cloture_mixin.py:139-158` | `mouvements_manuels` non schématisés : `type` arbitraire, `montant` string → `TypeError`→500, ENTREE fictives gonflant le théorique |
| `POST creances/ajouter_paiement/` | `ventes/creances.py:486-527` | Pas de `montant > 0` → paiement négatif persisté → `reste_a_payer` gonflé |
| `ajouter_versement` client | `views/clients.py` | `Decimal` catché mais pas de `> 0` → dépôt négatif |
| `POST coupons/` | `serializers/promis.py:84-98` | `montant` sans borne → coupon négatif (monnaie) |
| `RelationTransformation.ratio` | `models/inventory.py:140`, `stocks/transformations.py:284-289` | `ratio <= 0` → source consommée, destination **diminuée** (double destruction) |
| `quantite_physique` inventaire | `inventaire/bulk.py:220`, `csv_import.py:149`, `serializers/inventory.py` | `-5` accepté partout (UI, PATCH, bulk, CSV) → déstockage à la validation |
| `Produit` (prix, tva, seuils) | `models/products.py:170-301` | `cost_price`/`selling_price` négatifs, `tva` > 100, stocks négatifs — aucun validateur |
| `Promotion.value`, `TVA.taux`, `PharmacySettings` (~40 champs), `LoyaltySetting`, `Client.taux_couverture`/`plafond`, `Commande.taux_change` | models `promotions.py`, `settings.py`, `clients.py`, `orders.py` | Aucune borne 0-100 / ≥0 → remises 200 %, taux fiscaux négatifs |
| Import produits (`produit_import.py`, `import_views.py`) | écriture ORM directe | Prix négatifs, TVA hors borne, **`Decimal('NaN')` persistable en `numeric`**, pas de limite de taille fichier |
| Fusion de lots commandes | `hooks/commandes/useCommandeProductLines.tsx:447-455` | `'2' + '3' = '23'` (strings concaténées) → quantité 23 au lieu de 5 |

---

## 4. 🔴 CRITIQUE — Bypass permissions / sudo

| Chemin | Fichier:ligne | Problème |
|---|---|---|
| `POST factures/finaliser/` | `sales_actions.py:189-218` | `remise_validated_by_id` / `prix_validated_by_id` = **n'importe quel user_id existant** supprime la permission sudo requise — sans preuve (mot de passe), sans vérifier que le user a la permission. Usurpation écrite en base + audit |
| `POST factures/finaliser/` | `sales_actions.py:128` | `is_avoir_client` flag **fourni par le client** contourne `can_validate_zero_amount` |
| `POST caisse/cloturer/` | `cloture_mixin.py:203-211` | `montant_theorique_frontend` = valeur **client prioritaire sur le calcul serveur** → `ecart=0` falsifiable → dissimulation de vol en caisse |
| ViewSets config | `settings.py:30,67`, `promotions.py:21`, `settings.py:730` (TVA) | `LoyaltySetting`, `ConfigurationOption`, `Promotion`, `TVA` : `IsAuthenticated` en **écriture** (vs `IsAdminUser` sur `PharmacySettings` — incohérence) |
| Quantités négatives vente | `sale_finalizer.py:236` | Aucune vérification `can_do_returns` pour `quantity < 0` |
| `StockAdjustmentViewSet` | `stocks/adjustments.py:28` | `AllowAny` → journal d'ajustements lisible **anonymement** |
| `bulk_delete` produits | `produit_actions/bulk_ops.py` | Suppression en masse sans sudo visible (à confirmer vs permission de classe) |

---

## 5. 🔴/🟠 NaN, Infinity et casts → HTTP 500 (au lieu de 400)

`Decimal('NaN')` **ne lève pas** d'exception au cast — la comparaison `NaN < 0` lève `InvalidOperation` ensuite, hors try :

| Fichier:ligne | Payload → effet |
|---|---|
| `ventes/caisse.py:149-153` | `montant="NaN"` → `InvalidOperation` → **500** |
| `ventes/creances.py:490-492` | `montant="abc"` → `InvalidOperation` non capturé → **500** ; `mode_paiement=["x"]` → `.upper()` `AttributeError` → **500** ; bulk : `.upper()` avant validation (l.677) → `None.upper()` → **500** ; `montant_total` NaN → **500** (l.723-729) |
| `cloture_mixin.py:28-34,211` | `montant_reel="NaN"` → écart NaN → **500** ; négatif/∞ persisté |
| `cloture_mixin.py:72` | `user_id="abc"` → `ValueError` non capturé → **500** |
| `sales_actions.py:106` | `int(product_data.quantity)` non protégé → `"1.5"`/`"abc"` → **500** (endpoint de vente !) |
| `sale_finalizer.py:146,366-387` | `Decimal(str(p['montant']))`, `part_patient` bruts → `InvalidOperation`/`KeyError`/`AttributeError` → **500** |
| `sale_modifier.py:67,169,175` | `remise`, `selling_price` string, `discount`, `tva` → `InvalidOperation` → **500** |
| `caisse_poste.py:177-178,222` | `fond_de_caisse="abc"` → **500** ; négatif accepté → propage dans les clôtures |
| `transformations.py:36,106,373` | `int(request.data.quantite)` non protégé → **500** |
| `stock_lots.py:59` | `sortir_perimes` `int()` non protégé → **500** |
| `suggestions.py:84-104` | `periode`, `fournisseur_id`, dates → **500** |
| `commandes/bulk_actions_mixin.py:39,105` | `int(quantity)` → **500** ; négatif décrémente une ligne |
| `purge.py:235,287,353` | `date_from/date_to` invalides → `ValidationError` ORM → **500** |
| `dci_admin.py:132` | `int(page)` → **500** ; `substance_ids` non typés → `.set()` 500 |
| `coupons.py:104` | `facture_id="abc"` → `ValueError` non capturé → **500** |
| Query params GET (~20 endpoints) | `analysis.py`, `cadencier.py`, `challenges.py:550`, `stats.py`, `dashboard/*`, `margin_views.py:130`, `temporal_analysis.py`, `paiements.py:31` (dates), `caisse.py:266` (`date__date__gte` string brute) | `?days=abc` / `?date_debut=xyz` → **500** |
| Inventaire | `bulk.py:96-104` (`produit: 'abc'` → 500 global), `inventaire_main.py:338` (`int('abc')`), `csv_import.py` (`'nan'`, `'inf'`, `'1.5'` → 500 ou NaN persisté) | **500** |

---

## 6. 🟠 MOYEN — Champs texte > `max_length` → `DataError` → 500

| Champ | Limite | Fichiers concernés |
|---|---|---|
| `client_name_override` / nom impression A4 | 100 | `ClientSection.tsx:274` (pas de `maxLength`), `ClientNameModal.tsx:90` → 500 |
| `promis_phone` | 20 | `StockResolutionModal.tsx:231-251` → **500 trivial** (21+ chiffres) |
| `lot` (commande/clôture/ajustement) | 20 | `CommandeProductRow.tsx:328`, `StockAdjustmentModal.tsx:173`, `bulk.py`, `correct_lot` → 500 |
| `motif` (avoir/mouvement) | 200 | `AvoirsForm.tsx:294`, `cloture_mixin` bulk_create → 500 |
| `reference` (paiement concaténé) | 100 | `creances.py:499,524`, `BulkPaiementModal.tsx` → 500 |
| `notes` / `description` | illimité (`TextField`) | volume arbitraire persisté (exports/PDF) — à borner |
| Doublons `(produit, lot)` | contrainte unique | `cloture_mixin` + `bulk.py` créent sans pré-check → `IntegrityError` → 500 |

Autres points MOYEN :
- `_cap_montant` (`caisse.py:119`) + `Math.min` (`useCaissePayment.ts:46`) : **plafonnement silencieux** — montant enregistré ≠ montant demandé, sans message.
- Dates filtres invalides **silencieusement ignorées** (`creances.get_queryset`, `caisse.py:59-67`) → résultats non filtrés ; `cloturer` : dates invalides → fallback silencieux dernière clôture.
- `update_alerte` (`clients.py:270`) : `bool("false")` → `True` → alerte bloquante sur tout client.
- `send_whatsapp` : `window.prompt` numéro sans format (`CaisseCentralisee.tsx:295`).
- `mode_paiement` `CharField(50)` **sans choices** → chaîne libre persistée, fausse les totaux par mode.
- `blocking_alerte`, `abc_a_only` : strings `"false"` truthy.
- Dates d'expiration **passées** acceptées partout (commandes, ajustements, inventaire).
- `sync_mobile` (`sales_actions.py:452`) : envoie `product_id` mais le finalizer lit `produit` → **paraît cassé** (à vérifier si l'app mobile est utilisée).
- `OrdonnanceModal` : `numero_ordre` et `date_prescription` saisis mais **jamais envoyés** au backend (champs morts).

---

## 7. 🟡 Frontend — patterns faibles

- **`normalizeNumberInput`** (`utils/formatters.ts:25-51`) : `NaN`/`Infinity`/`'abc'`/`''` → **0 silencieux** partout — masque les saisies erronées au lieu de les signaler.
- **Filtres regex `[^0-9.]`** (`TableCartRow`, `TotalsSection`) → `'1.2.3'` accepté → `parseFloat` partiel.
- **`type="number"` sans `min`/`max`/`required`** : `PaymentModal` montant (`-5` ajoutable par clic : `!montant || montant === 0` laisse passer les négatifs), `OpenCashSessionModal` fond de caisse, `JournalCaisseClosingModal` montant réel, `FiscalTab`/`StocksTab` (`parseFloat` sans garde NaN → `null` JSON → 400), `UserPermissionsTab` `max_discount_rate` (backend borné 0-100 ✅), `Transformations` ratio, `SuggestionCommandeModal` budget, `CommandeForm` `taux_change`/`frais_coefficient`.
- **`useCaisseCoupons`** : `Number(montant) <= 0` — `NaN <= 0` = false → `NaN` passe → `null` JSON.
- **`validateSaleData`** : pas de `isFinite` sur `totalSaisi` → contrôle "montant insuffisant" sauté sur NaN.
- **`QuickCreateProductModal`** : valide les valeurs normalisées mais **envoie les strings brutes** (`'1,5'` → 400).
- **`CommandeProductRow`** : toutes les cellules `type="text"` sans validation — tout repose sur le backend (permissif, cf. §3).
- **`ClientCreditForm`/`AvoirsForm`** : remise/TVA sans `max`, `parseInt(...)||0` masque les saisies invalides.
- **`ProduitShadcn.tsx:202`** : `parseInt` → `NaN` → `null` envoyé → backend traite comme "inchangé" → **succès silencieux sans effet**.
- **`PromotionForm.tsx:198`** : `toISOString()` hors du try → `Invalid Date` → formulaire bloqué `loading=true`.
- **Pas de contrôle `date_debut ≤ date_fin`** sur les filtres de dates (créances, journal caisse, maintenance, promotions `end ≥ start`).

---

## 8. ✅ Correctement protégé (ne pas toucher)

- `POST /caisse/` `create()` : montant `<0` rejeté, cap, sudo `can_cash_out`, check dépôt (mais PATCH non couvert).
- `transfer_to_shelf`, `bulk_transfer_to_shelf` : bornés serveur.
- `clients.py add_depot` : `montant>0`, type whitelist → bon exemple à généraliser.
- `users.py` : CRUD `IsAdminUser`, `is_superuser` re-vérifié, `verify_password` throttlé, `validate_password` via validateurs Django (seuil min à confirmer dans `AUTH_PASSWORD_VALIDATORS`).
- `fournisseurs.py` : `destroy` sudo `can_delete_fournisseur`, validateurs téléphone/email.
- `purge.py` : `IsAdminUser` + mot de passe superuser, whitelist de tables, filtre path traversal (`/` et `..`).
- `correct_lot` : format date strict, rejet 400 propre.
- Rapports (`finance.py`, `inventory.py`, `finance_stats.py`) : `strptime`/`fromisoformat` en try/except → 400.
- `LigneAvoirClient.quantity` : `MinValueValidator(1)` — seul champ borné.
- Pagination `omnisearch`, `centralized_configs`, `etat_inventaire` : bornées.
- `CommandeSerializer` : `validate_status`, `validate_delai_paiement_negocie_jours`.

---

## 9. Plan de remédiation priorisé

### P0 — Bloquer les falsifications financières (impact production immédiat)

1. **`read_only_fields` / serializers whitelistés** sur : `FactureSerializer` (`status`, `numero_facture`, `*_validated_by`, `montant_verse/rendu`, `part_client`, `points_fidelite_*`, `date`, `poste_caisse`), `ClientSerializer` (`solde_depot`, `points_fidelite`, `solde_factures`, `plafond`, `taux_couverture`), `ProduitSerializer` (`stock`, `stock_reserve`, `pmp`), `StockLotSerializer` (`quantity_*`), `CouponMonnaieSerializer` (`montant`, `status`, `utilise_par`), `InventaireSerializer`/`LigneAvoirSerializer` (`status`, `validated_by`).
2. **Désactiver `update`/`destroy`** (ou `http_method_names` restreint) sur : `CaisseViewSet`, `MouvementCaisseViewSet`, `FactureProduitViewSet`, `CouponMonnaieViewSet`, `PaiementFournisseurViewSet`, `LigneAvoirViewSet`.
3. **`cloture_mixin`** : supprimer `montant_theorique_frontend` (toujours recalculer serveur) ; schématiser `mouvements_manuels`/`billetage` via un `serializers.Serializer` dédié.
4. **`sales_actions`** : ignorer `remise_validated_by_id`/`prix_validated_by_id` fournis par le client pour le calcul des permissions (exiger la preuve sudo) ; ne pas faire confiance à `is_avoir_client`.
5. **Permissions** : `LoyaltySetting`, `ConfigurationOption`, `Promotion`, `TVA` → `IsAdminUser` (ou permission métier) en écriture.

### P1 — Bornes de valeurs (négatifs, NaN, hors plage)

6. **`MinValueValidator(0)` / `CheckConstraint`** sur `Caisse.montant`, `FactureProduit.quantity/selling_price/discount`, `StockLot.quantity_*`, `CommandeProduit.*`, `LigneAvoir.*`, `LigneInventaire.quantite_physique`, `PaiementFournisseur.montant`, `Promis.quantite`, `Promotion.value`, `RelationTransformation.ratio (>0)`, `Produit` prix/stocks, `Client.plafond/taux_couverture`, `TVA.taux` (0-100), `PharmacySettings` taux.
7. **Helper centralisé** `parse_decimal()/parse_positive_decimal()` : capture `(ValueError, TypeError, InvalidOperation)` + `is_finite()` + signe → remplace les ~44 casts manuels dispersés.
8. **Bornes métier manquantes** : `montant > 0` sur créances/versements/coupons/paiements ; `quantity >= 0` sur `adjust_stock`, `sortir_perimes`, `bulk_sync`, inventaire (bulk + CSV) ; rejeter `date_expiration < today` à la saisie ; `can_do_returns` requis pour quantités négatives en vente.
9. **Imports produits** : rejeter NaN (`is_nan()`), négatifs, TVA hors borne ; limite de taille fichier côté serveur.

### P2 — Robustesse 500 & UX

10. **Valider tous les query params** (`page`, `days`, dates, FK ids) → 400 au lieu de 500.
11. **`maxLength` frontend** aligné aux `max_length` modèles (lot 20, téléphone promis 20, motif 200, reference 100, client_name_override 100).
12. **Frontend** : `Number.isFinite` dans `validateSaleData`/`buildPaymentsList` ; `min`/`required` sur PaymentModal/fond de caisse/montant réel ; signaler au lieu de plafonner silencieusement (`_cap_montant`); `mode_paiement` → `choices` backend ; corriger la concaténation de strings `'2'+'3'='23'` dans la fusion de lots ; envoyer les valeurs normalisées dans `QuickCreateProductModal`.

---

## 10. Points à vérifier (non tranchés par l'audit)

- `AUTH_PASSWORD_VALIDATORS` dans `settings.py` : seuil réel du mot de passe (le message mentionne « 4 caractères » — faible).
- `REST_FRAMEWORK['DEFAULT_PERMISSION_CLASSES']` : couverture réelle de `bulk_delete` produits et `StockAdjustmentViewSet`.
- `sync_mobile` : endpoint cassé (`product_id` vs `produit`) — confirmer si l'app mobile est utilisée.
- `services/sale_validator.py`, `payment_service.py`, `views/comptabilite.py` : passe complémentaire sur le CRUD des écritures comptables (`debit/credit >= 0`, `clean()` non appelé par `save()`).
- Serializer `PosteVente` pour `fond_de_caisse` (négatif probablement persistable).
- `backend/api/services/` : `validate_invoice` sur `part_patient`/`part_assurance`.
