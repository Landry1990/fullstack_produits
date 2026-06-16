# -*- coding: utf-8 -*-
"""
Retro-compatibilité: calcule stock_apres_reception pour les CommandeProduit
clôturées avant l'ajout du champ.

Approche: stock_apres_reception = stock_actuel + qté consommée des lots
créés par cette commande (quantity_initial - quantity_remaining).
C'est une approximation raisonnable si le produit n'a pas reçu d'autres
commandes après celle-ci.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import CommandeProduit, StockLot


class Command(BaseCommand):
    help = "Recalcule stock_apres_reception pour les CommandeProduit de commandes déjà clôturées"

    def handle(self, *args, **options):
        items = CommandeProduit.objects.filter(
            commande__status='CLOT',
            stock_apres_reception=0,
            produit__isnull=False,
        ).select_related('produit', 'commande')

        total = items.count()
        updated = 0
        skipped = 0

        self.stdout.write(f"{total} lignes à traiter...")

        with transaction.atomic():
            for item in items.iterator(chunk_size=500):
                produit = item.produit
                if not produit:
                    skipped += 1
                    continue

                lots = StockLot.objects.filter(commande_produit=item)
                if lots.exists():
                    qty_consumed = sum(
                        lot.quantity_initial - lot.quantity_remaining
                        for lot in lots
                    )
                    stock_apres = produit.total_stock + qty_consumed
                else:
                    # Fallback: on n'a pas de lot lié, on utilise le stock actuel
                    stock_apres = produit.total_stock

                item.stock_apres_reception = stock_apres
                item.save(update_fields=['stock_apres_reception'])
                updated += 1

        self.stdout.write(self.style.SUCCESS(
            f"Terminé: {updated} mis à jour, {skipped} ignorés (total: {total})"
        ))
