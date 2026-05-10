from django_filters import rest_framework as filters
from .models import Produit, AuditLog, EcritureComptable
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta


class ProduitFilter(filters.FilterSet):
    # Permet de filtrer par le nom du rayon (insensible à la casse)
    rayon_name = filters.CharFilter(field_name='rayon__name', lookup_expr='icontains')

    # Permet de filtrer les produits dont le prix est supérieur à une valeur
    min_price = filters.NumberFilter(field_name="selling_price", lookup_expr='gte')
    
    # Filtres pour le stock (utilisation de simple underscore pour éviter conflit avec lookup Django)
    stock_lt = filters.NumberFilter(field_name='stock', lookup_expr='lt')
    stock_lte = filters.NumberFilter(field_name='stock', lookup_expr='lte')
    stock_gt = filters.NumberFilter(field_name='stock', lookup_expr='gt')
    stock_gte = filters.NumberFilter(field_name='stock', lookup_expr='gte')
    
    rotation_moyenne = filters.NumberFilter(field_name='rotation_moyenne')

    # Filtre spécifique pour les Rossignols (Stock dormant)
    dormant_months = filters.NumberFilter(method='filter_dormant_stock')

    def filter_dormant_stock(self, queryset, name, value):
        if value is None or value <= 0:
            return queryset
            
        date_threshold = timezone.now().date() - timedelta(days=value * 30)
        
        # Filtre: Stock > 0 ET 
        # (dernière vente avant le seuil OU (jamais vendu ET acheté/créé avant le seuil))
        return queryset.filter(
            stock__gt=0
        ).filter(
            Q(dernier_vente__lte=date_threshold) |
            (Q(dernier_vente__isnull=True) & Q(dernier_achat__lte=date_threshold)) |
            (Q(dernier_vente__isnull=True) & Q(dernier_achat__isnull=True) & Q(created_at__date__lte=date_threshold))
        )


    class Meta:
        model = Produit
        # On garde les filtres simples par ID et on ajoute les nouveaux
        fields = ['rayon', 'fournisseur', 'rayon_name', 'min_price', 'stock_lt', 'stock_lte', 'stock_gt', 'stock_gte', 'rotation_moyenne']


class AuditLogFilter(filters.FilterSet):
    """Filtre personnalisé pour le journal d'audit avec support des plages de dates."""
    date_from = filters.DateTimeFilter(field_name='timestamp', lookup_expr='gte')
    date_to = filters.DateTimeFilter(field_name='timestamp', lookup_expr='lte')
    
    class Meta:
        model = AuditLog
        fields = ['action', 'model_name', 'user', 'date_from', 'date_to']


class EcritureComptableFilter(filters.FilterSet):
    date_debut = filters.DateFilter(field_name='date', lookup_expr='gte')
    date_fin = filters.DateFilter(field_name='date', lookup_expr='lte')
    journal_code = filters.CharFilter(field_name='journal__code', lookup_expr='iexact')
    search = filters.CharFilter(method='filter_search')

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            Q(libelle__icontains=value) | 
            Q(reference__icontains=value) |
            Q(numero_piece__icontains=value)
        )

    class Meta:
        model = EcritureComptable
        fields = ['exercice', 'journal', 'journal_code', 'date_debut', 'date_fin', 'search']