from django_filters import rest_framework as filters
from .models import Produit, AuditLog

class ProduitFilter(filters.FilterSet):
    # Permet de filtrer par le nom du rayon (insensible à la casse)
    rayon_name = filters.CharFilter(field_name='rayon__name', lookup_expr='icontains')

    # Permet de filtrer les produits dont le prix est supérieur à une valeur
    min_price = filters.NumberFilter(field_name="selling_price", lookup_expr='gte')

    class Meta:
        model = Produit
        # On garde les filtres simples par ID et on ajoute les nouveaux
        fields = ['rayon', 'fournisseur', 'rayon_name', 'min_price']


class AuditLogFilter(filters.FilterSet):
    """Filtre personnalisé pour le journal d'audit avec support des plages de dates."""
    date_from = filters.DateTimeFilter(field_name='timestamp', lookup_expr='gte')
    date_to = filters.DateTimeFilter(field_name='timestamp', lookup_expr='lte')
    
    class Meta:
        model = AuditLog
        fields = ['action', 'model_name', 'user', 'date_from', 'date_to']