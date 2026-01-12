from django.core.management.base import BaseCommand
from api.models import Produit
from django.db.models import Sum

class Command(BaseCommand):
    help = 'Recalculate product stock based on sum of lots'

    def handle(self, *args, **options):
        self.stdout.write("Starting stock recalculation...")
        
        produits = Produit.objects.filter(use_lot_management=True)
        count = 0
        updated_count = 0
        
        for produit in produits:
            total_lots = produit.stock_lots.aggregate(total=Sum('quantity_remaining'))['total'] or 0
            
            if produit.stock != total_lots:
                old_stock = produit.stock
                produit.stock = total_lots
                produit.save(update_fields=['stock'])
                self.stdout.write(f"Updated {produit.name}: {old_stock} -> {total_lots}")
                updated_count += 1
            
            count += 1
            
        self.stdout.write("Invalidating product cache...")
        from api.cache_utils import SearchCache
        SearchCache.invalidate_all_products()
        
        self.stdout.write(self.style.SUCCESS(f"Recalculation complete. Processed {count} products. Updated {updated_count} products."))
