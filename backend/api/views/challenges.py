from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Count, F, Q, DecimalField, Value
from django.db.models.functions import Coalesce
from decimal import Decimal

from ..models import Challenge, Facture, FactureProduit
from ..serializers.challenges import ChallengeSerializer
from ..pagination import StandardResultsSetPagination


class ChallengeViewSet(viewsets.ModelViewSet):
    """Gestion des challenges commerciaux et classement des vendeurs."""
    serializer_class = ChallengeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nom', 'description']
    filterset_fields = ['statut', 'is_active']
    ordering_fields = ['date_debut', 'date_fin', 'created_at']
    ordering = ['-date_debut']

    def get_queryset(self):
        return Challenge.objects.select_related('created_by').prefetch_related('participants', 'produits')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['get'])
    def classement(self, request, pk=None):
        """Classement des vendeurs sur le challenge (boîtes + CA)."""
        challenge = self.get_object()
        from datetime import datetime
        from django.utils import timezone

        # Période du challenge
        date_debut = challenge.date_debut
        date_fin = challenge.date_fin

        # Produits ciblés (si vide, tous les produits)
        produits_qs = challenge.produits.all()
        produit_ids = list(produits_qs.values_list('id', flat=True))

        # Vendeurs ciblés
        if challenge.all_users:
            participants_qs = None  # tous
        else:
            participants_qs = challenge.participants.all()
            participant_ids = list(participants_qs.values_list('id', flat=True))

        # Factures valides sur la période
        factures_qs = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            date__date__gte=date_debut,
            date__date__lte=date_fin,
        )
        if participants_qs is not None:
            factures_qs = factures_qs.filter(created_by_id__in=participant_ids)

        # Lignes de vente liées aux produits du challenge
        lignes_qs = FactureProduit.objects.filter(
            facture__in=factures_qs,
            produit_id__in=produit_ids if produit_ids else [p for p in [0] if False],  # si vide, on prend tout
        )
        if not produit_ids:
            lignes_qs = FactureProduit.objects.filter(facture__in=factures_qs)

        # Agrégation par vendeur
        # CA = sum(quantity * (selling_price - discount))
        rows = (
            lignes_qs
            .values('facture__created_by_id', 'facture__created_by__username')
            .annotate(
                nb_boites=Coalesce(Sum('quantity'), Value(0), output_field=DecimalField(max_digits=12, decimal_places=0)),
                ca=Coalesce(
                    Sum(F('quantity') * (F('selling_price') - F('discount'))),
                    Value(0),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                ),
                nb_ventes=Count('facture', distinct=True),
            )
            .order_by('-ca')
        )

        classement = []
        for rank, row in enumerate(rows, 1):
            classement.append({
                'rang': rank,
                'user_id': row['facture__created_by_id'],
                'username': row['facture__created_by__username'] or '—',
                'nb_boites': int(row['nb_boites'] or 0),
                'ca': float(row['ca'] or 0),
                'nb_ventes': row['nb_ventes'],
            })

        return Response({
            'challenge': {
                'id': challenge.id,
                'nom': challenge.nom,
                'date_debut': challenge.date_debut.isoformat(),
                'date_fin': challenge.date_fin.isoformat(),
                'statut': challenge.statut,
                'all_users': challenge.all_users,
                'produits_count': len(produit_ids),
            },
            'classement_ca': classement,
            'classement_boites': sorted(classement, key=lambda x: x['nb_boites'], reverse=True),
        })
