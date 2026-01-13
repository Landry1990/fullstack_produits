from rest_framework import viewsets, filters, permissions
from rest_framework.permissions import IsAuthenticated
from django.db.models import F, Sum, Value, DecimalField, OuterRef, Subquery
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend

from ..models import Client, Facture, Caisse, AyantDroit
from ..serializers import ClientSerializer, AyantDroitSerializer
from ..serializers_optimized import ClientListSerializer, ClientDetailSerializer
from ..serializer_mixins import OptimizedSerializerMixin

class ClientViewSet(OptimizedSerializerMixin, viewsets.ModelViewSet):
    """
    API endpoint for clients with optimized serializers.
    - List view: Lightweight serializer (8 fields)
    - Detail view: Complete serializer with ayants droit
    """
    # Subquery pour sommer les paiements valides par facture (évite l'error 'aggregate of aggregate')
    # On importe Caisse dynamiquement ou on suppose qu'il est disponible via le modèle
    # Pour éviter les imports circulaires ou complexes, on utilise le string reference si possible ou import local?
    # ViewSet a accès aux modèles via imports en haut.
    
    queryset = Client.objects.annotate(
        current_debt_annotated=Subquery(
            Facture.objects.filter(
                client=OuterRef('pk'), 
                status__in=['VAL', 'PAY']  # Inclure VALIDEE et PAYEE
            ).annotate(
                # 1. Calcul des paiements via Subquery pour obtenir un SCALAIRE
                paid_amount=Coalesce(
                    Subquery(
                        Caisse.objects.filter(
                            facture=OuterRef('pk'),
                            statut='completee'
                        ).exclude(
                            mode_paiement='en_compte'
                        ).values('facture').annotate(
                            total_paid=Sum('montant')
                        ).values('total_paid')
                    ),
                    Value(0, output_field=DecimalField())
                ),
                # 2. Maintenant 'paid_amount' est une valeur, donc 'remainder' est une expression simple
                remainder=F('total_ttc') - F('paid_amount')
            ).filter(
                remainder__gt=0 
            ).values('client').annotate(
                # 3. On peut enfin sommer les remainders
                total_debt=Sum('remainder')
            ).values('total_debt')[:1],
            output_field=DecimalField()
        )
    ).order_by('name')
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]
    
    # Serializers optimisés
    list_serializer_class = ClientListSerializer
    detail_serializer_class = ClientDetailSerializer

class AyantDroitViewSet(viewsets.ModelViewSet):
    """API endpoint for ayants droit."""
    queryset = AyantDroit.objects.all().order_by('nom')
    serializer_class = AyantDroitSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['client']
