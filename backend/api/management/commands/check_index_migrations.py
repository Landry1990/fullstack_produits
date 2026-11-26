#!/usr/bin/env python
"""
Vérifie que tout index créé par migration sur une grosse table utilise
``CREATE INDEX CONCURRENTLY`` (règle ``docs/agent/migrations-prod.md``).

Un ``migrations.AddIndex`` ou un ``CREATE INDEX`` classique pose un verrou
``ACCESS EXCLUSIVE`` (resp. ``SHARE``) pendant toute la construction : sur une
table de plusieurs millions de lignes en prod (caisse en cours d'utilisation),
cela bloque les écritures plusieurs minutes. Le CONCURRENTLY construit sans
bloquer, au prix d'être hors transaction (``atomic = False``).

Patterns détectés (sur les tables listées dans ``BIG_TABLES``) :

- ``migrations.AddIndex(model_name='facture', ...)``
- ``migrations.AddField(..., db_index=True)`` — crée un index implicite
- ``RunSQL`` contenant ``CREATE INDEX`` (ou ``CREATE UNIQUE INDEX``) sans
  ``CONCURRENTLY`` sur ``api_<table>``

Les violations historiques revues sont consignées dans
``api/checks/index_migrations_baseline.txt`` (format ``fichier:ligne``). Le
check n'échoue que sur les violations **nouvelles** ; régénérer la baseline
avec ``--write-baseline`` uniquement après revue explicite.

Usage :
    python manage.py check_index_migrations            # exit 1 si nouvelle violation
    python manage.py check_index_migrations --write-baseline
"""
import re
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

API_DIR = Path(settings.BASE_DIR) / 'api'
MIGRATIONS_DIR = API_DIR / 'migrations'
BASELINE_FILE = API_DIR / 'checks' / 'index_migrations_baseline.txt'

# Tables volumineuses en prod : index uniquement en CONCURRENTLY.
# (model_name Django en minuscules)
BIG_TABLES = frozenset({
    'facture', 'factureproduit', 'stocklot', 'mouvementstock',
    'caisse', 'paiementfournisseur', 'inventaire',
    'auditlog', 'activitylog', 'smslog', 'whatsapplog',
})

MODEL_RE = re.compile(r"model_name\s*=\s*['\"](\w+)['\"]")
TABLE_RE = re.compile(r'\bON\s+(?:public\.)?(api_)?(\w+)\s*\(')
WINDOW = 25  # lignes lues après un opérateur pour trouver model_name / le SQL


def _state_operations_lines(text: str):
    """Numéros de ligne couverts par des blocs ``state_operations=[...]`` :
    les opérations qui s'y trouvent sont state-only (pas de SQL émis), elles
    accompagnent un RunSQL CONCURRENTLY via SeparateDatabaseAndState."""
    covered = set()
    for m in re.finditer(r'state_operations\s*=\s*\[', text):
        depth, pos = 0, m.end() - 1  # on part du '['
        while pos < len(text):
            c = text[pos]
            if c == '[':
                depth += 1
            elif c == ']':
                depth -= 1
                if depth == 0:
                    break
            pos += 1
        start = text.count('\n', 0, m.end() - 1)
        end = text.count('\n', 0, pos)
        covered.update(range(start, end + 1))
    return covered


def scan_file(path: Path):
    """Retourne les violations [(lineno, line_stripped), …] d'un fichier de
    migration. Une fenêtre de WINDOW lignes suit chaque opérateur pour
    attraper model_name (AddIndex/AddField) ou la cible ON (RunSQL)."""
    violations = []
    try:
        text = path.read_text(encoding='utf-8')
    except (UnicodeDecodeError, OSError):
        return violations
    lines = text.splitlines()
    state_only = _state_operations_lines(text)
    for i, line in enumerate(lines):
        if i in state_only:
            continue
        window = '\n'.join(lines[i:i + WINDOW])
        stripped = line.strip()
        hit = None
        if 'AddIndex(' in stripped or 'AddField(' in stripped:
            m = MODEL_RE.search(window)
            big = m and m.group(1).lower() in BIG_TABLES
            if 'AddIndex(' in stripped and big:
                hit = 'AddIndex sur grosse table'
            elif 'AddField(' in stripped and big and 'db_index=True' in window:
                hit = 'AddField db_index sur grosse table'
        elif 'RunSQL(' in stripped or 'sql=' in stripped:
            for m in re.finditer(
                    r'CREATE\s+(?:UNIQUE\s+)?INDEX(?!_CONCURRENTLY)(?!\s+CONCURRENTLY)',
                    window):
                tail = window[m.start():]
                t = TABLE_RE.search(tail)
                if t and t.group(2) in BIG_TABLES:
                    hit = 'CREATE INDEX sans CONCURRENTLY sur grosse table'
                    break
        if hit:
            violations.append((i + 1, f'{stripped}  [{hit}]'))
    return violations


class Command(BaseCommand):
    help = 'Échoue si une migration crée un index sans CONCURRENTLY sur une grosse table'

    def add_arguments(self, parser):
        parser.add_argument(
            '--write-baseline', action='store_true',
            help='Réécrit la baseline avec les violations actuelles (après revue).',
        )

    def handle(self, *args, **options):
        findings = {}  # filename -> [(lineno, line)]
        for py in sorted(MIGRATIONS_DIR.glob('*.py')):
            if py.name == '__init__.py':
                continue
            violations = scan_file(py)
            if violations:
                findings[py.name] = violations

        current = {f'{rel}:{lineno}' for rel, v in findings.items() for lineno, _ in v}

        baseline = set()
        if BASELINE_FILE.exists():
            baseline = {
                line.strip() for line in BASELINE_FILE.read_text(encoding='utf-8').splitlines()
                if line.strip() and not line.startswith('#')
            }

        if options['write_baseline']:
            BASELINE_FILE.parent.mkdir(parents=True, exist_ok=True)
            header = (
                '# Baseline des créations d\'index non-concurrentes sur grosses\n'
                '# tables (revue du code — les migrations passées ne se réécrivent\n'
                '# pas). Ne régénérer qu\'après revue.\n'
            )
            BASELINE_FILE.write_text(header + '\n'.join(sorted(current)) + '\n', encoding='utf-8')
            self.stdout.write(self.style.SUCCESS(
                f'Baseline écrite : {len(current)} entrée(s) → {BASELINE_FILE}'
            ))
            return

        new_violations = sorted(current - baseline)
        stale_baseline = sorted(baseline - current)

        if stale_baseline:
            self.stdout.write(self.style.WARNING(
                f'{len(stale_baseline)} entrée(s) de baseline devenues obsolètes '
                f'— envisagez --write-baseline pour nettoyer.'
            ))

        if not new_violations:
            self.stdout.write(self.style.SUCCESS(
                f'✓ Aucune nouvelle création d\'index non-concurrente sur grosse '
                f'table ({len(baseline)} en baseline, {len(current)} détectées au total).'
            ))
            return

        self.stdout.write(self.style.ERROR(
            f'\n✗ {len(new_violations)} NOUVELLE(S) création(s) d\'index à risque :\n'
        ))
        for key in new_violations:
            rel, lineno = key.rsplit(':', 1)
            line = next(l for n, l in findings[rel] if str(n) == lineno)
            self.stdout.write(f'  migrations/{rel}:{lineno}  →  {line}')
        self.stdout.write(self.style.ERROR(
            '\nSur les grosses tables, utiliser :\n'
            '    atomic = False\n'
            '    migrations.SeparateDatabaseAndState(\n'
            '        database_operations=[migrations.RunSQL(\n'
            '            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS <name> ON api_<table> (cols);",\n'
            '            reverse_sql="DROP INDEX CONCURRENTLY IF EXISTS <name>;")],\n'
            '        state_operations=[migrations.AddIndex(...)])\n'
            'Si la violation est justifiée et revue, régénérer la baseline :\n'
            '    python manage.py check_index_migrations --write-baseline'
        ))
        raise SystemExit(1)
