# -*- coding: utf-8 -*-
"""
Commande de vérification d'intégrité à exécuter au démarrage du serveur.
Vérifie : connexion DB, migrations, espace disque, séquences auto-increment.
"""
import os
import shutil
import sys
from io import StringIO

# Fix Windows console encoding for Unicode characters
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = (
        "Vérifie l'intégrité du système avant le démarrage : "
        "DB, migrations, espace disque, séquences."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--fix',
            action='store_true',
            help='Corriger automatiquement les problèmes détectés (séquences, etc.)',
        )
        parser.add_argument(
            '--fail-fast',
            action='store_true',
            help='Quitter avec un code erreur dès le premier problème critique',
        )

    def handle(self, *args, **options):
        fix = options['fix']
        fail_fast = options['fail_fast']
        errors = []
        warnings = []

        self.stdout.write(self.style.HTTP_INFO(
            "\n══════════════════════════════════════════════"
            "\n   VÉRIFICATION D'INTÉGRITÉ DU SYSTÈME"
            "\n══════════════════════════════════════════════\n"
        ))

        # ── 1. Connexion DB ──
        self.stdout.write("1. Connexion à la base de données...")
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
                if result and result[0] == 1:
                    self.stdout.write(self.style.SUCCESS("   ✓ Connexion PostgreSQL OK"))
                else:
                    errors.append("La requête test DB a retourné un résultat inattendu")
                    self.stdout.write(self.style.ERROR("   ✗ Résultat DB inattendu"))
        except Exception as e:
            errors.append(f"Connexion DB impossible : {e}")
            self.stdout.write(self.style.ERROR(f"   ✗ Connexion DB échouée : {e}"))
            if fail_fast:
                self._exit_with_errors(errors)
                return

        # ── 2. Migrations ──
        self.stdout.write("2. Vérification des migrations...")
        try:
            out = StringIO()
            call_command('showmigrations', '--plan', stdout=out)
            output = out.getvalue()
            unapplied = [
                line.strip()
                for line in output.split('\n')
                if line.strip().startswith('[ ]')
            ]
            if unapplied:
                warnings.append(
                    f"{len(unapplied)} migration(s) non appliquée(s) : "
                    + ", ".join(m.replace('[ ] ', '') for m in unapplied[:5])
                )
                self.stdout.write(self.style.WARNING(
                    f"   ⚠ {len(unapplied)} migration(s) en attente"
                ))
                for m in unapplied[:5]:
                    self.stdout.write(f"     - {m.replace('[ ] ', '')}")
                if fix:
                    self.stdout.write("   → Application des migrations...")
                    call_command('migrate', '--noinput')
                    self.stdout.write(self.style.SUCCESS("   ✓ Migrations appliquées"))
            else:
                self.stdout.write(self.style.SUCCESS("   ✓ Toutes les migrations sont appliquées"))
        except Exception as e:
            warnings.append(f"Impossible de vérifier les migrations : {e}")
            self.stdout.write(self.style.WARNING(f"   ⚠ Erreur vérification migrations : {e}"))

        # ── 3. Espace disque ──
        self.stdout.write("3. Vérification de l'espace disque...")
        try:
            from django.conf import settings
            usage = shutil.disk_usage(settings.BASE_DIR)
            free_mb = usage.free / (1024 * 1024)
            total_mb = usage.total / (1024 * 1024)
            pct_free = (usage.free / usage.total) * 100

            if free_mb < 100:
                errors.append(f"Espace disque critique : {free_mb:.0f} MB libre")
                self.stdout.write(self.style.ERROR(
                    f"   ✗ CRITIQUE — Seulement {free_mb:.0f} MB libre ({pct_free:.1f}%)"
                ))
            elif free_mb < 500:
                warnings.append(f"Espace disque faible : {free_mb:.0f} MB libre")
                self.stdout.write(self.style.WARNING(
                    f"   ⚠ Attention — {free_mb:.0f} MB libre ({pct_free:.1f}%)"
                ))
            else:
                self.stdout.write(self.style.SUCCESS(
                    f"   ✓ Disque OK — {free_mb:.0f} MB libre / {total_mb:.0f} MB ({pct_free:.1f}%)"
                ))
        except Exception as e:
            warnings.append(f"Impossible de vérifier l'espace disque : {e}")
            self.stdout.write(self.style.WARNING(f"   ⚠ {e}"))

        # ── 4. Séquences auto-increment ──
        self.stdout.write("4. Vérification des séquences auto-increment...")
        try:
            desync_count = self._check_sequences(fix=fix)
            if desync_count == 0:
                self.stdout.write(self.style.SUCCESS("   ✓ Séquences OK"))
            elif fix:
                self.stdout.write(self.style.SUCCESS(
                    f"   ✓ {desync_count} séquence(s) corrigée(s)"
                ))
            else:
                warnings.append(f"{desync_count} séquence(s) désynchronisée(s)")
                self.stdout.write(self.style.WARNING(
                    f"   ⚠ {desync_count} séquence(s) désynchronisée(s) (lancer avec --fix)"
                ))
        except Exception as e:
            warnings.append(f"Impossible de vérifier les séquences : {e}")
            self.stdout.write(self.style.WARNING(f"   ⚠ {e}"))

        # ── 5. Dossier backups ──
        self.stdout.write("5. Vérification du dossier de sauvegardes...")
        try:
            from django.conf import settings
            backup_dir = settings.BASE_DIR / 'backups'
            if not backup_dir.exists():
                backup_dir.mkdir(parents=True, exist_ok=True)
                self.stdout.write(self.style.WARNING("   ⚠ Dossier backups créé"))
            
            backups = list(backup_dir.glob('backup_*.sql.gz'))
            if backups:
                import time
                latest = max(backups, key=lambda f: f.stat().st_mtime)
                age_hours = (time.time() - latest.stat().st_mtime) / 3600
                self.stdout.write(self.style.SUCCESS(
                    f"   ✓ {len(backups)} sauvegarde(s) — Dernière : {latest.name} "
                    f"(il y a {age_hours:.0f}h)"
                ))
                if age_hours > 48:
                    warnings.append(f"Dernière sauvegarde il y a {age_hours:.0f}h")
                    self.stdout.write(self.style.WARNING(
                        f"   ⚠ Dernière sauvegarde date de plus de 48h !"
                    ))
            else:
                warnings.append("Aucune sauvegarde trouvée")
                self.stdout.write(self.style.WARNING("   ⚠ Aucune sauvegarde trouvée"))
        except Exception as e:
            warnings.append(f"Erreur vérification backups : {e}")
            self.stdout.write(self.style.WARNING(f"   ⚠ {e}"))

        # ── 6. Dossier logs ──
        self.stdout.write("6. Vérification du dossier de logs...")
        try:
            from django.conf import settings
            log_dir = settings.BASE_DIR / 'logs'
            log_dir.mkdir(exist_ok=True)
            # Test d'écriture
            test_file = log_dir / '.integrity_test'
            test_file.write_text('ok', encoding='utf-8')
            test_file.unlink()
            self.stdout.write(self.style.SUCCESS("   ✓ Dossier logs accessible en écriture"))
        except Exception as e:
            errors.append(f"Dossier logs non accessible : {e}")
            self.stdout.write(self.style.ERROR(f"   ✗ {e}"))

        # ── Résumé ──
        self.stdout.write(self.style.HTTP_INFO(
            "\n──────────────────────────────────────────────"
        ))
        if not errors and not warnings:
            self.stdout.write(self.style.SUCCESS(
                "✓ TOUS LES CONTRÔLES SONT OK — Le système est prêt."
            ))
        else:
            if warnings:
                self.stdout.write(self.style.WARNING(
                    f"⚠ {len(warnings)} avertissement(s)"
                ))
            if errors:
                self.stdout.write(self.style.ERROR(
                    f"✗ {len(errors)} erreur(s) critique(s)"
                ))
                if fail_fast:
                    self._exit_with_errors(errors)

        self.stdout.write("")

    def _check_sequences(self, fix=False):
        """Vérifie et optionnellement corrige les séquences PostgreSQL."""
        desync_count = 0
        
        with connection.cursor() as cursor:
            # Récupérer toutes les tables avec auto-increment
            cursor.execute("""
                SELECT 
                    t.table_name,
                    c.column_name,
                    pg_get_serial_sequence(t.table_name, c.column_name) AS seq_name
                FROM information_schema.tables t
                JOIN information_schema.columns c 
                    ON t.table_name = c.table_name
                WHERE t.table_schema = 'public'
                    AND c.column_default LIKE 'nextval%%'
                ORDER BY t.table_name;
            """)
            
            sequences = cursor.fetchall()
            
            for table_name, column_name, seq_name in sequences:
                if not seq_name:
                    continue
                try:
                    # Valeur max actuelle dans la table
                    cursor.execute(
                        f'SELECT COALESCE(MAX("{column_name}"), 0) FROM "{table_name}"'
                    )
                    max_val = cursor.fetchone()[0]
                    
                    # Valeur actuelle de la séquence
                    cursor.execute(f"SELECT last_value FROM {seq_name}")
                    seq_val = cursor.fetchone()[0]
                    
                    if max_val > seq_val:
                        desync_count += 1
                        self.stdout.write(self.style.WARNING(
                            f"     {table_name}.{column_name}: "
                            f"max={max_val}, séquence={seq_val}"
                        ))
                        if fix:
                            cursor.execute(
                                f"SELECT setval('{seq_name}', %s)", [max_val]
                            )
                            self.stdout.write(self.style.SUCCESS(
                                f"     → Séquence corrigée à {max_val}"
                            ))
                except Exception as e:
                    self.stdout.write(self.style.WARNING(
                        f"     Impossible de vérifier {table_name}.{column_name}: {e}"
                    ))
        
        return desync_count

    def _exit_with_errors(self, errors):
        self.stdout.write(self.style.ERROR(
            "\n✗ ARRÊT — Problèmes critiques détectés :"
        ))
        for err in errors:
            self.stdout.write(self.style.ERROR(f"  - {err}"))
        sys.exit(1)
