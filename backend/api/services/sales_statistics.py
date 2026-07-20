from django.db.models import Count, Sum
from django.utils import timezone

from api.models import Facture, FactureProduit


def build_sales_statistics(queryset, date_gte=None, date_lte=None):
    today = timezone.localtime(timezone.now()).date()
    valid_statuses = [Facture.Status.VALIDEE, Facture.Status.PAYEE]
    invoices = queryset.filter(status__in=valid_statuses).annotate(num_paiements=Count('paiements')).exclude(status=Facture.Status.VALIDEE, num_paiements=0)
    sellers = queryset.filter(status__in=valid_statuses).annotate(num_paiements=Count('paiements')).exclude(status=Facture.Status.VALIDEE, num_paiements=0).select_related('created_by')
    products = FactureProduit.objects.filter(facture__status__in=valid_statuses).annotate(num_paiements=Count('facture__paiements')).exclude(facture__status=Facture.Status.VALIDEE, num_paiements=0).select_related('produit')

    if date_gte:
        invoices = invoices.filter(date__gte=date_gte)
        sellers = sellers.filter(date__gte=date_gte)
        products = products.filter(facture__date__gte=date_gte)
    elif not date_lte:
        invoices = invoices.filter(date__date=today)
        sellers = sellers.filter(date__date=today)
        products = products.filter(facture__date__date=today)

    if date_lte:
        invoices = invoices.filter(date__lte=date_lte)
        sellers = sellers.filter(date__lte=date_lte)
        products = products.filter(facture__date__lte=date_lte)

    top_seller = sellers.values('created_by__username', 'created_by__first_name', 'created_by__last_name').annotate(total_vente=Sum('montant_regle'), count=Count('id')).order_by('-total_vente').first()
    seller_data = None
    if top_seller:
        name = f"{top_seller['created_by__first_name']} {top_seller['created_by__last_name']}".strip()
        seller_data = {
            'name': name or top_seller['created_by__username'],
            'amount': top_seller['total_vente'],
            'count': top_seller['count'],
        }

    top_product = products.values('produit__name').annotate(total_qty=Sum('quantity')).order_by('-total_qty').first()
    product_data = None
    if top_product:
        product_data = {
            'name': top_product['produit__name'],
            'quantity': top_product['total_qty'],
        }

    totals = invoices.aggregate(
        total_ttc=Sum('total_ttc'),
        total_regle=Sum('montant_regle'),
        total_en_compte=Sum('montant_en_compte'),
    )
    return {
        'top_vendeur': seller_data,
        'top_produit': product_data,
        'total_ttc': str(totals['total_ttc'] or 0),
        'total_regle': str(totals['total_regle'] or 0),
        'total_en_compte': str(totals['total_en_compte'] or 0),
    }
