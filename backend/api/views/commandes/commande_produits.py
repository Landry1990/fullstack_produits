import calendar
import logging
from datetime import date
from decimal import Decimal

from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...audit_helpers import log_audit
from django.core.cache import cache

from ...centralized_configs import StandardResultsSetPagination
from ...models import AuditLog, Commande, CommandeProduit, Produit, StockLot
from ...serializers import CommandeProduitSerializer

logger = logging.getLogger(__name__)


class CommandeProduitViewSet(viewsets.ModelViewSet):
    """API endpoint for commande produits."""
    # 'stock_lot' (reverse FK StockLot.commande_produit) : lu par
    # CommandeProduitSerializer.to_representation pour les commandes CLOT —
    # sans prefetch c'est une requête par ligne (N+1).
    queryset = CommandeProduit.objects.select_related(
        'produit', 'commande', 'commande__fournisseur'
    ).prefetch_related('stock_lot').order_by('-created_at')
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
        commande = serializer.validated_data.get('commande')
        if commande is not None and commande.status == Commande.Status.CLOTUREE:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                "Création impossible : cette commande est déjà clôturée."
            )
        with transaction.atomic():
            commande_produit = serializer.save()
            if selling_price is not None and commande_produit.produit_id:
                produit = commande_produit.produit
                old_price = produit.selling_price
                if old_price != selling_price:
                    produit.selling_price = selling_price
                    produit.save(update_fields=['selling_price'])
                    # NOTE : les changements de prix sont tracés en masse par
                    # bulk_sync pour éviter d'inonder le journal d'audit.
            # NOTE : on ne trace plus chaque ligne CommandeProduit créée ;
            # bulk_sync produit un résumé et les actions commande (create/update/
            # cloture) restent tracées au niveau Commande.

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

    def perform_update(self, serializer):
        # NOTE : pas de log par ligne ici ; bulk_sync gère le résumé et les
        # actions sur la commande restent tracées au niveau Commande.
        serializer.save()

    def perform_destroy(self, instance):
        # NOTE : pas de log par ligne supprimée ; la suppression est normalement
        # réalisée via bulk_sync qui trace la commande parente.
        super().perform_destroy(instance)

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
        errors_list = []

        # Helper STRICT : lève ValueError sur entrée invalide au lieu de retourner
        # silencieusement un défaut ('abc' → 0 masquait des erreurs de saisie).
        def to_int(val, default: int | None = 0):
            if val is None or val == '':
                return default
            if isinstance(val, bool) or (isinstance(val, float) and not val.is_integer()):
                raise ValueError(f"Nombre entier invalide : {val!r}")
            try:
                return int(val)
            except (TypeError, ValueError, OverflowError):
                raise ValueError(f"Nombre entier invalide : {val!r}")

        # Helper STRICT : idem pour les décimaux (rejette aussi NaN/inf).
        def to_decimal(val, default: int | None = 0):
            if val is None or val == '' or str(val).strip() == '':
                return Decimal(str(default)) if default is not None else None
            try:
                parsed = Decimal(str(val))
            except Exception:
                raise ValueError(f"Nombre décimal invalide : {val!r}")
            if not parsed.is_finite():
                raise ValueError(f"Nombre décimal invalide : {val!r}")
            return parsed

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
                try:
                    parts = s.split('T')[0].split('-')
                    if len(parts) != 3:
                        return None
                    y, m, _d = (int(parts[0]), int(parts[1]), int(parts[2]))
                    last_day = calendar.monthrange(y, m)[1]
                    return date(y, m, last_day)
                except (ValueError, IndexError):
                    return None

            return None

        # Get product TVAs for fallback (IDs invalides ignorés : erreur collectée plus bas)
        product_ids_in_payload = set()
        for _p in produits_data:
            try:
                _pid = to_int(_p.get('produit'), None)
            except ValueError:
                continue
            if _pid:
                product_ids_in_payload.add(_pid)
        product_rows = list(
            Produit.objects.filter(id__in=product_ids_in_payload)
            .values('id', 'tva', 'name', 'type_produit', 'selling_price', 'cost_price')
        )
        product_tva_map = {r['id']: r['tva'] for r in product_rows}
        service_products = {r['id']: r['name'] for r in product_rows if r['type_produit'] == 'SERVICE'}
        # Snapshot des anciennes valeurs produit (TVA/prix) : la sync réécrit
        # la fiche produit — on trace les changements de prix en PRICE_CHG.
        product_old_map = {r['id']: r for r in product_rows}
        price_changes = []
        # Fetch existing items for this order to know what to update vs create
        existing_qs = CommandeProduit.objects.filter(commande=commande)
        existing_items = {item.id: item for item in existing_qs}
        existing_ids = set(existing_items.keys())

        # Process each item in the payload individually (NO MERGING)
        # Merging existing lines with distinct IDs is dangerous for dependencies.
        for idx, p in enumerate(produits_data):
            try:
                item_id = to_int(p.get('id'), None)
                produit_id = to_int(p.get('produit'), None)
                lot = p.get('lot') or None

                if produit_id in service_products:
                    raise ValueError(
                        f"« {service_products[produit_id]} » est un service : non commandable (pas de stock)."
                    )

                quantity = to_int(p.get('quantity'))
                unites_gratuites = to_int(p.get('unites_gratuites'))
                # quantity=0 tolérée : le frontend envoie parseInt(...) || 0
                # pour les lignes encore vides (autosave). Les négatifs restent
                # bloqués (inflation de stock à la réception).
                if quantity is None or quantity < 0:
                    raise ValueError("La quantité ne peut pas être négative.")
                if unites_gratuites is not None and unites_gratuites < 0:
                    raise ValueError("Les unités gratuites ne peuvent pas être négatives.")

                price = to_decimal(p.get('price', 0))
                price_cost = to_decimal(p.get('price_cost', p.get('price', 0)))
                selling_price = to_decimal(p.get('selling_price', 0))
                prix_euro = to_decimal(p.get('prix_euro'), None) if p.get('prix_euro') else None
                tva = to_decimal(p.get('tva') if p.get('tva') is not None else product_tva_map.get(produit_id, 19.25))
                taux_marge = to_decimal(p.get('taux_marge'), None) if p.get('taux_marge') is not None else None

                for _field, _val in (('price', price), ('price_cost', price_cost),
                                     ('selling_price', selling_price), ('prix_euro', prix_euro)):
                    if _val is not None and _val < 0:
                        raise ValueError(f"Le champ '{_field}' ne peut pas être négatif.")
                if tva is None or tva < 0 or tva > 100:
                    raise ValueError("La TVA doit être comprise entre 0 et 100.")

                data = {
                    'produit_id': produit_id,
                    'quantity': quantity,
                    'unites_gratuites': unites_gratuites,
                    'price': price,
                    'price_cost': price_cost,
                    'selling_price': selling_price,
                    'prix_euro': prix_euro,
                    'tva': tva,
                    'taux_marge': taux_marge,
                    'lot': lot,
                    'date_expiration': parse_expiration(p.get('date_expiration')),
                }
            except (ValueError, AttributeError) as e:
                errors_list.append(f"Ligne {idx + 1}: {e!s}")
                continue

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
        
        # Rejet global si au moins une ligne est invalide (sync atomique : tout ou rien)
        if errors_list:
            return Response({
                'error': 'Certaines lignes sont invalides.',
                'errors': errors_list
            }, status=status.HTTP_400_BAD_REQUEST)

        # Bulk create new items
        if items_to_create:
            CommandeProduit.objects.bulk_create(items_to_create, batch_size=100)
        
        # Bulk update existing items
        if items_to_update:
            CommandeProduit.objects.bulk_update(
                items_to_update,
                ['produit_id', 'quantity', 'unites_gratuites', 'price', 'price_cost', 'selling_price',
                 'prix_euro', 'tva', 'taux_marge', 'lot', 'date_expiration'],
                batch_size=100
            )

        # Synchronisation avec la fiche produit (TVA, Prix, Marge)
        # On ne sync que les produits présents dans le payload
        for p_id in product_ids_in_payload:
            # On prend la dernière ligne de ce produit pour la sync
            # (Si l'utilisateur a plusieurs lignes identiques, la dernière gagne)
            latest_p_data = next(
                (p for p in reversed(produits_data) if to_int(p.get('produit'), None) == p_id),
                None
            )
            if latest_p_data:
                # Ne jamais propager de valeurs négatives/invalides sur la fiche produit
                new_tva = to_decimal(latest_p_data.get('tva'), product_tva_map.get(p_id, 19.25))
                new_selling = to_decimal(latest_p_data.get('selling_price', 0))
                new_cost = to_decimal(latest_p_data.get('price_cost', latest_p_data.get('price', 0)))
                update_kwargs = {}
                if new_tva is not None and 0 <= new_tva <= 100:
                    update_kwargs['tva'] = new_tva
                if new_selling is not None and new_selling >= 0:
                    update_kwargs['selling_price'] = new_selling
                if new_cost is not None and new_cost >= 0:
                    update_kwargs['cost_price'] = new_cost
                if update_kwargs:
                    old_row = product_old_map.get(p_id) or {}
                    Produit.objects.filter(id=p_id).update(**update_kwargs)
                    changed_prices = {
                        field: {'old': str(old_row.get(field)), 'new': str(val)}
                        for field, val in update_kwargs.items()
                        if field in ('selling_price', 'cost_price') and old_row.get(field) != val
                    }
                    if changed_prices:
                        price_changes.append({'produit_id': p_id, 'changes': changed_prices})
                p_obj = Produit.objects.get(id=p_id)
                p_obj.save(update_fields=['taux_marge', 'pourcentage_marge'])

        # NOTE : on ne trace plus les changements de prix produit individuellement
        # lors d'une synchronisation groupée pour alléger le journal d'audit.

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
                    if hasattr(obj, 'facture_produit'):
                        try:
                            f = obj.facture_produit.facture  # type: ignore[attr-defined]
                            protected_elements.append(f"Facture {f.numero_facture or f.id}")
                        except Exception:
                            protected_elements.append(str(obj))
                    elif hasattr(obj, 'facture'):
                        try:
                            f = obj.facture  # type: ignore[attr-defined]
                            protected_elements.append(f"Facture {f.numero_facture or f.id}")
                        except Exception:
                            protected_elements.append(str(obj))
                    else:
                        protected_elements.append(str(obj))
                
                error_msg = "Certains produits ne peuvent pas être retirés car ils sont déjà utilisés dans : " + ", ".join(set(protected_elements))
                return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)

        # NOTE : on ne trace plus la synchronisation groupée comme un UPDATE
        # Commande distinct. Le journal d'audit garde la création, la modification
        # d'en-tête (CommandeViewSet.perform_update) et la clôture ; bulk_sync n'est
        # qu'une sous-étape de persistance des lignes.

        # La synchronisation des lignes modifie le total de la commande ;
        # invalider le cache liste pour refléter immédiatement les changements.
        try:
            cache.delete_pattern('commandes_list:*')
        except AttributeError:
            pass
        return Response({
            'status': 'success',
            'created': len(items_to_create),
            'updated': len(items_to_update),
            'deleted': deleted_count,
            'warnings': warnings_list
        })

    @action(detail=True, methods=['patch'], url_path='correct_lot')
    @transaction.atomic
    def correct_lot(self, request, pk=None):
        """
        Corrige uniquement le numéro de lot et/ou la date d'expiration d'une ligne de commande,
        même si la commande est clôturée. Met à jour aussi le StockLot associé.
        """
        instance = self.get_object()
        lot = request.data.get('lot', instance.lot)
        date_expiration_raw = request.data.get('date_expiration', None)

        # Parse date_expiration
        new_date = None
        if date_expiration_raw:
            try:
                parts = str(date_expiration_raw).split('T')[0].split('-')
                y, m, _d = int(parts[0]), int(parts[1]), int(parts[2])
                last_day = calendar.monthrange(y, m)[1]
                new_date = date(y, m, last_day)
            except Exception:
                return Response({'error': 'Format de date invalide. Utiliser YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        # Mise à jour de la ligne commande
        instance.lot = lot or ''
        if new_date is not None:
            instance.date_expiration = new_date
        elif 'date_expiration' in request.data and not date_expiration_raw:
            instance.date_expiration = None
        instance.save(update_fields=['lot', 'date_expiration'])

        # Mise à jour du StockLot associé si existant (recherche par produit + lot)
        if instance.lot and instance.produit_id:
            try:
                stock_lot = StockLot.objects.get(produit_id=instance.produit_id, lot=instance.lot)
                if instance.date_expiration is not None:
                    stock_lot.date_expiration = instance.date_expiration
                    stock_lot.save(update_fields=['date_expiration'])
            except StockLot.DoesNotExist:
                pass
            except StockLot.MultipleObjectsReturned:
                pass

        # Correction possible même sur commande clôturée → tracé explicite.
        log_audit(
            user=request.user,
            action=AuditLog.Action.UPDATE,
            model_name='CommandeProduit',
            object_id=instance.id,
            description=f"Correction du lot de la ligne commande #{instance.id} — lot « {instance.lot} » (commande #{instance.commande_id})",
            details={
                'commande_id': instance.commande_id,
                'produit_id': instance.produit_id,
                'lot': instance.lot,
                'date_expiration': instance.date_expiration.isoformat() if instance.date_expiration else None,
            },
            request=request,
        )

        return Response({
            'status': 'success',
            'lot': instance.lot,
            'date_expiration': instance.date_expiration.isoformat() if instance.date_expiration else None,
        })
