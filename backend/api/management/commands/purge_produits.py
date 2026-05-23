#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Purge des produits importés.
Usage:
    python manage.py purge_produits --confirm
    python manage.py purge_produits --confirm --sans-ventes  (garde les produits liés à des factures)
"""
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Purge les produits de la base de données (avec confirmation obligatoire)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirmation obligatoire pour exécuter la purge'
        )
        parser.add_argument(
            '--sans-ventes',
            action='store_true',
            help='Garde les produits déjà utilisés dans des factures/commandes'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulation : affiche ce qui serait supprimé sans supprimer'
        )

    def handle(self, *args, **options):
        from api.models import Produit

        if not options['confirm'] and not options['dry_run']:
            self.stdout.write(self.style.ERROR(
                "\n⛔ OPÉRATION REFUSÉE\n"
                "   Ajoutez --confirm pour confirmer la suppression.\n"
                "   Ajoutez --dry-run pour simuler sans supprimer.\n\n"
                "   Exemples:\n"
                "     python manage.py purge_produits --dry-run\n"
                "     python manage.py purge_produits --confirm\n"
                "     python manage.py purge_produits --confirm --sans-ventes\n"
            ))
            return

        qs = Produit.objects.all()

        if options['sans_ventes']:
            # Exclure les produits liés à des factures ou commandes
            ids_factures = set()
            try:
                from api.models import FactureProduit
                ids_factures |= set(FactureProduit.objects.values_list('produit_id', flat=True).distinct())
            except Exception:
                pass
            try:
                from api.models import CommandeProduit
                ids_factures |= set(CommandeProduit.objects.values_list('produit_id', flat=True).distinct())
            except Exception:
                pass
            qs = qs.exclude(id__in=ids_factures)
            self.stdout.write(f"   ℹ {len(ids_factures)} produit(s) liés à des ventes/commandes conservés")

        total = qs.count()

        if total == 0:
            self.stdout.write(self.style.WARNING("\n⚠ Aucun produit à supprimer."))
            return

        if options['dry_run']:
            self.stdout.write(self.style.WARNING(
                f"\n🔍 SIMULATION — {total} produit(s) seraient supprimés.\n"
                f"   Relancez avec --confirm pour confirmer."
            ))
            # Afficher un échantillon
            sample = qs[:10]
            self.stdout.write("\n   Échantillon (10 premiers):")
            for p in sample:
                self.stdout.write(f"   - [{p.cip1}] {p.name}")
            if total > 10:
                self.stdout.write(f"   ... et {total - 10} autres")
            return

        # Confirmation finale
        self.stdout.write(self.style.WARNING(
            f"\n⚠️  ATTENTION — Suppression de {total} produit(s)\n"
            f"   Cette opération est IRRÉVERSIBLE.\n"
        ))

        with transaction.atomic():
            deleted, _ = qs.delete()

        self.stdout.write(self.style.SUCCESS(
            f"\n✅ Purge terminée : {deleted} produit(s) supprimé(s)."
        ))
