
import os
import django
import sys
from django.db.models import Count, Q

# Setup Django environment
sys.path.append('backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import FactureProduit, Produit

def verify_tva():
    print("=== VÉRIFICATION DE LA COHÉRENCE TVA ===")
    
    # 1. Check for inconsistencies (Line=0% but Product>0%)
    inconsistent = FactureProduit.objects.filter(
        tva=0,
        produit__isnull=False,
        produit__tva__gt=0
    ).count()
    
    if inconsistent > 0:
        print(f"⚠️  ATTENTION: {inconsistent} lignes de facture ont 0% TVA alors que le produit a de la TVA !")
        print("   Exécutez 'python scripts/fix_tva_backfill.py' pour corriger cela (script à créer si nécessaire).")
    else:
        print("✅ Audite des données: OK. Aucune incohérence détectée (Ligne 0% alors que Produit >0%).")
        
    print("\n=== PRODUITS VENDUS AVEC 0% TVA ===")
    print("Liste des produits qui génèrent du CA sans TVA (car configurés à 0%):")
    
    # Find products involved in 0% VAT sales
    zero_vat_lines = FactureProduit.objects.filter(
        tva=0,
        produit__isnull=False
    ).values('produit__id', 'produit__name', 'produit__tva').annotate(
        count=Count('id')
    ).order_by('-count')
    
    if not zero_vat_lines:
        print("   Aucun produit vendu à 0% TVA.")
    else:
        print(f"   {len(zero_vat_lines)} produits distincts trouvés :")
        print(f"   {'NOM DU PRODUIT':<50} | {'TVA ACTUELLE':<12} | {'NB VENTES':<10}")
        print("-" * 80)
        
        for p in zero_vat_lines:
            name = p['produit__name'][:48]
            tva = p['produit__tva']
            count = p['count']
            print(f"   {name:<50} | {tva:<12} | {count:<10}")
            
    print("\n" + "="*30)

if __name__ == '__main__':
    verify_tva()
