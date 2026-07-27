from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import (
    Count,
    DecimalField,
    F,
    Max,
    OuterRef,
    ProtectedError,
    Subquery,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..cache_mixins import SimpleListCacheMixin
from ..cache_utils import ClientDebtCache
from ..models import AyantDroit, Caisse, Client, DepotClient, Facture
from ..pagination import StandardResultsSetPagination
from ..serializer_mixins import OptimizedSerializerMixin
from ..serializers import AyantDroitSerializer, ClientSerializer, DepotClientSerializer
from ..serializers_optimized import ClientDetailSerializer, ClientListSerializer


class ClientViewSet(SimpleListCacheMixin, OptimizedSerializerMixin, viewsets.ModelViewSet):
    """
    API endpoint for clients with optimized serializers.
    - List view: Lightweight serializer (8 fields)
    - Detail view: Complete serializer with ayants droit
    - List cached for 300s — clients change rarely
    """
    cache_prefix = 'clients'
    cache_ttl = 300  # 5 minutes
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
        
        # Optimisation: select_related pour les clés étrangères
        qs = qs.select_related()
        
        # En mode détail, prefetch les ayants droit pour éviter N+1
        if self.action in ['retrieve', 'update', 'partial_update']:
            qs = qs.prefetch_related('ayants_droit')
        
        # Par défaut, ne montrer que les clients actifs SEULEMENT pour la liste
        # Pour le détail/update/actions, on veut pouvoir accéder même aux inactifs
        include_inactive = self.request.query_params.get('include_inactive', '').lower() in ['true', '1', 'yes']
        if self.action == 'list' and not include_inactive:
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
            'message': f'Le client est maintenant {"actif" if client.is_active else "inactif"}.'
        })

    def perform_destroy(self, instance):
        import logging

        from django.utils import timezone
        logger = logging.getLogger(__name__)
        logger.info(f'[ClientViewSet] Soft deleting client {instance.id} - {instance.name}')
        instance.is_active = False
        instance.deleted_by = self.request.user
        instance.deleted_at = timezone.now()
        instance.save(update_fields=['is_active', 'deleted_by', 'deleted_at'])
        self._invalidate_cache()
        logger.info(f'[ClientViewSet] Client {instance.id} soft deleted successfully, is_active={instance.is_active}')

    @action(detail=True, methods=['get'])
    def purchase_history(self, request, pk=None):
        """Retourne l'historique enrichi des achats d'un client — optimisé SQL."""
        client = self.get_object()

        from django.db.models import F as F_orm
        from django.db.models import Sum
        from django.db.models.functions import TruncMonth

        # ── Stats globales en une seule requête ─────────────────
        stats = Facture.objects.filter(
            client=client,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(
            total_ca=Sum('total_ttc'),
            nb_factures=Count('id'),
            last_visit=Max('date'),
        )

        total_ca = stats['total_ca'] or Decimal('0.00')
        nb_factures = stats['nb_factures'] or 0
        last_visit = stats['last_visit']
        avg_basket = float(total_ca / nb_factures) if nb_factures > 0 else 0.0

        # ── Top 5 produits par quantité (SQL) ───────────────────
        from api.models import FactureProduit
        top_products_qs = FactureProduit.objects.filter(
            facture__client=client,
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).values(
            'produit__id', 'produit__name', 'produit_nom'
        ).annotate(
            total_qty=Sum('quantity'),
            total_ca=Sum(F_orm('quantity') * F_orm('selling_price'), output_field=DecimalField()),
        ).order_by('-total_qty')[:5]

        top_products = [
            {
                'id': p['produit__id'] or f"_{p['produit_nom']}",
                'nom': p['produit__name'] or p['produit_nom'] or 'Produit inconnu',
                'quantite': p['total_qty'],
                'total': float(p['total_ca'] or 0),
            }
            for p in top_products_qs
        ]

        # ── CA 12 derniers mois (SQL TruncMonth) ────────────────
        now = timezone.now()
        twelve_months_ago = now - timedelta(days=365)
        ca_monthly_qs = Facture.objects.filter(
            client=client,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            date__gte=twelve_months_ago,
        ).annotate(
            month=TruncMonth('date')
        ).values('month').annotate(
            ca=Sum('total_ttc')
        ).order_by('month')

        ca_map = {entry['month'].strftime('%b %Y'): float(entry['ca'] or 0) for entry in ca_monthly_qs}

        ca_12_mois = []
        for i in range(11, -1, -1):
            month_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
            label = month_start.strftime('%b %Y')
            ca_12_mois.append({
                'mois': label,
                'ca': ca_map.get(label, 0),
            })

        # ── Fréquence de visite (SQL) ───────────────────────────
        visit_frequency = None
        if nb_factures >= 2:
            dates_list = list(
                Facture.objects.filter(
                    client=client,
                    status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
                ).values_list('date', flat=True).order_by('-date')
            )
            spans = [(dates_list[i] - dates_list[i + 1]).days for i in range(len(dates_list) - 1)]
            visit_frequency = round(sum(spans) / len(spans), 1)

        # ── 50 dernières factures avec produits ─────────────────
        recent_factures = Facture.objects.filter(
            client=client,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).prefetch_related('produits__produit').order_by('-date')[:50]

        result = []
        for facture in recent_factures:
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
            'client_type': client.client_type,
            'message_alerte': client.message_alerte,
            'blocking_alerte': client.blocking_alerte,
            'total_factures': nb_factures,
            'total_ca': float(total_ca),
            'avg_basket': round(avg_basket, 2),
            'last_visit': last_visit.isoformat() if last_visit else None,
            'visit_frequency': visit_frequency,
            'top_products': top_products,
            'ca_12_mois': ca_12_mois,
            'factures': result,
        })

    @action(detail=True, methods=['patch'])
    def update_alerte(self, request, pk=None):
        """Met à jour l'alerte personnalisée d'un client."""
        client = self.get_object()
        client.message_alerte = request.data.get('message_alerte', '')
        client.blocking_alerte = bool(request.data.get('blocking_alerte', False))
        client.save(update_fields=['message_alerte', 'blocking_alerte'])
        return Response({
            'message_alerte': client.message_alerte,
            'blocking_alerte': client.blocking_alerte,
        })

    @action(detail=True, methods=['get'])
    def depot_history(self, request, pk=None):
        """Retourne l'historique des dépôts/retraits d'un client."""
        client = self.get_object()
        history = DepotClient.objects.filter(client=client).order_by('-date')
        serializer = DepotClientSerializer(history, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def add_depot(self, request, pk=None):
        """Enregistre un nouveau dépôt ou retrait manuel."""
        client = self.get_object()
        data = request.data
        
        try:
            amount = Decimal(str(data.get('montant', 0)))
            if amount <= 0:
                return Response({'detail': "Le montant doit être supérieur à 0."}, status=400)
            
            depot_type = data.get('type')
            if depot_type not in ['DEPOT', 'RETRAIT']:
                return Response({'detail': "Type de transaction invalide."}, status=400)
            
            if depot_type == DepotClient.Type.RETRAIT and client.solde_depot < amount:
                return Response({'detail': "Solde insuffisant pour ce retrait."}, status=400)

            depot = DepotClient.objects.create(
                client=client,
                type=depot_type,
                montant=amount,
                mode_paiement=data.get('mode_paiement', 'ESP'),
                notes=data.get('notes', ''),
                created_by=request.user
            )
            
            return Response(DepotClientSerializer(depot).data, status=201)
        except Exception as e:
            return Response({'detail': str(e)}, status=400)

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
                clients.update(is_active=False)
                
                return Response({
                    'status': 'success',
                    'message': f'{count} clients mis en corbeille avec succès.'
                })
        except ProtectedError:
            return Response({
                'error': 'Impossible de supprimer certains clients',
                'detail': 'Certains clients sont liés à des factures ou d\'autres enregistrements et ne peuvent pas être supprimés.'
            }, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['post'])
    def bulk_check_unpaid(self, request):
        """
        Vérifie si plusieurs clients ont des factures non réglées.
        Retourne la liste des clients avec factures impayées.
        """
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'detail': 'Aucun ID fourni.'}, status=400)
        
        from django.db.models import DecimalField, Sum, Value
        from django.db.models.functions import Coalesce

        from ..models import Caisse, Facture
        
        clients_with_unpaid = []
        total_unpaid_all = Decimal('0.00')
        
        clients = Client.objects.filter(id__in=ids)
        
        for client in clients:
            factures = Facture.objects.filter(
                client=client,
                status__in=['VAL', 'PAY'],
                is_active=True
            )
            
            client_unpaid_count = 0
            client_total_due = Decimal('0.00')
            
            for facture in factures:
                paid = Caisse.objects.filter(
                    facture=facture,
                    statut='completee'
                ).exclude(
                    mode_paiement='en_compte'
                ).aggregate(
                    total=Coalesce(Sum('montant'), Value(0, output_field=DecimalField()))
                )['total']
                
                remainder = facture.total_ttc - paid
                
                if remainder > 0:
                    client_unpaid_count += 1
                    client_total_due += remainder
            
            if client_unpaid_count > 0:
                clients_with_unpaid.append({
                    'id': client.id,
                    'name': client.name,
                    'invoice_count': client_unpaid_count,
                    'total_due': float(client_total_due)
                })
                total_unpaid_all += client_total_due
        
        return Response({
            'has_unpaid': len(clients_with_unpaid) > 0,
            'count': len(clients_with_unpaid),
            'total_due': float(total_unpaid_all),
            'clients': clients_with_unpaid
        })

    def _compute_unpaid_invoices(self, client):
        """
        Calcule les factures impayées d'un client (sans cache).
        Cette méthode est appelée uniquement en cas de cache miss.
        """
        from django.db.models import DecimalField, Sum, Value
        from django.db.models.functions import Coalesce

        from ..models import Caisse, Facture
        
        unpaid_invoices = []
        total_due = Decimal('0.00')
        
        factures = Facture.objects.filter(
            client=client,
            status__in=['VAL', 'PAY'],
            is_active=True
        )
        
        for facture in factures:
            # Calculer les paiements complétés (hors "en_compte")
            paid = Caisse.objects.filter(
                facture=facture,
                statut='completee'
            ).exclude(
                mode_paiement='en_compte'
            ).aggregate(
                total=Coalesce(Sum('montant'), Value(0, output_field=DecimalField()))
            )['total']
            
            remainder = facture.total_ttc - paid
            
            if remainder > 0:
                unpaid_invoices.append({
                    'id': facture.id,
                    'numero': facture.numero_facture,
                    'date': facture.date.isoformat() if facture.date else None,
                    'total_ttc': float(facture.total_ttc),
                    'paid': float(paid),
                    'remainder': float(remainder)
                })
                total_due += remainder
        
        return {
            'has_unpaid': len(unpaid_invoices) > 0,
            'count': len(unpaid_invoices),
            'total_due': float(total_due),
            'invoices': unpaid_invoices
        }

    @action(detail=True, methods=['get'])
    def check_unpaid_invoices(self, request, pk=None):
        """
        Vérifie si le client a des factures non réglées ou partiellement réglées.
        Retourne le nombre de factures et le montant total dû.
        
        Optimisé avec cache Redis (TTL 60s) pour les requêtes répétées.
        """
        client = self.get_object()
        
        # Pattern Cache-Aside: vérifier le cache d'abord
        cached = ClientDebtCache.get_client_debt(client.id)
        if cached is not None:
            return Response(cached)
        
        # Cache miss: calculer le résultat
        result = self._compute_unpaid_invoices(client)
        
        # Stocker en cache pour les prochaines requêtes
        ClientDebtCache.set_client_debt(client.id, result)
        
        return Response(result)

class AyantDroitViewSet(viewsets.ModelViewSet):
    """API endpoint for ayants droit."""
    queryset = AyantDroit.objects.select_related('client').order_by('nom')
    serializer_class = AyantDroitSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['client']

class DepotClientViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for viewing deposit history globally."""
    queryset = DepotClient.objects.select_related('client', 'created_by').order_by('-date')
    serializer_class = DepotClientSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['client', 'type']
    search_fields = ['client__name', 'notes']
