from django.core.management.base import BaseCommand
from django.db.models import Sum
from django.utils import timezone
from api.models import Produit, FactureProduit
from decimal import Decimal

class Command(BaseCommand):
    help = 'Recalculate product analytics (Rotation, Margins)'

    def handle(self, *args, **kwargs):
        self.stdout.write("Recalculating analytics for all products...")
        
        produits = Produit.objects.all()
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
            # Months of existence
            now = timezone.now()
            created_at = p.created_at
            
            # Calculate months difference
            months = (now.year - created_at.year) * 12 + (now.month - created_at.month)
            # Add partial month based on days if needed, or just ensure min 1 month
            if months < 1:
                months = 1
            
            # Total units sold (from FactureProduit, linked to valid invoices ideally, but for now all)
            # Note: We should ideally filter by Facture status (VALIDEE/PAYEE)
            # Assuming FactureProduit is linked to Facture
            units_sold = FactureProduit.objects.filter(produit=p).aggregate(total=Sum('quantity'))['total'] or 0
            
            p.rotation_moyenne = Decimal(units_sold) / Decimal(months)
            
            p.save()
            count += 1
            
        self.stdout.write(self.style.SUCCESS(f'Successfully recalculated analytics for {count} products'))
