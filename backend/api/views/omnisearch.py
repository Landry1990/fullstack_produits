from django.core.cache import cache
from django.db.models import Count, DecimalField, F, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Caisse, Client, Commande, CommandeProduit, Facture, Fournisseur, Produit
from ..models.paiements import PaiementFournisseur
from ..serializers import FournisseurSerializer
from ..serializers_optimized import (
    ClientListSerializer,
    CommandeOmnisearchSerializer,
    FactureOmnisearchSerializer,
    ProduitListSerializer,
)


class GlobalSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        try:
            limit = max(1, min(int(request.query_params.get('limit', 5)), 20))
        except (TypeError, ValueError):
            limit = 5

        if not query:
            return Response({
                'produits': [],
                'clients': [],
                'factures': [],
                'commandes': [],
                'fournisseurs': []
            })

        # Cache key based on query and limit
        cache_key = f'omnisearch:{query}:{limit}'
        cached_data = cache.get(cache_key)
        
        if cached_data is not None:
            return Response(cached_data)

        # 1. PRODUITS
        produits = Produit.objects.filter(is_active=True).filter(
            Q(name__icontains=query) | 
            Q(cip1__icontains=query) | 
            Q(cip2__icontains=query) | 
            Q(cip3__icontains=query) |
            Q(cip4__icontains=query)
        ).select_related('rayon', 'fournisseur', 'forme')[:limit]

        # 2. CLIENTS
        paid_amount_subquery = Caisse.objects.filter(
            facture=OuterRef('pk'),
            statut='completee'
        ).exclude(
            mode_paiement='en_compte'
        ).values('facture').annotate(
            total_paid=Sum('montant')
        ).values('total_paid')[:1]

        current_debt_subquery = Facture.objects.filter(
            client=OuterRef('pk'),
            status__in=['VAL', 'PAY'],
            is_active=True
        ).annotate(
            paid_amount=Coalesce(
                Subquery(paid_amount_subquery),
                Value(0, output_field=DecimalField())
            ),
            remainder=F('total_ttc') - F('paid_amount')
        ).filter(
            remainder__gt=0
        ).values('client').annotate(
            total_debt=Sum('remainder')
        ).values('total_debt')[:1]

        clients = Client.objects.filter(
            Q(name__icontains=query) |
            Q(phone__icontains=query)
        ).annotate(
            current_debt_annotated=Coalesce(
                Subquery(current_debt_subquery, output_field=DecimalField()),
                Value(0, output_field=DecimalField())
            )
        ).prefetch_related('ayants_droit')[:limit]

        # 3. FACTURES (Ventes)
        factures = Facture.objects.filter(
            Q(numero_facture__icontains=query) |
            Q(client_name_override__icontains=query) |
            Q(client__name__icontains=query)
        ).select_related('client', 'created_by', 'validated_by', 'ayant_droit').prefetch_related('produits__produit')[:limit]

        # 4. COMMANDES (Optimisé avec Subqueries pour éviter les doublons SQL)
        total_items_subquery = CommandeProduit.objects.filter(
            commande=OuterRef('pk')
        ).values('commande').annotate(
            total=Sum(F('quantity') * F('price'), output_field=DecimalField())
        ).values('total')[:1]

        paid_items_subquery = PaiementFournisseur.objects.filter(
            commande=OuterRef('pk')
        ).values('commande').annotate(
            total=Sum('montant', output_field=DecimalField())
        ).values('total')[:1]

        count_items_subquery = CommandeProduit.objects.filter(
            commande=OuterRef('pk')
        ).values('commande').annotate(
            cnt=Count('id')
        ).values('cnt')[:1]

        commandes = Commande.objects.filter(
            Q(numero_facture__icontains=query) |
            Q(fournisseur__name__icontains=query) |
            Q(fournisseur_nom__icontains=query)
        ).select_related('fournisseur', 'closed_by').prefetch_related(
            'produits__produit',
            'produits__stock_lot'  # Ajout pour éviter N+1 sur instance.stock_lot.all()
        ).annotate(
            total_annotated=Coalesce(Subquery(total_items_subquery), Value(0, output_field=DecimalField())),
            montant_paye_annotated=Coalesce(Subquery(paid_items_subquery), Value(0, output_field=DecimalField())),
            items_count=Coalesce(Subquery(count_items_subquery), 0)
        )[:limit]

        # 5. FOURNISSEURS
        fournisseurs = Fournisseur.objects.filter(
            Q(name__icontains=query) |
            Q(phone__icontains=query)
        )[:limit]

        response_data = {
            'produits': ProduitListSerializer(produits, many=True).data,
            'clients': ClientListSerializer(clients, many=True).data,
            'factures': FactureOmnisearchSerializer(factures, many=True).data,
            'commandes': CommandeOmnisearchSerializer(commandes, many=True).data,
            'fournisseurs': FournisseurSerializer(fournisseurs, many=True).data,
        }
        
        # Cache the result for 1 minute
        cache.set(cache_key, response_data, timeout=60)
        
        return Response(response_data)
