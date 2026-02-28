from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.db import transaction
from django.db.models import F, Sum, Q, Value, DecimalField, Avg, Count
from django.db.models.functions import Coalesce, TruncMonth, TruncDay
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.http import HttpResponse
from datetime import datetime, date, timedelta
from decimal import Decimal, InvalidOperation
import io
import logging

# ReportLab imports
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, Frame, PageTemplate, BaseDocTemplate

from django.contrib.auth.models import User
from ..models import (
    Facture, FactureProduit, FactureProduitAllocation, Caisse, ClotureCaisse, 
    MouvementCaisse, Produit, StockLot, LoyaltySetting, InvoiceSettings, AuditLog,
    RelevePaiement, MouvementStock, Promis, Ordonnancier, LigneOrdonnancier,
    get_next_ticket_session
)
from ..services import PromotionService
from ..serializers import (
    FactureSerializer, FactureProduitSerializer, CaisseSerializer, ClotureCaisseSerializer,
    CreanceSerializer, MouvementCaisseSerializer, FacturePrintSerializer
)
from ..serializers_optimized import FactureListSerializer, FactureDetailSerializer
from ..serializer_mixins import OptimizedSerializerMixin
from ..audit_helpers import log_audit
from ..sudo_utils import validate_sudo_mode
from ..whatsapp_service import WhatsAppService

logger = logging.getLogger(__name__)
business_logger = logging.getLogger('api.business')

def header_footer_facture(canvas, doc, company_info, facture_info, facture):
    canvas.saveState()
    styles = getSampleStyleSheet()
    
    page_width, page_height = letter
    margin = doc.leftMargin
    content_width = doc.width

    # Header
    header_data = [
        [
            Paragraph(f"<b>{company_info['name']}</b><br/>{company_info['address']}<br/>Tel: {company_info['tel']}", styles['Normal']),
            Paragraph("<b>FACTURE</b>", styles['h1'])
        ]
    ]
    header_table = Table(header_data, colWidths=[content_width / 2, content_width / 2])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    w_header, h_header = header_table.wrapOn(canvas, content_width, doc.topMargin)
    header_table.drawOn(canvas, margin, page_height - doc.topMargin - h_header)

    # Separator line after header
    canvas.line(margin, page_height - doc.topMargin - h_header - 0.1*inch, margin + content_width, page_height - doc.topMargin - h_header - 0.1*inch)

    # Info box
    info_data = [
        [
            Paragraph(f"<b>Client:</b><br/>{facture_info['client_name']}<br/>{facture_info['client_address']}<br/>Tel: {facture_info['client_phone']}", styles['Normal']),
            Paragraph(f"<b>Facture N°:</b> {facture_info['facture_id']}<br/><b>Date:</b> {facture_info['date_facture']}<br/><b>Statut:</b> {facture.get_status_display()}", styles['Normal'])
        ]
    ]
    info_table = Table(info_data, colWidths=[content_width / 2, content_width / 2])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('TOPPADDING', (0,0), (-1,-1), 12)
    ]))
    w_info, h_info = info_table.wrapOn(canvas, content_width, doc.topMargin)
    info_table.drawOn(canvas, margin, page_height - doc.topMargin - h_header - 0.1*inch - h_info - 0.1*inch)

    # Footer
    footer_texts = [
        f"Page {doc.page}",
        f"Total TTC: {facture.total_ttc} F"
    ]
    canvas.drawString(margin, 0.75 * inch, footer_texts[0])
    canvas.drawRightString(margin + content_width, 0.75 * inch, footer_texts[1])
    
    canvas.restoreState()


class FactureViewSet(OptimizedSerializerMixin, viewsets.ModelViewSet):
    """
    API endpoint for factures with optimized serializers.
    - List view: Lightweight serializer (7 fields) - excludes products and payments
    - Detail view: Complete serializer with all products and payments
    """
    # queryset = Facture.objects.select_related('client', 'ayant_droit').prefetch_related('produits', 'paiements').all().order_by('-date')
    
    def get_queryset(self):
        # Base optimization for all views: select related foreign keys
        queryset = Facture.objects.select_related('client', 'ayant_droit', 'created_by', 'validated_by').order_by('-date')
        
        # Add prefetch only for detail view where products/payments are shown
        if self.action == 'retrieve':
            queryset = queryset.prefetch_related('produits', 'paiements')
            
        return queryset
    serializer_class = FactureSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'status': ['exact', 'in'],
        'client': ['exact'],
        'date': ['gte', 'lte', 'date'],
        'numero_facture': ['exact', 'icontains'],
        'created_by': ['exact'],
        'produits__produit__name': ['icontains'],
    }
    search_fields = ['numero_facture', 'client__name', 'produits__produit__name']
    
    # Serializers optimisés
    list_serializer_class = FactureListSerializer
    detail_serializer_class = FactureDetailSerializer

    def list(self, request, *args, **kwargs):
        # Fallback pour les factures créées aujourd'hui sans ticket_session (avant la MAJ)
        # On vérifie si on est dans la vue Caisse Centrale
        status_filter = request.query_params.get('status__in', '')
        if 'BROU' in status_filter and 'VAL' in status_filter:
            today = timezone.now().date()
            # On cherche les factures d'aujourd'hui sans ticket_session
            missing_tickets = Facture.objects.filter(
                date__date=today,
                ticket_session__isnull=True,
                status__in=[Facture.Status.BROUILLON, Facture.Status.VALIDEE]
            ).order_by('date')
            
            if missing_tickets.exists():
                for f in missing_tickets:
                    f.ticket_session = get_next_ticket_session()
                    f.save(update_fields=['ticket_session'])

        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def finaliser(self, request):
        """
        Action ATOMIQUE pour finaliser une vente complète.
        Regroupe : Création Facture, Ajout Produits, Validation, Promis, Ordonnance et Paiements.
        """
        data = request.data
        user = request.user

        # 1. Extraction des données
        client_id = data.get('client')
        client_name_override = data.get('client_name_override')
        ayant_droit_id = data.get('ayant_droit')
        remise_montant = Decimal(str(data.get('remise', '0')))
        produits_data = data.get('produits', [])
        paiements_data = data.get('paiements', [])
        loyalty_data = data.get('loyalty', {})
        ordonnance_data = data.get('ordonnance')
        sudo_data = data.get('sudo', {})
        sale_type = data.get('type', 'STD')
        centralized = data.get('centralized_cash_register', True)
        coupon_numero = data.get('coupon_numero')

        if not produits_data:
            return Response({'detail': 'La liste des produits ne peut pas être vide.'}, status=status.HTTP_400_BAD_REQUEST)

        business_logger.info(
            f"[VENTE] Finalisation demandee par {user.username} | "
            f"client={client_id or 'passager'} | produits={len(produits_data)} | centralisee={centralized}"
        )

        # 2. Gestion Sudo Mode pour la validation
        validation_user = user
        if sudo_data.get('validated_by_id'):
            try:
                validator_user = User.objects.get(id=sudo_data['validated_by_id'])
                if not sudo_data.get('sudo_password'):
                    return Response({'detail': 'Mot de passe requis pour la validation par un tiers.'}, status=status.HTTP_400_BAD_REQUEST)
                if not validator_user.check_password(sudo_data['sudo_password']):
                    return Response({'detail': 'Mot de passe sudo incorrect.'}, status=status.HTTP_403_FORBIDDEN)
                validation_user = validator_user
            except User.DoesNotExist:
                return Response({'detail': 'Validateur sudo introuvable.'}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Création de la Facture
        facture = Facture.objects.create(
            client_id=client_id,
            client_name_override=client_name_override,
            ayant_droit_id=ayant_droit_id,
            remise=remise_montant,
            status=Facture.Status.BROUILLON,
            created_by=user,
            validated_by=validation_user,
            ticket_session=get_next_ticket_session() if centralized else None
        )

        # 4. Ajout des produits (OPTIMISÉ: bulk_create)
        facture_produits_to_create = []
        for p_item in produits_data:
            produit_id = p_item.get('produit')
            qty = int(p_item.get('quantity', 0))
            price = Decimal(str(p_item.get('selling_price', '0')))
            discount = Decimal(str(p_item.get('discount', '0')))
            tva_rate = Decimal(str(p_item.get('tva', '0')))
            lot_id = p_item.get('lot_id')

            facture_produits_to_create.append(FactureProduit(
                facture=facture,
                produit_id=produit_id,
                quantity=qty,
                selling_price=price,
                discount=discount,
                tva=tva_rate,
                stock_lot_id=lot_id
            ))
        
        if facture_produits_to_create:
            FactureProduit.objects.bulk_create(facture_produits_to_create)

        # Recalcul des totaux avant validation
        facture.calculate_totals(save=True)

        # 5. Application des coupons
        if coupon_numero:
            from ..models import CouponMonnaie
            try:
                coupon = CouponMonnaie.objects.get(numero=coupon_numero, status=CouponMonnaie.Status.ACTIF)
                coupon.status = CouponMonnaie.Status.UTILISE
                coupon.facture_utilisation = facture
                coupon.date_utilisation = timezone.now()
                coupon.utilise_par = user
                coupon.save()
                # On ne déduit pas le montant ici, le frontend l'a normalement déjà inclus dans 'remise' ou ajusté le paiement.
                # Mais si c'est une remise facture, on l'ajoute.
                # Selon useSaleCompletion.ts, couponsEndpoint/utiliser est appelé.
            except CouponMonnaie.DoesNotExist:
                pass

        # 6. Gestion des Promis (OPTIMISÉ: bulk_create)
        promis_to_create = []
        for p_item in produits_data:
            if p_item.get('is_promis') and p_item.get('promis_quantity', 0) > 0:
                promis_to_create.append(Promis(
                    facture=facture,
                    client_id=client_id,
                    client_name=client_name_override or '',
                    client_phone=p_item.get('promis_phone', ''),
                    produit_id=p_item['produit'],
                    quantite=p_item['promis_quantity'],
                    status=Promis.Status.EN_ATTENTE,
                    created_by=user
                ))
        if promis_to_create:
            Promis.objects.bulk_create(promis_to_create)

        # 7. Gestion de l'Ordonnancier
        if ordonnance_data:
            ord_obj = Ordonnancier.objects.create(
                patient_nom=ordonnance_data.get('patient_nom'),
                prescripteur_nom=ordonnance_data.get('prescripteur_nom'),
                facture=facture,
                enregistre_par=user
            )
            ordonnance_lignes_to_create = []
            for l_ord in ordonnance_data.get('lignes', []):
                ordonnance_lignes_to_create.append(LigneOrdonnancier(
                    ordonnancier=ord_obj,
                    produit_id=l_ord.get('produit_id'),
                    produit_nom=l_ord.get('produit_nom'),
                    quantite=l_ord.get('quantite'),
                    surveillance_category=l_ord.get('surveillance_category', 'NONE')
                ))
            if ordonnance_lignes_to_create:
                LigneOrdonnancier.objects.bulk_create(ordonnance_lignes_to_create)

        # 8. Validation (Stock + Lots + Mouvements)
        if not centralized:
            # On réutilise la logique de validation existante
            # Pour éviter les duplications massives, on peut extraire la logique ou appeler l'action en interne
            # Mais invoquer une action DRF en interne est complexe avec les contextes request.
            # Je vais copier les parties essentielles ici, car `valider` fait beaucoup de checks.
            
            # Note: Je simplifie ici en supposant que valider() sera appelée via un endpoint si pas centralized?
            # Non, l'atomicité veut qu'on fasse TOUT.
            
            # J'appelle la méthode interne qui sera refactorisée plus tard si besoin.
            # Pour l'instant, je vais exécuter la logique de valider()
            
            # Mock de request pour la fidélité
            request.data.update({
                'use_pending_discount': loyalty_data.get('use_pending_discount', False),
                'points_to_use': loyalty_data.get('points_to_use', 0),
                'paiement_immediat': sum(Decimal(str(p['montant'])) for p in paiements_data)
            })
            
            # Exécution de la validation
            self.valider(request, pk=facture.id, facture=facture)
            
            # 9. Enregistrement des paiements (si direct)
            for p_data in paiements_data:
                Caisse.objects.create(
                    facture=facture,
                    mode_paiement=p_data['mode'],
                    montant=Decimal(str(p_data['montant'])),
                    reference=p_data.get('reference'),
                    statut='completee',
                    user=user,
                    part_patient=p_data.get('part_patient'),
                    part_assurance=p_data.get('part_assurance')
                )
            
            # Refresh for status update (Caisse signals might have updated it to PAY)
            facture.refresh_from_db()
        else:
            # Mode Caisse Centralisée: On laisse en BROUILLON (ou on met en BROUILLON si c'était PROFORMA)
            # Pas de déduction de stock ici, ce sera fait à la validation en caisse.
            pass

        business_logger.info(
            f"[VENTE] Finalisation OK facture #{facture.id} ({facture.numero_facture or 'brouillon'}) | "
            f"total={facture.total_ttc} | client={request.data.get('client') or 'passager'} | user={request.user.username}"
        )
        serializer = self.get_serializer(facture)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        """
        Supprime une facture (si brouillon ou annulée).
        Logs l'action avant suppression.
        """
        instance = self.get_object()
        
        # Vérification sécurité supplémentaire (si nécessaire)
        # if instance.status not in [Facture.Status.BROUILLON, Facture.Status.ANNULEE]:
        #     return Response({'detail': 'Seules les factures brouillon ou annulées peuvent être supprimées.'}, status=status.HTTP_400_BAD_REQUEST)
        
        facture_id = instance.id
        numero = instance.numero_facture
        montant = instance.total_ttc
        client_nom = instance.client.name if instance.client else 'Passager'

        try:
            # Log avant suppression car l'objet n'existera plus
            log_audit(
                user=request.user,
                action=AuditLog.Action.INVOICE_DELETE,
                model_name='Facture',
                object_id=numero or str(facture_id),
                description=f"Suppression Facture {numero or '#' + str(facture_id)}",
                details={
                    'id': facture_id,
                    'numero': numero,
                    'amount': float(montant),
                    'client': client_nom
                },
                request=request
            )
            
            self.perform_destroy(instance)
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except ProtectedError:
            return Response({'detail': 'Impossible de supprimer cette facture car elle est liée à d\'autres éléments.'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def valider(self, request, pk=None, facture=None):
        """
        Valide une facture, met à jour le stock et alloue les lots (FIFO).
        """
        if not facture:
            facture = self.get_object()
        business_logger.info(f"[VENTE] Validation demandee facture #{facture.id} par {request.user.username}")
        if facture.status == Facture.Status.VALIDEE:
            business_logger.warning(f"[VENTE] Validation refusee #{facture.id} - deja validee")
            return Response({'detail': 'Cette facture est déjà validée.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Permettre la validation de BROUILLON ou PROFORMA (devis)
        if facture.status not in [Facture.Status.BROUILLON, Facture.Status.PROFORMA]:
            return Response({
                'detail': f'Impossible de valider une facture avec le statut {facture.get_status_display()}.'
            }, status=status.HTTP_400_BAD_REQUEST)

        validation_user = facture.validated_by or request.user

        validation_user, error_res = validate_sudo_mode(request)
        if error_res:
            return error_res
    
        # Ensure the invoice tracks who finally validated it if not already set
        if not facture.validated_by:
            facture.validated_by = validation_user
        # --- FIN MODE SUDO ---

        # Récupérer les lignes de facture
        items = FactureProduit.objects.filter(facture=facture)
        
        # Récupérer les IDs des produits concernés
        product_ids = [item.produit_id for item in items]
        
        # VERROUILLER les produits concernés pour éviter les modifications concurrentes
        # select_for_update() empêche d'autres transactions de modifier ces produits
        # jusqu'à la fin de la transaction actuelle.
        locked_products = list(Produit.objects.select_for_update().filter(id__in=product_ids))
        product_map = {p.id: p for p in locked_products}

        # 0. Vérifier le plafond de crédit pour les clients professionnels
        if facture.client and facture.client.client_type == 'PROFESSIONNEL':
            current_debt = facture.client.current_debt
            
            # Prendre en compte le paiement immédiat (si fourni dans la requête)
            paiement_immediat = request.data.get('paiement_immediat', 0)
            try:
                paiement_immediat = Decimal(str(paiement_immediat))
            except (ValueError, TypeError, DecimalException):
                paiement_immediat = Decimal('0')
                
            new_debt_increment = max(Decimal('0'), facture.total_ttc - paiement_immediat)
            plafond = facture.client.plafond
            
            if plafond > 0 and (current_debt + new_debt_increment) > plafond:
                return Response(
                    {
                        'detail': f"Le plafond de crédit du client est dépassé. "
                                  f"Dette actuelle: {current_debt}, "
                                  f"Incrément dette (TTC - Paiement): {new_debt_increment}, "
                                  f"Plafond: {plafond}. "
                                  f"Dépassement de: {(current_debt + new_debt_increment) - plafond}"
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Récupérer les quantités PROMIS associées à cette facture
        promis_map = {p.produit_id: p.quantite for p in Promis.objects.filter(facture=facture)}

        # Vérifier le stock avant validation en utilisant les instances VERROUILLÉES
        for item in items:
            produit = product_map.get(item.produit_id)
            if not produit:
                continue 
            
            try:
                # On ne vérifie que la quantité réellement livrée (Totale - Promise)
                promis_qty = promis_map.get(item.produit_id, 0)
                qty = Decimal(str(item.quantity - promis_qty))
                stock = Decimal(str(produit.stock))
            except (ValueError, TypeError, InvalidOperation):
                return Response({'detail': f'Impossible de comparer les quantités pour le produit {produit.id}.'}, status=status.HTTP_400_BAD_REQUEST)

            if qty > 0:
                can_sell_negative = validation_user.is_superuser
                if not can_sell_negative and hasattr(validation_user, 'profile'):
                    can_sell_negative = validation_user.profile.can_sell_negative_stock
                
                if stock < qty and not can_sell_negative:
                    return Response(
                        {'detail': f'Stock insuffisant pour le produit {produit.name}. Stock disponible: {stock}, Quantité demandée: {qty}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            elif qty < 0:
                can_return = validation_user.is_superuser
                if not can_return and hasattr(validation_user, 'profile'):
                    can_return = validation_user.profile.can_do_returns
                
                if not can_return:
                    return Response(
                        {'detail': 'Vous n\'avez pas la permission d\'effectuer des retours (quantités négatives).'},
                        status=status.HTTP_403_FORBIDDEN
                    )

        # --- OPTIMISATION: Pré-chargement et verrouillage global des lots ---
        lot_ids_to_lock = [item.stock_lot_id for item in items if item.stock_lot_id]
        locked_lots_dict = {l.id: l for l in StockLot.objects.select_for_update().filter(id__in=lot_ids_to_lock)} if lot_ids_to_lock else {}

        fifo_prods = [item.produit_id for item in items if item.quantity > 0 and not item.stock_lot_id]
        fifo_lots_queue = {}
        if fifo_prods:
            fifo_lots = StockLot.objects.select_for_update().filter(
                produit_id__in=fifo_prods,
                quantity_remaining__gt=0
            ).order_by(F('date_expiration').asc(nulls_last=True), 'date_reception')
            for lot in fifo_lots:
                fifo_lots_queue.setdefault(lot.produit_id, []).append(lot)

        # Collecteurs pour opérations bulk
        allocations_to_create = []
        items_to_update = []
        lots_to_update_set = set()
        prods_to_sync_from_lots = set()
        manual_stock_decrements = {} # prod_id -> total_qty

        # Mettre à jour le stock
        for item in items:
            produit = product_map.get(item.produit_id)
            lots_updated = False
            
            # 1. Gestion des lots pour les VENTES (qty > 0)
            if item.quantity > 0:
                # IMPORTANT: On déduit TOUTE la quantité (y compris le promis) 
                # car le stock doit passer en négatif immédiatement.
                qty_to_alloc = item.quantity
                
                # CAS 1: Un lot spécifique est ciblé
                if item.stock_lot_id:
                    target_lot = locked_lots_dict.get(item.stock_lot_id)
                    if not target_lot: 
                        # Fallback de sécurité (peu probable si les données sont cohérentes)
                        target_lot = StockLot.objects.select_for_update().get(id=item.stock_lot_id)
                    
                    if target_lot.quantity_remaining < qty_to_alloc:
                        return Response(
                            {
                                'detail': f'Stock insuffisant dans le lot {target_lot.lot}. '
                                          f'Stock disponible: {target_lot.quantity_remaining}, '
                                          f'Quantité demandée: {qty_to_alloc}'
                            },
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    allocations_to_create.append(FactureProduitAllocation(
                        facture_produit=item,
                        stock_lot=target_lot,
                        quantity=qty_to_alloc,
                        cost_price=target_lot.price_cost,
                        selling_price=item.selling_price
                    ))
                    target_lot.quantity_remaining -= qty_to_alloc
                    lots_to_update_set.add(target_lot)
                    
                    item.lot = target_lot.lot[:20] 
                    items_to_update.append(item)
                    lots_updated = True

                # CAS 2: Pas de lot spécifique -> FIFO/FEFO standard
                else:
                    available = fifo_lots_queue.get(produit.id, [])
                    used_lots_names = []
                    for lot in available:
                        if qty_to_alloc <= 0:
                            break
                        quantity_from_lot = min(lot.quantity_remaining, qty_to_alloc)
                        allocations_to_create.append(FactureProduitAllocation(
                            facture_produit=item,
                            stock_lot=lot,
                            quantity=quantity_from_lot,
                            cost_price=lot.price_cost,
                            selling_price=item.selling_price
                        ))
                        lot.quantity_remaining -= quantity_from_lot
                        lots_to_update_set.add(lot)
                        used_lots_names.append(lot.lot)
                        qty_to_alloc -= quantity_from_lot
                        lots_updated = True

                    if used_lots_names:
                        # Filtrer les None pour éviter TypeError: expected str instance, NoneType found
                        valid_names = [name for name in used_lots_names if name is not None]
                        item.lot = ",".join(valid_names)[:20] if valid_names else "FIFO"
                        items_to_update.append(item)
            
            # 3. Gestion des retours (qty < 0)
            elif item.quantity < 0:
                target_lot = None
                if item.stock_lot_id:
                    target_lot = locked_lots_dict.get(item.stock_lot_id)
                    if not target_lot: 
                        try:
                            target_lot = StockLot.objects.select_for_update().get(id=item.stock_lot_id)
                        except StockLot.DoesNotExist:
                            target_lot = None
                
                # Si pas de lot spécifié (ou invalide) mais gestion par lot active, on prend le dernier lot
                if not target_lot and produit.use_lot_management:
                    target_lot = StockLot.objects.filter(produit=produit).order_by('-created_at').first()
                
                if target_lot:
                    # Incrémenter le stock du lot pour un retour
                    target_lot.quantity_remaining -= item.quantity # item.quantity est négatif, donc on soustrait une valeur négative (ajout)
                    lots_to_update_set.add(target_lot)
                    
                    item.lot = (target_lot.lot or "RETOUR")[:20] 
                    items_to_update.append(item)
                    lots_updated = True
            
            # 2. Préparation du calcul du stock global
            if produit.use_lot_management and lots_updated:
                prods_to_sync_from_lots.add(produit.id)
            else:
                # Pour les produits sans lots ou retours, accumulation pour update
                manual_stock_decrements[produit.id] = manual_stock_decrements.get(produit.id, 0) + item.quantity

        # --- EXÉCUTION DES OPÉRATIONS EN MASSE (BULK) ---
        if allocations_to_create:
            FactureProduitAllocation.objects.bulk_create(allocations_to_create)
        
        if items_to_update:
            FactureProduit.objects.bulk_update(items_to_update, ['lot'])

        if lots_to_update_set:
            StockLot.objects.bulk_update(list(lots_to_update_set), ['quantity_remaining'])
        
        if manual_stock_decrements:
            for pid, qty in manual_stock_decrements.items():
                Produit.objects.filter(id=pid).update(stock=F('stock') - qty)

        if prods_to_sync_from_lots:
            # Synchronisation massive du stock depuis la somme des lots
            from django.db.models import Subquery, OuterRef
            total_lots_sum = StockLot.objects.filter(
                produit=OuterRef('pk')
            ).order_by().values('produit').annotate(
                total=Sum('quantity_remaining')
            ).values('total')
            
            Produit.objects.filter(id__in=prods_to_sync_from_lots).update(
                stock=Coalesce(Subquery(total_lots_sum), Value(0))
            )

        # --- CRÉATION DES MOUVEMENTS DE STOCK (TRACEABILITÉ) ---
        # On refait une passe pour créer les mouvements avec le stock à jour
        # Nécessaire pour avoir le stock_apres correct et enregistrer le vendeur
        mouvements_to_create = []
        
        # Re-fetch updated products to get accurate stock levels
        updated_products = Produit.objects.filter(id__in=product_ids)
        product_stock_map = {p.id: p.stock for p in updated_products}
        
        for item in items:
            if item.quantity == 0:
                continue

            current_stock = product_stock_map.get(item.produit_id)
            
            # Description avec infos utiles
            is_return = item.quantity < 0
            prefix = "Retour" if is_return else "Vente"
            desc = f"{prefix} Facture #{facture.numero_facture or facture.id}"
            if facture.client or facture.client_name_override:
                client_name = facture.client.name if facture.client else facture.client_name_override
                desc += f" - Client: {client_name}"
            
            mouvements_to_create.append(MouvementStock(
                produit_id=item.produit_id,
                type_mouvement=MouvementStock.TypeMouvement.RETOUR if is_return else MouvementStock.TypeMouvement.SORTIE,
                quantite=-item.quantity, # Sortie = négatif, Retour = positif (- * -)
                stock_apres=current_stock,
                user=validation_user, # Le vendeur / validateur
                facture=facture, # Lien vers la facture
                description=desc,
                date=timezone.now()
            ))
            
        if mouvements_to_create:
            MouvementStock.objects.bulk_create(mouvements_to_create)

        # --- GESTION FIDELITE ---
        if facture.client and facture.client.client_type != 'PROFESSIONNEL' and facture.client.is_loyalty_member:
            loyalty_conf = LoyaltySetting.objects.first()
            if loyalty_conf:
                client = facture.client
                client._skip_audit = True
                save_client = False
                
                use_pending = request.data.get('use_pending_discount', False)
                if str(use_pending).lower() == 'true':
                    use_pending = True
                
                if use_pending and client.pending_discount > 0:
                    client.pending_discount = 0
                    save_client = True
                    
                try:
                    points_to_use = int(request.data.get('points_to_use', 0))
                except (ValueError, TypeError):
                    points_to_use = 0
                    
                if points_to_use > 0:
                    if client.points_fidelite >= points_to_use:
                        client.points_fidelite -= points_to_use
                        facture.points_fidelite_utilises = points_to_use
                        valeur_monetaire = points_to_use * loyalty_conf.point_value
                        facture.montant_fidelite = valeur_monetaire
                        save_client = True

                montant_base = facture.total_ttc
                if montant_base > 0 and loyalty_conf.amount_per_point > 0:
                    points_gagnes = int(montant_base // loyalty_conf.amount_per_point)
                    facture.points_fidelite_gagnes = points_gagnes
                    client.points_fidelite += points_gagnes
                    save_client = True
                
                if loyalty_conf.auto_reward_threshold > 0:
                    if client.points_fidelite >= loyalty_conf.auto_reward_threshold:
                        client.points_fidelite -= loyalty_conf.auto_reward_threshold
                        if loyalty_conf.auto_reward_percent > client.pending_discount:
                            client.pending_discount = loyalty_conf.auto_reward_percent
                        save_client = True
                
                if save_client:
                    client.save()

        # Preserve created_by if it exists, otherwise set it to current user or validator
        if not facture.created_by:
            facture.created_by = validation_user

        facture.status = Facture.Status.VALIDEE
        facture._skip_audit = True
        if not facture.numero_facture:
            facture.numero_facture = f"FAC-{facture.id:06d}"
        facture.save(update_fields=['status', 'numero_facture', 'created_by', 'validated_by'])
        
        today = date.today()
        Produit.objects.filter(id__in=product_ids).update(dernier_vente=today)
        
        # Apply promotions before calculating totals
        PromotionService.apply_promotions_to_invoice(facture)

        facture.calculate_totals(save=True)

        # Gestion automatique des créances pour clients professionnels
        if facture.client and facture.client.client_type == 'PROFESSIONNEL':
            if facture.part_client is not None:
                part_assurance = facture.total_ttc - Decimal(str(facture.part_client))
                if part_assurance > 0:
                    Caisse.objects.create(
                        facture=facture,
                        mode_paiement='en_compte',
                        montant=part_assurance,
                        statut='completee',
                        user=validation_user,
                        part_assurance=part_assurance,
                        part_patient=Decimal('0.00')
                    )
        
        # Create payment record for regular sales if mode_paiement is provided
        mode_paiement = request.data.get('mode_paiement')
        if mode_paiement and facture.total_ttc > 0:
            # Check if a payment was already created (e.g., for professional clients)
            existing_payment = Caisse.objects.filter(facture=facture).exists()
            if not existing_payment:
                Caisse.objects.create(
                    facture=facture,
                    mode_paiement=mode_paiement,
                    montant=facture.total_ttc,
                    statut='completee',
                    user=validation_user
                )

        business_logger.info(
            f"[VENTE] Validation OK #{facture.id} ({facture.numero_facture}) | "
            f"total={facture.total_ttc} | produits={items.count()} | validee_par={validation_user.username}"
        )

        # Log d'audit explicite (remplace les multiples logs automatiques supprimés par _skip_audit)
        log_audit(
            user=request.user,
            action=AuditLog.Action.INVOICE_VALIDATE,
            model_name='Facture',
            object_id=facture.id,
            description=f"Validation Facture {facture.numero_facture} (Montant: {facture.total_ttc:,.0f} F)",
            details={
                'numero_facture': facture.numero_facture,
                'total_ttc': float(facture.total_ttc),
                'client': str(facture.client) if facture.client else facture.client_name_override,
                'validated_by': validation_user.username,
                'sudo_mode': validation_user != request.user
            },
            request=request
        )

        facture.refresh_from_db()
        serializer = self.get_serializer(facture)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def annuler(self, request, pk=None):
        """
        Annule une facture et restaure le stock.
        """
        facture = self.get_object()
        business_logger.info(f"[VENTE] Annulation demandee facture #{facture.id} par {request.user.username}")
        if facture.status == Facture.Status.ANNULEE:
            business_logger.warning(f"[VENTE] Annulation refusee #{facture.id} - deja annulee")
            return Response({'detail': 'Cette facture est déjà annulée.'}, status=status.HTTP_400_BAD_REQUEST)

        motif = request.data.get('motif', '')

        validation_user, error_res = validate_sudo_mode(request, permission_attr='can_cancel_invoice')
        if error_res:
            return error_res
    
        facture.cancelled_by = validation_user
        # --- FIN MODE SUDO ---

        was_validated = facture.status in [Facture.Status.VALIDEE, Facture.Status.PAYEE]
        
        if was_validated:
            # 1. Restaurer le stock des lots (Quantité remaining)
            allocations = FactureProduitAllocation.objects.filter(
                facture_produit__facture=facture
            ).select_related('stock_lot')
            
            for alloc in allocations:
                if alloc.stock_lot:
                    StockLot.objects.filter(pk=alloc.stock_lot.pk).update(
                        quantity_remaining=F('quantity_remaining') + alloc.quantity
                    )

            # 2. Restaurer le stock global et créer MouvementStock
            items = FactureProduit.objects.filter(facture=facture).select_related('produit')
            
            mouvements_to_create = []
            
            for item in items:
                # Update Stock
                Produit.objects.filter(pk=item.produit_id).update(stock=F('stock') + item.quantity)
                
                # Prepare trace
                mouvements_to_create.append(MouvementStock(
                    produit=item.produit,
                    type_mouvement=MouvementStock.TypeMouvement.RETOUR,
                    quantite=item.quantity, # Positive because product comes BACK to stock
                    stock_apres=item.produit.stock + item.quantity, # Approximation (concurrency safe enough for history)
                    description=f"Annulation Facture #{facture.numero_facture or facture.id}",
                    user=validation_user,
                    facture=facture
                ))
            
            # Bulk create movements for performance
            MouvementStock.objects.bulk_create(mouvements_to_create)

            # 3. Supprimer les allocations
            allocations.delete()

        facture.date_annulation = timezone.now()
        facture.status = Facture.Status.ANNULEE
        
        if motif:
            current_notes = facture.notes or ""
            timestamp = facture.date_annulation.strftime('%d/%m/%Y %H:%M')
            facture.notes = f"{current_notes}\n[Annulation le {timestamp}] Motif: {motif}".strip()
            
        facture.save(update_fields=['status', 'notes', 'date_annulation', 'cancelled_by'])

        numero = facture.numero_facture or f"#{facture.id}"
        log_audit(
            user=request.user, # Audit log keeps the actual request user, but details can mention sudo
            action=AuditLog.Action.INVOICE_CANCEL,
            model_name='Facture',
            object_id=facture.id,
            description=f"Facture {numero} annulée (Montant: {facture.total_ttc:.0f}F){' - Motif: ' + motif if motif else ''}",
            details={
                'facture_id': facture.id,
                'numero_facture': numero,
                'montant': float(facture.total_ttc),
                'motif': motif,
                'client': facture.client.name if facture.client else None,
                'cancelled_by': validation_user.username
            },
            request=request
        )

        return Response({'status': 'Facture annulée avec succès. Stock restauré.'})

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def modifier(self, request, pk=None):
        """
        Modifie une facture validée/payée et ajuste les paiements par différence.
        """
        facture = self.get_object()
        
        if facture.status not in [Facture.Status.VALIDEE, Facture.Status.PAYEE]:
            return Response(
                {'detail': 'Seules les factures validées ou payées peuvent être modifiées.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        old_total = facture.total_ttc
        
        new_products = request.data.get('produits', [])
        new_remise = request.data.get('remise', '0')
        new_client = request.data.get('client', facture.client_id)
        new_client_name_override = request.data.get('client_name_override', facture.client_name_override)
        
        if not new_products:
            return Response(
                {'detail': 'La liste des produits est requise.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 1. Restore stock from old products
        # A. Restore Lots
        allocations = FactureProduitAllocation.objects.filter(
            facture_produit__facture=facture
        ).select_related('stock_lot')
        
        for alloc in allocations:
            if alloc.stock_lot:
                StockLot.objects.filter(pk=alloc.stock_lot.pk).update(
                    quantity_remaining=F('quantity_remaining') + alloc.quantity
                )
        
        # B. Delete allocations
        allocations.delete()
        
        old_items = FactureProduit.objects.filter(facture=facture)
        for item in old_items:
            Produit.objects.filter(pk=item.produit_id).update(stock=F('stock') + item.quantity)
        old_items.delete()
        
        # 2. Create new FactureProduit items
        for prod_data in new_products:
            produit_id = prod_data.get('produit')
            quantity = int(prod_data.get('quantity', 1))
            selling_price = prod_data.get('selling_price', '0')
            discount = Decimal(str(prod_data.get('discount', '0')))
            tva_rate = Decimal(str(prod_data.get('tva', '0')))
            lot_id = prod_data.get('lot_id')
            
            fp = FactureProduit.objects.create(
                facture=facture,
                produit_id=produit_id,
                quantity=quantity,
                selling_price=selling_price,
                discount=discount,
                tva=tva_rate,
                stock_lot_id=lot_id if lot_id else None
            )
            
            # 3. Deduct stock from Produit
            Produit.objects.filter(pk=produit_id).update(stock=F('stock') - quantity)
            
            # 4. Allocate lots (FIFO/FEFO)
            if quantity > 0:
                produit = Produit.objects.get(pk=produit_id)
                quantity_to_allocate = quantity
                
                if lot_id:
                    target_lot = StockLot.objects.select_for_update().get(id=lot_id)
                    FactureProduitAllocation.objects.create(
                        facture_produit=fp,
                        stock_lot=target_lot,
                        quantity=quantity_to_allocate,
                        cost_price=target_lot.price_cost,
                        selling_price=selling_price
                    )
                    target_lot.quantity_remaining -= quantity_to_allocate
                    target_lot.save()
                else:
                    available_lots = StockLot.objects.select_for_update().filter(
                        produit=produit,
                        quantity_remaining__gt=0
                    ).order_by(F('date_expiration').asc(nulls_last=True), 'date_reception')
                    
                    for lot in available_lots:
                        if quantity_to_allocate <= 0:
                            break
                        quantity_from_lot = min(lot.quantity_remaining, quantity_to_allocate)
                        FactureProduitAllocation.objects.create(
                            facture_produit=fp,
                            stock_lot=lot,
                            quantity=quantity_from_lot,
                            cost_price=lot.price_cost,
                            selling_price=selling_price
                        )
                        lot.quantity_remaining -= quantity_from_lot
                        lot.save()
                        quantity_to_allocate -= quantity_from_lot
        
        # 5. Update invoice fields
        facture.remise = Decimal(str(new_remise))
        if new_client:
            facture.client_id = new_client
        facture.client_name_override = new_client_name_override
        facture.save()
        
        # 6. Recalculate totals
        # 6. Recalculate totals
        PromotionService.apply_promotions_to_invoice(facture)
        facture.calculate_totals(save=True)
        facture.refresh_from_db()
        new_total = facture.total_ttc
        
        # 7. Create adjustment payment if difference
        difference = new_total - old_total
        adjustment_created = False
        
        if difference != 0:
            Caisse.objects.create(
                facture=facture,
                mode_paiement='especes',
                montant=difference,
                statut='completee',
                user=request.user,
                reference=f"Ajustement modification facture {facture.numero_facture or facture.id}"
            )
            adjustment_created = True
        
        # 8. Audit log
        numero = facture.numero_facture or f"#{facture.id}"
        log_audit(
            user=request.user,
            action=AuditLog.Action.UPDATE,
            model_name='Facture',
            object_id=facture.id,
            description=f"Facture {numero} modifiée. Ancien total: {old_total:.0f}F, Nouveau total: {new_total:.0f}F, Différence: {difference:+.0f}F",
            details={
                'facture_id': facture.id,
                'numero_facture': numero,
                'old_total': float(old_total),
                'new_total': float(new_total),
                'difference': float(difference),
                'adjustment_created': adjustment_created,
                'products_count': len(new_products)
            },
            request=request
        )
        
        serializer = self.get_serializer(facture)
        return Response({
            'facture': serializer.data,
            'old_total': float(old_total),
            'new_total': float(new_total),
            'difference': float(difference),
            'adjustment_created': adjustment_created
        })

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_delete(self, request):
        """
        Supprime plusieurs factures (brouillons ou annulées) via leur ID.
        Payload: { "ids": [1, 2, 3] }
        """
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'detail': 'Aucun ID fourni.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Filtrer les factures supprimables (Brouillon ou Annulée)
        factures_to_delete = Facture.objects.filter(
            id__in=ids, 
            status__in=[Facture.Status.BROUILLON, Facture.Status.ANNULEE]
        )
        
        count = factures_to_delete.count()
        deleted_ids = list(factures_to_delete.values_list('id', flat=True))
        
        if count == 0:
             return Response({'detail': 'Aucune facture supprimable trouvée (doit être BROUILLON ou ANNULEE).'}, status=status.HTTP_400_BAD_REQUEST)

        # Audit Log
        log_audit(
            user=request.user,
            action=AuditLog.Action.INVOICE_DELETE,
            model_name='Facture',
            object_id='BULK',
            description=f"Suppression de {count} facture(s)",
            details={'ids': deleted_ids},
            request=request
        )

        factures_to_delete.delete()
        
        return Response({
            'detail': f'{count} facture(s) supprimée(s).',
            'deleted_ids': deleted_ids
        })

    @action(detail=False, methods=['delete'], permission_classes=[IsAdminUser])
    @transaction.atomic
    def supprimer_brouillons(self, request):
        """
        Supprime toutes les factures en statut brouillon.
        """
        brouillons = Facture.objects.filter(status=Facture.Status.BROUILLON)
        count = brouillons.count()
        brouillons.delete()
        
        return Response({
            'detail': f'{count} facture(s) brouillon supprimée(s) avec succès.',
            'count': count
        }, status=status.HTTP_200_OK)


    @action(detail=False, methods=['get'])
    def stats_jour(self, request):
        """
        Retourne les statistiques de vente du jour (Top Vendeur, Top Produit).
        """
        today = timezone.now().date()
        
        # 1. Top Vendeur (Chiffre d'Affaires)
        top_vendeur = Facture.objects.filter(
            date__date=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).values('created_by__username', 'created_by__first_name', 'created_by__last_name').annotate(
            total_vente=Sum('total_ttc'),
            count=Count('id')
        ).order_by('-total_vente').first()
        
        vendeur_data = None
        if top_vendeur:
            name = f"{top_vendeur['created_by__first_name']} {top_vendeur['created_by__last_name']}".strip()
            if not name:
                name = top_vendeur['created_by__username']
            vendeur_data = {
                'name': name,
                'amount': top_vendeur['total_vente'],
                'count': top_vendeur['count']
            }

        # 2. Top Produit (Quantité vendue)
        # Note: On regarde les FactureProduit des factures valides du jour
        top_produit = FactureProduit.objects.filter(
            facture__date__date=today,
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).values('produit__name').annotate(
            total_qty=Sum('quantity')
        ).order_by('-total_qty').first()
        
        produit_data = None
        if top_produit:
            produit_data = {
                'name': top_produit['produit__name'],
                'quantity': top_produit['total_qty']
            }

        return Response({
            'top_vendeur': vendeur_data,
            'top_produit': produit_data
        })

    def _generate_pdf(self, facture, settings, is_proforma=False):
        """Helper to generate PDF buffer for a invoice."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
        story = []
        styles = getSampleStyleSheet()
        
        style_company = ParagraphStyle('Company', parent=styles['Heading2'], fontSize=16, spaceAfter=6, textColor=HexColor(settings.primary_color))
        style_normal = styles['Normal']
        style_title = ParagraphStyle('Title', parent=styles['Heading3'], fontSize=12, alignment=1)
        style_right = ParagraphStyle('Right', parent=styles['Normal'], alignment=2)
        style_center = ParagraphStyle('Center', parent=styles['Normal'], alignment=1)
        style_left = ParagraphStyle('Left', parent=styles['Normal'], alignment=0)

        company_address_fmt = settings.company_address.replace('\n', '<br/>')
        
        company_block = [
            Paragraph(f"<b>{settings.company_name}</b>", style_company),
            Paragraph(company_address_fmt, style_normal)
        ]
        
        invoice_date = (facture.date_document or facture.date).strftime('%d/%m/%Y à %H:%M')
        client_name = facture.client_name_override or (facture.client.name if facture.client else "Client de passage")
        
        invoice_details_text = f"""
        <b>N° Facture: {facture.numero_facture or facture.id}</b><br/>
        Date: {invoice_date}<br/>
        Client: {client_name}
        """
        if facture.client and facture.client.phone:
            invoice_details_text += f"<br/>Tel: {facture.client.phone}"
            
        doc_title = "FACTURE"
        if is_proforma:
            doc_title = "PROFORMA"
            if not facture.numero_facture:
                facture.numero_facture = f"PROFORMA-{facture.id}"

        layout = settings.header_layout
        
        style_doc_title = ParagraphStyle(
            'DocTitle', 
            parent=styles['Heading1'], 
            fontSize=24, 
            alignment=2 if layout in ['split', 'right'] else (0 if layout == 'left' else 1),
            textColor=HexColor(settings.primary_color),
            spaceAfter=12
        )
        
        doc_title_flowable = Paragraph(f"<b>{doc_title}</b>", style_doc_title)
        
        if layout == 'split':
            invoice_block = [
                doc_title_flowable,
                Paragraph(invoice_details_text, style_right)
            ]
            header_data = [[company_block, invoice_block]]
            header_table = Table(header_data, colWidths=[9*cm, 8*cm])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ]))
            story.append(header_table)
            
        elif layout == 'left':
            story.extend(company_block)
            story.append(Spacer(1, 0.5*cm))
            story.append(doc_title_flowable)
            story.append(Paragraph(invoice_details_text, style_left))
            
        elif layout == 'center':
            style_company_center = ParagraphStyle('CompanyCenter', parent=style_company, alignment=1)
            story.append(Paragraph(f"<b>{settings.company_name}</b>", style_company_center))
            story.append(Paragraph(company_address_fmt, style_center))
            story.append(Spacer(1, 0.5*cm))
            story.append(doc_title_flowable)
            story.append(Paragraph(invoice_details_text, style_center))
            
        elif layout == 'right':
            style_company_right = ParagraphStyle('CompanyRight', parent=style_company, alignment=2)
            style_normal_right = ParagraphStyle('NormalRight', parent=style_normal, alignment=2)
            story.append(Paragraph(f"<b>{settings.company_name}</b>", style_company_right))
            story.append(Paragraph(company_address_fmt, style_normal_right))
            story.append(Spacer(1, 0.5*cm))
            story.append(doc_title_flowable)
            story.append(Paragraph(invoice_details_text, style_right))

        story.append(Spacer(1, 1.0*cm))
        
        table_header = [
            Paragraph('<b>Désignation</b>', style_normal),
            Paragraph('<b>Qté</b>', style_center),
            Paragraph('<b>P.U</b>', style_right),
            Paragraph('<b>Total</b>', style_right)
        ]
        data = [table_header]
        
        for item in facture.produits.all():
            total_line = item.quantity * item.selling_price
            row = [
                Paragraph(item.produit.name, style_normal),
                Paragraph(str(item.quantity), style_center),
                Paragraph(f"{item.selling_price:,.0f}", style_right),
                Paragraph(f"{total_line:,.0f}", style_right)
            ]
            data.append(row)
            
        table = Table(data, colWidths=[9*cm, 2.5*cm, 2.5*cm, 3*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HexColor(settings.primary_color)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(table)
        story.append(Spacer(1, 1*cm))
        
        totals_data = [
            ['Sous-total :', f"{facture.total_ht:,.0f} F"],
            ['TVA :', f"{facture.total_tva:,.0f} F"],
            ['Remise :', f"{facture.remise:,.0f} F"],
            ['TOTAL À PAYER :', f"{facture.total_ttc:,.0f} F"]
        ]
        
        totals_table = Table(totals_data, colWidths=[4*cm, 4*cm])
        totals_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
            ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
            ('LINEABOVE', (0,-1), (-1,-1), 1, colors.black),
        ]))
        story.append(totals_table)
        
        doc.build(story, onFirstPage=lambda c, d: header_footer_facture(c, d, {
            'name': settings.company_name,
            'address': company_address_fmt.replace('<br/>', '\n'),
            'tel': 'N/A'
        }, {
            'facture_id': facture.numero_facture or f"#{facture.id}",
            'date_facture': invoice_date,
            'client_name': client_name,
            'client_address': facture.client.address if facture.client and facture.client.address else "",
            'client_phone': facture.client.phone if facture.client and facture.client.phone else ""
        }, facture))
        
        buffer.seek(0)
        return buffer

    @action(detail=True, methods=['get'])
    def imprimer_facture(self, request, pk=None):
        """
        Génère un PDF pour la facture.
        """
        facture = self.get_object()
        settings, _ = InvoiceSettings.objects.get_or_create(pk=1)
        is_proforma = request.query_params.get('type') == 'proforma' or facture.status == Facture.Status.PROFORMA
        
        buffer = self._generate_pdf(facture, settings, is_proforma)
        
        response = HttpResponse(content_type='application/pdf')
        filename = f"facture_{facture.numero_facture or facture.id}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response.write(buffer.getvalue())
        return response

    @action(detail=True, methods=['post'])
    def send_whatsapp(self, request, pk=None):
        """
        Envoie la facture par WhatsApp.
        """
        facture = self.get_object()
        client = facture.client
        
        recipient_number = request.data.get('phone') or (client.phone if client else None)
        
        if not recipient_number:
            return Response({'detail': 'Aucun numéro de téléphone destinataire fourni.'}, status=status.HTTP_400_BAD_REQUEST)
            
        settings, _ = InvoiceSettings.objects.get_or_create(pk=1)
        
        # Check if enabled
        pharmacy_settings = PharmacySettings.objects.first()
        if not pharmacy_settings or not pharmacy_settings.whatsapp_enabled:
            return Response({'detail': 'L\'intégration WhatsApp n\'est pas activée dans les paramètres.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            buffer = self._generate_pdf(facture, settings)
            success, message = WhatsAppService.send_invoice_pdf(
                facture, recipient_number, buffer, client.name if client else "Client"
            )
            
            log_audit(
                request.user, 
                AuditLog.Action.AUTRE, 
                'Facture', 
                facture.id, 
                f"Envoi facture {facture.numero_facture} via WhatsApp à {recipient_number}",
                request=request
            )
            
            if success:
                return Response({'detail': message})
            return Response({'detail': message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        except Exception as e:
            logger.error(f"Erreur envoi WhatsApp: {str(e)}")
            return Response({'detail': f"Erreur lors de l'envoi : {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def print_data(self, request, pk=None):
        """
        Retourne les données complètes pour l'impression frontend.
        """
        facture = self.get_object()
        serializer = FacturePrintSerializer(facture)
        return Response(serializer.data)

        
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def caisse_par_tranche_horaire(self, request):
        """
        Calcule la caisse pour une tranche horaire spécifique.
        """
        date_debut_str = request.query_params.get('date_debut', None)
        date_fin_str = request.query_params.get('date_fin', None)
        
        try:
            if date_debut_str:
                try:
                    start_datetime = datetime.strptime(date_debut_str, '%Y-%m-%dT%H:%M')
                except ValueError:
                    try:
                        start_datetime = datetime.strptime(date_debut_str, '%Y-%m-%dT%H:%M:%S')
                    except ValueError:
                        return Response({'detail': f'Format invalide pour date_debut'}, status=status.HTTP_400_BAD_REQUEST)
                start_datetime = timezone.make_aware(start_datetime)
            else:
                return Response({'detail': 'date_debut requis.'}, status=status.HTTP_400_BAD_REQUEST)
            
            if date_fin_str:
                try:
                    end_datetime = datetime.strptime(date_fin_str, '%Y-%m-%dT%H:%M')
                except ValueError:
                    try:
                        end_datetime = datetime.strptime(date_fin_str, '%Y-%m-%dT%H:%M:%S')
                    except ValueError:
                        return Response({'detail': f'Format invalide pour date_fin'}, status=status.HTTP_400_BAD_REQUEST)
                end_datetime = timezone.make_aware(end_datetime)
            else:
                return Response({'detail': 'date_fin requis.'}, status=status.HTTP_400_BAD_REQUEST)
            
            if start_datetime >= end_datetime:
                return Response({'detail': "La date de début doit être antérieure à la date de fin."}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as e:
            return Response({'detail': f'Erreur date: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        
        factures = Facture.objects.filter(
            date__gte=start_datetime,
            date__lte=end_datetime,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).prefetch_related('produits', 'produits__produit')
        
        total_ttc = Decimal('0.00')
        total_ht = Decimal('0.00')
        total_ht_apres_remise = Decimal('0.00')
        total_tva = Decimal('0.00')
        total_remise = Decimal('0.00')
        nombre_factures = factures.count()
        
        for facture in factures:
            try:
                facture_sous_total_ht = Decimal(str(facture.total_ht))
                facture_remise = Decimal(str(facture.remise))
                facture_total_tva = Decimal(str(facture.total_tva))
                facture_total_ttc = Decimal(str(facture.total_ttc))
                
                facture_total_ht_apres_remise = facture_sous_total_ht - facture_remise
                
                total_ht += facture_sous_total_ht
                total_remise += facture_remise
                total_ht_apres_remise += facture_total_ht_apres_remise
                total_tva += facture_total_tva
                total_ttc += facture_total_ttc
                
            except (ValueError, TypeError, AttributeError):
                pass
        
        total_ht_final = total_ht_apres_remise
        
        response_data = {
            'date_debut': start_datetime.strftime('%Y-%m-%d %H:%M'),
            'date_fin': end_datetime.strftime('%Y-%m-%d %H:%M'),
            'tranche': f"{start_datetime.strftime('%d-%m-%Y %Hh%M')} - {end_datetime.strftime('%d-%m-%Y %Hh%M')}",
            'nombre_factures': nombre_factures,
            'total_ht': str(total_ht_final.quantize(Decimal('0.01'))),
            'total_tva': str(total_tva.quantize(Decimal('0.01'))),
            'total_ttc': str(total_ttc.quantize(Decimal('0.01'))),
            'sous_total_ht': str(total_ht.quantize(Decimal('0.01'))),
            'total_remise': str(total_remise.quantize(Decimal('0.01')))
        }
        return Response(response_data, status=status.HTTP_200_OK)

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

class FactureProduitViewSet(viewsets.ModelViewSet):
    """API endpoint for facture produits."""
    queryset = FactureProduit.objects.select_related('produit', 'facture', 'stock_lot').order_by('-created_at')
    serializer_class = FactureProduitSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['produit', 'facture']
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def envoi_rappel_renouvellement(self, request, pk=None):
        """
        Déclenche l'envoi d'un rappel de renouvellement WhatsApp.
        """
        line = self.get_object()
        if not line.produit or not line.produit.is_chronic:
            return Response({'detail': 'Ce produit n\'est pas marqué comme traitement chronique.'}, status=status.HTTP_400_BAD_REQUEST)
        
        success, message = WhatsAppService.send_renewal_reminder(line)
        if success:
            log_audit(
                user=request.user,
                action=AuditLog.Action.OTHER,
                model_name='FactureProduit',
                object_id=line.id,
                description=f"Rappel renouvellement envoyé pour {line.produit.name}",
                details={'facture': line.facture.id, 'client': line.facture.client_id},
                request=request
            )
            return Response({'detail': message})
        return Response({'detail': message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CaisseViewSet(viewsets.ModelViewSet):
    """API endpoint for caisse (paiements)."""
    queryset = Caisse.objects.select_related(
        'facture', 'facture__client', 'user', 
        'facture__created_by', 'facture__validated_by'
    ).order_by('-date_paiement')
    serializer_class = CaisseSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['facture', 'mode_paiement', 'statut', 'user']
    permission_classes = [IsAuthenticated]
    
    def perform_create(self, serializer):
        validation_user, error_res = validate_sudo_mode(self.request)
        # On ne bloque pas si erreur ici car perform_create est déjà appelé
        user = validation_user if not error_res else self.request.user
        
        # SÉCURITÉ : Plafonner le montant au reste à payer réel (part patient)
        facture = serializer.validated_data.get('facture')
        mode = serializer.validated_data.get('mode_paiement')
        
        if facture and mode != 'en_compte' and mode != 'recouvrement':
            montant_saisi = serializer.validated_data.get('montant')
            # Déjà payé physiquement
            deja_paye = Caisse.objects.filter(
                facture=facture, 
                statut='completee'
            ).exclude(
                mode_paiement__in=['en_compte', 'recouvrement']
            ).aggregate(Sum('montant'))['montant__sum'] or Decimal('0')
            
            # Montant dû (part client si tiers payant, sinon total TTC)
            montant_du = facture.part_client if (facture.part_client is not None and facture.part_client >= 0) else facture.total_ttc
            
            if montant_du >= 0:
                reste = max(Decimal('0'), montant_du - deja_paye)
                if montant_saisi > reste:
                    serializer.validated_data['montant'] = reste
            else:
                reste = min(Decimal('0'), montant_du - deja_paye)
                if montant_saisi < reste:
                    serializer.validated_data['montant'] = reste

        serializer.save(user=user)
        
        # Mise à jour du statut de la facture si tout est payé
        instance = serializer.instance
        if instance.facture:
            facture = instance.facture
            total_paye = Caisse.objects.filter(facture=facture, statut='completee').aggregate(Sum('montant'))['montant__sum'] or Decimal('0')
            
            # Utiliser une petite marge pour les arrondis
            if total_paye >= (facture.total_ttc - Decimal('0.1')):
                 if facture.status != Facture.Status.PAYEE:
                     facture.status = Facture.Status.PAYEE
                     facture.save()

    @action(detail=False, methods=['get'], url_path='get_totals')
    def get_totals(self, request):
        """
        Retourne les totaux.
        """
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        user_id = request.query_params.get('user_id')
        
        start_date = None
        end_date = None
        
        if date_debut:
            try:
                # Support both ISO format with T and simple date space time
                clean_date = date_debut.replace('T', ' ').replace('Z', '')
                try:
                    start_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    start_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M')
                
                if timezone.is_naive(start_date):
                    start_date = timezone.make_aware(start_date)
            except ValueError as e:
                logger.error(f"Error parsing date_debut {date_debut}: {e}")
                pass
                
        if date_fin:
            try:
                clean_date = date_fin.replace('T', ' ').replace('Z', '')
                try: 
                    # Try full timestamp first
                    end_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    try:
                        # Try without seconds
                        end_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M')
                    except ValueError:
                         # Try date only -> end of day
                        end_date = datetime.strptime(clean_date, '%Y-%m-%d')
                        end_date = end_date.replace(hour=23, minute=59, second=59)

                if timezone.is_naive(end_date):
                    end_date = timezone.make_aware(end_date)
            except ValueError as e:
                logger.error(f"Error parsing date_fin {date_fin}: {e}")
                pass

        if not start_date:
            from ..models import ClotureCaisse # Lazy import to avoid circular dependency if any
            last_cloture = ClotureCaisse.objects.order_by('-date').first()
            start_date = last_cloture.date if last_cloture else None
        
        # Initialiser le queryset des transactions de caisse
        transactions = Caisse.objects.filter(statut='completee')
        if start_date:
            transactions = transactions.filter(date_paiement__gte=start_date)
        if end_date:
            transactions = transactions.filter(date_paiement__lte=end_date)
        if user_id:
            transactions = transactions.filter(user_id=user_id)

        # SEPARATION: Ventes vs Recouvrement
        # Désormais basé sur le mode_paiement spécial
        recouvrement_q = Q(mode_paiement='recouvrement') | Q(facture__client__client_type='PROFESSIONNEL') | Q(reference__icontains='[RECOUV]')
        
        paiements_recouvrement = transactions.filter(recouvrement_q)
        paiements_sales = transactions.exclude(recouvrement_q).exclude(mode_paiement='en_compte')

        # Calculer les montants séparés
        montant_recouvrement = paiements_recouvrement.aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_ventes = paiements_sales.aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        
        # IMPORTANT: Le total théorique de CAISSE PHYSIQUE ne concerne QUE les espèces opérationnelles
        total_ventes_especes = paiements_sales.filter(mode_paiement='especes').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')

        # Pour les détails par mode, on ne garde QUE les ventes opérationnelles (exclut les recouvrements)
        modes = paiements_sales.values('mode_paiement').annotate(total=Sum('montant'))
        details = {item['mode_paiement']: float(item['total']) for item in modes}

        mouvements = MouvementCaisse.objects.all()
        if start_date:
            mouvements = mouvements.filter(date__gte=start_date)
        if end_date:
            mouvements = mouvements.filter(date__lte=end_date)
            
        if user_id:
            mouvements = mouvements.filter(user_id=user_id)
            
        moves_aggregated = mouvements.aggregate(
            entrees=Coalesce(Sum('montant', filter=Q(type='ENTREE')), Value(0, output_field=DecimalField())),
            sorties=Coalesce(Sum('montant', filter=Q(type='SORTIE')), Value(0, output_field=DecimalField()))
        )
        # On n'ajoute PLUS le recouvrement aux entrées opérationnelles
        total_entrees = moves_aggregated['entrees']
        total_sorties = moves_aggregated['sorties']
        
        # Le total théorique de CAISSE PHYSIQUE exclut les coupons (qui ne sont pas des espèces)
        # On calcule le montant total des coupons pour l'ajustement
        total_coupons = transactions.filter(mode_paiement='coupon').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        
        total_theorique = total_ventes_especes + total_entrees - total_sorties - total_coupons
        
        return Response({
            'start_date': start_date,
            'end_date': end_date,
            'total_theorique': total_theorique,
            'total_ventes': total_ventes,
            'total_entrees': total_entrees,
            'total_sorties': total_sorties,
            'total_coupons': total_coupons,
            'details': details
        })

    @action(detail=False, methods=['post'], url_path='cloturer')
    @transaction.atomic
    def cloturer(self, request):
        """
        Effectue la clôture de caisse.
        """
        montant_reel = request.data.get('montant_reel')
        if montant_reel is None:
            return Response({'detail': 'Le montant réel est requis.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            montant_reel = Decimal(str(montant_reel))
        except (ValueError, TypeError, InvalidOperation):
            return Response({'detail': 'Montant invalide.'}, status=status.HTTP_400_BAD_REQUEST)

        date_debut = request.data.get('date_debut')
        date_fin = request.data.get('date_fin')
        user_id = request.data.get('user_id')
        
        start_date = None
        end_date = None
        
        if date_debut:
            try:
                clean_date = date_debut.replace('T', ' ').replace('Z', '')
                try:
                    start_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    start_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M')

                if timezone.is_naive(start_date):
                    start_date = timezone.make_aware(start_date)
            except ValueError as e:
                 logger.error(f"Error parsing date_debut {date_debut}: {e}")
                 pass
                
        if date_fin:
            try:
                clean_date = date_fin.replace('T', ' ').replace('Z', '')
                try:
                    end_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M:%S')
                except ValueError:
                    try:
                        end_date = datetime.strptime(clean_date, '%Y-%m-%d %H:%M')
                    except ValueError:
                        end_date = datetime.strptime(clean_date, '%Y-%m-%d')
                        end_date = end_date.replace(hour=23, minute=59, second=59)

                if timezone.is_naive(end_date):
                    end_date = timezone.make_aware(end_date)
            except ValueError as e:
                logger.error(f"Error parsing date_fin {date_fin}: {e}")
                pass

        if not start_date:
            last_cloture = ClotureCaisse.objects.order_by('-date').first()
            start_date = last_cloture.date if last_cloture else None
        
        transactions = Caisse.objects.filter(statut='completee').exclude(mode_paiement='en_compte')
        if user_id:
            transactions = transactions.filter(user_id=user_id)
            
        if start_date:
            transactions = transactions.filter(date_paiement__gte=start_date)
        if end_date:
            transactions = transactions.filter(date_paiement__lte=end_date)
            
        # SEPARATION: Ventes vs Recouvrement (Hybride: nouveau mode + anciens marqueurs)
        recouvrement_q = Q(mode_paiement='recouvrement') | Q(facture__client__client_type='PROFESSIONNEL') | Q(reference__icontains='[RECOUV]')
        
        paiements_recouvrement = transactions.filter(recouvrement_q)
        paiements_sales = transactions.exclude(recouvrement_q)

        # Calculer les montants séparés
        montant_recouvrement = paiements_recouvrement.aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_ventes = paiements_sales.aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')

        # Détails par mode : UNIQUEMENT les ventes opérationnelles
        modes = paiements_sales.values('mode_paiement').annotate(total=Sum('montant'))
        details = {item['mode_paiement']: float(item['total']) for item in modes}
        
        mouvements = MouvementCaisse.objects.all()
        if start_date:
            mouvements = mouvements.filter(date__gte=start_date)
        if end_date:
            mouvements = mouvements.filter(date__lte=end_date)
        
        # Entrées : Uniquement les mouvements de flux (ENTREE), pas de recouvrement
        entrees_mouvements = mouvements.filter(type='ENTREE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_entrees = entrees_mouvements
        total_sorties = mouvements.filter(type='SORTIE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        
        if total_ventes == 0 and total_entrees == 0 and total_sorties == 0:
             return Response({
                 'detail': 'Impossible de clôturer : aucun mouvement (vente, entrée ou sortie) détecté depuis la dernière clôture.'
             }, status=status.HTTP_400_BAD_REQUEST)

        total_theorique = total_ventes_especes + total_entrees - total_sorties
        ecart = montant_reel - total_theorique
        
        details['__meta__'] = {
            'total_ventes': float(total_ventes),
            'total_entrees': float(total_entrees),
            'total_sorties': float(total_sorties)
        }
        
        cloture = ClotureCaisse.objects.create(
            montant_reel=montant_reel,
            montant_theorique=total_theorique,
            ecart_caisse=ecart,
            total_ventes=total_ventes,
            total_entrees=total_entrees,
            total_sorties=total_sorties,
            details_paiement=details,
            date_debut=start_date,
            date_fin=end_date,
            user=request.user if request.user.is_authenticated else None
        )
        
        log_audit(
            user=request.user,
            action=AuditLog.Action.CLOTURE_CAISSE,
            model_name='ClotureCaisse',
            object_id=cloture.id,
            description=f"Clôture de caisse: Théorique={total_theorique:.0f}F, Réel={montant_reel:.0f}F, Écart={ecart:+.0f}F",
            details={
                'theorique': float(total_theorique),
                'reel': float(montant_reel),
                'ecart': float(ecart),
                'ventes': float(total_ventes),
                'entrees': float(total_entrees),
                'sorties': float(total_sorties)
            },
            request=request
        )
        
        return Response({
            'status': 'success',
            'cloture_id': cloture.id,
            'montant_reel': float(montant_reel),
            'montant_theorique': float(total_theorique),
            'ecart': float(ecart),
            'total_ventes': float(total_ventes),
            'total_entrees': float(total_entrees),
            'total_sorties': float(total_sorties),
            'details': details
        })


class ClotureCaisseViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet en lecture seule pour consulter l'historique des clôtures de caisse.
    """
    serializer_class = ClotureCaisseSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = ClotureCaisse.objects.select_related('user').order_by('-date')
        
        date_debut = self.request.query_params.get('date_debut')
        date_fin = self.request.query_params.get('date_fin')
        
        if date_debut:
            queryset = queryset.filter(date__date__gte=date_debut)
        if date_fin:
            queryset = queryset.filter(date__date__lte=date_fin)
        
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        
        # Pagination parameters
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 31))
        
        total_count = queryset.count()
        
        # Global totals for the period
        totals_agg = queryset.aggregate(
            total_theorique=Sum('montant_theorique'),
            total_reel=Sum('montant_reel'),
            total_ecart=Sum('ecart_caisse')
        )
        
        global_totals = {
            'montant_theorique': float(totals_agg['total_theorique'] or 0),
            'montant_reel': float(totals_agg['total_reel'] or 0),
            'ecart_caisse': float(totals_agg['total_ecart'] or 0)
        }
        
        # Slice for current page
        start = (page - 1) * page_size
        end = start + page_size
        paginated_queryset = queryset[start:end]
        
        serializer = self.get_serializer(paginated_queryset, many=True)
        
        return Response({
            'count': total_count,
            'results': serializer.data,
            'totals': global_totals
        })


class CreanceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint pour la gestion des créances (ventes en compte).
    """
    serializer_class = CreanceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Retourne les factures validées avec paiement 'en_compte'.
        Permet de filtrer par client et par période.
        """
        from django.db.models import Sum, F, Q, Value, DecimalField
        from django.db.models.functions import Coalesce

        history = self.request.query_params.get('history', 'false').lower() == 'true'

        queryset = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            paid_amount=Coalesce(
                Sum('paiements__montant', filter=Q(paiements__statut='completee') & ~Q(paiements__mode_paiement='en_compte')),
                Value(0, output_field=DecimalField())
            ),
            remainder=F('total_ttc') - F('paid_amount')
        )
        
        if history:
            # Mode Histoire : montre les dettes EPOREES (solde <= 0) 
            # MAIS on doit s'assurer que c'étaient bien des créances à l'origine
            # (existence d'au moins un paiement 'en_compte')
            queryset = queryset.filter(
                remainder__lte=0,
                paiements__mode_paiement='en_compte'
            )
        else:
            # Mode En cours : montre les dettes ACTIVES (solde > 0)
            queryset = queryset.filter(remainder__gt=0)

        queryset = queryset.distinct().select_related(
            'client', 'ayant_droit'
        ).prefetch_related('paiements').order_by('-date')
        
        # Filtrer par client si spécifié
        client_id = self.request.query_params.get('client_id', None)
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        
        # Filtrer par période si spécifiée
        date_debut = self.request.query_params.get('date_debut', None)
        date_fin = self.request.query_params.get('date_fin', None)
        
        if date_debut:
            try:
                start_date = datetime.strptime(date_debut, '%Y-%m-%d')
                start_date = timezone.make_aware(start_date)
                queryset = queryset.filter(date__gte=start_date)
            except ValueError:
                pass
        
        if date_fin:
            try:
                end_date = datetime.strptime(date_fin, '%Y-%m-%d') + timedelta(days=1)
                end_date = timezone.make_aware(end_date)
                queryset = queryset.filter(date__lt=end_date)
            except ValueError:
                pass
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def totals(self, request):
        """
        Returns aggregated totals for créances.
        This is the SINGLE SOURCE OF TRUTH for créances totals.
        Used by Dashboard and rapport_mensuel.
        """
        queryset = self.get_queryset()
        
        total_creances = Decimal('0')
        count = 0
        for f in queryset:
            # Calculate remainder using same logic as queryset annotation
            paye = f.paiements.filter(statut='completee').exclude(mode_paiement='en_compte').aggregate(Sum('montant'))['montant__sum'] or Decimal('0')
            reste = f.total_ttc - paye
            if reste > 0:
                total_creances += reste
                count += 1
        
        return Response({
            'total': total_creances,
            'count': count
        })
    
    @action(detail=True, methods=['get'])
    def imprimer_recu(self, request, pk=None):
        """
        Génère un reçu de paiement pour une créance.
        """
        facture = self.get_object()
        paiement_id = request.query_params.get('paiement_id')
        
        paiement = None
        if paiement_id:
            try:
                paiement = Caisse.objects.get(id=paiement_id, facture=facture)
            except Caisse.DoesNotExist:
                return Response({'detail': 'Paiement non trouvé.'}, status=404)
        else:
            # Par défaut, on prend le dernier paiement complété qui n'est pas 'en_compte'
            paiement = facture.paiements.filter(statut='completee').exclude(mode_paiement='en_compte').order_by('-date_paiement').first()

        if not paiement:
            return Response({'detail': 'Aucun paiement trouvé pour cette facture.'}, status=400)

        # Récupérer les paramètres de l'entreprise
        settings, _ = InvoiceSettings.objects.get_or_create(pk=1)
        
        response = HttpResponse(content_type='application/pdf')
        filename = f"recu_{paiement.id}_{facture.numero_facture or facture.id}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
        story = []
        styles = getSampleStyleSheet()
        
        style_company = ParagraphStyle('Company', parent=styles['Heading2'], fontSize=14, spaceAfter=4, textColor=HexColor(settings.primary_color))
        style_normal = styles['Normal']
        style_title = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=1, spaceAfter=20, textColor=HexColor(settings.primary_color))
        style_label = ParagraphStyle('Label', parent=styles['Normal'], fontName='Helvetica-Bold')
        style_right = ParagraphStyle('Right', parent=styles['Normal'], alignment=2)
        
        # En-tête
        story.append(Paragraph(f"<b>{settings.company_name}</b>", style_company))
        address = settings.company_address or ""
        story.append(Paragraph(address.replace('\n', '<br/>'), style_normal))
        story.append(Spacer(1, 1*cm))
        
        story.append(Paragraph("REÇU DE PAIEMENT", style_title))
        
        # Infos Client et Facture
        client_name = facture.client_name_override or (facture.client.name if facture.client else "Client")
        date_paiement = paiement.date_paiement.strftime('%d/%m/%Y à %H:%M')
        ayant_droit = facture.ayant_droit.nom if hasattr(facture, 'ayant_droit') and facture.ayant_droit else None
        
        info_data = [
            [Paragraph("<b>Client :</b>", style_normal), Paragraph(client_name, style_normal)],
        ]
        
        if ayant_droit:
            info_data.append([Paragraph("<b>Bénéficiaire :</b>", style_normal), Paragraph(ayant_droit, style_normal)])
            
        info_data.extend([
            [Paragraph("<b>Facture N° :</b>", style_normal), Paragraph(facture.numero_facture or str(facture.id), style_normal)],
            [Paragraph("<b>Date du paiement :</b>", style_normal), Paragraph(date_paiement, style_normal)],
            [Paragraph("<b>Mode de règlement :</b>", style_normal), Paragraph(paiement.get_mode_paiement_display(), style_normal)],
        ])
        
        info_table = Table(info_data, colWidths=[4*cm, 10*cm])
        info_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 1*cm))
        
        # Montants
        total_paye_avant = facture.paiements.filter(
            statut='completee',
            date_paiement__lt=paiement.date_paiement
        ).exclude(mode_paiement='en_compte').aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
        
        reste_avant = facture.total_ttc - total_paye_avant
        reste_apres = reste_avant - paiement.montant
        
        amount_data = [
            [Paragraph("Dette avant paiement", style_normal), f"{reste_avant:,.0f} F"],
            [Paragraph("<b>MONTANT PAYÉ CE JOUR</b>", style_label), Paragraph(f"<b>{paiement.montant:,.0f} F</b>", style_label)],
            [Paragraph("RESTE À PAYER", style_label), f"{reste_apres:,.0f} F"],
        ]
        
        amount_table = Table(amount_data, colWidths=[10*cm, 4*cm])
        amount_table.setStyle(TableStyle([
            ('ALIGN', (1,0), (1,-1), 'RIGHT'),
            ('LINEABOVE', (0,1), (-1,1), 1, colors.black),
            ('LINEBELOW', (0,1), (-1,1), 1, colors.black),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('BACKGROUND', (0,1), (-1,1), colors.whitesmoke),
        ]))
        story.append(amount_table)
        
        story.append(Spacer(1, 2*cm))
        story.append(Paragraph("Merci de votre confiance.", ParagraphStyle('Thanks', parent=style_normal, alignment=1, italic=True)))
        
        doc.build(story)
        
        buffer.seek(0)
        response.write(buffer.getvalue())
        return response

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def ajouter_paiement(self, request, pk=None):
        """
        Ajoute un paiement partiel à une créance.
        Body: {
            'mode_paiement': 'especes|om|momo|cheque|carte|virement',
            'montant': 10000,
            'reference': 'REF123' (optionnel)
        }
        """
        facture = self.get_object()
        
        # Vérifier que la facture est bien une créance
        if not facture.paiements.filter(mode_paiement='en_compte').exists():
            return Response(
                {'detail': 'Cette facture n\'est pas une créance (pas de paiement en compte).'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validation par mot de passe (Sudo) - Nécessite le droit d'encaisser (Superviseur/Caissier Senior)
        validation_user, error_response = validate_sudo_mode(request, permission_attr='can_cash_out')
        if error_response:
            return error_response

        # Récupérer les données du paiement
        mode_paiement = request.data.get('mode_paiement')
        montant = request.data.get('montant')
        reference_base = request.data.get('reference', '')
        
        # Désormais on forcer le mode 'recouvrement' pour isolation comptable
        # On garde le mode réel dans la référence pour information
        reference = f"{reference_base} [{mode_paiement.upper()}] [RECOUV]".strip()
        mode_paiement = 'recouvrement'
        
        # Validation
        if not mode_paiement or not montant:
            return Response(
                {'detail': 'Les champs mode_paiement et montant sont requis.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            montant = Decimal(str(montant))
        except (ValueError, TypeError):
            return Response(
                {'detail': 'Le montant doit être un nombre valide.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Calculer le reste à payer
        montant_paye = facture.paiements.filter(
            statut='completee'
        ).exclude(
            mode_paiement='en_compte'
        ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
        
        reste_a_payer = facture.total_ttc - montant_paye
        
        # Vérifier que le montant ne dépasse pas le reste à payer
        if montant > reste_a_payer:
            return Response(
                {
                    'detail': f'Le montant du paiement ({montant}) dépasse le reste à payer ({reste_a_payer}).',
                    'reste_a_payer': str(reste_a_payer)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Créer le paiement
        paiement = Caisse.objects.create(
            facture=facture,
            mode_paiement=mode_paiement,
            montant=montant,
            reference=reference,
            statut='completee',
            user=validation_user
        )
        
        # Rafraîchir la facture pour obtenir les données à jour
        facture.refresh_from_db()
        
        # Sérialiser et retourner
        serializer = self.get_serializer(facture)
        return Response({
            'detail': 'Paiement enregistré avec succès.',
            'paiement_id': paiement.id,
            'creance': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def releve(self, request):
        """
        Génère un relevé de créances pour un client sur une période.
        """
        client_id = request.query_params.get('client_id')
        
        if not client_id:
            return Response(
                {'detail': 'Le paramètre client_id est requis.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Récupérer les créances du client
        queryset = self.get_queryset().filter(client_id=client_id)
        
        # Calculer les totaux
        total_factures = Decimal('0.00')
        total_paye = Decimal('0.00')
        total_reste = Decimal('0.00')
        
        creances_data = []
        for facture in queryset:
            montant_paye = facture.paiements.filter(
                statut='completee'
            ).exclude(
                mode_paiement='en_compte'
            ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
            
            reste = facture.total_ttc - montant_paye
            
            total_factures += facture.total_ttc
            total_paye += montant_paye
            total_reste += reste
            
            creances_data.append({
                'numero_facture': facture.numero_facture,
                'date': facture.date,
                'montant_total': facture.total_ttc,
                'montant_paye': montant_paye,
                'reste_a_payer': reste,
                'ayant_droit': facture.ayant_droit.nom if facture.ayant_droit else None
            })
        
        from ..models import Client
        try:
            client = Client.objects.get(pk=client_id)
        except Client.DoesNotExist:
             return Response({'detail': 'Client non trouvé'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'client': {
                'id': client.id,
                'name': client.name,
                'address': client.address,
                'phone': client.phone,
                'email': client.email
            },
            'periode': {
                'date_debut': request.query_params.get('date_debut'),
                'date_fin': request.query_params.get('date_fin')
            },
            'creances': creances_data,
            'totaux': {
                'total_factures': str(total_factures),
                'total_paye': str(total_paye),
                'total_reste': str(total_reste)
            }
        })


    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_paiement(self, request):
        """
        Pay list of invoices in bulk.
        Body: {
            'facture_ids': [1, 2, 3],
            'mode_paiement': 'especes',
            'reference': 'REF123'
        }
        """
        # Validation par mot de passe (Sudo)
        validation_user, error_response = validate_sudo_mode(request, permission_attr='can_view_dashboard')
        if error_response:
            return error_response

        facture_ids = request.data.get('facture_ids', [])
        mode_paiement = request.data.get('mode_paiement')
        reference_base = request.data.get('reference', '')
        
        # Marquer comme recouvrement et forcer le mode technique
        reference = f"{reference_base} [{mode_paiement.upper()}] [RECOUV]".strip()
        mode_paiement = 'recouvrement'

        if not facture_ids or not isinstance(facture_ids, list):
             return Response(
                {'detail': 'facture_ids must be a non-empty list.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not mode_paiement:
            return Response(
                {'detail': 'mode_paiement is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        factures = Facture.objects.filter(id__in=facture_ids)
        
        if not factures.exists():
             return Response(
                {'detail': 'No invoices found.'},
                status=status.HTTP_404_NOT_FOUND
            )
            
        client_ids = factures.values_list('client', flat=True).distinct()
        if len(client_ids) > 1:
             return Response(
                {'detail': 'All invoices must belong to the same client.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        client = factures.first().client
        
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        releve_ref = f"REL-{timestamp}-{client.id}"
        
        releve = RelevePaiement.objects.create(
            client=client,
            generated_by=request.user if request.user.is_authenticated else None,
            total_amount=Decimal('0.00'),
            reference=releve_ref
        )

        total_paid_bulk = Decimal('0.00')
        count_processed = 0

        for facture in factures:
            montant_paye = facture.paiements.filter(
                statut='completee'
            ).exclude(
                mode_paiement='en_compte'
            ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
            
            reste = facture.total_ttc - montant_paye

            if reste <= 0:
                continue

            Caisse.objects.create(
                facture=facture,
                mode_paiement=mode_paiement,
                montant=reste,
                reference=reference,
                statut='completee',
                user=validation_user,
                releve=releve
            )
            total_paid_bulk += reste
            count_processed += 1
            
        releve.total_amount = total_paid_bulk
        releve.save()

        return Response({
            'detail': f'Règlement groupé effectué avec succès. {count_processed} factures traitées.',
            'releve_id': releve.id,
            'releve_reference': releve.reference,
            'total_amount': str(total_paid_bulk)
        })


    @action(detail=False, methods=['get'])
    def imprimer_releve_paiement(self, request):
        """
        Génère un PDF pour un relevé de paiement groupé (RelevePaiement).
        """
        releve_id = request.query_params.get('releve_id')
        if not releve_id:
            return Response({'detail': 'releve_id est requis.'}, status=400)
            
        try:
            releve = RelevePaiement.objects.select_related('client').get(id=releve_id)
        except RelevePaiement.DoesNotExist:
            return Response({'detail': 'Relevé non trouvé.'}, status=404)
        except Exception as e:
            logger.error(f"Erreur lors de la récupération du relevé {releve_id}: {str(e)}")
            return Response({'detail': f'Erreur lors de la récupération du relevé: {str(e)}'}, status=500)
        
        try:
            # Récupérer les paramètres de l'entreprise
            settings, _ = InvoiceSettings.objects.get_or_create(pk=1)
            
            response = HttpResponse(content_type='application/pdf')
            filename = f"recapitulatif_reglement_{releve.reference}.pdf"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
            story = []
            styles = getSampleStyleSheet()
            
            # Gestion des couleurs par défaut si primary_color est invalide
            try:
                primary_color = HexColor(settings.primary_color) if settings.primary_color else colors.HexColor('#000000')
            except:
                primary_color = colors.HexColor('#000000')
            
            style_company = ParagraphStyle('Company', parent=styles['Heading2'], fontSize=14, spaceAfter=4, textColor=primary_color)
            style_normal = styles['Normal']
            style_title = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=1, spaceAfter=20, textColor=primary_color)
            style_label = ParagraphStyle('Label', parent=styles['Normal'], fontName='Helvetica-Bold')
            
            # En-tête
            company_name = settings.company_name or "Entreprise"
            story.append(Paragraph(f"<b>{company_name}</b>", style_company))
            address = settings.company_address or ""
            if address:
                story.append(Paragraph(address.replace('\n', '<br/>'), style_normal))
            story.append(Spacer(1, 1*cm))
            
            story.append(Paragraph("RÉCAPITULATIF DE RÈGLEMENT", style_title))
            
            # Infos Relevé
            date_releve = releve.created_at.strftime('%d/%m/%Y à %H:%M') if releve.created_at else datetime.now().strftime('%d/%m/%Y à %H:%M')
            client_name = releve.client.name if releve.client else "Client inconnu"
            releve_ref = releve.reference or f"REL-{releve.id}"
            
            info_data = [
                [Paragraph("<b>Client :</b>", style_normal), Paragraph(client_name, style_normal)],
                [Paragraph("<b>Référence Relevé :</b>", style_normal), Paragraph(releve_ref, style_normal)],
                [Paragraph("<b>Date :</b>", style_normal), Paragraph(date_releve, style_normal)],
            ]
            
            info_table = Table(info_data, colWidths=[5*cm, 9*cm])
            info_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ]))
            story.append(info_table)
            story.append(Spacer(1, 0.5*cm))
            
            # Tableau des factures réglées
            table_data = [['N° Facture', 'Date Facture', 'Bénéficiaire', 'Montant TTC', 'Réglé']]
            
            paiements = releve.paiements_caisse.all().select_related('facture', 'facture__ayant_droit')
            
            if not paiements.exists():
                story.append(Paragraph("<i>Aucun paiement trouvé pour ce relevé.</i>", style_normal))
            else:
                for p in paiements:
                    try:
                        f = p.facture
                        if not f:
                            continue
                            
                        # Gestion sécurisée de l'ayant droit
                        ayant_droit = "-"
                        if f.ayant_droit:
                            ayant_droit = f.ayant_droit.nom or "-"
                        
                        # Formatage sécurisé des montants
                        montant_ttc = float(f.total_ttc) if f.total_ttc else 0.0
                        montant_regle = float(p.montant) if p.montant else 0.0
                        
                        numero_facture = f.numero_facture or str(f.id)
                        date_facture = f.date.strftime('%d/%m/%Y') if f.date else "-"
                        
                        table_data.append([
                            numero_facture,
                            date_facture,
                            ayant_droit,
                            f"{montant_ttc:,.0f} F",
                            f"{montant_regle:,.0f} F"
                        ])
                    except Exception as e:
                        logger.error(f"Erreur lors du traitement du paiement {p.id}: {str(e)}")
                        continue
                
                if len(table_data) > 1:  # Si on a au moins une ligne de données (en plus de l'en-tête)
                    story.append(Spacer(1, 0.5*cm))
                    
                    t = Table(table_data, colWidths=[3.5*cm, 2.5*cm, 4*cm, 2*cm, 2*cm])
                    t.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.whitesmoke),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('ALIGN', (3, 1), (4, -1), 'RIGHT'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, -1), 9),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ]))
                    story.append(t)
            
            # Total global
            story.append(Spacer(1, 1*cm))
            total_amount = float(releve.total_amount) if releve.total_amount else 0.0
            total_data = [
                ["", "", Paragraph("<b>TOTAL RÈGLEMENT :</b>", style_label), Paragraph(f"<b>{total_amount:,.0f} F</b>", style_label)]
            ]
            total_table = Table(total_data, colWidths=[3.5*cm, 2.5*cm, 4*cm, 4*cm])
            total_table.setStyle(TableStyle([
                ('ALIGN', (3, 0), (3, 0), 'RIGHT'),
            ]))
            story.append(total_table)
            
            story.append(Spacer(1, 2*cm))
            story.append(Paragraph("Merci de votre confiance.", ParagraphStyle('Thanks', parent=style_normal, alignment=1, italic=True)))
            
            doc.build(story)
            
            buffer.seek(0)
            response.write(buffer.getvalue())
            return response
            
        except Exception as e:
            logger.error(f"Erreur lors de la génération du PDF du relevé {releve_id}: {str(e)}", exc_info=True)
            return Response({
                'detail': f'Erreur lors de la génération du PDF: {str(e)}'
            }, status=500)


    @action(detail=False, methods=['delete'], permission_classes=[IsAdminUser])
    def vider(self, request):
        """
        Supprime tout le contenu de la facture.
        """
        facture_id = request.data.get('facture')
        if not facture_id:
             return Response({'detail': 'ID facture requis.'}, status=status.HTTP_400_BAD_REQUEST)
        
        FactureProduit.objects.filter(facture_id=facture_id).delete()
        
        # Mettre à jour les totaux de la facture
        try:
            facture = Facture.objects.get(id=facture_id)
            facture.calculate_totals()
            facture.save()
        except Facture.DoesNotExist:
            pass

        return Response({'detail': 'Contenu de la facture vidé.'})





class MouvementCaisseViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing cash register movements (entries and exits).
    """
    queryset = MouvementCaisse.objects.select_related('user').all().order_by('-date')
    serializer_class = MouvementCaisseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['type', 'user']
    search_fields = ['motif', 'description']
    ordering_fields = ['date', 'montant']
    ordering = ['-date']
    
    def perform_create(self, serializer):
        """Automatically set the user to the currently authenticated user and audit."""
        mouvement = serializer.save(user=self.request.user)
        
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.OTHER,
            model_name='MouvementCaisse',
            object_id=mouvement.id,
            description=f"Mouvement caisse ({mouvement.type}): {mouvement.montant:.0f}F - {mouvement.motif}",
            details={
                'type': mouvement.type,
                'montant': float(mouvement.montant),
                'motif': mouvement.motif,
                'description': mouvement.description
            },
            request=self.request
        )

    def perform_update(self, serializer):
        mouvement = serializer.instance
        old_montant = mouvement.montant
        serializer.save()
        
        log_audit(
            user=self.request.user,
            action=AuditLog.Action.UPDATE,
            model_name='MouvementCaisse',
            object_id=mouvement.id,
            description=f"Modification mouvement caisse #{mouvement.id}",
            details={
                'old_montant': float(old_montant),
                'new_montant': float(mouvement.montant),
                'motif': mouvement.motif
            },
            request=self.request
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        mvmt_id = instance.id
        mvmt_info = f"{instance.type} {instance.montant}F ({instance.motif})"
        
        response = super().destroy(request, *args, **kwargs)
        
        log_audit(
            user=request.user,
            action=AuditLog.Action.DELETE,
            model_name='MouvementCaisse',
            object_id=mvmt_id,
            description=f"Suppression mouvement caisse: {mvmt_info}",
            details={'info': mvmt_info},
            request=request
        )
        return response


