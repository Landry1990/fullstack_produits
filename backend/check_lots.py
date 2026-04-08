import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from api.models import Produit

cips = ['3000000115770', '3000000289525', '3000000210321', '8036948']
for cip in cips:
    p = Produit.objects.filter(cip1=cip).first()
    if p:
        print(f"[{p.cip1}] {p.name}: use_lot_management={p.use_lot_management}")
    else:
        print(f"[{cip}] Not found")
