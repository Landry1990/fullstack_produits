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
)
from api.services import SalesService
from api.sudo_utils import validate_sudo_mode

logger = logging.getLogger(__name__)


class FactureSalesMixin:
    """Actions de vente : finaliser, valider, annuler, modifier, marquer_payee, sync_mobile."""

    @action(detail=False, methods=['post'])
    @transaction.atomic
    @idempotent_action
    def finaliser(self, request):
        """
        Action ATOMIQUE pour finaliser une vente complète via SalesService.
        """
        import json

        # Determine if data came in as JSON or FormData
        if 'multipart/form-data' in request.content_type:
            # Reconstruct data from 'json_data' field if present, otherwise use request.data
            json_str = request.data.get('json_data')
            if json_str:
                data = json.loads(json_str)
            else:
                # Fallback: maybe they just sent a flat multipart
                data = request.data
        else:
            data = request.data

        user = request.user
        centralized = data.get('centralized_cash_register', True)

        image_file = request.FILES.get('image_ordonnance')

        # --- Early data validation (before Sudo check) ---
        produits_data = data.get('produits')
        if not isinstance(produits_data, list) or not produits_data:
            return Response({'detail': "La liste des produits ne peut pas être vide."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate selling_price format and compute quick sum
        try:
            temp_sum = Decimal(0)
            for p in produits_data:
                q = Decimal(str(p.get('quantity', 0)))
                pr = Decimal(str(p.get('selling_price', 0)))
                rem = Decimal(str(p.get('discount', 0)))
                temp_sum += (q * pr) - rem
        except (InvalidOperation, ValueError, TypeError):
            return Response({'detail': "Données de produit invalides (prix ou quantité non numérique)."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            remise_globale = Decimal(str(data.get('remise', 0) or 0))
        except (InvalidOperation, ValueError):
            remise_globale = Decimal(0)

        if remise_globale > temp_sum:
            return Response({'detail': f"La remise globale ({remise_globale} F) ne peut pas être supérieure au total des produits ({temp_sum} F)."}, status=status.HTTP_400_BAD_REQUEST)

        # Enforce Sudo for non-positive amounts
        # Robust total TTC extraction
        totals_obj = data.get('totals') if isinstance(data.get('totals'), dict) else {}
        try:
            total_ttc = Decimal(str(totals_obj.get('totalTtc', 0)))
        except (ValueError, InvalidOperation):
            total_ttc = Decimal(0)

        # If total is 0 but we have products, use the quick sum already computed
        if total_ttc <= 0 and produits_data:
            total_ttc = temp_sum - remise_globale

        validation_user = user
        is_avoir_client = data.get('is_avoir_client', False)
        poste_vente_id = data.get('poste_vente_id')

        # En mode caisse centrale, une caisse physique doit être ouverte avant toute vente
        if centralized:
            from ....models import PosteVente
            if not PosteVente.objects.filter(est_actif=True, caisse__isnull=False).exists():
                return Response(
                    {'detail': "Aucun point de caisse n'est ouvert. Veuillez ouvrir un point de caisse avant de réaliser une vente."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Every privileged override is authorized by the sudo validator's profile.
        product_prices = {
            product.id: product.selling_price
            for product in Produit.objects.filter(id__in=[p.get('produit') for p in produits_data])
        }
        requested_quantities = {}
        requires_price_override = remise_globale > 0
        for product_data in produits_data:
            product_id = product_data.get('produit')
            quantity = int(product_data.get('quantity', 0))
            requested_quantities[product_id] = requested_quantities.get(product_id, 0) + quantity
            line_price = Decimal(str(product_data.get('selling_price', 0)))
            line_discount = Decimal(str(product_data.get('discount', 0) or 0))
            if line_price != product_prices.get(product_id) or line_discount > 0:
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
        if requires_price_override:
            required_permissions.append('can_modify_price')
        if requires_negative_stock_sale:
            required_permissions.append('can_sell_negative_stock')

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
                # Si une erreur DB survient pendant la validation Sudo, on rollback et retourne une erreur propre
                transaction.set_rollback(True)
                logger.error(f"[VENTE] Erreur DB lors de la validation Sudo: {e!s}", exc_info=True)
                return Response({'detail': "Erreur de base de données lors de la validation. Veuillez réessayer."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            # Transfer validation user to data for SalesService
            if validation_user and 'validation_user' not in data:
                 data['validation_user'] = validation_user

            facture = SalesService.finalize_sale(user, data, centralized=centralized, image_file=image_file)

            # Log d'audit - Safe formatting for Decimal
            total_display = float(facture.total_ttc)
            log_audit(
                user=request.user,
                action=AuditLog.Action.CREATE,
                model_name='Facture',
                object_id=facture.id,
                description=f"Création et finalisation Facture {facture.numero_facture} (Montant: {total_display:,.0f} F)",
                details={
                    'numero_facture': facture.numero_facture,
                    'total_ttc': total_display,
                    'client': str(facture.client) if facture.client else facture.client_name_override,
                },
                request=request
            )

            serializer = self.get_serializer(facture)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except DatabaseError as e:
            # Gestion explicite des erreurs de base de données
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

        required_permission = 'can_validate_zero_amount' if facture.total_ttc <= 0 else None
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
