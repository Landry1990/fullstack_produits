import os
import django
import sys
from decimal import Decimal

# Setup Django
sys.path.append(r"c:\Projet Fullstack\fullstack_produits\backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import CouponMonnaie
from django.db import models

def run():
    month = 3
    year = 2026
    coupons = CouponMonnaie.objects.filter(date_creation__month=month, date_creation__year=year)
    print(f"Total Coupons Générés en Mars 2026: {coupons.count()}")
    total = coupons.aggregate(total=models.Sum('montant'))['total'] or Decimal('0')
    print(f"Montant Total: {total}")
    for c in coupons:
        print(f"  - Coupon #{c.numero}: {c.montant} F, Origine: {c.facture_origine.numero_facture if c.facture_origine else 'N/A'}")

if __name__ == "__main__":
    run()
