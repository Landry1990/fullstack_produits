from django.core.management.base import BaseCommand
from django.db.models import Sum, Q
from django.utils import timezone
from api.models import Produit, Facture
from decimal import Decimal

class Command(BaseCommand):
    help = 'Recalculate product analytics (Rotation, Margins)'

    def handle(self, *args, **kwargs):
        self.stdout.write("Recalculating analytics for all products...")
        
        # Batch query all products with total sold quantity
        produits = Produit.objects.annotate(
            total_vendus=Sum('factureproduit__quantity', filter=Q(
                factureproduit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
            ))
        )
        
        updated_produits = []
        now = timezone.now()
        count = 0
        
        for p in produits:
            # 1. Recalculate Margins (Coefficient)
            if p.cost_price and p.selling_price:
                try:
                    cp = Decimal(str(p.cost_price))
                    sp = Decimal(str(p.selling_price))
                    if cp > 0:
                        p.taux_marge = sp / cp
                    else:
                        p.taux_marge = Decimal('0.00')
                    if sp > 0:
                        p.pourcentage_marge = ((sp - cp) / sp) * 100
                    else:
                        p.pourcentage_marge = Decimal('0.00')
                except (ValueError, TypeError):
                    pass

            # 2. Recalculate Rotation (Units Sold / Months)
            created_at = p.created_at
            months = (now.year - created_at.year) * 12 + (now.month - created_at.month)
            if months < 1:
                months = 1
            
            units_sold = p.total_vendus or 0
            p.rotation_moyenne = Decimal(units_sold) / Decimal(months)
            
            updated_produits.append(p)
            count += 1

        # Bulk update the database for speed
        Produit.objects.bulk_update(updated_produits, ['rotation_moyenne', 'taux_marge', 'pourcentage_marge'])
        
        self.stdout.write(self.style.SUCCESS(f'Successfully recalculated analytics for {count} products in bulk'))
