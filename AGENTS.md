# Fullstack Produits — Règles Agent

Application de gestion de pharmacie (stock, facturation, caisse, commandes, inventaire).
Déployée en production chez des clients (mode "zenith" : licence, watchdog, mise à jour auto).

> Ce fichier contient uniquement l'essentiel (chargé à chaque message). Les procédures
> détaillées sont dans `docs/agent/` — **les lire à la demande**, voir l'index en bas.

## ⚠️ Mémoire entre sessions

- **Lire `CHANGELOG.md`** (dernières entrées en haut) en début de session.
- **Ajouter une entrée `CHANGELOG.md`** (section datée en haut) après toute tâche
  significative : quoi, pourquoi, fichiers touchés. Même format que l'existant.
- Les apps mobiles ont leur propre suivi : `mobile-facturation/SUIVI.md`.

## ⚠️ Demandes complexes — Avertir avant d'agir

Si une demande risque de bouleverser le code (refactor massif, changement d'architecture,
>5 fichiers dans models/serializers/views/store/routes, contrat backend↔frontend cassé,
risque sur caisse/facturation/commandes/stock, migrations avec impact données) :
**analyser → avertir (changements, risques, alternatives) → attendre confirmation →
procéder par étapes.** En cas de doute, avertir.

## ⚠️ Parallélisation

Tâche longue/multi-étapes → découper en sous-agents indépendants + agent de contrôle
final (build, tests, traductions, CHANGELOG). Détails : `docs/agent/parallelisation.md`.

## Stack

- **Backend** : Django 5 + DRF, Channels/Daphne, PostgreSQL 15, Redis. App unique `backend/api/`.
- **Frontend** : React 19 + TS, Vite 7, Tailwind 4 + shadcn/ui (migration depuis DaisyUI
  en cours), React Query, Zustand, react-i18next (fr/en). Racine : `frontend/frontend/`.
- **Mobile** : `pda-inventaire/` (Expo 57, inventaire offline), `mobile-facturation/`
  (Expo 57, prise de vente → caisse centralisée, pas d'offline ni d'encaissement).
- **Infra** : Docker Compose (db, redis, backend, frontend/nginx).

## Conventions

- **i18n** : toute chaîne visible en `fr` **et** `en`, dès la création
  (`frontend/frontend/public/locales/{fr,en}/`).
- **UI** : tout nouveau composant en **shadcn/ui** — jamais de nouveau DaisyUI.
- **Toasts** : `import { gooeyToast } from 'goey-toast'` ; un seul `<GooeyToaster />` dans `App.tsx`.
- Messages d'erreur utilisateur en français.
- Commits : `type: description courte` (feat, fix, docs…). Ne pas committer sans demande.
- Dépendances : version publiée depuis ≥ 7 jours, pas de `latest`/`*`, via le gestionnaire
  de paquets.
- Migrations prod : index sur grosses tables en `CREATE INDEX CONCURRENTLY` (`atomic=False`),
  migration d'index en double → `operations = []`. Détails : `docs/agent/migrations-prod.md`.

## Commandes

```powershell
# Frontend
cd frontend/frontend && npm run dev|build|lint|test
# Backend (env virtuel my_env01/)
cd backend && python manage.py <cmd>
# Tests backend — --noinput OBLIGATOIRE (sinon EOFError)
docker exec fullstack_produits-backend-1 python manage.py test api.tests.test_<module> -v 2 --noinput
# Déploiement dev (sans rebuild) : all | all-full | frontend | backend | backend-full
.\deploy.ps1 -Target all        # -BackupDB, -Rebuild disponibles
# Code keyday du jour (dev)
docker exec fullstack_produits-backend-1 python manage.py shell -c "from api.keyday import get_today_keyday; print(get_today_keyday())"
```

## Conteneurs Docker

| Service  | Dev (auto)                     | Prod (`container_name`)  |
|----------|--------------------------------|--------------------------|
| Backend  | `fullstack_produits-backend-1` | `zenith-pharma-backend`  |
| Frontend | `fullstack_produits-frontend-1`| `zenith-pharma-frontend` |
| DB       | `fullstack_produits-db-1`      | `zenith-pharma-db`       |
| Redis    | `fullstack_produits-redis-1`   | `zenith-pharma-redis`    |

Sous Windows : pas de `sudo`. En dev le volume `./backend:/app` écrase les `.so` Cython
(compilation prod uniquement). Après déploiement prod : client doit faire **Ctrl+F5**.

## Sécurité — Règles rouges

Ne jamais (même pour débloquer un build) :
- Modifier `minimumReleaseAge`, `.npmrc`, `.piprc` ou les politiques de sécurité.
- Générer, logger ou commiter des secrets.
- Contourner la compilation Cython en production.
- `rm -rf` ou `DROP` sur une base sans backup explicite et confirmation.
- Sous Git Bash : jamais `> nul` (crée un fichier `nul` qui casse `git add`) — utiliser `2>/dev/null`.

## Index des références (`docs/agent/`)

| Fichier | Contenu |
|---|---|
| `deploiement.md` | `deploy.ps1` détaillé, déploiement prod, noms de conteneurs, checklist release |
| `migrations-prod.md` | Timeouts, `CONCURRENTLY`, `AddField`, `RunPython` gros datasets, tests Docker |
| `securite-licence.md` | Mots de passe admin, compilation Cython (fichiers protégés, limites), keyday |
| `import-produits.md` | Import/export Excel-CSV : fichiers, format, normalisations, matching CIP |
| `operations.md` | Backup/restore DB, erreurs fréquentes et solutions, toasts, i18n |
| `parallelisation.md` | Quand/comment déléguer aux sous-agents, agent de contrôle final |
