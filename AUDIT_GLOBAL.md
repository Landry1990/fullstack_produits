# Audit global — Fullstack Produits (Zenith Pharma)

> Évaluation réalisée le 2026-08-14. Base de travail pour les prochaines sessions.

---

## Métriques du projet

| Indicateur | Valeur |
|------------|--------|
| Modèles Django | 75 |
| Fichiers Python (hors migrations) | 413 |
| Fichiers TS/TSX (frontend) | 482 |
| Lignes Python (views) | ~28 700 |
| Lignes Python (serializers) | ~1 700 |
| Lignes Python (tests) | ~7 000 |
| Lignes TS/TSX (frontend) | ~100 000 |
| Fichiers de traduction (fr/en) | 83 |
| Lignes de traduction | ~15 500 |
| Migrations Django | 232 |
| Scripts PowerShell | 160 |
| Changelog | 2 825 lignes |
| Données prod | 2 813 factures, 4 940 produits, 7 users |

---

## Notes par catégorie

### 1. Architecture — B+

| Point | Note | Commentaire |
|-------|------|-------------|
| Modularité backend | A- | Vues éclatées en packages (`ventes/`, `commandes/`, `rapports/`) avec mixins |
| Modularité frontend | C+ | Encore trop de god components (15 fichiers > 40 ko, 5 > 60 ko) |
| Séparation des concerns | B | Hooks dédiés (`useCaissePayment`, `useCaisseSession`), mais logique encore mêlée |
| Stack moderne | A | Django 5, React 19, Vite 7, Tailwind 4, shadcn/ui |
| Temps réel | A | Channels/WebSocket pour caisse live |

### 2. Qualité du code — B

| Point | Note | Commentaire |
|-------|------|-------------|
| Lint frontend | A | 0 erreur, ESLint propre, 11 `console.log` résiduels, 3 `@ts-ignore` |
| Lint backend | C | Aucun linter Python configuré (ruff/flake8 absent) — à ajouter |
| Typage frontend | A- | TypeScript strict, **0 occurrence de `: any`**, 3 `@ts-ignore` |
| Typage backend | C | Pas de mypy, `# type: ignore` fréquents |
| God components | D | `PharmacySettingsForm` (89 ko), `SystemAdmin` (81 ko), `HistoriqueClotures` (68 ko) |
| Duplication | C | `MENU_HIERARCHY` dupliqué, mapping rôles dupliqué frontend/backend |
| Conventions | B+ | Commits propres, AGENTS.md détaillé |

### 3. Tests — C+

| Point | Note | Commentaire |
|-------|------|-------------|
| Tests backend | C+ | 34 fichiers, ~7 000 lignes, couverture partielle |
| Tests frontend | C | 38 fichiers : ~14 tests composants + ~24 tests hooks/utils/services. Pas négligeable mais couverture des flows critiques (caisse, clôture) faible |
| Tests E2E | F | Aucun (Playwright/Cypress) |
| Tests de régression | C | Pas de tests automatisés pour les flows critiques (vente, caisse, clôture) |

### 4. Sécurité — B-

> ⚠️ Corrections apportées le 2026-08-14 après vérification du code :
> - `verify_password` ne itère **pas** tous les users — il vérifie `request.user.check_password()` (utilisateur authentifié courant). Claim initial erroné.
> - `is_superuser` est `read_only_fields` **et** explicitement `pop()`-é dans `validate()` pour les non-superusers. Non settable via PATCH.
> - `AUTH_PASSWORD_VALIDATORS` est bien configuré (UserAttributeSimilarity, MinimumLength, CommonPassword). Claim "aucun validateur" erroné.

| Point | Note | Commentaire |
|-------|------|-------------|
| Authentification | B+ | Token DRF, throttle login `30/min`, throttle anon/user, Argon2 (pas PBKDF2) |
| Autorisation | A- | `IsAdminUser` sur CRUD, `is_superuser` read-only + pop() en validate pour non-superusers |
| Protection prod | B+ | Cython sur fichiers critiques, integrity check prévu |
| Endpoints exposés | C+ | `login_options` (AllowAny, exempté throttle) liste usernames actifs → énumération possible |
| Politique mot de passe | C | Validateurs Django présents mais `min_length=4` **trop faible** ; pas de lockout compte (throttle only) |
| Secrets | B | `SECRET_KEY` via env, pas hardcodée |
| Audit log | A | `log_audit` systématique sur create/update/delete |

### 5. Performance — B

| Point | Note | Commentaire |
|-------|------|-------------|
| Code-splitting frontend | B+ | Lazy loading par route, chunks dédiés par feature |
| Chunks > 600 ko | D | `tesseract-core.wasm` (4,5 Mo !), `bwip-js` (941 ko), `index` (786 ko) — tesseract à lazy-load impérativement |
| Cache backend | B | `SearchCache`, Redis, invalidate sur mutations |
| Requêtes DB | B- | `select_related`/`prefetch_related` utilisés, mais quelques N+1 probables |
| Pagination | B+ | `StandardResultsSetPagination` centralisé |
| Index DB | B | Migration `0231_p2_db_indexes` récente |
| PWA | A | Service worker, precache 184 entries, offline-ready |

### 6. i18n / Accessibilité — B+

| Point | Note | Commentaire |
|-------|------|-------------|
| Couverture fr/en | A | 83 fichiers, ~15 500 lignes |
| Clés manquantes | B | Quelques `defaultValue` en fallback |
| Responsive | B | Audit récent, fixes appliqués (tables, modales, textes) |
| Contraste / focus | B | shadcn/ui respecte les standards |
| Touch targets | B- | Quelques boutons < 32px restants |

### 7. DevOps / Déploiement — A-

| Point | Note | Commentaire |
|-------|------|-------------|
| Docker Compose | A | Dev + prod séparés, noms explicites |
| Script deploy | A | `deploy.ps1` complet (frontend, backend, migrations, backup, rollback) |
| Rollback | A | `rollback.ps1` avec option DB |
| Backup DB | A | Script dédié |
| Monitoring | B | Sentry intégré, mais pas de healthcheck endpoint |
| Keyday (support) | A | Code journalier pour support à distance — bien pensé |
| Changelog | A | 2 825 lignes, format structuré, à jour |

### 8. Fonctionnalités — A-

| Domaine | Couverture |
|---------|------------|
| Stock / Produits | A (4 940 produits, lots, péremptions, CIP, DCI) |
| Facturation | A (tiers payant, coupons, mixed payments) |
| Caisse | A (multi-poste, sessions, récap live, tickets) |
| Commandes | A (locales, directes, promis, réceptions) |
| Inventaire | A (saisie, journal, analyse, états) |
| Comptabilité | B+ (grand livre, balance, résultat, plan) |
| Statistiques | A (ABC, temporelle, vendeurs, fournisseurs) |
| Corbeille | A (centralisée, restore, purge) |
| Gestion utilisateurs | B (permissions granulaires, mais UI à refactor) |
| WhatsApp / Telegram / SMS | B+ (intégrations présentes) |

### 9. Hygiène repo — C

> Section ajoutée le 2026-08-14 (manquante dans l'audit initial).

| Point | Note | Commentaire |
|-------|------|-------------|
| Fichiers temporaires commités | D | `temp_check_syntax.py`, `temp_check_syntax2.py`, `temp_check_syntax3.py`, `temp_edit_hook.py` à la racine — à supprimer + gitignore |
| Docs éparpillées | C | 10 `.md` à la racine (`BACKUP-GUIDE`, `BACKUP-LINUX`, `BACKUP-README`, `README_DEPLOIEMENT`, `README-REBUILD`, `GUIDE-DEPLOIEMENT-CLIENT`, `SCALABILITY_P1_OPTIMIZATIONS`...) — `docs/` existe, l'utiliser |
| Scripts à la racine | C | ~30 scripts `.ps1`/`.sh`/`.bat` à la racine, souvent en double Win/Linux (`deploy.ps1`+`deploy.sh`, `backup-db.ps1`+`backup-db.sh`, `watchdog.ps1`+`watchdog.sh`) — `scripts/` existe, l'utiliser |
| Branches mortes | C | `origin/fix-crashes-and-race-conditions-2628960085828529288` et `feature/vitrine-publique` à supprimer ou merger |
| Dossiers outils IA | B | `.devin`, `.gemini`, `.windsurf` — raisonnable (3 outils), propre vs les 8 observés précédemment |
| `.gitignore` | B | Présent, mais ne filtre pas les `temp_*.py` |

---

## Note globale : B+ (16 / 20)

> Réévaluée le 2026-08-14 après correction des claims inexacts (sécurité, tests, typage)
> et ajout de la section hygiène repo. La note remonte légèrement : la sécurité était
> sous-évaluée (validateurs présents, `is_superuser` protégé, Argon2 actif) et le typage
> frontend est plus propre que estimé (0 `: any`). L'hygiène repo (C) tire la moyenne vers le bas.

---

## Points forts

1. **Stack moderne et cohérente** — Django 5 + React 19 + Vite 7 + Tailwind 4.
2. **Fonctionnalités très complètes** — pharmacie réelle avec 2 813 factures, 4 940 produits.
3. **DevOps solide** — deploy, rollback, backup, keyday, Cython, Sentry.
4. **i18n exhaustif** — 83 fichiers fr/en.
5. **Audit logging** systématique.
6. **PWA** avec offline.

---

## Points faibles prioritaires

1. **God components** — 15 fichiers > 40 ko. `PharmacySettingsForm` (89 ko) et `SystemAdmin` (81 ko) urgents à découper.
2. **Chunk tesseract 4,5 Mo** — chargé sans lazy-load, plombe le premier rendu. Priorité perf #1.
3. **`login_options` expose les usernames** (AllowAny, sans throttle) — énumération facilitée pour brute-force.
4. **`min_length=4` sur mots de passe** — bien en dessous des standards (8 min recommandé). Pas de lockout compte.
5. **Tests E2E** — aucun. Un flow de vente/caisse qui casse = incident client.
6. **Duplication** — `MENU_HIERARCHY` et mapping rôles en double frontend/backend.
7. **Hygiène repo** — fichiers `temp_*.py` commités, 10 `.md` + ~30 scripts à la racine, 2 branches mortes.
8. **Pas de linter Python** — ni ruff ni flake8 configuré.

---

## Top 5 actions recommandées

| # | Action | Impact | Effort | Statut |
|---|--------|--------|--------|--------|
| 1 | Sécuriser `login_options` (throttle + limiter champs) + monter `min_length` à 8 + lockout compte | Critique | Moyen | ☐ À faire |
| 2 | Lazy-load `tesseract.js` (dynamic import à l'usage) + splitter `bwip-js` | Haute | Faible | ☐ À faire |
| 3 | Découper `PharmacySettingsForm` et `SystemAdmin` en sous-composants | Haute | Moyen | ☐ À faire |
| 4 | Ajouter tests E2E (Playwright) sur flow vente + caisse + clôture | Haute | Élevé | ☐ À faire |
| 5 | Ranger la racine du repo (temp files, .md, scripts) + supprimer branches mortes + ajouter ruff | Moyenne | Faible | ☐ À faire |

---

## God components à découper (par ordre de priorité)

| Fichier | Taille | Priorité |
|---------|--------|----------|
| `components/settings/PharmacySettingsForm.tsx` | 89 ko | 1 |
| `components/SystemAdmin.tsx` | 81 ko | 2 |
| `components/HistoriqueClotures.tsx` | 68 ko | 3 |
| `components/Maintenance.tsx` | 65 ko | 4 |
| `components/compta/Comptabilite.tsx` | 64 ko | 5 |
| `components/GestionUtilisateurs.tsx` | 56 ko | 6 |
| `components/Transformations.tsx` | 53 ko | 7 |
| `components/ModuleFinancier.tsx` | 52 ko | 8 |
| `components/SimplePrintLabelsModal.tsx` | 49 ko | 9 |
| `components/dashboard/reports/ReportFilters.tsx` | 49 ko | 10 |
| `components/PlanningOperateurs.tsx` | 47 ko | 11 |
| `components/RapportMensuel.tsx` | 45 ko | 12 |
| `components/common/CategoryManager.tsx` | 45 ko | 13 |
| `components/Perimes.tsx` | 43 ko | 14 |
| `components/StatistiquesFournisseur.tsx` | 42 ko | 15 |

---

## Fichiers backend les plus lourds

| Fichier | Taille |
|---------|--------|
| `rapports/excel_general.py` | 67 ko |
| `rapports/finance.py` | 65 ko |
| `finance_stats.py` | 47 ko |
| `dashboard/core.py` | 41 ko |
| `ventes/creances.py` | 41 ko |
| `rapports/excel_general_extra.py` | 36 ko |
| `settings.py` | 34 ko |
| `purge.py` | 34 ko |
| `commandes/cloture_mixin.py` | 33 ko |
| `system_admin.py` | 31 ko |

---

## Chunks frontend les plus lourds (mesure réelle `dist/assets/`)

| Chunk | Taille | Action |
|-------|--------|--------|
| `tesseract-core.wasm-*.js` | **4 578 ko** | Lazy-load impératif (dynamic import à l'usage OCR) |
| `bwip-js-*.js` | 941 ko | Dynamic import (barcodes) — ne charger que sur pages impression |
| `index-*.js` (principal) | 786 ko | Code-splitter par route / feature |
| `index-*.js` (secondaire) | 499 ko | Identifier la feature responsable |
| `vendor-pdf-*.js` | 407 ko | Déjà isolé — OK |
| `feature-caisse-*.js` | 283 ko | Déjà lazy — OK |
| `vendor-xlsx-*.js` | 276 ko | Déjà isolé — OK |
| `feature-dashboard-*.js` | 213 ko | Déjà lazy — OK |

> Le chunk `tesseract-core.wasm` (4,5 Mo) est **le plus gros problème perf** du frontend.
> Il ne devrait être chargé qu'au moment où l'utilisateur lance l'OCR, pas au bundle initial.

---

## Ce qui a été fait récemment (résumé)

- Optimisation backend + frontend : facturation, commandes, caisse, inventaire.
- Refactoring `Facturation.tsx`, `useJournalCaisse.ts` décomposé en hooks focalisés.
- Correction traductions états-inventaire (clés déplacées vers racine `stock.json`).
- Audit responsive design + fixes (tables, modales, textes, largeurs fixes).
- Fix ticket caisse : `N/A` modes de règlement (mapping `mode_paiement` → `mode`).
- Fix ticket caisse : `part-patient` masqué pour clients non professionnels.
- `SessionRecapBar` : visibilité conditionnée par `pharmacySettings.hide_cash_totals` (titulaire), toggle réservé au superuser.
- Suppression onglet Corbeille local de `GestionUtilisateurs.tsx` → corbeille centralisée via sidebar.

---

## Plan de la prochaine session

1. **Valider cet audit** avec le titulaire.
2. **Quick win perf** (action #2) : lazy-load `tesseract.js` — effort faible, impact immédiat sur le premier rendu.
3. **Sécurité** (action #1) : `login_options` + `min_length=8` + lockout — c'est le plus critique pour la prod client.
4. **God components** (action #3) : `PharmacySettingsForm` puis `SystemAdmin`.
5. **Hygiène repo** (action #5) : suppression `temp_*.py`, rangement `.md`/scripts, branches mortes, ruff.
