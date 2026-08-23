import logging
from decimal import Decimal, InvalidOperation

from django.db import DatabaseError, transaction
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from api.audit_helpers import log_audit
from api.idempotency import idempotent_action
from api.models import (
    AuditLog,
    Caisse,
    Facture,
    Produit,
    StockLot,
)
from api.services import SalesService
from api.sudo_utils import validate_sudo_mode

logger = logging.getLogger(__name__)


class FactureSalesMixin:
    """Actions de vente : finaliser, valider, annuler, modifier, marquer_payee, sync_mobile."""

    MAX_PRODUCTS_PER_INVOICE = 500

    # ------------------------------------------------------------------
    # Helpers privés pour finaliser()
    # ------------------------------------------------------------------

    def _parse_finaliser_data(self, request):
        """Extrait les données de la requête (JSON ou multipart)."""
        import json

        if 'multipart/form-data' in request.content_type:
            json_str = request.data.get('json_data')
            if json_str:
                return json.loads(json_str), request.FILES.get('image_ordonnance')
            return request.data, request.FILES.get('image_ordonnance')
        return request.data, request.FILES.get('image_ordonnance')

    def _validate_products(self, data):
        """Valide la liste des produits et calcule la somme rapide. Retourne (produits_data, temp_sum, remise_globale) ou (None, error_response, None)."""
        produits_data = data.get('produits')
        if not isinstance(produits_data, list) or not produits_data:
            return None, Response({'detail': "La liste des produits ne peut pas être vide."}, status=status.HTTP_400_BAD_REQUEST), None

        if len(produits_data) > self.MAX_PRODUCTS_PER_INVOICE:
            return None, Response(
                {'detail': f"Trop de produits dans la facture (max {self.MAX_PRODUCTS_PER_INVOICE}). Veuillez réduire le nombre de lignes."},
                status=status.HTTP_400_BAD_REQUEST
            ), None

        try:
            temp_sum = Decimal(0)
            for p in produits_data:
                q = Decimal(str(p.get('quantity', 0)))
                pr = Decimal(str(p.get('selling_price', 0)))
                rem = Decimal(str(p.get('discount', 0)))
                temp_sum += (q * pr) - rem
        except (InvalidOperation, ValueError, TypeError):
            return None, Response({'detail': "Données de produit invalides (prix ou quantité non numérique)."}, status=status.HTTP_400_BAD_REQUEST), None

        try:
            remise_globale = Decimal(str(data.get('remise', 0) or 0))
        except (InvalidOperation, ValueError):
            remise_globale = Decimal(0)

        if remise_globale > temp_sum:
            return None, Response(
                {'detail': f"La remise globale ({remise_globale} F) ne peut pas être supérieure au total des produits ({temp_sum} F)."},
                status=status.HTTP_400_BAD_REQUEST
            ), None

        return produits_data, temp_sum, remise_globale

    def _compute_required_permissions(self, data, produits_data, temp_sum, remise_globale, total_ttc, centralized, poste_vente_id):
        """Détermine les permissions Sudo requises pour la vente."""
        is_avoir_client = data.get('is_avoir_client', False)

        product_ids = [p.get('produit') for p in produits_data]
        product_prices = {
            product.id: product.selling_price
            for product in Produit.objects.filter(id__in=product_ids)
        }
        # Récupérer les prix de lots valides pour chaque produit.
        # Lors d'une allocation multi-lot automatique (FEFO), le frontend envoie
        # le selling_price du lot, qui peut différer du prix global du produit.
        # Ce n'est PAS une modification manuelle de prix → ne doit pas exiger
        # la permission can_modify_price.
        lot_prices_by_product = {}
        for lot in StockLot.objects.filter(
            produit_id__in=product_ids,
            selling_price__isnull=False,
            selling_price__gt=0,
        ).values_list('produit_id', 'selling_price'):
            lot_prices_by_product.setdefault(lot[0], set()).add(lot[1])

        requested_quantities = {}
        requires_discount = remise_globale > 0
        requires_price_override = False
        for product_data in produits_data:
            product_id = product_data.get('produit')
            quantity = int(product_data.get('quantity', 0))
            requested_quantities[product_id] = requested_quantities.get(product_id, 0) + quantity
            line_price = Decimal(str(product_data.get('selling_price', 0)))
            line_discount = Decimal(str(product_data.get('discount', 0) or 0))
            price_matches_product = line_price == product_prices.get(product_id)
            price_matches_lot = line_price in lot_prices_by_product.get(product_id, set())
            # Ne déclencher la permission que si le prix ne correspond NI au prix
            # global du produit NI à un prix de lot valide (vraie modification manuelle).
            if line_discount > 0:
                requires_discount = True
            if not price_matches_product and not price_matches_lot:
                requires_price_override = True

        products = {product.id: product for product in Produit.objects.filter(id__in=requested_quantities)}
        requires_negative_stock_sale = any(
            quantity > 0 and products.get(product_id) is not None and quantity > products[product_id].stock
            for product_id, quantity in requested_quantities.items()
        )

        required_permissions = []
        if centralized or poste_vente_id:
            required_permissions.append('can_cash_out')
        if total_ttc <= 0 and not is_avoir_client:
            required_permissions.append('can_validate_zero_amount')
        if requires_discount:
            required_permissions.append('can_do_remise')
        if requires_price_override:
            required_permissions.append('can_modify_price')
        if requires_negative_stock_sale:
            required_permissions.append('can_sell_negative_stock')

        return required_permissions

    # ------------------------------------------------------------------
    # Action principale : finaliser()
    # ------------------------------------------------------------------

    @action(detail=False, methods=['post'])
    @transaction.atomic
    @idempotent_action
    def finaliser(self, request):
        """Action ATOMIQUE pour finaliser une vente complète via SalesService."""
        data, image_file = self._parse_finaliser_data(request)

        user = request.user
        centralized = data.get('centralized_cash_register', True)
        poste_vente_id = data.get('poste_vente_id')

        # --- Validation des produits ---
        produits_data, result_or_sum, remise_globale = self._validate_products(data)
        if produits_data is None:
            return result_or_sum  # error response
        temp_sum = result_or_sum

        # --- Extraction du total TTC ---
        totals_obj = data.get('totals') if isinstance(data.get('totals'), dict) else {}
        try:
            total_ttc = Decimal(str(totals_obj.get('totalTtc', 0)))
        except (ValueError, InvalidOperation):
            total_ttc = Decimal(0)

        if total_ttc <= 0 and produits_data:
            total_ttc = temp_sum - remise_globale

        # --- Vérification du point de caisse en mode centralisé ---
        if centralized:
            from ....models import PosteVente
            if not PosteVente.objects.filter(est_actif=True, caisse__isnull=False).exists():
                return Response(
                    {'detail': "Aucun point de caisse n'est ouvert. Veuillez ouvrir un point de caisse avant de réaliser une vente."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # --- Détermination des permissions Sudo requises ---
        required_permissions = self._compute_required_permissions(
            data, produits_data, temp_sum, remise_globale, total_ttc, centralized, poste_vente_id
        )

        # --- Remise déjà validée séparément (sudo dédié au moment de la saisie) ---
        # Si le frontend fournit remise_validated_by_id, la remise a déjà été
        # validée par un autre user (user B) → on ne doit PAS re-vérifier
        # can_do_remise à la finalisation.
        remise_validation_user = None
        remise_validated_by_id = data.get('remise_validated_by_id')
        if remise_validated_by_id:
            try:
                from django.contrib.auth.models import User
                remise_validation_user = User.objects.get(id=remise_validated_by_id)
            except User.DoesNotExist:
                return Response(
                    {'detail': f"L'utilisateur validateur de remise (id={remise_validated_by_id}) est introuvable."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # La remise a déjà été validée → retirer can_do_remise
            required_permissions = [p for p in required_permissions if p != 'can_do_remise']

        # --- Modification de prix déjà validée séparément (sudo dédié au moment de la saisie) ---
        # Si le frontend fournit prix_validated_by_id, la modification de prix a déjà été
        # validée par un autre user (user B) → on ne doit PAS re-vérifier
        # can_modify_price à la finalisation.
        prix_validation_user = None
        prix_validated_by_id = data.get('prix_validated_by_id')
        if prix_validated_by_id:
            try:
                from django.contrib.auth.models import User
                prix_validation_user = User.objects.get(id=prix_validated_by_id)
            except User.DoesNotExist:
                return Response(
                    {'detail': f"L'utilisateur validateur de prix (id={prix_validated_by_id}) est introuvable."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # La modification de prix a déjà été validée → retirer can_modify_price (idempotent)
            required_permissions = [p for p in required_permissions if p != 'can_modify_price']

        validation_user = user
        if required_permissions:
            try:
                validation_user, error_res = validate_sudo_mode(
                    request,
                    permission_attr=required_permissions,
                    data_source=data
                )
                if error_res:
                    return error_res
            except (DatabaseError, InvalidOperation, TypeError, ValueError) as e:
                transaction.set_rollback(True)
                logger.error(f"[VENTE] Erreur DB lors de la validation Sudo: {e!s}", exc_info=True)
                return Response({'detail': "Erreur de base de données lors de la validation. Veuillez réessayer."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # --- Finalisation via SalesService ---
        try:
            if validation_user and 'validation_user' not in data:
                data['validation_user'] = validation_user
            if remise_validation_user:
                data['remise_validation_user'] = remise_validation_user
            if prix_validation_user:
                data['prix_validation_user'] = prix_validation_user

            facture = SalesService.finalize_sale(user, data, centralized=centralized, image_file=image_file)

            total_display = float(facture.total_ttc)
            audit_details = {
                'numero_facture': facture.numero_facture,
                'total_ttc': total_display,
                'client': str(facture.client) if facture.client else facture.client_name_override,
            }
            if remise_validation_user:
                audit_details['remise_validated_by'] = (
                    remise_validation_user.get_full_name() or remise_validation_user.username
                )
            if prix_validation_user:
                audit_details['prix_validated_by'] = (
                    prix_validation_user.get_full_name() or prix_validation_user.username
                )
            log_audit(
                user=request.user,
                action=AuditLog.Action.CREATE,
                model_name='Facture',
                object_id=facture.id,
                description=f"Création et finalisation Facture {facture.numero_facture} (Montant: {total_display:,.0f} F)",
                details=audit_details,
                request=request
            )

            serializer = self.get_serializer(facture)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except DatabaseError as e:
            transaction.set_rollback(True)
            logger.error(f"[VENTE] Erreur DB lors de la finalisation: {e!s}", exc_info=True)
            return Response({'detail': "Erreur de base de données. La transaction a été annulée."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except ValueError as e:
            transaction.set_rollback(True)
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            transaction.set_rollback(True)
            logger.error(f"[VENTE] Erreur critique finalisation: {e!s}", exc_info=True)
            return Response({'detail': "Une erreur interne est survenue lors de la finalisation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def valider(self, request, pk=None, facture=None):
        """
        Valide une facture via SalesService.
        """
        if not facture:
            facture = self.get_object()

        required_permission = 'can_validate_zero_amount' if facture.total_ttc <= 0 else 'can_validate_sales'
        validation_user, error_res = validate_sudo_mode(request, permission_attr=required_permission)
        if error_res:
            return error_res

        try:
            SalesService.validate_invoice(facture, validation_user, request.data)

            # Enregistrer le paiement si un mode est fourni
            mode_paiement = request.data.get('mode_paiement')
            if mode_paiement and facture.total_ttc > 0:
                Caisse.objects.create(
                    facture=facture,
                    mode_paiement=mode_paiement,
                    montant=facture.total_ttc,
                    statut='completee',
                    user=validation_user
                )

            # Log d'audit — une seule ligne claire
            vendeur_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
            caissier_name = f"{validation_user.first_name} {validation_user.last_name}".strip() or validation_user.username
            client_label = str(facture.client) if facture.client else (facture.client_name_override or 'Passager')
            sudo_suffix = f" · Sudo: {caissier_name}" if validation_user != request.user else ''
            log_audit(
                user=request.user,
                action=AuditLog.Action.INVOICE_VALIDATE,
                model_name='Facture',
                object_id=facture.id,
                description=f"Facture {facture.numero_facture} validée — {client_label} — {facture.total_ttc:,.0f} F · Vendeur: {vendeur_name}{sudo_suffix}",
                details={
                    'numero_facture': facture.numero_facture,
                    'total_ttc': float(facture.total_ttc),
                    'client': client_label,
                    'vendeur': vendeur_name,
                    'caissier': caissier_name,
                    'sudo_mode': validation_user != request.user,
                },
                request=request
            )

            serializer = self.get_serializer(facture)
            return Response(serializer.data)
        except ValueError as e:
            transaction.set_rollback(True)
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            transaction.set_rollback(True)
            logger.error(f"[VENTE] Erreur lors de la validation: {e!s}", exc_info=True)
            return Response({'detail': "Une erreur est survenue lors de la validation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def annuler(self, request, pk=None):
        """
        Annule une facture via SalesService.
        """
        facture = self.get_object()

        # Sudo logic in ViewSet
        validation_user, error_res = validate_sudo_mode(request, permission_attr='can_cancel_invoice')
        if error_res:
            return error_res

        motif = request.data.get('motif', '')
        try:
            success, message = SalesService.cancel_invoice(facture, validation_user, motif)

            if success:
                log_audit(
                    user=request.user,
                    action=AuditLog.Action.INVOICE_CANCEL,
                    model_name='Facture',
                    object_id=facture.id,
                    description=f"Facture {facture.numero_facture or facture.id} annulée{' - Motif: ' + motif if motif else ''}",
                    details={
                        'facture_id': facture.id,
                        'numero_facture': facture.numero_facture,
                        'montant': float(facture.total_ttc),
                        'motif': motif,
                        'cancelled_by': validation_user.username
                    },
                    request=request
                )
                return Response({'status': message})

            transaction.set_rollback(True)
            return Response({'detail': message}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            transaction.set_rollback(True)
            logger.error(f"[VENTE] Erreur lors de l'annulation: {e!s}", exc_info=True)
            return Response({'detail': "Une erreur est survenue lors de l'annulation."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def modifier(self, request, pk=None):
        """
        Modifie une facture via SalesService.
        Supports standard permissions or Sudo validation.
        """
        facture = self.get_object()

        # Permission check with Sudo support
        validation_user, error_res = validate_sudo_mode(request, permission_attr='can_modify_invoice')
        if error_res:
            return error_res

        try:
            facture, old_total, difference, old_quantities, new_quantities = SalesService.modify_sale(facture, validation_user, request.data)

            # Audit log - une seule ligne par modification de vente
            log_audit(
                user=request.user,
                action=AuditLog.Action.UPDATE,
                model_name='Facture',
                object_id=facture.id,
                description=f"Facture {facture.numero_facture or facture.id} modifiée. Ancien total: {old_total:.0f}F, Nouveau total: {facture.total_ttc:.0f}F, Différence: {difference:+.0f}F",
                details={
                    'facture_id': facture.id,
                    'numero_facture': facture.numero_facture,
                    'old_total': float(old_total),
                    'new_total': float(facture.total_ttc),
                    'difference': float(difference),
                    'old_quantities': old_quantities,
                    'new_quantities': new_quantities,
                },
                request=request
            )

            serializer = self.get_serializer(facture)
            return Response({
                'facture': serializer.data,
                'old_total': float(old_total),
                'new_total': float(facture.total_ttc),
                'difference': float(difference)
            })
        except ValueError as e:
            transaction.set_rollback(True)
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            transaction.set_rollback(True)
            logger.error(f"[VENTE] Erreur lors de la modification: {e!s}", exc_info=True)
            return Response({'detail': "Une erreur est survenue lors de la modification."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def marquer_payee(self, request, pk=None):
        """
        Marque une facture comme payée.
        """
        facture = self.get_object()
        if facture.status != Facture.Status.VALIDEE:
            return Response({'detail': 'Seules les factures validées peuvent être marquées comme payées.'}, status=status.HTTP_400_BAD_REQUEST)

        facture.status = Facture.Status.PAYEE
        facture.save(update_fields=['status'])

        return Response({'status': 'Facture marquée comme payée.'})

    @action(detail=False, methods=['post'], url_path='mobile')
    @transaction.atomic
    def sync_mobile(self, request):
        """
        Endpoint dédié à l'application mobile LAN (Store-and-Forward).
        Reçoit une facture créée hors-ligne et la finalise sur le serveur.
        """
        data = request.data
        uuid_mobile = data.get('uuid')
        client_name = data.get('client')
        items = data.get('items', [])
        total = data.get('total', 0)

        if not items:
            return Response({'detail': "La facture mobile ne contient aucun article."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Transformation du payload mobile vers le format attendu par SalesService
            produits_data = []
            for item in items:
                produits_data.append({
                    'product_id': item.get('product_id'),
                    'quantity': item.get('quantity', 1),
                    'selling_price': item.get('unit_price', 0),
                    'discount': 0
                })

            payload_vente = {
                'client_name_override': client_name,
                'produits': produits_data,
                'totals': {'totalTtc': total},
                'remise': 0,
                'centralized_cash_register': True,
                'is_mobile_sync': True, # Optionnel : flag pour statistiques futures
                'mobile_uuid': uuid_mobile
            }

            # Finalisation standard (qui gère le stock, caisse, etc.)
            facture = SalesService.finalize_sale(request.user, payload_vente, centralized=True)

            # Audit spécifique Mobile
            log_audit(
                user=request.user,
                action=AuditLog.Action.CREATE,
                model_name='Facture',
                object_id=facture.id,
                description=f"Sync Facture Mobile LAN {facture.numero_facture} (Montant: {total:,.0f} F)",
                details={'uuid_mobile': uuid_mobile},
                request=request
            )

            return Response({
                'uuid': uuid_mobile,
                'server_number': facture.numero_facture,
                'id': facture.id,
                'status': 'synced'
            }, status=status.HTTP_201_CREATED)

        except ValueError as e:
            transaction.set_rollback(True)
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            transaction.set_rollback(True)
            logger.error(f"[MOBILE SYNC] Erreur critique lors de la synchronisation: {e!s}", exc_info=True)
            return Response({'detail': "Erreur lors de la synchronisation de la facture."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
