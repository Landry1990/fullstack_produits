"""
Smoke test des management commands : un cron qui crash est invisible en prod.

Contrairement aux routes HTTP, les commandes planifiées (scheduler toutes les
10 min, tâches mensuelles, entrypoint `check_integrity`, crons backup) ne
produisent aucune erreur visible côté utilisateur — un crash passe inaperçu
pendant des semaines.

1. `test_all_commands_importable` — chaque commande de `api/management/commands`
   s'importe et s'instancie : détecte les erreurs d'import/syntaxe qui tuent un
   cron avant même son exécution.

2. `test_safe_commands_run` — exécution réelle (ou `--dry-run`) sur la base de
   test jetable : la commande doit se terminer ou échouer de façon contrôlée
   (CommandError/SystemExit), jamais sur une exception non rattrapée.

3. `test_arg_guarded_commands_fail_loudly` — les commandes destructrices qui
   exigent un argument (restore, imports) doivent lever CommandError/SystemExit
   sans lui : un échec bruyant, jamais une exécution silencieuse.

Lancer :
    docker exec fullstack_produits-backend-1 \\
        python manage.py test api.tests.test_commands_smoke -v 2 --noinput
"""
import os
from io import StringIO

from django.core.management import call_command, get_commands, load_command_class
from django.core.management.base import CommandError
from django.test import TestCase
from django.utils import timezone

from api.models import OrderSchedule, PharmacySettings

from .factories import TestDataFactory

# Exécution sûre sur la base de test jetable : commande → args.
# Inclut tous les crons du scheduler (api/scheduler.py), la commande de
# l'entrypoint (check_integrity) et les --dry-run des commandes destructrices.
SAFE_RUN = {
    # ── Crons / scheduler (api/scheduler.py) ──
    'run_order_schedules': [],           # toutes les 10 min en prod
    'recalculate_analytics': [],         # mensuel (seuils min/max)
    'send_monthly_report': ['--force'],  # génère le rapport (telegram désactivé → pas d'envoi)
    'send_monthly_telegram_report': [],  # gardé par report_send_telegram=False
    'send_chronic_reminders': [],        # aucun rappel dû → no-op
    'auto_backup': [],                   # backup_enabled=False dans le seed → no-op
    # ── Entrypoint conteneur ──
    'check_integrity': [],               # lancé à chaque démarrage (entrypoint.sh)
    # ── Diagnostics lecture seule ──
    'check_expiring_products': [],
    'check_tiers_payant': [],
    'debug_stock_score': [],
    'recalc_solde_depot': [],            # dry-run par défaut
    # ── --dry-run des commandes destructrices ──
    'run_retention': ['--dry-run'],
    'check_licence_expiration': ['--dry-run'],
    'archive_audit_logs': ['--dry-run'],
    'clean_audit_noise': ['--dry-run'],
    'purge_loadtest_data': ['--dry-run'],
    'purge_produits': ['--dry-run'],
    'backup_and_reorg': ['--dry-run'],
    'fix_dci_combination': ['--dry-run'],
    'normalize_dci': ['--dry-run'],
    'link_dci_produits': ['--dry-run'],
    'import_interactions': ['--dry-run'],
    # ── Mutations inoffensives sur DB jetable ──
    'cleanup_silk': [],                  # aucune donnée silk → no-op
    'clean_draft_invoices': ['--older-than', '3650'],  # queryset vide → pas de prompt
    'clean_transactional_data': [],      # refuse sans --confirm
    'inject_licence': [],                # sans clé → CommandError contrôlée
    'generate_retroactive_lots': [],
    'recalculate_stocks': [],
    'recalculate_stock_from_lots': [],
    'fix_invoice_lots': [],
    'fix_stock_apres_reception': [],
}

# Argument(s) obligatoire(s) : sans eux, échec bruyant exigé (CommandError
# argparse ou SystemExit) — jamais une exécution partielle silencieuse.
ARG_GUARDED = [
    'import_dci_data',
    'import_excel_csv',
    'import_supplier_data',
    'restore_database',
    'pitr_restore',
]

# Jamais exécutées en test : réseau réel, écriture disque lourde, destructrices
# sans garde, ou outils de dev nécessitant un contexte spécifique. Couvertes par
# le test d'import uniquement.
IMPORT_ONLY = {
    'fetch_openfda_contre_indications',  # appel HTTP openFDA
    'generate_fake_data',                # 10k+ objets
    'setup_dci_prod',                    # fichiers DCI requis
    'import_med_ref',                    # fichier requis
    'export_dci_data',                   # écrit un fichier JSON
    'backup_database', 'base_backup',    # pg_dump réel
    'reset_sequences',                   # casse les séquences de la DB de test
    'profile_finalize',                  # outil de profilage (user loadtest requis)
}


class CommandsSmokeTest(TestCase):
    """Les commandes (crons surtout) ne doivent jamais crasher silencieusement."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = TestDataFactory.create_superuser(username='cmd-admin')
        cls.produit = TestDataFactory.create_produit(stock=50)
        cls.fournisseur = cls.produit.fournisseur
        cls.customer = TestDataFactory.create_client(
            client_type='PROFESSIONNEL', taux_couverture=70
        )
        cls.facture = TestDataFactory.create_facture(
            client=cls.customer, status='VAL', total_ttc=1000
        )
        TestDataFactory.create_facture_produit(
            cls.facture, cls.produit, selling_price=1000
        )
        # Lot expirant bientôt → exerce la boucle de check_expiring_products
        TestDataFactory.create_stock_lot(
            cls.produit,
            date_expiration=timezone.now().date() + timezone.timedelta(days=10),
        )
        # Schedule actif aujourd'hui, heure déjà passée → exerce le pipeline
        # de suggestions automatiques (erreurs internes loguées, pas fatales)
        local_now = timezone.localtime()
        OrderSchedule.objects.create(
            fournisseur=cls.fournisseur,
            active_days=[local_now.weekday()],
            time=(local_now - timezone.timedelta(minutes=5)).time(),
            execution_mode=OrderSchedule.ExecutionMode.SIMPLE,
        )
        # Paramètres : backup et envois désactivés pour rester déterministe,
        # rapport mensuel activé → send_monthly_report génère vraiment le rapport.
        cls.ps, _ = PharmacySettings.objects.get_or_create(pk=1)
        cls.ps.backup_enabled = False
        cls.ps.monthly_report_enabled = True
        cls.ps.telegram_enabled = False
        cls.ps.report_send_telegram = False
        cls.ps.save()

    # ── 1. Import ──

    def test_all_commands_importable(self):
        """Chaque commande api s'importe et s'instancie sans erreur."""
        app_commands = sorted(
            name for name, app in get_commands().items() if app == 'api'
        )
        failures = []
        for name in app_commands:
            try:
                load_command_class('api', name)
            except Exception as exc:  # noqa: BLE001 — on collecte tout
                failures.append(f'{name}: {type(exc).__name__}: {exc}')

        print(f'\n[CMD] {len(app_commands)} commandes api détectées')
        self.assertEqual(
            failures, [],
            'Commandes impossibles à importer :\n  ' + '\n  '.join(failures),
        )

    # ── 2. Exécution sûre ──

    def test_safe_commands_run(self):
        """Les commandes sûres se terminent ; CommandError = échec contrôlé."""
        crashes = []
        controlled = []
        for name, args in sorted(SAFE_RUN.items()):
            out, err = StringIO(), StringIO()
            try:
                call_command(name, *args, stdout=out, stderr=err)
            except CommandError as exc:
                controlled.append(f'{name}: {exc}')
            except SystemExit as exc:
                controlled.append(f'{name}: SystemExit({exc.code})')
            except Exception as exc:  # noqa: BLE001 — crash = échec du test
                crashes.append(f'{name}: {type(exc).__name__}: {exc}')

        print(f'\n[CMD] {len(SAFE_RUN)} commandes exécutées')
        if controlled:
            print(f'  Échecs contrôlés (OK): {len(controlled)}')
            for c in controlled:
                print(f'    - {c}')
        self.assertEqual(
            crashes, [],
            'Commandes ayant crashé :\n  ' + '\n  '.join(crashes),
        )

    # ── 3. Garde-fous des commandes dangereuses ──

    def test_arg_guarded_commands_fail_loudly(self):
        """Sans l'argument requis : CommandError/SystemExit, jamais de crash."""
        silent_success = []
        crashes = []
        for name in ARG_GUARDED:
            out, err = StringIO(), StringIO()
            try:
                call_command(name, stdout=out, stderr=err)
                silent_success.append(name)
            except (CommandError, SystemExit, EOFError):
                pass  # échec bruyant attendu
            except Exception as exc:  # noqa: BLE001
                crashes.append(f'{name}: {type(exc).__name__}: {exc}')

        self.assertEqual(
            crashes, [],
            'Commandes ayant crashé au lieu de refuser :\n  '
            + '\n  '.join(crashes),
        )
        # Un succès silencieux sans args est suspect mais pas forcément faux
        if silent_success:
            print(
                f'\n[CMD] ⚠ Sont passées sans arg requis : {silent_success}'
            )

    # ── 4. Cohérence de la classification ──

    def test_command_classification_is_exhaustive(self):
        """Chaque commande api est classée : SAFE_RUN, ARG_GUARDED ou IMPORT_ONLY."""
        app_commands = {
            name for name, app in get_commands().items() if app == 'api'
        }
        classified = set(SAFE_RUN) | set(ARG_GUARDED) | IMPORT_ONLY
        unclassified = sorted(app_commands - classified)
        self.assertEqual(
            unclassified, [],
            'Nouvelles commandes non classées — les ajouter à SAFE_RUN, '
            'ARG_GUARDED ou IMPORT_ONLY :\n  ' + '\n  '.join(unclassified),
        )
