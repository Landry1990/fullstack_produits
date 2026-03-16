import os
import sys
import django
from django.utils import timezone
from django.db.models import Sum, Avg, F, Q, DecimalField
from decimal import Decimal
from dateutil.relativedelta import relativedelta

sys.path.insert(0, os.path.abspath(os.curdir))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture, FactureProduit, Produit

def check_analysis():
    today = timezone.now().date()
    start_date = today - relativedelta(months=3)
    
    print(f"Checking data from {start_date} to {today}")
    
    base_qs = FactureProduit.objects.filter(
        facture__date__date__gte=start_date,
        facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
    )
    
    count = base_qs.count()
    print(f"Total FactureProduit found: {count}")
    
    if count == 0:
        print("!!! No data found in the last 3 months !!!")
        return

    # 1. Calculer les moyennes globales
    total_ventes_qty = base_qs.aggregate(sum=Sum('quantity'))['sum'] or 0
    nb_produits_distincts = base_qs.values('produit').distinct().count() or 1
    seuil_volume_eleve = (total_ventes_qty / nb_produits_distincts) * 1.5
    
    print(f"Total sales qty: {total_ventes_qty}")
    print(f"Distinct products: {nb_produits_distincts}")
    print(f"Seuil volume élevé: {seuil_volume_eleve}")

    # 2. Agrégation par produit
    produits_stats = base_qs.values(
        'produit__id', 'produit__name', 'produit__cost_price', 'produit__selling_price'
    ).annotate(
        volume_total=Sum('quantity'),
        marge_totale=Sum((F('selling_price') - F('produit__cost_price')) * F('quantity'), output_field=DecimalField())
    )
    
    opp_nego = 0
    stock_dormant = 0
    suggestions = 0
    
    sample_stats = []
    
    for p in produits_stats:
        volume = p['volume_total'] or 0
        cp = float(p['produit__cost_price'] or 0)
        sp = float(p['produit__selling_price'] or 0)
        
        if cp <= 0 or sp <= 0:
            continue
            
        taux_marge = ((sp - cp) / sp) * 100
        
        if len(sample_stats) < 5:
            sample_stats.append({
                'name': p['produit__name'],
                'volume': volume,
                'taux': taux_marge
            })

        # Cas 1 : Faible marge (< 15%) mais Fort volume
        if taux_marge < 15 and volume > seuil_volume_eleve:
            opp_nego += 1
            
        # Cas 2 : Forte marge (> 40%) mais Faible rotation (< 1/3 moyenne)
        if taux_marge > 40 and volume < (seuil_volume_eleve / 4):
            stock_dormant += 1
            
        # Cas 3 : Suggestions Prix (Marge très faible < 10%)
        if taux_marge < 10:
            suggestions += 1
            
    print("\nResults:")
    print(f"Opportunités Négociation: {opp_nego}")
    print(f"Stock Dormant: {stock_dormant}")
    print(f"Suggestions Prix: {suggestions}")
    
    print("\nCatalog Check (All Products):")
    all_products = Produit.objects.all()
    total_prods = all_products.count()
    low_margin_15 = 0
    low_margin_10 = 0
    high_margin_40 = 0
    
    for p in all_products:
        cp = float(p.cost_price or 0)
        sp = float(p.selling_price or 0)
        if cp <= 0 or sp <= 0: continue
        taux = ((sp - cp) / sp) * 100
        if taux < 10: low_margin_10 += 1
        if taux < 15: low_margin_15 += 1
        if taux > 40: high_margin_40 += 1
        
    print(f"Total products with prices: {total_prods}")
    print(f"Products with Margin < 15%: {low_margin_15}")
    print(f"Products with Margin < 10%: {low_margin_10}")
    print(f"Products with Margin > 40%: {high_margin_40}")

if __name__ == "__main__":
    check_analysis()
