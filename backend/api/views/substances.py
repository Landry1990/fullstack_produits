from django.db.models import Count
from rest_framework import filters, permissions, viewsets

from ..audit_mixins import AuditedViewSetMixin
from ..models import Substance
from ..serializers import SubstanceSerializer


class SubstanceViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    queryset = Substance.objects.all().annotate(produits_count=Count('produits')).order_by('nom')
    serializer_class = SubstanceSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nom']
    ordering_fields = ['nom']

    def get_permissions(self):
        # Lecture : tout utilisateur authentifié (combobox DCI, fiches produit).
        # Écriture : staff uniquement — le nom d'une substance apparaît dans
        # les alertes d'interaction montrées au patient/caissier.
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('unresolved') == '1':
            # Stubs MQ-… : identifiants internes non encore renommés
            qs = qs.filter(nom__startswith='MQ-')
        return qs
