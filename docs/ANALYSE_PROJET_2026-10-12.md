# Rapport d'analyse complète — Zenith Pharma (fullstack_produits)

**Date** : 2026-10-12
**Méthode** : 5 sous-agents d'audit en parallèle (backend/API, frontend, sécurité, infrastructure, tests/fiabilité) + résultats du test de charge du 2026-10-12. Lecture statique du code ; constats vérifiés avec références `fichier:ligne`.
**Périmètre** : backend Django 5/DRF/Channels, frontend React 19/Vite 7, Docker Compose dev + prod "zenith", scripts d'installation/mise à jour, licence/keyday, WebSockets, CI.

---

## 1. Résumé exécutif

Produit **fonctionnellement riche et architecturalement sérieux** : couche de services métier (finalisation/validation/annulation de vente), verrous pessimistes sur le stock, idempotence Redis, audit log, suite de ~950 tests backend, ~430 tests frontend, PWA, i18n fr/en, déploiement Docker complet avec watchdog et mises à jour automatiques.

Mais l'audit révèle une **maturité inégale** : la chaîne de résilience production (watchdog, rollback, hot-deploy, smoke test) est en grande partie **inopérante** à cause d'une dérive de nommage dev/prod ; plusieurs **failles de sécurité directement exploitables** existent (comptes admin à mots de passe publics, CRUD catégories sans auth, WebSockets ouverts) ; et des défauts d'**intégrité de données** subsistent dans les chemins concurrents (validation d'inventaire, transitions de statut).

**Verdict synthétique** : cœur métier solide (vente, stock, caisse), périphérie fragile (déploiement, résilience, surface de sécurité). Les problèmes critiques sont tous corrigeables et circonscrits — aucun n'est structurel.

### Comptage des constats

| Gravité | Nombre | Domaines dominants |
|---|---|---|
| 🔴 Critique | ~15 | Sécurité (auth/authz), intégrité des données, chaîne de déploiement prod |
| 🟠 Majeur | ~20 | Concurrence/verrous, observabilité, couverture de tests du tunnel de vente, UX frontend |
| 🟡 Mineur | ~30 | Dette de code, duplications, config, hygiène |

---

## 2. Points forts vérifiés

### Backend
- **Services métier explicites** (`api/services/`) : `sale_finalizer`, `sale_validator`, `sale_canceller` — viewsets fins, logique testable.
- **Transactions & verrous** : `select_for_update` sur produits/lots, `F()` pour les décréments, `DocumentCounter` verrouillé pour la numérotation, `order_by('id')` anti-deadlock.
- **Idempotence** : `api/idempotency.py` (SETNX + sentinelle in-progress, TTL 24 h) + header `Idempotency-Key` reconnu par le retry axios.
- **Idempotence & soft delete** : factures validées jamais supprimées physiquement ; corbeille sur produits/clients/commandes.
- **Purge encadrée** : `base_filter` empêchant toute purge de factures VAL/PAY, IsAdminUser + mot de passe.
- **Performance** : index GIN trigram sur noms/CIP, `select_related`/`prefetch_related` systématiques, subqueries anti-produit-cartésien, `cache_page`, anti-stampede sur `ClientDebtCache`.
- **Sécurité de base** : Argon2, `SECRET_KEY` obligatoire, `DEBUG=False` par défaut, CORS restreint en prod, aucun `eval`/`exec`/`.raw()`/`.extra()` trouvé.

### Frontend
- **Routing** : ~60 routes déclaratives lazy avec guards (`ProtectedRoute`, `PermissionRoute`), `lazyWithRetry`, `RouteErrorBoundary` avec auto-reload sur chunk error.
- **Couche API propre** : intercepteurs axios (token, retry idempotent ×3, gestion 401/403/429/5xx, toasts offline/online).
- **Patterns UI** : `useConfirm` (aucun `alert()` natif), `gooeyToast` unifié, skeletons/empty states, `BackendHealthCheck` diagnostique.
- **i18n** : fr/en complets, clés structurées.
- TypeScript strict, seulement ~23 `any`.

### Tests
- 78 fichiers backend / ~952 tests avec assertions DB réelles (ventes, caisse, stock/FEFO, commandes, clients) ; smoke tests auto-alimentés (`test_routes_smoke.py` parcourt dynamiquement `urls.py` et échoue sur routes protégées accessibles sans auth).
- 52 fichiers frontend / ~432 tests, setup de mocks riche (i18n avec vraies locales fr).
- CI GitHub Actions : ruff, pytest (Postgres+Redis), eslint, typecheck, build.
- Load test réaliste réutilisable (`scripts/load_test_api.py` + `purge_loadtest_data`).

---

## 3. Constats critiques (🔴)

### 3.1 Sécurité

| # | Constat | Référence |
|---|---|---|
| S-C1 | **Comptes superadmin à mot de passe public, recréés automatiquement** : `admin`/`admin123` (entrypoint.sh:162, install.sh:180, utils_licence.py:84-86), `sysadmin`/`ChangeMeImmediately123!` (migration 0181, ensure_emergency_admin.py:32). L'endpoint public `login_options` énumère les comptes. Exposés via Tailscale Funnel. | `backend/entrypoint.sh:162`, `api/utils_licence.py:84`, `install.sh:180` |
| S-C2 | **CRUD rayons sans authentification** : `CategoriesListView`/`CategoriesDetailView` = `AllowAny` + `authentication_classes=[]` avec POST/PUT/DELETE physique. Seul throttle anonyme 100/j, aucun audit. | `api/views/categories.py:208-258`, `urls.py:288-289` |
| S-C3 | **3 WebSockets sur 5 sans auth** : `CashierConsumer`, `PDAConsumer`, `CaisseCentraliseeConsumer` acceptent tout le monde ; le middleware laisse passer sans token. **Un attaquant peut injecter de faux articles en caisse** via `PDAConsumer.receive` → groupe `cashier`. | `api/consumers.py:23-26,60-63,80-87,101-104`, `ws_auth_middleware.py:48` |
| S-C4 | **Réplication Postgres en `trust` 0.0.0.0/0** : tout hôte joignant 5432 peut lire toute la base sans mot de passe. | `init-db.sh:17-20` |
| S-C5 | **Throttle login contournable par X-Forwarded-For** : `USE_X_FORWARDED_FOR=True` sans proxy de confiance → spoof IP → bruteforce illimité. De plus le login utilise `check_password` direct → **django-axes ne protège pas** `/api/auth/token/`. Login par mot de passe seul = oracle multi-cibles. | `settings.py:45`, `api/views/users.py:76-90` |
| S-C6 | **Oracle admin non throttlé via `/api/licence/`** : `check_password` sur tous les superusers à chaque POST, pas de throttle ni Axes ; keyday = 6 hex dérivés de `SECRET_KEY` (~16,7M combinaisons, valable jour J et J+1). | `api/views/licence.py:40-51,67-71`, `api/keyday.py` |
| S-C7 | **Licence qui n'expire jamais** : `jwt.decode(verify_exp=False)` + aucun contrôle de date → une licence à durée limitée installée est à vie. Risque métier pour l'éditeur. | `api/utils_licence.py:276-279,241-319` |
| S-C8 | **Secrets métier exposés à tout authentifié** : `PharmacySettingsSerializer(fields='__all__')` inclut `telegram_bot_token`, `whatsapp_access_token`, en lecture SAFE_METHODS pour tout compte (même vendeur), avec `Cache-Control: public, max-age=300`. | `api/serializers/config.py:45-50`, `api/views/settings.py:22-37,777-779` |

### 3.2 Intégrité des données

| # | Constat | Référence |
|---|---|---|
| D-C1 | **`validate_inventaire` : le 409 commit quand même** — `return Response(409)` depuis `transaction.atomic()` persiste les `bulk_update` lignes/lots/ajustements. Les versions des lots sont calculées puis **jetées** (jamais vérifiées). Le check de statut est hors transaction. | `api/views/stocks/inventaire/validation.py:43-47,90,185-194` |
| D-C2 | **Transitions de statut sans verrou document** : `cloturer`, `annuler_reception`, `validate_invoice` lisent le statut via `get_object()` sans `select_for_update` → deux requêtes concurrentes passent le check → **double réception/double validation/double décrément**. `Idempotency-Key` optionnel ne protège pas. | `api/views/commandes/cloture_mixin.py:61,459-464`, `services/sale_validator.py` |
| D-C3 | **`DocumentCounter` sérialise toutes les ventes** (~2-4 ventes/s global, confirmé par le test de charge du 2026-10-12 : palier sain ~30 clients, rupture à 50). Aussi : si appelé hors transaction englobante, le numéro est consommé même si l'écriture échoue. | `api/models/billing.py:885-898`, résultats load test |

### 3.3 Infrastructure / déploiement

| # | Constat | Référence |
|---|---|---|
| I-C1 | **Le `command:` des compose est du code mort** : `ENTRYPOINT` entrypoint.sh ignore `"$@"` → `DB_STATEMENT_TIMEOUT=300000`/`DB_LOCK_TIMEOUT=30000` **jamais appliqués** (migrations limitées à 30 s/5 s, et `|| echo` continue sur échec → app sur schéma non migré). `--loop uvloop`, `--timeout-keep-alive 75`, `--log-level warning` ignorés aussi. | `backend/entrypoint.sh:52-55,274-301`, `docker-compose.prod.yml:59-66` |
| I-C2 | **Watchdog prod surveille les mauvais conteneurs** : cherche `fullstack_produits-*-1` au lieu de `zenith-pharma-*` → status "unknown" → **boucle pg_dump + rollback échoué toutes les ~2-3 min** en production. Activé par défaut par install.sh. | `watchdog.sh:97-98,68-72`, `install.sh:306-317` |
| I-C3 | **Rollback automatique incapable de fonctionner** : cherche `fullstack_produits-*:previous` mais `nightly-update.sh` tag `zenith-pharma-*:previous` ; le fallback fait `down/up` avec les **nouvelles** images → "rollback" qui redémarre la version cassée. | `rollback.sh:42-48,119-136`, `nightly-update.sh:141-148,85-86` |
| I-C4 | **Hot-deploy n'applique jamais le frontend** : `update-app.sh` copie `frontend/dist/` qui est gitignored et absent du serveur → statut "done" affiché alors que l'UI reste à la version de l'image → mismatch API/UI silencieux. | `update-app.sh:178-183`, `.gitignore:34` |
| I-C5 | **Timeout systemd < timeout du build** : `TimeoutStartSec=600` vs `BUILD_TIMEOUT=900` → la mise à jour nocturne est tuée en vol entre `git reset` et le basculement → état incohérent. | `zenith-nightly-update.service:11`, `nightly-update.sh:33` |

### 3.4 Frontend

| # | Constat | Référence |
|---|---|---|
| F-C1 | **`manualChunks` toujours fragile** : le fix `vendor-radix` (2026-10-12) a corrigé le crash circulaire Radix, mais le graphe reste un maillage dense — le chunk entry importe statiquement ~15 feature-chunks et `dist/index.html` précharge 13+ chunks (vendor-xlsx, vendor-pdf au boot) → **lazy loading largement annulé** + risque résiduel de nouveau cycle. | `vite.config.ts:20-57,142-152`, `dist/index.html:23-35` |
| F-C2 | **`ws://` hardcodé → WebSockets morts en HTTPS** : `useStockRealtime` et `useCaisseRealtime` utilisent `ws://${location.host}` (seul `useDocumentLock` choisit `wss://`) → mixed content bloqué en prod HTTPS → temps réel stock/caisse inopérant sauf si `VITE_WS_URL` est posé. | `hooks/useStockRealtime.ts:56`, `hooks/caisse/useCaisseRealtime.ts:41` |

### 3.5 Tests / fiabilité

| # | Constat | Référence |
|---|---|---|
| T-C1 | **Le tunnel de vente frontend n'a aucune protection de régression** : `CaisseCentralisee.tsx` non testé, hooks `useFacturationActions`/`useCaissePayment`/`useSaleCompletion`/`useInvoiceModification` non testés — **et les tests Vitest ne tournent pas en CI** (aucun job `vitest run` ; `"test": "vitest"` lance le mode watch). Une régression d'encaissement passe verte. | `.github/workflows/ci.yml`, `package.json:12` |
| T-C2 | **Le middleware licence se désactive sous test** (`'test' in sys.argv`) : le vigile central du mode prod zenith n'a aucune couverture d'intégration → un bug de fallback peut bloquer ou libérer toute une installation client. | `api/middleware_licence.py:60` |

---

## 4. Constats majeurs (🟠) — synthèse

### Sécurité / permissions
- `AllowPrivateIPsMiddleware` ajoute dynamiquement tout Host IP privée à `ALLOWED_HOSTS` (mutation runtime, Host forgé neutralisable). `api/middleware/allow_private_ips.py:20-42`
- Comptabilité en écriture pour tout authentifié : `CompteComptable`/`JournalComptable`/`EcritureComptable` viewsets = seulement `IsAuthenticated`. `api/views/comptabilite.py:27-84`
- `DCIAdminViewSet` sans permission explicite (upload Excel, auto-match accessible à tout compte). `api/views/dci_admin.py:18`
- `MouvementCaisseViewSet` : création de sorties de caisse sans `can_*` alors que l'encaissement exige `can_cash_out`. `ventes/mouvements.py:18-29`
- Backend prod exposé `8000:8000` + `DJANGO_ALLOWED_HOSTS=*` → API joignable direct en contournant nginx. `docker-compose.prod.yml:73-74,87`
- `docker.sock` monté dans le backend + `docker run --privileged --pid=host nsenter` (system_admin.py:797-803) → admin applicatif = root hôte. Combiné à S-C1 : **RCE hôte**.
- TOCTOU sur `solde_depot` client (retraits concurrents → découvert). `clients.py:293-323`
- PII envoyée à Sentry (`send_default_pii=True`). Tokens DRF sans expiration. AuditLog lisible par tout authentifié.

### Intégrité
- Unicité CIP check-then-act sans verrou (`products.py:368-378`) ; `PosteVente.activer/ouvrir` → double ouverture de caisse possible. (`recalculate_stock_from_lots` : verrou laissé à la charge de l'appelant — convention documentée §6.)
- `caisse_poste.py:81-82` : garde-fou de suppression de caisse neutralisé sur erreur DB (`except` → `has_legacy_sessions=False`).
- `purge.py:450-451` : `except Exception: pass` avale l'échec du log d'audit de la purge — l'événement le plus important à tracer.

### Infrastructure
- **`maintenance.html` `internal` + précaché par le SW** → l'installation du service worker échoue → PWA/auto-update cassé. (`nginx.conf:110-112`, `vite.config.ts:70`)
- `deploy.ps1` : aucun smoke test post-déploiement (pas de `/api/health/`), `makemigrations` sur la cible, `restart` sans vérification.
- Backups incrémentaux cassés (mauvais nom de conteneur `fullstack_produits-postgres-1`) ; `cleanup-wal.sh` supprime les WAL par mtime sans ancrage → casse le PITR ; aucune rétention sur base backups.
- **Observabilité quasi nulle en prod** : `/app/logs` non monté (logs perdus au recreate), Sentry sans DSN par défaut, aucun metrics, alertes écrites dans un fichier que personne ne surveille.
- Chaîne webhook de déploiement (`webhook-deploy.py` → `auto-deploy.sh` → `deploy.sh`) cible les noms dev → non fonctionnelle en prod. `rollback.ps1:99` contient du bash dans du PowerShell.
- 3+ générations de scripts de déploiement coexistent (`deploy.sh`, `update.sh`, `deployment/auto_update.sh` obsolète bare-metal).

### Frontend
- **4 composants >1000 lignes** : `HistoriqueClotures` (~1400), `Comptabilite` (~1090), `Transformations` (~1010), `ModuleFinancier` (~1020). God hooks prop-drillés (`useFacturationState` ~830 lignes passé à 4 panneaux).
- Dark mode = ~2000 lignes de CSS de surcharge + 290 `!important` + double mécanisme `.theme-midnight`/`data-theme`. `index.css:4,736-2000`
- Deux kits UI parallèles (`shadcn/` vs `ui/` marqué `@deprecated` mais ~120 importeurs) ; restes vocabulaire DaisyUI (`bg-base-100`, `data-theme="corporate"`).
- ~100 `eslint-disable exhaustive-deps` (dont 8 dans `useFacturationState`).
- 176 `defaultValue` français dans les `t()` masquant les clés manquantes en anglais.
- `dangerouslySetInnerHTML` ×3 sans DOMPurify (contenu locales — risque faible mais pattern à bannir).
- `react-hot-toast` mort (dep + chunk préchargé + mocks obsolètes dans 7 tests).

### Performance
- N+1 confirmés : `bulk_check_unpaid` (agg Caisse par facture), `exporter_excel` (~365 req/an exporté), `validation.py:219` (1 agg StockLot par produit → milliers de requêtes sur inventaire global), `dci_admin.unlinked` (200 substances/produit).
- `produits.py:342` : `list()` de tous les produits actifs en mémoire pour le snapshot stock.
- `max_page_size=1000` élevé pour les exports lourds.

### Tests
- E2E Playwright (6 specs) jamais exécuté en CI ; `App.test.tsx` placeholder vide ; services 1/26 testés ; intercepteurs `api.ts` non testés ; couverture ~27 % statements.
- Import produits (`produit_import.py`, `import_excel_csv`) sans test — risque de corruption de masse.
- `paiements.py`/`comptabilite.py` sans test — écritures financières sans filet.
- Pas de smoke test post-déploiement (cf. I-C5 déploiement).
- Superuser `sysadmin`/`ChangeMeImmediately123!` créé par la migration squashed sur fresh install.
- `requirements.txt` sans `pytest`/`pytest-django` (CI installe ad hoc, non pinné).
- Migration `0254` crée des index sans `CONCURRENTLY` dans une transaction (verrou écriture sur `api_facture`).

---

## 5. Matrice de risque consolidée

| Risque | Probabilité | Impact | Priorité |
|---|---|---|---|
| Prise de contrôle hôte (admin par défaut + docker.sock + licence oracle) | Haute si LAN/Funnel exposé | Total | **P0** |
| Fausse vente injectée via WebSocket non auth | Moyenne (LAN pharmacie) | Fort (confiance client) | **P0** |
| Données rayons supprimées par n'importe qui | Moyenne | Fort | **P0** |
| Corruption stock par race (inventaire 409-commit, double clôture) | Moyenne | Fort | **P0** |
| Mise à jour nocturne tuée en vol → app cassée au matin | Moyenne-haute | Fort | **P0** |
| Watchdog en boucle de faux rollbacks + remplissage disque backups | Haute en prod zenith | Moyen | **P0** |
| Migration >30 s échoue silencieusement → schéma décalé | Moyenne | Fort | **P1** |
| Temps réel mort en HTTPS (`ws://`) | Certaine si HTTPS | Moyen | **P1** |
| Régression encaissement non détectée (pas de tests CI frontend) | Moyenne | Fort | **P1** |
| Mismatch API/UI après hot-deploy | Haute | Moyen | **P1** |
| PWA jamais installée (maintenance.html 404) | Certaine | Moyen | **P1** |
| Licence "à durée" qui n'expire pas (perte revenus) | Certaine | Moyen (business) | **P1** |
| Saturation écriture au-delà de ~30 users actifs | Selon charge | Moyen | **P2** |
| N+1 sur exports/inventaire à grande échelle | Moyenne | Moyen | **P2** |

---

## 6. Plan d'action recommandé

> **Mise à jour 2026-10-12 — P0 exécuté et vérifié.** Items 1-7 (sécurité),
> 8-9 (intégrité) et 10-14 (déploiement) corrigés : `IsAuthenticated` sur les
> catégories (+ audit, - cache_page), auth sur les 3 WebSockets (+ token côté
> `useCaisseRealtime`), `LicenceSudoThrottle` 20/j, masquage des secrets
> `PharmacySettings` + `no-store`, `NUM_PROXIES`/`AXES_IPWARE_PROXY_COUNT`,
> retrait `replication trust`, `must_change_password` end-to-end (middleware +
> endpoint + écran forcé + migration 0273), `set_rollback` + verrous lots dans
> `validate_inventaire`, `select_for_update` sur `cloturer`/`annuler_reception`/
> `validate_invoice`, `DB_*TIMEOUT` en `environment:`, watchdog/rollback
> paramétrables + garde-fou, `TimeoutStartSec=1800`, healthcheck post-update +
> rollback réel, hot-deploy = backend seul, `maintenance.html` hors precache.
> **Reste P0 partiel** : keyday gardé à 6 caractères (le throttle 20/j rend le
> bruteforce ~2 300 ans — le rallongement casserait la compat avec les
> installs déployées ; documenté), licence sans expiration (décision métier à
> trancher séparément). À tester sur un vrai déploiement zenith : watchdog,
> rollback et nightly-update end-to-end.
>
> **Audit des races sur les mouvements de stock (2026-10-12, suite)** : les
> 76 verrous recensés couvrent **tous les chemins d'écriture en exploitation**
> (ventes, réceptions/clôtures, avoirs, promis, transformations, réappro,
> ajustements, validation d'inventaire, obligations, `DocumentCounter`).
> Deux exceptions assumées : (1) les **imports Excel**
> (`produit_import.py`, `import_views.py`) écrivent `produit.stock` en
> read-modify-write sans verrou — opération one-shot à l'installation, hors
> concurrence → risque accepté, aucun fix ; (2) **`Produit.recalculate_
> stock_from_lots()`** réécrit stock dérivé des lots — *convention* : tout
> appel doit se faire sous verrou produit (`select_for_update`) détenu par
> l'appelant. Correctif connexe : `adjust_stock`/`transfer_to_shelf` sur pk
> inexistant → `get_object_or_404` (404 au lieu de 500).

### P0 — Sécurité immédiate (1-2 jours)
1. Supprimer/générer aléatoirement tous les mots de passe admin par défaut ; forcer le changement au premier login ; retirer `admin123` d'`install.sh` et des messages affichés.
2. `IsAuthenticated` sur `CategoriesListView`/`CategoriesDetailView` (ou suppression — le ViewSet authentifié suffit).
3. Vérifier `scope['user'].is_authenticated` dans `CashierConsumer`/`PDAConsumer`/`CaisseCentraliseeConsumer` + rejeter sans token dans `TokenAuthMiddleware`.
4. Retirer les lignes `replication … trust` de `init-db.sh`.
5. `NUM_PROXIES` + proxy de confiance pour `X-Forwarded-For` ; passer le login par `authenticate()` (active axes).
6. Throttler `/api/licence/` POST ; rallonger le keyday et le dériver d'un secret dédié.
7. Serializer admin dédié pour `PharmacySettings` (secrets en `write_only` ou exclus) + retirer `Cache-Control: public`.

### P0 — Intégrité (1-2 jours)
8. `validate_inventaire` : `transaction.set_rollback(True)` avant les returns d'erreur ; vérifier les versions lots ; check statut dans la transaction. Écrire un test de double-validation.
9. `select_for_update` sur le document dans `cloturer`/`annuler_reception`/`validate_invoice` ; `Idempotency-Key` obligatoire.

### P0 — Déploiement (1 jour)
10. Corriger le duo ENTRYPOINT/command (passer `DB_STATEMENT_TIMEOUT` en `environment:` ou `exec "$@"` en fin d'entrypoint).
11. Paramétrer les noms de conteneurs/images dans `watchdog.sh`, `rollback.sh`, `nightly-update.sh` + garde-fou "conteneur introuvable ≠ unhealthy".
12. `TimeoutStartSec=1800` ; smoke test `/api/health/` post-recreate dans `deploy.ps1`/`nightly-update.sh` avec rollback réel.
13. Fixer le hot-deploy frontend (builder dist sur le serveur ou artefact déployé).
14. Retirer `maintenance.html` du precache ou le flag `internal`.

### P1 — Fiabilité (semaine)
15. Job `frontend-test` (`vitest run`) + job Playwright dans `ci.yml` ; tester `LicenceMiddleware` (flag `settings.TESTING` au lieu de `sys.argv`).
16. `ws://` → `wss://` dynamique dans les 2 hooks realtime.
17. Permissions explicites : comptabilité, DCI admin, `add_depot`, `MouvementCaisse`, audit log.
18. Monter `/app/logs` en prod ; Sentry DSN ou canal d'alerte ; `send_default_pii=False`.
19. Tests : tunnel de vente (hooks caisse), import produits, paiements/comptabilité, double-finalisation concurrente.

### P2 — Dette & perf (mois)
20. Refondre le chunking (feature-chunks par chemin → chunk `shared` explicite) ; vérifier que `dist/index.html` ne précharge que les vendors.
21. Découper les 4 composants >1000 lignes ; purger `react-hot-toast`, `Login.css`, `public/index.html`, scripts `fix-*`/`refactor-*`, fichiers `test_*.py` orphelins, `load_test*.py` obsolètes.
22. Raccourcir la fenêtre du verrou `DocumentCounter` (numéro attribué en fin de transaction ou séquence Postgres) pour lever le plafond d'écriture ~30-40 users.
23. Corriger les N+1 identifiés ; limiter `max_page_size` pour exports.
24. Unifier le kit UI (`ui/` → `shadcn/` ou documenter la frontière) ; parité i18n fr/en en CI.
25. Élaguer les générations de scripts de déploiement ; README dev (env, volume externe, npm build, ordre de démarrage) ; aligner `.env.example`.

---

## 7. Verdict « client méticuleux » — mis à jour par l'audit

**La réponse précédente se confirme et se précise :**

- **Pour une pharmacie unique sur LAN de confiance** : le cœur métier (vente, stock, caisse, FEFO) est bien construit et testé — achat défendable **à condition que P0 soit exécuté avant livraison**. Les défauts critiques sont concentrés et corrigeables, pas structurels.
- **Pour toute exposition au-delà du LAN** (Tailscale Funnel, multi-sites) : **non, pas en l'état** — la combinaison admin par défaut + docker.sock + endpoints sans auth constitue une prise de contrôle complète de l'hôte.
- **Pour l'éditeur** : la licence qui n'expire pas (S-C7) et la chaîne de mise à jour auto cassée (I-C2 à I-C5) sont des risques business directs : revenus non récurrents et installations cassées au réveil.

**Les 3 gages à exiger avant achat** (inchangés, confirmés par l'audit) : suppression des accès par défaut, smoke test post-déploiement fonctionnel, et engagement support/suivi — auxquels l'audit ajoute : preuve que la chaîne watchdog/rollback a été testée sur un vrai déploiement zenith.

---

## Annexes

- **Résultats load test 2026-10-12** : palier sain 30 clients (P95 2,8 s), rupture à 50 (P95 3,9 s, finalize P95 ~9,8 s), 0 % erreurs ; plafond écriture = `DocumentCounter` sérialisé (~2-4 ventes/s) ; 8 workers ≠ mieux (contention non-CPU).
- **Limites de l'audit** : lecture statique ; pas d'exécution de tests ni de `docker compose config` ; `security-headers.conf`, `produit_import.py` (validation uploads), `SmsService` non relus en profondeur ; présence d'un `.env` dans l'historique Git non établie ; exposition réelle Funnel dépend de la config Tailscale client.
