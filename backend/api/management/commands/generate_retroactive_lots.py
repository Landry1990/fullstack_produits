from django.core.management.base import BaseCommand
from api.models import StockLot, generate_lot_number


class Command(BaseCommand):
    help = 'Génère des numéros de lot pour les lots existants sans numéro'

    def handle(self, *args, **options):
        # Récupérer tous les lots sans numéro, triés par date
        lots_without_number = StockLot.objects.filter(
            lot__isnull=True
        ).order_by('date_reception')
        
        count = lots_without_number.count()
        self.stdout.write(f'Trouvé {count} lots sans numéro')
        
        for lot in lots_without_number:
            lot.lot = generate_lot_number()
            lot.save(update_fields=['lot'])
            self.stdout.write(f'  Lot {lot.id}: {lot.lot} assigné')
        
        self.stdout.write(self.style.SUCCESS(
            f'✓ {count} numéros de lot générés avec succès'
        ))
