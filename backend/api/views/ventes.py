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
from decimal import Decimal
import io
import logging

# ReportLab imports
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, Frame, PageTemplate, BaseDocTemplate

from ..models import (
    Facture, FactureProduit, FactureProduitAllocation, Caisse, ClotureCaisse, 
    MouvementCaisse, Produit, StockLot, LoyaltySetting, InvoiceSettings, AuditLog,
    RelevePaiement, MouvementStock
)
from ..serializers import (
    FactureSerializer, FactureProduitSerializer, CaisseSerializer, ClotureCaisseSerializer,
    CreanceSerializer, MouvementCaisseSerializer, FacturePrintSerializer
)
from ..serializers_optimized import FactureListSerializer, FactureDetailSerializer
from ..serializer_mixins import OptimizedSerializerMixin
from ..audit_helpers import log_audit

logger = logging.getLogger(__name__)

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

# Globals for session-based ticket numbering with daily reset
SESSION_TICKET_COUNTER = 0
INVOICE_TICKET_MAP = {}
SESSION_TICKET_DATE = None  # Tracks the date for daily reset

class FactureViewSet(OptimizedSerializerMixin, viewsets.ModelViewSet):
    """
    API endpoint for factures with optimized serializers.
    - List view: Lightweight serializer (7 fields) - excludes products and payments
    - Detail view: Complete serializer with all products and payments
    """
    queryset = Facture.objects.select_related('client', 'ayant_droit').prefetch_related('produits', 'paiements').all().order_by('-date')
    serializer_class = FactureSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'status': ['exact', 'in'],
        'client': ['exact'],
        'date': ['gte', 'lte', 'date'],
        'numero_facture': ['exact', 'icontains']
    }
    search_fields = ['numero_facture', 'client__name']
    
    # Serializers optimisés
    list_serializer_class = FactureListSerializer
    detail_serializer_class = FactureDetailSerializer

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        
        # Inject context-based ticket numbers
        # Only for Caisse Centrale view (pending invoices)
        status_filter = request.query_params.get('status__in', '')
        
        # Robust check: look for BROU and VAL in the string (handles encoding/order)
        if 'BROU' in status_filter and 'VAL' in status_filter:
            global SESSION_TICKET_COUNTER
            global INVOICE_TICKET_MAP
            global SESSION_TICKET_DATE
            
            # Daily reset: Check if the date has changed
            today = date.today()
            if SESSION_TICKET_DATE != today:
                SESSION_TICKET_COUNTER = 0
                INVOICE_TICKET_MAP = {}
                SESSION_TICKET_DATE = today
                print(f"DEBUG: Daily reset - Ticket counter reset for {today}")
            
            # Handle pagination
            data_list = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
            
            if isinstance(data_list, list):
                # Simply loop and assign/retrieve
                for facture in data_list:
                    # Only assign if not present
                    facture_id = facture.get('id')
                    if facture_id:
                        if facture_id not in INVOICE_TICKET_MAP:
                            SESSION_TICKET_COUNTER += 1
                            INVOICE_TICKET_MAP[facture_id] = SESSION_TICKET_COUNTER
                            print(f"DEBUG: Assigned Ticket #{SESSION_TICKET_COUNTER} to Invoice #{facture_id}")
                        
                        facture['session_ticket_number'] = INVOICE_TICKET_MAP[facture_id]
        
        return response

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

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
                action='INV_DEL',
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
    def valider(self, request, pk=None):
        """
        Valide une facture, met à jour le stock et alloue les lots (FIFO).
        """
        facture = self.get_object()
        if facture.status == Facture.Status.VALIDEE:
            return Response({'detail': 'Cette facture est déjà validée.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Permettre la validation de BROUILLON ou PROFORMA (devis)
        if facture.status not in [Facture.Status.BROUILLON, Facture.Status.PROFORMA]:
            return Response({
                'detail': f'Impossible de valider une facture avec le statut {facture.get_status_display()}.'
            }, status=status.HTTP_400_BAD_REQUEST)

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
            new_invoice_amount = facture.total_ttc
            plafond = facture.client.plafond
            if plafond > 0 and (current_debt + new_invoice_amount) > plafond:
                return Response(
                    {
                        'detail': f"Le plafond de crédit du client est dépassé. "
                                  f"Dette actuelle: {current_debt}, "
                                  f"Montant facture: {new_invoice_amount}, "
                                  f"Plafond: {plafond}. "
                                  f"Total après validation: {current_debt + new_invoice_amount}"
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Vérifier le stock avant validation en utilisant les instances VERROUILLÉES
        for item in items:
            produit = product_map.get(item.produit_id)
            if not produit:
                continue 

            try:
                qty = Decimal(str(item.quantity))
                stock = Decimal(str(produit.stock))
            except Exception:
                return Response({'detail': f'Impossible de comparer les quantités pour le produit {produit.id}.'}, status=status.HTTP_400_BAD_REQUEST)

            if qty > 0:
                can_sell_negative = request.user.is_superuser
                if not can_sell_negative and hasattr(request.user, 'profile'):
                    can_sell_negative = request.user.profile.can_sell_negative_stock
                
                if stock < qty and not can_sell_negative:
                    return Response(
                        {'detail': f'Stock insuffisant pour le produit {produit.name}. Stock disponible: {stock}, Quantité demandée: {qty}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            elif qty < 0:
                can_return = False
                if hasattr(request.user, 'profile'):
                    can_return = request.user.profile.can_do_returns
                
                if not can_return:
                    return Response(
                        {'detail': 'Vous n\'avez pas la permission d\'effectuer des retours (quantités négatives).'},
                        status=status.HTTP_403_FORBIDDEN
                    )

        # Mettre à jour le stock
        for item in items:
            produit = product_map.get(item.produit_id)
            lots_updated = False
            
            # 1. Gestion des lots pour les VENTES (qty > 0)
            if item.quantity > 0:
                quantity_to_allocate = item.quantity
                
                # CAS 1: Un lot spécifique est ciblé
                if item.stock_lot:
                    target_lot = StockLot.objects.select_for_update().get(id=item.stock_lot.id)
                    
                    if target_lot.quantity_remaining < quantity_to_allocate:
                        return Response(
                            {
                                'detail': f'Stock insuffisant dans le lot {target_lot.lot}. '
                                          f'Stock disponible: {target_lot.quantity_remaining}, '
                                          f'Quantité demandée: {quantity_to_allocate}'
                            },
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    FactureProduitAllocation.objects.create(
                        facture_produit=item,
                        stock_lot=target_lot,
                        quantity=quantity_to_allocate,
                        cost_price=target_lot.price_cost,
                        selling_price=item.selling_price
                    )
                    target_lot.quantity_remaining -= quantity_to_allocate
                    target_lot.save()
                    lots_updated = True

                # CAS 2: Pas de lot spécifique -> FIFO/FEFO standard
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
                            facture_produit=item,
                            stock_lot=lot,
                            quantity=quantity_from_lot,
                            cost_price=lot.price_cost,
                            selling_price=item.selling_price
                        )
                        lot.quantity_remaining -= quantity_from_lot
                        lot.save()
                        quantity_to_allocate -= quantity_from_lot
                        lots_updated = True
            
            # 2. Mise à jour du stock global
            if produit.use_lot_management and lots_updated:
                # Pour les produits avec gestion par lots, recalculer depuis les lots
                produit.calculate_stock_from_lots()
            else:
                # Pour les produits sans lots ou retours, décrémenter manuellement
                produit.stock = F('stock') - item.quantity
                produit.save(update_fields=['stock'])

        # --- GESTION FIDELITE ---
        if facture.client and facture.client.client_type != 'PROFESSIONNEL' and facture.client.is_loyalty_member:
            loyalty_conf = LoyaltySetting.objects.first()
            if loyalty_conf:
                client = facture.client
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

        facture.status = Facture.Status.VALIDEE
        if not facture.numero_facture:
            facture.numero_facture = f"FAC-{facture.id:06d}"
        facture.save(update_fields=['status', 'numero_facture'])
        
        today = date.today()
        Produit.objects.filter(id__in=product_ids).update(dernier_vente=today)

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
                        user=request.user,
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
                    user=request.user
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
        if facture.status == Facture.Status.ANNULEE:
            return Response({'detail': 'Cette facture est déjà annulée.'}, status=status.HTTP_400_BAD_REQUEST)

        motif = request.data.get('motif', '')

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
                    user=request.user
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
            
        facture.save(update_fields=['status', 'notes', 'date_annulation'])

        # Log Audit
        log_audit(
            user=request.user,
            action='INV_CANCEL',
            model_name='Facture',
            object_id=facture.numero_facture,
            description=f"Annulation Facture #{facture.numero_facture}",
            details={
                'facture_id': facture.id,
                'numero': facture.numero_facture,
                'amount': -float(facture.total_ttc), # Negative because cancelled
                'montant': -float(facture.total_ttc),
                'motif': motif,
                'client': facture.client.name if facture.client else 'Passager'
            },
            request=request
        )

        numero = facture.numero_facture or f"#{facture.id}"
        log_audit(
            user=request.user,
            action=AuditLog.Action.INVOICE_CANCEL,
            model_name='Facture',
            object_id=facture.id,
            description=f"Facture {numero} annulée (Montant: {facture.total_ttc:.0f}F){' - Motif: ' + motif if motif else ''}",
            details={
                'facture_id': facture.id,
                'numero_facture': numero,
                'montant': float(facture.total_ttc),
                'motif': motif,
                'client': facture.client.name if facture.client else None
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
            lot_id = prod_data.get('lot_id')
            
            fp = FactureProduit.objects.create(
                facture=facture,
                produit_id=produit_id,
                quantity=quantity,
                selling_price=selling_price,
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


    @action(detail=True, methods=['get'])
    def imprimer_facture(self, request, pk=None):
        """
        Génère un PDF pour la facture.
        Utilise InvoiceSettings pour la personnalisation.
        """
        facture = self.get_object()
        
        # Récupérer les paramètres
        settings, created = InvoiceSettings.objects.get_or_create(pk=1)
        
        response = HttpResponse(content_type='application/pdf')
        filename = f"facture_{facture.numero_facture or facture.id}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

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
        
        invoice_date = facture.date.strftime('%d/%m/%Y à %H:%M')
        client_name = facture.client_name_override or (facture.client.name if facture.client else "Client de passage")
        
        invoice_details_text = f"""
        <b>N° Facture: {facture.numero_facture or facture.id}</b><br/>
        Date: {invoice_date}<br/>
        Client: {client_name}
        """
        if facture.client and facture.client.phone:
            invoice_details_text += f"<br/>Tel: {facture.client.phone}"
            
        doc_title = "FACTURE"
        is_proforma = request.query_params.get('type') == 'proforma' or facture.status == Facture.Status.PROFORMA
        
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
        
        total_ht = facture.total_ht
        total_tva = facture.total_tva
        remise = facture.remise
        total_ttc = facture.total_ttc
        
        totals_data = [
            ['Sous-total :', f"{total_ht:,.0f} F"],
            ['TVA :', f"{total_tva:,.0f} F"],
            ['Remise :', f"{remise:,.0f} F"],
            ['TOTAL À PAYER :', f"{total_ttc:,.0f} F"]
        ]
        
        
        totals_table = Table(totals_data, colWidths=[4*cm, 4*cm])
        totals_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
            ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
            ('LINEABOVE', (0,-1), (-1,-1), 1, colors.black),  # Line above total
        ]))
        story.append(totals_table)
        
        doc.build(story, onFirstPage=lambda c, d: header_footer_facture(c, d, {
            'name': settings.company_name,
            'address': company_address_fmt.replace('<br/>', '\n'),
            'tel': 'N/A' # TODO: Add phone to settings
        }, {
            'facture_id': facture.numero_facture or f"#{facture.id}",
            'date_facture': invoice_date,
            'client_name': client_name,
            'client_address': facture.client.address if facture.client and facture.client.address else "",
            'client_phone': facture.client.phone if facture.client and facture.client.phone else ""
        }, facture))
        
        buffer.seek(0)
        response.write(buffer.getvalue())
        return response

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


class CaisseViewSet(viewsets.ModelViewSet):
    """API endpoint for caisse (paiements)."""
    queryset = Caisse.objects.select_related('facture', 'facture__client', 'user').order_by('-date_paiement')
    serializer_class = CaisseSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['facture', 'mode_paiement', 'statut', 'user']
    permission_classes = [IsAuthenticated]
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def get_totals(self, request):
        """
        Retourne les totaux.
        """
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        
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
            last_cloture = ClotureCaisse.objects.order_by('-date').first()
            start_date = last_cloture.date if last_cloture else None
        
        transactions = Caisse.objects.filter(statut='completee').exclude(mode_paiement='en_compte')
        
        if start_date:
            transactions = transactions.filter(date_paiement__gte=start_date)
        if end_date:
            transactions = transactions.filter(date_paiement__lte=end_date)
            
        modes = transactions.values('mode_paiement').annotate(total=Sum('montant'))
        details = {item['mode_paiement']: float(item['total']) for item in modes}
        
        total_ventes = Decimal(sum(details.values()))

        mouvements = MouvementCaisse.objects.all()
        if start_date:
            mouvements = mouvements.filter(date__gte=start_date)
        if end_date:
            mouvements = mouvements.filter(date__lte=end_date)
            
        moves_aggregated = mouvements.aggregate(
            entrees=Coalesce(Sum('montant', filter=Q(type='ENTREE')), Value(0, output_field=DecimalField())),
            sorties=Coalesce(Sum('montant', filter=Q(type='SORTIE')), Value(0, output_field=DecimalField()))
        )
        total_entrees = moves_aggregated['entrees']
        total_sorties = moves_aggregated['sorties']
        
        total_theorique = total_ventes + total_entrees - total_sorties
        
        return Response({
            'start_date': start_date,
            'end_date': end_date,
            'total_theorique': total_theorique,
            'total_ventes': total_ventes,
            'total_entrees': total_entrees,
            'total_sorties': total_sorties,
            'details': details
        })

    @action(detail=False, methods=['post'])
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
        except:
            return Response({'detail': 'Montant invalide.'}, status=status.HTTP_400_BAD_REQUEST)

        date_debut = request.data.get('date_debut')
        date_fin = request.data.get('date_fin')
        
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
        if start_date:
            transactions = transactions.filter(date_paiement__gte=start_date)
        if end_date:
            transactions = transactions.filter(date_paiement__lte=end_date)
            
        total_ventes = transactions.aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        
        modes = transactions.values('mode_paiement').annotate(total=Sum('montant'))
        details = {item['mode_paiement']: float(item['total']) for item in modes}
        
        mouvements = MouvementCaisse.objects.all()
        if start_date:
            mouvements = mouvements.filter(date__gte=start_date)
        if end_date:
            mouvements = mouvements.filter(date__lte=end_date)
        total_entrees = mouvements.filter(type='ENTREE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_sorties = mouvements.filter(type='SORTIE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        
        if total_ventes == 0 and total_entrees == 0 and total_sorties == 0:
             return Response({
                 'detail': 'Impossible de clôturer : aucun mouvement (vente, entrée ou sortie) détecté depuis la dernière clôture.'
             }, status=status.HTTP_400_BAD_REQUEST)

        total_theorique = total_ventes + total_entrees - total_sorties
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

        queryset = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).annotate(
            paid_amount=Coalesce(
                Sum('paiements__montant', filter=Q(paiements__statut='completee') & ~Q(paiements__mode_paiement='en_compte')),
                Value(0, output_field=DecimalField())
            ),
            remainder=F('total_ttc') - F('paid_amount')
        ).filter(
            remainder__gt=0
        ).distinct().select_related(
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
        
        # Récupérer les données du paiement
        mode_paiement = request.data.get('mode_paiement')
        montant = request.data.get('montant')
        reference = request.data.get('reference', '')
        
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
            user=request.user
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
        facture_ids = request.data.get('facture_ids', [])
        mode_paiement = request.data.get('mode_paiement')
        reference = request.data.get('reference', '')

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
                user=request.user if request.user.is_authenticated else None,
                releve=releve
            )
            total_paid_bulk += reste
            count_processed += 1
            
        releve.total_amount = total_paid_bulk
        releve.save()

        return Response({
            'detail': f'Règlement groupé effectué avec succès. {count_processed} factures traitées.',
            'releve_reference': releve.reference,
            'total_amount': str(total_paid_bulk)
        })


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
        """Automatically set the user to the currently authenticated user."""
        serializer.save(user=self.request.user)
