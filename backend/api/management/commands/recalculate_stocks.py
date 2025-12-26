from django.core.management.base import BaseCommand
from django.db.models import Sum
from api.models import Produit


class Command(BaseCommand):
    help = 'Recalcule le stock de tous les produits basé sur leurs lots'

    def handle(self, *args, **options):
        produits = Produit.objects.all()
        count = produits.count()
        updated = 0
        
        self.stdout.write(f'Recalcul du stock pour {count} produits...')
        
        for produit in produits:
            old_stock = produit.stock
            
            # Calculer le nouveau stock
            total = produit.stock_lots.aggregate(
                total=Sum('quantity_remaining')
            )['total'] or 0
            
            if old_stock != total:
                produit.stock = total
                produit.save(update_fields=['stock'])
                updated += 1
                self.stdout.write(
                    f'  {produit.name}: {old_stock} → {total}'
                )
        
        self.stdout.write(self.style.SUCCESS(
            f'✓ {updated}/{count} produits mis à jour'
        ))
