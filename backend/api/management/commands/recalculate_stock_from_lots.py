from django.core.management.base import BaseCommand

from api.models import Produit


class Command(BaseCommand):
    help = 'Recalculate product stock based on sum of lots'

    def handle(self, *args, **options):
        self.stdout.write("Starting stock recalculation...")
        
        produits = Produit.objects.filter(use_lot_management=True)
        count = 0
        updated_count = 0
        
        for produit in produits:
            old_stock = produit.stock
            old_reserve = produit.stock_reserve
            produit.calculate_stock_from_lots()
            produit.refresh_from_db(fields=['stock', 'stock_reserve'])

            if produit.stock != old_stock or produit.stock_reserve != old_reserve:
                self.stdout.write(
                    f"Updated {produit.name}: "
                    f"rayon {old_stock} -> {produit.stock}, "
                    f"réserve {old_reserve} -> {produit.stock_reserve}"
                )
                updated_count += 1
            
            count += 1
            
        self.stdout.write("Invalidating product cache...")
        from api.cache_utils import SearchCache
        SearchCache.invalidate_all_products()
        
        self.stdout.write(self.style.SUCCESS(f"Recalculation complete. Processed {count} products. Updated {updated_count} products."))
