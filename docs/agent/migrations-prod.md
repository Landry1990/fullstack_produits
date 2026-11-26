# Migrations Django en production & tests backend

> Référence détaillée — l'essentiel est dans AGENTS.md à la racine.

### Garde-fous de déploiement (2026-11-14)

- `deploy.ps1` affiche `migrate --plan` avant d'appliquer et **bloque** les
  migrations contenant `RemoveField`/`RenameField`/`DeleteModel` (pattern
  expand/contract : ces ops partent dans une release dédiée). Bypass : `-Force`.
  `AlterField`/`RenameModel`/`RemoveConstraint`/`RemoveIndex` → warning seul.
- CI `backend-lint` : `makemigrations --check --noinput` — échoue si les
  modèles ont dérivé des fichiers de migration versionnés.

### Migrations Django en production

- **Timeouts adaptatifs** : `docker-compose.prod.yml` utilise `DB_STATEMENT_TIMEOUT=300000`
  (5 min) et `DB_LOCK_TIMEOUT=30000` (30 s) pendant `migrate`, via `settings.py`.
  En fonctionnement normal : `statement_timeout=30000` (30 s) et `lock_timeout=5000` (5 s).
- **CREATE INDEX CONCURRENTLY** : pour tout index sur une table qui peut avoir beaucoup de
  lignes en prod (`Facture`, `FactureProduit`, `StockLot`, `MouvementStock`), utiliser
  `RunSQL` avec `CREATE INDEX CONCURRENTLY IF NOT EXISTS` au lieu de `migrations.AddIndex`.
  Cela nécessite `atomic = False` sur la migration.
  - **Garde-fou automatique** : `python manage.py check_index_migrations` échoue si une
    migration crée un index sans CONCURRENTLY sur une grosse table (liste `BIG_TABLES`
    dans la commande). Baseline `api/checks/index_migrations_baseline.txt` ; branché en CI.
  - **Audit** : `python manage.py audit_indexes` — index manquants vs modèles, index
    inutilisés (`pg_stat_user_indexes`), doublons (préfixe), nommage auto. À lancer en
    prod (stats `idx_scan` fiables après uptime) avant de supprimer un index.
  - **Nommage** : toujours donner `name=` explicite aux `models.Index` — les noms hachés
    auto (`api_facture_xxx_a1b2c3_idx`) ont causé les doublons de 0263.
- **AddField avec default=** : sur une table >1000 lignes, préférer un `RunSQL` avec
  `ALTER TABLE ... ADD COLUMN ... DEFAULT ...` (PostgreSQL 11+ optimise cela sans
  full table rewrite si la valeur par défaut est constante).
- **RunPython sur gros datasets** : utiliser `iterator(chunk_size=500)` pour éviter
  de charger toutes les lignes en mémoire.

### Tests backend (Docker)

`manage.py test` et pytest utilisent un `LocMemCache` dédié au processus,
indépendant du Redis de l’application. Conserver cette isolation : les tests
qui calculent des rotations ou appellent `cache.clear()` ne doivent jamais
lire, remplir ou vider le cache de l’instance utilisée par les utilisateurs.

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
