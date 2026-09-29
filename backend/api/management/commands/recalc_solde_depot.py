"""
Recalcule Client.solde_depot depuis l'historique DepotClient.

Pourquoi : le signal signals_depot n'était pas chargé avant le fix —
les soldes en base peuvent être faux (jamais mis à jour).

Formule : DEPOT + ANNULATION_ACHAT créditent, RETRAIT + ACHAT débitent.

Usage :
    python manage.py recalc_solde_depot          # dry-run : affiche les écarts
    python manage.py recalc_solde_depot --fix    # applique les corrections
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum, Q


class Command(BaseCommand):
    help = "Recalcule solde_depot depuis l'historique DepotClient"

    def add_arguments(self, parser):
        parser.add_argument(
            '--fix',
            action='store_true',
            help='Applique les corrections (sans : affiche seulement les écarts)',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from api.models import Client, DepotClient

        fix = options['fix']

        # Agrégation par client : crédits - débits
        agg = (
            DepotClient.objects.values('client_id')
            .annotate(
                credit=Sum('montant', filter=Q(
                    type__in=[DepotClient.Type.DEPOT, DepotClient.Type.ANNULATION_ACHAT
                ])),
                debit=Sum('montant', filter=Q(
                    type__in=[DepotClient.Type.RETRAIT, DepotClient.Type.ACHAT
                ])),
            )
        )
        computed = {
            row['client_id']: (row['credit'] or Decimal('0')) - (row['debit'] or Decimal('0'))
            for row in agg
        }

        # Clients avec dépôt activé mais sans historique → solde attendu = 0 ?
        # On ne touche qu'aux clients présents dans l'historique OU avec un
        # solde non nul (pour détecter un solde fantôme).
        clients_qs = Client.objects.filter(
            Q(id__in=computed.keys()) | ~Q(solde_depot=Decimal('0'))
        )

        drifted = []
        for client in clients_qs.iterator(chunk_size=500):
            expected = computed.get(client.id, Decimal('0'))
            current = Decimal(str(client.solde_depot or 0))
            if current != expected:
                drifted.append((client, current, expected))

        if not drifted:
            self.stdout.write(self.style.SUCCESS(
                "Tous les soldes dépôt sont cohérents avec l'historique."
            ))
            return

        self.stdout.write(self.style.WARNING(
            f"{len(drifted)} client(s) avec un solde dépôt incohérent :"
        ))
        for client, current, expected in drifted:
            self.stdout.write(
                f"  #{client.id} {client.name}: {current} F → {expected} F "
                f"(écart {expected - current:+} F)"
            )

        if not fix:
            self.stdout.write(self.style.WARNING(
                "\nDry-run. Relancer avec --fix pour corriger."
            ))
            return

        for client, _current, expected in drifted:
            Client.objects.filter(pk=client.pk).update(solde_depot=expected)

        self.stdout.write(self.style.SUCCESS(
            f"{len(drifted)} solde(s) corrigé(s)."
        ))
