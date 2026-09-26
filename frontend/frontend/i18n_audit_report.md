# Audit i18n — Textes en dur (scan complet du 2026-09-25)

Scan réalisé par 5 sous-agents sur l'ensemble de `src/` (hors tests).
Convention : tout texte visible utilisateur passe par `useTranslation`/`t()`/`i18n.t()`.

**Verdict global : ~470 trouvailles** réparties sur ~70 fichiers.
Ne sont PAS comptés : les `t('key', { defaultValue: 'Texte FR' })` (le texte passe par `t()`),
les fichiers `__tests__/`, les strings techniques, les noms de marque (Zenith/OM/MoMo),
les acronymes métier borderline (CIP, UG, FEFO), les touches clavier (Entrée, Shift+Entrée).

---

## 🔴 Priorité 1 — Fichiers sans `useTranslation` ou gros clusters

| Fichier | Trouvailles | Nature |
|---------|-------------|--------|
| `dashboard/reports/StockValuationReport.tsx` | 23 | `const { t: _t }` déclaré jamais utilisé — tout le rapport en dur |
| `stock/StockHealthDashboard.tsx` | 18 | Tooltips/interprétations du score de santé |
| `LotSelectionModal.tsx` | 15 | Aucun `useTranslation` — tout le modal (en-têtes, FEFO, boutons) |
| `InteractionsManager.tsx` | ~18 | Modal Add/Edit entier + `GRAVITY_LABELS` dupliquant `products:interactions.gravity_*` |
| `HelpTraining.tsx` | ~13 | Section « Astuces » entière |
| `ImportDCIPage.tsx` | ~12 | Tabs, table, toasts, pagination |
| `CatalogDCI.tsx` + `CatalogDCIAddModal.tsx` | ~13 | Titres, badges, compteurs |
| `printing/PrintPage.tsx` | 9 | Aucun `useTranslation` (chargement, erreurs, boutons) |
| `avoirs/modals/AvoirsLotModal.tsx` | 10 | Aucun `useTranslation` |
| `fournisseurs/FournisseurFormModals.tsx` | 7 | `t` dispo via hook mais non utilisé dans ce bloc |
| `RouteErrorBoundary.tsx` | 7 | Écran d'erreur entier en français |
| `ErrorBoundary.tsx` | 6 | Idem |
| `creances/modals/BulkPaiementModal.tsx` | 6 | Labels + placeholder |
| `clients/BulkDeleteWarningModal.tsx` + `ClientDeleteWarningModal.tsx` | 9 | Textes d'avertissement |
| `compta/Comptabilite.tsx` | 7 | Catégories OHADA (`categoriesOHADA`) |
| `App.tsx` | 9 | Écran de démarrage/erreur backend |
| `FinanceFournisseurModal.tsx` | 5 | En-têtes répartition |
| `stock/ReapproHistory.tsx` | 10 | En-têtes tableaux + title |
| `Maintenance.tsx` | 3 | Séparateurs IMPORT/EXPORT/PURGE |
| `SimplePrintLabelsModal.tsx` | 5 | Section code-barres |
| `ProduitFormModal.tsx` | 4 | Titres de sections |
| `ModuleFinancier.tsx` | 4 | `>CA<` + titles |
| `LoginShadcn.tsx` | 3 | confirm suppression licence, toast rate-limit, greeting |
| `Sidebar.tsx` | 2 | `Administration Système` + title Déplier/Replier |
| `Layout.tsx` | 2 | `Mode point de vente`, `Fermer le point` |
| `ConfirmDialog.tsx` | 2 | Défauts `Confirmer`/`Annuler` |

## 🔴 Priorité 1 — Problèmes systémiques (hors composants)

| Fichier | Problème |
|---------|----------|
| `hooks/reports/utils.ts` | `COLUMN_LABELS` (~66 libellés) retourné **avant** tout appel `t()` → en-têtes de rapports toujours en français même en EN |
| `hooks/reports/queries.ts` | Clés de traduction manquantes fr+en (`recap_valeur_stock`, `ventes_operateur_lots`, `rapport_fiscal_mensuel`, `params.poste_caisse_id`, `params.fournisseur_id`, `params.valorisation`, options `group_by`/`sort_by`/`fields`) → les `defaultValue` FR s'affichent en permanence |
| `utils/print/promisPdfDraft.ts` | Ticket promis client 100 % en dur (aucun mécanisme `docT`/`documentLang`) |
| `utils/validation.ts` + `schemas/clientSchema.ts`, `productSchema.ts`, `stockSchema.ts` | ~18 messages d'erreur formulaire/Zod en dur |
| `utils/errorHandling.ts` | `extractErrorMessage()` : 6 messages génériques en dur |
| `utils/whatsapp.ts` | Rapports WhatsApp générés en français |
| `utils/excelExport.ts` | En-tête pharmacie + `Édité le` en dur |
| `hooks/useTVA.ts` | 5 messages d'erreur CRUD |
| `hooks/useSecureCartOperations.ts` | 5 confirmations modale sudo |
| `hooks/useFacturationState.ts` / `useFacturationActions.ts` | Titres modale sudo, confirm, prompts (partiellement fallback `||`) |
| `hooks/useAvoirsData.ts` | confirm, toasts, titres modale déchargement |
| `hooks/useManagerDashboard.ts` | En-têtes Excel « Stocks Morts » en dur |
| `hooks/usePrint.ts` | `title = 'Impression'` |
| `useCaissePayment.ts`, `useCreanceActions.ts`, `useInvoiceActions.tsx`, `useSaleCompletion.ts` | Fallbacks `'Client'`/`'Client de passage'` injectés dans tickets/PDF |
| `context/PharmacySettingsContext.tsx` | `setError` en dur |
| `routes.tsx` | Message de timeout du lazy-loading |
| `hooks/useFournisseurs.ts`, `useCommandes.ts`, `useProduitSubstituts.ts`, `useStockLots.ts`, `useInvoiceSettings.ts`, `useCart.ts`, `useCommandeActions.ts`, `useLotDisplay.ts`, `useDevisLoader.ts` | Messages isolés (throw, status optimiste `Clôturée`, fallbacks `Produit #`, `sans date`) |

## 🟡 Priorité 2 — Textes dispersés (1–3 par fichier)

- `sales/SalesTable.tsx` L56 : `Générer un avoir`
- `sales/modals/ProductDetailsModal.tsx` : toasts rappel + `Lot:` + `À payer client`
- `products/modals/StockAdjustmentModal.tsx` : `Réserve`, `Tous les lots (global)`
- `omnisearch/OmnisearchResults.tsx` + `OmnisearchPreview.tsx` : `Recherche en cours…`, `Client de passage`, hint Entrée
- `settings/PosteVenteSettingsSection.tsx` : 2 `confirm()` (`Supprimer ce point de vente ?`)
- `caisse/*` : `Réf:`, `PIÈCE`, `Page x/y`, title PaymentModal, `Tel:` CouponDetailsModal
- `Commandes/*` : `Shift+Entrée`, `UG`, `MM/YY`, note `Reconditionnement auto…`
- `stock/ReapproRayon.tsx` (`unités`, `Réserve`), `stock/Cadencier.tsx`, `Perimes.tsx`, `Transformations.tsx`, `Vitrine.tsx`, `StockAnalysis.tsx`, `ClassementVendeurs.tsx`, `GuideFinancier.tsx` (`Documentation`), `PointageReleveModal.tsx` (`Quinzaines`/`Décades`), `EcheancierFournisseursModal.tsx`, `ClockSyncAlert.tsx` (`secondes`/`minutes`/`heures`), `divers/GestionDivers.tsx` (noms d'onglets Excel), `common/CategoryManager.tsx` (confirm)

## 🟡 Priorité 2 — Aria-labels homogènes (lot facile)

`Sélectionner …`, `Quantité lot …`, `Sélection` (sr-only), `Close` (EN dans `ui/Dialog.tsx` L49 et `shadcn/dialog.tsx` L69), `alt="Scan preview"`, `alt="Logo"`.
~15 occurrences dans : `avoirs/AvoirsTable`, `promis/PromisTable`, `stock/*` (×4), `inventaire/*` (×3), `Commandes/CommandeList`, `Perimes`, `Transformations`, `Vitrine`, `ui/Dialog`, `shadcn/dialog`, `facturation/PrescriptionScannerModal`, `printing/*` (×3).

## ⚪ Particulier — Textes enregistrés en base (pas de l'UI)

Traduire n'aura pas d'effet rétroactif sur les données déjà écrites :
- `useFacturationActions.ts` L171 : `notes: "Généré via Bon de Livraison"`
- `useFacturationState.ts` L181 : `motif: 'Rappel pour modification (depuis Facturation)'`
- `useAvoirsData.ts` L236 : `Retour suite à commande #…`
- `Commandes/ReconditionnementModal.tsx` L118 : `Reconditionnement auto après clôture…`
- `useCommandeActions.ts` L191 : `status_display: 'Clôturée'` (optimiste)

## ⚪ Bugs i18n adjacents (pas du texte en dur)

- `LicenceScreen.tsx` L22 : `useState(t('loading'))` figé au mount → non réactif au changement de langue
- `LicenceScreen.tsx` L213 : `toLocaleDateString()` sans locale explicite
- `productSchema.ts`/`clientSchema.ts` : doublons de messages Zod (2 schémas par fichier)

## ✅ Faux positifs écartés

- `users/menuHierarchyFallback.ts` (61 hits), `users/usersMeta.ts` (28) : contiennent des `labelKey`/`descKey` = des clés, pas du texte
- `types/labels.ts` (33 hits) : constantes `_AVAILABLE_FIELDS`/`_STANDARD_LABEL_SIZES` non importées (code mort)
- `types/catalog.ts` `STOCK_ADJUSTMENT_REASONS` : fallback via `t() || reason.label`, clés présentes
- Tous les `defaultValue`/`|| 'texte'` après `t()` : passent par `t()` (affichés seulement si la clé manque)
- Noms de marque : `Zenith`, `Zenith OS`, `ZENITH POS SYSTEM`, `PharmaGest`, `Orange Money`, `MTN MoMo`
