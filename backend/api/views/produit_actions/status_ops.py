from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q

from ...models import Produit
from ...serializers import ProduitSerializer
from ...cache_utils import SearchCache

class ProduitStatusMixin:
    """Mixin pour les changements de statut et les vues simplifiées."""

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        produit = self.get_object()
        produit.is_active = not produit.is_active
        
        if not produit.is_active:
            suffix = " (Produit inactif)"
            if suffix not in produit.name:
                produit.name = f"{produit.name}{suffix}"
        else:
            produit.name = produit.name.replace(" (Produit inactif)", "")
            
        produit.save(update_fields=['is_active', 'name'])
        SearchCache.invalidate_all_products()
        
        return Response({
            'status': 'success',
            'is_active': produit.is_active,
            'message': f"Produit {'réactivé' if produit.is_active else 'masqué'}"
        })
        
    @action(detail=True, methods=['post'])
    def toggle_public(self, request, pk=None):
        produit = self.get_object()
        produit.is_public = not produit.is_public
        produit.save(update_fields=['is_public'])
        SearchCache.invalidate_all_products()
        
        return Response({
            'status': 'success', 
            'is_public': produit.is_public,
            'message': "Visibilité publique modifiée"
        })

    @action(detail=False, methods=['get'])
    def for_import(self, request):
        produits = Produit.objects.all().order_by('name').values(
            'id', 'name', 'cip1', 'cip2', 'cip3', 'stock', 'selling_price',
            'cost_price', 'tva', 'taux_marge', 'is_active'
        )
        return Response(list(produits))

    @action(detail=False, methods=['get'], url_path='by-cip/(?P<cip>[^/.]+)')
    def by_cip(self, request, cip=None):
        """
        Recherche un produit par son code CIP1, CIP2 ou CIP3.
        Supporte le format d'URL /api/produits/by-cip/<cip>/ utilisé par le PDA.
        """
        if not cip:
            cip = request.query_params.get('cip', None)
            
        if not cip:
            return Response({'error': 'Paramètre CIP requis'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Recherche insensible à la casse sur les 3 champs CIP
        # On essaie d'abord les produits actifs
        produit = Produit.objects.filter(
            Q(cip1__iexact=cip) | Q(cip2__iexact=cip) | Q(cip3__iexact=cip),
            is_active=True
        ).first()
        
        # Si non trouvé, on cherche parmi les inactifs
        if not produit:
            produit = Produit.objects.filter(
                Q(cip1__iexact=cip) | Q(cip2__iexact=cip) | Q(cip3__iexact=cip)
            ).first()

        if produit:
            serializer = ProduitSerializer(produit, context={'request': request})
            return Response(serializer.data)
            
        return Response({'error': 'Produit non trouvé'}, status=status.HTTP_404_NOT_FOUND)
