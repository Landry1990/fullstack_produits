from datetime import datetime, time

from django.db.models import Q, TextField
from django.db.models.functions import Cast
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from django_filters import rest_framework as filters

from .models import AuditLog, EcritureComptable, Produit


class CharInFilter(filters.BaseInFilter, filters.CharFilter):
    pass


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
        from datetime import timedelta
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
    """Filtre avancé pour le journal d'audit."""
    action = filters.CharFilter(field_name='action', lookup_expr='exact')
    action_in = CharInFilter(field_name='action', lookup_expr='in')
    user = filters.NumberFilter(field_name='user')
    model_name = filters.CharFilter(field_name='model_name', lookup_expr='exact')
    model_name_in = CharInFilter(field_name='model_name', lookup_expr='in')
    date_from = filters.CharFilter(method='filter_date_from')
    date_to = filters.CharFilter(method='filter_date_to')
    q = filters.CharFilter(method='filter_search')

    def _parse_datetime(self, value, end_of_day=False):
        dt = parse_datetime(value)
        if dt is None:
            d = parse_date(value)
            if d:
                t = time.max if end_of_day else time.min
                dt = datetime.combine(d, t)
        if dt is None:
            return None
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        return dt

    def filter_date_from(self, queryset, name, value):
        dt = self._parse_datetime(value, end_of_day=False)
        if dt is None:
            return queryset
        return queryset.filter(timestamp__gte=dt)

    def filter_date_to(self, queryset, name, value):
        dt = self._parse_datetime(value, end_of_day=True)
        if dt is None:
            return queryset
        return queryset.filter(timestamp__lte=dt)

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.annotate(
            details_text=Cast('details', TextField())
        ).filter(
            Q(description__icontains=value) |
            Q(object_id__icontains=value) |
            Q(user__username__icontains=value) |
            Q(details_text__icontains=value)
        )

    class Meta:
        model = AuditLog
        fields = ['action', 'action_in', 'user', 'model_name', 'model_name_in', 'date_from', 'date_to', 'q']


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
