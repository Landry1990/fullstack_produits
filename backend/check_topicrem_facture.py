import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Facture, Produit
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal

print('=' * 80)
print('VERIFICATION - DERNIERE FACTURE TOPICREM')
print('=' * 80)
print()

# Chercher le produit Topicrem
produits_topicrem = Produit.objects.filter(name__icontains='topicrem')
print(f'Produits Topicrem trouves: {produits_topicrem.count()}')
for p in produits_topicrem:
    print(f'  - {p.name} (ID: {p.id})')
print()

# Chercher les dernières factures (dernières 24h)
hier = timezone.now() - timedelta(hours=24)
factures_recentes = Facture.objects.filter(
    date__gte=hier,
    status__in=['VAL', 'PAY']
).order_by('-date')

print(f'Factures recentes (24h): {factures_recentes.count()}')
print()

# Chercher les factures contenant Topicrem
for facture in factures_recentes:
    produits_facture = facture.produits.all()
    for fp in produits_facture:
        if 'topicrem' in fp.produit.name.lower():
            print(f'FACTURE {facture.numero_facture or facture.id}:')
            print(f'  Date: {facture.date.strftime("%d/%m/%Y %H:%M")}')
            print(f'  Status: {facture.get_status_display()}')
            print(f'  TVA facture: {facture.tva}%')
            print(f'  Total HT: {facture.total_ht:,.2f} F')
            print(f'  Total TTC: {facture.total_ttc:,.2f} F')
            print(f'  Remise: {facture.remise:,.2f} F')
            print()
            print('  Produits:')
            for fp in produits_facture:
                print(f'    - {fp.produit.name}')
                print(f'      Quantite: {fp.quantity}')
                print(f'      Prix unitaire: {fp.selling_price:,.2f} F')
                print(f'      Total: {fp.quantity * fp.selling_price:,.2f} F')
            print()
            
            # Vérifier si la TVA a été appliquée
            if facture.tva > 0:
                tva_calculee = facture.total_ht * (facture.tva / 100)
                ttc_attendu = facture.total_ht + tva_calculee
                print(f'  VERIFICATION TVA:')
                print(f'    HT: {facture.total_ht:,.2f} F')
                print(f'    TVA ({facture.tva}%): {tva_calculee:,.2f} F')
                print(f'    TTC attendu: {ttc_attendu:,.2f} F')
                print(f'    TTC reel: {facture.total_ttc:,.2f} F')
                
                if abs(ttc_attendu - facture.total_ttc) < Decimal('0.01'):
                    print(f'    [OK] TVA correctement appliquee')
                else:
                    print(f'    [ERREUR] Difference: {facture.total_ttc - ttc_attendu:,.2f} F')
            else:
                print(f'  [INFO] Pas de TVA sur cette facture')
            
            print()

print('=' * 80)
