# Fullstack Produits — Règles Agent

Application de gestion de pharmacie (stock, facturation, caisse, commandes, inventaire).
Déployée en production chez des clients (mode "zenith" : licence, watchdog, mise à jour auto).

## ⚠️ Mémoire entre sessions

**Toujours lire `CHANGELOG.md` (les dernières entrées en haut) en début de session** pour savoir
ce qui a été fait récemment et où on s'est arrêté.

**Toujours ajouter une entrée dans `CHANGELOG.md`** (nouvelle section datée en haut, sous le titre)
après une tâche significative : quoi, pourquoi, fichiers touchés. Garde le même format que les
entrées existantes (titres avec emojis, listes à puces, mention des fichiers modifiés).

## Stack

- **Backend** : Django 5 + DRF, Channels/Daphne (WebSocket), PostgreSQL 15, Redis, Uvicorn.
  App unique `backend/api/`.
- **Frontend** : React 19 + TypeScript, Vite 7, Tailwind 4 + shadcn/ui (migration depuis DaisyUI
  en cours), React Query, Zustand, react-i18next (fr/en), Radix UI. Racine : `frontend/frontend/`.
- **Infra** : Docker Compose (db, redis, backend, frontend/nginx).

## Conventions

- i18n : toute chaîne visible utilisateur doit avoir une clé de traduction en `fr` **et** `en`
  (voir dossiers de traduction du frontend).
- Messages d'erreur utilisateur en français.
- Suivre le style des commits existants (`git log`) : `type: description courte` (feat, fix, docs...).
- Ne pas committer sans que ça soit demandé.

## Commandes utiles

- Frontend : `cd frontend/frontend && npm run dev|build|lint|test`
- Backend : `cd backend && python manage.py <cmd>` (env virtuel `my_env01/`)
- Docker (dev) : `docker compose up` (nécessite Docker Desktop lancé)
