from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from decimal import Decimal
from django.db import transaction
from django.db.models import ProtectedError
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle, Frame, PageTemplate, BaseDocTemplate, Spacer, SimpleDocTemplate, PageBreak
import io
from datetime import datetime, date, timedelta
from reportlab.graphics.barcode import code128

from ..models import (
    Commande, CommandeProduit, Produit, StockLot, StockAdjustment, AuditLog,
    Avoir, LigneAvoir, Promis, Facture, FactureProduit, ActivityLog, Fournisseur, MouvementStock
)
from ..serializers import (
    CommandeSerializer, CommandeProduitSerializer, AvoirSerializer, 
    LigneAvoirSerializer, PromisSerializer, FournisseurSerializer
)
from ..serializers_optimized import CommandeListSerializer, CommandeDetailSerializer
from ..serializer_mixins import OptimizedSerializerMixin
from ..search_mixins import MultiTermSearchMixin
from ..audit_helpers import log_audit
import logging

logger = logging.getLogger(__name__)

def header_footer(canvas, doc, company_info, commande_info, total_achat):
    canvas.saveState()
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='RightAlign', alignment=2))
    
    page_width, page_height = letter
    margin = doc.leftMargin
    content_width = doc.width

    # Header
    header_data = [
        [
            Paragraph(f"<b>{company_info['name']}</b><br/>{company_info['address']}<br/>Tel: {company_info['tel']}", styles['Normal']),
            Paragraph("<b>BON DE RÉCEPTION</b>", styles['h1'])
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
            Paragraph(f"<b>Fournisseur:</b><br/>{commande_info['fournisseur_name']}<br/>{commande_info['fournisseur_address']}", styles['Normal']),
            Paragraph(f"<b>Commande N°:</b> {commande_info['commande_id']}<br/><b>Date Commande:</b> {commande_info['date_commande']}<br/><b>Date Réception:</b> {commande_info['date_reception']}", styles['Normal'])
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
        f"Montant Total: {total_achat} F"
    ]
    canvas.drawString(margin, 0.75 * inch, footer_texts[0])
    canvas.drawRightString(margin + content_width, 0.75 * inch, footer_texts[1])
    
    canvas.restoreState()

class CommandeViewSet(MultiTermSearchMixin, OptimizedSerializerMixin, viewsets.ModelViewSet):
    """
    API endpoint for commands with optimized serializers.
    - List view: Lightweight serializer (8 fields)
    - Detail view: Complete serializer with all products
    """
    queryset = Commande.objects.select_related('fournisseur').prefetch_related('produits__produit', 'produits__commande__fournisseur').order_by('-date')
    serializer_class = CommandeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['type', 'status', 'fournisseur']
    search_fields = ['id', 'fournisseur__name', 'numero_facture', 'fournisseur_nom']
    ordering_fields = ['date', 'status']
    
    # Serializers optimisés
    list_serializer_class = CommandeListSerializer
    detail_serializer_class = CommandeDetailSerializer

    def perform_destroy(self, instance):
        try:
            super().perform_destroy(instance)
        except Exception as e:
            from rest_framework.exceptions import ValidationError
            
            if isinstance(e, ProtectedError) or "ProtectedError" in str(type(e)):
                 raise ValidationError("Impossible de supprimer : Des lots de cette commande ont déjà été vendus ou utilisés.")
            raise e


            if isinstance(e, ProtectedError) or "ProtectedError" in str(type(e)):
                 raise ValidationError("Impossible de supprimer : Des lots de cette commande ont déjà été vendus ou utilisés.")
            raise e

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def merge(self, request, pk=None):
        """
        Fusionne une autre commande (source) DANS cette commande (cible).
        - Les deux commandes doivent être EN_PREPARATION.
        - Les lignes de la source sont déplacées vers la cible.
        - Si un produit existe déjà dans la cible, les quantités sont additionnées.
        - La commande source est ensuite SUPPRIMÉE.
        """
        target_commande = self.get_object()
        source_id = request.data.get('source_commande_id')
        
        if not source_id:
            return Response({'error': 'ID de la commande source requis'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            source_commande = Commande.objects.get(pk=source_id)
        except Commande.DoesNotExist:
            return Response({'error': 'Commande source introuvable'}, status=status.HTTP_404_NOT_FOUND)

        # Vérifications
        if target_commande.id == source_commande.id:
            return Response({'error': 'Impossible de fusionner une commande avec elle-même'}, status=status.HTTP_400_BAD_REQUEST)
            
        if target_commande.status != Commande.Status.EN_PREPARATION:
            return Response({'error': 'La commande cible doit être EN_PREPARATION'}, status=status.HTTP_400_BAD_REQUEST)
            
        if source_commande.status != Commande.Status.EN_PREPARATION:
            return Response({'error': 'La commande source doit être EN_PREPARATION'}, status=status.HTTP_400_BAD_REQUEST)

        # Fusion des lignes
        source_lines = source_commande.produits.all()
        target_lines_map = {line.produit_id: line for line in target_commande.produits.all()}
        
        lines_moved = 0
        lines_merged = 0
        
        for source_line in source_lines:
            if source_line.produit_id in target_lines_map:
                # Le produit existe déjà dans la cible : on additionne les quantités
                target_line = target_lines_map[source_line.produit_id]
                target_line.quantity += source_line.quantity
                target_line.unites_gratuites += source_line.unites_gratuites
                target_line.save()
                lines_merged += 1
            else:
                # Le produit n'existe pas : on déplace la ligne
                source_line.commande = target_commande
                source_line.save()
                lines_moved += 1
        
        # Supprimer la commande source (les lignes restantes ont été déplacées ou ne sont plus nécessaires)
        # S'il reste des lignes (cas fusionné), on doit les supprimer avant de supprimer la commande
        source_commande.produits.all().delete()
        source_commande.delete()
        
        return Response({
            'status': 'success',
            'message': f'Fusion réussie : {lines_moved} lignes déplacées, {lines_merged} lignes fusionnées.',
            'lines_moved': lines_moved,
            'lines_merged': lines_merged
        })
        """
        Clôture une commande, met à jour le stock et calcule le PMP.
        Utilise select_for_update pour empêcher les modifications concurrentes (ventes) pendant le calcul.
        
        Optimisations:
        - Prefetch des produits pour éviter les requêtes N+1
        - Bulk create des lots de stock
        - Bulk update des produits
        """
        commande = self.get_object()
        if commande.status == Commande.Status.CLOTUREE:
            return Response({'detail': 'Cette commande est déjà clôturée.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Enregistrer la date de clôture (maintenant, en timezone local)
        commande.date_cloture = timezone.now()

        # Prefetch tous les produits de la commande en une seule requête
        items = commande.produits.select_related('produit', 'produit__fournisseur').all()
        
        if not items.exists():
            return Response({'detail': 'Aucun produit dans cette commande.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # VERROUILLAGE: On récupère les IDs des produits pour les verrouiller
        product_ids = [item.produit_id for item in items]
        
        # On verrouille les produits pour empêcher toute modification de stock (ex: vente concomitante)
        locked_products = list(Produit.objects.select_for_update().filter(id__in=product_ids))
        product_map = {p.id: p for p in locked_products}
        
        lots_to_create = []
        produits_to_update = []
        produits_dict = {}  # Pour éviter les doublons et suivre les mises à jour
        
        # Phase 1: Calculs en mémoire (pas de DB writes)
        lots_dict = {} # Key: (produit_id, lot_number)
        
        for item in items:
            # Calcul des quantités
            quantity_paid = item.quantity
            quantity_free = item.unites_gratuites
            total_qty = quantity_paid + quantity_free
            
            # Calcul du coût effectif (le coût payé réparti sur toutes les unités)
            if total_qty > 0:
                effective_cost = (quantity_paid * item.price_cost) / total_qty
            else:
                effective_cost = item.price_cost
            
            # Utiliser l'instance verrouillée du produit
            produit = product_map.get(item.produit_id)
            if not produit:
                continue
            
            # 1. Gérer le lot de stock (si gestion par lots activée)
            if produit.use_lot_management:
                lot_number = item.lot
                if not lot_number or lot_number.strip() == '':
                    lot_number = f"LOT{commande.id:03d}"
                
                key = (produit.id, lot_number)
                if key in lots_dict:
                    # Fusionner avec le lot déjà préparé en mémoire pour cette commande
                    existing_lot = lots_dict[key]
                    
                    # Nouveau coût moyen pondéré pour le lot (basé sur le coût d'achat)
                    old_total = Decimal(existing_lot.quantity_initial)
                    new_total = old_total + Decimal(total_qty)
                    
                    if new_total > 0:
                        old_cost = Decimal(existing_lot.price_cost)
                        val_old = old_total * old_cost
                        val_new = Decimal(quantity_paid) * Decimal(item.price_cost)
                        existing_lot.price_cost = (val_old + val_new) / new_total
                    
                    existing_lot.quantity_initial += total_qty
                    existing_lot.quantity_paid += quantity_paid
                    existing_lot.quantity_free += quantity_free
                    existing_lot.quantity_remaining += total_qty
                else:
                    # Créer une nouvelle instance en mémoire
                    lots_dict[key] = StockLot(
                        produit=produit,
                        commande_produit=item,
                        fournisseur=commande.fournisseur if commande.fournisseur else produit.fournisseur,
                        quantity_initial=total_qty,
                        quantity_paid=quantity_paid,
                        quantity_free=quantity_free,
                        quantity_remaining=total_qty,
                        price_cost=effective_cost,
                        selling_price=produit.selling_price,
                        lot=lot_number,
                        date_expiration=item.date_expiration,
                        date_reception=commande.date_cloture
                    )
            
            # 2. Calculer le nouveau PMP et stock
            # Éviter de traiter le même produit plusieurs fois (si plusieurs lignes pour même produit)
            if produit.id not in produits_dict:
                old_stock = Decimal(produit.stock)
                old_pmp = Decimal(produit.pmp)
                qty_received = Decimal(total_qty)
                cout_total = Decimal(quantity_paid) * Decimal(item.price_cost)
                
                new_total_qty = old_stock + qty_received
                
                if new_total_qty > 0:
                    current_val = old_stock * old_pmp
                    incoming_val = cout_total
                    new_pmp = (current_val + incoming_val) / new_total_qty
                    produit.pmp = new_pmp
                
                # Mettre à jour le stock
                produit.stock = old_stock + qty_received

                # Ajouter au dictionnaire pour suivi local
                produits_dict[produit.id] = produit
                produits_to_update.append(produit)
            else:
                # Produit déjà traité dans cette boucle (autre ligne de commande), accumuler
                existing_produit = produits_dict[produit.id]
                
                # On part des valeurs déjà modifiées en mémoire
                current_stock = Decimal(existing_produit.stock)
                current_pmp = Decimal(existing_produit.pmp)
                
                qty_received = Decimal(total_qty)
                cout_total = Decimal(quantity_paid) * Decimal(item.price_cost)
                
                new_total_qty = current_stock + qty_received
                
                if new_total_qty > 0:
                    current_val = current_stock * current_pmp
                    incoming_val = cout_total
                    new_pmp = (current_val + incoming_val) / new_total_qty
                    existing_produit.pmp = new_pmp
                
                existing_produit.stock += Decimal(total_qty)
        
        # Phase 2: Écritures en base de données (bulk operations)
        
        # 2.1 Gérer les lots (Création ou Mise à jour si collision)
        if lots_dict:
            lots_to_create = []
            lots_to_update = []
            
            # Vérifier les collisions avec des lots existants en une seule requête si possible
            # Mais par sécurité et simplicité pour gérer les PMP de lots, on va faire un check par lot
            for key, lot_data in lots_dict.items():
                existing_db_lot = StockLot.objects.filter(produit_id=key[0], lot=key[1]).first()
                if existing_db_lot:
                    # Collision détectée avec un lot déjà en base : On fusionne
                    old_total = Decimal(existing_db_lot.quantity_initial)
                    new_total = old_total + Decimal(lot_data.quantity_initial)
                    
                    if new_total > 0:
                        # PMP du lot
                        val_old = old_total * Decimal(existing_db_lot.price_cost)
                        val_new = Decimal(lot_data.quantity_initial) * Decimal(lot_data.price_cost)
                        existing_db_lot.price_cost = (val_old + val_new) / new_total
                    
                    existing_db_lot.quantity_initial += lot_data.quantity_initial
                    existing_db_lot.quantity_paid += lot_data.quantity_paid
                    existing_db_lot.quantity_free += lot_data.quantity_free
                    existing_db_lot.quantity_remaining += lot_data.quantity_remaining
                    # Garder la date d'expiration la plus éloignée ou celle du nouveau lot ?
                    # On garde l'existante ou on met à jour si la nouvelle est fournie
                    if lot_data.date_expiration:
                        existing_db_lot.date_expiration = lot_data.date_expiration
                    
                    lots_to_update.append(existing_db_lot)
                else:
                    lots_to_create.append(lot_data)
            
            if lots_to_create:
                StockLot.objects.bulk_create(lots_to_create, batch_size=100)
            if lots_to_update:
                StockLot.objects.bulk_update(
                    lots_to_update, 
                    ['quantity_initial', 'quantity_paid', 'quantity_free', 'quantity_remaining', 'price_cost', 'date_expiration'],
                    batch_size=100
                )
        
        # 2.2 Mettre à jour tous les produits en batch
        if produits_to_update:
            # Séparer les produits avec gestion de lots (update PMP only) 
            # et sans gestion de lots (update stock + PMP)
            produits_with_lots = [p for p in produits_to_update if p.use_lot_management]
            produits_without_lots = [p for p in produits_to_update if not p.use_lot_management]
            
            if produits_with_lots:
                Produit.objects.bulk_update(
                    produits_with_lots, 
                    ['pmp', 'stock'], 
                    batch_size=100
                )
            
            if produits_without_lots:
                Produit.objects.bulk_update(
                    produits_without_lots, 
                    ['stock', 'pmp'], 
                    batch_size=100
                )
        
        # 2.3 Mettre à jour le statut et la date de clôture de la commande
        commande.status = Commande.Status.CLOTUREE
        commande.save(update_fields=['status', 'date_cloture'])
        
        # 2.4 Créer les MouvementStock pour historique permanent
        mouvements_to_create = []
        for item in items:
            total_qty = item.quantity + item.unites_gratuites
            produit = product_map.get(item.produit_id)
            if produit:
                mouvements_to_create.append(MouvementStock(
                    produit=produit,
                    type_mouvement=MouvementStock.TypeMouvement.ENTREE,
                    quantite=total_qty,
                    stock_apres=produit.stock,
                    user=request.user if request else None,
                    description=f"Clôture commande #{commande.id} - {commande.fournisseur.name if commande.fournisseur else 'Inconnu'}"
                ))
        if mouvements_to_create:
            MouvementStock.objects.bulk_create(mouvements_to_create, batch_size=100)
        
        # 2.5 Mettre à jour la date de dernier achat pour tous les produits
        today = date.today()
        # Important: utiliser l'ID du produit dans la liste product_ids
        # Log Audit
        total_amount = sum(item.quantity * item.price for item in items)
        log_audit(
            user=request.user,
            action=AuditLog.Action.ORDER_RECEIVE,
            model_name='Commande',
            object_id=commande.id,
            description=f"Réception Commande #{commande.id} - {commande.fournisseur.name if commande.fournisseur else 'Inconnu'}",
            details={
                'commande_id': commande.id,
                'fournisseur': commande.fournisseur.name if commande.fournisseur else 'N/A',
                'items_count': items.count(),
                'total_amount': float(total_amount)
            },
            request=request
        )

        Produit.objects.filter(id__in=product_ids).update(dernier_achat=today)

        return Response({'status': 'Commande clôturée, stock mis à jour (UG incluses) et lots créés.'})

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def annuler_reception(self, request, pk=None):
        """
        Annule la réception d'une commande clôturée.
        - Retire le stock ajouté lors de la clôture
        - Supprime les lots de stock créés
        - Enregistre un ajustement de stock négatif
        - Repasse la commande en statut PREP
        """
        commande = self.get_object()
        
        if commande.status != Commande.Status.CLOTUREE:
            return Response(
                {'detail': 'Seule une commande clôturée peut être annulée.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Récupérer tous les produits de la commande
        items = commande.produits.select_related('produit').all()
        
        if not items.exists():
            commande.status = Commande.Status.EN_PREPARATION
            commande.date_cloture = None
            commande.save(update_fields=['status', 'date_cloture'])
            return Response({'status': 'Commande vide, statut repassé en préparation.'})
        
        # Verrouiller les produits pour éviter les modifications concurrentes
        product_ids = [item.produit_id for item in items]
        locked_products = list(Produit.objects.select_for_update().filter(id__in=product_ids))
        product_map = {p.id: p for p in locked_products}
        
        produits_to_update = []
        produits_dict = {}
        
        # Phase 1: Calculer les retraits de stock
        for item in items:
            quantity_paid = item.quantity
            quantity_free = item.unites_gratuites
            total_qty = quantity_paid + quantity_free
            
            produit = product_map.get(item.produit_id)
            if not produit:
                continue
            
            # Accumuler les quantités à retirer par produit
            if produit.id not in produits_dict:
                produits_dict[produit.id] = {
                    'produit': produit,
                    'qty_to_remove': Decimal(total_qty),
                    'items': [item]
                }
                produits_to_update.append(produit)
            else:
                produits_dict[produit.id]['qty_to_remove'] += Decimal(total_qty)
                produits_dict[produit.id]['items'].append(item)
        
        # Phase 2: Mettre à jour les stocks et créer les mouvements
        mouvements_to_create = []
        for pid, data in produits_dict.items():
            produit = data['produit']
            qty_to_remove = data['qty_to_remove']
            
            old_stock = Decimal(produit.stock)
            new_stock = old_stock - qty_to_remove
            
            # Éviter stock négatif
            if new_stock < 0:
                new_stock = Decimal(0)
            
            produit.stock = new_stock
            
            # Créer un MouvementStock pour traçabilité
            mouvements_to_create.append(MouvementStock(
                produit=produit,
                type_mouvement=MouvementStock.TypeMouvement.AJUSTEMENT,
                quantite=-int(qty_to_remove),  # Négatif car on retire
                stock_apres=int(new_stock),
                user=request.user,
                description=f"Annulation réception commande #{commande.id}"
            ))
        
        # Phase 3: Supprimer les lots de stock créés lors de la clôture
        lots_to_delete = StockLot.objects.filter(commande_produit__commande=commande)
        deleted_lots_count = lots_to_delete.count()
        lots_to_delete.delete()
        
        # Phase 4: Bulk update des produits
        if produits_to_update:
            Produit.objects.bulk_update(produits_to_update, ['stock'], batch_size=100)
        
        # Phase 5: Créer les mouvements en bulk
        if mouvements_to_create:
            MouvementStock.objects.bulk_create(mouvements_to_create, batch_size=100)
        
        # Phase 6: Mettre à jour le statut de la commande
        commande.status = Commande.Status.EN_PREPARATION
        commande.date_cloture = None
        commande.save(update_fields=['status', 'date_cloture'])
        
        # Log audit
        # Log audit
        log_audit(
            user=request.user,
            action=AuditLog.Action.ORDER_CANCEL,
            model_name='Commande',
            object_id=commande.id,
            description=f"Annulation réception commande #{commande.id}: stock retiré, {deleted_lots_count} lots supprimés",
            details={
                 'commande_id': commande.id,
                 'produits_affectes': len(produits_dict),
                 'lots_supprimes': deleted_lots_count
            },
            request=request
        )
        
        return Response({
            'status': 'Réception annulée avec succès.',
            'details': {
                'produits_affectes': len(produits_dict),
                'lots_supprimes': deleted_lots_count,
                'nouveau_statut': 'En préparation'
            }
        })

    @action(detail=True, methods=['get'])
    def imprimer_reception(self, request, pk=None):
        """
        Génère un PDF pour le bon de réception d'une commande.
        """
        commande = self.get_object()

        if commande.status != Commande.Status.CLOTUREE:
            return Response({'detail': 'Le bon de réception ne peut être généré que pour une commande clôturée.'}, status=status.HTTP_400_BAD_REQUEST)

        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="reception_commande_{commande.id}.pdf"'

        buffer = io.BytesIO()

        company_info = {
            "name": "Djadeu Pharmacy",
            "address": "Logbessou",
            "tel": "697268949"
        }

        # Date de réception : Utiliser la date de clôture si disponible, sinon maintenant (fallback)
        date_reception_str = commande.date_cloture.strftime("%d/%m/%Y") if commande.date_cloture else datetime.now().strftime("%d/%m/%Y")

        commande_info = {
            "commande_id": commande.id,
            "fournisseur_name": commande.fournisseur.name,
            "fournisseur_address": commande.fournisseur.address,
            "date_commande": commande.date.strftime("%d/%m/%Y"),
            "date_reception": date_reception_str
        }

        doc = BaseDocTemplate(buffer, pagesize=letter, topMargin=2.5*inch, bottomMargin=1*inch)
        total_achat = sum(item.price * item.quantity for item in commande.produits.all())
        
        # Create a Frame for the content
        frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='normal')

        # Create a PageTemplate and add the header/footer function
        template = PageTemplate(id='main_template', frames=[frame], 
                                onPage=lambda canvas, doc: header_footer(canvas, doc, company_info, commande_info, total_achat))
        doc.addPageTemplates([template])

        story = []
        
        # Table Header
        data = [['ID', 'Nom', 'Prix Achat', 'Prix Vente', 'Stock Avant', 'Qte Reçue', 'Stock Après']]
        
        for item in commande.produits.all():
            produit = item.produit
            stock_apres = produit.stock
            stock_avant = stock_apres - item.quantity
            
            data.append([
                str(produit.id),
                produit.name,
                str(item.price),
                str(produit.selling_price),
                str(stock_avant),
                str(item.quantity),
                str(stock_apres)
            ])

        table = Table(data, colWidths=[0.5*inch, 2*inch, 1*inch, 1*inch, 1*inch, 1*inch, 1*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#008080')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(table)

        styles = getSampleStyleSheet()
        total_text = f"<b>Montant d'achat final: {total_achat} F</b>"
        p_total = Paragraph(total_text, styles['h3'])
        story.append(p_total)

        doc.build(story)

        pdf = buffer.getvalue()
        buffer.close()
        response.write(pdf)

        return response

    @action(detail=True, methods=['get'])
    def imprimer_etiquettes(self, request, pk=None):
        """
        Génère un PDF d'étiquettes pour les produits d'une commande.
        Format: 40x20mm ou 30x15mm (paramètre 'format' dans query)
        Contenu: nom produit, lot, fournisseur, code-barres (CIP), date d'entrée, prix de vente
        """
        commande = self.get_object()
        
        # Paramètres (renamed from 'format' to 'label_format' to avoid DRF conflict)
        label_format = request.query_params.get('label_format', '40x20')  # '40x20' ou '30x15'
        
        # Dimensions en mm convertis en points (1mm = 2.83465 points)
        mm_to_points = 2.83465
        if label_format == '30x15':
            label_width = 30 * mm_to_points  # ~85 points
            label_height = 15 * mm_to_points  # ~42 points
        else:  # 40x20 par défaut
            label_width = 40 * mm_to_points  # ~113 points
            label_height = 20 * mm_to_points  # ~57 points
        
        buffer = io.BytesIO()
        
        # Créer le PDF avec une page par étiquette (format rouleau)
        # Liste pour stocker toutes les étiquettes
        labels_data = []
        
        # Récupérer tous les produits de la commande
        for item in commande.produits.all():
            produit = item.produit
            quantity = item.quantity + item.unites_gratuites  # Total reçu
            
            # Récupérer le lot de la commande (priorité) ou générer un par défaut
            lot_info = item.lot if item.lot else f"LOT-{commande.id}-{produit.id}"
            
            # Utiliser la date de clôture (réception effective) si disponible, sinon date commande
            ref_date = commande.date_cloture if commande.date_cloture else commande.date
            date_entree = ref_date.strftime('%d/%m/%Y') if ref_date else ""
            
            fournisseur_name = commande.fournisseur.name if commande.fournisseur else ""
            invoice_ref = commande.numero_facture if commande.numero_facture else ""
            
            # Déterminer quel CIP utiliser pour le code-barres
            barcode_value = produit.cip1 or produit.cip2 or produit.cip3 or str(produit.id).zfill(8)
            
            # Utiliser le prix de vente au moment de la commande (item.selling_price)
            # Si non disponible, utiliser le prix actuel du produit
            selling_price = float(item.selling_price) if item.selling_price else float(produit.selling_price)
            
            # Créer une étiquette pour chaque unité
            for _ in range(quantity):
                labels_data.append({
                    'product_name': produit.name,
                    'lot': lot_info,
                    'fournisseur': fournisseur_name,
                    'barcode': barcode_value,
                    'date_entree': date_entree,
                    'selling_price': selling_price,
                    'invoice_ref': invoice_ref
                })
        
        # Mode debug pour tester les positions (optionnel)
        debug_mode = request.data.get('debug_mode', False)
        
        # Créer le PDF avec SimpleDocTemplate - marges NULLES
        doc = SimpleDocTemplate(
            buffer,
            pagesize=(label_width, label_height),
            topMargin=0,  # Pas de marge
            bottomMargin=0,
            leftMargin=0,
            rightMargin=0
        )
        
        story = []
        styles = getSampleStyleSheet()
        
        # Style personnalisé ultra-compact
        style_small = ParagraphStyle(
            'SmallLeft',
            parent=styles['Normal'],
            fontSize=5 if label_format == '30x15' else 6,
            alignment=0,
            leading=5.5 if label_format == '30x15' else 6.5,
            spaceAfter=0,
            spaceBefore=0,
            leftIndent=0,
            rightIndent=1
        )
        
        style_tiny = ParagraphStyle(
            'TinyLeft',
            parent=styles['Normal'],
            fontSize=4 if label_format == '30x15' else 5,
            alignment=0,
            leading=4.5 if label_format == '30x15' else 5.5,
            spaceAfter=0,
            spaceBefore=0,
            leftIndent=1,
            rightIndent=1
        )
        
        # Générer chaque étiquette
        for label_data in labels_data:
            # Mode debug : dessiner bordure d'étiquette
            if debug_mode:
                from reportlab.platypus import Flowable
                from reportlab.lib.colors import red, blue, green
                
                class DebugBorder(Flowable):
                    def __init__(self, width, height):
                        Flowable.__init__(self)
                        self.width = width
                        self.height = 0.1
                    
                    def draw(self):
                        self.canv.setStrokeColor(red)
                        self.canv.setLineWidth(0.5)
                        self.canv.rect(0, 0, label_width, label_height)
                        # Grille
                        self.canv.setStrokeColor(blue)
                        self.canv.setLineWidth(0.2)
                        for i in range(0, int(label_height), 10):
                            self.canv.line(0, i, label_width, i)
                
                story.append(DebugBorder(label_width, label_height))
            
            # Nom du produit (tronqué pour tenir sur UNE SEULE ligne)
            max_chars = 20 if label_format == '30x15' else 30
            product_name = label_data['product_name']
            if len(product_name) > max_chars:
                product_name = product_name[:max_chars-3] + '...'
            
            story.append(Paragraph(f"<b>{product_name}</b>", style_small))
            
            # Espace plus grand AVANT le code-barres (1.9)
            story.append(Spacer(1, 1.9))
            
            # Code-barres - TRÈS compact
            if label_data['barcode']:
                try:
                    from reportlab.platypus import Flowable
                    
                    class BarcodeFlowable(Flowable):
                        def __init__(self, barcode_value, barcode_height_mm, barcode_width_factor, debug=False):
                            Flowable.__init__(self)
                            self.barcode_value = barcode_value
                            self.barcode_height_mm = barcode_height_mm
                            self.barcode_width_factor = barcode_width_factor
                            self.debug = debug
                            self.width = label_width - 2
                            self.height = barcode_height_mm * mm_to_points
                        
                        def draw(self):
                            barcode_obj = code128.Code128(
                                str(self.barcode_value),
                                barHeight=self.barcode_height_mm * mm_to_points,
                                barWidth=self.barcode_width_factor
                            )
                            barcode_obj.drawOn(self.canv, 0, 0)
                            
                            # Debug : bordure autour du code-barres
                            if self.debug:
                                from reportlab.lib.colors import green
                                self.canv.setStrokeColor(green)
                                self.canv.setLineWidth(0.5)
                                self.canv.rect(0, 0, self.width, self.height)
                    
                    # Barcode ultra-compact
                    barcode_height_mm = 4 if label_format == '30x15' else 5
                    barcode_width_factor = 0.5 if label_format == '30x15' else 0.7
                    
                    barcode_flowable = BarcodeFlowable(
                        label_data['barcode'],
                        barcode_height_mm,
                        barcode_width_factor,
                        debug=debug_mode
                    )
                    story.append(barcode_flowable)
                    
                except Exception as e:
                    import traceback
                    logger.error(f"Erreur génération code-barres: {e}", exc_info=True)
                    story.append(Paragraph(f"<b>{label_data['barcode']}</b>", style_tiny))
            
            # Espace plus grand après le code-barres
            story.append(Spacer(1, 1.9))
            
            # Informations sur 2 lignes avec Table pour alignement
            
            # Styles spécifiques pour la Table
            style_price = ParagraphStyle(
                'PriceRight',
                parent=styles['Normal'],
                fontSize=8 if label_format == '30x15' else 9,  # Police plus grosse
                alignment=2,  # Alignement DROITE
                leading=8 if label_format == '30x15' else 9,
                spaceAfter=0,
                spaceBefore=0,
                rightIndent=1
            )
            
            style_center = ParagraphStyle(
                'CenterTiny',
                parent=style_tiny,
                alignment=1,  # Alignement CENTRE
            )
            
            # Ligne 1: Lot (Gauche) + Date (Milieu) + Prix (Droite)
            lot_text = f"L:{label_data['lot'][:8]}" if label_data['lot'] else ""
            
            # La date est déjà formatée en DD/MM/YYYY lors de la préparation des données
            date_text = str(label_data['date_entree']) if label_data['date_entree'] else ""
            
            price_text = f"<b>{label_data['selling_price']:.0f}F</b>"
            
            # Table 3 colonnes : 30% Lot, 35% Date, 35% Prix
            data = [[
                Paragraph(lot_text, style_tiny),
                Paragraph(date_text, style_center),
                Paragraph(price_text, style_price)
            ]]
            
            # Ajuster largeurs pour 3 colonnes (plus de place pour la date)
            col1 = label_width * 0.30
            col2 = label_width * 0.35
            col3 = label_width * 0.35
            
            t = Table(data, colWidths=[col1, col2, col3])
            t.setStyle(TableStyle([
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                ('ALIGN', (0,0), (0,0), 'LEFT'),   # Lot à gauche
                ('ALIGN', (1,0), (1,0), 'CENTER'), # Date au milieu
                ('ALIGN', (2,0), (2,0), 'RIGHT'),  # Prix à droite
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ]))
            story.append(t)
            
            # Espace verticla avant la ligne fournisseur (1.9mm)
            story.append(Spacer(1, 1.9 * mm_to_points))
            
            # Ligne 2: Fournisseur (Gauche) + Facture (Droite)
            if label_data['fournisseur'] or label_data.get('invoice_ref'):
                # Tronquer Fournisseur si trop long
                fourn_text = label_data['fournisseur'][:15]
                inv_text = f"Fact:{label_data['invoice_ref'][:8]}" if label_data.get('invoice_ref') else ""
                
                # Style aligné droite pour facture (définition AVANT usage)
                style_tiny_right = ParagraphStyle(
                    'TinyRight',
                    parent=style_tiny,
                    alignment=2,  # Alignement DROITE
                )
                
                # Table 2 colonnes : 60% Fournisseur, 40% Facture
                data_bottom = [[
                    Paragraph(fourn_text, style_tiny),
                    Paragraph(inv_text, style_tiny_right)
                ]]
                
                t_bottom = Table(data_bottom, colWidths=[label_width*0.55, label_width*0.45])
                t_bottom.setStyle(TableStyle([
                    ('LEFTPADDING', (0,0), (-1,-1), 0),
                    ('RIGHTPADDING', (0,0), (-1,-1), 0),
                    ('TOPPADDING', (0,0), (-1,-1), 0),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                    ('ALIGN', (0,0), (0,0), 'LEFT'),   # Fournisseur à gauche
                    ('ALIGN', (1,0), (1,0), 'RIGHT'),  # Facture à droite
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ]))
                story.append(t_bottom)
            
            # Saut de page pour la prochaine étiquette
            story.append(PageBreak())
        
        # Construire le PDF
        doc.build(story)
        
        buffer.seek(0)
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="etiquettes_commande_{commande.id}.pdf"'
        return response

class CommandeProduitViewSet(viewsets.ModelViewSet):
    """API endpoint for commande produits."""
    queryset = CommandeProduit.objects.select_related('produit', 'commande', 'commande__fournisseur').order_by('-created_at')
    serializer_class = CommandeProduitSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['produit']
    permission_classes = [IsAuthenticated]

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


class AvoirViewSet(viewsets.ModelViewSet):
    queryset = Avoir.objects.all().select_related('fournisseur', 'created_by').prefetch_related('produits__produit')
    serializer_class = AvoirSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['numero', 'fournisseur__name', 'observations']
    ordering_fields = ['date', 'created_at', 'numero']
    ordering = ['-date', '-created_at']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    def perform_destroy(self, instance):
        if instance.status == 'VALIDEE':
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Impossible de supprimer un avoir validé.")
        super().perform_destroy(instance)
    
    @action(detail=True, methods=['post'])
    def valider(self, request, pk=None):
        '''Valider l avoir et retirer du stock'''
        avoir = self.get_object()
        
        if avoir.status == 'VALIDEE':
            return Response({'error': 'Avoir déjà validé'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                # Retirer du stock pour chaque ligne
                for ligne in avoir.produits.all():
                    produit = ligne.produit
                    
                    # If specific lot is selected, destock from that lot
                    if ligne.stock_lot:
                        lot = ligne.stock_lot
                        
                        # Validate lot has sufficient quantity
                        if lot.quantity_remaining < ligne.quantity:
                            return Response({
                                'error': f'Lot {lot.lot} ne contient que {lot.quantity_remaining} unités, impossible de retourner {ligne.quantity} unités'
                            }, status=status.HTTP_400_BAD_REQUEST)
                        
                        # Destock from specific lot
                        lot.quantity_remaining -= ligne.quantity
                        lot.save()
                        
                        # Also update text fields for reference
                        if not ligne.lot:
                            ligne.lot = lot.lot
                        if not ligne.date_expiration:
                            ligne.date_expiration = lot.date_expiration
                        ligne.save()
                    
                    # Update general product stock
                    if produit.use_lot_management and ligne.stock_lot:
                        # For lot-managed products, recalculate stock from lots
                        produit.calculate_stock_from_lots()
                    else:
                        # For non-lot products, decrement manually
                        produit.stock -= ligne.quantity
                        produit.save()
                    
                    # Créer le mouvement de stock pour l'historique
                    lot_info = f" - Lot: {ligne.stock_lot.lot}" if ligne.stock_lot else ""
                    MouvementStock.objects.create(
                        produit=produit,
                        type_mouvement=MouvementStock.TypeMouvement.AVOIR,
                        quantite=-ligne.quantity,  # Négatif car sortie de stock
                        stock_apres=produit.stock,
                        user=request.user,
                        description=f"Avoir {avoir.numero} - {avoir.fournisseur.name if avoir.fournisseur else 'Fournisseur'}{lot_info}"
                    )
                    
                    # Log audit (backup)
                    log_audit(
                        user=request.user,
                        action='STOCK_ADJ',
                        model_name='Avoir',
                        object_id=avoir.numero,
                        description=f"Validation Avoir {avoir.numero}",
                        details={
                            'produit_id': produit.id,
                            'produit_nom': ligne.produit_nom,
                            'quantity': -ligne.quantity,
                            'lot': ligne.lot,
                            'type_avoir': avoir.get_type_avoir_display()
                        },
                        request=request
                    )
                
                # Marquer comme validé
                avoir.status = 'VALIDEE'
                avoir.save()
                
                return Response({
                    'status': 'Avoir validé avec succès',
                    'avoir': AvoirSerializer(avoir).data
                })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class LigneAvoirViewSet(viewsets.ModelViewSet):
    queryset = LigneAvoir.objects.all().select_related('avoir', 'produit')
    serializer_class = LigneAvoirSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['avoir']


class PromisViewSet(MultiTermSearchMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing Promis (products promised to clients).
    """
    queryset = Promis.objects.select_related('client', 'produit', 'facture', 'created_by').all()
    serializer_class = PromisSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'client', 'produit']
    search_fields = ['client_name', 'client_phone', 'produit__name', 'notes']
    ordering_fields = ['date_promis', 'status']
    ordering = ['-date_promis']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def delivrer(self, request, pk=None):
        """
        Marquer un promis comme délivré.
        """
        promis = self.get_object()
        
        if promis.status == Promis.Status.DELIVRE:
            return Response({'detail': 'Ce promis est déjà marqué comme délivré.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if promis.status == Promis.Status.ANNULE:
            return Response({'detail': 'Impossible de délivrer un promis annulé.'}, status=status.HTTP_400_BAD_REQUEST)
        
        promis.status = Promis.Status.DELIVRE
        promis.date_livraison = timezone.now()
        promis.save()
        
        return Response({
            'detail': f'Promis #{promis.id} marqué comme délivré.',
            'promis': PromisSerializer(promis).data
        })

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def annuler_et_reintegrer(self, request, pk=None):
        """
        Annuler un promis et réintégrer le stock.
        Crée un mouvement de stock de type RETOUR (affiché en vert dans les stats).
        """
        promis = self.get_object()
        
        if promis.status == Promis.Status.ANNULE:
            return Response({'detail': 'Ce promis est déjà annulé.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if promis.status == Promis.Status.DELIVRE:
            return Response({'detail': 'Impossible d\'annuler un promis déjà délivré.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 1. Réintégrer le stock
        produit = promis.produit
        
        # Pour les produits avec gestion par lots, le stock est géré automatiquement par les signaux
        if not produit.use_lot_management:
            produit.stock += promis.quantite
            produit.save(update_fields=['stock'])
        
        # 2. Créer le mouvement de stock (type RETOUR = affiché en vert)
        from ..models import MouvementStock # Import local if not globally available
        final_stock = produit.stock # Simplified
        MouvementStock.objects.create(
            produit=produit,
            type_mouvement=MouvementStock.TypeMouvement.RETOUR,
            quantite=promis.quantite,
            stock_apres=final_stock,
            user=request.user,
            description=f"Réintégration stock - Annulation promis #{promis.id} (Client: {promis.client_display})"
        )
        
        # 3. Mettre à jour le statut du promis
        promis.status = Promis.Status.ANNULE
        promis.notes = f"{promis.notes}\n[Annulé le {timezone.now().strftime('%d/%m/%Y %H:%M')} par {request.user.username}]".strip()
        promis.save()
        
        return Response({
            'detail': f'Promis #{promis.id} annulé. {promis.quantite} unité(s) réintégrée(s) au stock de {produit.name}.',
            'promis': PromisSerializer(promis).data,
            'nouveau_stock': produit.stock
        })

    @action(detail=True, methods=['get'])
    def imprimer_ticket(self, request, pk=None):
        """
        Génère un ticket PDF 80mm x 80mm en double (pharmacie + client).
        """
        promis = self.get_object()
        
        # Taille ticket 80mm x 80mm (environ 227 x 227 points)
        ticket_width = 227
        ticket_height = 227
        
        buffer = io.BytesIO()
        from reportlab.pdfgen import canvas as pdf_canvas
        c = pdf_canvas.Canvas(buffer, pagesize=(ticket_width, ticket_height * 2 + 20))
        
        def draw_ticket(y_offset, title):
            # Titre
            c.setFont("Helvetica-Bold", 10)
            c.drawCentredString(ticket_width / 2, y_offset + ticket_height - 15, "TICKET PROMIS")
            c.setFont("Helvetica", 8)
            c.drawCentredString(ticket_width / 2, y_offset + ticket_height - 28, f"({title})")
            
            # Ligne séparatrice
            c.line(10, y_offset + ticket_height - 35, ticket_width - 10, y_offset + ticket_height - 35)
            
            # Date
            c.setFont("Helvetica", 8)
            date_str = promis.date_promis.strftime('%d/%m/%Y %H:%M')
            c.drawString(10, y_offset + ticket_height - 50, f"Date: {date_str}")
            c.drawRightString(ticket_width - 10, y_offset + ticket_height - 50, f"N° {promis.id}")
            
            # Client
            c.setFont("Helvetica-Bold", 9)
            c.drawString(10, y_offset + ticket_height - 70, "CLIENT:")
            c.setFont("Helvetica", 9)
            client_name = promis.client_display[:25] if len(promis.client_display) > 25 else promis.client_display
            c.drawString(50, y_offset + ticket_height - 70, client_name)
            
            # Téléphone
            c.setFont("Helvetica", 8)
            phone = promis.client_phone_display or "N/A"
            c.drawString(10, y_offset + ticket_height - 85, f"Tél: {phone}")
            
            # Ligne séparatrice
            c.line(10, y_offset + ticket_height - 95, ticket_width - 10, y_offset + ticket_height - 95)
            
            # Produit
            c.setFont("Helvetica-Bold", 9)
            c.drawString(10, y_offset + ticket_height - 110, "PRODUIT PROMIS:")
            
            c.setFont("Helvetica", 9)
            produit_name = promis.produit.name[:30] if len(promis.produit.name) > 30 else promis.produit.name
            c.drawString(10, y_offset + ticket_height - 125, produit_name)
            
            # Quantité
            c.setFont("Helvetica-Bold", 12)
            c.drawCentredString(ticket_width / 2, y_offset + ticket_height - 150, f"Quantité: {promis.quantite}")
            
            # Ligne séparatrice
            c.line(10, y_offset + ticket_height - 165, ticket_width - 10, y_offset + ticket_height - 165)
            
            # Message
            c.setFont("Helvetica-Oblique", 7)
            c.drawCentredString(ticket_width / 2, y_offset + ticket_height - 180, "Conservez ce ticket comme preuve")
            c.drawCentredString(ticket_width / 2, y_offset + ticket_height - 190, "de votre réservation.")
            
            # Statut
            c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(ticket_width / 2, y_offset + ticket_height - 210, f"Statut: {promis.get_status_display()}")
            
            # Cadre
            c.rect(5, y_offset + 5, ticket_width - 10, ticket_height - 10)
        
        # Dessiner le ticket pharmacie (en haut)
        draw_ticket(ticket_height + 10, "EXEMPLAIRE PHARMACIE")
        
        # Ligne de découpe
        c.setDash(3, 3)
        c.line(0, ticket_height + 5, ticket_width, ticket_height + 5)
        c.setDash()
        c.setFont("Helvetica", 6)
        c.drawCentredString(ticket_width / 2, ticket_height + 7, "✂ DECOUPER ICI ✂")
        
        # Dessiner le ticket client (en bas)
        draw_ticket(0, "EXEMPLAIRE CLIENT")
        
        c.showPage()
        c.save()
        
        buffer.seek(0)
        from django.http import HttpResponse
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="ticket_promis_{promis.id}.pdf"'
        return response

    @action(detail=False, methods=['post'])
    def imprimer_ticket_groupe(self, request):
        """
        Génère un ticket unique pour une liste de Promis.
        Attend un payload JSON: { "ids": [1, 2, 3] }
        """
        promis_ids = request.data.get('ids', [])
        if not promis_ids:
            return Response({'detail': 'Aucun ID fourni.'}, status=status.HTTP_400_BAD_REQUEST)

        promis_list = Promis.objects.filter(id__in=promis_ids).select_related('client', 'produit', 'facture')
        if not promis_list.exists():
            return Response({'detail': 'Aucun Promis trouvé.'}, status=status.HTTP_404_NOT_FOUND)

        # On suppose que tous les promis sont pour le même client
        first_promis = promis_list.first()
        client = first_promis.client
        client_name = first_promis.client_name or (client.name if client else "Client Inconnu")
        client_phone = first_promis.client_phone or (client.phone if client else "")

        # Génération du PDF (Ticket 80mm)
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import mm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        
        # Dimensions 80mm
        ticket_width = 80 * mm
        ticket_height = 200 * mm 
        
        from django.http import HttpResponse
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="ticket_promis_groupe_{first_promis.id}.pdf"'

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=(ticket_width, ticket_height),
                                rightMargin=2*mm, leftMargin=2*mm,
                                topMargin=2*mm, bottomMargin=2*mm)

        styles = getSampleStyleSheet()
        style_normal = styles["Normal"]
        style_center = ParagraphStyle('Center', parent=styles['Normal'], alignment=1) # 1=Center

        elements = []

        # En-tête
        elements.append(Paragraph("<b>Djadeu Pharmacy</b>", style_center))
        elements.append(Paragraph("TICKET PROMIS (RELIQUAT)", style_center))
        elements.append(Spacer(1, 2*mm))
        
        elements.append(Paragraph(f"Client: {client_name}", style_normal))
        if client_phone:
            elements.append(Paragraph(f"Tel: {client_phone}", style_normal))
        
        elements.append(Paragraph(f"Date: {first_promis.date_promis.strftime('%d/%m/%Y %H:%M')}", style_normal))
        elements.append(Spacer(1, 2*mm))

        # Tableau des produits promis
        data = [['Produit', 'Qté']]
        for promis in promis_list:
            data.append([
                Paragraph(promis.produit.name, style_normal),
                str(promis.quantite)
            ])

        table = Table(data, colWidths=[55*mm, 15*mm])
        table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        elements.append(table)

        elements.append(Spacer(1, 5*mm))
        elements.append(Paragraph("Veuillez conserver ce ticket pour récupérer vos produits.", style_center))
        
        doc.build(elements)
        pdf = buffer.getvalue()
        buffer.close()
        response.write(pdf)
        return response

    @action(detail=False, methods=['get'])
    def disponibles(self, request):
        """
        Retourne les promis en attente dont le produit est maintenant disponible en stock.
        Utile pour les alertes Dashboard et la page Promis.
        """
        from django.db.models import F
        
        # Promis en attente avec stock suffisant
        promis_disponibles = Promis.objects.filter(
            status=Promis.Status.EN_ATTENTE,
            produit__isnull=False
        ).select_related('client', 'produit', 'facture').annotate(
            stock_actuel=F('produit__stock')
        ).filter(
            stock_actuel__gte=F('quantite')
        ).order_by('-date_promis')
        
        # Sérialiser
        data = []
        for p in promis_disponibles:
            data.append({
                'id': p.id,
                'client': p.client_display,
                'client_phone': p.client_phone_display,
                'produit_id': p.produit.id if p.produit else None,
                'produit_nom': p.produit.name if p.produit else p.produit_nom,
                'quantite': p.quantite,
                'stock_actuel': p.produit.stock if p.produit else 0,
                'date_promis': p.date_promis.isoformat(),
                'jours_attente': (timezone.now() - p.date_promis).days
            })
        
        return Response({
            'count': len(data),
            'promis_disponibles': data
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generer_suggestions_commande(request):
    """
    Génère des suggestions de commandes selon le mode choisi.
    Supporte un budget_max optionnel pour limiter le montant total HT.
    """
    mode = request.data.get('mode', 'simple')
    periode = int(request.data.get('periode', 30))
    fournisseur_id = request.data.get('fournisseur_id')
    budget_max = request.data.get('budget_max')  # Optionnel, en HT
    
    # Convertir budget en float si fourni
    if budget_max:
        try:
            budget_max = float(budget_max)
        except (ValueError, TypeError):
            budget_max = None
    
    if mode == 'simple':
        suggestions, total_ht = calculer_reapprovisionnement_simple(
            periode=periode,
            fournisseur_id=fournisseur_id,
            budget_max=budget_max
        )
    else:
        suggestions, total_ht = calculer_optimisation_intelligente(
            periode=periode,
            fournisseur_id=fournisseur_id,
            budget_max=budget_max
        )
    
    return Response({
        'mode': mode,
        'periode': periode,
        'budget_max': budget_max,
        'total_ht': total_ht,
        'suggestions': suggestions,
        'total_produits': len(suggestions)
    })


def calculer_reapprovisionnement_simple(periode, fournisseur_id=None, budget_max=None):
    """
    Calcul simple : Qté = Quantité vendue sur la période.
    On remplace exactement ce qui est sorti.
    Si budget_max est fourni, on priorise les meilleurs vendeurs.
    """
    date_debut = timezone.now() - timedelta(days=periode)
    from django.db.models import Sum
    
    # Récupérer tous les produits
    produits = Produit.objects.all()
    if fournisseur_id:
        produits = produits.filter(fournisseur_id=fournisseur_id)
    
    suggestions = []
    
    for produit in produits:
        # Calculer les ventes sur la période
        ventes = FactureProduit.objects.filter(
            produit=produit,
            facture__date__gte=date_debut,
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(total=Sum('quantity'))['total'] or 0
        
        stock_actuel = produit.stock or 0
        
        # Réassort simple = on commande exactement ce qu'on a vendu
        qte_a_commander = int(ventes)
        
        # Calculer le montant HT
        prix_achat = float(produit.cost_price or 0)
        montant_ht = prix_achat * qte_a_commander
        
        # Calculer la raison
        raison = f"Vendu: {int(ventes)} unités sur {periode}j"
        if stock_actuel <= 0:
            raison += " (RUPTURE)"
        elif stock_actuel < ventes:
            raison += f" | Stock restant: {int(stock_actuel)}"
        
        # Ne garder que les produits avec des ventes ET quantité > 0
        if ventes > 0 and qte_a_commander > 0:
            suggestions.append({
                'produit_id': produit.id,
                'produit_nom': produit.name,
                'produit_ref': produit.cip1 or '',
                'fournisseur_id': produit.fournisseur.id if produit.fournisseur else None,
                'fournisseur_nom': produit.fournisseur.name if produit.fournisseur else 'N/A',
                'stock_actuel': int(stock_actuel),
                'ventes_periode': int(ventes),
                'quantite_suggeree': qte_a_commander,
                'prix_achat': prix_achat,
                'montant_ht': montant_ht,
                'prix_vente': float(produit.selling_price or 0),
                'tva': str(produit.tva or '0'),
                'taux_marge': str(produit.taux_marge or '1.3'),
                'rotation': 'N/A',
                'tendance': 'N/A',
                'urgence': 'urgent' if stock_actuel <= 0 else 'normal',
                'couverture_jours': int((stock_actuel / ventes) * periode) if ventes > 0 else 999,
                'is_supplier_exclusive': produit.is_supplier_exclusive,
                'exclusive_fournisseur_nom': produit.fournisseur.name if (produit.is_supplier_exclusive and produit.fournisseur) else None,
                'raison': raison
            })
    
    # Trier par ventes élevées (priorité selon demande utilisateur)
    suggestions.sort(key=lambda x: -x['ventes_periode'])
    
    # Appliquer le budget max si fourni
    if budget_max and budget_max > 0:
        filtered_suggestions = []
        cumul_ht = 0.0
        
        for item in suggestions:
            cost = item['montant_ht']
            
            if cumul_ht + cost <= budget_max * 1.05:  # Tolérance 5% pour le total
                filtered_suggestions.append(item)
                cumul_ht += cost
            else:
                # Essayer d'ajouter une quantité partielle
                remaining = budget_max - cumul_ht
                unit_price = item['prix_achat']
                
                if unit_price > 0 and remaining > 0:
                    qty_possible = int(remaining // unit_price)
                    # Si on peut en prendre au moins 1 et que ça en vaut la peine
                    if qty_possible > 0:
                        item['quantite_suggeree'] = qty_possible
                        item['montant_ht'] = qty_possible * unit_price
                        item['raison'] += " (Budget)"
                        filtered_suggestions.append(item)
                        cumul_ht += item['montant_ht']
                
                # On arrête dès qu'on ne peut plus ajouter un article complet ou partiel prioritaire
                break
        
        return filtered_suggestions, round(cumul_ht, 2)
    
    # Calculer le total HT
    total_ht = sum(item['montant_ht'] for item in suggestions)
    return suggestions, round(total_ht, 2)


def calculer_optimisation_intelligente(periode, fournisseur_id=None, budget_max=None):
    """
    Calcul optimisé avec rotation, tendances, stock.
    Stock cible = période sélectionnée (en jours de consommation).
    Si budget_max est fourni, on priorise les produits à plus fortes ventes.
    """
    # Utiliser une période d'analyse plus longue (30j minimum) pour des stats fiables
    periode_analyse = max(periode, 30)
    date_debut = timezone.now() - timedelta(days=periode_analyse)
    date_mi_periode = timezone.now() - timedelta(days=periode_analyse // 2)
    from django.db.models import Sum

    produits = Produit.objects.all()
    if fournisseur_id:
        produits = produits.filter(fournisseur_id=fournisseur_id)
    
    suggestions = []
    
    for produit in produits:
        # 1. Ventes totales sur période d'analyse
        ventes_total = FactureProduit.objects.filter(
            produit=produit,
            facture__date__gte=date_debut,
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(total=Sum('quantity'))['total'] or 0
        
        if ventes_total == 0:
            continue
        
        # 2. Consommation journalière moyenne
        conso_jour = float(ventes_total) / periode_analyse
        
        # 3. Stock actuel
        stock_actuel = int(produit.stock or 0)
        
        # 4. Couverture actuelle en jours
        if conso_jour > 0:
            couverture_jours = stock_actuel / conso_jour
        else:
            couverture_jours = 999
        
        # 5. Rotation (ventes / stock moyen)
        stock_moyen = max(stock_actuel, 1)
        rotation = float(ventes_total) / stock_moyen
        
        # 6. Tendance (période récente vs ancienne)
        ventes_recentes = FactureProduit.objects.filter(
            produit=produit,
            facture__date__gte=date_mi_periode,
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(total=Sum('quantity'))['total'] or 0
        
        ventes_anciennes = ventes_total - ventes_recentes
        if ventes_anciennes > 0:
            tendance = ventes_recentes / ventes_anciennes
        else:
            tendance = 1.0 if ventes_recentes > 0 else 0
        
        # 7. Stock cible = consommation journalière × période demandée
        stock_cible = conso_jour * periode
        qte_base = max(0, stock_cible - stock_actuel)
        
        # Ajustement selon rotation
        if rotation > 3:  # Haute rotation
            qte_base *= 1.2
            niveau_rotation = 'haute'
        elif rotation < 1:  # Faible rotation
            qte_base *= 0.8
            niveau_rotation = 'faible'
        else:
            niveau_rotation = 'normale'
        
        # Ajustement selon tendance
        qte_base *= min(tendance, 2.0)  # Plafonner à 2x pour éviter les excès
        
        qte_finale = int(round(qte_base))
        
        # Déterminer urgence selon la couverture vs période demandée
        ratio_couverture = couverture_jours / periode if periode > 0 else 999
        if ratio_couverture < 0.25:  # Moins de 25% de la période couverte
            urgence = 'urgent'
            score_urgence = 80
        elif ratio_couverture < 0.5:  # Moins de 50%
            urgence = 'bientot'
            score_urgence = 50
        else:
            urgence = 'normal'
            score_urgence = 20
        
        # Construire la raison
        raison = f"Couverture: {int(couverture_jours)}j/{periode}j. "
        if niveau_rotation == 'haute':
            raison += "Rotation élevée (+20%). "
        elif niveau_rotation == 'faible':
            raison += "Rotation faible (-20%). "
        if tendance > 1.2:
            raison += f"Tendance hausse (+{int((tendance-1)*100)}%)."
        elif tendance < 0.8:
            raison += f"Tendance baisse ({int((tendance-1)*100)}%)."
        
        # Calculer montant HT
        prix_achat = float(produit.cost_price or 0)
        qte_finale_finale = max(qte_finale, 0)
        montant_ht = prix_achat * qte_finale_finale
        
        # Ne garder que les produits avec quantité suggérée > 0
        if qte_finale_finale > 0:
            suggestions.append({
                'produit_id': produit.id,
                'produit_nom': produit.name,
                'produit_ref': produit.cip1 or '',
                'fournisseur_id': produit.fournisseur.id if produit.fournisseur else None,
                'fournisseur_nom': produit.fournisseur.name if produit.fournisseur else 'N/A',
                'stock_actuel': stock_actuel,
                'ventes_periode': int(ventes_total),
                'quantite_suggeree': qte_finale_finale,
                'prix_achat': prix_achat,
                'montant_ht': montant_ht,
                'prix_vente': float(produit.selling_price or 0),
                'tva': str(produit.tva or '0'),
                'taux_marge': str(produit.taux_marge or '1.3'),
                'rotation': niveau_rotation,
                'tendance': round(tendance, 2),
                'urgence': urgence,
                'score_urgence': score_urgence,
                'couverture_jours': int(couverture_jours),
                'is_supplier_exclusive': produit.is_supplier_exclusive,
                'exclusive_fournisseur_nom': produit.fournisseur.name if (produit.is_supplier_exclusive and produit.fournisseur) else None,
                'raison': raison
            })
    
    # Trier par ventes élevées (priorité selon demande utilisateur)
    suggestions.sort(key=lambda x: -x['ventes_periode'])
    
    # Appliquer le budget max si fourni
    if budget_max and budget_max > 0:
        filtered_suggestions = []
        cumul_ht = 0.0
        
        for item in suggestions:
            cost = item['montant_ht']
            
            if cumul_ht + cost <= budget_max * 1.05:  # Tolérance 5%
                filtered_suggestions.append(item)
                cumul_ht += cost
            else:
                 # Essayer d'ajouter une quantité partielle
                remaining = budget_max - cumul_ht
                unit_price = item['prix_achat']
                
                if unit_price > 0 and remaining > 0:
                    qty_possible = int(remaining // unit_price)
                    # Si on peut en prendre au moins 1
                    if qty_possible > 0:
                        item['quantite_suggeree'] = qty_possible
                        item['montant_ht'] = qty_possible * unit_price
                        item['raison'] += " (Budget)"
                        filtered_suggestions.append(item)
                        cumul_ht += item['montant_ht']
                
                break
        
        return filtered_suggestions, round(cumul_ht, 2)
    
    # Calculer le total HT
    total_ht = sum(item['montant_ht'] for item in suggestions)
    return suggestions, round(total_ht, 2)
