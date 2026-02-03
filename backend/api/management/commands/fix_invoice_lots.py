from django.core.management.base import BaseCommand
from api.models import FactureProduit, FactureProduitAllocation
from django.db.models import Q

class Command(BaseCommand):
    help = 'Populates the "lot" field in FactureProduit from existing allocations (FactureProduitAllocation) for historical data.'

    def handle(self, *args, **options):
        self.stdout.write("Starting fix for missing invoice lots...")

        # Filter items with empty lot and existing allocations
        items_to_fix = FactureProduit.objects.filter(
            Q(lot__isnull=True) | Q(lot='')
        ).prefetch_related('allocations', 'allocations__stock_lot')

        count = items_to_fix.count()
        self.stdout.write(f"Found {count} invoice lines potentially missing lot info.")

        fixed_count = 0
        for item in items_to_fix:
            allocations = item.allocations.all()
            if not allocations:
                continue

            # Extract lot names from allocations
            lot_names = []
            for alloc in allocations:
                if alloc.stock_lot and alloc.stock_lot.lot:
                    lot_names.append(alloc.stock_lot.lot)
            
            if lot_names:
                # Deduplicate and join
                unique_lots = sorted(list(set(lot_names)))
                joined_lots = ",".join(unique_lots)[:20] # Truncate to match max_length=20
                
                item.lot = joined_lots
                item.save(update_fields=['lot'])
                fixed_count += 1
                
                if fixed_count % 100 == 0:
                     self.stdout.write(f"Processed {fixed_count} items...")

        self.stdout.write(self.style.SUCCESS(f"Successfully updated {fixed_count} invoice lines with lot numbers."))
