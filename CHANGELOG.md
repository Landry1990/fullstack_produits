# Changelog — Fullstack Produits

> 📚 Archives mensuelles : `docs/changelog/YYYY-MM.md` (juin → septembre 2026).

## 2026-10-13 — UX : « Détails flux » replié par défaut

- La barre Détails flux (puces par mode, activité intervalle, solde opérationnel)
  est repliée derrière un bouton bascule — contenu redondant avec les cartes KPI
  et la ventilation déjà visible dans la modale de clôture.
- Choix persisté (`localStorage journal_caisse_show_flow`).
- Fichier : `caisse/JournalCaisseStats.tsx`.
- Vérifié : TypeScript, ESLint, JournalCaisse.test 5/5, déploiement OK.

## 2026-10-13 — UX : en-tête compact du Journal de caisse

- Réorganisation en **2 lignes** au lieu de 3 : titre + statut de clôture +
  actions sur la première ; segment Tout/Entrées/Sorties + recherche + mode +
  caissier + dates sur la seconde.
- Le bandeau de statut de clôture devient une **pastille compacte** (icône +
  texte tronqué, détail au survol) — le blocage reste visible en permanence.
- Libellés des boutons masqués sous `md` (icônes + tooltip) pour les petits
  écrans type iPad.
- Fichier : `caisse/JournalCaisseFilters.tsx`.
- Vérifié : TypeScript OK, ESLint OK, JournalCaisse.test 5/5, build + déploiement
  frontend OK (HTTP 200).

## 2026-10-13 — UX Lot 5A : modales de caisse standardisées

- **Clôture du Journal de caisse** : remplacement du `<dialog>` natif et de
  l’écouteur clavier manuel par le `Dialog` shadcn/Radix (focus trap, Escape,
  overlay, blocage du scroll et attributs ARIA natifs).
- **Historique des clôtures** : migration des modales Détail de clôture et Détail
  de session vers le même composant shadcn, avec `DialogTitle` et
  `DialogDescription` sémantiques.
- Aucun `<dialog>` HTML natif ne subsiste dans `src/`.
- Le test Journal de caisse vérifie désormais le rôle `dialog` et la fermeture
  par Escape.
- Fichiers : `JournalCaisseClosingModal.tsx`, `HistoriqueClotures.tsx`,
  `JournalCaisse.test.tsx`.
- Vérifié : TypeScript OK, ESLint ciblé OK, test Journal de caisse 5/5 OK ;
  suite complète 462/463 avec un timeout ponctuel de `ProduitShadcn`, puis test
  de routes relancé seul 66/66 OK.

## 2026-10-13 — UX Lot 4A : contraintes de caisse visibles

- **Facturation** : l’action Encaisser affiche maintenant en permanence pourquoi
  elle est indisponible (vérification en cours, aucun poste sélectionné ou aucune
  caisse ouverte) et reste désactivée tant que la contrainte n’est pas levée.
- **Clôture** : le Journal de caisse indique avant l’ouverture du dialogue si un
  caissier doit être sélectionné, si sa session active bloque la clôture ou si la
  clôture est disponible.
- **Dialogue de clôture** : la raison bloquante reste visible près de l’action de
  confirmation (session active ou montant réel/billetage manquant), avec un état
  positif lorsque toutes les informations requises sont présentes.
- Traductions fr/en ajoutées dans `facturation.json` et `cash_journal.json`.
- Fichiers principaux : `useFacturationState.ts`, `ActionButtons.tsx`,
  `FacturationRightPanel.tsx`, `JournalCaisseFilters.tsx` et
  `JournalCaisseClosingModal.tsx`.
- Vérifié : TypeScript OK, ESLint ciblé OK, 13 tests ciblés OK et 463 tests
  Vitest OK.

## 2026-10-13 — 🗂️ UX Lot 3C : hubs Stock et Rapports

- **Pages hub** : `hubs/FeatureHub.tsx` affiche les fonctionnalités d’un domaine
  en tuiles regroupées par sous-section, filtrées selon les permissions.
- **Nouvelles routes** : `/app/stock` (Centre Stock) et `/app/rapports`
  (Centre de Rapports), protégées par `PermissionRoute`.
- **Entrées « Vue d’ensemble »** en tête des sous-menus Stock et Statistiques.
- **Logique partagée** : `filterNavItemsForUser` et `groupNavSubMenus` exportés
  de `navConfig.tsx` — sidebar et hubs utilisent la même source.
- Hubs indexés dans `APP_PAGES` (Omnisearch + titre de page) et traduits fr/en.
- Fichiers : `hubs/FeatureHub.tsx`, `navConfig.tsx`, `routes.tsx`,
  `appPages.ts`, `Sidebar.tsx`, locales `sidebar` fr/en.
- Vérifié : TypeScript OK, ESLint ciblé OK, 462 tests Vitest OK, build
  production OK, déploiement frontend OK (HTTP 200).

## 2026-10-13 — 🧭 UX Lot 3A/3B : navigation centralisée et regroupée

- **Config unique** : `src/config/navConfig.tsx` centralise les entrées de la
  sidebar (chemin, clé i18n, permission, catégorie, icône, alias hérités,
  groupes). `Sidebar.tsx` consomme cette carte au lieu d’une liste inline.
- **Permissions data-driven** : `aliasPermissions` et `adminOnly` remplacent les
  cas codés en dur ; le comportement d’accès existant est préservé.
- **Commandes fusionnées** : « Commandes Locales » et « Commandes Directes »
  deviennent un parent unique **Commandes** avec sous-sections
  « Locales (Grossistes) » et « Directes (Étranger) ». Chemins et clés de
  permission inchangés.
- **Regroupement des sous-menus** : Stock (12 entrées) en « Opérations » /
  « Pilotage & Analyse », Statistiques (10 entrées) en « Ventes & Performance » /
  « Finance & Produits ». En-têtes affichés en mode étendu et dans les menus
  flottants du mode réduit.
- Fichiers : `navConfig.tsx`, `Sidebar.tsx`, locales `sidebar` fr/en.
- Vérifié : TypeScript OK, ESLint ciblé OK, 461 tests Vitest OK, build
  production OK, déploiement frontend OK (HTTP 200). Reste 3C : hubs
  Stock/Rapports.

## 2026-10-13 — 🔗 UX Lot 2B : alertes actionnables et liens 360°

- **Deep-link produit fiable** : une fiche produit demandée depuis un autre module
  est chargée directement par identifiant, même hors page courante. Les actions
  `edit`, `adjust` et `movements` sont exécutées après ouverture.
- **Commandes** : les actions Modifier, Ajuster et Mouvements de la modale produit
  renvoient maintenant vers la fiche Produits au lieu de rester sans effet.
- **Alertes dashboard** : ruptures, stock dormant, surstock, lots expirants et
  promis ouvrent le produit ou l’écran métier correspondant.
- **Péremption** : les toasts gagnent une action « Voir », les alertes ouvrent
  produit/fournisseur, et les tables Périmés proposent les mêmes liens contextuels.
- **Fournisseurs** : le catalogue fournisseur permet d’ouvrir directement chaque
  fiche produit.
- **API** : `stock-lots/alerts_expiration` retourne `fournisseur_id` pour éviter
  une recherche supplémentaire.
- **Correctif runtime** : les toasts de péremption sont montés dans `Layout`,
  à l’intérieur du routeur, pour conserver la navigation SPA. Le bouton « Voir »
  ouvre directement `/app/perimes?tab=list&expired=false&days=30` (Lots à risque,
  « Déjà périmés » décoché).
- Fichiers principaux : `useProduitPage.ts`, `Commandes.tsx`,
  `StockIntelligence.tsx`, `ExpirationAlertsWidget.tsx`, `ExpirationAlertToast.tsx`,
  `Perimes.tsx`, `FournisseurDetails.tsx`, `stock_lots.py` et locales `dashboard`,
  `stock`, `providers`.
- Vérifié : TypeScript OK, ESLint ciblé OK, 7 tests Django périmés OK, assertion
  Vitest de lien produit ajoutée, 461 tests Vitest OK, déploiement frontend + backend OK.

## 2026-10-13 — ✨ UX Lot 2A : accès rapide à l’information

- **Recherche globale** : le header affiche maintenant un déclencheur visible
  « Rechercher produits, clients, pages… Ctrl K », partagé avec l’Omnisearch via
  `OmnisearchContext`.
- **Contexte de page** : le header indique la catégorie et le titre de l’écran
  courant, avec affichage compact sur petit écran.
- **Pages recherchables** : `APP_PAGES` centralise chemin, titre, catégorie,
  permissions et synonymes ; l’Omnisearch filtre les fonctionnalités accessibles
  et ajoute un aperçu de page.
- Traductions FR/EN ajoutées pour la recherche, les pages et les nouveaux titres.
- Fichiers principaux : `Layout.tsx`, `OmnisearchContext.tsx`, `appPages.ts`,
  `GlobalSearchTrigger.tsx`, `PageTitle.tsx`, `useOmnisearch.ts`,
  `OmnisearchResults.tsx`, `OmnisearchPreview.tsx`, locales `common`/`sidebar`.

## 2026-10-13 — 🛠️ UX Lot 1 complément : périmés et fournisseurs

- **Stock périmé** : la sortie individuelle conserve le dialogue quantité ; la sortie
  groupée demande maintenant une confirmation récapitulant lots et quantité totale
  avant validation sudo `can_manage_perimes`.
- **Restauration périmée** : nouvel endpoint `stock-adjustments/{id}/restaurer_sortie_perimee/`
  et action Historique **Ramener en stock**. L’opération est transactionnelle,
  verrouillée, limitée aux sorties `PERIME`, idempotente (409 au second essai) et
  trace un ajustement inverse + un mouvement `RETOUR` + audit sudo.
- **Fournisseurs** : `include_inactive=false` exclut réellement les fournisseurs
  inactifs/supprimés ; une fiche devenue inactive disparaît de la sélection ; la
  suppression individuelle et groupée ignorent les enregistrements déjà supprimés.
- **Produits** : le filtre de rangement **Fournisseur** est remplacé par **Forme** ;
  Rayon et Forme peuvent être combinés selon l’organisation de la pharmacie.
- Vérifié : `manage.py check` OK, 11 tests Django ciblés OK, TypeScript et ESLint
  ciblés OK, 461 tests Vitest OK, build production OK.
- Fichiers principaux : `Perimes.tsx`, `adjustments.py`, `inventory.py`,
  `fournisseurs.py`, `ProductListPanel.tsx`, `produitService.ts`,
  `test_expired_lot_handling.py`, `test_fournisseur_visibility.py`,
  `catalog.ts`, locales `stock`/`products`, rapport UX.

## 2026-10-13 — ✨ UX Lot 1 : confiance, cohérence et accès sécurisé

- **Produits** : suppression de la sélection multiple sans action ; filtres Rayon et
  Fournisseur rendus accessibles ; dialogues shadcn validés à la place des `prompt()`
  pour les étiquettes et le transfert réserve→rayon.
- **Stock périmé** : sortie de lot via le même dialogue quantité accessible avant la
  validation sudo, avec borne maximale visible.
- **Commandes / Facturation** : action Imprimer inopérante retirée ; faux raccourci
  `Esc` retiré d’Annuler (Escape conserve son rôle de fermeture contextuelle).
- **Omnisearch** : fournisseur → fiche Fournisseur ; actions, liens et groupes de
  résultats filtrés selon les permissions ; `Ctrl/Cmd+K` fonctionne depuis un champ.
- **Sidebar** : permissions Planning/Maintenance/Corbeille alignées avec les routes ;
  sous-menus avec états ARIA et accès clavier en mode réduit ; traductions fr/en.
- Vérifié : TypeScript et ESLint ciblé OK, build production OK, 461 tests Vitest OK.
  Lint global : 29 erreurs préexistantes hors périmètre.
- Fichiers principaux : `ProductListPanel.tsx`, `useProduitPage.ts`,
  `QuantityInputDialog.tsx`, `Perimes.tsx`, `CommandeList.tsx`,
  `OmnisearchResults.tsx`, `useOmnisearch.ts`, `ActionButtons.tsx`, `Sidebar.tsx`,
  locales `products`/`sidebar`, rapport UX.

## 2026-10-13 — 🔍 Audit UX des workflows et de l’accès à l’information

- Audit en lecture seule mené en parallèle sur quatre axes : vente/caisse,
  produits-stock-commandes, navigation globale et cohérence transversale.
- Principaux constats : navigation trop dense (~50 destinations), recherche globale
  peu découvrable, ventes suspendues locales au navigateur, encaissement caisse non
  atomique, actions/filtres visibles mais inopérants, dialogues natifs dans des flux
  métier et liens contextuels incomplets entre entités.
- Priorisation P0/P1/P2, architecture cible, workflows cibles et feuille de route
  enregistrés dans `docs/AUDIT_UX_2026-10-13.md` ; aucune modification fonctionnelle.
- Fichiers touchés : `docs/AUDIT_UX_2026-10-13.md`, `CHANGELOG.md`.

## 2026-10-12 — 🐛 Fix : les services déclenchaient le modal promis

- **Symptôme** : vendre un service (`type_produit = SERVICE`, stock non géré)
  ouvrait le modal de résolution de stock (Promis/Réduire/Forcer) dès que
  `quantite > stock` — un service a typiquement `stock = 0`.
- **Frontend web** : 3 checks de stock ignoraient le flag service —
  `problematicLines` de `useFacturationState` (ouverture du modal), le
  contrôle temps réel de `useSaleCompletion` (toast « stock insuffisant »
  bloquant la vente) et `hasForceSale` de `StockResolutionHandler` (sudo
  inutile si un service cohabite avec un produit en rupture). Tous excluent
  désormais `is_service`/`type_produit === 'SERVICE'`, comme le fait déjà
  `addProduit` (pas de prompt force/substitution) et le backend
  (`_check_stock`, `_allocate_lots`).
- **Backend** : `bulk_refresh` renvoie `is_service` (le check temps réel se
  base sur la donnée fraîche, pas seulement sur le panier ; `.only()`
  étendu à `type_produit`, 0 requête en plus — propriété dérivée).
- **Mobile** : même bug corrigé — `lineDeficit` de `useSendSale` ignore les
  services ; type `Product` complété (`type_produit`, `is_service`, déjà
  présents dans les serializers liste/détail).
- Vérifié : `manage.py check` OK, `is_service` sur queryset `.only()`
  (requête unique), tsc + eslint OK (web + mobile), 73 tests vitest.

## 2026-10-12 — 🔧 update.sh : pull bloqué par dist/ + avertissement rebuild

- `git checkout -- frontend/frontend/dist/` avant `git pull` : `dist/` est
  un artefact tracké souvent "modifié" sur le serveur et `--autostash` ne
  couvre que les rebases → chaque pull échouait sur le merge.
- Détection post-pull des fichiers exigeant un rebuild d'image
  (`middleware_licence`, `utils_licence`, `entrypoint.sh`, `requirements.txt`,
  `Dockerfile`) → bannière "REBUILD D'IMAGE REQUIS" avec les commandes,
  car le hot-deploy `docker cp` est ignoré pour les fichiers Cythonisés.
- Audit races stock : tous les chemins d'écriture en exploitation sont
  verrouillés ; imports Excel classés risque accepté (one-shot install) ;
  convention `recalculate_stock_from_lots` sous verrou documentée dans
  `docs/ANALYSE_PROJET_2026-10-12.md` §6.

## 2026-10-12 — 🐛 Fix 500 sur produit inexistant (adjust_stock / transfer_to_shelf)

- `ProduitStockMixin.adjust_stock` et `transfer_to_shelf` récupéraient le
  produit via `Produit.objects.select_for_update().get(pk=...)` — un pk
  inexistant levait `DoesNotExist` → **HTTP 500 au lieu de 404**.
  Remplacé par `get_object_or_404(...)` (`api/views/produit_actions/stock.py`).
- Détecté par `test_post_smoke` : le balayage générique est maintenant
  **308/308 routes POST < 500** (était 304 + 4 échecs).

## 2026-10-12 — ✅ Renfort de la chaîne de tests (CI + vigile licence + double finalisation)

- **CI** : nouveau job `frontend-test` dans `.github/workflows/ci.yml`
  (`npm ci` + `npm run test:run`, node 20, cache npm) — les ~432 tests
  Vitest ne tournaient jamais en CI (`npm test` = mode watch).
  Script `test:run: vitest run` ajouté à `frontend/frontend/package.json`.
- **`LicenceMiddleware`** : bypass test `sys.argv` remplacé par
  `getattr(settings, 'DISABLE_LICENCE_MIDDLEWARE', …)` — comportement
  inchangé par défaut, mais le vigile devient testable via
  `override_settings(DISABLE_LICENCE_MIDDLEWARE=False)`. Fix au passage :
  `sys.argv[0]` pouvait lever `IndexError` (argv vide) → `any(... for a in sys.argv)`.
- **Nouveau `test_licence_middleware.py`** : licence valide (cache signé
  HMAC `_sign_cache_value`) → 200 ; expirée → 403 `LICENCE_INVALIDE` ;
  clé corrompue en base → 403 ; cache forgé non signé → rejeté ;
  whitelist (`/api/health/`) et kill switch `DISABLE_LICENCE_MIDDLEWARE=True`.
- **Nouveau `test_sale_double_finalization.py`** : `POST /api/factures/finaliser/`
  sur le même devis deux fois (séquentiel + 2 threads via
  `TransactionTestCase`) → {201, 400}, une seule facture, stock décrémenté
  une fois ; même `Idempotency-Key` → réponse rejouée, une seule facture.

## 2026-10-12 — 🛡️ P0 sécurité & infra : 12 correctifs d'audit

Suite de l'audit `docs/ANALYSE_PROJET_2026-10-12.md` — correctifs P0
vérifiés (manage.py check, 19 tests OK, tsc/eslint/build OK, smoke E2E).

**Sécurité backend** :
- `CategoriesListView`/`CategoriesDetailView` : `AllowAny` →
  `IsAuthenticated` + audit log sur POST/PUT/DELETE ; `cache_page(300)`
  retiré sur `categories/` (bypass d'auth — GET caché resservi aux
  non-authentifiés). Vérifié : 401 sans token, frontend inchangé.
- WebSockets : auth obligatoire dans `CashierConsumer`, `PDAConsumer`,
  `CaisseCentraliseeConsumer` (close 4001) — `useCaisseRealtime.ts`
  envoie désormais `?token=` + `wss` en HTTPS. ⚠️ Aucun client WS pour
  `ws/cashier/`/`ws/pda/` n'existe dans le repo — des PDA terrain non
  versionnés sans token seraient refusés.
- `/api/licence/` : `LicenceSudoThrottle` (20/jour) sur POST/DELETE —
  fin de l'oracle de bruteforce `sudo_password`/keyday.
- `PharmacySettingsSerializer` : tokens Telegram/WhatsApp/clés cloud
  masqués `'••••'` pour les non-staff ; `pharmacy-settings` passé en
  `no-store` (retiré du cache public 300s).
- `NUM_PROXIES=1` + `AXES_IPWARE_PROXY_COUNT` (était `AXES_PROXY_COUNT`,
  déprécié) → X-Forwarded-For non spoofable, lockout axes effectif ;
  `audit_helpers` lit l'IP à droite du XFF.
- `init-db.sh` : lignes `replication … trust 0.0.0.0/0` supprimées.

**Infrastructure / déploiement** :
- `command:` supprimé des 2 compose (mort — ENTRYPOINT l'ignorait) ;
  `DB_STATEMENT_TIMEOUT`/`DB_LOCK_TIMEOUT` déplacés vers `environment:`
  → les timeouts de migration prod (300s/30s) s'appliquent réellement.
- `watchdog.sh`/`rollback.sh` : noms de conteneurs/images paramétrables
  (défauts `zenith-pharma-*`), conteneur introuvable ≠ unhealthy
  (fin des faux rollbacks), rollback aligné sur les `:previous` réels.
- `zenith-nightly-update.service` : `TimeoutStartSec=600` → `1800`
  (> `BUILD_TIMEOUT=900`). `nightly-update.sh` : statut `"done"` après
  healthcheck `/api/health/` seulement ; échec → `"failed"` + rollback
  ; helper compose au bon `project name` (bug "app" vs "zenith-pharma").
- `update-app.sh` : hot-deploy backend uniquement — le frontend est
  géré par rebuild image (le `dist/` copié n'existait jamais).
- `deploy.ps1` : `all-full` géré + `default` explicite, warning
  `makemigrations` sur cible, smoke test `/api/health/` post-restart.
- `vite.config.ts` : `maintenance.html` exclu du precache PWA
  (l'`internal` nginx le rendait 404 → install SW cassée).

**Vérifié en live** : `/api/categories/` → 401 sans auth ; compte
flaggé `must_change_password` → 403 partout sauf whitelist → changement
→ flag retombé + token rotaté → 200. Migration `0273` appliquée.

## 2026-10-12 — 🔐 Changement de mot de passe obligatoire au 1er login

- **Problème** : les comptes admin auto-créés (`admin`/`admin123`,
  `sysadmin`, `admin`/`admin` en essai) gardaient leur mot de passe public.
- **`Profile.must_change_password`** (BooleanField, défaut False) +
  migration `0273_profile_must_change_password`.
- **Flag posé à l'attribution du mot de passe**, pas à la recréation des
  privilèges : `entrypoint.sh` (compte admin par défaut, uniquement si
  créé), `ensure_emergency_admin.py` (uniquement à la création — jamais
  au boot suivant), `utils_licence.py` (superuser `admin/admin` essai),
  `UserSerializer.create/update` (tout mot de passe attribué par un
  admin via l'API).
- **Endpoint self-service** `POST /api/users/change-my-password/`
  (`UserViewSet.change_my_password`) : vérifie `old_password`, réutilise
  `UserSerializer.validate_password` (longueur + unicité inter-comptes),
  refuse `new == old`, retombe le flag, révoque les tokens et retourne
  un token frais `{token, detail}`. Throttle `PasswordChangeRateThrottle`
  (`UserRateThrottle`, scope `password_change`, 5/min).
- **Login** : `CustomAuthToken` renvoie `must_change_password` (bool).
- **Enforcement serveur** : `api/middleware/force_password_change.py`
  — pour un user authentifié (session ou token résolu via le header
  Authorization) dont le flag est True, seuls les chemins whitelistés
  passent (change-my-password, logout, GET me/pharmacy-settings/licence/
  version/health) ; sinon 403 `{detail, code_erreur: PASSWORD_CHANGE_REQUIRED}`.
  Enregistré après `LicenceMiddleware` dans `settings.MIDDLEWARE`.
- **Frontend** : flag propagé (login → sessionStorage → `AuthContext`),
  dialogue shadcn **non dismissible** `ForcePasswordChangeGuard` monté
  dans `App.tsx` (ancien/nouveau/confirmation, i18n `auth:force_change`
  fr+en), nouveau token stocké puis reload ; le 403
  `PASSWORD_CHANGE_REQUIRED` n'affiche pas de toast parasite.
- Vérifications (`manage.py check`, `makemigrations --check`, tests,
  `tsc`/`eslint`) non exécutées — environnement sans exec.

## 2026-10-12 — 🔒 Correctifs intégrité : validation inventaire + verrous document

- **`validate_inventaire`** (`api/views/stocks/inventaire/validation.py`) :
  le 409 conflit de versions ne committe plus les écritures partielles —
  tout return d'erreur depuis le bloc `atomic` est désormais précédé de
  `transaction.set_rollback(True)` (inventaire vide, quantités invalides,
  conflits lots/produits).
  - Check de statut `VALIDEE` refait sous `select_for_update()` dans la
    transaction → deux validations concurrentes ne passent plus toutes
    les deux (double réécriture du stock).
  - Versions des `StockLot` désormais vérifiées avant `bulk_update`
    (le dict `{l.id: l.version}` était calculé puis ignoré) → 409 +
    rollback en cas de modification concurrente.
  - N+1 supprimé : le recalcul des stocks consolidés utilise un seul
    `values('produit_id').annotate(Sum...)` groupé au lieu d'un aggregate
    `StockLot` par produit.
- **Verrous document** (transitions de statut) :
  - `cloturer` et `annuler_reception` (`api/views/commandes/cloture_mixin.py`)
    re-fetch la `Commande` via `select_for_update()` avant le check de
    statut → plus de double réception / double retrait de stock.
  - `SaleValidator.validate_invoice` (`api/services/sale_validator.py`)
    verrouille la `Facture` via `select_for_update()` puis
    `refresh_from_db()` (même instance conservée pour les appelants).
- **Test de non-régression** : `api/tests/test_inventory_validation_lock.py`
  — double validation → erreur propre sans écriture partielle ;
  inventaire vide → 400 sans écriture.
- Vérifications `manage.py check` / tests non exécutées dans l'environnement
  du correctif (pas d'accès Docker) — à lancer par l'agent de contrôle.

## 2026-10-12 — 🔍 Audit complet du projet (5 sous-agents)

- **Rapport** : `docs/ANALYSE_PROJET_2026-10-12.md` — analyse complète
  (backend, frontend, sécurité, infra/déploiement, tests) avec références
  `fichier:ligne`, matrice de risque et plan d'action priorisé (P0→P2).
- **Constats critiques principaux** :
  - Sécurité : comptes admin à mots de passe publics recréés au boot,
    CRUD rayons `AllowAny` (categories.py:208-258), 3 WebSockets sans
    auth (injection d'articles en caisse), réplication Postgres `trust`
    0.0.0.0/0, throttle login contournable par XFF + axes contourné,
    licence qui n'expire pas (`verify_exp=False`), secrets métier
    (tokens Telegram/WhatsApp) lisibles par tout authentifié.
  - Intégrité : `validate_inventaire` commit les écritures malgré le 409
    ; transitions de statut (`cloturer`, `validate_invoice`) sans verrou
    document → double validation/réception possible.
  - Infra : `command:` compose ignoré par l'ENTRYPOINT (timeouts
    migration jamais appliqués), watchdog surveille les conteneurs dev
    en prod → boucle de faux rollbacks, rollback automatique incapable
    de fonctionner, hot-deploy frontend jamais appliqué, timeout
    systemd < timeout du build.
  - Frontend : `ws://` hardcodé → WebSockets morts en HTTPS ; tunnel de
    vente sans couverture + Vitest absent de la CI ; middleware licence
    auto-désactivé sous test.
- **Verdict** : cœur métier solide (vente/stock/caisse bien testés),
  périphérie fragile — P0 = ~10 correctifs circonscrits, non structurels.
- Aucune modification de code — audit en lecture seule.

## 2026-10-11 — 🎯 Fiche produit : seuil d'alerte = stock minimum

- **Alignement métier** : le backend n'utilise `stock_alert` (champ
  manuel historique) nulle part — les vraies alertes se basent sur
  `stock_minimum` (dashboard ruptures `stock <= stock_minimum`,
  suggestions de commande idem). L'UI affichait `stock_alert`, souvent
  0 → seuil affiché incohérent avec les alertes réelles.
- **Fix** :
  - KPI « Seuil d'alerte » du header → affiche `stock_minimum`.
  - Couleur ambre du KPI stock → basée sur `stock_minimum` (rouge ≤ 0
    inchangé).
  - Compteur « stock bas » du footer liste → même règle que le backend
    (`min > 0 && stock <= min && stock > 0`) au lieu de `stock_alert`.
  - Ligne « Seuil d'alerte » retirée de l'onglet Général — redondante
    avec « Stock Min / Max » et affichait l'ancien champ.
- Le champ `stock_alert` reste présent en base et éditable dans le
  formulaire (pas de migration) — simplement plus affiché comme seuil.
- Fichiers : `ProductDetailHeader.tsx`, `useProduitPage.ts`,
  `ProductTabsContent.tsx`.

## 2026-10-11 — ♻️ Refactor `ProduitShadcn.tsx` (810 → ~200 lignes)

- Découpage de la page Produits en 4 unités à responsabilité unique,
  **sans changement de comportement** :
  - **`hooks/useProduitPage.ts`** : tout l'état, les queries
    (produits/lots/stats/achats/historique + référentiels), les
    handlers (delete, ajustement, toggle, étiquettes, transfert rayon,
    mouvements, édition), la nav clavier et le debounce de recherche.
    Exporte `ActiveTab` + `AdjustForm`.
  - **`products/ProductListPanel.tsx`** : panneau gauche (recherche,
    filtres + chips, table, footer stats, pagination).
  - **`products/ProductDetailHeader.tsx`** : header fiche en 3 zones
    (nom/méta, KPI strip, actions + menu ⋯).
  - **`products/ProduitPageModals.tsx`** : les 6 modals regroupés.
- **`ProduitShadcn.tsx`** = orchestrateur : header page, grille
  master-detail (mobile inclus), composition des 3 sous-composants.
- **Code mort supprimé** : sous-composant `_PriceRow` inutilisé,
  `console.log` de debug (`[Filter Change]`, `[Pagination Debug]`),
  effet `setPage(1)` débarrassé de son log.
- Micro-perf : `new Set(selectedIds)` sorti de la boucle `.map` des
  lignes (était recréé par produit).
- Typecheck + eslint OK sur les 5 fichiers.

## 2026-10-11 — 🧩 Fiche produit : harmonisation shadcn/ui des onglets

- **`ProductTabsContent.tsx`** : la partie « fiche » était mixte — table
  déjà shadcn mais onglets en `Button` custom (`ui/Button`, deprecated)
  et puces en `<span>` maison.
- **Barre d'onglets** → `Tabs`/`TabsList`/`TabsTrigger` shadcn (Radix) :
  look identique (actif indigo, inactif slate, scroll horizontal) +
  navigation clavier roving-tabindex et rôles ARIA corrects en bonus.
- **Puces** → `Badge` shadcn `variant="outline"` + teinte : rayon (bleu),
  fournisseur (slate), seuil d'alerte (ambre), numéros de lot (achats +
  lots), type de mouvement (ambre AJUSTEMENT / vert entrée / rouge
  sortie), n° commande/avoir dans MVMTS, badge de variation du graphe
  prix achat.
- **Boutons du fichier** → `Button` shadcn (`outline`/`ghost`/`sm`) :
  « lots épuisés », édition inline lot/péremption, export Excel MVMTS
  (icône `Download` inline, plus de `leftIcon`).
- Aucune nouvelle clé i18n. Typecheck + eslint OK.

## 2026-10-12 — 🚑 Fix critique : page blanche globale (chunks circulaires)

- **Symptôme** : app entièrement blanche après le build UI/UX —
  `TypeError: can't access property "displayName" of undefined` dans
  `feature-inventory-states`.
- **Cause** : l'import de `@radix-ui/react-dropdown-menu` a déplacé les
  modules internes Radix partagés (`primitive`, `context`…) entre chunks.
  Le binding `DialogPrimitive.Overlay` vivait dans `feature-caisse` en
  import circulaire avec `feature-inventory-states` → non initialisé à
  l'évaluation → crash au chargement.
- **Fix** : `manualChunks` converti en fonction dans `vite.config.ts` — tous
  les `@radix-ui/*` + dépendances proches (`aria-hidden`, `react-remove-scroll`,
  `react-style-singleton`…) vont dans un chunk `vendor-radix` feuille
  (aucun import vers les features → plus de binding partagé non initialisé).
  Les groupes existants sont préservés à l'identique.
- Build vérifié : `feature-inventory-states` n'importe plus Radix depuis
  `feature-caisse`, bundle déployé et servi par nginx.

## 2026-10-12 — ✨ Organisation : relooking UI/UX de la page

- **Recherche catégories** : l'input de recherche de la sidebar était mort
  (pas de `onChange`) — il filtre désormais la liste, sous-rayons inclus
  (un parent remonte si un enfant matche).
- **Badges de comptage** : chaque catégorie affiche son nombre de produits.
  Backend : `produits_count` annoté (`Count`) sur les querysets des 3 viewsets
  + `SerializerMethodField` avec fallback ; `parent_name` exposé sur
  `RayonSerializer` (était référencé côté front mais jamais renvoyé).
- **Actions de ligne** : les 4–5 icônes cryptiques au survol sont regroupées
  dans un menu `⋯` (shadcn DropdownMenu) avec libellés explicites. Les
  sous-rayons gagnent l'action « Modifier » qui leur manquait.
- **Modal « Ajouter des produits »** : chaque résultat affiche un chip de son
  assignation actuelle — gris « Non classé », vert « nom de la catégorie »
  (déjà ici), ambre « nom · sera migré » (autre catégorie).
- **Modal de fusion** : refait — flux visuel source → cible, liste de cibles
  recherchable avec badges de comptage et chemin parent (`parent › enfant`),
  sélection radio, récapitulatif d'impact conservé.
- `cursor-pointer` ajouté sur les éléments cliquables (reset Tailwind 4).
- i18n fr/en (`assignment_none`, `will_move_tag`, `will_move_tooltip`).
- Vérifié live : `produits_count` sur rayons/formes/groupes (ex. COLLYRES=117).
  Typecheck + eslint + build OK.

## 2026-10-11 — 🔀 Organisation : fusion de rayons / formes / groupes

- **Demande** : pouvoir fusionner deux catégories dans le menu Organisation.
- **Backend** : nouvel endpoint `POST /api/{rayons|formes|groupes}/{id}/merge/`
  (body `{target_id}`). Atomique : produits de la source réassignés à la cible,
  sous-rayons rattachés à la cible (choix utilisateur), source supprimée.
  Rejets : cible = source, cible = descendant de la source (cycle), cible
  inexistante. Audit log DELETE + `SearchCache.invalidate_all_products()`.
  - `api/views/category_merge.py` (helper partagé `merge_category` +
    `rayon_descendant_ids`)
  - Actions `merge` dans `CategorieViewSet`, `FormeViewSet`, `GroupeViewSet`.
- **Frontend** (`CategoryManager.tsx`) : icône fusion (ambre) sur chaque
  catégorie (parent, enfant, en-tête détail) → modal de sélection de la cible
  (exclut la source + ses descendants), affiche le nb de produits et de
  sous-rayons concernés + avertissement d'irréversibilité avant confirmation.
  Après fusion : rafraîchissement liste, sélection basculée sur la cible.
- i18n fr/en (`category_manager.merge_*`).
- Vérifié en live : produit déplacé (forme 5→6), sous-rayon rattaché
  (parent 10→12), rejet cycle et auto-fusion, sources supprimées.
  Données `[TEST]` purgées. Typecheck + eslint + build OK.

## 2026-10-11 — 🔄 Organisation : confirmation de migration rayon/forme/groupe

- **Demande** : dans Organisation, l'ajout d'un produit à un rayon écrasait
  silencieusement son rayon actuel (FK unique). Idem formes et groupes.
- **Ajout simple** (`CategoryManager.handleAddProduct`) : si le produit a déjà
  un autre rayon/forme/groupe → dialog de confirmation « appartient déjà à
  « X » — migrer vers « Y » ? » (Oui/Non). S'il est déjà dans la catégorie
  cible → toast info + skip (évite le doublon d'affichage).
- **Rangement intelligent** (`SmartOrganizerModal`) : le dialog de
  confirmation affiche « N produit(s) déjà classé(s) ailleurs seront migrés ».
- **Backend** : `ProduitListSerializer` expose désormais les FK `rayon`,
  `forme`, `groupe` + `groupe_nom` (avant : seuls `rayon_name`/`forme_nom`) ;
  `for_import` renvoie aussi `rayon`/`rayon__name`/`forme`/`forme__nom`/
  `groupe`/`groupe__nom` ; `select_related` + `groupe`. Additif, pas de
  cassure de contrat.
- i18n fr/en (`category_manager.migration_*`, `already_in_category`,
  `smart_organizer.migration_note`). Typecheck + eslint + JSON OK, endpoint
  vérifié en live.

## 2026-10-11 — 🧪 Test de charge : plafond réel ~30 users actifs (écriture sérialisée)

- **Méthode** : `backend/scripts/load_test_api.py --stress` (recherche produits /
  liste factures / `finaliser` vente), 60 users `lt_*` avec tokens (throttle
  réaliste par user), produits/clients `[TEST]` dédiés (catalogue intact),
  backend limité à 1.5 CPU comme la prod.
- **Résultat** : sain jusqu'à **~30 clients simultanés** (P95 < 3 s), rupture
  à 50 (P95 3,9 s ; `finaliser` P95 ~10 s). 0 % d'erreurs, 0 crash — le serveur
  *ralentit* mais ne tombe pas.
- **Goulots identifiés** :
  1. **Écriture** : `next_document_number` verrouille la ligne `DocumentCounter`
     via `select_for_update` pendant TOUTE la transaction de vente
     (`billing.py:895`) → toutes les ventes se sérialisent (~2–4 ventes/s max).
     Avec 8 workers : aucune amélioration → le verrou est le plafond, pas les
     workers.
  2. **Concurrence** : chaque worker uvicorn exécute tout le code sync (vues +
     ORM) sur UN thread (`thread_sensitive`) → 4 workers = ~4 requêtes
     parallèles réelles ; le reste queute (CPU restant bas).
  3. `UVICORN_WORKERS` en env est défini mais jamais utilisé (`--workers 4`
     en dur dans les commandes compose).
- **Conclusion** : ~30–40 users actifs simultanés OK ; au-delà, les lectures
  restent bonnes mais les ventes queuent. Leviers : réduire la fenêtre du
  verrou DocumentCounter, `BACKEND_CPUS` > 1.5, câbler `UVICORN_WORKERS`.
- Cleanup intégral : 469 factures `[TEST]` purgées, 60 users `lt_*`, postes/
  caisse `[TEST]`, 469 AuditLog — compteurs restaurés (4951 produits,
  17 clients). Fichier `loadtest_tokens.txt` supprimé.

## 2026-10-11 — 🔧 Fix typecheck : `cn()` local refusait `null`

- Erreur TS dans `ProduitShadcn.tsx` (l. 427) :
  `selectedProduit && 'max-lg:hidden'` produit `null | string` car
  `selectedProduit` est `ProduitModel | null`, mais le `cn()` local
  n'acceptait que `string | false | undefined`.
- Fix : suppression du `cn()` local dupliqué, utilisation du `cn()`
  standard shadcn de `src/lib/utils.ts` (clsx + tailwind-merge, accepte
  `ClassValue` dont `null`). Aucun changement visuel. Typecheck +
  eslint OK.

## 2026-10-11 — 💄 Fiche produit : refonte header + adaptation petit écran

- **Problème mobile corrigé** : sous `lg`, les deux panneaux (liste +
  détail) faisaient `h-full` dans une grille `overflow-hidden` → la
  fiche produit était poussée hors écran, quasi inaccessible.
- **Navigation maître-détail (< lg)** : la liste occupe tout l'écran ;
  la sélection d'un produit affiche la fiche en plein écran avec un
  bouton « ← Retour » (`lg:hidden`, reset de `selectedProduit`). La
  fiche devient enfin utilisable sur tablette/téléphone.
- **Header restructuré en 3 zones** (`ProduitShadcn.tsx`) :
  - **Nom + méta** : `truncate` supprimé → `break-words` (les noms
    pharma longs ne sont plus coupés) ; badges inactif/exclusif/service
    et ligne CIP regroupés.
  - **KPI strip** : cartes `flex-wrap` — Stock (code couleur
    rouge/ambre/vert), Réserve (si `has_reserve_storage`), Seuil
    d'alerte, Prix de vente — contexte complet en un coup d'œil.
    Service → carte violette « Service » à la place du stock.
  - **Actions** : 2 primaires visibles (Ajuster stock, Modifier) +
    menu `⋯` `DropdownMenu` shadcn (Réappro rayon, Étiquettes,
    Activer/Désactiver, Supprimer en destructif) — fini les 6 boutons
    concurrents.
- i18n : `common:back` réutilisé, `common:actions_title` pour l'aria
  du menu ; aucune nouvelle clé. Typecheck + eslint OK.

## 2026-10-11 — 👁️ Fiche produit : stock beaucoup plus visible

- **Demande** : l'info du stock dans la fiche produit (panneau droit de la
  page Produits) était un badge `text-xs` — trop petit pour être lu
  rapidement en caisse/magasin.
- **Fix** : la quantité passe en `text-2xl font-black tabular-nums` avec
  libellé en capitales discrètes + bordure assortie au code couleur
  existant (rouge rupture / ambre sous seuil d'alerte / vert OK).
  En mode réserve : « RAYON n | RÉSERVE n » avec séparateur vertical.
- Fichiers : `ProduitShadcn.tsx` (en-tête fiche), `products/modals/
  ProductDetailsModal.tsx` (stock total `text-xl` → `text-3xl`),
  `products/ProductDetailPanel.tsx` (même traitement — composant
  actuellement non importé, harmonisé par cohérence).
- Aucune nouvelle clé i18n (réutilise `common:stock`, `common:rayon`,
  `products:detail.reserve_label`).

## 2026-10-11 — 🌐 Fix clé i18n manquante `matrix.penalties.days_short`

- Le tableau « Top 5 — Pénalités de score » (matrice santé du stock)
  affichait la clé brute `95matrix.penalties.days_short` au lieu de
  « 95 j » — la clé n'existait ni en `fr` ni en `en`.
- Ajout : `days_short` = « j » (fr) / « d » (en) sous `matrix.penalties`
  + espace ajoutée côté template dans `StockMatrixPanel.tsx`.

## 2026-10-11 — 🗜️ Analyse stock : bloc filtres repliable (iPad)

- **UX** : le bloc « filtres + statistiques » de l'Analyse de stock occupait
  ~40 % de la hauteur d'un iPad 6 avant d'atteindre le tableau.
  Ajout d'un toggle chevron dans l'en-tête de la carte filtre qui replie
  les filtres **et** les cartes de stats (compteurs déjà présents dans le
  badge d'en-tête : nb articles + valeur).
- En mode replié, la description affiche un résumé compact des filtres
  actifs (ex. « Tous les fournisseurs · 90 jours »).
- Choix persisté en `localStorage` (`stock-analysis-filters-collapsed`) —
  reste replié entre les pages/onglets.
- Accessibilité : `aria-expanded`, `aria-controls`, label bilingue
  « Masquer/Afficher les filtres ».
- Couvre les 3 onglets partageant le bloc : invendus, surstock, ruptures.
- Fichiers : `components/StockAnalysis.tsx`, locales `stock.json` (fr/en),
  test du toggle ajouté dans `StockAnalysis.test.tsx` (10/10 verts, lint
  + build OK).

## 2026-10-11 — 🧪 Smoke test invariants métier : la dérive de stock

- **Nouveau** : `api/tests/test_invariants_smoke.py` — 7 tests vérifiant
  après chaque flux critique que les compteurs dénormalisés ne dérivent
  pas (pire crash possible en prod : stock affiché ≠ stock réel).
  Invariant contrôlé (même formule que `Produit.calculate_stock_from_lots`) :
  `stock == Σ lots.quantity_remaining − obligations RAYON`,
  `stock_reserve == Σ reserved − obligations RESERVE`, aucun lot négatif.
  - Vente : stock −3, allocations couvrent 100 % de la quantité vendue.
  - Annulation : restauration intégrale (lots + compteur), retour à 100.
  - Ajustement : `adjust-stock` resynchronise les lots + trace
    `StockAdjustment`.
  - Réception commande : clôture incrémente stock et lots de façon
    cohérente (+5).
  - Livraison promis et sortie périmés : compteurs toujours cohérents.
  - Scan global : aucune dérive sur tous les produits lot-gérés.
- Résultat : **0 dérive détectée** — les compensations `F('stock')` des
  `bulk_update` (qui contournent le signal de resynchro) sont correctes
  sur les 6 chemins de mutation testés.

## 2026-10-11 — 🧪 Smoke test WebSocket (5 endpoints Channels)

- **Nouveau** : `api/tests/test_websocket_smoke.py` — 7 tests sur les
  consumers (`api/consumers.py`), avec `InMemoryChannelLayer` pour ne pas
  polluer le Redis réel :
  - Connexion + ping→pong sur les 5 endpoints (`cashier`, `pda`,
    `caisse_centralisee`, `stock`, `lock/<model>/<pk>`).
  - Rejets : `ws/stock` et `ws/lock` refusent l'anonyme et les tokens
    invalides (close 4001 via `TokenAuthMiddleware`).
  - Relais PDA↔caisse : `cashier_item_new` arrive à la caisse,
    `cashier_item_status` revient au PDA.
  - Broadcasts `facture_update` (caisse centralisée) et `stock_update`
    reçus au bon format.
  - Protocole de verrou document de bout en bout : acquire →
    `lock_acquired`, second client → `lock_denied`, release → broadcast
    `lock_update`, heartbeat sans casse.
  - Entrées malformées : JSON cassé → `error` explicite (cashier/pda) ou
    ignoré, connexion toujours vivante après.
- **Observation sécurité documentée** : `ws/cashier/`, `ws/pda/` et
  `ws/caisse_centralisee/` acceptent les clients non authentifiés — tout
  appareil du réseau peut injecter des articles ou écouter les factures.
  OK en LAN de confiance, à durcir si le serveur est exposé.
- Détails d'implémentation : `TransactionTestCase` (le token doit être
  commité pour la lookup DB du middleware async) + `_fixture_teardown`
  désactivé (`TRUNCATE` impossible : `api_sessioncaisse` référence
  `auth_user` hors du flush) + seed en `setUpClass`.

## 2026-10-11 — 🧪 Smoke test management commands (crons) + 🐛 crash `cleanup_silk`

- **Nouveau** : `api/tests/test_commands_smoke.py` — un cron qui crash est
  invisible en prod (aucune erreur côté utilisateur). 4 tests :
  - **Import** : les 45 commandes de `api/management/commands` s'importent
    et s'instancient → détecte les erreurs d'import qui tuent un cron.
  - **Exécution sûre** : 31 commandes lancées réellement (ou `--dry-run`)
    sur la DB de test — crons du scheduler (`run_order_schedules`,
    `recalculate_analytics`, rapports mensuels, rappels chroniques,
    `auto_backup`), `check_integrity` (entrypoint conteneur), diagnostics
    et mutations inoffensives → fin ou `CommandError` contrôlée, jamais
    d'exception non rattrapée.
  - **Garde-fous** : `restore_database`, `pitr_restore`, imports → échec
    bruyant exigé sans argument requis.
  - **Classification exhaustive** : toute nouvelle commande doit être
    classée SAFE_RUN / ARG_GUARDED / IMPORT_ONLY → test auto-alimenté.
- **Bug trouvé et corrigé** : `cleanup_silk` crashait à l'import
  (`RuntimeError: silk.models.Request ... isn't in INSTALLED_APPS`) dès que
  `ENABLE_SILK` est désactivé — c'est-à-dire la config par défaut prod.
  Import `silk.models` déplacé dans `handle()` avec `CommandError` claire
  (`api/management/commands/cleanup_silk.py` + même fix dans
  `scripts/cleanup_silk.py`).
- Bonus : le test exerce le pipeline de commandes automatiques de bout en
  bout (schedule seedé → `Commande AUTO` réellement créée).

## 2026-10-11 — 🧪 Smoke test anti-crash (mutations + rôle + entrées corrompues) + 🐛 2 bugs

- **Nouveau** : `api/tests/test_crash_smoke.py` — trois balayages :
  - **PATCH/PUT/DELETE** : PUT{}/PATCH{}/DELETE sur toutes les routes
    (55/57/56 testées) → jamais 5xx. Auto-alimenté via `urls.py`.
  - **Utilisateur non privilégié** : un compte "caissière" sans permissions
    sudo balaie 345 GET + 152 POST → les refus doivent être 401/403/404,
    jamais 5xx. Détecte les crashs de contrôle d'accès.
  - **Entrées malformées** : `pk='abc'` sur 17 routes de détail, dates
    invalides/inversées sur les rapports, `page_size` exotique, JSON
    malformé → 400 explicite, jamais 500.
- **Bugs trouvés et corrigés** :
  - `stock-lots/{id}/sortir_perimes/` → 500 `StockLot.DoesNotExist` si le
    lot n'existe pas (et `pk='abc'` → `ValueError`) → `parse_id` + 404
    (`views/stocks/stock_lots.py`).
  - `promis/{id}/annuler_et_reintegrer/` → 500 `Promis.DoesNotExist` idem
    → `parse_id` + 404 (`views/commandes/promis.py`).
- Résultat : 3 tests verts, 0 régression sur `test_post_smoke` +
  `test_routes_smoke`.

## 2026-10-11 — 🧪 Smoke test POST métier + 🐛 2 bugs trouvés et corrigés

- **Nouveau** : `api/tests/test_post_smoke.py` — deux niveaux :
  - **14 flux métier critiques** avec vraies données + payloads valides →
    2xx obligatoire : ouvrir/fermer/activer poste de vente, encaisser
    (caisse), valider/payer/annuler facture, paiement de créance,
    lock/unlock/clôturer commande, ajuster stock, valider avoir, livrer
    promis. Une 400/500 ici = vrai bug.
  - **Balayage générique** : POST {} sur toutes les routes POST (298
    testées) → 400/403/404 attendus, jamais 5xx. Auto-alimenté : tout
    nouveau POST ajouté à `urls.py` est couvert. Exclusions documentées :
    purges, backups, mises à jour système, envois externes
    (WhatsApp/Telegram/SMS), uploads de fichiers.
  - Vérifie aussi qu'aucun flux métier n'est accessible sans auth.
- **Bugs trouvés par le balayage et corrigés** :
  - `inventaires/{id}/lignes/` POST → 500 `KeyError: 'produit'` si le champ
    `produit` est absent → garde-fou en début de handler, 400 explicite
    (`views/stocks/inventaire_main.py`).
  - `ligne-inventaire/` POST → 500 `KeyError: 'produit'` idem dans
    `LigneInventaireViewSet.create` → 400 explicite.
- Résultat : 3 tests, 14/14 flux critiques OK, 298/298 POST sans 5xx.

## 2026-10-11 — 🧪 Smoke test des endpoints de génération de documents

- **Nouveau** : `api/tests/test_documents_smoke.py` — vérifie que chaque
  endpoint produisant un document renvoie un fichier **valide**, pas juste
  un 200 : signature `%PDF` pour les PDF, classeur ouvrable via `openpyxl`
  pour les XLSX, corps décodable non vide pour les CSV, JSON parsable pour
  les `print-data`/relevés. 40 endpoints couverts (38 GET + 2 POST).
- **Couverture** : factures PDF, tickets promis (simple + groupé), reçus de
  créances, états d'inventaire/écarts, états de stock par rayon, ordonnancier,
  rapports mensuel/par dates/valeur stock, exports Excel (remises, livre de
  caisse, balance stock, rapport général, ajustements, historique ventes,
  avoirs clients, maintenance), CSV (comptable, Sage i7, audit, telegram,
  fréquence ruptures, commandes, produits), print-data, étiquettes PDF.
- **Tests complémentaires** : paramètres requis absents → 400/404 propre,
  jamais 5xx (12 endpoints) ; aucun endpoint document accessible sans auth.
- **Détails d'implémentation** : décompression gzip (`GZipMiddleware`),
  dates dynamiques couvrant les fixtures, seed créance avec paiement
  partiel (`remainder > 0` requis par `CreanceViewSet`), collision
  `self.client` APIClient évitée via `cls.customer`.
- Résultat : 4 tests, 40 endpoints documents OK, 0 régression.

## 2026-10-10 — 🧪 Smoke test de toutes les routes + 🐛 4 bugs trouvés et corrigés

- **Nouveau** : `api/tests/test_routes_smoke.py` — parcourt dynamiquement
  `api/urls.py` (router DRF + paths explicites, 495 routes nommées, 349 GET)
  et vérifie qu'aucun GET authentifié ne renvoie 5xx, que les routes protégées
  exigent l'auth (whitelist `KNOWN_PUBLIC_ROUTES`) et que l'inventaire reste
  cohérent. Auto-alimenté : toute nouvelle route est couverte.
- **Nouveau** : `frontend/src/routes.test.tsx` — parse `routes.tsx` et charge
  chaque composant lazy (65 tests) : module existant + export par défaut requis
  par `React.lazy`, imports eager résolus, aucun path dupliqué.
- **Bugs trouvés par le smoke test et corrigés** :
  - `margins/anomalous_margins/` → 500 : `FieldError`, filtre `cost_price` sur
    `FactureProduit` (champ inexistant) → `produit__cost_price`
    (`services/margin_service.py`).
  - `rapports/rapport_remises_excel/` + `_details_excel/` → 500 : `TypeError`,
    les exports itéraient `.data` sans vérifier que la réponse interne est une
    liste (dict `{error}` en cas de 400) → propagation de la réponse d'erreur
    (`views/rapports/finance.py`).
  - `postes-ventes/recap_session/` → 500 latent : `date_paiement__gte=None`
    quand un PosteVente actif n'a pas `date_ouverture` → filtres conditionnels
    dans les deux branches (`views/ventes/caisse_poste.py`).
  - `maintenance/changelog/` → 404 systématique : `CHANGELOG.md` hors des
    chemins candidats — ajout de `/opt/zenith-pharma/CHANGELOG.md` (prod) et
    montage `./CHANGELOG.md:/app/CHANGELOG.md:ro` en dev (`purge.py`,
    `docker-compose.yml`).
- Nettoyage : suppression du fichier parasite `frontend/src/nul` (piège
  `> nul` Git Bash qui casse `git add`).

## 2026-10-10 — 🐛 `git pull` bloqué en prod par les chmod des scripts

- **Symptôme** : `update.sh` échoue chez le client —
  `Vos modifications locales aux fichiers suivants seraient écrasées par la
  fusion : update-app.sh`.
- **Cause** : tous les scripts `.sh` étaient commités en mode `644`, mais
  `install.sh`, `zenith-update.sh`, `update-app.sh` et `system_admin.py`
  (`os.chmod(script_path, 0o755)` à chaque update depuis l'app) font des
  `chmod +x`. Avec `core.fileMode=true` (défaut Linux), git voyait un
  changement de mode comme une modification locale → merge refusé dès qu'un
  script changeait en upstream.
- **Fix** :
  - Tous les `*.sh` + `webhook-deploy.py` passés en `100755` dans l'index
    (40 fichiers, changement de mode seul — les chmod côté client deviennent
    des no-op pour git).
  - `update.sh`, `update-app.sh`, `zenith-update.sh` : `git config --local
    core.fileMode false` + `git pull --autostash` (une éventuelle retouche
    locale est stashée puis réappliquée au lieu de bloquer).
  - `install.sh` : `core.fileMode false` ajouté en section 7 pour les
    futures installations.
- **Déblocage ponctuel chez un client déjà bloqué** :
  `cd /opt/zenith-pharma && git config core.fileMode false &&
   git checkout -- update-app.sh && git pull && ./update.sh`

## 2026-10-10 — 🐛 Le devis ne se rattache plus à la caisse

- **Symptôme** : un devis enregistré apparaissait dans la caisse centralisée
  (ventes à encaisser) et se faisait rattacher au poste de vente à chaque
  activation/ouverture de poste.
- **Fix** : un devis est un document commercial, pas une vente en attente.
  - `CaisseCentralisee.tsx` : filtre `status__in` `BROU,VAL,PROF` → `BROU,VAL`
    (les PROF n'apparaissent plus dans la file d'encaissement).
  - `caisse_poste.py` : suppression du rattachement automatique des PROF sans
    poste dans `activer` et `ouvrir` (le champ
    `factures_en_attente_rattachees` de la réponse, inutilisé, est retiré).
    Le devis reste `poste_vente=NULL` ; la conversion `existing_id` assigne
    le poste actif au moment de la validation (`_update_existing_facture`).
  - `bulk_actions.py` : la vidange `all_pending` (annulation en masse des
    ventes en attente caisse) n'inclut plus les PROF — évite d'annuler des
    devis clients par erreur. Annulation d'un devis toujours possible via
    `facture_ids` explicite.
- Tests backend : 38/38 (`test_facturation_contract` + `test_sale_finalizer`).

## 2026-10-09 — 🐛 Rappel devis effacé à l'ouverture du point de vente

- **Symptôme** : devis chargé en facturation (« Charger en facturation »),
  panier rempli en mode modification → à la sélection du point de vente
  (modal forcé quand aucun poste actif), tout s'effaçait.
- **Fix (ordre garanti)** : `useDevisLoader` n'hydrate plus le panier tant
  qu'aucun poste de vente n'est actif (`isPosteActive`). Le devis se charge
  **après** la fermeture du modal d'ouverture → plus rien ne peut l'écraser.
  Cas inchangé : poste déjà actif → hydratation immédiate au montage. Si
  l'utilisateur quitte sans choisir de poste, `devis_to_load` reste en
  stockage → re-proposé à la prochaine visite.
- Fichiers : `hooks/useDevisLoader.ts` (option `isPosteActive`, effet
  re-déclenché sur activation), `hooks/useFacturationState.ts` (passe
  `Boolean(multiCaisse.myActivePoste)`).
- Test : `hooks/__tests__/useDevisLoaderPosteWipe.test.tsx` — vérifie que
  sans poste le panier reste vide et `devis_to_load` conservé, puis que
  l'hydratation se fait après `openPoste` (panier + mode modification).

## 2026-10-09 — 🐛 Crash `gooeyToast.loading` (méthode supprimée de goey-toast)

- **Symptôme** : « Charger en facturation » (rappel devis depuis Ventes) ne
  faisait rien — `TypeError: (intermediate value).loading is not a function`
  avant `navigate`. Idem pour ticket/duplication/avoir depuis Ventes, relevé/
  export Excel créances, import pack/CSV en facturation.
- **Cause** : `goey-toast` n'exporte plus `.loading()` ; seuls
  `success/error/warning/info/promise/dismiss/update` existent.
- **Fix** : les 8 appels `gooeyToast.loading(msg)` → `gooeyToast.info(msg,
  { duration: Infinity })` — l'id retourné permet toujours
  `gooeyToast.dismiss(id)` et le remplacement via `{ id: toastId }` sur
  `success`/`error`.
- Fichiers : `useInvoiceActions.tsx` (×4), `useCreanceActions.ts` (×2),
  `useFacturationImport.ts` (×2).

## 2026-10-09 — 💄 Menu d'actions de sélection migré vers shadcn DropdownMenu

- **Avant** : dropdown « Actions » des sélections en masse = `<ul><li><a>`
  custom (click-outside et clavier gérés à la main, items plats, pas de
  portal → risque de clipping dans les `overflow`, look DaisyUI).
- **`ui/SelectionHeader.tsx`** : le `<ul>` maison est remplacé par
  `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent` shadcn
  (Radix) — focus trap, navigation clavier, fermeture Échap/clic extérieur
  et positionnement via portal gérés nativement. Le composant attend
  désormais des primitives `DropdownMenuItem` en `actions`.
- **`sales/SalesTable.tsx`** (`BulkActionsMenu`) : items convertis en
  `DropdownMenuItem`/`DropdownMenuLabel`/`DropdownMenuSeparator`
  (`onSelect` Radix au lieu de `onClick` + keydown maison), classes
  mutualisées (`menuItemClass`, `menuItemDangerClass`).
- **`Clients.tsx`** : item bulk-delete converti de la même façon.
- Le séparateur avant « Supprimer » passe par `DropdownMenuSeparator`.

## 2026-10-09 — 🔢 Numérotations DEV- / FAC- indépendantes (séquences dédiées)

- **Problème** : `DEV-XXXXXX` et `FAC-XXXXXX` étaient dérivés de l'`id` de
  la facture → un devis jamais converti laissait un **trou** dans la
  numérotation FAC, et un devis converti tardivement recevait un numéro
  **antérieur** aux factures validées entre-temps (ordre chronologique
  cassé — problème fiscal de numérotation séquentielle).
- **Nouveau** `DocumentCounter` (modèle + migration `0271`) : compteur par
  préfixe, verrouillé `select_for_update` → incréments sérialisés, pas de
  doublon (renforcé par `numero_facture unique=True`). Amorcé sur le max
  des numéros existants (`DEV=25489`, `FAC=25488` en dev).
- **`next_document_number(prefix)`** dans `models/billing.py` —
  `transaction.atomic` intégré (utilisable depuis un signal post_save hors
  transaction comme dans `finalize_sale`).
- **Devis** : signal `auto_generate_devis_number` → prochain `DEV-` de la
  séquence devis (au lieu de `DEV-{id}`).
- **Factures** : `sale_validator` → prochain `FAC-` de la séquence factures
  à la validation (au lieu de `FAC-{id}`). Un devis converti prend le
  numéro **suivant** en date réelle — chronologie respectée.
- **Tests** `test_facturation_contract.py` : conversion vérifie
  FAC-converti > FAC émise entre-temps ; nouveau test
  `test_devis_and_facture_have_own_numbering` (DEV-000001/2, FAC-000001
  indépendants des ids). 45/45 OK (contract + facturation).

## 2026-10-09 — ✨ Devis sans gestion de lots + conversion devis → facture sécurisée

- **Décision métier** : un devis ne gère **pas** les lots — aucun déstockage
  n'a lieu à sa création, le lot sera choisi (ou alloué en FEFO) lors de la
  conversion en facture. Plus simple et évite le problème des lots qui
  bougent entre le devis et le retour du client.
- **`useFacturationActions.handleProforma`** : `stock_lot`/`lot_allocations`
  retirés du payload `facture-produits/bulk_create/` — les lignes de devis
  ne portent plus de lot.
- **`useDevisLoader.ts`** : au rappel d'un **devis** (PROF), les lots ne sont
  plus restaurés (`lotId: null` → AUTO/FEFO à la conversion). La restauration
  ne concerne plus que le rappel d'une **facture validée** (VAL/PAY), avec
  contrôle de disponibilité — lot encore présent, `quantity_remaining`
  suffisant, non expiré — sinon AUTO + toast `messages.devis_lots_unavailable`
  (fr/en) au lieu d'échouer sur « Stock insuffisant dans le lot » (400).
  Le fallback `p.lot` (nom mis dans `lotId`, champ qui attend un id) supprimé.
- **`sale_finalizer._update_existing_facture`** :
  `select_for_update()` + garde de statut — seuls `BROUILLON` et `PROFORMA`
  peuvent être re-finalisés. Avant, un `existing_id` forgé sur une facture
  validée aurait supprimé/recréé ses lignes et décrémenté le stock une
  seconde fois ; et deux conversions simultanées du même devis pouvaient
  se chevaucher (race).
- **Tests** `test_facturation_contract.py` (+4, 12/12 OK) :
  conversion en place DEV→FAC (lignes remplacées pas dupliquées, stock
  décrémenté une fois, quantité modifiée au retour), lot explicite réalloué
  à la conversion, double conversion rejetée, `existing_id` sur facture
  validée rejeté (400).

## 2026-10-09 — ✨ Résultats de recherche produit unifiés (style mobile)

- **Objectif** : reproduire partout le rendu compact des résultats de recherche
  de `mobile-facturation` (`ProductRow`) : nom lisible selon stock
  (gras / gris si 0 / rouge si <0) + **une seule ligne meta**
  `CIP · rayon · stock coloré · prix`.
- **Nouveau** `components/common/ProductSearch/ProductResultRow.tsx` :
  - `ProductResultContent` : nom + ligne meta compacte (stock en vert si >0,
    rouge si <0, « Épuisé » gris si 0, prix en gras émeraude) ; slots
    `badges`, `extraMeta`, `showPrice`.
  - `ProductResultRow` : ligne complète cliquable (wrapper + slot `right`,
    `itemProps` de navigation clavier, états `active`/`blocked`).
- **`ProductSearch` partagé** (`index.tsx`) : `renderProductItem` délégué à
  `ProductResultRow` → nouveau rendu propagé d'un coup à **Facturation,
  Commandes, Promotions, Inventaire, Avoirs** (badges conservés).
- **Dropdowns custom migrés** :
  - `Transformations.tsx` (autocomplete source/destination) — avatar et
    séparateurs remplacés par `ProductResultRow` (+ chevron en `right`).
  - `ClientCreditForm.tsx` (avoirs clients) — `<li>` texte seul →
    `ProductResultRow` (stock + prix désormais visibles).
  - `CatalogDCIAddModal.tsx` — lignes checkbox → `ProductResultContent`
    (forme galénique en `extraMeta`, badge « déjà lié » conservé).
  - `OmnisearchResults.tsx` — section produits → `ProductResultContent`
    (`showPrice=false`, badge prix à droite conservé, stock maintenant
    affiché).
- **i18n** : clé `facturation:search.out_of_stock` ajoutée fr (« Épuisé ») /
  en (« Out of stock ») — elle était utilisée avec `defaultValue` mais absente
  des locales.
- **Bonus lint** : 3 erreurs pré-existantes corrigées dans
  `ClientCreditForm.tsx` (import `cn`, `err` et `index` inutilisés).
- Vérifs : `tsc --noEmit` propre, eslint propre sur les 6 fichiers,
  vitest 20/20 (Facturation, Commandes, Avoirs, useProductSearchIndex).

## 2026-10-09 — 🐛 Toast « connexion perdue » ne disparaissait pas au retour réseau

- **Symptôme** : coupure réseau → toast rouge persistant « Connexion réseau
  perdue » ; au retour du réseau, le toast vert « rétablie » s'affichait mais
  le rouge restait collé à l'écran.
- **Cause** (`services/api.ts`) : le toast `'offline-warning'` est créé avec
  `duration: Infinity` mais le handler `online` ne le fermait jamais (il ne
  resettait que le flag + affichait le toast de succès).
- **Fix** : `gooeyToast.dismiss('offline-warning')` +
  `gooeyToast.dismiss('network-error')` dans le listener `online`
  (le toast `'network-error'` de l'intercepteur est déjà fermé au premier
  succès de requête — le dismiss couvre le cas `offline`→`online` direct).
- ESLint propre. Déployé via `deploy.ps1 -Target frontend`.

## 2026-10-09 — ⚡ Cache : verrou anti-stampede (SET NX) sur les endpoints chauds

- **Nouveau helper `cache_get_or_wait` / `cache_get_or_compute` /
  `CacheGuard`** (`cache_utils.py`) : sur miss, le premier worker prend un
  verrou atomique `cache.add` (SET NX, token UUID) et calcule ; les autres
  attendent le remplissage (backoff exponentiel + jitter, 3s max) puis
  relisent le cache. À timeout → calcul quand même (le service prime sur la
  déduplication). Release token-guarded (pas de double-release après
  expiration du verrou). Testé : 8 threads concurrents → 1 calcul, 7 hits.
- **Recâblage** : `SimpleListCacheMixin.list` (factures, clients, commandes),
  `CachedSearchMixin.list` (produits — 3 branches fusionnées en 1),
  `ClientDebtCache.get_cached_debt_or_compute` (+ `check_unpaid_invoices`),
  `DashboardCache.get_or_wait` sur les 5 endpoints lourds (stats,
  stats_heavy, manager_stats, hourly_traffic, revenue_chart),
  `CommandeViewSet.list` (cache inline).
- **Bug bonus corrigé** : la clé du cache de recherche produits ignorait la
  pagination — la page 2+ d'une recherche renvoyait les résultats cachés de
  la page 1 pendant 60s.
- Fichiers : `cache_utils.py`, `cache_mixins.py`, `dashboard_cache.py`,
  `views/clients.py`, `views/dashboard/core.py`,
  `views/commandes/commandes.py`. Backend redémarré en dev.
- Tests : 51/51 (`test_facturation` + `test_creances`) et 46/46
  (`test_dashboard` + `test_dashboard_optimization` + `test_client_financials`).

## 2026-10-09 — ⚡ Cache : correctifs hit-rate et trous d'invalidation

- **`CachedSearchMixin` — clé `product_filters` non déterministe** : la clé
  utilisait `hash(frozenset(...))`, randomisé par processus → les 4 workers
  uvicorn généraient 4 clés différentes pour les mêmes filtres (~25% de hit
  rate + clés mortes dans Redis). Remplacé par
  `SearchCache._generate_cache_key` (md5 déterministe).
- **Trou d'invalidation `product_filters:*`** : `invalidate_all_products`
  (appelé par les signaux vente/commande/ajustement) ne vidait pas le cache
  des listes filtrées → stock périmé servi jusqu'à 60s. Ajout du pattern
  dans `invalidate_all_products` (`cache_utils.py`).
- **`SimpleListCacheMixin._build_cache_key`** : clé = path + query string
  brute → `?a=1&b=2` et `?b=2&a=1` créaient 2 entrées. Params désormais
  triés + hash md5 (clé stable et bornée).
- **`factures_list:*` jamais invalidé hors `perform_*`** : les flux
  Caisse/SalesService (validation, encaissement) ne passaient pas par le
  mixin → liste des factures périmée jusqu'à 60s après paiement. Ajout de
  `delete_pattern('factures_list:*')` dans `invalidate_cache_on_facture_save`
  (VAL/PAY).
- Fichiers : `api/cache_mixins.py`, `api/cache_utils.py`,
  `api/cache_invalidation.py`. Backend redémarré en dev.
- Tests : 32/32 `test_facturation` OK. Reste à faire (non urgent) :
  `transaction.on_commit` pour les invalidations, versioned keys (INCR au
  lieu de SCAN), anti-stampede, code mort (`prod_detail`, `CacheMonitor`).

## 2026-10-09 — 🐛 Devis/proforma : 500 sur `POST /api/factures/` (float − Decimal)

- **Symptôme** : création d'un devis (proforma) → `TypeError: unsupported
  operand type(s) for -: 'float' and 'decimal.Decimal'` dans
  `get_reste_a_payer` → HTTP 500. La facture était quand même créée en base
  (risque de doublons si l'utilisateur retente).
- **Cause** : les `DecimalField` de `Facture`/`FactureProduit` avaient des
  défauts Python `float` (`default=0.00`). Sur une instance fraîchement
  créée (avant rechargement BDD), `total_ttc` restait `0.0` — le serializer
  faisait `0.0 - Decimal('0.00')`.
- **Fix** :
  - `models/billing.py` : défauts passés en `Decimal('0.00')` / `Decimal('19.25')`
    (remise, tva, montant_fidelite, total_ht/tva/ttc, montant_verse,
    montant_rendu, discount). Pas de migration : valeurs identiques pour
    l'autodétecteur (`0.00 == Decimal('0.00')`).
  - `serializers/billing.py` : `get_reste_a_payer` (×2 : FactureSerializer,
    CreanceSerializer) et `get_part_assurance` coercent `total_ttc` via
    `Decimal(str(...))` — défensif pour toute autre source de float.
- **Passe globale** : même correction des défauts `float` → `Decimal` sur tous
  les `DecimalField` restants : `stock.py` (1), `products.py` (5),
  `settings.py` (10), `orders.py` (4), `comptabilite.py` (2),
  `inventory.py` (1), `clients.py` (6).
- Migration `0270` générée : 5 `AlterField` **no-op SQL** (uniquement les
  défauts non représentables en binaire : `655.957`, `1.35`, `1.34`, `0.70` ;
  `0.00 == Decimal('0.00')` pour l'autodétecteur). Vérifié via `sqlmigrate`.
- Vérifié en shell Docker : `Facture(status='PROF')` sérialisée sans erreur,
  `reste_a_payer` correct aussi avec `total_ttc` float forcé.
  Tests : 23/23 (`test_creances`, `test_caisse_multi_payment`).

## 2026-10-08 — 🧠 Facturation : re-saisie d'un même libellé — fusion FEFO au lieu de N lignes

- **Symptôme** : saisir/scanner le même produit plusieurs fois affichait N lignes
  sur le **même lot** dès que le produit avait des prix par lot.
- **Cause** : `useCart.addProduit` ne fusionnait que les lignes **sans lot** ;
  chaque ajout créait une ligne neuve sur `autoAllocations[0]` (1er lot FEFO).
- **Nouveau comportement** (`useCart.ts`) : l'unité va au 1er lot FEFO ayant
  encore de la capacité compte tenu du panier (`inCartByLot` agrège
  `lotAllocations`/`lotId` des lignes du produit) :
  - ligne existante sur ce lot → **+1** (avec resync de `lotAllocations[0].quantity`) ;
  - lot saturé → nouvelle ligne sur le **lot suivant** (prix de lot propre) ;
  - sans prix de lot → +1 sur la ligne existante, lot manuel éventuel conservé
    (avant : créait une ligne sans lot dupliquée) ;
  - lignes `isPromis` et répartitions multi-lots jamais fusionnées ;
  - tous les lots engagés → +1 quand même, le flux promis/force au checkout
    reste l'autorité finale.
- Le modal de répartition auto (`needsLotModal`/`onMultiLotDetected`) est
  supprimé : la bascule de lot se fait désormais en silence pendant le scan.
  Le modal reste disponible via le bouton lot de la ligne et le dépassement
  de quantité en édition manuelle.
- Bonus : suppression de la prop `position` invalide dans les options
  `gooeyToast` (`useCart.ts`, `LicenceNotifications.tsx` ×3) — ignorée par la
  lib (position = prop du `<GooeyToaster>` global, déjà top-center) ;
  remplacé `style` par les options réelles (`borderColor`/`borderWidth`/
  `fillColor`) pour le toast d'interaction.
- Fichiers : `hooks/useCart.ts`, `hooks/useFacturationState.ts`,
  `components/LicenceNotifications.tsx`,
  `hooks/__tests__/useCart.test.tsx` (+5 tests : fusion même lot, bascule
  lot suivant, sans prix de lot, lot manuel, ligne promis).
- Tests : 11/11 useCart, 13 Facturation/CartTable OK, eslint propre.

## 2026-10-08 — 🐛 Vente doublée à la caisse par double-Entrée dans le modal sudo

- **Symptôme** : deux Entrées rapides dans « Validation vendeur » (envoi à la
  caisse) créaient deux factures identiques en caisse — reproduit 2× en test.
- **Chaîne causale** : `SudoValidationModal.handleConfirm` n'avait aucune
  garde → 2 `verify_password` en vol ; `verify_password` étant coûteux (hash
  PBKDF2), le 2ᵉ pouvait résoudre **après** la fin de la vente #1 → tous les
  verrous relâchés (`validatingRef`, `inFlightRef`, `saleInProgressRef`) ; le
  callback `sudoState.onValidate` capturait `handleCompleteSale` d'une render
  passée → panier figé non vide → `completeSale` avec **nouvelle clé UUID**
  → doublon (la clé étant régénérée par appel, le backend ne dédoublonnait pas).
- **Fix — 4 couches** :
  1. `SudoValidationModal` : verrou synchrone `confirmInFlightRef` dès le haut
     de `handleConfirm` (+ check `saving`) — le 2ᵉ Enter ne lance même plus
     `verify_password`. Couvre tous les écrans (facturation, inventaire,
     commandes, avoirs, périmés, fournisseurs, créances, caisse…).
  2. `useFacturationState` : `requestInFlightRef` couvrant aussi les appels
     **avec** credentials (le verrou existant ne filtrait que les appels sans).
  3. Clé d'idempotence **déterministe** = hash du contenu du panier
     (`lineId` = UUID par ligne + quantités/prix/remises/total/client) — une
     re-soumission du même panier réutilise la même clé → le backend renvoie
     la réponse en cache ; une vraie vente suivante a d'autres `lineId`.
  4. `idempotency.py` : verrou atomique `cache.add` (SETNX) + sentinel
     « en cours » (TTL 60 s) — deux requêtes concurrentes à même clé ne
     s'exécutent plus en parallèle (fenêtre TOCTOU fermée) ; le sentinel est
     libéré sur échec/exception pour autoriser le retry.
- Fichiers : `SudoValidationModal.tsx`, `useFacturationState.ts`,
  `useSaleCompletion.ts`, `types/finance.ts`, `backend/api/idempotency.py`.
- Tests : 23/23 backend OK (cash_payment_edges, facturation_contract,
  stock_realtime), lint/tsc propres, Facturation.test 3/3.

## 2026-10-08 — 📡 Stock temps réel : « recharge invisible » via WebSocket

- **Problème** : le stock affiché ne se mettait jamais à jour sans F5 —
  l'index de recherche en mémoire (`useProductSearchIndex`, préchargé ~5 min)
  alimente caisse, commandes, transformations, avoirs et inventaire ; React
  Query ne se rafraîchit qu'au montage/focus. Conséquence terrain : « stock
  OK à la recherche, rupture à la validation » sur un autre poste.
- **Backend** : nouveau `ws/stock/` (`StockUpdateConsumer`, groupe
  `stock_updates`, auth requise → close 4001) + helper
  `services/realtime.py::notify_stock_changed(ids)` qui diffuse en
  `transaction.on_commit` les compteurs post-commit
  `{type:'stock_update', produits:[{id,stock,stock_reserve}]}` — jamais
  bloquant (try/except).
- **Câblage** : ~15 points d'écriture du compteur — vente
  (`sale_validator`, chaud : caisse web + mobile + POS), annulation/
  modification, réception + annulation (`cloture_mixin`), ajustements et
  transferts (`produit_actions/stock.py`), réappro groupée, transformations,
  avoirs (décharge + annulation + avoir client), promis (delivrer/annuler/
  bulk + réservation), périmés, inventaire, import produits, obligations
  (`resolve`/`cancel`/`reapply`), `lot_allocation_service`.
- **Frontend** : `useStockRealtime` (monté en zone authentifiée de
  `App.tsx`, token DRF en query string, ping 30s, reconnexion 3s, pas de
  boucle sur refus 4001). Sur `stock_update` : (a) `patchSearchIndexStock`
  mute en place les entrées de l'index + `indexVersion`
  (`useSyncExternalStore`) → les résultats affichés se rafraîchissent sans
  recharger l'index ; (b) patch instantané des caches React Query
  (détail `['produit',id]` + listes) ; (c) invalidations debouncées 500ms →
  refetch silencieux des queries actives.
- **Limite** : la fenêtre de course tombe à ~1s ; le contrôle à la
  validation reste l'autorité finale. Non couvert : stocks des proforma
  en attente d'encaissement (quantités non encore engagées).
- **Mobile** : souscription `ws/stock/` notée en P1 dans
  `mobile-facturation/SUIVI.md` (périmètre ultérieur).
- **Tests** : `test_stock_realtime.py` (3 tests : broadcast vente,
  broadcast ajustement, ids vides ignorés). 90 tests backend OK,
  9 tests vitest index OK, `tsc`/`eslint`/`build` propres.
- Fichiers : `backend/api/{consumers.py,routing.py,services/realtime.py,
  tests/test_stock_realtime.py}` + ~15 sites d'émission ;
  `frontend/frontend/src/{hooks/useStockRealtime.ts,
  hooks/useProductSearchIndex.ts, hooks/useProductSearch.ts, App.tsx,
  hooks/useProductSearchIndex.test.ts}` ; `mobile-facturation/SUIVI.md`.

## 2026-10-08 — 🧹 Historique produit : suppression de la ligne « Résolution dette » parasite

- Constaté en test réel (PROLIFE MAGNESIUM) : la résolution d'une dette
  PROMIS/FORCE à la réception créait un `MouvementStock` AJUSTEMENT de
  **quantité 0** dont le snapshot `stock_apres` cassait la lecture chaînée
  de l'onglet MVMTS (ligne intercalée entre l'ENTREE et la vente).
- `resolve_pending_obligations` ne crée désormais un mouvement que si la
  résolution fait réellement baisser le compteur — dette **détachée**
  (`stock_applied=False`, comptage brut) : quantité `-résolu`, y compris en
  gestion par lots où le retrait passe par le recalcul depuis les lots.
  La trace métier reste assurée par `StockObligationResolution` +
  `FactureProduitAllocation`.
- Migration `0269` : purge des lignes AJUSTEMENT qty=0 « … - Promis|Vente
  forcée #N (x unité(s)) » déjà en base (dev : 1 ligne supprimée).
- Tests : `test_reception_applied_debt_creates_no_noise_movement` et
  `test_reception_detached_debt_creates_real_movement`. 105 tests
  stock/facturation OK.
- Fichiers : `backend/api/services/stock_obligation_service.py`,
  `backend/api/migrations/0269_drop_zero_qty_resolution_movements.py`,
  `backend/api/tests/test_stock_management.py`.

## 2026-10-08 — 🏷️ Commandes : signal « F » pour les ventes forcées en attente

- Le signalement promis existait déjà (`active_promis_count` → badge « P » sur
  les lignes de commande et « PROMIS (n) » dans la recherche produit), mais une
  vente forcée sans fiche Promis n'affichait rien — cas réel : produit servi
  depuis la table avant sa réception, l'entrée en stock le compense ensuite.
- Nouvelle annotation `has_pending_force` (Exists sur `StockObligation` FORCE
  EN_ATTENTE) exposée dans `ProduitListSerializer`.
- Affichage (signal simple, sans quantité, validé par le métier) : badge rose
  « F » à côté du « P » sur les lignes de commande (`CommandeProductRow`),
  badge « FORCÉ » dans les résultats de `ProductSearch`. Tooltips FR/EN.
- Vérifié : annotation OK en shell (EREKTA → True, DOLIPRANE → False), 48
  tests commandes/produits OK, `tsc` et `git diff --check` propres.
- Fichiers : `backend/api/views/produits.py`,
  `backend/api/serializers_optimized.py`,
  `frontend/frontend/src/{types/catalog.ts,components/Commandes/productTableUtils.ts,
  components/Commandes/CommandeProductRow.tsx,components/common/ProductSearch/*}`,
  `frontend/frontend/public/locales/{fr,en}/{orders,facturation}.json`.

## 2026-10-08 — ⚠️ Inventaire : alerte sur les produits avec promis/ventes forcées en attente

- L'inventaire reste « physique brut » (les dettes de stock sont détachées du
  compteur via `stock_applied=False`), mais une dette invisible pouvait être
  comptée comme vendable sans que l'opérateur s'en rende compte.
- `LigneInventaireSerializer` expose désormais `pending_promis` et
  `pending_force` (agrégat unique par requête, sans N+1) depuis
  `StockObligation` EN_ATTENTE.
- Écran d'édition d'inventaire (`InventaireDataTab`) : bandeau d'alerte ambre
  récapitulatif + badges par ligne « Promis ×N » (ambre) et « Forcée ×N »
  (rose), affichés aussi en lecture seule. Traductions FR/EN.
- Cas couvert : produit servi « sur la table » avant sa réception (FORCE) ou
  promis en attente — l'opérateur sait que ces unités comptées sont déjà dues.
- Test : `test_lignes_serializer_exposes_pending_obligations` (PROMIS+FORCE
  visibles, RESOLUE exclue). 9/9 tests inventaire OK, `tsc` propre.
- Fichiers : `backend/api/serializers/inventory.py`,
  `backend/api/tests/test_stock_inventory.py`,
  `frontend/frontend/src/types/inventory.ts`,
  `frontend/frontend/src/components/inventaire/editor/InventaireDataTab.tsx`,
  `frontend/frontend/public/locales/{fr,en}/stock.json`.

## 2026-10-08 — 🏗️ Dettes de stock explicites (`StockObligation`) : promis, ventes forcées et stock négatif

- **Règle métier validée** : un promis = quantité **payée** non remise. La
  facture porte la quantité totale, les lots ne couvrent que la part livrée,
  et `Produit.stock` descend de la quantité totale → le stock passe **négatif
  dès la validation** pour signaler visuellement le promis.
  Ex. stock 1, facture 2, promis 1 → facture 2, lot 0, stock −1, promis 1.
  Réception +2 → 1 unité couvre le promis, stock final 1.
- **Nouveau modèle `StockObligation`** (`PROMIS` / `FORCE`, quantité initiale et
  restante, `stock_applied`, emplacement `RAYON`/`RESERVE`, coût estimé) +
  `StockObligationResolution` (historique de résolution par réception/lot) +
  `FactureProduitAllocation.{stock_obligation,is_pending,resolved_commande}` +
  `Promis.quantite_livree`. Migrations `0266`, `0267`, `0268` (backfill
  prudent : promis existants rattachés ; déficit négatif inexpliqué → dette
  `FORCE` au lieu d'être effacé).
- **Service central** `services/stock_obligation_service.py` : création,
  annulation, résolution partielle (PROMIS avant FORCE, ordre chronologique),
  `reapply_pending_obligations` (ré-applique au compteur une dette détachée
  par un comptage brut avant toute vente/consommation).
- **Opérations revues** :
  - Vente (`sale_validator`) : décrément total, allocations livrées + dettes ;
    `sale_finalizer` refuse `promis_quantity > quantity`.
  - Annulation/modification (`sale_canceller`, `sale_modifier`,
    `restore_allocations`) : distinction lot livré / dette en attente / dette
    résolue, plus de double restauration.
  - Réception (`cloture_mixin`) : résout PROMIS puis FORCE puis déficit
    historique ; réception partielle réduit le reste dû ; produits sans lots
    traités ; annulation de réception rouvre exactement les obligations
    résolues par cette commande (y compris lot externe non restauré à tort).
  - Promis manuels (`promis.py`) : réservation basée sur le stock vendable,
    `delivrer` via le service, annulation réintègre rayon/réserve correctement.
  - Transferts réserve→rayon, réappro groupée : couvrent d'abord les dettes.
  - Avoir fournisseur (annulation de déchargement) : recrée un lot traçable
    pour les lignes FEFO et résout les dettes ; avoirs clients, périmés,
    transformations (la destination couvre d'abord ses dettes) et annulation
    de transformation ré-appliquent les dettes avant d'agir.
  - Signaux lots / `calculate_stock_from_lots` / `recalculate_stock_from_lots`
    : ne recalculent plus `stock = Σ lots` aveuglément — les dettes appliquées
    sont préservées. Inventaire et ajustement absolu restent « physique brut »
    et détachent les dettes (`stock_applied=False`) au lieu de les perdre.
- **Frontend/mobile** : `PromisTable` affiche livré/restant ;
  `useSaleCompletion` et le flux mobile envoient `is_promis/promis_quantity/
  promis_phone` ; badge Promis.
- **Tests** : `test_stock_management` (réception partielle, PROMIS avant FORCE,
  sans lots, annulation de réception, lot externe, promis manuel avec dette
  détachée), `test_stock_transformations` (destination avec dette),
  `test_facturation_contract`, `test_lot_allocation_service` convertis au
  nouveau contrat. Suite élargie : **281 tests OK**. `makemigrations --check` :
  aucun changement.
- **Données** : `EREKTA 50MG CP B/4` → stock −1 cohérent avec une dette `FORCE`
  de 1 (résorbée à la prochaine réception). `Dbg` (stock 102, aucun lot,
  gestion par lots activée) reste à corriger après décision métier.
- Fichiers principaux : `backend/api/models/{stock,billing,products}.py`,
  `backend/api/migrations/026{6,7,8}_*.py`,
  `backend/api/services/{stock_obligation_service,lot_allocation_service,
  sale_validator,sale_canceller,sale_modifier,sale_finalizer}.py`,
  `backend/api/views/commandes/{cloture_mixin,promis,avoirs}.py`,
  `backend/api/views/produit_actions/stock.py`,
  `backend/api/views/stocks/{stock_lots,transformations,inventaire/validation}.py`,
  `backend/api/views/ventes/client_credit.py`,
  `backend/api/management/commands/recalculate_stock_from_lots.py`,
  `backend/api/serializers/promis.py`, `backend/api/tests/*`.

## 2026-10-08 — 💄 Périmés : harmonisation UI des onglets Liste et Historique

- Les trois onglets de la page Périmés avaient des styles différents :
  seul le Dashboard utilisait les composants `Card`/`CardHeader`/`CardContent`.
- **Liste** : conteneur `div` blanc brut remplacé par une `Card` avec
  `CardHeader` (toolbar titre + filtres / actions groupées) et
  `CardContent` scrollable pour le tableau.
- **Historique** : barre de filtres `bg-slate-50` remplacée par une `Card` ;
  la carte « valorisation totale » reprend le style KPI du dashboard
  (gradient rouge + pastille icône) ; le tableau reçoit un `CardHeader`
  avec titre comme « Top produits périmés ».
- Fichier : `frontend/frontend/src/components/Perimes.tsx` (+ retrait
  d'un import `Input` inutilisé). Lint + tsc OK.

## 2026-10-08 — 🐛 Fix 500 sur la sortie groupée des périmés

- **Symptôme** : erreur 500 à la sortie groupée de lots périmés
  (`POST /api/stock-lots/bulk_sortir_perimes/`).
- **Cause** : la requête combinait `select_for_update()` et
  `select_related('produit')`. `StockLot.produit` étant un FK nullable,
  Django génère un `LEFT OUTER JOIN` et PostgreSQL refuse
  `FOR UPDATE` sur le côté nullable (`NotSupportedError`).
- **Fix** : retrait du `select_related` (inutile — seul `lot.produit_id`
  est lu, les produits sont chargés/verrouillés via `locked_products`)
  et verrou limité à la table des lots via `select_for_update(of=('self',))`.
- **Test** : nouveau test de régression `test_bulk_disposal_of_expired_lots`
  (2 lots périmés → 200, lots à 0, stock décrémenté, StockAdjustment PERIME
  et MouvementStock AVOIR créés par lot). 4/4 tests du module OK.
- Fichiers : `backend/api/views/stocks/stock_lots.py`,
  `backend/api/tests/test_expired_lot_handling.py`.

## 2026-10-08 — 🐛 Réception après découvert : cohérence stock ↔ lots

- Lorsqu'une vente sans allocation ni promis avait créé un stock négatif, la
  réception suivante calculait désormais correctement le stock global
  (`-1 + 2 = 1`), mais le nouveau lot conservait encore 2 unités disponibles.
  Le stock et la somme des lots divergeaient, permettant une future allocation
  supérieure au stock physique.
- La clôture absorbe maintenant le déficit historique non couvert par un
  `Promis` directement dans les lots nouvellement reçus, après satisfaction
  des vrais promis. Les quantités gratuites et la réserve suivent la même
  décrémentation. Les promis en attente sont déduits du déficit à absorber pour
  éviter toute double consommation.
- Test renforcé : stock `-1`, réception `2` → stock `1`, lot initial `2`,
  `quantity_remaining=1`, PMP au coût unitaire.
- Donnée corrigée : CIP `3499879` (DOLIPRANE 150MG ENF SACH/12), lot
  `CMD100-5158` : quantité restante `2 → 1`; stock global conservé à `1`.
- Vérification : 52 tests stock, commandes, facturation et finalisation réussis.
- Fichiers : `backend/api/views/commandes/cloture_mixin.py`,
  `backend/api/tests/test_stock_management.py`.

## 2026-10-07 — 📱 Promis sur mobile + déstockage réel corrigé

- `mobile-facturation` propose désormais **Promis / Réduire / Forcer** par
  produit lorsque la quantité dépasse le stock. Promis est sélectionné par
  défaut ; le téléphone est prérempli depuis le client et envoyé avec
  `is_promis`, `promis_quantity`, `promis_phone`. Forcer conserve la validation
  superviseur `can_sell_negative_stock` ; Réduire ramène la ligne au stock.
- Badge `Promis ×N` dans le panier et remise en résolution automatique après
  toute modification de quantité. Traductions FR/EN et suivi mobile mis à jour.
- Correction du backend commun web/mobile : la facture conserve la quantité
  totale, tandis que lots, stock et mouvements ne consomment que la quantité
  réellement livrée (`quantity - promis_quantity`). Avant, le contrôle de
  stock excluait le promis mais le déstockage utilisait encore la quantité
  totale, pouvant recréer un stock négatif.
- Tests de contrat ajoutés avec et sans gestion par lots (facturé 2, stock 1,
  promis 1 → facture 2, Promis 1, allocation/mouvement/stock −1 seulement).
- Fichiers : `mobile-facturation/src/{components/StockResolutionModal.tsx,
  components/CartItemRow.tsx,hooks/useSendSale.ts,services/api.ts,
  stores/useCartStore.ts,types/index.ts,i18n/fr.ts,i18n/en.ts}`,
  `backend/api/services/{sale_validator.py,lot_allocation_service.py}`,
  `backend/api/tests/test_facturation_contract.py`,
  `mobile-facturation/SUIVI.md`.

## 2026-10-07 — 🐛 Fix PMP corrompu par ventes à découvert (marge 04/10 : 14% → 26%)

- **Symptôme** : marge dashboard du 04/10 affichée à 13,5 % alors que les prix
  d'achat/vente étaient corrects — réelle : ~26 %.
- **Cause** : `CommandeClotureMixin.cloturer` calculait
  `new_pmp = (old_stock × old_pmp + cout_total) / (old_stock + qté_reçue)`.
  Après une **vente à découvert sans promis** (ex. vente mobile, qui ne gère
  pas les promis) `old_stock` est négatif : `(-1 × 0 + 2 × 1567) / (-1 + 2)`
  donnait un PMP de **3134 au lieu de 1567** (coût total de ligne au lieu du
  coût unitaire). Les ventes sans allocation lot retombent sur le PMP → marges
  écrasées (−49 % sur SPASFON, SMECTA, PAIDOFEBRIL le 04/10).
- **Fix PMP** (`cloture_mixin.py`, 2 branches) : quand le stock pré-réception est
  ≤ 0, le reliquat provient entièrement de la réception → `pmp = effective_cost`.
- **Fix resync stock** (`cloture_mixin.py`) : le recalcul
  `stock = somme(quantity_remaining des lots)` écrasait le découvert
  (vente à stock négatif sans promis) : stock −1 + réception 2 donnait 2.
  Désormais `stock = min(compteur incrémental, somme lots)` — le déficit
  persiste (et les satisfactions de promis restent gérées via `qr` des lots).
  Même garde pour `stock_reserve`.
- **Données corrigées** : 4 PMP doublés → `cost_price` (SPASFON B/30, SMECTA
  B/30, PAIDOFEBRIL, DOLOWIN 100MG) ; 4591 produits `pmp=0` avec `cost_price>0`
  → `pmp = cost_price` (dont EREKTA, qui gonflait la marge à +100 %/ligne) ;
  stock 2→1 + `quantity_remaining` du lot 2→1 sur SPASFON/SMECTA/PAIDOFEBRIL
  (unité du 04/10 déjà livrée au client, confirmé pharmacien) + mouvement
  AJUSTEMENT de traçabilité.
- **Tests** : 3 tests de régression dans `PMPCalculationTestCase`
  (`test_pmp_correct_with_negative_stock`,
  `test_pmp_correct_second_line_still_negative`,
  `test_negative_stock_preserved_by_lot_resync`).
- Fichiers : `api/views/commandes/cloture_mixin.py`,
  `api/tests/test_stock_management.py`, données `Produit.pmp`.

## 2026-10-07 — 📱 PDA Inventaire : login au modèle mobile-facturation

- **PDA Inventaire** : refonte du login sur le modèle `mobile-facturation`.
  Connexion par **URL serveur + mot de passe seul** (le backend identifie
  l'utilisateur via `/api/auth/token/` avec `workstation: 'PDA Inventaire'`).
- Nouveau store Zustand `useAuthStore` : persistance du token, username et
  `serverUrl` dans `expo-secure-store` ; `restoreSession` au boot.
- `api.ts` : `baseURL` et token lus depuis le store à chaque requête ;
  déconnexion automatique sur 401 via le store (plus de callback global).
- `src/services/inventaire.ts` : retrait du préfixe `/api` des endpoints
  (déjà présent dans `baseURL` du store), corrige les 404 au chargement
  des inventaires après connexion.
- **Sync par batches** : `useOfflineSync` envoie désormais les lignes
  offline par paquets de 50 (`BATCH_SIZE`) pour éviter les timeouts sur
  les gros inventaires. `SyncBanner` affiche la progression
  (`current/total`) pendant l'envoi.
- **Retry réseau** : chaque batch est retenté jusqu'à 3 fois (1 s, 2 s)
  en cas d'erreur réseau/timeout ou 5xx ; les erreurs 4xx n'ont pas de
  retry.
- **Sync partielle** : si un batch importe partiellement, les lignes
  sans erreur sont marquées synchronisées et seules les lignes en échec
  (indexées par le backend) restent en attente.
- **Catalogue incrémental** : `GET /api/produits/?updated_since=<ISO>`
  (nouveau filtre viewset) + nouvel endpoint `GET /api/produits/stocks/`
  renvoyant `{stocks: [{id, stock, stock_reserve}], server_time}`.
  `produitService.syncCatalog()` : produits modifiés depuis le curseur
  serveur + snapshot stocks (couvre les changements de stock qui ne
  bumpent pas `updated_at` via `save(update_fields)`, et purge du cache
  les produits désactivés). Le curseur de sync est le `server_time`
  backend, pas l'horloge PDA. Fallback : download complet au premier
  appel.
- **Changement de pharmacie** : le login compare l'URL saisie à
  `pda.session.lastServerUrl` (écrite uniquement au login réussi) ; si
  différente → purge du cache produits (`productCacheService.clear()`)
  et des lignes offline (`localStorageService.clearAll()`), sinon les
  `id` produits des deux serveurs seraient mélangés. Alerte de
  confirmation si des lignes non synchronisées vont être perdues
  (`Alert` natif, `window.confirm` sur web).
- **Bouton « Purger »** sur l'accueil (barre catalogue) : vide le cache
  produits + lignes offline manuellement — couvre le cas (rare mais
  réel) de deux pharmacies à IP identique, et sert de reset debug.
  Utilitaire partagé `src/utils/confirmDialog.ts`.
- **Fix faux positif changement de serveur** : `normalizeServerUrl`
  (casse, slash, scheme, port par défaut) pour toutes les comparaisons
  d'URL ; `restoreSession` initialise `lastServerUrl` depuis la session
  restaurée (sinon premier login après migration = fausse purge). Le
  cache produits est désormais lié à l'URL (`synced_server_url`) :
  `syncCatalog` force un download complet si l'URL courante diffère.
- **Suppression d'inventaire** : long-press sur une carte de l'accueil →
  confirmation (mention des lignes locales non envoyées) → `DELETE
  /inventaires/{id}/` (soft-delete existant) + purge des lignes offline
  locales de cet inventaire.
- **Bouton « Téléverser »** dans le header du scanner (visible quand des
  lignes sont en attente) : envoie les lignes offline sans quitter
  l'écran. Le bouton « Terminer » est renommé « Retour » — quitter est
  déjà une « pause » (l'inventaire reste EN_COURS, lignes conservées).
- **Export CSV retiré** : bouton, `handleExport`, `services/export.ts`,
  clés i18n `export_*` et dépendance `expo-sharing` (package.json +
  plugin app.json) supprimés — non utilisé sur le PDA.
- **Idempotence téléversement offline** : `@idempotent_action` sur
  `POST /inventaires/{id}/lignes/bulk/` (décorateur existant, header
  `Idempotency-Key`, réponse cachée 24 h dans Redis). Le PDA génère un
  `batch_id` par batch AVANT la boucle retry → une coupure réseau après
  traitement serveur mais avant réception rejoue la réponse au lieu de
  doubler les quantités (`mode: 'add'` non idempotent sinon). Testé en
  conteneur : même clé → quantité inchangée, sans clé → doublon.
- Internationalisation FR/EN avec `i18next` + `react-i18next` +
  `expo-localization` : traduction complète du login, Home, Scanner et
  composants associés. Sélecteur de langue sur l'écran de connexion,
  langue persistée dans `secureStore`.
- UI alignée sur le design system existant (`theme.ts`) : fond slate,
  accents emerald, cartes arrondies.
- Fix Home : bouton déconnexion remplacé par un label texte "Déco"
  (l'icône unicode ne s'affichait pas sur certains appareils) ; padding
  haut du header augmenté pour éviter que le contenu touche le status bar.
- Suppression de `src/services/auth.ts` et nettoyage des clés de stockage
  obsolètes (`STORAGE_KEYS.AUTH_TOKEN`, `STORAGE_KEYS.USER_INFO`).
- Fichiers : `package.json`, `App.tsx`, `src/screens/LoginScreen.tsx`,
  `src/screens/HomeScreen.tsx`, `src/screens/ScannerScreen.tsx`,
  `src/services/api.ts`, `src/config/index.ts`,
  `src/stores/useAuthStore.ts`, `src/stores/useSettingsStore.ts`,
  `src/i18n/{index.ts,fr.ts,en.ts}`,
  `src/components/scanner/{Header,ScannerInput,ProductCard,EditLineModal,RecentScans,ScanModeToggles,SyncBanner}.tsx`.

## 2026-10-06 — 📱 Mobile : entrée en stock (liste → clôture web)

- **Mobile-facturation** : nouvel écran `EntreeStockScreen` (carte
  « Entrée en stock » sur l'accueil). Le mobile prépare la **liste de
  réception** ; l'entrée en stock effective reste la **clôture web**
  (inchangée). Fournisseur **obligatoire** avant téléversement, choisi
  dans un **menu déroulant** (`FournisseurPickerModal` — liste complète
  `/fournisseurs/` + filtre local).
- Saisie **produit par produit** comme pda-inventaire : recherche
  débouncée ou scan (caméra/douchette). Scan **datamatrix GS1** aligné
  sur le web (`useDataMatrixScanner`) : lot + expiration extraits du
  code remplissent la **ligne existante sans lot** du produit ; même
  produit + même lot → incrémente ; nouveau lot → ligne préremplie
  (pas via `/stock-lots/by-datamatrix/` — le lot reçu n'existe pas
  encore en stock) ; résolution produit par CIP (`by-cip`) + détail.
- `EntreeStockLineModal` : fiche ligne préremplie au dernier prix
  d'achat (`cost_price`), TVA, coefficient de marge et prix de vente ;
  **champs liés** identiques au web (`useCommandeProductLines`, type
  LOC) : achat/marge/TVA → `PV TTC = round(achat × marge × (1+tva/100))`,
  vente → marge recalculée. **TVA en menu déroulant** (taux configurés
  `GET /tva/`, ex. 0 / 19.25). Quantité, unités gratuites, lot et
  expiration MM/AA éditables ; produits `use_lot_management` signalés.
- Store `useEntreeStockStore` + brouillon persisté par vendeur
  (`draft.entree.<user>`, kv-store) : une longue réception survit à la
  fermeture de l'app.
- **Réceptions en attente** (`usePendingEntreeStore` +
  `PendingEntreeModal`, kv-store `pending.entree.<user>`, max 30) :
  icône pause en en-tête pour mettre de côté la réception courante,
  icône horloge + badge pour rouvrir la liste — **reprendre** (remplace,
  avec confirmation si la liste courante est remplie) ou **fusionner**
  (quantités additionnées par couple produit+lot, fournisseur/commande
  courants conservés). L'id de commande déjà créée est conservé dans la
  mise en attente → la reprise re-synchronise sur la même commande.
- **Téléversement** : `POST /commandes/` (LOC, `PREP`) puis
  `POST /commande-produits/bulk_sync/` — endpoint existant, **aucun
  changement backend**. La commande apparaît « En préparation » sur le
  web pour vérification puis clôture (stocks, lots, PMP inchangés).
  Retry sûr : l'id de commande est conservé — un second envoi
  re-synchronise la même commande (bulk_sync = remplacement total).
- **Mobile — produit manquant : purge de la liste** : bouton « Vider »
  dans l'en-tête « Derniers signalements » (visible dès qu'un signalement
  traité existe, confirmation système) → nouveau endpoint
  `DELETE /signalements-besoins/vider/` qui supprime les signalements
  `INTÉGRÉ`/`IGNORÉ` et conserve les `NOUVEAU` en attente.
  `besoins.py`, `api.ts`, `SignalementScreen.tsx`, fr/en.
- **Fix web (stocks avant/après réception — bon + onglet MVMTS)** :
  la clôture resynchronise `stock = somme(lots)` pour les produits
  gérés par lot, ce qui **corrige silencieusement un stock négatif
  dérivé** (ex. vente forcée → stock -1, lots à 0 → réception de 2
  affichait `0→2` au lieu de `-1→+2→1`). Trois corrections :
  - **Bon de réception** (`printHelpers.ts`) : « avant » = vrai stock
    pré-réception (nouveau champ `produit_stock_avant_reception` =
    dernier `MouvementStock` avant clôture, négatif affiché tel quel) ;
    « stock actuel » = formule demandée `avant + reçu + UG` (fallback
    déduit du snapshot si pas d'historique).
  - **Serializer** (`orders.py`) : `CommandeSerializer.to_representation`
    injecte `produit_stock_avant_reception` par ligne pour les commandes
    `CLOT` (une sous-requête corrélée indexée, pas de N+1).
  - **Onglet MVMTS produit** (`produit_actions/stock.py`) : l'historique
    n'écrase plus `stock_apres` avec la chaîne recalculée depuis le
    stock actuel — le **snapshot réel** du mouvement est affiché quand
    il existe (les ventes forcées affichent désormais leur vrai
    `0 → -1`). Lignes sans snapshot (pseudo-lignes VENTE, vieilles
    données) : recalcul chaîné conservé.
- Fichiers : `src/screens/EntreeStockScreen.tsx`,
  `src/components/EntreeStockLineModal.tsx`,
  `src/stores/useEntreeStockStore.ts`, `src/services/api.ts`
  (`searchFournisseurs`, `createEntreeCommande`, `syncCommandeProduits`),
  `types/index.ts` (`Fournisseur`, `EntreeStockLine`, `cost_price`/
  `taux_marge` produit), `App.tsx`, `HomeScreen.tsx`, `theme.ts`
  (accent `info`), i18n FR/EN (`entree.*`, `home.menu_entree*`).

## 2026-10-06 — 📱🖥️ Signalement « produit manquant » (terrain → commande)

- **Backend** : nouveau modèle `SignalementBesoin` (produit, quantité,
  note, utilisateur, statut NOUVEAU/INTEGRE/IGNORE) + migration `0265`
  + `SignalementBesoinViewSet` (`/api/signalements-besoins/`, actions
  `integrer/`/`ignorer/`). Distinct volontairement de
  `RuptureFournisseur` (indisponibilité chez le grossiste ≠ manque en
  rayon).
- **Mobile** : écran `SignalementScreen` (carte « Produit manquant » sur
  l'accueil) — scan/recherche, quantité + note optionnelles, liste des
  derniers signalements avec badge de statut.
- **Web** : `SuggestionCommandeModal` charge les signalements NOUVEAU —
  badge violet « DEMANDÉ TERRAIN » sur les produits déjà suggérés,
  lignes ajoutées en fin de liste pour ceux que l'analyse n'a pas
  recommandés ; les signalements des produits partant en commande
  passent `INTEGRE` automatiquement.
- Traductions FR/EN (mobile `signalement.*`, web `orders:suggestion_modal`).

## 2026-10-06 — 📱 Mobile : écran d'accueil avec menu

- Nouveau `HomeScreen` = point d'entrée post-login : bascule FR/EN,
  déconnexion (avec confirmation), nom du vendeur + poste actif, et
  menu en cartes : **Vente** / **Ajustement de stock** / **Tableau de
  bord**.
- `FacturationScreen` allégé : langue, ajustement, dashboard et
  déconnexion déplacés vers l'accueil ; l'en-tête ne garde que les
  actions de vente (en attente, historique, PIN, mise en attente,
  annuler) + retour accueil.

## 2026-10-06 — 📱 Mobile : ajustement de stock par lot

- Nouvel écran `AjustementScreen` : recherche ou scan (caméra/datamatrix,
  `resolveBarcode` réutilisé), retrait/ajout avec motif (standards +
  personnalisés `configuration-options?type=STOCK_ADJ`), détail libre.
- **Ajustement par lot** : pour les produits `use_lot_management`, la
  sélection du lot est **obligatoire** — le stock global est reconstitué
  depuis le delta du lot (parité backend : produit et lot bougent de la
  même quantité), jamais corrigé globalement. Création d'un nouveau lot
  possible (n° + expiration MM/AA → `new_lot_number`/`new_lot_expiration`).
  Produits non gérés par lot : ajustement global classique.
- `api.ts` : `getStockAdjustmentReasons()`, `adjustStock()` →
  `POST /produits/{id}/adjust_stock/` (endpoint existant, aucun
  changement backend). Stock **et** lot relus juste avant l'envoi pour
  calculer les quantités cibles + `Idempotency-Key`.
- Permission `can_adjust_stock` : si le vendeur ne l'a pas → `SudoModal`
  existant puis rejeu avec `validated_by_id` + `sudo_password`
  (`validate_sudo_mode`).
- Traductions FR/EN (`ajustement.*`).

## 2026-10-06 — 📱 Mobile : tableau de bord de poche

- Nouvel écran `DashboardScreen` (`mobile-facturation/src/screens/`) :
  CA du jour + variation vs veille, nombre de ventes, top 5 produits,
  stats personnelles (mes ventes, panier moyen). Accès via bouton
  graphique dans l'en-tête de `FacturationScreen`, pull-to-refresh.
- `getDashboardStats()` ajouté dans `src/services/api.ts` — consomme
  `GET /dashboard/stats/` (endpoint backend existant, aucun changement
  backend). Rôles VENDEUR/CAISSIER : stats personnelles uniquement
  (restriction backend conservée volontairement — pas de CA global
  pour les vendeurs).
- Traductions FR/EN (`dashboard.*`).

## 2026-10-06 — Documentation : évaluation terrain des suggestions de commandes

- Formalisation du mode d’observation automatique (« shadow mode ») pour comparer les suggestions, les décisions du pharmacien et la consommation réelle sans déclencher de commande automatique.
- Définition des instantanés, événements perturbateurs, indicateurs, niveaux de déploiement et critères préalables à une automatisation encadrée.
- Consolidation des failles identifiées et de la formule cible de réapprovisionnement.
- Fichier : `docs/evaluation-terrain-suggestions-commandes.md`.

## 2026-10-06 — 📱🖥️ Multi-caisses : choix de la caisse destinataire

- **Backend** (`sale_finalizer.py`) : nouveau `_resolve_poste_caisse` —
  `poste_caisse_id` explicite dans le payload `/factures/finaliser/`
  route la vente vers la caisse choisie (validée ouverte), sinon la
  caisse du `poste_vente` transmis (le web envoie le poste de la
  caissière — son sélecteur de caisse influence désormais réellement
  `poste_caisse`), sinon la dernière caisse ouverte (comportement
  historique inchangé). Avant : tout partait sur la caisse ouverte le
  plus récemment, sans choix possible.
- **Mobile** : `CaissePickerModal` à l'envoi quand ≥2 caisses sont
  ouvertes (`/postes-ventes/actives/` filtré `caisse != null`) — nom de
  la caisse + caissière ; choix conservé pour les ré-envois internes.
- **Caisse web** : le sélecteur de caisse (filtre de vue) est masqué
  pour une caissière dont le poste de caisse est ouvert — vue verrouillée
  sur sa propre caisse (`useCaisseSession` recale `selectedPosteCaisseId`
  à l'ouverture). Le sélecteur reste disponible sans poste ouvert et
  pour les superusers (supervision).
- **Tests** : `test_sale_finalizer.py` — choix honoré + caisse fermée
  refusée (25 tests OK).
- **iOS** : `app.json` reçoit `bundleIdentifier` + exception ATS
  (HTTP local) ; `eas.json` ajouté — l'app est prête pour un build iOS.

## 2026-10-06 — 📱 Mobile : facturation des clients professionnels (parité web)

- **Parité complète de la vente « client pro »** sur mobile-facturation :
  - **Fix ayant droit** : `GET /clients/<id>/` fetché à la sélection
    (`getClient`) — la liste `/clients/` ne renvoie ni `ayants_droit`
    ni `message_alerte`, les chips AD n'apparaissaient jamais et le
    matching matricule pouvait créer des doublons.
  - **Majoration pro** (`majoration_pro_pourcentage`) : prix =
    `selling_price × (1+p/100)` à l'ajout et recalcul de tout le panier
    au changement de client (`applyMarkupToCart` web ; écrase les prix
    manuels). Le backend exige `can_modify_price` à l'envoi — couvert
    par le flux Sudo existant.
  - **Remise automatique** (`remise_automatique`) appliquée en remise
    globale % à la sélection (sans Sudo, comme le web).
  - **Tiers payant** (`taux_couverture`) : ligne « Part Assurance X F ·
    Part Patient Y F » au footer + `paiements` envoyés comme le web
    (`especes` part patient + `en_compte` part mutuelle). Corrige un
    bug : `paiements: []` faisait compter tout le TTC comme nouvelle
    dette dans le contrôle plafond backend → vente pro bloquée à tort.
  - **Plafond crédit** : blocage avant envoi si `dette + part mutuelle
    > plafond` (-1 = illimité) + alertes à la sélection (atteint/>80 %).
  - **Alertes de sélection regroupées** : message_alerte + dépôt +
    remise fidélité + plafond en une `Alert` ; badge « PRO » sur la
    carte client et dans les résultats de recherche client.
- Fichiers : `types/index.ts`, `services/api.ts` (getClient,
  tiersPayantSplit, paiements), `stores/useCartStore.ts` (majoration),
  `screens/FacturationScreen.tsx` (+ styles), `components/ClientModal.tsx`,
  `hooks/useSendSale.ts`, `i18n/{fr,en}.ts`.
- Détails : `mobile-facturation/SUIVI.md` (P5).

## 2026-10-05 — 📱 Mobile : suivi encaissement en caisse + verrouillage PIN

- **Statut d'encaissement dans l'historique mobile** : chaque vente
  envoyée affiche un badge remonté du backend — « En caisse » (VALIDEE),
  « Encaissée » (PAYEE), « Annulée » — via
  `GET /factures/?include_pending=true&created_by=<id>&page_size=100`
  (`getFactureStatuses`, une requête pour tout l'historique, match par
  `numero_facture`). `include_pending` réaffiche les ventes en attente
  masquées par la liste par défaut et court-circuite le cache 60 s →
  statut temps réel. Le vendeur terrain voit si la caissière a encaissé
  sans l'appeler. `useAuthStore.userId` ajouté (rempli par `getMe` au
  login et au boot) pour le filtre `created_by`.
- **Verrouillage PIN (sans biométrie, décision demandeur)** : code 4-6
  chiffres par vendeur en SecureStore (`lock.pin.<username>`), délai par
  appareil (immédiat/1 min/5 min). Verrou au boot sur session restaurée,
  au retour de veille après délai, ou via le cadenas de l'en-tête
  (appui long = réglage PIN/délai/désactivation). Porte de sortie « PIN
  oublié » : déconnexion + suppression du PIN depuis l'écran verrouillé.
- **Remise globale dans le détail historique** : `remise_globale`
  (montant F) stockée à l'envoi et affichée dans le détail déplié
  (la remise par ligne était déjà visible en %). Rappel : historique
  par vendeur (`historique.<username>`), pas par appareil.
- **Résultats de recherche : distinction stock renforcée** — le gras
  seul passait inaperçu → en stock = nom extra-gras + compteur vert ;
  stock nul = nom atténué gris ; négatif = rouge (inchangé).
- **Résultats : infos regroupées** — CIP, « Stock: X » et prix sur une
  seule ligne sous le nom (plus de balayage gauche↔droite).
- **Badge lot lisible** — « AUTO » remplacé par « SANS LOT » (aucun lot
  prélevable) et « FEFO · … » quand un lot sera prélevé auto.
- **i18n fr/en** — `i18next`/`react-i18next`/`expo-localization`,
  ressources `src/i18n/fr.ts`+`en.ts`, langue = locale de l'appareil
  (fallback fr). Toutes les chaînes visibles migrées (écrans, modals,
  hooks, alertes). Bascule manuelle FR/EN persistée par appareil
  (chip dans l'en-tête de vente + segmenté au login).
- Fichiers : `stores/useLockStore.ts`, `components/LockScreen.tsx`,
  `components/PinLockModal.tsx`, `services/api.ts` (getFactureStatuses),
  `stores/useAuthStore.ts` (userId), `screens/HistoriqueScreen.tsx`,
  `FacturationScreen.tsx`, `LoginScreen.tsx`, `App.tsx`.
- Détails complets : `mobile-facturation/SUIVI.md` (P2, P3, P4).

## 2026-10-05 — 🔧 Nginx : correction de 6 bugs de configuration

- **Headers de sécurité absents sur HTML/assets** : `add_header` dans
  `location /` et `/assets/` écrasait tous les `add_header` du server
  (piège classique nginx) → CSP, X-Frame-Options, nosniff jamais envoyés
  sur le HTML. Headers extraits dans `security-headers.conf`, inclus via
  `include` partout où nécessaire. CSP enrichie (`worker-src`/`frame-src
  blob:`).
- **`location /django_static/` remplacée par `/static/`** proxifié vers le
  backend (Whitenoise) : le chemin ne correspondait pas à `STATIC_URL` et
  l'alias pointait vers un volume non monté → admin non stylé via :80.
- **`/media/` en whitelist stricte** : seul `/media/pharmacy_logos/` est
  servi (logo sur tickets/factures, `alias` vers `media_volume` désormais
  monté `:ro` dans le service frontend des deux compose). Le reste
  (`ordonnances/`, `internal_messages/`, `feedback/` = données sensibles)
  → 404, reste servi via API authentifiée.
- **`client_max_body_size 25m`** : fin des 413 sur imports Excel/uploads
  > 1 Mo.
- **`X-Forwarded-Proto` transmis** (fallback `$scheme`) : Django voit enfin
  HTTPS via Tailscale Funnel → `is_secure()` correct, URLs absolues en
  `https://`. ⚠️ Exige `CSRF_TRUSTED_ORIGINS=https://<domaine>.ts.net`
  en prod pour les POST session-auth via funnel.
- **`proxy_read_timeout 300s` sur `/api/`** : fin des 504 sur exports/
  rapports lourds (le backend continuait de traiter → doubles retries).
- **Divers** : `server_tokens off`, `Cache-Control` HTML `no-store` →
  `no-cache` (revalidation ETag → 304), `gzip_types` + `text/csv`,
  `resolver_timeout`.
- **`deployment/nginx_staging.conf` synchronisé** (version bare-metal,
  socket Unix) : mêmes correctifs + ajout du bloc `/ws/` WebSocket qui
  manquait + `error_page` maintenance.
- **CSP `<meta>` dans `index.html` alignée** sur `security-headers.conf`
  (avait dérivé : `object-src 'none'`, pas de `worker-src`/`frame-src`) —
  commentaire ajouté pour garder les deux synchronisées.
- **Bind mounts dev (anti-régression de version)** : `dist/`, `nginx.conf`
  et `security-headers.conf` montés `:ro` dans le conteneur frontend —
  un recreate ne peut plus resservir le code baké dans une vieille image.
  `npm run build` hôte = déployé instantanément. `deploy.ps1` adapté :
  skip `docker cp` si bind-monté (un cp sur mount `:ro` échouerait).
- **Testé en dev** : `nginx -t` OK (docker + staging), headers vérifiés
  par curl, logo media servi (200), chemins sensibles 404, admin
  `/static/` 200, POST 2 Mo OK.

## 2026-10-05 — 📱 Mobile : refonte FacturationScreen + caméra scan

- **Refonte `FacturationScreen` (1366 → 737 lignes, sans changement de
  comportement)** : extractions — `components/ClientModal.tsx`
  (sélection/création client autonomes), `components/AyantDroitSection.tsx`
  (chips + formulaire), `hooks/useProductSearch.ts` (recherche + scan +
  FEFO à la demande), `hooks/useSendSale.ts` (flux envoi caisse complet :
  sudo, stock, ayant droit, poste, retries), `screens/
  FacturationScreen.styles.ts`, `utils/drfError.ts` partagé.
- **Caméra scan** : `ratio="16:9"` → aperçu FIT (lettrebox) au lieu de
  FILL — supprime l'effet zoom excessif sur tablettes paysage.
- **Notes** : `softwareKeyboardLayoutMode: "pan"` dans app.json (clavier
  flottant, effet au prochain build natif) ; compat Android 7 → 16
  (Expo SDK 57).

## 2026-10-05 — 📱 Mobile : retours test terrain (recherche, clavier, densité, historique)

Correctifs issus des tests sur appareil réel après la transposition
« Vente tablette » (détail complet dans `mobile-facturation/SUIVI.md`) :

- **Aperçu FEFO après ajout manuel** : le serializer liste ne renvoie
  pas `stock_lots` → badge lot vide. Lots chargés à la demande
  (`getLots`) + action store `setProductLots` → lot + expiration
  affichés comme après un scan.
- **Tailles proportionnelles à l'écran** : nouvel utilitaire
  `utils/scale.ts` (`moderateScale`, réf. 375dp, borné ×1→×1.5) appliqué
  aux 11 fichiers avec styles — tablettes agrandies, jamais de
  rétrécissement sur petits écrans.
- **Clavier & recherche** : résultats affichés dans un overlay flottant
  ancré au-dessus du clavier (hauteur mesurée, compatible
  pan/resize/nothing) ; sections basses masquées en mode recherche ;
  `Keyboard.dismiss()` à l'ajout ; `softwareKeyboardLayoutMode: "pan"`.
- **Densité compacte** (< 720dp de hauteur) : sections fixes resserrées,
  ~60dp gagnés pour la liste panier.
- **Confirmation « Annuler »** : vider le panier exige une confirmation ;
  bouton grisé à vide.
- **`ProductRow`** : nom gras si stock > 0, normal si 0, rouge si < 0.
- **Historique** : détail produits (nom, qté, prix, remise, total ligne)
  stocké à l'envoi et affiché au toucher sur l'entrée.

## 2026-10-04 — 📉 États/Inventaires : filtre « Stocks négatifs » + négatifs masqués à 0

### Pourquoi

Le listing ne proposait pas de filtre dédié aux stocks négatifs : les lots
négatifs étaient mélangés aux « Stocks nuls » (`quantity_remaining__lte=0`)
et, pire, un produit dont `Produit.stock` est négatif sans lot négatif
(vente forcée sans écriture lot, divergence produit/lots) s'affichait à
**0** en « Tous les produits » — anomalie invisible.

### Changements backend

- `api/views/stocks/inventaire/listing_excel.py` :
  - `stock_filter='negatif'` : lots `quantity_remaining < 0` (ou
    `quantity_reserved < 0` en emplacement Réserve) **+** produits
    `stock < 0` sans lot négatif → ligne synthétique avec la vraie valeur
    négative (et `valeur_stock` négative).
  - `'tous'` : la ligne synthétique des produits sans lot visible affiche
    désormais `Produit.stock` réel (au lieu de 0 en dur) — le négatif
    apparaît.
  - `'zero'` : strictement `= 0` (les négatifs ont leur filtre) ; même
    alignement dans `_get_rows_from_inventaire` (`quantite_physique`).
  - Libellé `lx_flt_negatif` (fr/en) ajouté.
- `api/views/etat_inventaire.py` : `stock_display=NEGATIF` supporté
  (`stock__lt=0`, valeur affichée) pour le bouton « Imprimer » ;
  libellé `einv_stock_negatif` (fr/en).
- `inventaire_main.py` : docstring `stock_filter` mise à jour.

### Changements frontend

- `EtatsInventaire.tsx` : option « Stocks négatifs (< 0) » (pilule rose,
  icône `TrendingDown`) ; `handlePrint` mappe `negatif` → `NEGATIF`.
- `locales/{fr,en}/stock.json` : `filter_negative` + `filter_negative_desc`.

### Vérifications

- `test_stock_inventory` + `test_inventory_consistency` : 8/8 OK.
- `tsc --noEmit` : aucune erreur sur `EtatsInventaire.tsx`.

## 2026-10-04 — 📱 Mobile : disposition « Vente tablette » sur l'écran de vente

### Pourquoi

L'ancienne page web « Vente tablette » (supprimée) avait une disposition
appréciée : recherche en haut, grande zone panier centrale, client +
remise + total/envoi en bas. Transposée sur `mobile-facturation` qui la
remplace — sans retirer aucune fonction mobile.

### Changements (`mobile-facturation/`)

- `src/screens/FacturationScreen.tsx` : split recherche|panier remplacé
  par une colonne verticale unique — en-tête « Vente » + sous-titre
  « {poste} • N article(s) » (poste touchable = retry `ensurePosteVente`,
  ex-badge), recherche pleine largeur (scan conservé), zone centrale à
  bordure pointillée affichant les résultats de recherche pendant la
  saisie puis les lignes du panier (état vide : icône panier +
  « Ajoutez des produits pour commencer »), carte client compacte avec
  « Modifier », bloc ayant droit inchangé, remise globale %/F inchangée,
  footer « TOTAL » (sous-total + badge superviseur) + « Envoyer en
  caisse » (désactivé quand le panier est vide, style grisé).
- Fonctions déplacées, pas supprimées : ventes en attente, historique,
  mise en attente et déconnexion en icônes d'en-tête ; « Annuler » vide
  le panier (icône seule < 560 px de large) ; la déselection du client
  reste possible via « Client de passage » dans le modal.
- `SUIVI.md` : entrée ajoutée en section P1.

### Vérifications

- `tsc --noEmit` (mobile-facturation) : OK.

## 2026-10-04 — 🗑️ Suppression des écrans « Caisse tablette » et « Vente tablette » web

### Pourquoi

Redondants avec l'app **mobile-facturation**, désormais plus complète
(scan caméra/douchette, brouillon persisté, mise en attente, historique,
poste épinglé par appareil) pour le même cas d'usage : prise de vente
mobile → caisse centralisée.

### Changements frontend (`frontend/frontend/`)

- `src/components/VenteTablette.tsx` et `src/components/CaisseTablette.tsx`
  supprimés.
- `src/routes.tsx` : routes `/app/vente-tablette` et `/app/caisse-tablette`
  retirées (+ imports lazy).
- `src/components/Sidebar.tsx` : entrées de menu et prefetch retirés.
- `src/hooks/caisse/useCaisseSession.ts` : option `autoActivatePoste`
  supprimée (n'avait plus d'appelant).
- `src/services/cashSessionService.ts` : `ensurePosPoste`,
  `getPostesVenteDisponibles`, `isPosteComptoir`, `DEVICE_POSTE_KEY`
  supprimés — la convention « Comptoir » n'a plus de consommateur web ;
  seuls les postes « Mobile… » restent utilisés (par l'app).
- `src/components/settings/PosteVenteSettingsSection.tsx` : placeholder
  « Comptoir 1 » → « Mobile 1 ».
- `public/locales/{fr,en}/` : clés `ventes.caisse_tablette` /
  `ventes.vente_tablette` (sidebar.json) et section `tablet`
  (sales.json) retirées.

### Backend — inchangé

Aucun endpoint supprimé : `postes-ventes/*` (`mes_actives/`,
`disponibles/`, `activer/`, …) et `factures/finaliser/` centralisé sont
partagés avec mobile-facturation et la caisse centralisée.

### Vérifications

- `npm run build` : OK (4803 modules, 0 erreur).
- `npm run lint` : aucune erreur nouvelle (35 erreurs préexistantes
  hors périmètre).

## 2026-10-04 — 📛 Postes de vente : convention de nommage Mobile/Comptoir

Chaque canal ne voit désormais que ses postes, par préfixe de nom
(insensible à la casse et aux espaces) :
- **Mobile-facturation** : postes « Mobile… » uniquement —
  `isPosteMobile` filtre la réutilisation, le poste épinglé et la liste
  du sélecteur ; les alertes « aucun poste » précisent la convention.
- **Vente web** (`ensurePosPoste`) : postes « Comptoir… » uniquement —
  `useCaisseSession` délègue toute la résolution à `ensurePosPoste`
  (réutilisation + épinglage + activation).

Un poste épinglé à un appareil qui ne respecte plus la convention est
simplement ignoré → re-choix dans le bon pool. Pas de migration : la
séparation repose sur les noms existants des définitions.

## 2026-10-04 — 🏷️ Postes de vente : épinglage par appareil + gardes anti-mélange

### Pourquoi

Le pool de définitions de postes était partagé et aveugle : mobile et
tablette web activaient chacun le 1er poste libre (`disponibles[0]`) →
un poste web pouvait prendre le poste mobile et inversement. Pire, le
fallback `actifs[0]`/`myActive[0]` pouvait réutiliser un poste de
**caisse centrale** (`mode_pos=false`) du même compte → ventes vendeur
mélangées avec les encaissements dans les stats/journal par poste.

### Changements backend (`backend/api/`)

- `caisse_poste.py` : `disponibles/` inclut désormais les postes fermés
  du user courant (`Q(vendeur__isnull) | Q(vendeur=request.user)`) —
  nécessaire pour qu'un appareil épinglé retrouve son poste après
  fermeture. `activer/` refuse un poste rattaché à une caisse physique
  (réservé à `ouvrir/`).
- `sale_finalizer.py` : en mode centralisé, un `poste_vente_id` rattaché
  à une caisse n'appartenant pas au vendeur est refusé ; les postes POS
  purs restent partageables entre vendeurs (comptoir partagé, test
  existant préservé).

### Changements mobile (`mobile-facturation/`)

- `useSettingsStore` : `posteVenteId` persisté (`pos.posteVenteId`,
  par appareil — pas par vendeur).
- `api.ts` : `ensurePosteVente` ne réutilise que les postes `mode_pos`,
  réactive le poste épinglé directement via `activer/`, sinon lève
  `PosteChoiceRequired` avec la liste des disponibles.
- `PostePickerModal` (nouveau) : sélecteur affiché au 1er démarrage ou
  quand le poste épinglé est pris — choix mémorisé sur l'appareil.
- `FacturationScreen` : résolution auto au montage + badge existant.
- `LoginScreen` : `PosteChoiceRequired` toléré en silence (le sélecteur
  s'ouvre sur l'écran de facturation).

### Changements web (`frontend/frontend/`)

- `cashSessionService.ensurePosPoste()` (nouveau) : poste POS épinglé
  par appareil (`pos_device_poste_vente_id` en localStorage) — même
  logique que le mobile.
- `useCaisseSession` : la branche `autoActivatePoste` (VenteTablette)
  ne retient que les postes `mode_pos` et passe par `ensurePosPoste` ;
  `setSelectedPosteCaisseId` ne s'applique que si le poste a une caisse.
- `VenteTablette.retryPosteVente` : même logique via `ensurePosPoste`.

### Vérifications

- `npx tsc --noEmit` propre (mobile + web).
- Backend : `test_sale_finalizer` + `test_sensitive_permissions` 43/43
  (4 nouveaux tests : activation poste-caisse refusée, disponibles,
  finaliser centralisé sur caisse d'autrui / propre).
- À tester : 2 appareils gardent chacun leur poste ; mobile ne prend
  jamais le poste de la caisse centrale ; fermeture → réactivation du
  même poste.

## 2026-10-04 — 📱 Mobile-facturation : safe area edge-to-edge

### Pourquoi

`edgeToEdgeEnabled: true` (app.json Android) sans aucune gestion des
insets : l'en-tête de l'app dessinait sous la barre de statut de la
tablette, et le footer sous la barre de navigation gestuelle.

### Changements (`mobile-facturation/`)

- `index.ts` : racine wrappée dans `SafeAreaProvider` (pattern repris
  de `pda-inventaire/index.ts`).
- `App.tsx` : `<StatusBar style="dark" />` (thème clair).
- `useSafeAreaInsets` appliqué : en-têtes `paddingTop` (Facturation,
  Historique, ScanBarcodeModal), conteneurs `paddingBottom`
  (cap 24) + `paddingLeft/Right` (découpes latérales en landscape),
  overlays des modals centrées (`Math.max(insets, 24)` : Sudo, Lot,
  LineEdit, PendingSales), écran Login.

### Vérifications

- `npx tsc --noEmit` propre. À vérifier sur appareil : en-tête nette
  sous la barre de statut, boutons du footer hors barre de nav.

## 2026-10-04 — 🔐 Mobile-facturation : forçage stock supervisé + client divers

### Pourquoi

Deux écarts de parité relevés à la revue des droits : le mobile ne
demandait jamais de validation pour vendre au-delà du stock (403 brut,
aucun moyen de faire valider par un superviseur), et une vente sans
client partait en « Client de passage » non rattachée au lieu du client
« Clients divers » auto-sélectionné sur le web.

### Changements (`mobile-facturation/`)

- `src/services/clientDivers.ts` (nouveau) : `ensureClientDivers` résout
  « CLIENTS DIVERS »/« CLIENT DIVERS » via `searchClients('divers')` une
  fois par session (cache `useAuthStore.clientDivers`, reset au logout)
  et le sélectionne si le panier n'a pas de client.
- `App.tsx` : après hydratation du brouillon (session restaurée ou
  login frais) → `ensureClientDivers()`.
- `FacturationScreen` : après chaque envoi réussi, `cart.clear()` puis
  re-sélection du client divers (comme `_resetSaleDataOnly` du web).
- Forçage de stock : `ensureStockSudo` avant l'envoi — une ligne dont la
  quantité dépasse le stock connu déclenche `SudoModal`
  `can_sell_negative_stock` ; les creds (`stockSudoCreds`, mémoire
  seule, reset à clear/hydrate) partent dans le bloc `sudo` du payload
  `finaliser`. Retry sur 403 `can_sell_negative_stock` si le stock
  local était périmé.
- Rappel : l'autorité reste `_compute_required_permissions` côté
  backend (`can_sell_negative_stock`, `can_do_remise`,
  `can_modify_price`, `can_validate_zero_amount`…) et chaque validation
  superviseur écrit un `AuditLog` SUDO_VAL.

### Vérifications

- `npx tsc --noEmit` propre. À tester sur appareil : vente qté > stock
  (modal + retry 403), vente sans client → facture rattachée « Clients
  divers ».

## 2026-10-04 — 🔁 Web : transpositions du mobile (retry idempotent + poste auto)

### Pourquoi

Deux patterns fiabilisés sur `mobile-facturation` manquaient au web :
un POST `finaliser` interrompu (WiFi coupé, timeout) renvoyait une erreur
alors que la facture avait pu être créée côté backend, et la vente
tablette se bloquait sur « Point de vente fermé » sans tenter
d'activation.

### Changements (`frontend/frontend/`)

- `src/services/api.ts` : l'intercepteur retry réseau (MAX 3, backoff
  1 s→3 s) n'exclut plus que les POST **sans** `Idempotency-Key` —
  `venteService.finaliser` (et tout POST idempotent) retombe donc en
  retry automatique, la même clé permettant au backend de dédoublonner.
- `src/hooks/caisse/useCaisseSession.ts` : option
  `{ autoActivatePoste: true }` — si aucun poste actif au chargement,
  active le 1er poste disponible (`disponibles/` → `activer/`), port
  du `ensurePosteVente` mobile. Désactivée par défaut : CaisseTablette /
  CaisseCentralisee inchangés.
- `src/components/VenteTablette.tsx` : `autoActivatePoste` activé ;
  écran « Point de vente fermé » gagne un bouton **Réessayer**
  (spinner) relançant `mes_actives` → `disponibles` → `activer`.
- Locales `sales` fr/en : nouvelle section `tablet` (title, items,
  no_session, open_session_first, retry, no_poste_available,
  poste_retry_failed) — jusque-là portées par les `defaultValue`.

### Vérifications

- `npx tsc --noEmit` propre, JSON locales valides.

## 2026-10-04 — 🏷️ Mobile-facturation : badge lot = aperçu FEFO

### Pourquoi

Le badge lot du panier affichait juste « AUTO » quand aucun lot n'était
choisi manuellement — le vendeur ne voyait pas quel lot partirait.

### Changements (`mobile-facturation/`)

- `src/utils/fefo.ts` (nouveau) : `getFEFOPreview` porté du web —
  répartition de la quantité sur les lots triés par expiration
  croissante (indicatif ; l'allocation réelle reste faite par le backend
  à la finalisation).
- `CartItemRow` : badge lot = lot choisi (`LOT-X · 12/26`) ou aperçu
  FEFO (`AUTO · LOT-A · 12/26`, `AUTO · LOT-A +2` si plusieurs lots),
  comme la facturation web. `product.stock_lots` est déjà renvoyé par le
  `ProduitSerializer` (5 premiers lots non vides) — aucun appel en plus.
- `CartLine.lotExp` + `setLot` : l'expiration du lot choisi est
  mémorisée pour l'affichage (scan datamatrix inclus).

### Vérifications

- `npx tsc --noEmit` propre.

## 2026-10-04 — ⏸️ Mobile-facturation : mise en attente des ventes

### Pourquoi

Parité avec la vente web : le vendeur doit pouvoir suspendre un panier
(client qui cherche sa monnaie, interruption) et le reprendre plus tard.
Comme le web (`usePendingSales` / `ventesEnAttente` en localStorage),
c'est **100 % local** — aucun appel backend.

### Changements (`mobile-facturation/`)

- `src/stores/usePendingStore.ts` (nouveau) : ventes en attente dans
  kv-store `pending.<username>` (par vendeur, cap 50) — chargées au boot
  en même temps que le brouillon (`App.tsx`).
- `src/components/PendingSalesModal.tsx` (nouveau) : liste des ventes
  (client, heure, nb articles/lignes, aperçu produits, total net) avec
  actions **Reprendre** / **Fusionner** (si panier non vide) /
  **Supprimer**.
- `FacturationScreen` : bouton pause dans le footer (met le panier en
  attente et le vide), icône horloge + badge compteur en en-tête.
- `useCartStore` : action `addLine` (fusion d'une ligne existante).
- Reprendre = `cart.hydrate()` (remplace le panier après confirmation si
  non vide) ; fusionner = quantités cumulées par produit, client/remise
  du panier actuel conservés. Creds Sudo jamais persistés → une vente
  restaurée avec remise/prix modifié repasse par la revalidation à
  l'envoi (`ensureSudoCreds`).

### Vérifications

- `npx tsc --noEmit` propre. Reste à tester sur appareil : mise en
  attente → kill app → reprise, fusion avec panier non vide.

## 2026-10-04 — 🎨 Mobile-facturation : historique local + thème clair + finition (P3)

### Pourquoi

P3 du suivi `mobile-facturation/SUIVI.md` : historique des envois,
alignement visuel sur l'app web / pda-inventaire, code mort, et
robustesse d'envoi.

### Changements (`mobile-facturation/`)

- **Historique local** : `src/services/historique.ts` (nouveau) —
  kv-store `historique.<username>` (par vendeur, cap 200 entrées).
  Chaque envoi réussi enregistre n° facture, heure, nb articles, total,
  client. `HistoriqueScreen` réécrit : liste + pull-to-refresh, entrée
  par l'icône horloge en en-tête de `FacturationScreen`.
- **Thème clair/emerald** : `src/config/theme.ts` (nouveau, palette
  identique à `pda-inventaire`) ; tous les écrans/composants re-stylés
  (fini le dark indigo) ; `app.json` → `userInterfaceStyle: light`,
  splash + icône adaptative fond clair.
- **Ménage** : `src/services/websocket.ts` supprimé (code mort depuis le
  passage en REST) + types `CashierPayload`/`CashierArticle` ; deps
  inutilisées retirées (`@react-native-community/netinfo`,
  `expo-device`, `uuid`, `@types/uuid`).
- **Retry d'envoi** : `sendSaleToCaisse` réessaie **une fois** avec la
  même `Idempotency-Key` sur timeout/erreur réseau (pas de réponse
  HTTP) — dédoublonnage côté backend, pas une file offline.

### Vérifications

- `npx tsc --noEmit` propre. Reste à tester sur appareil : historique
  après envois, lisibilité du thème clair, retry sur coupure réseau.

## 2026-10-04 — 🐛 Backend : ventes POS rattachées à la caisse ouverte

### Pourquoi

Les ventes envoyées depuis un poste **POS** (mobile-facturation, ou poste POS
web) étaient créées avec `poste_caisse = poste_vente.caisse` = **NULL** (un
poste POS n'a pas de caisse). Conséquences :

- la notif WS `caisse_centralisee` (`poste_caisse_id: null`) ne passait pas
  le filtre de la caisse sélectionnée → la vente n'apparaissait pas en
  temps réel (uniquement au polling 30 s, ou jamais si une caisse précise
  était sélectionnée) ;
- l'encaissement de ces factures était **exclu des totaux par caisse et de
  la clôture** (`poste_caisse` n'est jamais réécrit à l'encaissement).

### Changement

- `api/services/sale_finalizer.py` : en mode `centralized`,
  `poste_caisse_id = caisse_ouverte.caisse_id` (le poste actif rattaché à
  une caisse — déjà récupéré pour le contrôle « aucun point de caisse
  ouvert »). Mode non centralisé inchangé. Multi-caisse : la vente est
  routée vers la **première** caisse ouverte trouvée.
- `api/tests/test_sale_finalizer.py` : 2 tests — vente centralisée POS →
  `poste_caisse` = caisse ouverte ; vente directe → `poste_caisse` du poste
  vendeur inchangé.

### Vérifications

- `test_sale_finalizer` : 21/21 OK ; `test_facturation` +
  `test_sales_robustness` : 32/32 OK.
- ⚠️ Données historiques : les anciennes factures `poste_caisse=NULL`
  restent exclues des totaux par caisse (à corriger en prod si besoin via
  requête de rattachement sur la caisse qui a encaissé).

## 2026-10-04 — 💾 Mobile-facturation : session persistée + brouillon panier (P2)

### Pourquoi

- Kill de l'app = perte de la session (re-login complet, poste à réactiver)
  et du panier en cours — inacceptable sur un terminal de vente en rayon.

### Changements (`mobile-facturation/`)

- `src/utils/secureStore.ts` (nouveau) : shim `expo-secure-store` +
  fallback `localStorage` sur web (identique à `pda-inventaire`).
- `stores/useAuthStore.ts` : `setAuth` persiste `session.token` /
  `session.username` / `session.serverUrl` ; `restoreSession()` au boot ;
  `logout` purge les 3 clés.
- `services/api.ts` : intercepteur réponse — **401 → `logout()`** immédiat
  (token révoqué par un autre login, session unique côté backend).
- `App.tsx` : réécrit — `isAuthenticated` du store (plus de `useState`),
  spinner de restauration, boot = `settings.load()` → `restoreSession()` →
  `hydrateDraft` → `getMe()` (plafond remise + `ensurePosteVente`
  silencieux ; réseau KO → session conservée + alerte).
- `stores/useCartStore.ts` : brouillon `draft.cart.<username>` dans
  `expo-sqlite/kv-store`, sauvegarde débouncée (400 ms) à chaque mutation,
  `hydrate()` qui recalcule `total_ttc`. **Creds Sudo jamais persistés.**
- `screens/FacturationScreen.tsx` : `ensureSudoCreds()` avant l'envoi —
  si le brouillon restauré contient remise ou prix modifié sans creds
  (perdus au kill), validation superviseur redemandée.

### Vérifications

- `npx tsc --noEmit` propre. Reste à tester sur appareil : kill + restore,
  token révoqué → login, brouillon avec remise → Sudo à l'envoi.

## 2026-10-04 — 🔁 Mobile-facturation : scan — anti-doublon « sortie de champ »

### Pourquoi

Un code-barre maintenu dans le champ était ré-ajouté toutes les 1,5 s, et
deux codes visibles ensemble s'ajoutaient en ping-pong (A, B, A, B…).

### Changement

- `components/ScanBarcodeModal.tsx` : `lastSeenRef` = `Map<code, instant>`
  — chaque détection rafraîchit l'horodatage **du code** ; un code visé en
  continu n'est jamais ré-ajouté, il faut le retirer >1,5 s puis le
  re-scanner pour +1. Purge des entrées >5 s. Comportement identique en
  modes confirmation et automatique.

### Vérifications

- `npx tsc --noEmit` propre.

## 2026-10-04 — 🔑 Mobile-facturation : login par mot de passe seul

### Pourquoi

Demande client : connexion avec adresse serveur + mot de passe uniquement.
Le backend le supportait déjà (`CustomAuthToken` : sans `username`, il
identifie l'utilisateur actif dont le mot de passe correspond — unicité des
mots de passe garantie par `UserSerializer.validate_password`, throttle
5/min/IP). **Aucun changement backend.**

### Changements (`mobile-facturation/src/`)

- `services/api.ts` : `login(serverUrl, password)` → body
  `{ password, workstation: 'Mobile facturation' }`, retourne
  `{ token, username }`.
- `screens/LoginScreen.tsx` : champ nom d'utilisateur supprimé ; `username`
  pris dans la réponse serveur ; erreurs explicites (400 « Mot de passe
  incorrect », 429 « Trop de tentatives… », sinon « Serveur injoignable… »).

### Vérifications

- `npx tsc --noEmit` propre.

## 2026-10-04 — 🏪 Mobile-facturation : point de vente assigné automatiquement

### Pourquoi

`finaliser` refusait l'envoi (« Vous n'avez aucun point de vente actif ») :
le mobile envoyait `poste_vente_id: null` et le vendeur n'avait pas de
`PosteVente` actif. Choix : reprendre le flux web côté mobile, **sans
changement backend** (traçabilité identique, poste visible en caisse).

### Changements (`mobile-facturation/src/`)

- `services/api.ts` : `getMesPostesActifs`, `getPostesDisponibles`,
  `activerPosteVente`, et `ensurePosteVente()` — réutilise un poste déjà actif
  du vendeur (préfère `mode_pos`), sinon active la 1re définition
  disponible ; `NO_POSTE_DISPONIBLE` si aucune ; course inter-terminaux
  (400 « déjà actif ») → relecture. `sendSaleToCaisse(cart, posteVenteId)`.
- `stores/useAuthStore.ts` : `posteVente` (reset au logout).
- `screens/LoginScreen.tsx` : `ensurePosteVente()` après login ; alertes
  explicites (« Demandez à l'administrateur d'en créer un dans Paramètres →
  Points de vente ») mais le login n'est jamais bloqué.
- `screens/FacturationScreen.tsx` : badge « point de vente » dans l'en-tête
  (vert/gris, tap = réessayer avec spinner) ; à l'envoi, tentative
  silencieuse si aucun poste ; si 400 « point de vente » (poste fermé depuis
  le web) → réouverture + **un seul** renvoi.
- `types/index.ts` : `PosteVente`.

### Vérifications

- `npx tsc --noEmit` propre. Contrat vérifié dans `caisse_poste.py`
  (`mes_actives`, `disponibles`, `activer`) et `sale_finalizer.py`.

## 2026-10-04 — 📷 Mobile-facturation : scan en mode confirmation / automatique

### Pourquoi

Retour terrain : le scan ajoutait bien au panier mais le vendeur ne le voyait
pas (modal plein écran, feedback 1,8 s). Décision : deux modes, réglage
mémorisé sur l'appareil, **défaut = confirmation**.

### Changements (`mobile-facturation/`)

- **Nouveau** `src/stores/useSettingsStore.ts` : `autoAddScan` persisté via
  `expo-sqlite/kv-store` (déjà installé, pas de nouvelle dépendance), chargé
  au boot dans `App.tsx`.
- `src/components/ScanBarcodeModal.tsx` : interrupteur « Ajout automatique »
  dans l'en-tête. **Confirmation** : la caméra se fige, carte produit (nom,
  prix, stock, lot + péremption si datamatrix), quantité 1–99, « Annuler » /
  « Ajouter au panier ». **Automatique** : comportement précédent + footer
  live (dernier ajout, nb articles, total, « Terminer »).
- `FacturationScreen.tsx` : `handleBarcode` scindé en `resolveBarcode`
  (résolution pure) + `addScanResult` (ajout, lot, prix de lot sans Sudo).
  Douchette clavier : toujours ajout direct ×1.
- `src/utils/format.ts` : `expiryInfo` extrait de `LotModal` (partagé).
- `src/types/index.ts` : `ScanResult`.

### Vérifications

- `npx tsc --noEmit` propre.

## 2026-10-04 — 🧾 Mobile-facturation : parité vente tablette (P1)

### Pourquoi

P1 du suivi `mobile-facturation/SUIVI.md` : le mobile ne savait ni remiser,
ni modifier un prix, ni désigner un ayant droit, ni créer un client — et toute
remise saisie aurait été rejetée par le backend (`sudo` toujours `null`).
Contrat strictement aligné sur `VenteTablette.tsx` / `useSecureCartOperations`
/ `useSaleCompletion` côté web et `finaliser` / `validate_sudo_mode` /
`verify_password` côté backend. **Aucun changement backend ni web.**

### Changements (`mobile-facturation/src/`)

- **Nouveau** `hooks/useSudo.ts` + `components/SudoModal.tsx` : port du flux
  web — mot de passe d'un compte ayant la permission →
  `POST /users/verify_password/ {password, permission}` → creds
  `{validatorId, password}` conservés dans le panier. `requestId` pour
  enchaîner deux validations (prix puis remise) sans fermer la seconde.
- **Nouveau** `components/LineEditModal.tsx` : prix unitaire + remise % par
  ligne (prix tappable dans `CartItemRow`, icône crayon). Sudo
  `can_modify_price` si prix ≠ actuel, `can_do_remise` si remise > 0.
- `stores/useCartStore.ts` : `remiseGlobale`/`remiseMode` (%/F),
  `remiseSudoCreds`/`prixSudoCreds`, `sousTotal()`, `remiseGlobaleMontant()`
  (arrondi au F), `totalTTC()` net ; `setClient` réinitialise l'ayant droit ;
  `clear()` remet tout à zéro.
- `screens/FacturationScreen.tsx` : remise globale dans le footer (commit au
  blur, plafond `max_discount_rate` avec alerte « Remise plafonnée »), badge
  « Validé par superviseur », bouton « Client de passage » + désélection,
  modal client avec « + Nouveau client » (nom ≥ 2, téléphone validé comme le
  web) → `POST /clients/` ; bloc **Ayant droit** pour client `PROFESSIONNEL`
  (chips existants + « + Nouveau », matching matricule anti-doublon, création
  `POST /ayants-droit/` avant l'envoi, blocage si absent).
- `services/api.ts` : `verifySudoPassword`, `getMe`, `createClient`,
  `createAyantDroit` ; payload `finaliser` : `remise` (montant F),
  `totals.totalTtc` net, `remise_validated_by_id/password`,
  `prix_validated_by_id/password` (top-level).
- `stores/useAuthStore.ts` + `LoginScreen.tsx` : `maxDiscountRate` chargé via
  `GET /users/me/` après login (superuser → 100).
- `types/index.ts` : `Client.client_type`, `SudoCreds`, `CurrentUser`.

### Vérifications

- `npx tsc --noEmit` propre. Revue : enchaînement Sudo prix→remise,
  resynchronisation du champ remise après annulation, cohérence
  `remise`/`totalTtc` au F près.

## 2026-10-04 — 📉 AGENTS.md condensé (22 Ko → 5 Ko) + docs/agent/

### Pourquoi

`AGENTS.md` (502 lignes, ~22 Ko) est injecté à chaque message de l'agent — coût
en tokens à chaque requête. L'essentiel tient en 96 lignes ; le reste est de la
procédure consultée rarement.

### Changements

- `AGENTS.md` : réécrit — mémoire/CHANGELOG, règle d'avertissement, stack
  (apps mobiles ajoutées), conventions, commandes clés, tableau conteneurs
  dev/prod, règles rouges, index des références.
- **Nouveau** `docs/agent/` (contenu déplacé verbatim) : `deploiement.md`,
  `migrations-prod.md`, `securite-licence.md` (mots de passe, Cython, keyday),
  `import-produits.md`, `operations.md` (backup/restore, erreurs fréquentes),
  `parallelisation.md`. À lire à la demande.

## 2026-10-04 — 📷 Mobile-facturation : scan code-barres + fix contrat API

### Pourquoi

P0 du suivi : le scan était le plus gros gap de création rapide. En creusant,
les types mobile (`designation`, `code_barre`, `prix_vente`, `nom`/`prenom`/
`telephone`) ne correspondaient **pas du tout** au contrat API réel
(`name`, `cip1-4`, `selling_price`, `tva` ; `name`/`phone` pour Client) :
recherche produit affichait des lignes vides/NaN, et `getProductByBarcode`
appelait `?code_barre=` (param inexistant → ignoré → renvoyait le 1er
produit de la liste).

### Changements

- **Nouveau** `src/components/ScanBarcodeModal.tsx` : caméra expo-camera en
  scan continu, permission gérée, anti-doublon 1,5 s (re-scanner = +1 unité),
  vibration + feedback inline, cadre de visée.
- **Nouveau** `src/utils/gs1Parser.ts` : porté tel quel du frontend web —
  parse les datamatrix GS1 (AI 01 GTIN → CIP13, 17 exp, 10 lot, 21 série).
- `src/services/api.ts` : `getProductByBarcode` → `GET /produits/by-cip/<c>/`
  (endpoint réel, 404→null) ; nouvelles `getProductById` et
  `getLotByDatamatrix` (`GET /stock-lots/by-datamatrix/`, même flux que le
  scan datamatrix de la facturation web) ; `limit` → `page_size`.
- `src/types/index.ts` : types réalignés sur les serializers réels
  (`Product.name/cip1-4/selling_price/tva`, `Client.name/phone`,
  `AyantDroit.nom/matricule/societe`).
- `src/screens/FacturationScreen.tsx` : bouton scan dans la barre de
  recherche (natif uniquement) ; `onSubmitEditing` → même traitement que la
  caméra (couvre les douchettes clavier qui envoient Enter) ; scan
  datamatrix → produit + **lot exact** + prix du lot.
- `ProductRow`, `CartItemRow`, `LotModal`, `useCartStore` : champs renommés.

### Vérifications

- `tsc --noEmit` propre. Contrat vérifié contre `ProduitSerializer`,
  `ProduitListSerializer`, `ClientSerializer`, `by_cip` et `by_datamatrix`
  côté backend.

## 2026-10-04 — 📋 Mobile-facturation : périmètre acté + fichier de suivi

### Pourquoi

Tri d'une checklist générique « app de facturation » (venue d'un autre modèle)
adaptée au contexte réel de `mobile-facturation/`. Périmètre acté avec le
client : **pas de mode hors ligne, pas d'encaissement mobile** — tout part en
caisse centralisée.

### Changements

- `mobile-facturation/SUIVI.md` : fichier de suivi des chantiers créé
  (déjà en place, à faire priorisé P0→P3, hors périmètre, tableau d'avancement).
- Prochaines priorités identifiées : scan code-barres (deps déjà présentes,
  UI absente), parité vente tablette (ayant droit, remise/prix + Sudo,
  création client), session persistée + brouillon panier, historique SQLite
  + thème emerald + code mort WebSocket.

## 2026-10-03 — 🧾 Mobile-facturation : envoi réel vers la caisse centrale + SDK 57

### Pourquoi

L'app `mobile-facturation/` (POS mobile, distincte du PDA inventaire) n'avait
aucun backend derrière son bouton « Envoyer à la caisse » : elle expédiait le
panier via WebSocket `ws/pda/` (protocole `cashier_item_new`) — un consumer qui
n'existe pas dans le backend. L'envoi ne pouvait jamais fonctionner.

### Changements

- `src/services/api.ts` : nouvelle fonction `sendSaleToCaisse()` — POST
  `/factures/finaliser/` avec le même contrat que la vente tablette web :
  `centralized_cash_register: true`, `paiements: []`, `montant_verse`/`montant_rendu`
  `= '0'`, remise ligne convertie % → montant par unité (`discount`), `lot_id`,
  en-tête `Idempotency-Key` + champ `idempotency_key`. Le poste de vente actif
  du vendeur est résolu côté backend.
- `src/services/api.ts` : login corrigé `/api-token-auth/` → `/api/auth/token/`
  (seul path proxyfié par nginx).
- `src/screens/LoginScreen.tsx` + `src/stores/useAuthStore.ts` : suppression
  du forçage du port `:8000` sur l'URL serveur — Django n'est pas exposé
  directement sur l'hôte, seul nginx (:80) l'est. L'URL saisie est utilisée
  telle quelle (schéma `http://` ajouté si absent).
- `src/screens/FacturationScreen.tsx` : `handleSendToCashier` utilise l'API REST ;
  le badge WebSocket (canal inexistant) est retiré. Les erreurs backend
  (`detail` : point de vente non ouvert, permissions, stock) sont affichées dans
  l'alerte.
- SDK aligné sur Expo 57 : expo `^57`, RN `0.86.3`, React `19.2.3`, modules
  expo (`camera`, `sqlite`, `secure-store`, `device`, `status-bar`, `netinfo`)
  en versions `~57`.
- `App.tsx` : écran `Historique` rendu via fonction (prop `onBack` requise).

### Vérifications

- `tsc --noEmit` propre ; bundle Android OK (HTTP 200) sur Metro `:8083`.

## 2026-10-03 — 📱 PDA Inventaire : thème clair/emerald + compatibilité web

### Pourquoi

L'app PDA (`pda-inventaire/`, Expo/React Native) utilisait un thème sombre
bleu nuit (`#0f0f1a`, accent indigo) totalement déconnecté de l'app web
(slate clair + emerald). Et en preview web, le login échouait silencieusement
(`expo-secure-store` et `Alert.alert` n'existent pas sur web).

### Changements

- `pda-inventaire/src/config/theme.ts` : nouvelle palette centralisée
  (fond slate-50, cartes blanches, primary emerald `#059669`, accents
  sémantiques adoucis).
- Restyle : `HomeScreen` (fond bleu nuit → clair/emerald), `EditLineModal`
  (bordure ambre vif → emerald), `SyncBanner` (bloc orange → outline ambre),
  `Header` (badge offline), `RecentScans` (bouton suppression discret).
- `src/utils/secureStore.ts` : shim cross-platform — `localStorage` sur web
  (preview/dev), SecureStore natif sur device.
- `src/utils/alert.ts` : `showAlert()` — `window.alert`/`confirm` sur web,
  `Alert.alert` natif ailleurs.
- `src/services/api.ts`, `src/services/auth.ts`, `src/screens/LoginScreen.tsx`,
  `src/screens/HomeScreen.tsx`, `src/components/scanner/useScannerController.ts`
  branchés sur les shims (tous les `Alert.alert` migrés vers `showAlert`).

### Vérifications

- `tsc --noEmit` propre ; login fonctionnel en preview web
  (`expo start --web`).

## 2026-10-03 — ⬆️ PDA Inventaire : upgrade Expo SDK 54 → 57

### Pourquoi

L'app Expo Go installée sur les appareils est SDK 57 — le projet en SDK 54
refusait de charger (« incompatible »).

### Changements

- `pda-inventaire/package.json` : `expo ^57.0.0`, `react-native 0.86.3`,
  `react 19.2.3`, `typescript ~6.0.3`, tous les modules Expo alignés
  (`expo-camera ~57`, `expo-file-system ~57`, `expo-secure-store ~57`,
  `expo-sharing ~57`, `expo-status-bar ~57`, `safe-area-context ~5.7`,
  `screens ~4.26`, `netinfo 12`).
- `src/services/productCache.ts` : `expo-file-system` indisponible sur web →
  fallback `localStorage` pour la preview (natif inchangé).
- **`expo-av` supprimé → `expo-audio ~57.0.5`** : `ExponentAV` n'existe plus
  dans Expo Go SDK 57 (écran rouge « Cannot find native module »).
  `useScannerController.playSound` migré vers `createAudioPlayer()`.

### Vérifications

- `tsc --noEmit` propre (TS 6), bundle web OK sous SDK 57, app chargée et
  testée dans Expo Go SDK 57 sur le PDA réel.

### À faire plus tard

- `expo-sharing` / sons : comportement dégradé sur web (export CSV, beeps)
  — try/catch en place, erreurs visibles via `showAlert`.

## 2026-10-03 — 💰 Vente tablette : prix modifiable + remise globale avec validation Sudo

### Pourquoi

Le vendeur mobile doit pouvoir ajuster un prix de ligne ou appliquer une remise
globale sur tablette, mais sans contourner le contrôle de permissions : les
actions sensibles passent par la validation d'un superviseur (Sudo), comme sur le web.

### Changements

- `frontend/frontend/src/components/VenteTablette.tsx` :
  - **Prix de ligne modifiable** : tap sur le prix d'une ligne → champ numérique
    inline (Enter/blur pour valider, Échap pour annuler).
  - **Remise globale** : champ dans le footer avec bascule % / F, montant de
    remise affiché en temps réel.
  - **Sudo** : réutilise `useSudo` + `useSecureCartOperations` +
    `SudoValidationModal` (le même chemin que la facturation web). Le mot de passe
    d'un compte autorisé (`can_modify_price` / `can_do_remise`) est exigé à la
    saisie ; les credentials sont envoyés à `finaliser` via
    `remise_validated_by_id`/`prix_validated_by_id` (audit préservé).
  - Plafond de remise `max_discount_rate` du profil respecté (même logique web).
  - **Fix latent** : `gooeyToast` était utilisé sans import → crash au premier
    toast ; import ajouté.
  - Réinitialisation de la remise et des credentials sudo après chaque vente.

### Sécurité préservée

- Aucun bypass : les edits sont bloqués côté backend sans permission ni sudo
  valide (`sales_actions.py` vérifie `can_modify_price`/`can_do_remise`).
- La tablette reste sans encaissement — envoi en caisse centrale uniquement.

### Vérifications

- Build frontend OK (4805 modules), `tsc --noEmit` propre, déployé nginx.

## 2026-10-03 — 🔐 Vente centralisée sans sudo : `can_cash_out` non requis

### Pourquoi

Sur la tablette/POS mobile, un vendeur sans permission `can_cash_out` ne pouvait pas
envoyer une vente en caisse (`finaliser` exigeait le sudo). Or envoyer une facture
**impayée** à la caisse centrale n'est pas un encaissement — le compte connecté
suffit comme validateur (`validated_by = user`).

### Changements

- `backend/api/views/ventes/facture_mixins/sales_actions.py` :
  `_compute_required_permissions` n'exige `can_cash_out` que si
  `centralized=False` (encaissement direct). Bonus : corrige un trou — un encaissement
  direct sans `poste_vente_id` dans le payload contournait la permission.
- `backend/api/tests/test_facturation.py` : nouvelle classe
  `FinaliserCentralizedPermissionTests` — vendeur sans `can_cash_out` envoie en
  caisse (201, `validated_by = user`, aucun paiement enregistré) / encaissement
  direct refusé (403).
- `frontend/frontend/src/hooks/useSaleCompletion.ts` : en mode centralisé,
  `montant_verse`/`montant_rendu` envoyés à 0 — sinon la facture impayée
  arrivait en caisse avec `montant_verse = total` (trompeur pour la caissière).

### Sécurité préservée

- `can_cash_out` reste requis dans `CaisseViewSet` (encaissement réel).
- `can_do_remise`, `can_modify_price`, `can_sell_negative_stock`, `can_do_returns`,
  `can_validate_zero_amount` inchangés.

### Vérifications

- 44 tests facturation/robustesse/caisse verts, `check` 0 issue.

## 2026-10-03 — 📱 Vente tablette : route `/app/vente-tablette` POS mobile

### Pourquoi

L'utilisateur se déplace entre les clients pour accélérer la facturation. La caisse
tablette ne fait qu'encaisser des factures existantes — il fallait un écran de création
de vente optimisé tablette, sans paiement (envoi à la caisse centrale).

### Changements

- `frontend/frontend/src/components/VenteTablette.tsx` : nouvel écran de vente mobile :
  - recherche produit tactile (nom / CIP / code-barres via `useProductSearch`),
  - panier avec +/- quantité, suppression, total par ligne (`useCart`),
  - FEFO automatique (prix de lot si configuré, sinon allocation backend),
  - sélection client rapide (passage par défaut, recherche nom/téléphone,
    ayant droit pour clients PRO via `useFacturationClients`),
  - bouton "Envoyer en caisse" → `useSaleCompletion.completeSale` avec
    `centralizedCashRegister: true` + `poste_vente_id` du poste actif
    → facture `VAL` visible instantanément dans la caisse centralisée.
- `frontend/frontend/src/routes.tsx` : lazy import + route protégée
  `/app/vente-tablette` (permissions `ventes` + `facturation`).
- `frontend/frontend/src/components/Sidebar.tsx` : entrée "Vente tablette"
  dans le sous-menu Ventes + prefetch.
- `frontend/frontend/public/locales/fr/sidebar.json` et `en/sidebar.json` :
  clé `ventes.vente_tablette`.

### Vérifications

- `npm run build` : OK (4805 modules, 0 erreur).
- Frontend déployé (docker cp → nginx).

## 2026-10-02 — 📱 Caisse tablette : route `/app/caisse-tablette` POS tactile

### Pourquoi

Besoin d'un écran de caisse optimisé pour tablette / POS mobile : gros boutons,
affichage plein écran, connexion directe à la caisse centrale sans logique locale.

### Changements

- `frontend/frontend/src/components/CaisseTablette.tsx` : nouvel écran POS
  tablette avec :
  - grille de cartes tactiles pour les factures en attente (BROU/VAL/PROF),
  - affichage client + total TTC en grand,
  - filtrage par poste de caisse actif,
  - mise à jour temps réel via WebSocket `caisse_centralisee`,
  - modale de paiement réutilisant `PaymentModal` + `useCaissePayment`,
  - message bloquant si aucune session caisse active.
- `frontend/frontend/src/routes.tsx` : lazy import + route protégée
  `/app/caisse-tablette` (permissions `ventes` + `caisse`).
- `frontend/frontend/src/components/Sidebar.tsx` : entrée "Caisse tablette"
  dans le sous-menu Ventes + prefetch.
- `frontend/frontend/public/locales/fr/sidebar.json` et `en/sidebar.json` :
  clé `ventes.caisse_tablette`.

### Vérifications

- `npm run build` : OK (4804 modules, 0 erreur).
- Frontend déployé (docker cp → nginx).

## 2026-10-02 — 📱 PDA inventaire : design épuré (clair + emerald)

### Pourquoi

L'écran d'accueil PDA était en thème sombre bleu nuit / accent indigo, tandis que
le reste de l'app était déjà passé en clair/slate/emerald. Le "fond bleu" et les
couleurs vives (ambre massif, rouge flashy, indigo) détonnaient et fatiguaient en
usage PDA prolongé.

### Changements

- `pda-inventaire/src/config/theme.ts` : nouvelle palette centralisée
  (fond slate-50, surfaces blanches, emerald primary, accents sémantiques
  adoucis).
- `pda-inventaire/src/screens/HomeScreen.tsx` : fond clair, cartes blanches,
  accents emerald, pastilles de statut discrètes.
- `pda-inventaire/src/components/scanner/Header.tsx` : badge offline en
  ambre-outline au lieu du bloc ambre plein.
- `pda-inventaire/src/components/scanner/SyncBanner.tsx` : bannière en
  outline ambre/blanc (plus de rectangle orange massif) ; état désactivé en
  gris clair.
- `pda-inventaire/src/components/scanner/EditLineModal.tsx` : bordure/titre
  emerald au lieu de l'ambre/orange vif.
- `pda-inventaire/src/components/scanner/RecentScans.tsx` : bouton × en gris
  neutre avec icône rouge discrète au lieu du carré rouge plein.

### Vérifications

- `npx tsc --noEmit` : OK (0 erreur) dans `pda-inventaire/`.

## 2026-10-02 — 👤 Masquage clients : corrigé + filtre Actifs/Masqués/Tous

### Pourquoi

- Le bouton "masquer" (œil) basculait bien `is_active` mais `toggle_active`
  n'invalidait **pas** le cache de liste (`SimpleListCacheMixin`, TTL 5 min) →
  le client masqué restait affiché : fonction jugée "cassée".
- `include_inactive=true` affichait actifs + inactifs mélangés — impossible
  de voir uniquement les masqués pour les réactiver.
- L'omnisearch ne filtrait pas `is_active` : un client masqué restait
  trouvable et sélectionnable via la recherche globale.

### Changements

- `backend/api/views/clients.py` :
  - `toggle_active` → `self._invalidate_cache()` après save (liste fraîche
    immédiate).
  - `filterset_fields` += `is_active` ; `get_queryset` n'applique plus le
    filtre actifs par défaut quand `?is_active=` est explicite →
    `?is_active=false` renvoie **uniquement** les masqués.
- `backend/api/views/omnisearch.py` : recherche clients limitée à
  `is_active=True` (un client masqué n'est plus sélectionnable nulle part —
  facturation filtrait déjà via `clients/`).
- `frontend/frontend/src/components/Clients.tsx` :
  - Filtre statut 3 états **Actifs / Masqués / Tous** (groupe segmenté sous
    le filtre type) remplaçant le bouton œil ambigu de la toolbar.
  - Bouton œil du panneau détail : libellés corrects "Masquer le client" /
    "Réactiver le client" (tooltip + aria-label).
- `locales/fr|en/clients.json` : `filters.status_active|status_masked|status_all`,
  `actions.mask_client|reactivate_client`.
- Retouche UX : filtres type + statut regroupés en **deux menus déroulants**
  (`shadcn/select`) sur une seule ligne — fini les deux rangées de boutons.
- Bug restauration F5 : quand le client sélectionné était hors page courante,
  l'ID (ex. "2016") était injecté dans le champ recherche → remplacé par un
  chargement direct `getById` (champ recherche jamais pollué).

### Vérifications

- `manage.py check` : 0 issue · tests `test_client_merge` + `test_client_financials` : 31/31 OK.
- Build frontend OK · backend redémarré · frontend déployé (docker cp → nginx).

## 2026-10-02 — 🎨 Omnisearch aligné sur le design system

### Pourquoi

La palette de recherche globale était stylée "à part" (accent bleu, chips
multicolores, typographie font-black uppercase très espacée, rayons mixtes,
placeholder "God Mode") — visuellement étrangère au reste de l'app dont la
primary est le vert pharmacie (#059669).

### Changements (`Omnisearch.tsx`, `OmnisearchResults.tsx`, `OmnisearchPreview.tsx`)

- Accent emerald partout : sélection (`aria-selected`), focus de l'input,
  spinner, badges prix, icônes, panneau aperçu (gradient `to-emerald-50/40`).
- Chips actions rapides sobres : emerald pour "Nouvelle vente" (action
  principale), slate pour le reste, rouge conservé pour "Périmés" (sémantique).
- Typographie : `font-black`/`tracking-[0.15em]`/`tracking-widest` →
  `font-semibold`/`font-bold`/`tracking-wider` — cohérent avec les autres
  fenêtres (`tracking-tight` des DialogTitle).
- Rayons unifiés : fenêtre `rounded-2xl`, tuiles `rounded-xl`, items
  `rounded-lg`, icônes preview `rounded-2xl` (fini le mix
  `rounded-none`/`xl`/`2xl`/`3xl`).
- Placeholder aperçu : "God Mode Omnisearch" → "Aperçu" / "Preview" (fr/en).
- Retouche UX : actions rapides en liste (chip + libellé + description inline,
  comme "Navigation rapide") au lieu de la grille de tuiles ; focus de l'input
  = bordure emerald + `ring-2` épousant le `rounded-xl` (fini le halo `ring-4`
  débordant en cadre rectangulaire).

## 2026-10-02 — 🔒 Rappel de vente : la facture disparaît vraiment de la caisse centrale

### Bug

Rappeler une vente en facturation ne la retirait pas de la file de la caisse
centralisée : la caissière pouvait encaisser une vente en cours de modification
(→ paiement `completee` sur facture ANNULEE = écart de caisse).

### Causes corrigées (3 couches)

- **Brouillons jamais annulés** (`useFacturationState.ts`) : le rappel sautait
  `annuler/` pour les `BROU` → ils restaient payables et orphelins. Toute
  facture rappelée est désormais annulée (statut `ANN`, audit log).
- **Pas de notification temps réel** : `SaleCanceller.cancel_invoice` broadcast
  `facture_update`/`'cancelled'` sur le groupe WS `caisse_centralisee` (via
  `on_commit`) → disparition instantanée au lieu du polling 30 s. L'action
  `modifier/` émet aussi `'updated'` (évite d'encaisser l'ancien montant).
- **Backend sans garde-fou** (`caisse.py`) : `CaisseViewSet.create` et
  `bulk_create` refusent (400) tout paiement sur facture `ANNULEE` ou
  `is_active=False` — les `PAYEE` restent acceptées (recouvrement).

### Tests

`test_cash_payment_edges.py` + `CancelledInvoicePaymentGuardTests` (4 tests :
annulée→400, inactive→400, bulk→400, en attente→201). 12/12 + 28/28 caisse.

## 2026-10-02 — 🧩 Pagination centralisée : un seul composant `PaginationControls`

### Pourquoi

Chaque écran avait sa propre pagination (25 variantes inline + le composant
`ui/Pagination` déprécié) — maintenance impossible et look hétérogène.

### Changements

- **Nouveau `components/ui/PaginationControls.tsx`** : cluster canonique
  `⏮ ◀ ▶ ⏭` avec API unique `{page, totalPages?, hasNext?, onPageChange,
  isLoading?, size}` ; `hasNext` pour les paginations sans total.
- **`utils/pagination.ts`** : `buildPageUrl` / `extractPageSize` / `pageCount`
  pour les paginations URL-DRF (Inventaires, ReportResults).
- **~30 fichiers migrés** : sites inline + 6 consommateurs de `ui/Pagination`
  (supprimé) — un seul composant de pagination dans toute l'app.
- `size="xs"` pour les tables denses ; textes "Page X sur Y" conservés ;
  la numérotation de FournisseursList est remplacée par le contrôle standard.

## 2026-10-02 — ⏮ Pagination : boutons première/dernière page partout

- `ui/Pagination` : nouvelles props `onFirst`/`onLast` + icônes
  `ChevronsLeft`/`ChevronsRight` (tooltip "Première page"/"Dernière page",
  i18n fr/en).
- **31 sites de pagination** couverts (composant partagé + inline) :
  historiques ventes/achats/clôtures, journal caisse/audit, factures caisse,
  avoirs, produits, commandes, cadencier, fournisseurs, ajustements, analyses
  stock, challenges, fidélité, interactions, Telegram, CatalogDCI, rapports.
- Boutons désactivés aux bornes ; mécanisme adapté par site (`setPage`,
  callback, URL DRF reconstruite, `count/page_size` pour CatalogDCI).

## 2026-10-02 — 🔍 Audit paramètres ignorés : ~15 bugs filtres frontend↔backend

### Pourquoi

django-filter **ignore silencieusement** les paramètres inconnus — le bug
`created_at__date__gte` de Périmés n'était pas isolé.

### Backend

- `avoirs-clients/exporter_excel/` : `filter_queryset()` jamais appelé →
  l'export ignorait tous les filtres ; `search` implémenté (SearchFilter).
- `produits/` : bug `include_inactive=false` évalué truthy → les produits
  supprimés apparaissaient dans la recherche ; `is_public`, `stock_gt`,
  `rotation_moyenne`, `tva_gt`, `ordering=-tva` implémentés (rapports vitrine /
  non-vendus / TVA filtrent réellement).
- `stock-lots/?expiring_within_days` implémenté (rapport périmés).
- `historique-achats` : `no_pagination` honoré sur la liste.
- `user-sessions` : `date_after`/`date_before` implémentés.
- `creances/synthese_clients` : `date_fin` rendue inclusive.
- `settings.py` : clés DRF fantômes `PAGE_SIZE_QUERY_PARAM`/`MAX_PAGE_SIZE`
  retirées ; `ProduitFilter` (code mort) nettoyé.

### Frontend

- `Perimes.tsx` : `limit=100` → `page_size=100` (historique tronqué à 20).
- `useCaisseSession` : routes mortes réparées — `postes-ventes/recap_session`
  (récap session pollé en 404 toutes les 10 s) et `pharmacy-settings/`
  (**`hide_cash_totals` fonctionne enfin**).
- `venteService` : `supprimer_brouillons` (le bouton 404ait).
- `EtatsInventaire` : `stock_display` correct + fallback `RAYON` pour
  `group_by=fournisseur` (400).
- `useCentreRapports` : dates en heure locale au lieu d'UTC (+1 h).

## 2026-10-02 — 🗑️ Rétention des données : scaffold safe + UI Maintenance + garde-fous purge

### Pourquoi

`api_auditlog` = 110 MB en dev (plus grosse table) ; les tables de logs
grossissent sans borne. La purge existante avait des failles.

### Rétention (désactivée par défaut, `retention_enabled=False`)

- **Migration 0264** : champs `retention_*_days` dans `PharmacySettings`
  (audit 730 j, activity/messages 365 j, sessions/corbeille 90 j,
  brouillons 30 j, mouvements stock 1095 j) + `last_retention_run`.
- **`services/retention.py`** : plan de comptage/suppression partagé
  (commande + API, comportement identique).
- **`manage.py run_retention`** : `--dry-run` par défaut, `--confirm` requis,
  `--force` si désactivé, suppression par lots de 5000, trace `AuditLog`.
- **Scheduler** : hook quotidien (inerte tant que le flag est OFF).
- **`MouvementStock` exclu** sauf `--include-stock-movements`
  (`balance_stock_excel` reconstruit le stock en sommant les mouvements).
- **Jamais touché** : factures VAL/PAY/ANN, ordonnancier, écritures
  comptables, clôtures caisse, relevés, mouvements caisse.

### UI Maintenance → "Rétention automatique" (admin/superuser)

- Toggle activation + durées éditables (`PUT pharmacy-settings/`),
  tableau preview (`GET maintenance/retention_preview/`),
  bouton "Purger maintenant" protégé par mot de passe
  (`POST maintenance/retention_run/` → `run_retention --confirm --force`).
- i18n fr/en ; contexte `PharmacySettingsContext` aligné sur les defaults.

### Garde-fous sur la purge existante (`purge.py`)

- Whitelist `factures` limitée à `BROU`/`PROF` — la purge **bypassait** la
  protection `destroy` (VAL/PAY/ANN supprimables en masse). Les ANNULEE sont
  désormais conservées (traçabilité anti-fraude) ; test non-régression 37/37.
- `ordonnancier` retiré du registry (registre réglementé).
- `whatsapp_logs`/`telegram_logs` ajoutés ; `ProtectedError` respecté sur la
  corbeille.
- Bug bonus : `clean_draft_invoices` + `send_monthly_report` filtraient
  `'BROUILLON'` au lieu de `'BROU'` → matchaient 0 ligne ; + accès invalide
  `facture.client_name` corrigé.

## 2026-10-02 — ⚡ Performance SQL : index réactivés + migrations 0262/0263 + filtres dates

### Pourquoi

Les casts `__date` neutralisaient les index btree PostgreSQL sur les colonnes
datetime ; plusieurs filtres/joins manquaient d'index ; 3 index Meta étaient
des doublons des index FK automatiques.

### Changements backend

- **~60 casts `__date` supprimés** → bornes datetime `[jour 00:00, lendemain
  00:00)` via le nouveau `utils/dates.py` (`day_start`, `day_bounds`) —
  les index `date` sont de nouveau utilisables.
- **Bug `__lte=<date>` corrigé** sur 6 sites : le jour de fin était exclu
  (borne à 00:00) → borne exclusive lendemain partout.
- **Migration `0262`** : 26 index ajoutés via `CREATE INDEX CONCURRENTLY`
  (`atomic=False` + `SeparateDatabaseAndState`) — déployable sans lock sur
  une base en service.
- **Migration `0263`** : 3 index redondants supprimés (`FactureProduit.produit`,
  `FactureProduit.facture`, `Produit.fournisseur` — doublons des index FK auto).

### Frontend

- `CommandeProductRow` : Rotation affiche `toFixed(1)` (les valeurs < 0,5
  s'affichaient `0`, confondues avec "pas de rotation" `-`).
- `Perimes.tsx` : filtre date réparé (`created_at__gte/lte` au lieu de
  `__date__gte/lte` silencieusement ignoré).

## 2026-10-01 — 🛡️ Remédiation P2 : validation des query params + robustesse frontend

### Pourquoi

Troisième vague de l'audit des entrées (`AUDIT_INPUTS.md`) : les paramètres de
requête GET et listes d'IDs n'étaient presque jamais validés. Une date, un ID
ou un nombre mal formé finissait soit en HTTP 500 (`ValueError`/`ValidationError`
dans les filtres ORM), soit — pire — en **filtre silencieusement ignoré**
renvoyant des résultats non filtrés, trompeurs pour l'utilisateur.

### Helpers centralisés (`backend/api/utils/validation.py`)

- `parse_id` : entier ≥ 1 ou `ValidationError` (400) — fin des `ValueError → 500`
  sur `id__in=['abc']`, `get(pk='x')`, `filter(user_id='...')`.
- `parse_date_param` : date ISO ou 400 — fin des chaînes brutes dans les
  filtres `__date__gte`/`__gte`.
- Règle uniforme : **paramètre absent → comportement par défaut inchangé ;
  paramètre fourni mais invalide → 400 explicite**.

### Backend — query params & payloads validés (~35 fichiers)

- **Stock/inventaire** : `analysis`, `cadencier`, `ruptures`, `stock_lots`
  (dates expiration, `lot_ids` bulk), `etat_inventaire`, `inventaire_main`
  (`filter_id`/`inventaire_id`), `inventaire/bulk` (liste `ids`), `stats`.
- **Ventes/caisse** : `caisse` (dates, `user`, `poste_caisse`), `caisse_poste`
  (`pk` détail, `poste_caisse`, `hide_amounts` via `parse_bool` — fin du piège
  `bool("false") == True`), `creances` (dates, `client_id`, `paiement_id`,
  bornes `mode_paiement`/`reference` contre `DataError`), `mouvements`,
  `client_credit`, `bulk_actions`, `historique_*`, `comptabilite` (dates
  OHADA, `ligne_ids`).
- **Commandes/divers** : `suggestions` (`periode`, `fournisseur_id`,
  `budget_max`, dates ISO ventes horaire), `bulk_actions_mixin` (`ids`,
  `source_commande_id`), `paiements`, `interactions` (`substance`),
  `planning` (`from_day` → 400 au lieu d'être ignoré ; >nb_jours toujours
  clampé), `produits` (filtres numériques + IDs relation), `users`,
  `dci_admin`, `fournisseurs`, `schedules`.
- **Stats/rapports/dashboard** : `finance_stats`, `temporal_analysis`,
  `margin_views`, `challenges`, `dashboard/*`, `omnisearch` (`limit`),
  `ordonnancier_view`, `rapports/*` (`poste_caisse_id`, IDs filtres,
  `conditions` JSON invalide → 400, `limit` borné), `audit`.
- **Divers** : `purge` (`sans_ventes` via `parse_bool`), `sales_actions`
  (`mode_paiement` borné, `sync_mobile` accepte `produit` **ou** `product_id`),
  `serializers/billing` (`client_name_override` borné à 100 car.).

### Frontend

- `maxLength` alignés aux `CharField` des modèles, `isFinite`/`min`/`required`
  sur les champs montants, bug de concaténation `'2'+'3'='23'` corrigé dans la
  fusion de lots commandes, `QuickCreateProductModal` envoie des valeurs
  normalisées, `OrdonnanceModal` champs morts retirés, traductions fr+en.

### Tests mis à jour (contrat volontairement changé)

4 tests figeaient le fallback silencieux — alignés sur le nouveau contrat 400 :
`test_creances` (dates), `test_integration_recent_fixes` (omnisearch `limit`),
`test_planning` (`from_day='abc'`), `test_rapport_dynamique_robustness`
(`conditions` JSON).

### Vérification

- Compilation Python OK · `manage.py check` : 0 issue.
- Suite complète `api.tests` : 857 tests → 4 échecs (tests obsolètes, corrigés)
  puis **OK** sur les modules touchés (146 + 74 tests relancés, 0 échec).
- Build frontend `npm run build` : OK.

## 2026-10-01 — 🗓️ Couverture tests : planning.py + settings.py (153 tests) + fixes prod

### Pourquoi

Suite de la campagne de couverture backend : `planning.py` (16%) et `settings.py`
(24%) étaient parmi les modules critiques les moins testés (planning opérateurs,
congés, configuration pharmacie, rapports Telegram/WhatsApp). Deux sous-agents
en parallèle ont produit les tests ; la passe de contrôle a débusqué et corrigé
des bugs réels.

### Bugs production corrigés

- **`planning.py`** : `ShiftScheduleViewSet.generate` plantait en 500 si
  `from_day` dépassait le nombre de jours du mois (`datetime.date` ValueError) —
  la valeur est maintenant bornée `[1, nb_jours_du_mois]`.
- **`settings.py`** : le rapport flash Telegram utilisait `status='VALIDEE'`
  (inexistant — la valeur DB est `'VAL'`) et les champs `stock_quantity` /
  `est_actif` qui n'existent pas sur `Produit` → fallback de statistiques
  silencieusement faux. Corrigé avec `Facture.Status.VALIDEE`,
  `stock__lte=0`, `is_active=True`.
- **`serializers/planning.py`** : `LeaveRequestSerializer.user` était requis en
  entrée alors que `perform_create()` assigne toujours `request.user` → toute
  création de congé sans champ `user` retournait 400. Le champ est maintenant
  `read_only`.

### Nouveaux tests

- `api/tests/test_planning.py` (**75 tests**) : `ShiftConfigViewSet` (singleton,
  upsert, régénération du mois), `ShiftScheduleViewSet` (CRUD, normalisation
  mois, doublons, assignments imbriqués, filtres, publish, stats, envoi aux
  opérateurs), algorithme `_build_assignments` (cycle travail/repos, rotation
  matin/nuit, gardes réservées aux pharmaciens, repos post-garde, congés
  approuvés → `CONGE`, modes équipe fixe/tournante, régénération partielle
  `from_day`, staffing minimal), `LeaveRequestViewSet` (visibilité
  user/admin, approbation/rejet, solde de congés).
- `api/tests/test_settings.py` (**78 tests**) : `PharmacySettingsView`
  (singleton auto-créé, PUT admin-only, validations email/régime fiscal/TVA/
  largeur ticket, JSON payment modes, audit), `InvoiceConfigurationView`,
  `LoyaltySettingViewSet`, `ConfigurationOptionViewSet` (pagination, filtres,
  unicité type+code), `TVAViewSet` (CRUD, tri décroissant, doublons),
  endpoints WhatsApp/Telegram/rapports (credentials manquants, erreurs Meta/
  Telegram, timeouts, mocks HTTP).

### Vérification

- Ciblé : **153/153 OK** (1 skipped — endpoint WhatsApp non implémenté).
- Régression complète `api.tests` : **857 tests OK** (run validé sur la base
  consolidée incluant les remédiations P0/P1).
- ⚠️ Incident de run : une suite lancée en parallèle sans `--keepdb` a détruit
  `test_fullstack_db` en plein run → les tests doivent toujours passer
  `--keepdb` et ne jamais tourner en double.

### Fichiers touchés

- `backend/api/views/planning.py` (clamp `from_day`)
- `backend/api/views/settings.py` (statuts/champs réels)
- `backend/api/serializers/planning.py` (`user` read-only)
- `backend/api/tests/test_planning.py` (nouveau), `backend/api/tests/test_settings.py` (nouveau)
- Corrections lint accessoires : `creances.py`, `client_credit.py`,
  `historique_achats.py`, `rapports/inventory.py`, `historique_ventes.py`,
  `dashboard/statistiques.py`, `dashboard/fournisseurs.py` (`remaining or 0` —
  évite un 500 si `total_annotated` est `None`).

## 2026-10-01 — 📏 Remédiation P1 : bornes de valeurs, parsing centralisé, imports durcis

### Pourquoi

Deuxième vague du plan `AUDIT_INPUTS.md` §9 : P0 a bloqué les falsifications
(permissions/mass assignment) ; P1 ajoute les **bornes de valeurs** — négatifs,
NaN/infini, hors plage — au niveau des modèles (validators → auto-appliqués par
les ModelSerializers) et des endpoints d'écriture, plus un module de parsing
centralisé qui transforme les ~44 casts non protégés en 400 propres.

### Nouveau module `backend/api/utils/validation.py`

- `parse_decimal` / `parse_positive_decimal` / `parse_int` / `parse_bool` :
  rejettent bool, `None`, NaN, ±infini, non-entiers → `ValidationError` (400,
  messages français). `parse_bool` corrige le piège `bool("false") == True`.
- Constantes `MAX_DECIMAL_12_2` / `MAX_DECIMAL_10_2` / `MAX_DECIMAL_5_2` /
  `MAX_INT32` calées sur les champs du schéma → fini les `DataError` overflow → 500.
- `validation_error_message` : re-extrait le message pour les services qui
  remontent `ValueError` → 400 (`SaleFinalizer`, `SaleModifier`).

### Validators sur les modèles (migration `0261`, AlterField sans impact DB)

- **≥ 0** : `Produit` prix/pmp/seuils/réserve, `StockLot` quantités & prix,
  `Facture` remise/montant_verse/rendu/part_client/fidélité, `FactureProduit`
  prix/discount/free_qty, `LigneInventaire.quantite_physique`,
  `Client.plafond` (borne `-1` : sentinel « illimité »), `taux_couverture`,
  `PosteVente`/`SessionCaisse` fonds, `ClotureCaisse` réel/entrées/sorties,
  `PharmacySettings` (~30 champs numériques), `AvoirClient`, `LigneAvoirClient`…
- **0–100** : tous les taux (`Produit.tva`, `TVA.taux`, `Facture.tva`,
  `PharmacySettings` taux fiscaux, `LoyaltySetting.auto_reward_percent`…).
- **> 0** : `CouponMonnaie.montant`, `PaiementFournisseur.montant`,
  `Promis.quantite`, `CommandeProduit.quantity`, `LigneAvoir.quantity`,
  `RelationTransformation.ratio`, `Commande.taux_change`.
- **Non bornés volontairement** (documenté dans le code) : `Caisse.montant`
  (ajustements négatifs légitimes de `sale_modifier`), `FactureProduit.quantity`
  (retours `can_do_returns`), `Produit.stock` (négatif possible post-vente),
  `MouvementStock`, `solde_depot`/`solde_factures`, `Promotion.value` (montants
  fixes/packs).

⚠️ Les validators n'agissent que via les serializers (aucun `full_clean()` dans
le codebase) — c'est voulu : filet sans risque de migration bloquée par des
données existantes.

### Endpoints d'écriture durcis (400 au lieu de 500 / corruption)

- **Stock** : `sortir_perimes` (quantity entier >0 ≤ remaining — corrige
  l'inflation `-5` → `+5`), `adjust_stock` (new_quantity ≥0 fini),
  `transformations` (quantité + ratio >0 vérifié **avant** le bloc atomique),
  `inventaire_main` + `inventaire/bulk` + `csv_import` (`quantite_physique`
  entier ≥0, ids produit/lot assainis), `inventaire/validation` (garde-fou
  sur lignes héritées corrompues).
- **Commandes** : `bulk_sync` strict (`'abc'` n'est plus ramené à 0, erreurs
  collectées par ligne → 400 tout-ou-rien, prix négatifs non propagés à la
  fiche produit ; `quantity` négative rejetée, 0 toléré pour l'autosave),
  `bulk_actions_mixin`, `avoirs` (`quantity ≤ 0` → 400, corrige le retour
  de stock inversé), `promis` (`quantite > 0` — corrige `-500` → `+500` stock),
  `suggestions` (`abc_a_only` : `"false"` string n'est plus truthy).
- **Ventes/caisse** : `creances` `ajouter_paiement`/`bulk_paiement`/`vider`
  (montant >0 fini, `mode_paiement` doit être une string, ids normalisés),
  `caisse_poste` `fond_de_caisse` (décimal ≥0 fini), `coupons` (`facture_id`
  entier), `sale_finalizer`/`sale_modifier` (remise, prix, quantités,
  paiements, ids — tous bornés ; lignes de paiement ≤0 ignorées comme avant),
  `sale_validator` (`paiement_immediat` NaN → 400, `points_to_use` protégé),
  `comptabilite` `creer_lettrage` (`compte_id`/`ligne_ids` typés).
- **Clients** : `add_depot` rejette `Infinity`, `update_alerte` parse les
  booléens proprement.
- **Imports** : `produit_import`, `import_views`, `import_excel_csv`,
  `purge.import_produits` — rejet NaN/±infini, prix négatifs, TVA hors 0-100,
  stock négatif ; **limite 20 Mo** sur les uploads ; `purge` dates
  `date_from`/`date_to` invalides → 400 propre (était 500 ORM).

### Permissions résiduelles colmatées

- `StockAdjustmentViewSet` : `AllowAny` → `IsAuthenticated` (le journal
  d'ajustements était lisible anonymement).
- Les 7 endpoints Telegram/WhatsApp (`test`, `get-chat-id`, rapports flash/
  inventaire/mensuel) : `IsAuthenticated` → `IsAdminOrMenuAllowed` avec les
  clés menu des écrans appelants réels (settings, dashboard, ventes_historique,
  inventaire, statistiques) — tout compte connecté pouvait envoyer des messages
  avec les credentials de la pharmacie.

### Compatibilité préservée

- `bulk_sync` : `quantity=0` toléré (frontend envoie `parseInt()||0` sur lignes
  vides en autosave) ; seuls négatifs/valeurs invalides → 400.
- `_handle_payments` : lignes de paiement `montant ≤ 0` ignorées (contrat
  existant — lignes par mode inutilisé) ; `'abc'`/`NaN` → 400.
- `Client.is_loyalty_member`/`is_deposit_enabled` restent éditables (switches
  légitimes du formulaire client).

### Vérification

- `manage.py check` : OK. `makemigrations` : `0261` (validators uniquement).
- **Suite complète `api.tests` : 857 tests — OK** (2 écarts de contrat détectés
  et résolus : message « hors limites » prix vente, paiements ≤0 ignorés ;
  `test_commande_produits` mis à jour : `'abc'` → 400 au lieu du 0 silencieux).

### Reste P2

- Validation des query params GET (~20 endpoints → 500 aujourd'hui).
- `maxLength` frontend alignés aux `max_length` modèles ; `Number.isFinite`
  dans `validateSaleData` ; `mode_paiement` → `choices` ; concaténation
  `'2'+'3'='23'` fusion de lots ; `_cap_montant` silencieux → signaler.
- `hide_amounts` (caisse_poste) : `"false"` string masque les montants —
  sens inverse du safe, à trancher métier.

## 2026-10-01 — 🛡️ Remédiation P0 : blocage des falsifications financières et de permissions

### Pourquoi

Suite de `AUDIT_INPUTS.md` : les findings critiques (mass assignment sur les champs
financiers, PATCH/DELETE libres sur les enregistrements historiques, bypass sudo,
clôture de caisse falsifiable, configuration ouverte à tout compte authentifié)
sont exploitables par n'importe quel utilisateur connecté via un simple appel API.
Vague P0 = bloquer la falsification, sans toucher encore aux bornes de valeurs (P1)
ni à la robustesse 500/UX (P2).

### Backend — whitelists et méthodes HTTP restreintes

- **`FactureUpdateSerializer`** (`serializers/billing.py`) : seuls
  `client_name_override`, `montant_verse`, `montant_rendu`, `notes`, `date_document`,
  `client`, `ayant_droit`, `status` restent écritables en PATCH — la réponse garde
  la représentation complète (compatibilité frontend). `FactureViewSet.perform_update`
  n'accepte plus la transition `status → PAY` que si les paiements enregistrés
  couvrent le total TTC (kill le « marquer payé sans encaisser »).
- **PATCH/PUT/DELETE désactivés** (`http_method_names`) sur `CaisseViewSet`,
  `MouvementCaisseViewSet`, `FactureProduitViewSet`, `CouponMonnaieViewSet`,
  `PromisViewSet`. `PaiementFournisseurViewSet` garde DELETE (utilisé par l'UI)
  mais bloque PATCH/PUT.
- **Serializers d'update** : `StockLotUpdateSerializer` (seuls `lot` +
  `date_expiration`), `ProduitUpdateSerializer` (`stock`/`stock_reserve`/`pmp`
  read-only), `ClientSerializer` (`solde_depot`, `points_fidelite`,
  `solde_factures`, `pending_discount` read-only = fin de la monnaie fictive),
  `LigneInventaireUpdateSerializer` (seule `quantite_physique`),
  `InventaireSerializer` (`status`, `validated_by` read-only),
  `LigneAvoirUpdateSerializer`, `AvoirSerializer`, `AvoirClientUpdateSerializer`
  (statuts, totaux, audit read-only), `PromisSerializer` (`status` read-only).
- **`CaisseViewSet`** : création/bulk_create rejettent décimaux invalides, NaN,
  ±infini et montants ≤ 0.

### Backend — finalisation de vente (`sales_actions.py`)

- Rejet JSON mal formé / payload non-objet (400 au lieu de 500).
- Quantités, prix, remises : rejet NaN/infini, quantités non entières, prix et
  remises négatifs ; `int()` protégé.
- `quantity < 0` exige `can_do_returns` ; `is_avoir_client` ne contourne plus
  `can_validate_zero_amount`.
- `remise_validated_by_id` / `prix_validated_by_id` : l'ID client ne suffit plus —
  le mot de passe du validateur est re-vérifié via `validate_sudo_mode` (le
  frontend envoyait déjà `*_validated_password`).

### Backend — clôture de caisse (`cloture_mixin.py`)

- `montant_theorique_frontend` ignoré : théorique toujours recalculé serveur.
- `montant_reel` : rejet négatif, non fini, surdimensionné ; `user_id` /
  `poste_caisse_id` typés ; dates invalides → 400.
- `mouvements_manuels` schématisés (type `ENTREE`/`SORTIE`, montant positif fini,
  motif tronqué à 200 cars) ; `billetage` validé en profondeur.

### Backend — permissions configuration (`settings.py`, `promotions.py`)

- Nouvelle permission `IsAdminOrMenuAllowed` (pattern existant `CanAccessReports`) :
  écriture = staff/superuser OU `allowed_menus` contenant la clé —
  `ConfigurationOptionViewSet` (`inventaire`/`inventaire_organisation`),
  `LoyaltySettingViewSet` (`clients`), `TVAViewSet` (`settings`/`settings_pharmacie`),
  `PromotionViewSet` (`ventes`/`ventes_promotions`). La délégation existante par
  menus est préservée ; le compte lambda connecté est bloqué.
- `PharmacySettingsView` / `InvoiceConfigurationView` : restent `IsAdminUser`
  en écriture (comportement déjà admin-only — le trou PATCH contournant le
  `permission_classes` sur PUT seul est colmaté).

### Frontend

- `useSaleCompletion.ts` : les paiements (`bulk_create`, avoirs client, dépôts)
  sont créés **avant** le PATCH `status: 'PAY'` — requis par le contrôle serveur
  de couverture des paiements (était en parallèle → course aléatoire).

### Vérification

- `manage.py check` : OK. Compilation Python des fichiers touchés : OK.
- Tests backend ciblés : **340 passés, 0 échec** (sale_finalizer, facturation,
  sales_robustness, sensitive_permissions, caisse integrity/multi-payment/
  overpayment, settings, promotions, client_credit, commandes, creances,
  stock_inventory/management/loophole, client_financials/merge,
  facturation_contract, forced_sale, sale_modification_stock, purge,
  produit_filtering).
- Build frontend `npm run build` : OK.

### Reste à faire (P1/P2)

- Validators de bornes au niveau modèles (MinValueValidator/CheckConstraint).
- Helper `parse_decimal` centralisé contre les ~44 casts non protégés (500 → 400).
- Telegram/WhatsApp test endpoints encore `IsAuthenticated` simple.
- UX frontend : masquer les boutons d'écriture config sans permission (aujourd'hui → 403).

## 2026-10-01 — 🔍 Audit de validation des inputs (frontend + backend)

### Pourquoi

Demande utilisateur : vérifier que les inputs rejettent les données invalides
(ex : texte dans un champ numérique). Audit statique complet via 5 sous-agents
parallèles (facturation, caisse, stock/commandes/inventaire, produits/clients/
maintenance, validation backend transversale).

### Livrable

- **`AUDIT_INPUTS.md`** (nouveau, racine) — rapport complet classé par risque.

### Findings majeurs (aucune correction appliquée)

- 🔴 **Mass assignment** : ~12 `ModelViewSet` exposent `PATCH/DELETE` avec
  `fields='__all__'` et sans `read_only_fields` — `Facture` (status, validated_by),
  `Caisse` (montant d'encaissements passés), `MouvementCaisse`, `FactureProduit`,
  `CouponMonnaie`, `PaiementFournisseur`, `Client` (`solde_depot`, `points_fidelite` !),
  `Produit` (stock/prix/pmp), `StockLot`, `Inventaire` (status), `Avoirs`, `Promis`.
- 🔴 **Valeurs négatives acceptées** → corruption stock/finance : `sortir_perimes`
  (-5 → +5 stock), `adjust_stock`, `promis` (création de stock), lignes commandes/
  avoirs/inventaire, paiements créances/fournisseurs négatifs, coupons négatifs.
- 🔴 **Bypass sudo** : `remise_validated_by_id`/`prix_validated_by_id` =
  n'importe quel user_id sans preuve (`sales_actions.py:189-218`) ;
  `is_avoir_client` flag client contourne `can_validate_zero_amount` ;
  `montant_theorique_frontend` falsifie l'écart de clôture ;
  `LoyaltySetting`/`ConfigurationOption`/`Promotion`/`TVA` en `IsAuthenticated` écriture.
- 🔴 **NaN/Infinity** → `InvalidOperation` → 500 (caisse, créances, clôture) ou
  `Decimal('NaN')` persisté en `numeric` (imports produits, bulk_sync).
- 🟠 ~44 casts `int()/Decimal()` non protégés → 500 au lieu de 400 ;
  ~8 champs texte > `max_length` → `DataError` → 500.
- 🟡 Frontend : `normalizeNumberInput` → 0 silencieux ; filtres `[^0-9.]` acceptent
  `'1.2.3'` ; nombreux `type="number"` sans `min` ; concaténation `'2'+'3'='23'`
  dans la fusion de lots de commandes.

### Recommandations

Plan de remédiation P0/P1/P2 dans `AUDIT_INPUTS.md` §9 — en attente de décision
utilisateur avant toute modification.

## 2026-10-01 — 🧪 Tests commande-produits/interactions + 5 bugs production corrigés

### Pourquoi

Suite de la campagne de couverture backend (2 sous-agents en parallèle) :
`commandes/commande_produits.py` (18%) et `interactions.py` (24%).

### Bugs production corrigés

- **`commande_produits.py` — création de ligne possible sur commande
  clôturée** : `perform_create` ne vérifiait pas `commande.status`
  (contrairement à update/destroy/bulk_sync). → `PermissionDenied` (403).
- **`commande_produits.py` — crash 500 si `selling_price` fourni sans
  produit** : accès à `commande_produit.produit` sans garde → ajout du
  test `produit_id`.
- **`commande_produits.py` — `bulk_sync` crashe (500) sur données non
  numériques** : `int()` sur `quantity`/`unites_gratuites`/`id`/`produit`
  non parsables → helper `to_int()` avec défaut sûr.
- **`commande_produits.py` — `parse_expiration` crashe (500) sur dates
  malformées** (`a-b-c`, `2026-13-01` → `ValueError`/`IllegalMonthError`) :
  wrappé en try/except → retourne `None` (date ignorée).
- **`interactions.py` — `?search=` ignoré silencieusement** : la vue
  définissait une méthode `get_search_fields()` orpheline alors que DRF
  `SearchFilter` lit l'attribut `search_fields` → la recherche texte ne
  filtrait jamais. Remplacé par l'attribut.
- **`interactions.py` — paire inversée → 500 au lieu de 400** : la
  normalisation de paire (substance_a < substance_b) se fait après le
  `UniqueTogetherValidator`, qui valide l'ordre soumis. Une paire
  inversée d'une interaction existante passait puis levait un
  `IntegrityError` → garde-fou `ValidationError` ajouté dans
  `perform_create`/`perform_update` (`views/interactions.py`).

### Nouveaux tests (78)

- **`tests/test_commande_produits.py`** (41) : CRUD complet, blocage
  création/update/partial/destroy sur commande `CLOT`, filtre `?produit=`
  (uniquement commandes réceptionnées), `bulk_sync` (création, update,
  suppression des lignes absentes, payload vide, parsing dates `MM/YY`
  et ISO, warnings marge négative / prix de vente manquant, sync fiche
  produit TVA/prix/marge, commande clôturée/inexistante), `correct_lot`
  (correction lot+date même sur commande clôturée, date invalide/effacée,
  mise à jour du `StockLot` associé).
- **`tests/test_interactions.py`** (38) : CRUD interactions
  médicamenteuses, normalisation automatique des paires, rejet doublon
  même ordre **et ordre inversé** (400), filtres `gravity`/`substance`
  (a OU b)/`search`/`ordering`, endpoint `stats`, `upload_csv`
  (auto-création des substances, update existant, lignes invalides
  skippées, encodages utf-8/latin-1/cp1252, compteurs), fonction
  `_normalize` (accents/casse/ponctuation).

### Vérification

- 78/78 tests ciblés verts, régression complète **704 tests OK**
  (3 skipped), `manage.py check` propre.
- Déployé via `deploy.ps1 -Target backend`.

## 2026-10-01 — 🧪 Tests maintenance/purge/backups + 3 bugs production corrigés

### Pourquoi

Suite de la campagne de couverture backend : `purge.py` (13%, destructif)
et `backup_views.py` (16%, sauvegardes) non couverts.

### Bugs production corrigés

- **`purge_produits` et `run_update` crasheaient (500)** sur tout appel :
  `authenticate(username=..., password=...)` appelé **sans `request`** →
  `AxesBackendRequestParameterRequired` car `axes.backends.AxesBackend`
  est le premier backend d'auth. Passage de `request` dans les 2 appels
  (`views/purge.py`).
- **Restauration/suppression de backup groupé impossible**
  (`backup_views.py`) : le frontend envoie `group_YYYY-MM-DD HH:MM:SS`
  (timestamp formaté) mais le `glob` cherchait ce format littéral alors
  que les fichiers sont nommés `YYYYMMDD_HHMMSS_<table>.sql.gz` →
  aucun match. Conversion du timestamp ajoutée (restore + delete).
- **Restore incrémental inexistant renvoyait `success: true`** : avec
  `backup_files=[]`, rien n'était restauré mais la réponse affichait un
  succès trompeur. → 404 si aucun fichier ne correspond.

### Nouveaux tests (48)

- **`tests/test_purge.py`** (37) : liste des tables, preview (comptes
  parents + enfants, filtre dates, table inconnue), export ZIP/CSV,
  purge (400 sans password, 403 mauvais password, 403 staff non-superuser
  même avec bon password, suppression réelle + CASCADE + AuditLog,
  respect de la plage de dates), `produits_count`, `import_produits`
  (400 sans fichier, 400 extension, 409 import en cours),
  `import_status` (idle/404), `export_produits` (xlsx), `purge_produits`
  (validation + `sans_ventes` conserve les produits liés à des ventes),
  `download_rapport` (400 traversal `../`, 404), `changelog` (404/200),
  `update_status`, `run_update` (403/404), `restore` (validations),
  `backup` (erreur commande → 500).
- **`tests/test_backup_views.py`** (11) : listage incrémental/complet/
  groupé (2 fichiers même timestamp → groupés), tailles formatées,
  création réelle via `docker exec pg_dump` (dans un répertoire
  temporaire), restore (400 sans filename, 404 full incrémental ou
  groupe absent), delete (fichier + groupe).

### Vérification

- 48/48 nouveaux tests OK, régression **172/172** (purge + backups +
  finance + créances + suggestions + rapports + user management),
  `manage.py check` propre.

### Note technique

Le socket Docker est accessible depuis le conteneur backend
(`DOCKER_HOST=tcp://docker-socket-proxy:2375`) — `CreateBackupView`
exécute réellement `docker exec <db> pg_dump` en dev. Les tests restore
retournent 400/404 **avant** `docker stop` donc le conteneur n'est
jamais arrêté pendant les tests.

### Reste à couvrir

`commandes/commande_produits.py` (18%), `interactions.py` (24%),
`consumers.py`/signals (0%), `planning.py` (16%), `settings.py` (24%).

## 2026-10-01 — 🧪 Tests rapports financiers + bug export comptable corrigé

### Pourquoi

`rapports/finance.py` était le plus gros trou de couverture mesuré (7%,
891 lignes non testées) — endpoints servant les chiffres financiers au
pharmacien. L'audit a aussi révélé que plusieurs fichiers de tests
« existants » ne tournaient jamais.

### Bug production corrigé

- **`export_comptable_csv` crashait (500)** dès qu'une facture existait dans
  la période : `format_doc_date` était utilisé mais jamais importé
  (`views/rapports/finance.py` ligne ~476). Ajout de l'import depuis
  `api.utils_doclang`.

### Nouveaux tests — `tests/test_finance.py` (43 tests)

Couvre les 18 endpoints du mixin finance :
- **JSON** : `rapport_mensuel`, `rapport_par_dates`, `rapport_ca_multi_annuel`
  (structure 13 lignes + totaux annuels), `rapport_tva_vendus` (calcul TVA
  19.25% vérifié), `rapport_remises`, `rapport_remises_details`,
  `rapport_detail_marges` (lot alloué, fallback PMP "SANS LOT", filtre marge
  négative, groupement par produit avec statut PERTE/FAIBLE/OK),
  `stats_marges` (lignes jour + TOTAL).
- **Rapport dynamique** : sources `ventes`/`achats`/`stock`, `group_by`,
  `sort_by`, conditions.
- **Exports** : `export_comptable_csv` (contenu CSV, montants format FR),
  `export_sage_i7` (journaux VT/CA, comptes 411100/701100/571100, libellé
  `Regl Espèces` — régression du fix `get_mode_paiement_display`),
  `livre_caisse_excel` (2 feuilles, solde jour = espèces + entrées − sorties),
  `rapport_remises_excel`, `rapport_remises_details_excel`,
  `rapport_general_excel`, `rapport_mensuel_pdf`, `rapport_par_dates_pdf`.
- **Fiscal** : `rapport_fiscal_mensuel` — accompte droit commun réel
  (CA HT × 2% + CAC 10%), marge administrée (marge brute × 14%), erreurs
  sans settings/dates.
- **Sécurité** : 401 non authentifié, 403 sans menu `statistiques`.

### Tests morts réactivés (13 de plus)

- `test_rapport_modular.py` + `test_rapport_dynamique_robustness.py` :
  classes pytest pures sans `TestCase` → **jamais découvertes par le runner
  Django** (ni erreur ni exécution). Converties en `TestCase` — 9 tests.
- `test_stats_discrepancy.py` : 2 échecs 403 pré-existants — le test créait
  un pharmacien sans `allowed_menus`, refusé à juste titre par
  `CanAccessReports`. Ajout du menu `statistiques` dans le setup.

### Vérification

- 99/99 tests rapports passent (43 finance + 9 réactivés + marges +
  créances + suggestions + discrepancy), `manage.py check` propre.

### Reste à couvrir

`purge.py` (13%), `backup_views.py` (16%), `commandes/commande_produits.py`
(18%), `interactions.py` (24%), `consumers.py`/signals (0%).

