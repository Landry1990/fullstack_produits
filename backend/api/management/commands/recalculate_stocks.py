from django.core.management.base import BaseCommand

from api.models import Produit


class Command(BaseCommand):
    help = 'Recalcule le stock de tous les produits depuis leurs lots (déduction des dettes promis)'

    def handle(self, *args, **options):
        produits = Produit.objects.filter(use_lot_management=True)
        count = produits.count()
        updated = 0

        self.stdout.write(f'Recalcul du stock pour {count} produits gérés par lots...')

        for produit in produits:
            old_stock = produit.stock
            old_reserve = produit.stock_reserve

            # calculate_stock_from_lots() soustrait aussi les obligations de
            # stock (promis/ventes forcées) encore appliquées au compteur.
            produit.calculate_stock_from_lots()
            produit.refresh_from_db(fields=['stock', 'stock_reserve'])

            if old_stock != produit.stock or old_reserve != produit.stock_reserve:
                updated += 1
                self.stdout.write(
                    f'  {produit.name}: rayon {old_stock} → {produit.stock}'
                    f' | réserve {old_reserve} → {produit.stock_reserve}'
                )

        self.stdout.write(self.style.SUCCESS(
            f'✓ {updated}/{count} produits corrigés'
        ))
