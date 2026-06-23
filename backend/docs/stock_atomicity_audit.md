# Audit : Fonctions modifiant le stock — Atomicité & Traçabilité

> Généré le 2026-06-20.  
> Ce document répertorie toutes les fonctions backend qui impactent les quantités en stock (`Produit.stock`, `Produit.stock_reserve`, `StockLot.quantity_remaining`, `StockLot.quantity_reserved`).  
> Pour chaque fonction, on indique : **atomicité** (transaction/verrou), **traçabilité** (`MouvementStock`, `StockAdjustment`, `AuditLog`), et **points de vigilance**.

---

## 1. Ventes / Facturation

### `SalesService.finalize_sale(user, data, ...)`
- **Fichier** : `api/services/sales_service.py:25`
- **Atomic** : `transaction.atomic` + `SalesService.validate_invoice` (également `transaction.atomic`).
- **Verrouillage** : Optimistic locking via `version` sur `Produit` et `StockLot` (récupération sans `select_for_update`, vérification avant écriture dans `validate_invoice`).
- **Traçabilité** : `MouvementStock` (SORTIE/RETOUR), `FactureProduitAllocation` (FIFO/FEFO), `AuditLog` indirect via facture.
- **Vigilance** : `validate_invoice` est appelée dans la transaction de `finalize_sale`, donc une double transaction est imbriquée. Django gère correctement les transactions imbriquées (savepoints), mais les deux méthodes portent `@transaction.atomic`.

### `SalesService.validate_invoice(facture, validation_user, data, ...)`
- **Fichier** : `api/services/sales_service.py:254`
- **Atomic** : `transaction.atomic`.
- **Verrouillage** : Optimistic locking (versions `Produit`, `StockLot` initiales sauvegardées, non vérifiées explicitement avant `bulk_update` — les lots sont mis à jour sans re-vérification de version, seuls les stocks sont recalculés via sous-requête).
- **Traçabilité** : `MouvementStock` (SORTIE/RETOUR), `FactureProduitAllocation`.
- **Vigilance** : `stock_apres` est lu après `bulk_update` via `Produit.objects.filter(id__in=product_ids)`, donc cohérent dans la transaction.

### `SalesService.cancel_invoice(facture, user, motif)`
- **Fichier** : `api/services/sales_service.py:508`
- **Atomic** : `transaction.atomic`.
- **Verrouillage** : Aucun (`F()` queries sur `StockLot` et `Produit`).
- **Traçabilité** : `MouvementStock` (RETOUR), réintégration du stock.
- **Vigilance** : Utilise `F('stock') + item.quantity` pour les produits, mais `F('quantity_remaining') + alloc.quantity` pour les lots. Cohérent mais sans lot de l'opération initiale si modification intermédiaire.

### `SalesService.modify_sale(facture, user, data)`
- **Fichier** : `api/services/sales_service.py:567`
- **Atomic** : `transaction.atomic`.
- **Verrouillage** : Aucun verrou pessimiste. Restaure les allocations, supprime, puis réalloue en FIFO. Risque de course si la facture est modifiée simultanément.
- **Traçabilité** : Aucun `MouvementStock` ni `AuditLog` explicite créé ici. Le stock change sans trace dans `MouvementStock` (seule la facture est modifiée). **Point de vigilance fort**.
- **Vigilance** : Possible incohérence si échec entre la suppression des anciennes lignes et la création des nouvelles, mais transaction atomique globale. Manque de traçabilité.

### `FactureViewSet.finaliser(request)`
- **Fichier** : `api/views/ventes/factures.py:223`
- **Atomic** : `transaction.atomic` + `@idempotent_action`.
- **Verrouillage** : Dépend de `SalesService` (optimistic locking).
- **Traçabilité** : Via `SalesService`.
- **Vigilance** : Même point que `SalesService.finalize_sale`.

---

## 2. Clôture de commandes (entrées de stock)

### `CommandeViewSet.cloturer(request)`
- **Fichier** : `api/views/commandes/commandes.py:410`
- **Atomic** : `transaction.atomic` + retry sur `ConcurrentModificationError`.
- **Verrouillage** : Optimistic locking (sauvegarde `initial_versions`, vérification si `expected_versions` présent, incrémentation `version` avant `bulk_update`).
- **Traçabilité** : `MouvementStock` (ENTREE), `AuditLog` (UPDATE), `StockLot` créés.
- **Vigilance** : `stock_apres_reception` capturé en mémoire avant `bulk_update` des produits. Possible lecture fantôme si le stock est modifié entre la Phase 1 et la Phase 2, mais optimistic locking avec retry atténue le risque.

---

## 3. Ajustements manuels de stock

### `ProduitStockMixin.adjust_stock(request, pk)`
- **Fichier** : `api/views/produit_actions/stock.py:142`
- **Atomic** : `transaction.atomic`.
- **Verrouillage** : Aucun (`get_object` puis `save` direct).
- **Traçabilité** : `StockAdjustment`, `MouvementStock` (AJUSTEMENT ou REAPPRO_INTERSTOCK), `AuditLog` (STOCK_ADJUST).
- **Vigilance** : Pas de `select_for_update` ni de vérification de version. Si deux ajustements simultanés sur le même produit, le dernier `save` écrase le précédent. **Risque de perte de mise à jour**.

### `ProduitStockMixin.transfer_to_shelf(request, pk)`
- **Fichier** : `api/views/produit_actions/stock.py:239`
- **Atomic** : `transaction.atomic`.
- **Verrouillage** : Aucun verrou pessimiste.
- **Traçabilité** : 2 `MouvementStock` (REAPPRO_INTERSTOCK), `AuditLog` (STOCK_ADJUST).
- **Vigilance** : Mise à jour incrémentale `produit.stock += quantity` / `produit.stock_reserve -= quantity` sans `F()` ni verrou. **Risque de perte de mise à jour** si deux transferts simultanés.

### `ProduitStockMixin.bulk_transfer_to_shelf(request)`
- **Fichier** : `api/views/produit_actions/stock.py:311`
- **Atomic** : `transaction.atomic` + `Produit.objects.select_for_update()` sur chaque produit.
- **Verrouillage** : `select_for_update()` — correct.
- **Traçabilité** : `StockAdjustment` (par lot), `MouvementStock` (REAPPRO_INTERSTOCK), `ReapproSession`.
- **Vigilance** : `StockLot` modifiés sans `select_for_update` (les lots ne sont pas verrouillés). Le verrou sur `Produit` protège le stock global mais pas les lots. **Risque potentiel** si un autre processus modifie les lots en parallèle.

---

## 4. Lots de stock

### `StockLotViewSet.sortir_perimes(request, pk)`
- **Fichier** : `api/views/stocks/stock_lots.py:58`
- **Atomic** : `transaction.atomic`.
- **Verrouillage** : Aucun (`get_object` puis `lot.save()`).
- **Traçabilité** : `StockAdjustment`, `MouvementStock` (AVOIR), `AuditLog`.
- **Vigilance** : `produit.stock = F('stock') - quantity_to_remove` pour les produits non gérés par lots. `calculate_stock_from_lots()` pour les produits à lots. Pas de `select_for_update`. **Risque de perte de mise à jour** sur `Produit.stock` si concurrent.

### `StockLotViewSet.bulk_sortir_perimes(request)`
- **Fichier** : `api/views/stocks/stock_lots.py:139`
- **Atomic** : `transaction.atomic`.
- **Verrouillage** : Aucun (`filter` puis boucle `save`).
- **Traçabilité** : `StockAdjustment`, `MouvementStock` (AVOIR), `AuditLog`.
- **Vigilance** : Même point que `sortir_perimes`, multiplié par le nombre de lots. `produit.refresh_from_db()` appelé, mais la mise à jour du produit reste sans verrou.

---

## 5. Inventaires

### `validate_inventaire(inventaire, request)`
- **Fichier** : `api/views/stocks/inventaire/validation.py:22`
- **Atomic** : Appelé dans `InventaireViewSet.validate()` (transaction.atomic), mais pas de transaction interne. Les écritures sont regroupées en batch.
- **Verrouillage** : Optimistic locking (versions `Produit` et `StockLot` initiales, vérification avant `bulk_update` des produits).
- **Traçabilité** : `StockAdjustment`, `MouvementStock` (AJUSTEMENT), `AuditLog` (INVENTORY_VALIDATE).
- **Vigilance** : `StockLot.objects.get_or_create()` sans verrou dans la boucle. Si `get_or_create` crée un nouveau lot, il pourrait être modifié ailleurs avant la fin de la transaction. Les `bulk_update` de lots n'ont pas de vérification de version explicite (les lots sont incrémentés mais non revérifiés).

### `InventaireViewSet.validate(request, pk)`
- **Fichier** : `api/views/stocks/inventaire_main.py:207`
- **Atomic** : `transaction.atomic`.
- **Verrouillage** : Via `validate_inventaire` (optimistic locking).
- **Traçabilité** : Via `validate_inventaire`.

### `InventaireViewSet.pre_populate(request, pk)` / `lignes(request, pk)` / `merge(request, pk)` / etc.
- **Fichier** : `api/views/stocks/inventaire_main.py`
- **Atomic** : Toutes décorées `@transaction.atomic`.
- **Verrouillage** : Aucun verrouillage des stocks. Ces actions ne modifient pas directement le stock (seulement les lignes d'inventaire), sauf création de lots vides.
- **Traçabilité** : Aucun mouvement de stock — correct car ce sont des lignes de brouillon.

---

## 6. Transformations

### `RelationTransformationViewSet.transformer(request, pk)`
- **Fichier** : `api/views/stocks/transformations.py:30`
- **Atomic** : `with transaction.atomic`.
- **Verrouillage** : `Produit.objects.select_for_update().filter(...).order_by('id')` pour éviter les deadlocks. `StockLot` source filtrés avec `select_for_update()`.
- **Traçabilité** : `StockAdjustment` (source + destination), `MouvementStock` (TRANSFORMATION_SORTIE/TRANSFORMATION_ENTREE), `HistoriqueTransformation`, `AuditLog`.
- **Vigilance** : `source.stock -= quantite` puis `source.save()` sans `F()` — mais `select_for_update` protège. Destination `stock += quantite` sans `F()` également. Vérification préalable `source.stock < quantite` — correct.

---

## 7. Avoirs fournisseurs

### `AvoirViewSet.decharger_stock(request, pk)`
- **Fichier** : `api/views/commandes/avoirs.py:109`
- **Atomic** : `with transaction.atomic`.
- **Verrouillage** : Aucun (`get_object`, `for ligne in avoir.produits.all()`).
- **Traçabilité** : `MouvementStock` (AVOIR), `AuditLog`.
- **Vigilance** : `produit.stock -= ligne.quantity` puis `save()` sans verrou. Si `use_lot_management`, `calculate_stock_from_lots()` recalcule. **Risque de perte de mise à jour** si concurrent.

---

## 8. Promis (réservations clients)

### `PromisViewSet.annuler_et_reintegrer(request, pk)` / `bulk_annuler(request)`
- **Fichier** : `api/views/commandes/promis.py:70`, `:143`
- **Atomic** : `transaction.atomic`.
- **Verrouillage** : Aucun.
- **Traçabilité** : `MouvementStock` (RETOUR).
- **Vigilance** : `produit.stock += promis.quantite` puis `save()` sans verrou. **Risque de perte de mise à jour**. De plus, la réintégration n'est pas faite pour les produits en gestion par lots (`if not produit.use_lot_management`), ce qui est logique car le stock est supposé être réintégré au moment de la vente — mais le `stock_apres` du mouvement est `produit.stock` (stock rayon) et non `total_stock`. **Cohérence à vérifier**.

---

## 9. Signaux Django

### `sync_product_stock_on_lot_save(sender, instance, ...)`
- **Fichier** : `api/models/stock.py:340`
- **Atomic** : Exécuté dans la transaction courante (pas de transaction propre).
- **Verrouillage** : Aucun (`Produit.objects.filter(pk=...).update(...)`).
- **Traçabilité** : Aucun — c'est une synchronisation automatique.
- **Vigilance** : Peut créer des conditions de course sur `Produit.stock` si un autre processus modifie le stock en parallèle. `update()` avec `Sum` est plus sûr qu'une lecture-écriture, mais sans verrou.

### `sync_product_stock_on_lot_delete(sender, instance, ...)`
- **Fichier** : `api/models/stock.py:366`
- **Mêmes remarques** que ci-dessus.

---

## 10. Synthèse des risques

| Risque | Fonctions concernées | Sévérité |
|--------|----------------------|----------|
| Mise à jour non atomique (lecture-écriture sans verrou) | `adjust_stock`, `transfer_to_shelf`, `sortir_perimes`, `bulk_sortir_perimes`, `decharger_stock`, `annuler_et_reintegrer`, `bulk_annuler` | **Élevée** — **corrigé le 2026-06-20** |
| Manque de traçabilité `MouvementStock` | `modify_sale` | **Élevée** — **corrigé le 2026-06-20** |
| Verrouillage des lots manquant dans `bulk_transfer_to_shelf` | `bulk_transfer_to_shelf` | Moyenne — **corrigé le 2026-06-20** |
| Optimistic locking incomplet (lots sans re-vérification) | `validate_inventaire`, `validate_invoice` | Moyenne |
| Signaux de synchronisation sans verrou | `sync_product_stock_on_lot_save/delete` | Moyenne |
| Transaction imbriquée `finalize_sale` → `validate_invoice` | `finalize_sale`, `validate_invoice` | Faible (Django gère) |

---

## 11. Corrections appliquées le 2026-06-20

### `SalesService.modify_sale`
- **Fichier** : `api/services/sales_service.py`
- **Changement** : Ajout de la traçabilité `MouvementStock` (RETOUR/SORTIE selon le delta) et `AuditLog` (STOCK_ADJUST) pour chaque produit dont la quantité a changé lors de la modification.
- **Atomicité** : Pas de changement de verrouillage (la transaction atomique existante reste). La traçabilité manquante est maintenant couverte.

### `ProduitStockMixin.adjust_stock`
- **Fichier** : `api/views/produit_actions/stock.py`
- **Changement** : `Produit.objects.select_for_update().get(...)` et `StockLot.objects.select_for_update().get(...)` si un lot est fourni.
- **Atomicité** : Verrou pessimiste sur le produit et le lot, empêche les pertes de mise à jour concurrentes.

### `ProduitStockMixin.transfer_to_shelf`
- **Fichier** : `api/views/produit_actions/stock.py`
- **Changement** : `Produit.objects.select_for_update()` et `produit.stock_lots.filter(...).select_for_update()` sur les lots de réserve. Ajout d'une vérification `remaining_to_transfer > 0` en fin de boucle.
- **Atomicité** : Verrou pessimiste sur le produit et les lots de réserve.

### `ProduitStockMixin.bulk_transfer_to_shelf`
- **Fichier** : `api/views/produit_actions/stock.py`
- **Changement** : `select_for_update()` sur les lots de réserve. Gestion du transfert partiel (`quantity -= remaining_to_transfer`).
- **Atomicité** : Verrou pessimiste sur les lots (le produit était déjà verrouillé).

### `StockLotViewSet.sortir_perimes`
- **Fichier** : `api/views/stocks/stock_lots.py`
- **Changement** : `StockLot.objects.select_for_update()` puis `Produit.objects.select_for_update()` si le lot est rattaché à un produit.
- **Atomicité** : Verrou pessimiste sur le lot et le produit.

### `StockLotViewSet.bulk_sortir_perimes`
- **Fichier** : `api/views/stocks/stock_lots.py`
- **Changement** : `select_for_update()` sur les lots, puis verrouillage des produits par ordre croissant d'ID pour éviter les deadlocks.
- **Atomicité** : Verrou pessimiste sur tous les lots et produits concernés.

### `AvoirViewSet.decharger_stock`
- **Fichier** : `api/views/commandes/avoirs.py`
- **Changement** : Verrouillage de l'avoir, des produits et des lots par ordre d'ID. Utilisation de `F('stock')` pour la décrémentation du stock produit.
- **Atomicité** : Verrou pessimiste sur avoir, produits et lots.

### `PromisViewSet.annuler_et_reintegrer` / `bulk_annuler`
- **Fichier** : `api/views/commandes/promis.py`
- **Changement** : `select_for_update()` sur le(s) promis et les produits (verrou par ordre d'ID dans `bulk_annuler`). `stock_apres` du mouvement utilise `produit.total_stock`.
- **Atomicité** : Verrou pessimiste sur les promis et produits.
- **Point de vigilance restant** : La réintégration de stock n'est toujours pas effectuée pour les produits en gestion par lots (`use_lot_management=True`). C'est une décision métier existante (les signaux synchronisent le stock global via les lots, mais aucun lot n'est créé/modifié lors d'une annulation de promis).

---

## 12. Recommandations restantes

1. ~~**Uniformiser le verrouillage pessimiste** sur toutes les fonctions de mise à jour de stock : utiliser `select_for_update()` sur `Produit` et `StockLot` concernés, ou renforcer l'optimistic locking.~~ — **Appliqué** pour les fonctions à risque critique.
2. ~~**Ajouter un mouvement de stock** dans `modify_sale` pour tracer la modification d'une vente validée.~~ — **Appliqué**.
3. ~~**Utiliser `F()` expressions** pour les incréments/décréments de stock quand `select_for_update` n'est pas utilisé (au minimum comme filet de sécurité).~~ — **Appliqué partiellement**.
4. ~~**Verrouiller les `StockLot` dans `bulk_transfer_to_shelf`** et `decharger_stock`.~~ — **Appliqué**.
5. **Documenter dans le code** pourquoi certaines fonctions utilisent l'optimistic locking vs pessimiste (ex: `validate_inventaire` vs `bulk_transfer_to_shelf`).
6. **Ajouter des tests de concurrence** (threading/parallélisme) sur les fonctions à risque critique.
7. **Vérifier la cohérence des Promis pour les produits en gestion par lots** : aujourd'hui, `annuler_et_reintegrer` et `bulk_annuler` ne réintègrent pas de stock lorsque `use_lot_management=True`.
8. **Renforcer l'optimistic locking** dans `validate_inventaire` et `validate_invoice` pour les lots (vérification explicite des versions avant `bulk_update`).
9. **Sécuriser les signaux** `sync_product_stock_on_lot_save/delete` si le projet rencontre des conditions de course réelles (ex: avec `select_for_update` ou recours à une vue matérialisée/recalcul asynchrone).

---

*Fin du rapport.*
