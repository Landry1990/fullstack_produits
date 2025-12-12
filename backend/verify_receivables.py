
from django.db.models import Sum
from decimal import Decimal
from api.models import Facture

def calculate_receivables():
    # Mirror the logic from DashboardViewSet / CreanceViewSet
    factures_validees = Facture.objects.filter(
        status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
        paiements__mode_paiement='en_compte'
    ).distinct().prefetch_related('produits', 'paiements')
    
    total_receivables = Decimal('0.00')
    count = 0
    
    print(f"Found {factures_validees.count()} potential invoices.")
    
    for f in factures_validees:
        paiements_reels = sum(p.montant for p in f.paiements.all() if p.statut == 'completee' and p.mode_paiement != 'en_compte')
        reste = f.total_ttc - paiements_reels
        
        # print(f"Facture {f.id}: TTC={f.total_ttc}, Payé={paiements_reels}, Reste={reste}")
        
        if reste > 0:
            total_receivables += reste
            count += 1
            
    print(f"Total Receivables: {total_receivables}")
    print(f"Count: {count}")

if __name__ == "__main__":
    calculate_receivables()
