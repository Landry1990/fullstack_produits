# -*- coding: utf-8 -*-
"""
Commande de sauvegarde automatique avec réorganisation des clés primaires.

Usage:
    python manage.py backup_and_reorg --dry-run       # Simuler sans modifier
    python manage.py backup_and_reorg --confirm        # Exécuter
    python manage.py backup_and_reorg --confirm --skip-backup  # Sans backup
"""
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.db import connection, transaction
from django.conf import settings
from collections import OrderedDict
import time
import os
from datetime import datetime


# ──────────────────────────────────────────────────────────────────
# Configuration : tables à réorganiser et leurs FK dépendantes
# ──────────────────────────────────────────────────────────────────
# Chaque entrée :  (db_table, pk_column, [(child_table, fk_column), ...])
# L'ordre est important : traiter les parents AVANT les enfants
# qui pourraient être eux-mêmes parents d'autres tables.

REORG_CONFIG = OrderedDict([
    # ── Commandes ──
    ('api_commande', ('id', [
        ('api_commandeproduit', 'commande_id'),
        ('api_paiementfournisseur', 'commande_id'),
    ])),
    ('api_commandeproduit', ('id', [])),

    # ── Factures ──
    ('api_facture', ('id', [
        ('api_factureproduit', 'facture_id'),
        ('api_caisse', 'facture_id'),
        ('api_promis', 'facture_id'),
        ('api_ordonnancier', 'facture_id'),
        ('api_couponmonnaie', 'facture_origine_id'),
        ('api_couponmonnaie', 'facture_utilisation_id'),
    ])),
    ('api_factureproduit', ('id', [
        ('api_factureproduitallocation', 'facture_produit_id'),
    ])),
    ('api_factureproduitallocation', ('id', [])),

    # ── Stock ──
    ('api_stocklot', ('id', [
        ('api_factureproduitallocation', 'stock_lot_id'),
        ('api_factureproduit', 'stock_lot_id'),
        ('api_ligneinventaire', 'stock_lot_id'),
    ])),

    # ── Paiements & Caisse ──
    ('api_relevepaiement', ('id', [
        ('api_caisse', 'releve_id'),
    ])),
    ('api_caisse', ('id', [])),
    ('api_cloturecaisse', ('id', [])),

    # ── Avoirs ──
    ('api_avoir', ('id', [
        ('api_ligneavoir', 'avoir_id'),
    ])),
    ('api_ligneavoir', ('id', [])),

    # ── Promis ──
    ('api_promis', ('id', [
        ('api_smslog', 'promis_id'),
    ])),

    # ── Inventaire ──
    ('api_inventaire', ('id', [
        ('api_ligneinventaire', 'inventaire_id'),
    ])),
    ('api_ligneinventaire', ('id', [])),

    # ── Transformations ──
    ('api_historiquetransformation', ('id', [])),

    # ── Paiements Fournisseur ──
    ('api_paiementfournisseur', ('id', [])),

    # ── Audit ──
    ('api_auditlog', ('id', [])),
    ('api_activitylog', ('id', [])),
    ('api_mouvementcaisse', ('id', [])),
    ('api_mouvementstock', ('id', [])),

    # ── Ordonnancier ──
    ('api_ordonnancier', ('numero_ordre', [
        ('api_ligneordonnancier', 'ordonnancier_id'),
    ])),
    ('api_ligneordonnancier', ('id', [])),

    # ── Promotions ──
    ('api_promotion', ('id', [
        ('api_promotionpackitem', 'promotion_id'),
    ])),
    ('api_promotionpackitem', ('id', [])),

    # ── Communication ──
    ('api_smslog', ('id', [])),

    # ── Coupons ──
    ('api_couponmonnaie', ('id', [])),

    # ── Ajustements stock ──
    ('api_stockadjustment', ('id', [])),
])


class Command(BaseCommand):
    help = 'Sauvegarde la base puis réorganise les clés primaires (IDs séquentiels)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm', action='store_true',
            help='Confirmer l\'exécution (obligatoire)',
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Simuler sans modifier la base (affiche le plan)',
        )
        parser.add_argument(
            '--skip-backup', action='store_true',
            help='Sauter l\'étape de sauvegarde PostgreSQL',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        confirm = options['confirm']
        skip_backup = options['skip_backup']

        if not dry_run and not confirm:
            self.stdout.write(self.style.ERROR(
                'ATTENTION: Cette commande reorganise les cles primaires !\n'
            ))
            self.stdout.write('Options disponibles:')
            self.stdout.write('  --dry-run     Simuler sans modifier')
            self.stdout.write('  --confirm     Executer la reorganisation')
            self.stdout.write('  --skip-backup Sauter la sauvegarde\n')
            self.stdout.write(self.style.WARNING(
                'Ajoutez --dry-run pour voir le plan ou --confirm pour executer.'
            ))
            return

        # ═══════════════════════════════════════════
        # ÉTAPE 1 : Analyse préalable
        # ═══════════════════════════════════════════
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write('  ANALYSE DES TABLES')
        self.stdout.write('=' * 60 + '\n')

        analysis = self._analyze_tables()

        if not analysis['tables_with_gaps']:
            self.stdout.write(self.style.SUCCESS(
                '\n[OK] Aucune reorganisation necessaire ! Toutes les cles sont deja sequentielles.'
            ))
            return

        self._print_analysis(analysis)

        if dry_run:
            self.stdout.write(self.style.WARNING(
                '\n[DRY-RUN] Aucune modification effectuee.'
            ))
            return

        # ============================================
        # ETAPE 2 : Sauvegarde
        # ============================================
        if not skip_backup:
            self.stdout.write('\n' + '=' * 60)
            self.stdout.write('  SAUVEGARDE DE LA BASE DE DONNEES')
            self.stdout.write('=' * 60 + '\n')

            try:
                call_command('backup_database')
                self.stdout.write(self.style.SUCCESS(
                    '[OK] Sauvegarde terminee avec succes.\n'
                ))
            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f'[ERREUR] Echec de la sauvegarde : {e}\n'
                    'Abandon de la reorganisation. Corrigez le probleme ou utilisez --skip-backup.'
                ))
                return
        else:
            self.stdout.write(self.style.WARNING(
                '\n[SKIP] Sauvegarde ignoree (--skip-backup).\n'
            ))

        # ============================================
        # ETAPE 3 : Reorganisation
        # ============================================
        self.stdout.write('=' * 60)
        self.stdout.write('  REORGANISATION DES CLES PRIMAIRES')
        self.stdout.write('=' * 60 + '\n')

        start_time = time.time()

        try:
            with transaction.atomic():
                results = self._reorganize_keys(analysis['tables_with_gaps'])
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'\n[ERREUR] Erreur pendant la reorganisation : {e}\n'
                '[ROLLBACK] Transaction annulee. La base est intacte.'
            ))
            import traceback
            traceback.print_exc()
            return

        elapsed = time.time() - start_time

        # ============================================
        # ETAPE 4 : Rapport final
        # ============================================
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write('  RAPPORT DE REORGANISATION')
        self.stdout.write('=' * 60 + '\n')

        total_rows = 0
        total_fk_updates = 0
        for table, info in results.items():
            self.stdout.write(
                f"  [OK] {table:<40} {info['count']:>6} lignes  "
                f"| {info['fk_updates']:>6} FK mises a jour  "
                f"| max_id: {info['old_max']} -> {info['new_max']}"
            )
            total_rows += info['count']
            total_fk_updates += info['fk_updates']

        self.stdout.write(f'\n  Total : {total_rows} lignes reorganisees')
        self.stdout.write(f'  Total : {total_fk_updates} cles etrangeres mises a jour')
        self.stdout.write(f'  Duree : {elapsed:.2f} secondes')
        self.stdout.write(self.style.SUCCESS(
            '\n[OK] Reorganisation terminee avec succes !'
        ))

    # ──────────────────────────────────────────────────────────────
    # Analyse
    # ──────────────────────────────────────────────────────────────
    def _analyze_tables(self):
        """Analyse chaque table pour detecter les gaps dans les IDs."""
        tables_with_gaps = OrderedDict()
        tables_ok = []
        tables_empty = []

        with connection.cursor() as cursor:
            for table, (pk_col, fk_refs) in REORG_CONFIG.items():
                # Vérifier si la table existe
                cursor.execute(
                    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = %s)",
                    [table]
                )
                if not cursor.fetchone()[0]:
                    continue

                # Compter les enregistrements
                cursor.execute(f'SELECT COUNT(*) FROM "{table}"')
                count = cursor.fetchone()[0]

                if count == 0:
                    tables_empty.append(table)
                    continue

                # Trouver le max ID
                cursor.execute(f'SELECT MAX("{pk_col}") FROM "{table}"')
                max_id = cursor.fetchone()[0]

                # Trouver le min ID
                cursor.execute(f'SELECT MIN("{pk_col}") FROM "{table}"')
                min_id = cursor.fetchone()[0]

                # S'il y a des gaps (max_id != count ou min_id != 1)
                has_gaps = (max_id != count) or (min_id != 1)

                if has_gaps:
                    tables_with_gaps[table] = {
                        'pk_col': pk_col,
                        'fk_refs': fk_refs,
                        'count': count,
                        'max_id': max_id,
                        'min_id': min_id,
                        'gaps': max_id - count,
                    }
                else:
                    tables_ok.append((table, count))

        return {
            'tables_with_gaps': tables_with_gaps,
            'tables_ok': tables_ok,
            'tables_empty': tables_empty,
        }

    def _print_analysis(self, analysis):
        """Affiche le résultat de l'analyse."""
        if analysis['tables_with_gaps']:
            self.stdout.write(self.style.WARNING(
                f"\nTables avec gaps ({len(analysis['tables_with_gaps'])}) :"
            ))
            for table, info in analysis['tables_with_gaps'].items():
                fk_count = len(info.get('fk_refs', []))
                self.stdout.write(
                    f"  - {table:<40} "
                    f"{info['count']:>6} lignes  "
                    f"| IDs: {info['min_id']}..{info['max_id']}  "
                    f"| gaps: {info.get('gaps', 0)}  "
                    f"| {fk_count} FK dependantes"
                )

        if analysis['tables_ok']:
            self.stdout.write(self.style.SUCCESS(
                f"\n[OK] Tables OK ({len(analysis['tables_ok'])}) :"
            ))
            for table, count in analysis['tables_ok']:
                self.stdout.write(f"  - {table:<40} {count:>6} lignes")

        if analysis['tables_empty']:
            self.stdout.write(
                f"\nTables vides ({len(analysis['tables_empty'])}) : "
                + ', '.join(analysis['tables_empty'])
            )

    # ──────────────────────────────────────────────────────────────
    # Réorganisation
    # ──────────────────────────────────────────────────────────────
    def _reorganize_keys(self, tables_with_gaps):
        """Réorganise les clés primaires de toutes les tables avec gaps."""
        results = OrderedDict()

        with connection.cursor() as cursor:
            # Desactiver les triggers pour eviter les effets de bord
            cursor.execute("SET session_replication_role = 'replica';")

            try:
                for table, info in tables_with_gaps.items():
                    result = self._reorganize_table(
                        cursor, table,
                        info['pk_col'], info['fk_refs'],
                        info['count'], info['max_id']
                    )
                    results[table] = result
            finally:
                # Reactiver les triggers
                cursor.execute("SET session_replication_role = 'origin';")

        return results

    def _reorganize_table(self, cursor, table, pk_col, fk_refs, count, old_max):
        """
        Algorithme :
        1. Creer une table temporaire avec mapping (old_id -> new_id)
        2. Mettre a jour les FK dans les tables enfants
        3. Mettre a jour la PK dans la table elle-meme
        4. Reinitialiser la sequence PostgreSQL
        """
        self.stdout.write(f'  [REORG] {table} ({count} lignes, max_id={old_max})...')

        # -- Etape 1 : Creer le mapping old_id -> new_id --
        temp_table = f"_temp_reorg_{table}"
        cursor.execute(f'DROP TABLE IF EXISTS "{temp_table}"')
        cursor.execute(f'''
            CREATE TEMP TABLE "{temp_table}" AS
            SELECT "{pk_col}" AS old_id,
                   ROW_NUMBER() OVER (ORDER BY "{pk_col}") AS new_id
            FROM "{table}"
        ''')
        cursor.execute(f'CREATE INDEX ON "{temp_table}" (old_id)')

        # -- Etape 2 : Mettre a jour les FK dans les tables enfants --
        total_fk_updates = 0
        for child_table, fk_col in fk_refs:
            # Verifier si la table enfant existe
            cursor.execute(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = %s)",
                [child_table]
            )
            if not cursor.fetchone()[0]:
                continue

            # Verifier si la colonne FK existe
            cursor.execute(
                "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
                "WHERE table_name = %s AND column_name = %s)",
                [child_table, fk_col]
            )
            if not cursor.fetchone()[0]:
                continue

            cursor.execute(f'''
                UPDATE "{child_table}" AS c
                SET "{fk_col}" = t.new_id
                FROM "{temp_table}" AS t
                WHERE c."{fk_col}" = t.old_id
                  AND t.old_id != t.new_id
            ''')
            fk_updated = cursor.rowcount
            total_fk_updates += fk_updated

            if fk_updated > 0:
                self.stdout.write(
                    f'    -> {child_table}.{fk_col} : {fk_updated} mises a jour'
                )

        # -- Etape 3 : Mettre a jour la PK --
        # D'abord temporairement decaler vers des valeurs negatives pour eviter les conflits
        cursor.execute(f'''
            UPDATE "{table}" AS t
            SET "{pk_col}" = -m.new_id
            FROM "{temp_table}" AS m
            WHERE t."{pk_col}" = m.old_id
              AND m.old_id != m.new_id
        ''')

        # Puis remettre en positif
        cursor.execute(f'''
            UPDATE "{table}"
            SET "{pk_col}" = -"{pk_col}"
            WHERE "{pk_col}" < 0
        ''')

        # -- Etape 4 : Reinitialiser la sequence --
        seq_name = self._get_sequence_name(cursor, table, pk_col)
        if seq_name:
            cursor.execute(f"SELECT setval('{seq_name}', %s)", [count])
            self.stdout.write(f'    -> Sequence {seq_name} -> {count}')

        # -- Nettoyage --
        cursor.execute(f'DROP TABLE IF EXISTS "{temp_table}"')

        new_max = count  # After reorg, max_id == count

        return {
            'count': count,
            'old_max': old_max,
            'new_max': new_max,
            'fk_updates': total_fk_updates,
        }

    def _get_sequence_name(self, cursor, table, pk_col):
        """Trouve le nom de la sequence PostgreSQL associee a une PK."""
        try:
            cursor.execute(
                "SELECT pg_get_serial_sequence(%s, %s)",
                [table, pk_col]
            )
            result = cursor.fetchone()
            return result[0] if result and result[0] else None
        except Exception:
            # Fallback : nom de sequence conventionnel
            seq_name = f"{table}_{pk_col}_seq"
            cursor.execute(
                "SELECT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname || '.' || sequencename = %s "
                "OR sequencename = %s)",
                [seq_name, seq_name]
            )
            if cursor.fetchone()[0]:
                return seq_name
            return None
