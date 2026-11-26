#!/usr/bin/env python
"""
Audit des index PostgreSQL de l'app ``api`` — rapport en lecture seule.

Sections :

1. **Manquants** — index attendus d'après les modèles Django (``Meta.indexes``,
   ``db_index=True``, FK, ``unique_together``/``index_together``) dont aucune
   colonne-indexée en base ne couvre le préfixe.
2. **Non déclarés** — index présents en base mais non rattachables à une
   déclaration de modèle (créés via ``RunSQL`` sans ``state_operations``,
   hérités de squashs, renommés). Informatif : pas forcément à supprimer.
3. **Inutilisés** — ``pg_stat_user_indexes.idx_scan = 0``, hors PK et index
   uniques. Triés par taille disque décroissante : chacun coûte en écriture
   et en stockage. ATTENTION : stats remises à zéro au restart de Postgres —
   interpréter sur une instance ayant vécu (prod > dev).
4. **Doublons/chevauchements** — même table, colonnes de A en préfixe strict
   de B : A est redondant (B le couvre). Hors index uniques.
5. **Nommage auto** — ``Meta.indexes`` sans ``name=`` explicite : les noms
   hachés générés par Django (``api_facture_xxx_a1b2c3_idx``) ont causé les
   doublons état/migrations de 0263. Convention : toujours nommer.

Usage :
    python manage.py audit_indexes            # rapport complet
    python manage.py audit_indexes --unused   # section inutilisés seule
"""
import re
from collections import defaultdict

from django.apps import apps
from django.core.management.base import BaseCommand
from django.db import connection

AUTO_NAME_RE = re.compile(r'_[0-9a-f]{6,7}_idx$')


def _fmt_size(num):
    for unit in ('o', 'Ko', 'Mo', 'Go'):
        if num < 1024 or unit == 'Go':
            return f'{num:.0f} {unit}' if unit == 'o' else f'{num:.1f} {unit}'
        num /= 1024


def _expected_indexes():
    """{db_table: set(tuple(colonnes))} attendus d'après les modèles api."""
    expected = defaultdict(set)
    for model in apps.get_app_config('api').get_models():
        meta = model._meta
        if not meta.managed:
            continue
        table = meta.db_table
        col_of = {f.name: f.column for f in meta.get_fields() if getattr(f, 'column', None)}
        for f in meta.fields:
            if f.primary_key:
                continue
            # FK indexée d'office, db_index=True, ou unique (index implicite)
            if f.many_to_one or f.db_index or f.unique:
                expected[table].add((f.column,))
        for fields in meta.unique_together or ():
            cols = tuple(col_of.get(n) for n in fields)
            if all(cols):
                expected[table].add(cols)
        for idx in meta.indexes:
            # On ne résout que les index "simples" sur champs nommés ;
            # les index fonctionnels (expressions) sont ignorés. Le préfixe
            # '-' d'un ordre descendant ne change pas les colonnes stockées.
            if getattr(idx, 'contains_expressions', False):
                continue
            cols = tuple(col_of.get(n.lstrip('-')) for n in (idx.fields or ()))
            if cols and all(cols):
                expected[table].add(cols)
    return expected


def _actual_indexes():
    """{db_table: {index_name: (cols_tuple, unique)}}"""
    actual = defaultdict(dict)
    with connection.cursor() as cur:
        tables = {m._meta.db_table for m in apps.get_app_config('api').get_models()}
        for table in sorted(tables):
            try:
                constraints = connection.introspection.get_constraints(cur, table)
            except Exception:
                continue
            for name, c in constraints.items():
                # Une contrainte unique couvre aussi l'attendu en index ;
                # une FK sans index, non.
                if (c.get('index') or c.get('unique')) and not c.get('primary_key') \
                        and not c.get('foreign_key') and c.get('columns'):
                    actual[table][name] = (tuple(c['columns']), bool(c.get('unique')))
    return actual


def _partial_indexes():
    """Noms des index partiels (WHERE …) — non substituables par un index
    complet : les exclure de la détection de doublons."""
    with connection.cursor() as cur:
        cur.execute("""
            SELECT i.indexrelid::regclass::text
            FROM pg_index i
            JOIN pg_class c ON c.oid = i.indrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND i.indpred IS NOT NULL
        """)
        return {r[0] for r in cur.fetchall()}


def _unused_indexes():
    """[(index, table, size_bytes)] non-unique, hors PK, idx_scan = 0."""
    sql = """
        SELECT s.indexrelname, s.relname, pg_relation_size(s.indexrelid)
        FROM pg_stat_user_indexes s
        JOIN pg_index i ON i.indexrelid = s.indexrelid
        WHERE s.schemaname = 'public'
          AND s.idx_scan = 0
          AND NOT i.indisunique
          AND NOT i.indisprimary
        ORDER BY pg_relation_size(s.indexrelid) DESC
    """
    with connection.cursor() as cur:
        cur.execute(sql)
        return cur.fetchall()


class Command(BaseCommand):
    help = 'Audit des index : manquants, non déclarés, inutilisés, doublons, nommage'

    def add_arguments(self, parser):
        parser.add_argument('--unused', action='store_true',
                            help='Affiche uniquement la section des index inutilisés.')

    def handle(self, *args, **options):
        if options['unused']:
            self._report_unused()
            return

        expected = _expected_indexes()
        actual = _actual_indexes()

        # 1. Index attendus mais non couverts en base (préfixe suffisant)
        missing = []
        for table, cols_set in sorted(expected.items()):
            actual_cols = [cols for cols, _u in actual.get(table, {}).values()]
            for cols in sorted(cols_set):
                if not any(a[:len(cols)] == cols for a in actual_cols):
                    missing.append((table, '+'.join(cols)))
        self._section('Index attendus par les modèles mais absents en base')
        if missing:
            for t, c in missing:
                self.stdout.write(f'  {t}  ({c})')
        else:
            self.stdout.write('  — néant —')

        # 2. En base mais non déclarés (colonnes non couvertes par l'attendu)
        orphans = []
        for table, idxs in sorted(actual.items()):
            exp_cols = expected.get(table, set())
            for name, (cols, unique) in sorted(idxs.items()):
                if unique or name.endswith('_like'):
                    # _like : index pattern_ops auto-créé par Django pour les
                    # recherches LIKE sur champs uniques — compagnon attendu.
                    continue
                if not any(e[:len(cols)] == cols or cols[:len(e)] == e for e in exp_cols):
                    orphans.append((table, name, '+'.join(cols)))
        self._section('Index en base non déclarés dans les modèles (informatif)')
        if orphans:
            for t, n, c in orphans:
                self.stdout.write(f'  {t}.{n}  ({c})')
        else:
            self.stdout.write('  — néant —')

        # 3. Inutilisés
        self._report_unused()

        # 4. Chevauchements : A préfixe strict de B (non uniques)
        self._section('Index redondants (colonnes préfixe d\'un index plus large)')
        partial = _partial_indexes()
        dup = []
        for table, idxs in sorted(actual.items()):
            items = [(n, c, u) for n, (c, u) in idxs.items()]
            for na, ca, ua in items:
                if ua or na in partial:
                    continue
                for nb, cb, ub in items:
                    # Le couvrant partiel ne remplace pas un index complet ;
                    # le couvert partiel n'est pas remplacé par un index complet.
                    if na != nb and nb not in partial and len(cb) > len(ca) \
                            and cb[:len(ca)] == ca:
                        dup.append((table, na, nb))
                        break
        if dup:
            for t, a, b in dup:
                self.stdout.write(f'  {t}: {a}  ⊂  {b}')
        else:
            self.stdout.write('  — néant —')

        # 5. Nommage automatique (hash Django) sur les index de Meta
        self._section('Index sans nom explicite (hash auto Django — convention : toujours nommer)')
        auto = []
        for model in apps.get_app_config('api').get_models():
            for idx in model._meta.indexes:
                if AUTO_NAME_RE.search(idx.name or ''):
                    auto.append((model._meta.db_table, idx.name, '+'.join(idx.fields or ())))
        if auto:
            for t, n, c in auto:
                self.stdout.write(f'  {t}.{n}  ({c})')
        else:
            self.stdout.write('  — néant —')

    def _report_unused(self):
        self._section('Index inutilisés (idx_scan = 0 — stats depuis le dernier restart Postgres)')
        unused = _unused_indexes()
        if unused:
            for name, table, size in unused:
                self.stdout.write(f'  {table}.{name}  {_fmt_size(size)}')
            total = sum(s for _, _, s in unused)
            self.stdout.write(f'  → {len(unused)} index, {_fmt_size(total)} au total')
        else:
            self.stdout.write('  — néant —')

    def _section(self, title):
        self.stdout.write(self.style.MIGRATE_HEADING(f'\n== {title} =='))
