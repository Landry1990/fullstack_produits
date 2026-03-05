import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from api.models import Facture
from api.views.ventes import FactureViewSet

# Simulate the same queryset with annotations
viewset = FactureViewSet()
viewset.action = 'caisse_par_tranche_horaire'
queryset = viewset.get_queryset()

# Check today's validated/paid factures
start_dt = timezone.now().replace(hour=0, minute=0, second=0)
end_dt = timezone.now().replace(hour=23, minute=59, second=59)

factures = queryset.filter(
    date__gte=start_dt,
    date__lte=end_dt,
    status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
)

print(f"Testing {factures.count()} factures for today.")

for facture in factures:
    try:
        facture_sous_total_ht = Decimal(str(facture.total_ht))
        facture_remise = Decimal(str(facture.remise))
        facture_total_tva = Decimal(str(facture.total_tva))
        facture_total_ttc = Decimal(str(facture.total_ttc))
        facture_regle = Decimal(str(getattr(facture, 'montant_regle', 0)))
        facture_en_compte = Decimal(str(getattr(facture, 'montant_en_compte', 0)))
        print(f"Facture {facture.id} OK: TTC={facture_total_ttc}, Regle={facture_regle}")
    except Exception as e:
        print(f"Facture {facture.id} Error: {type(e).__name__} - {str(e)}")
