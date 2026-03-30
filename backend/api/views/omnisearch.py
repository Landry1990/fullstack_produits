from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count, Sum, F, DecimalField
from django.db.models.functions import Coalesce

from ..models import Produit, Client, Facture, Commande, Fournisseur
from ..serializers_optimized import (
    ProduitListSerializer, ClientListSerializer, 
    FactureListSerializer, FactureOmnisearchSerializer, 
    CommandeListSerializer, CommandeOmnisearchSerializer
)
from ..serializers import FournisseurSerializer

class GlobalSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        limit = int(request.query_params.get('limit', 5))

        if not query:
            return Response({
                'produits': [],
                'clients': [],
                'factures': [],
                'commandes': [],
                'fournisseurs': []
            })

        # 1. PRODUITS
        produits = Produit.objects.filter(is_active=True).filter(
            Q(name__icontains=query) | 
            Q(cip1__icontains=query) | 
            Q(cip2__icontains=query) | 
            Q(cip3__icontains=query)
        ).select_related('rayon', 'fournisseur', 'forme')[:limit]

        # 2. CLIENTS
        clients = Client.objects.filter(
            Q(name__icontains=query) | 
            Q(phone__icontains=query)
        )[:limit]

        # 3. FACTURES (Ventes)
        factures = Facture.objects.filter(
            Q(numero_facture__icontains=query) |
            Q(client_name_override__icontains=query) |
            Q(client__name__icontains=query)
        ).select_related('client', 'created_by', 'validated_by', 'ayant_droit').prefetch_related('produits__produit')[:limit]

        # 4. COMMANDES
        commandes = Commande.objects.filter(
            Q(numero_facture__icontains=query) |
            Q(fournisseur__name__icontains=query) |
            Q(fournisseur_nom__icontains=query)
        ).select_related('fournisseur', 'closed_by').prefetch_related('produits__produit').annotate(
            total_annotated=Coalesce(Sum('produits__price', output_field=DecimalField()), 0, output_field=DecimalField()),
            montant_paye_annotated=Coalesce(Sum('paiements__montant', output_field=DecimalField()), 0, output_field=DecimalField()),
            items_count=Count('produits')
        )[:limit]

        # 5. FOURNISSEURS
        fournisseurs = Fournisseur.objects.filter(
            Q(name__icontains=query) |
            Q(phone__icontains=query)
        )[:limit]

        return Response({
            'produits': ProduitListSerializer(produits, many=True).data,
            'clients': ClientListSerializer(clients, many=True).data,
            'factures': FactureOmnisearchSerializer(factures, many=True).data,
            'commandes': CommandeOmnisearchSerializer(commandes, many=True).data,
            'fournisseurs': FournisseurSerializer(fournisseurs, many=True).data,
        })
