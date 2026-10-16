# Audit Journal — Mouvements non tracés dans `AuditLog`

> Fichier de suivi. Cocher `[x]` quand l'endpoint est tracé. Audit réalisé le 2026-10-16.
> Helper : `log_audit(user, action, model_name, object_id, description, details, request)`
> (`backend/api/audit_helpers.py`). Actions : `backend/api/models/audit.py`.
>
> Rappel : `validate_sudo_mode` n'écrit `SUDO_VAL` que si un **tiers** valide — un endpoint
> protégé par sudo sans log métier ne laisse aucune trace quand l'opérateur a lui-même
> la permission.

---

## 🔴 Critique — Ventes / Caisse

- [x] `POST /api/factures/{id}/marquer_payee/` — transition VALIDEE→PAYEE **sans log ni sudo** (`ventes/facture_mixins/sales_actions.py:522`)
- [x] `PUT/PATCH /api/factures/{id}/` — `perform_update` peut mener à PAYEE sans audit (`ventes/factures.py:324`)
- [x] `DELETE /api/creances/vider/` — vide les lignes d'une facture + recalcule totaux (`ventes/creances.py:876`)
- [x] `POST /api/facture-produits/` + `bulk_create` — lignes de facture (`ventes/facture_produits.py:30,34`)
- [x] `POST /api/factures/` — création de brouillon (`ventes/factures.py:320`)
- [x] `PosteVenteViewSet` `create/update/destroy` (`ventes/caisse_poste.py:117-153`)
- [x] `PosteVenteViewSet.activer` — ouvre session POS + fond de caisse (`caisse_poste.py:180`)
- [x] `PosteVenteViewSet.ouvrir` — ouverture caisse physique (`caisse_poste.py:229`)
- [x] `PosteVenteViewSet.fermer` — clôture session + `montant_total_encaisse` (`caisse_poste.py:283`)
- [x] `PosteVenteViewSet.forcer-fermeture` — fermeture forcée admin (`caisse_poste.py:486`)
- [x] `PosteCaisseViewSet` `create/update/destroy` — désactivation/suppression caisse (`caisse_poste.py:38-106`)

## 🔴 Critique — Stock

- [x] `StockLotViewSet` `create` — créer un lot ajoute du stock (`stocks/stock_lots.py:78`)
- [x] `StockLotViewSet` `update/partial_update` — n° lot + date d'expiration (`stock_lots.py`)
- [x] `StockLotViewSet` `destroy` — suppression de lot → impact stock
- [x] `POST /api/produits/bulk_transfer_to_shelf/` — réappro groupée, **partiel-sudo** (`produit_actions/stock.py:583`)
- [x] `PromisViewSet.create` + `bulk_create` — **décrémente le stock** + StockObligation (`commandes/promis.py:204`)
- [x] `PromisViewSet.{id}/delivrer` — résolution obligation stock (`promis.py:257`)
- [x] `PromisViewSet.{id}/annuler_et_reintegrer` — **réintègre le stock** (`promis.py:283`)
- [x] `PromisViewSet.bulk_delivrer` / `bulk_annuler` (`promis.py:336,368`)
- [x] `PromisViewSet.destroy` — soft-delete promis (`promis.py:250`)
- [x] `InventaireViewSet.create` — **`INV_CRE` existe mais jamais utilisé** (`stocks/inventaire_main.py:157`)
- [x] `InventaireViewSet.destroy` (`inventaire_main.py:160`)
- [x] `InventaireViewSet.pre_populate` — création lignes en masse (`inventaire_main.py:169`)
- [x] `InventaireViewSet.{id}/lignes` POST + `lignes/bulk` (peut créer des StockLot) + `import-csv` + `merge-duplicates`
- [x] `LigneInventaireViewSet` CRUD — `create` peut créer un StockLot (`inventaire_main.py:658+`)
- [x] `RelationTransformationViewSet` CRUD — règles de transformation (`stocks/transformations.py:34`)

## 🔴 Critique — Commandes / Prix

- [x] `CommandeProduitViewSet.create` — ⚠️ écrit `produit.selling_price` (`commandes/commande_produits.py:44`)
- [x] `CommandeProduitViewSet.bulk_sync` — sync `tva`/`selling_price`/`cost_price` produit (`commande_produits.py:82`)
- [x] `CommandeProduitViewSet` `update/destroy` + `correct_lot` (modifie StockLot même clôturé) (`commande_produits.py:361`)
- [x] `CommandeViewSet` `create/update/destroy` (`commandes/commandes.py`)
- [x] `CommandeViewSet.merge` — **supprime la commande source** (`commandes/bulk_actions_mixin.py:299`)
- [x] `CommandeViewSet.ajouter_produit_auto` + `ajouter_produits_bulk` (`bulk_actions_mixin.py:32,106`)
- [x] `OrderScheduleViewSet` CRUD + `{id}/trigger-now` — crée une vraie commande (`commandes/schedules.py:40`)
- [x] `AvoirViewSet` `create/update/destroy` (`commandes/avoirs.py:36-47`)
- [x] `LigneAvoirViewSet` `create/bulk_create/bulk_delete/destroy` + `update` (partiel : seule l'auto-validation est loguée) (`avoirs.py:406-463`)
- [x] `AvoirClientViewSet` `update/destroy` (`ventes/client_credit.py:46`)

## 🔴 Critique — Produit (fiche)

- [x] `ProduitViewSet.perform_update` — modif fiche **prix inclus** ; `PRICE_CHG` inutilisé (`views/produits.py:286`)
- [x] `ProduitViewSet.perform_destroy` — soft-delete unitaire (`views/produits.py:291`)
- [x] `ProduitViewSet.perform_create` ✅ fait 2026-10-16 (`views/produits.py:271`)

## 🔴 Critique — Financier / Admin / Sécurité

- [x] `PaiementFournisseurViewSet` `create/update/destroy` — **paiements fournisseurs sans trace** (`paiements.py:41-123`)
- [x] `EcritureComptableViewSet` CRUD (`comptabilite.py:534`)
- [x] `CompteComptableViewSet` / `JournalComptableViewSet` / `ExerciceComptableViewSet` CRUD (`comptabilite.py:43-92`)
- [x] `comptabilite.py` `initialiser_historique` + `creer_lettrage` (`comptabilite.py:357,473`)
- [x] `system_admin.py` : `restore` (restauration DB **sans mot de passe**), `pitr_restore`, `run_update`, `set_update_schedule` (cron systemd hôte), `fix_restart_policy`, `run_backup`, `base_backup`, `check_update`
- [x] `licence.py` — `LicenceStatusView.post` (install) + `delete` : sudo custom non loggé
- [x] `code_backup.py` `restore` — extrait un ZIP **sur le code source** (`code_backup.py:66`)
- [x] `purge.py` `purge_produits` — suppression produits en masse (`purge.py:850`)
- [x] `purge.py` `import_produits` + `run_update` (`purge.py:658,1049`)
- [x] `import_views.py` `ProductImportView.post` — import Excel/CSV masse (`import_views.py:30`)
- [x] `produit_import.py` `import_csv` — création/update + stock (`produit_import.py:21`)
- [x] `margin_views.py` `update_all_margins` / `update_selected_margins` — marges en masse (`margin_views.py:41,52`)
- [x] `clients.py` `add_depot` — **mouvement d'argent** (`clients.py:296`)
- [x] `clients.py` `merge` — fusion irréversible (`clients.py:501`)
- [x] `clients.py` `bulk_delete` (`clients.py:334`)
- [x] `ClientViewSet` `create/update/destroy` + `toggle_active` + `update_alerte` (`clients.py:111-144,270`)
- [x] `AyantDroitViewSet` CRUD (`clients.py:521`)
- [x] `users.py` `TeamViewSet` CRUD (admin)
- [x] `users.py` `logout` — révocation token non tracée
- [x] `users.py` login réussi — **`Action.LOGIN` défini mais jamais appelé** (seuls les échecs sont loggés)

## 🟠 Important

- [x] `FournisseurViewSet` `create/update` + `toggle_active` (`fournisseurs.py` — destroy/bulk_delete déjà tracés)
- [x] `coupons.py` `{id}/utiliser` — coupon consommé = remise encaissée (`coupons.py:86`)
- [x] `PromotionViewSet` CRUD (`promotions.py`)
- [x] `ObjectifViewSet` CRUD + `ConfigurationObjectifsViewSet.update` (`objectifs.py`, `configuration_objectifs.py`)
- [x] `CategorieViewSet` CRUD (`categories.py` — les APIView legacy sont auditées, pas le ViewSet)
- [x] `FormeViewSet` / `GroupeViewSet` / `SubstanceViewSet` CRUD (référentiels ; merges tracés)
- [x] `planning.py` — `ShiftConfigViewSet.create`, `ShiftScheduleViewSet` CRUD + generate/publish/send_to_operators, `LeaveRequestViewSet` CRUD + approve/reject
- [x] `dci_admin.py` — `upload_compo`, `auto_match`, `manual_link` (liaisons DCI)
- [x] `interactions.py` — `DrugInteractionViewSet` CRUD + `upload_csv`
- [x] `ProduitStatusMixin.toggle_active` (`produit_actions/status_ops.py:17`)
- [x] `ProduitStatsMixin.recalculate_rotation` — réécrit `rotation_moyenne` global (`produit_actions/stats.py:112`)
- [x] `RuptureFournisseurViewSet` CRUD + `resoudre` (`stocks/ruptures.py`)
- [x] `SignalementBesoinViewSet` CRUD + `integrer`/`ignorer`/`vider` (`stocks/besoins.py`)
- [x] `settings.py` — destroy de `ConfigurationOption` / `LoyaltySetting`

## 🟡 Mineur

- [x] `produits` `bulk_toggle_public` + `toggle_public` (`produit_actions/bulk_ops.py:129`, `status_ops.py:39`)
- [x] `commandes`/`inventaires` `lock`/`unlock` — **exclu volontairement** : verrous Redis éphémères (TTL 30 s) appelés à chaque ouverture de formulaire, aucune donnée modifiée → tracerait du bruit
- [x] `communication.py` — `SmsViewSet` CRUD+send, `SmsTemplateViewSet`, `InternalMessageViewSet`, `MessageTemplateViewSet`
- [x] `settings.py` — endpoints test WhatsApp/Telegram (`OTHER` sur envoi réussi, destinataire/chat en details)
- [x] `feedback.py` post (CREATE), `licence.py` dismiss (UPDATE), `qz.py` sign (OTHER — signature clé privée), `auth.py` verify_password (OTHER succès + échec)

## 📤 Exports non tracés (`Action.EXPORT` existe mais inutilisé ici)

- [x] `purge.py` `export` (POST → ZIP multi-tables) + `export_produits` (xlsx) (`purge.py`)
- [x] `code_backup.py` `backup` (GET → **ZIP du code source**) (`code_backup.py:31`)
- [x] `factures/{id}/imprimer_facture/` (PDF) (`facture_mixins/print_actions.py:26`)
- [x] `promis/{id}/imprimer_ticket/` + `imprimer_ticket_groupe` (PDF) (`commandes/promis.py:438,535`)
- [x] `creances/export_excel` + `{id}/imprimer_recu` (`ventes/creances.py:180,405`)
- [x] `avoirs-clients/exporter_excel` (`ventes/client_credit.py:292`)
- [x] `commandes/{id}/export` CSV/TXT (`commandes/export.py:24`)
- [x] `stock-adjustments/export_excel` (`stocks/adjustments.py:157`)
- [x] `ruptures/export_frequence_csv` (`stocks/ruptures.py:81`)
- [x] `inventaires/listing-excel` + `imprimer_ecarts` + `imprimer_etat` (`stocks/inventaire_main.py`)
- [x] `produits/export_csv` (`produit_actions/export.py:13`)
- [x] `categories.py` `imprimer_etat_stock` / `imprimer_sans_rayon` (PDF)
- [x] `etat_inventaire.py` `EtatInventairePDFView` (PDF/JSON)
- [x] `historique_ventes.py` `exporter_excel` (xlsx)
- [x] `rapports/inventory.py` `stocks_morts` / `balance_stock_excel` / `valeur_stock_pdf`
- [x] `purge.py` `download_rapport` (FileResponse)

> Exports déjà tracés (référence) : `rapports/finance.py` ×8, `rapports/sales.py`, `audit.py`,
> `communication.py` (Telegram), `backup_views.py`, `purge.py` backup.

---

## Constats transverses

- [x] `AuditLog.Action.LOGIN` et `INVENTORY_CREATE` définis mais jamais appelés *(INVENTORY_CREATE désormais utilisé ; LOGIN reste à faire — hors périmètre ventes/commandes/stocks/produit_actions)*
- [x] `avoirs.py` utilise `'VALIDATE'` / `'AUTO_VALIDATE'` hors choices (`avoirs.py:65,458`) — **fix** : choices `VALIDATE`/`AUTO_VAL` ajoutés ; `'AUTO_VALIDATE'` (13 car.) dépassait `max_length=10` → ces lignes échouaient silencieusement en base
- [x] Pattern sudo : l'action métier n'est pas décrite quand un tiers valide — **résolu par convention** : le log métier est désormais toujours écrit en plus du `SUDO_VAL`

## Plan de mise en œuvre proposé

1. **Mixin `AuditedModelViewSet`** : `perform_create/update/destroy` → `log_audit`
   automatique (CREATE/UPDATE/DELETE, nom modèle + pk + repr courte). Couvre ~60 %
   des lacunes (CRUD référentiels : clients, fournisseurs, catégories, formes,
   groupes, substances, promotions, objectifs, paiements fournisseurs, compta…).
2. **Logs métier ciblés** sur les 🔴 non couverts par le mixin : `marquer_payee`,
   promis (create/delivrer/annuler/bulk), `StockLotViewSet`, postes de caisse,
   `vider` créances, `bulk_transfer_to_shelf`, lignes commande (prix !).
3. **`Action.LOGIN`** sur connexion réussie + **`INVENTORY_CREATE`** sur création
   d'inventaire.
4. **`Action.EXPORT`** sur les ~18 exports listés.
5. **`PRICE_CHG`** dans `ProduitViewSet.perform_update` quand le prix change.
