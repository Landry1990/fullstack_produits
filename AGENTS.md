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

## Noms des containers Docker

### En développement (`docker-compose.yml`)

Les noms sont auto-générés : `fullstack_produits-<service>-1` (ex: `fullstack_produits-backend-1`).

### En production (`docker-compose.prod.yml`)

Les noms sont explicites (`container_name`) :

| Service    | Nom du container           |
|------------|----------------------------|
| Backend    | `zenith-pharma-backend`    |
| Frontend   | `zenith-pharma-frontend`   |
| DB         | `zenith-pharma-db`         |
| Redis      | `zenith-pharma-redis`      |
| Tailscale  | `zenith-pharma-tailscale`  |

## Gestion des mots de passe admin (superuser Django)

L'installation/suppression de licence exige un mot de passe superuser Django.
Si le pharmacien oublie le mot de passe, exécuter sur le serveur :

```bash
# Changer le mot de passe d'un compte existant (interactif)
docker exec -it zenith-pharma-backend python manage.py changepassword admin

# Sans interaction (script) — remplacer NOUVEAU_MDP
docker exec zenith-pharma-backend python manage.py shell -c "
from django.contrib.auth.models import User
u = User.objects.get(username='admin')
u.set_password('NOUVEAU_MDP')
u.save()
print('Mot de passe changé')
"

# Créer un nouveau superuser (interactif)
docker exec -it zenith-pharma-backend python manage.py createsuperuser
```

En développement, remplacer `zenith-pharma-backend` par `fullstack_produits-backend-1`.

## Compilation Cython (protection anti-modification serveur)

En production, les fichiers Python critiques sont compilés en `.so` binaires avec
Cython. Le client ne peut pas modifier le code source (les `.py` n'existent pas).

### Fichiers protégés

| Fichier source              | Binaire compilé                                    |
|-----------------------------|----------------------------------------------------|
| `backend/backend/settings.py` | `settings.cpython-311-x86_64-linux-gnu.so`       |
| `api/middleware_licence.py` | `middleware_licence.cpython-311-x86_64-linux-gnu.so`|
| `api/utils_licence.py`      | `utils_licence.cpython-311-x86_64-linux-gnu.so`     |
| `api/views/licence.py`      | `licence.cpython-311-x86_64-linux-gnu.so`           |
| `api/keyday.py`             | `keyday.cpython-311-x86_64-linux-gnu.so`            |

### Comment ça marche

- Le `Dockerfile` installe Cython et exécute `compile_protected.py` après la copie du code
- Chaque fichier `.py` est transformé en `.c` (Cython) puis en `.so` (gcc)
- Le `.py` source et le `.c` sont supprimés
- Le client reçoit uniquement les `.so` — illisibles et impossibles à modifier

### En développement

Le volume `./backend:/app` dans `docker-compose.yml` remet les `.py` sources à chaque
démarrage. La compilation Cython n'affecte pas le développement.

### Pour modifier un fichier protégé

1. Modifier le `.py` source dans le repo
2. Rebuilder l'image Docker : `docker compose -f docker-compose.prod.yml build backend`
3. Redéployer : `docker compose -f docker-compose.prod.yml up -d backend`

### Limites actuelles & pistes de renforcement (TODO)

Cython est une **barrière**, pas un mur absolu. Ce qui est protégé et ce qui ne l'est pas :

| Attaque | Cython bloque ? |
|---------|-----------------|
| Lire la logique de validation | ✅ Oui (code machine illisible) |
| Lire `SECRET_KEY` / strings | ⚠️ Partiellement (`strings fichier.so` affiche les strings) |
| Modifier une condition dans le `.so` | ✅ Oui (très difficile en pratique) |
| **Remplacer le `.so` par un faux `.py`** | ❌ **Non** |
| Commenter `LicenceMiddleware` | ✅ Oui (si `settings.py` aussi compilé) |

Pour un client pharmacien moyen : protection largement suffisante.
Pour un client programmeur motivé avec accès SSH : contournable en ~30 min.

**Pistes à implémenter plus tard (par ordre de priorité)** :

1. **Vérification d'intégrité au démarrage** (priorité haute)
   - Au build, calculer SHA-256 de chaque `.so` et les stocker dans un fichier `integrity.json`
   - Au démarrage du backend, `entrypoint.sh` recalcule les hashes et compare
   - Si un `.so` a été remplacé/modifié → refus de démarrer
   - Bloque la substitution `.so` → faux `.py`

2. **Filesystem read-only** (priorité moyenne)
   - Monter les fichiers protégés en lecture seule dans `docker-compose.prod.yml`
   - `read_only: true` + `tmpfs` pour les répertoires d'écriture nécessaires

3. **Restreindre `docker exec`** (priorité basse)
   - Retirer l'accès shell au container en prod (ou utiliser un utilisateur non-root)
   - Le `Dockerfile` peut ajouter `USER nonroot` à la fin

4. **Masquer `SECRET_KEY` dans le `.so`** (priorité basse)
   - Ne pas stocker `SECRET_KEY` en clair dans `settings.py`
   - La lire depuis une variable d'environnement uniquement (déjà le cas via `os.getenv`)
   - Mais vérifier qu'elle n'apparaît pas comme string fallback dans le code compilé

## Code journalier (Keyday) pour le support à distance

Le support peut donner un code à 6 caractères au pharmacien pour installer/supprimer
une licence sans accès au serveur. Le code est valide 24h (change à minuit).

### Générer le code du jour (depuis le PC du support)

```bash
# Récupérer DJANGO_SECRET_KEY du client (dans .env du serveur) — à faire une fois
# puis générer le code avec :
python backend/keyday_generator.py --secret="DJANGO_SECRET_KEY_DU_CLIENT"

# Pour une date spécifique :
python backend/keyday_generator.py --secret="DJANGO_SECRET_KEY" --date=2026-08-05
```

### Générer le code depuis le serveur du client

```bash
# Production
docker exec zenith-pharma-backend python manage.py shell -c "from api.keyday import get_today_keyday; print(get_today_keyday())"

# Développement
docker exec fullstack_produits-backend-1 python manage.py shell -c "from api.keyday import get_today_keyday; print(get_today_keyday())"
```

### Côté pharmacien

Dans l'écran d'activation de licence, saisir le code à 6 caractères dans le champ
"Mot de passe admin ou code journalier". Le système détecte automatiquement que c'est
un code keyday (6 caractères alphanumériques) et l'envoie au backend.
