from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from decimal import Decimal
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend

from ...models import Commande, CommandeProduit, StockLot
from ...serializers import CommandeProduitSerializer
import logging

logger = logging.getLogger(__name__)


class CommandeProduitViewSet(viewsets.ModelViewSet):
    """API endpoint for commande produits."""
    queryset = CommandeProduit.objects.select_related('produit', 'commande', 'commande__fournisseur').order_by('-created_at')
    serializer_class = CommandeProduitSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['produit']
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        
        # Si on cherche par produit (ex: historique d'achats dans l'onglet Produit), 
        # on ne veut voir que les commandes réellement clôturées et réceptionnées.
        if 'produit' in self.request.query_params:
            qs = qs.filter(commande__status='CLOT')
            
        return qs

    def perform_create(self, serializer):
        selling_price = serializer.validated_data.pop('selling_price', None)
        commande_produit = serializer.save()
        if selling_price is not None:
            produit = commande_produit.produit
            produit.selling_price = selling_price
            produit.save(update_fields=['selling_price'])

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_sync(self, request):
        """
        Synchronise tous les produits d'une commande en une seule requête.
        Remplace N requêtes PATCH par une seule requête bulk.
        
        Payload: { commande_id: int, produits: [...] }
        """
        commande_id = request.data.get('commande_id')
        produits_data = request.data.get('produits', [])
        
        if not commande_id:
            return Response({'error': 'commande_id requis'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            commande = Commande.objects.get(pk=commande_id)
        except Commande.DoesNotExist:
            return Response({'error': 'Commande introuvable'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get existing product IDs for this order
        existing_items = {cp.id: cp for cp in commande.produits.all()}
        existing_ids = set(existing_items.keys())
        
        # Track which IDs are in the new payload
        payload_ids = set()
        # Group and merge incoming data by (produit_id, lot)
        merged_data = {}
        for p in produits_data:
            produit_id = p.get('produit')
            lot = p.get('lot') or None
            key = (produit_id, lot)
            
            if key not in merged_data:
                merged_data[key] = {
                    'id': p.get('id'),
                    'produit_id': produit_id,
                    'quantity': int(p.get('quantity', 0)),
                    'unites_gratuites': int(p.get('unites_gratuites', 0)),
                    'price': Decimal(str(p.get('price', 0))),
                    'price_cost': Decimal(str(p.get('price_cost', p.get('price', 0)))),
                    'selling_price': Decimal(str(p.get('selling_price', 0))) if p.get('selling_price') else Decimal('0'),
                    'prix_euro': Decimal(str(p.get('prix_euro'))) if p.get('prix_euro') else None,
                    'lot': lot,
                    'date_expiration': p.get('date_expiration') or None,
                }
            else:
                # Merge: accumulate quantities
                merged_data[key]['quantity'] += int(p.get('quantity', 0))
                merged_data[key]['unites_gratuites'] += int(p.get('unites_gratuites', 0))
                # Keep existing ID if we already had one (prefer keeping the record)
                if not merged_data[key]['id'] and p.get('id'):
                    merged_data[key]['id'] = p.get('id')
        
        items_to_create = []
        items_to_update = []
        
        for item_data in merged_data.values():
            item_id = item_data.pop('id', None)
            
            if item_id and item_id in existing_ids:
                # Update existing item
                payload_ids.add(item_id)
                existing_item = existing_items[item_id]
                for key, value in item_data.items():
                    setattr(existing_item, key, value)
                items_to_update.append(existing_item)
            else:
                # Create new item
                items_to_create.append(CommandeProduit(commande=commande, **item_data))
        
        # Bulk create new items
        if items_to_create:
            StockLot.objects.filter(id__in=[]) # Placeholder to avoid issues if needed, but bulk_create is fine
            CommandeProduit.objects.bulk_create(items_to_create, batch_size=100)
        
        # Bulk update existing items
        if items_to_update:
            CommandeProduit.objects.bulk_update(
                items_to_update,
                ['quantity', 'unites_gratuites', 'price', 'price_cost', 'selling_price', 
                 'prix_euro', 'lot', 'date_expiration', 'produit_id'],
                batch_size=100
            )
        
        # Delete items that are no longer in the payload OR were merged away
        ids_to_delete = existing_ids - payload_ids
        if ids_to_delete:
            CommandeProduit.objects.filter(id__in=ids_to_delete).delete()
        
        return Response({
            'status': 'success',
            'created': len(items_to_create),
            'updated': len(items_to_update),
            'deleted': len(ids_to_delete)
        })
