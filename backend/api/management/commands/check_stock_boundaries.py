#!/usr/bin/env python
"""
Vérifie que les compteurs de stock ne sont écrits que depuis les services.

Règle : hors ``api/services/``, ``api/models/`` (le signal post_save et
``calculate_stock_from_lots`` y vivent), ``api/tests/`` et ``migrations/``,
aucun fichier ne doit écrire directement :

- ``Produit.stock`` / ``Produit.stock_reserve`` (assignation ou ``update(stock=…)``)
- ``StockLot.quantity_remaining`` / ``quantity_reserved`` / ``quantity_free_remaining``
  (assignation, ``update()`` ou ``bulk_update()`` — qui bypass le signal
  post_save de recalcul)

Toute écriture directe crée du « stock fantôme » : vendable sans lot (ou
l'inverse), invisible jusqu'au prochain recalcul — exactement le bug corrigé
sur les imports produits.

Les violations historiques connues sont consignées dans
``api/checks/stock_writes_baseline.txt`` (format ``chemin:ligne``). Le check
n'échoue que sur les violations **nouvelles** ; régénérer la baseline avec
``--write-baseline`` uniquement après revue explicite.

Usage :
    python manage.py check_stock_boundaries            # exit 1 si nouvelle violation
    python manage.py check_stock_boundaries --write-baseline
"""
import re
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

API_DIR = Path(settings.BASE_DIR) / 'api'
BASELINE_FILE = API_DIR / 'checks' / 'stock_writes_baseline.txt'

# Dossiers autorisés à écrire les compteurs (chemins relatifs à api/).
ALLOWED_PREFIXES = ('services/', 'models/', 'tests/', 'migrations/', 'checks/')

# Patterns d'écriture interdits. On vise les assignations et les .update() ORM
# sur les champs compteurs — assez précis pour éviter les faux positifs
# (stock_apres, stock_apres_reception, use_lot_management, etc.).
PATTERNS = [
    # produit.stock = … / produit.stock += … / produit.stock -= …
    re.compile(r'\.stock\s*(?:[-+*/])?=(?!=)'),
    re.compile(r'\.stock_reserve\s*(?:[-+*/])?=(?!=)'),
    # Produit.objects….update(stock=…, stock_reserve=…)
    re.compile(r'\.update\([^)]*\bstock(?:_reserve)?\s*='),
    # lot.quantity_remaining = … / += / -= / quantity_reserved / quantity_free_remaining
    re.compile(r'\.quantity_(?:remaining|reserved|free_remaining)\s*(?:[-+*/])?=(?!=)'),
    # StockLot.objects….update(quantity_remaining=…)
    re.compile(r'\.update\([^)]*\bquantity_(?:remaining|reserved|free_remaining)\s*='),
    # bulk_update(…, ['quantity_remaining', …]) — bypass du signal post_save
    re.compile(r'\.bulk_update\([^)]*quantity_(?:remaining|reserved|free_remaining)'),
]

# Fichiers de management commands « utilitaires one-shot » qu'on tolère sans
# les lister individuellement en baseline : ils s'exécutent manuellement et
# leur rôle est précisément de réparer des données.
TOLERATED_COMMAND_PREFIXES = ('generate_', 'fix_', 'debug_', 'check_')


def scan_file(path: Path):
    """Retourne les violations [(lineno, line_stripped), …] d'un fichier."""
    violations = []
    try:
        lines = path.read_text(encoding='utf-8').splitlines()
    except (UnicodeDecodeError, OSError):
        return violations
    for lineno, line in enumerate(lines, start=1):
        stripped = line.strip()
        if stripped.startswith('#'):
            continue
        for pattern in PATTERNS:
            if pattern.search(line):
                violations.append((lineno, stripped))
                break
    return violations


class Command(BaseCommand):
    help = 'Échoue si un fichier hors services/ modifie les compteurs de stock'

    def add_arguments(self, parser):
        parser.add_argument(
            '--write-baseline', action='store_true',
            help='Réécrit la baseline avec les violations actuelles (après revue).',
        )

    def handle(self, *args, **options):
        findings = {}  # relpath -> [(lineno, line)]
        for py in sorted(API_DIR.rglob('*.py')):
            rel = py.relative_to(API_DIR).as_posix()
            if rel.startswith(ALLOWED_PREFIXES):
                continue
            if rel.startswith('management/commands/'):
                name = Path(rel).name
                if name.startswith(TOLERATED_COMMAND_PREFIXES):
                    continue
            violations = scan_file(py)
            if violations:
                findings[rel] = violations

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
                '# Baseline des écritures directes de compteurs de stock (revue du\n'
                '# code). Ne régénérer qu\'après revue : chaque ligne est une\n'
                '# écriture hors services/ acceptée au moment de la baseline.\n'
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
                f'(code corrigé ou déplacé) — envisagez --write-baseline pour nettoyer.'
            ))

        if not new_violations:
            self.stdout.write(self.style.SUCCESS(
                f'✓ Aucune nouvelle écriture directe de compteurs hors services/ '
                f'({len(baseline)} en baseline, {len(current)} détectées au total).'
            ))
            return

        self.stdout.write(self.style.ERROR(
            f'\n✗ {len(new_violations)} NOUVELLE(S) écriture(s) directe(s) de compteurs de stock :\n'
        ))
        for key in new_violations:
            rel, lineno = key.rsplit(':', 1)
            line = next(l for n, l in findings[rel] if str(n) == lineno)
            self.stdout.write(f'  api/{rel}:{lineno}  →  {line}')
        self.stdout.write(self.style.ERROR(
            '\nLes compteurs Produit.stock / StockLot.quantity_* doivent être '
            'modifiés via api/services/ (LotAllocationService, '
            'StockObligationService) ou Produit.calculate_stock_from_lots().\n'
            'Si l\'écriture directe est justifiée et revue, régénérer la baseline :\n'
            '    python manage.py check_stock_boundaries --write-baseline'
        ))
        raise SystemExit(1)
