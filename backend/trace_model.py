import os
import django
import sys

# Setup Django
sys.path.append(r"c:\Projet Fullstack\fullstack_produits\backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import CouponMonnaie
print(f"File: {CouponMonnaie.__module__}")
import inspect
print(f"Path: {inspect.getfile(CouponMonnaie)}")
print(f"Fields: {[f.name for f in CouponMonnaie._meta.get_fields()]}")
