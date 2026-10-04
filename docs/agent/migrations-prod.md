# Migrations Django en production & tests backend

> Référence détaillée — l'essentiel est dans AGENTS.md à la racine.

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
