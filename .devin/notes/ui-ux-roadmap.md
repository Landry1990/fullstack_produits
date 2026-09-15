# Roadmap UI/UX — Fullstack Produits

Fichier de suivi des améliorations UI/UX identifiées.

**Légende** :

- `[ ]` En attente
- `[~]` En cours
- `[x]` Fait

---

## 2026-09-11 — Rangement Intelligent (SmartOrganizerModal)

| # | Amélioration | Statut | Notes |
|---|---|---|---|
| 1 | Autocomplétion sur les champs `De (Inclus)`, `À` et `Contient` | `[x]` | Suggérer les noms produits existants |
| 2 | Indicateur visuel pendant le debounce/filtrage | `[x]` | "Recherche en cours…" ou spinner discret |
| 3 | Virtualisation de la liste d'aperçu (`react-window`) | `[x]` | Éviter le ralentissement DOM sur les grandes plages |
| 4 | Boutons "effacer" (✕) dans chaque champ + raccourcis clavier | `[x]` | UX rapide, accessibilité |
| 5 | Confirmation explicite avant "Appliquer" | `[x]` | Afficher compteur + nom catégorie |
| 6 | Actions de masse sur l'aperçu : tout sélectionner / tout exclure / inverser | `[x]` | Gain de temps |
| 7 | États vides plus informatifs (exemples, distinction "pas de filtre" vs "aucun résultat") | `[x]` | Moins d'ambiguïté |
| 8 | Case à cocher `Respecter la casse` en `Switch` shadcn + focus ring | `[x]` | Uniformité visuelle |
| 9 | Skeleton de chargement à l'ouverture du modal | `[x]` | Plus pro qu'un spinner |
| 10 | Labels/accessibilité : `htmlFor`, `aria`, navigation clavier | `[x]` | A11y |

## 2026-09-11 — Application en général

| # | Amélioration | Statut | Notes |
|---|---|---|---|
| A | Migration complète vers shadcn/ui | `[x]` | Dernières classes DaisyUI retirées des `className` (ClientFormModal, FournisseurFormModals, PointageReleveModal, FacturationNotifications, ObjectivesSettings, InteractionsManager) ; dépendance `daisyui` supprimée de `package.json` (2026-09-11) |
| B | Skeletons cohérents sur tous les écrans de liste | `[x]` | `Skeleton`/`SkeletonTable` appliqués sur les écrans de liste principaux (ventes, caisse, produits, stock, inventaire, commandes, fournisseurs, avoirs, créances, dashboard, admin) |
| C | Modales de confirmation sur les actions destructrices | `[x]` | `useConfirm`/`ConfirmDialog` est désormais le standard : tous les `window.confirm` ont été supprimés (~22 sites convertis) |
| D | Indicateurs d'état vides standardisés | `[x]` | Composant `EmptyState` généralisé sur les écrans principaux (listes, tables, modales, panneaux) |
| E | Mode sombre (dark mode) | `[x]` | `theme-midnight` déjà en place (toggle UserHeader/FacturationHeader, localStorage, `dark:` variant). Couverture complétée dans `index.css` : pastels sky/cyan/teal/violet/fuchsia/pink/lime, tons 200/300, bordures + textes colorés, dégradés `from/to-*-50`, hovers (2026-09-12) |
| F | Responsive mobile/tablette des écrans critiques | `[x]` | Passe quick-wins sur toute l'app (~55 fichiers, CSS only) : grids `grid-cols-N` → mobile-first, `overflow-x-auto` sur tables natives, `flex-wrap` sur toolbars, `w-[95vw]`/`max-w-full` sur largeurs fixes. Sidebar déjà off-canvas mobile (2026-09-12) |
| G | Feedback de sauvegarde / erreur uniformisé (toast) | `[x]` | `gooeyToast` est le standard unique ; tous les `alert()` restants ont été convertis |
| H | Accessibilité générale (a11y) | `[~]` | Passe partielle 2026-09-13 : `role="dialog"`/`aria-modal` sur ~20 modales custom + `PremiumModal` partagé, ESC sur modales manquantes, `role="button"`/`checkbox` + clavier sur divs cliquables, `aria-label` boutons icône, `:focus-visible` global. Reste : focus trap, contrastes, `htmlFor` résiduels, landmark `<main>` — voir section ci-dessous |

---

## 2026-09-12 — Item H : Accessibilité — plan de reprise

Passe a11y interrompue (sous-agents tués par erreur de connexion). Pour reprendre :

1. **Vérifier l'état** : `cd frontend/frontend && npx tsc --noEmit` — des éditions partielles peuvent exister.
2. **Déjà fait** : `:focus-visible` global ajouté dans `src/index.css` (outline primary 2px).
3. **Périmètre restant** (à relancer en sous-agents sur les mêmes zones disjointes que la passe responsive) :
   - **Zone 1** : `sales/`, `caisse/`, `facturation/`, `clients/`, `creances/`, `avoirs*/`, `loyalty/`, `promis/` + Ventes, CaisseCentralisee, Clients, Creances, Avoirs, Facturation, HistoriqueVentes, HistoriqueClotures, ClassementVendeurs, JournalCaisse, RecapClient, Promis, LoyaltyConfigModal
   - **Zone 2** : `products/`, `stock/`, `inventaire/`, `Commandes/`, `fournisseurs/`, `adjustments/` + ProduitShadcn, ProduitFormModal, Perimes, Transformations, Analyse*, HistoriqueAchats, ImportDCIPage, CatalogDCI*, LotSelectionModal, SubstitutionModal, SimplePrintLabelsModal, Commandes, Fournisseurs, StatistiquesFournisseur, FinanceFournisseurModal, EcheancierFournisseursModal, StockAnalysis, StockUGReportShadcn, Inventaire, EtatsInventaire, JournalAjustements, Organisation, Vitrine, InteractionsManager
   - **Zone 3** : `dashboard/`, `settings/`, `systemadmin/`, `compta/`, `divers/`, `Promotions/`, `common/`, `omnisearch/`, `auth/`, `challenges/`, `clinical/` + Layout, Sidebar, SystemAdmin, GestionUtilisateurs, Maintenance, Corbeille, JournalAudit, RapportMensuel, CentreRapports, ModuleFinancier, PlanningOperateurs, Ordonnancier, HelpTraining, Login*, modales racine diverses
4. **Fixes à appliquer** (diffs minimaux, pas de conversion Radix) :
   - Modales custom `fixed inset-0` : `role="dialog"` + `aria-modal="true"` + `aria-label` + fermeture `Escape` via `useEffect` (backdrop → `aria-hidden`)
   - Divs cliquables : `role="button"`/`role="checkbox"` + `aria-checked` + `tabIndex={0}` + `onKeyDown` Enter/Space (exclus : wrappers `e.stopPropagation()`)
   - Boutons icône seuls : `aria-label` via clés existantes (`common:close`, `common:delete`, `common:edit`, `common:previous`, `common:next`, `common:search`)
   - Inputs orphelins : `htmlFor`/`id` ou `aria-label` réutilisant le `t(...)` du label
   - `Layout.tsx` : vérifier landmark `<main>` sur la zone de contenu
5. **Constats initiaux** : ~36 overlays `fixed inset-0`, seulement 4 `role="dialog"` existants, 24 `<div onClick>`, toutes les `<img>` ont déjà un `alt`.
6. **Contrôle final** : `tsc`, `npm run build`, `deploy.ps1 -Target frontend`, entrée CHANGELOG.

---

## Comment mettre à jour

Quand une amélioration est implémentée :

1. Passer le statut à `[x]`.
2. Ajouter la date et les fichiers modifiés en dessous de la ligne concernée.

