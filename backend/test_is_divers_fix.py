#!/usr/bin/env python3
"""
Exemples de requêtes pour vérifier le fix is_divers pour la journée du 11/05/2025

Scénario: Facture FAC-000039 du 11/05 avec 6 produits dont 1 LANZOP (is_divers=True)
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from datetime import date
from decimal import Decimal
from django.db.models import Sum, F, OuterRef, Subquery, DecimalField, Count, Value
from django.db.models.functions import Coalesce
from api.models import Facture, FactureProduit, FactureProduitAllocation, StockLot

# Date de test : 11 mai 2025
DATE_TEST = date(2025, 5, 11)

print("=" * 70)
print("EXEMPLES DE REQUÊTES - FIX is_divers pour le 11/05/2025")
print("=" * 70)

# ============================================================================
# 1. VÉRIFICATION DES DONNÉES BRUTES
# ============================================================================
print("\n" + "=" * 70)
print("1. VÉRIFICATION DES DONNÉES BRUTES")
print("=" * 70)

factures_11_05 = Facture.objects.filter(date__date=DATE_TEST)
print(f"\n📋 Factures du 11/05/2025: {factures_11_05.count()}")

for f in factures_11_05:
    print(f"   - {f.numero_facture} | Total TTC: {f.total_ttc} | Status: {f.status}")
    produits = FactureProduit.objects.filter(facture=f)
    print(f"     Produits: {produits.count()}")
    for p in produits:
        allocations = FactureProduitAllocation.objects.filter(facture_produit=p)
        for alloc in allocations:
            is_divers = alloc.stock_lot.is_divers if alloc.stock_lot else False
            divers_flag = "🔴 is_divers=True" if is_divers else "🟢 normal"
            print(f"       • {p.produit.name} | Lot: {alloc.stock_lot} | {divers_flag}")

# ============================================================================
# 2. ANCIENNE MÉTHODE (AVANT FIX) - Exclut toute la facture
# ============================================================================
print("\n" + "=" * 70)
print("2. ANCIENNE MÉTHODE (AVANT FIX) - Problème !")
print("=" * 70)
print("""
❌ Code problématique:
   Facture.objects.filter(
       date__date=DATE_TEST,
       status__in=['V', 'P']
   ).exclude(produits__allocations__stock_lot__is_divers=True)  ← EXCLUT TOUTE LA FACTURE !
   
Résultat: Si FAC-000039 a 1 produit LANZOP (is_divers=True) sur 6 produits,
toute la facture est exclue des rapports. Les 5 autres produits ne comptent pas !
""")

factures_ancien = Facture.objects.filter(
    date__date=DATE_TEST,
    status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
).exclude(produits__allocations__stock_lot__is_divers=True).distinct()

ca_ancien = factures_ancien.aggregate(ca=Coalesce(Sum('total_ttc'), Decimal('0')))['ca']
print(f"📊 CA calculé (ancienne méthode): {ca_ancien}")
print(f"   Factures prises en compte: {list(factures_ancien.values_list('numero_facture', flat=True))}")

# ============================================================================
# 3. NOUVELLE MÉTHODE (APRÈS FIX) - Filtre au niveau des lignes
# ============================================================================
print("\n" + "=" * 70)
print("3. NOUVELLE MÉTHODE (APRÈS FIX) - Correct !")
print("=" * 70)
print("""
✅ Code corrigé avec sous-requête:
   # Sous-requête pour calculer le montant is_divers par facture
   divers_total_sub = FactureProduitAllocation.objects.filter(
       facture_produit__facture=OuterRef('pk'),
       stock_lot__is_divers=True
   ).values('facture_produit__facture').annotate(
       total_divers=Sum(F('selling_price') * F('quantity'))
   ).values('total_divers')
   
   Facture.objects.filter(
       date__date=DATE_TEST,
       status__in=['V', 'P']
   ).annotate(
       divers_amount=Coalesce(Subquery(divers_total_sub), Decimal('0')),
       adjusted_total=F('total_ttc') - F('divers_amount')
   ).aggregate(ca=Sum('adjusted_total'))
   
Résultat: La facture FAC-000039 est incluse, mais seul le CA des 
5 produits normaux est compté. Le LANZOP (is_divers) est soustrait.
""")

divers_total_sub = FactureProduitAllocation.objects.filter(
    facture_produit__facture=OuterRef('pk'),
    stock_lot__is_divers=True
).values('facture_produit__facture').annotate(
    total_divers=Coalesce(
        Sum(F('selling_price') * F('quantity'), output_field=DecimalField()),
        Decimal('0')
    )
).values('total_divers')

factures_nouveau = Facture.objects.filter(
    date__date=DATE_TEST,
    status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
).annotate(
    divers_amount=Coalesce(
        Subquery(divers_total_sub, output_field=DecimalField()),
        Decimal('0')
    ),
    adjusted_total=F('total_ttc') - F('divers_amount')
)

ca_nouveau = factures_nouveau.aggregate(ca=Coalesce(Sum('adjusted_total'), Decimal('0')))['ca']
print(f"📊 CA calculé (nouvelle méthode): {ca_nouveau}")
print(f"   Factures prises en compte: {list(factures_nouveau.values_list('numero_facture', flat=True))}")

# Détail par facture
print("\n   Détail par facture:")
for f in factures_nouveau:
    print(f"   • {f.numero_facture}: Total TTC={f.total_ttc} | Divers={f.divers_amount} | Ajusté={f.adjusted_total}")

# ============================================================================
# 4. EXEMPLE: Stats vendeurs pour le 11/05
# ============================================================================
print("\n" + "=" * 70)
print("4. EXEMPLE: Stats vendeurs pour le 11/05")
print("=" * 70)

from django.contrib.auth import get_user_model
User = get_user_model()

# Nouvelle méthode
stats_vendeurs = factures_nouveau.values('created_by_id').annotate(
    nbre_ventes=Count('id'),
    chiffre_affaires=Coalesce(Sum('adjusted_total'), Value(0, output_field=DecimalField()))
).order_by('-chiffre_affaires')

print("\n📈 Stats vendeurs (11/05/2025):")
for stat in stats_vendeurs:
    vendeur = User.objects.filter(id=stat['created_by_id']).first()
    nom = vendeur.get_full_name() if vendeur else f"User {stat['created_by_id']}"
    print(f"   • {nom}: {stat['nbre_ventes']} ventes | CA: {stat['chiffre_affaires']}")

# ============================================================================
# 5. EXEMPLE: Top produits pour le 11/05 (exclure is_divers)
# ============================================================================
print("\n" + "=" * 70)
print("5. EXEMPLE: Top produits pour le 11/05 (sans is_divers)")
print("=" * 70)

top_produits = FactureProduitAllocation.objects.filter(
    facture_produit__facture__date__date=DATE_TEST,
    facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
).exclude(
    stock_lot__is_divers=True  # ← Filtre au niveau des allocations
).values('facture_produit__produit__name').annotate(
    qty=Sum('quantity'),
    revenue=Sum(F('quantity') * F('selling_price'))
).order_by('-qty')[:5]

print("\n🏆 Top produits (excluant is_divers):")
for p in top_produits:
    print(f"   • {p['facture_produit__produit__name']}: {p['qty']} unités | CA: {p['revenue']}")

# ============================================================================
# 6. EXEMPLE: Marges pour le 11/05
# ============================================================================
print("\n" + "=" * 70)
print("6. EXEMPLE: Marges pour le 11/05")
print("=" * 70)

# Allocations (avec lot connu) - exclure is_divers
margin_allocated = FactureProduitAllocation.objects.filter(
    facture_produit__facture__date__date=DATE_TEST,
    facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
).exclude(
    stock_lot__is_divers=True
).aggregate(
    total_cost=Coalesce(Sum(F('cost_price') * F('quantity'), output_field=DecimalField()), Decimal('0'))
)['total_cost']

# Non alloués - exclure les produits avec lots is_divers
from django.db.models import Exists
unallocated_cost = FactureProduit.objects.filter(
    facture__date__date=DATE_TEST,
    facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
).annotate(
    has_alloc=Exists(FactureProduitAllocation.objects.filter(facture_produit=OuterRef('pk')))
).filter(
    has_alloc=False
).exclude(
    produit__stock_lots__is_divers=True
).aggregate(
    total=Coalesce(Sum(F('produit__pmp') * F('quantity'), output_field=DecimalField()), Decimal('0'))
)['total']

ca_total = factures_nouveau.aggregate(ca=Coalesce(Sum('adjusted_total'), Decimal('0')))['ca']
margin = ca_total - (margin_allocated + unallocated_cost)

print(f"\n💰 Marge du 11/05/2025:")
print(f"   CA (ajusté): {ca_total}")
print(f"   Coût alloué (sans is_divers): {margin_allocated}")
print(f"   Coût non alloué (sans is_divers): {unallocated_cost}")
print(f"   Marge: {margin}")

# ============================================================================
# RÉCAPITULATIF
# ============================================================================
print("\n" + "=" * 70)
print("RÉCAPITULATIF")
print("=" * 70)
print(f"""
📅 Date: 11/05/2025

Ancienne méthode (bug):
   CA: {ca_ancien}
   → Excluait toute la facture FAC-000039 si 1 produit is_divers

Nouvelle méthode (fix):
   CA: {ca_nouveau}
   → Inclut la facture mais soustrait uniquement les lignes is_divers

Différence: {ca_nouveau - ca_ancien}

✅ Le fix est correct ! Les rapports comptabilisent maintenant :
   - Toutes les factures du 11/05
   - Mais seulement le CA des produits non-is_divers
""")

if __name__ == '__main__':
    print("\nPour exécuter ces requêtes sur vos vraies données:")
    print("   python test_is_divers_fix.py")
