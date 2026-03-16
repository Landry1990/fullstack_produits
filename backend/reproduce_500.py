import os
import sys
import django
from django.utils import timezone
from datetime import datetime
from django.db.models import Sum
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.curdir))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture

def reproduce():
    mois_str = '2026-03'
    periode = 'mois'
    now = timezone.now()
    
    print(f"Reproducing with mois={mois_str}, periode={periode}")
    
    year, month = map(int, mois_str.split('-'))
    date_debut = timezone.make_aware(datetime(year, month, 1))
    if month == 12:
        date_fin = timezone.make_aware(datetime(year + 1, 1, 1))
    else:
        date_fin = timezone.make_aware(datetime(year, month + 1, 1))
        
    print(f"Period: {date_debut} to {date_fin}")
    
    factures = Facture.objects.filter(
        status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
        date__gte=date_debut,
        date__lt=date_fin
    ).select_related('created_by', 'created_by__profile')
    
    stats = {}
    autres_stats = {
        'vendeur_id': 0,
        'vendeur': 'Ventes Non Attribuées',
        'nbre_ventes': 0,
        'chiffre_affaires': Decimal('0.00')
    }
    
    for f in factures:
        if f.created_by:
            vendeur_id = f.created_by.id
            vendeur_nom = f.created_by.get_full_name() or f.created_by.username
            
            if vendeur_id not in stats:
                stats[vendeur_id] = {
                    'vendeur_id': vendeur_id,
                    'vendeur': vendeur_nom,
                    'nbre_ventes': 0,
                    'chiffre_affaires': Decimal('0.00')
                }
            stats[vendeur_id]['nbre_ventes'] += 1
            stats[vendeur_id]['chiffre_affaires'] += f.total_ttc
        else:
            autres_stats['nbre_ventes'] += 1
            autres_stats['chiffre_affaires'] += f.total_ttc
            
    results = list(stats.values())
    results.sort(key=lambda x: x['chiffre_affaires'], reverse=True)
    
    if autres_stats['chiffre_affaires'] > 0:
        results.append(autres_stats)
        
    for i, r in enumerate(results, 1):
        r['rang'] = i
        r['panier_moyen'] = round(float(r['chiffre_affaires']) / r['nbre_ventes'], 2) if r['nbre_ventes'] > 0 else 0
        r['chiffre_affaires'] = float(r['chiffre_affaires'])
        
    if periode == 'mois':
        if date_debut.month == 1:
            prev_debut = date_debut.replace(year=date_debut.year - 1, month=12)
        else:
            prev_debut = date_debut.replace(month=date_debut.month - 1)
        if prev_debut.month == 12:
            prev_fin = prev_debut.replace(year=prev_debut.year + 1, month=1, day=1)
        else:
            prev_fin = prev_debut.replace(month=prev_debut.month + 1, day=1)
            
        print(f"Prev Period: {prev_debut} to {prev_fin}")
        
        prev_factures = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            date__gte=prev_debut,
            date__lt=prev_fin,
            created_by__isnull=False
        ).values('created_by').annotate(
            ca=Sum('total_ttc')
        )
        
        prev_ca = {p['created_by']: float(p['ca']) for p in prev_factures}
        
        for r in results:
            prev = prev_ca.get(r['vendeur_id'], 0)
            if prev > 0:
                r['evolution'] = round(((r['chiffre_affaires'] - prev) / prev) * 100, 1)
            else:
                r['evolution'] = None
                
    print("Success!")
    print(f"Data count: {len(results)}")

if __name__ == "__main__":
    reproduce()
