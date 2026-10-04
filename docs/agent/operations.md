# Opérations

> Référence détaillée — l'essentiel est dans AGENTS.md à la racine.

### Backup / Restore DB — Procédure exacte

#### Sauvegarder

```bash
docker exec fullstack_produits-db-1 pg_dump -U fullstack_user -d fullstack_db > backup-AAAAMMJJ-HHMMSS.sql
```

#### Restaurer (destructif)

```bash
docker compose stop backend
docker cp /chemin/vers/backup.sql fullstack_produits-db-1:/tmp/restore.sql
docker exec fullstack_produits-db-1 psql -U fullstack_user -d postgres -c "DROP DATABASE IF EXISTS fullstack_db WITH (FORCE);"
docker exec fullstack_produits-db-1 psql -U fullstack_user -d postgres -c "CREATE DATABASE fullstack_db OWNER fullstack_user;"
docker exec fullstack_produits-db-1 psql -U fullstack_user -d fullstack_db -f /tmp/restore.sql
docker exec fullstack_produits-db-1 rm /tmp/restore.sql
docker compose start backend
```

#### Vérifier

```bash
docker exec fullstack_produits-db-1 psql -U fullstack_user -d fullstack_db -c "SELECT count(*) FROM api_produit;"
```

### Erreurs fréquentes déjà rencontrées

| Erreur | Cause probable | Solution |
|--------|---------------|----------|
| `django.db.utils.ProgrammingError: relation "authtoken_token" does not exist` | Base partiellement corrompue | Restaurer depuis un backup complet |
| `column api_produit.deleted_by_id does not exist` | Migrations non appliquées | `python manage.py migrate` avant l'import |
| Redis timeout au démarrage du backend | `django-axes` mal configuré | Vérifier `backend/backend/urls.py`, retirer `path('axes/', include('axes.urls'))` si obsolète |
| Import bloqué à 50% | CIP `NaN` / `.0` / `cip3` mal géré | Vérifier `clean_cip()` et `get_value()` dans `import_excel_csv.py` |
| `duplicate key value violates unique constraint "api_produit_cip1_key"` | CIP vide devenu `"nan"` ou `''` | S'assurer que `clean_cip()` renvoie `None` pour les CIP vides |
| Build frontend échoue sur `The symbol "..." has already been declared` | Doublon de `useState` après copier-coller | Renommer l'un des deux états |
| `git add` échoue : `error: unable to index file '.../nul'` / `fatal: adding files failed` | Fichier `nul` créé par une redirection `> nul 2>&1` sous Git Bash (nom réservé Windows) | Supprimer via `Remove-Item -LiteralPath '\\?\C:\...\nul'` (PowerShell) ; utiliser `2>/dev/null` sous bash, jamais `> nul` |

### Toasts

- `frontend/frontend/src/App.tsx` — point de montage du `<GooeyToaster />`
- `goey-toast` remplace `react-hot-toast` dans tout le projet

### i18n

- `frontend/frontend/src/i18n.ts` — configuration
- `frontend/frontend/public/locales/fr/` et `.../en/` — fichiers JSON

### Notifications

- `react-hot-toast` est remplacé par `goey-toast` sur tout le projet
- Importer : `import { gooeyToast } from 'goey-toast'`
- Un seul `<GooeyToaster />` dans `App.tsx`
- Ne pas monter de `<GooeyToaster />` dans les sous-composants
- Pas de render functions `(t) => JSX`, utiliser `description` et `title`
