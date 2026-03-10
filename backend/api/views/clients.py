from rest_framework import viewsets, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import F, Sum, Value, DecimalField, OuterRef, Subquery, ProtectedError
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend

from ..models import Client, Facture, Caisse, AyantDroit
from ..serializers import ClientSerializer, AyantDroitSerializer
from ..serializers_optimized import ClientListSerializer, ClientDetailSerializer
from ..serializer_mixins import OptimizedSerializerMixin
from ..pagination import StandardResultsSetPagination

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
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'email', 'phone', 'address']
    
    # Serializers optimisés
    list_serializer_class = ClientListSerializer
    detail_serializer_class = ClientDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Par défaut, ne montrer que les clients actifs SEULEMENT pour la liste
        # Pour le détail/update/actions, on veut pouvoir accéder même aux inactifs
        if self.action == 'list' and not self.request.query_params.get('include_inactive'):
            qs = qs.filter(is_active=True)
        return qs

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Bascule le statut actif/inactif d'un client."""
        client = self.get_object()
        client.is_active = not client.is_active
        client.save(update_fields=['is_active'])
        return Response({
            'status': 'success',
            'is_active': client.is_active,
            'message': f"Client {'réactivé' if client.is_active else 'masqué'}"
        })

    @action(detail=True, methods=['get'])
    def purchase_history(self, request, pk=None):
        """Retourne l'historique des achats d'un client avec les produits."""
        client = self.get_object()
        
        factures = Facture.objects.filter(
            client=client,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).prefetch_related(
            'produits__produit'
        ).order_by('-date')[:50]
        
        result = []
        for facture in factures:
            produits_list = []
            for fp in facture.produits.all():
                produits_list.append({
                    'id': fp.produit.id if fp.produit else None,
                    'nom': fp.produit.name if fp.produit else fp.produit_nom or 'Produit inconnu',
                    'quantite': fp.quantity,
                    'prix_unitaire': float(fp.selling_price),
                    'total': float(fp.quantity * fp.selling_price)
                })
            
            result.append({
                'id': facture.id,
                'date': facture.date.isoformat(),
                'numero_facture': facture.numero_facture or f"F-{facture.id}",
                'total_ttc': float(facture.total_ttc),
                'status': facture.status,
                'produits': produits_list
            })
        
        return Response({
            'client_id': client.id,
            'client_name': client.name,
            'total_factures': len(result),
            'factures': result
        })

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """Supprime plusieurs clients par lot."""
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'detail': 'Aucun ID fourni.'}, status=400)
            
        try:
            with transaction.atomic():
                clients = Client.objects.filter(id__in=ids)
                count = clients.count()
                clients.delete()
                
                return Response({
                    'status': 'success',
                    'message': f'{count} clients supprimés avec succès.'
                })
        except ProtectedError as e:
            return Response({
                'error': 'Impossible de supprimer certains clients',
                'detail': 'Certains clients sont liés à des factures ou d\'autres enregistrements et ne peuvent pas être supprimés.'
            }, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class AyantDroitViewSet(viewsets.ModelViewSet):
    """API endpoint for ayants droit."""
    queryset = AyantDroit.objects.select_related('client').order_by('nom')
    serializer_class = AyantDroitSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['client']
