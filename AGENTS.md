# Fullstack Produits — Règles Agent

Application de gestion de pharmacie (stock, facturation, caisse, commandes, inventaire).
Déployée en production chez des clients (mode "zenith" : licence, watchdog, mise à jour auto).

## ⚠️ Mémoire entre sessions

**Toujours lire `CHANGELOG.md` (les dernières entrées en haut) en début de session** pour savoir
ce qui a été fait récemment et où on s'est arrêté.

**Toujours ajouter une entrée dans `CHANGELOG.md`** (nouvelle section datée en haut, sous le titre)
après une tâche significative : quoi, pourquoi, fichiers touchés. Garde le même format que les
entrées existantes (titres avec emojis, listes à puces, mention des fichiers modifiés).

## ⚠️ Parallélisation — Tâches longues ou complexes

**Toute tâche longue ou complexe doit être décomposée et confiée à un ou plusieurs
sous-agents indépendants (`run_subagent`), suivis d'un agent de contrôle final.**

### Quand déléguer

- Recherche/exploration large du codebase (plusieurs fichiers, plusieurs couches).
- Tâche multi-étapes où chaque étape est self-contained (ex: fix backend + fix frontend +
  traductions + build + deploy).
- Modifications parallèles sur des zones disjointes du code (pas de conflit de fichiers).
- Investigation nécessitant de croiser backend, frontend, serializers, modèles, routes.

### Comment déléguer

1. **Découper** la tâche en sous-tâches indépendantes (pas de dépendance entre elles, ou
   dépendance linéaire gérée en séquence).
2. **Lancer les sous-agents en parallèle** (`is_background: true`) quand ils ne touchent
   pas les mêmes fichiers. Sinon, les lancer en séquence.
3. **Profil** : `subagent_explore` pour la recherche/lecture seule, `subagent_general`
   pour les modifications/écriture/commandes.
4. **Front-loader le contexte** : chaque sous-agent est stateless. Lui donner :
   - Les chemins de fichiers pertinents.
   - Les noms de fonctions/classes/endpoint concernés.
   - Ce qui est déjà connu et ce qu'il doit faire précisément.
   - Le format attendu de sa réponse.
5. **Agent de contrôle final** (obligatoire) : après que tous les sous-agents ont terminé,
   lancer un dernier sous-agent (ou faire soi-même) qui :
   - Vérifie la cohérence des changements (contrat backend ↔ frontend).
   - Lance le build frontend (`npm run build`).
   - Lance les tests backend pertinents si applicable.
   - Vérifie les traductions fr/en.
   - Confirme que rien n'a été cassé.
   - Rédige l'entrée `CHANGELOG.md`.

### Quand NE PAS déléguer

- Tâche triviale (1 fichier, 1-2 lignes) → faire directement.
- Tâche nécessitant une interaction utilisateur (clarification, choix de design).
- Tâche séquentielle stricte où chaque étape dépend de la précédente et ne peut
  pas être parallélisée — faire en séquence soi-même.

### Exemple

```
Tâche : "Corriger le rappel de vente + alléger les spinners + fixer SalesTable"

Sous-agent 1 (subagent_general, background) :
  → Fix backend endpoint by_number URL normalization

Sous-agent 2 (subagent_general, background) :
  → Alléger les spinners dans ProductSearch, ClientSection, FacturationHeader

Sous-agent 3 (subagent_explore, background) :
  → Investiguer pourquoi SalesTable ne montre pas les ventes en caisse centrale

Agent de contrôle (foreground, après 1+2+3) :
  → Build frontend, vérifier traductions, déployer, rédiger CHANGELOG
```

## Stack

- **Backend** : Django 5 + DRF, Channels/Daphne (WebSocket), PostgreSQL 15, Redis, Uvicorn.
  App unique `backend/api/`.
- **Frontend** : React 19 + TypeScript, Vite 7, Tailwind 4 + shadcn/ui (migration depuis DaisyUI
  en cours), React Query, Zustand, react-i18next (fr/en), Radix UI. Racine : `frontend/frontend/`.
- **Infra** : Docker Compose (db, redis, backend, frontend/nginx).

## Conventions

- i18n : toute chaîne visible utilisateur doit avoir une clé de traduction en `fr` **et** `en`
  (voir dossiers de traduction du frontend).
- **Tout nouvel élément (composant, label, placeholder, message, menu) doit être traduit
  en `fr` **et** `en` immédiatement à sa création**, pas dans un second temps.
- Messages d'erreur utilisateur en français.
- Suivre le style des commits existants (`git log`) : `type: description courte` (feat, fix, docs...).
- Ne pas committer sans que ça soit demandé.
- **UI : toute nouvelle fenêtre, modal ou composant graphique doit être créé avec shadcn/ui**
  (la migration depuis DaisyUI est en cours — ne pas introduire de nouveaux composants DaisyUI).

### Migrations Django en production

- **Timeouts adaptatifs** : `docker-compose.prod.yml` utilise `DB_STATEMENT_TIMEOUT=300000`
  (5 min) et `DB_LOCK_TIMEOUT=30000` (30 s) pendant `migrate`, via `settings.py`.
  En fonctionnement normal : `statement_timeout=30000` (30 s) et `lock_timeout=5000` (5 s).
- **CREATE INDEX CONCURRENTLY** : pour tout index sur une table qui peut avoir beaucoup de
  lignes en prod (`Facture`, `FactureProduit`, `StockLot`, `MouvementStock`), utiliser
  `RunSQL` avec `CREATE INDEX CONCURRENTLY IF NOT EXISTS` au lieu de `migrations.AddIndex`.
  Cela nécessite `atomic = False` sur la migration.
- **AddField avec default=** : sur une table >1000 lignes, préférer un `RunSQL` avec
  `ALTER TABLE ... ADD COLUMN ... DEFAULT ...` (PostgreSQL 11+ optimise cela sans
  full table rewrite si la valeur par défaut est constante).
- **RunPython sur gros datasets** : utiliser `iterator(chunk_size=500)` pour éviter
  de charger toutes les lignes en mémoire.

## Commandes utiles

- Frontend : `cd frontend/frontend && npm run dev|build|lint|test`
- Backend : `cd backend && python manage.py <cmd>` (env virtuel `my_env01/`)
- Docker (dev) : `docker compose up` (nécessite Docker Desktop lancé)

### Tests backend (Docker)

```powershell
# Tests complets d'un module
docker exec fullstack_produits-backend-1 python manage.py test api.tests.test_<module> -v 2 --noinput

# Exemple : tests des challenges
docker exec fullstack_produits-backend-1 python manage.py test api.tests.test_challenges -v 2 --noinput

# Tous les tests
docker exec fullstack_produits-backend-1 python manage.py test api.tests -v 1 --noinput
```

⚠️ `--noinput` est obligatoire car la test DB existe déjà et Django demande confirmation
de destruction. Sans `--noinput`, le test échoue avec `EOFError`.

⚠️ Si une migration auto-générée crée un index en double (ex: `0250_facture_facture_poste_status_idx`),
la rendre no-op (`operations = []`) — les index existent déjà dans les migrations squashed
précédentes. Ne jamais supprimer la migration, juste la vider.

## Déploiement

### En développement (local, Docker Desktop)

Utiliser `deploy.ps1` (sans rebuild Docker, copie directe dans les conteneurs) :

```powershell
# Frontend + backend (rapide, usage courant)
.\deploy.ps1 -Target all

# Frontend + backend + migrations + setup DCI (changements de modèles)
.\deploy.ps1 -Target all-full

# Frontend seul
.\deploy.ps1 -Target frontend

# Backend seul (sans migrations)
.\deploy.ps1 -Target backend

# Backend + migrations + DCI
.\deploy.ps1 -Target backend-full

# Avec backup DB avant déploiement
.\deploy.ps1 -Target all -BackupDB

# Rebuild complet des images Docker (changement de requirements.txt, Dockerfile)
.\deploy.ps1 -Target all -Rebuild
```

Le script `deploy.ps1` :
- **Frontend** : `npm run build` → `docker cp dist/` → `nginx -s reload`
- **Backend** : `docker cp backend/api/` → `docker restart`
- Détecte automatiquement les noms des conteneurs (dev ou prod)
- Avec `-Rebuild` : reconstruit les images via `docker compose build`

⚠️ En dev, le volume `./backend:/app` remet les `.py` sources à chaque démarrage.
La compilation Cython ne s'applique pas en dev — seulement en prod via le build Docker.

### En production (serveur client)

```bash
cd /opt/zenith-pharma
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Le build Docker prod :
- Compile les fichiers critiques en `.so` via Cython (cf. section Compilation Cython)
- Le client ne reçoit que les binaires — impossible de modifier le code source

⚠️ Après un déploiement, le client doit faire un **Ctrl+F5** (hard reload) pour
invalider le cache PWA du navigateur.

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

---

## Fichiers et points d'entrée clés

### Import/Export produits

- `backend/api/management/commands/import_excel_csv.py` — commande d'import Excel/CSV
- `backend/api/views/purge.py` — endpoint `maintenance/import_produits/` et `maintenance/export_produits/`
- `backend/api/models/products.py` — modèle `Produit`
- `frontend/frontend/src/components/Maintenance.tsx` — écran de maintenance (import/export/purge)
- `frontend/frontend/src/components/products/ImportProductsModal.tsx` — modal d'import alternatif (non utilisé par l'écran Maintenance)

### Toasts

- `frontend/frontend/src/App.tsx` — point de montage du `<GooeyToaster />`
- `goey-toast` remplace `react-hot-toast` dans tout le projet

### i18n

- `frontend/frontend/src/i18n.ts` — configuration
- `frontend/frontend/public/locales/fr/` et `.../en/` — fichiers JSON

---

## Import Produits — Pièges connus

Le workflow UI actuel passe par `maintenance/import_produits/` (dans `PurgeViewSet`), qui invoque la commande `import_excel_csv`. Le fichier `backend/api/views/import_views.py` existe mais n'est pas la route active de l'écran Maintenance.

### Format attendu

Colonnes supportées (ordre et noms) :
```
cip1, cip2, cip3, nom, prix_achat, prix_vente, tva, stock
```

### Normalisations gérées

- CIP flottants (`8017017.0`) → convertis en entier chaîne
- Cellules vides → `None`, jamais `"nan"`, `"none"` ou `"0"`
- Prix et TVA lus comme nombres
- Stock entier

### Règles de matching

- On matche uniquement par `cip1` et `cip2`
- `cip3` est ignoré pour le matching car il s'agit souvent d'un code partagé/référence
- Si un CIP entrant (`cip2` ou `cip3`) entre en conflit avec un autre produit, on saute ce CIP plutôt que de fusionner
- `cip1` absent → `None` (autorise plusieurs produits sans `cip1`)

### Tests de référence (base vide)

| Fichier | Créés | Mis à jour | Erreurs |
|---------|-------|------------|---------|
| `Listing_Laborex_Mapped_FINAL.xlsx` (4 934 lignes) | 4 930 | 4 | 0 |
| `Listing_Ubipharm_Mapped_FINAL.xlsx` (8 251 lignes) | 8 237 | 14 | 0 |
| Laborex puis Ubipharm | 5 837 | 2 414 | 0 |

---

## Backup / Restore DB — Procédure exacte

### Sauvegarder

```bash
docker exec fullstack_produits-db-1 pg_dump -U fullstack_user -d fullstack_db > backup-AAAAMMJJ-HHMMSS.sql
```

### Restaurer (destructif)

```bash
docker compose stop backend
docker cp /chemin/vers/backup.sql fullstack_produits-db-1:/tmp/restore.sql
docker exec fullstack_produits-db-1 psql -U fullstack_user -d postgres -c "DROP DATABASE IF EXISTS fullstack_db WITH (FORCE);"
docker exec fullstack_produits-db-1 psql -U fullstack_user -d postgres -c "CREATE DATABASE fullstack_db OWNER fullstack_user;"
docker exec fullstack_produits-db-1 psql -U fullstack_user -d fullstack_db -f /tmp/restore.sql
docker exec fullstack_produits-db-1 rm /tmp/restore.sql
docker compose start backend
```

### Vérifier

```bash
docker exec fullstack_produits-db-1 psql -U fullstack_user -d fullstack_db -c "SELECT count(*) FROM api_produit;"
```

---

## Erreurs fréquentes déjà rencontrées

| Erreur | Cause probable | Solution |
|--------|---------------|----------|
| `django.db.utils.ProgrammingError: relation "authtoken_token" does not exist` | Base partiellement corrompue | Restaurer depuis un backup complet |
| `column api_produit.deleted_by_id does not exist` | Migrations non appliquées | `python manage.py migrate` avant l'import |
| Redis timeout au démarrage du backend | `django-axes` mal configuré | Vérifier `backend/backend/urls.py`, retirer `path('axes/', include('axes.urls'))` si obsolète |
| Import bloqué à 50% | CIP `NaN` / `.0` / `cip3` mal géré | Vérifier `clean_cip()` et `get_value()` dans `import_excel_csv.py` |
| `duplicate key value violates unique constraint "api_produit_cip1_key"` | CIP vide devenu `"nan"` ou `''` | S'assurer que `clean_cip()` renvoie `None` pour les CIP vides |
| Build frontend échoue sur `The symbol "..." has already been declared` | Doublon de `useState` après copier-coller | Renommer l'un des deux états |

---

## Conventions de code — complément

### Notifications

- `react-hot-toast` est remplacé par `goey-toast` sur tout le projet
- Importer : `import { gooeyToast } from 'goey-toast'`
- Un seul `<GooeyToaster />` dans `App.tsx`
- Ne pas monter de `<GooeyToaster />` dans les sous-composants
- Pas de render functions `(t) => JSX`, utiliser `description` et `title`

### UI / UX

- Tout nouvel élément graphique en **shadcn/ui**
- **Jamais** de nouveaux composants DaisyUI
- Toute chaîne visible en `fr` **et** `en`

### Dépendances

- Préférer une version publiée depuis au moins 7 jours
- Ne pas utiliser `latest`, `*`, ou des plages ouvertes
- Ajouter via le gestionnaire de paquets (`npm install`, `pip install`) plutôt qu'à la main

---

## Sécurité — Règles rouges

Ne jamais (même pour débloquer un build) :
- Modifier `minimumReleaseAge`, `.npmrc`, `.piprc` ou les politiques de sécurité
- Générer, logger, ou commiter des secrets (clés, tokens, mots de passe)
- Contourner la compilation Cython en production
- Forcer un `docker exec -it` ou `sudo` sans confirmation
- Effectuer `rm -rf` ou DROP sur une base de données sans backup explicite

---

## Checklist déploiement client

Avant toute release en production :

- [ ] `npm run build` passe sans erreur
- [ ] `python manage.py test` (ou tests backend pertinents) passent
- [ ] `git status` et `git diff` revus
- [ ] Pas de secrets dans les diff
- [ ] Backup DB si le changement touche les données
- [ ] Build Docker prod : `docker compose -f docker-compose.prod.yml build backend [frontend]`
- [ ] Redémarrage : `docker compose -f docker-compose.prod.yml up -d`
- [ ] Client prévenu de faire **Ctrl+F5** pour invalider le cache PWA

