from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from decimal import Decimal
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from datetime import date
import calendar

from ...models import Commande, CommandeProduit, StockLot, Produit
from ...serializers import CommandeProduitSerializer
from ...centralized_configs import StandardResultsSetPagination
import logging

logger = logging.getLogger(__name__)


class CommandeProduitViewSet(viewsets.ModelViewSet):
    """API endpoint for commande produits."""
    queryset = CommandeProduit.objects.select_related('produit', 'commande', 'commande__fournisseur').order_by('-created_at')
    serializer_class = CommandeProduitSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['produit']
    pagination_class = StandardResultsSetPagination
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

    def _check_commande_not_closed(self, instance):
        """Lève une erreur si la commande associée est clôturée."""
        if instance.commande.status == Commande.Status.CLOTUREE:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                "Modification impossible : cette ligne appartient à une commande déjà clôturée."
            )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._check_commande_not_closed(instance)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._check_commande_not_closed(instance)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self._check_commande_not_closed(instance)
        return super().destroy(request, *args, **kwargs)

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
            
        if commande.status == Commande.Status.CLOTUREE:
            return Response({'error': 'Modification impossible : cette commande est déjà clôturée.'}, status=status.HTTP_400_BAD_REQUEST)

        
        from django.db.models import ProtectedError
        
        logger.info(f"[BULK_SYNC] Called for commande_id={commande_id}, {len(produits_data)} produits in payload")
        
        # Track which IDs are in the new payload to identify what to delete
        payload_ids = set()
        
        items_to_create = []
        items_to_update = []
        warnings_list = []
        
        # Helper to convert values to Decimal safely
        def to_decimal(val, default=0):
            if val is None or val == '' or str(val).strip() == '':
                return Decimal(str(default))
            try:
                return Decimal(str(val))
            except:
                return Decimal(str(default))

        def parse_expiration(val):
            if val is None:
                return None
            if isinstance(val, date):
                y = val.year
                m = val.month
                last_day = calendar.monthrange(y, m)[1]
                return date(y, m, last_day)

            s = str(val).strip()
            if not s:
                return None

            if '/' in s and len(s) <= 7:
                parts = s.split('/')
                if len(parts) != 2:
                    return None
                mm_str, yy_str = parts[0].strip(), parts[1].strip()
                if not (mm_str.isdigit() and yy_str.isdigit()):
                    return None
                m = int(mm_str)
                yy = int(yy_str)
                if m < 1 or m > 12:
                    return None
                y = 2000 + yy if yy < 100 else yy
                last_day = calendar.monthrange(y, m)[1]
                return date(y, m, last_day)

            if '-' in s:
                parts = s.split('T')[0].split('-')
                if len(parts) != 3:
                    return None
                y, m, d = (int(parts[0]), int(parts[1]), int(parts[2]))
                last_day = calendar.monthrange(y, m)[1]
                return date(y, m, last_day)

            return None

        # Get product TVAs for fallback
        product_ids_in_payload = {p.get('produit') for p in produits_data if p.get('produit')}
        product_tva_map = {p.id: p.tva for p in Produit.objects.filter(id__in=product_ids_in_payload)}
        # Fetch existing items for this order to know what to update vs create
        existing_qs = CommandeProduit.objects.filter(commande=commande)
        existing_items = {item.id: item for item in existing_qs}
        existing_ids = set(existing_items.keys())

        # Process each item in the payload individually (NO MERGING)
        # Merging existing lines with distinct IDs is dangerous for dependencies.
        for p in produits_data:
            item_id = p.get('id')
            produit_id = p.get('produit')
            lot = p.get('lot') or None

            data = {
                'produit_id': produit_id,
                'quantity': int(p.get('quantity', 0)) if p.get('quantity') else 0,
                'unites_gratuites': int(p.get('unites_gratuites', 0)) if p.get('unites_gratuites') else 0,
                'price': to_decimal(p.get('price', 0)),
                'price_cost': to_decimal(p.get('price_cost', p.get('price', 0))),
                'selling_price': to_decimal(p.get('selling_price', 0)),
                'prix_euro': to_decimal(p.get('prix_euro'), None) if p.get('prix_euro') else None,
                'tva': to_decimal(p.get('tva') if p.get('tva') is not None else product_tva_map.get(produit_id, 19.25)),
                'lot': lot,
                'date_expiration': parse_expiration(p.get('date_expiration')),
            }

            # Contrôle de Marge
            if data['selling_price'] < data['price_cost'] and data['selling_price'] > 0:
                produit_name = p.get('produit_nom') or 'Inconnu'
                warnings_list.append(f"Marge négative détectée sur le produit {produit_name} (Achat: {data['price_cost']}F, Vente: {data['selling_price']}F).")
            elif data['selling_price'] == 0:
                produit_name = p.get('produit_nom') or 'Inconnu'
                warnings_list.append(f"Prix de vente non défini pour le produit {produit_name}.")
            elif data['selling_price'] == data['price_cost'] and data['price_cost'] > 0:
                produit_name = p.get('produit_nom') or 'Inconnu'
                warnings_list.append(f"Attention : Marge nulle (0F) sur {produit_name}.")

            if item_id and item_id in existing_ids:
                payload_ids.add(item_id)
                existing_item = existing_items[item_id]
                for key, value in data.items():
                    setattr(existing_item, key, value)
                items_to_update.append(existing_item)
            else:
                # Create new item
                items_to_create.append(CommandeProduit(commande=commande, **data))
        
        # Bulk create new items
        if items_to_create:
            CommandeProduit.objects.bulk_create(items_to_create, batch_size=100)
        
        # Bulk update existing items
        if items_to_update:
            CommandeProduit.objects.bulk_update(
                items_to_update,
                ['produit_id', 'quantity', 'unites_gratuites', 'price', 'price_cost', 'selling_price', 
                 'prix_euro', 'tva', 'lot', 'date_expiration'],
                batch_size=100
            )

        # Synchronisation avec la fiche produit (TVA, Prix, Marge)
        # On ne sync que les produits présents dans le payload
        for p_id in product_ids_in_payload:
            # On prend la dernière ligne de ce produit pour la sync
            # (Si l'utilisateur a plusieurs lignes identiques, la dernière gagne)
            latest_p_data = next((p for p in reversed(produits_data) if p.get('produit') == p_id), None)
            if latest_p_data:
                Produit.objects.filter(id=p_id).update(
                    tva=to_decimal(latest_p_data.get('tva'), product_tva_map.get(p_id, 19.25)),
                    selling_price=to_decimal(latest_p_data.get('selling_price', 0)),
                    cost_price=to_decimal(latest_p_data.get('price_cost', latest_p_data.get('price', 0)))
                )
                p_obj = Produit.objects.get(id=p_id)
                p_obj.save(update_fields=['taux_marge', 'pourcentage_marge'])
        
        # Delete items that are no longer in the payload
        ids_to_delete = existing_ids - payload_ids
        deleted_count = 0
        if ids_to_delete:
            try:
                deleted_count = CommandeProduit.objects.filter(id__in=ids_to_delete).count()
                CommandeProduit.objects.filter(id__in=ids_to_delete).delete()
            except ProtectedError as e:
                # Identification des objets protecteurs pour un message clair
                protected_elements = []
                for obj in e.protected_objects:
                    if hasattr(obj, 'facture'):
                        protected_elements.append(f"Facture {obj.facture.numero_facture or obj.facture.id}")
                    else:
                        protected_elements.append(str(obj))
                
                error_msg = "Certains produits ne peuvent pas être retirés car ils sont déjà utilisés dans : " + ", ".join(set(protected_elements))
                return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'status': 'success',
            'created': len(items_to_create),
            'updated': len(items_to_update),
            'deleted': deleted_count,
            'warnings': warnings_list
        })
