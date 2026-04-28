from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from decimal import Decimal
from django.db import transaction
from django.db.models import ProtectedError, F, Sum, DecimalField, Value, Count
from django.core.cache import cache
from django.contrib.auth.models import User
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

from ...models import (
    Commande, CommandeProduit, Produit, StockLot, StockAdjustment, AuditLog,
    Facture, MouvementStock, FactureProduitAllocation, PaiementFournisseur
)
from ...serializers import CommandeSerializer, CommandeProduitSerializer
from ...serializers_optimized import CommandeListSerializer, CommandeDetailSerializer, CommandeOmnisearchSerializer
from ...serializer_mixins import OptimizedSerializerMixin
from ...search_mixins import MultiTermSearchMixin
from ...audit_helpers import log_audit
from ...sudo_utils import validate_sudo_mode
from ...pagination import StandardResultsSetPagination
import logging

logger = logging.getLogger(__name__)
business_logger = logging.getLogger('api.business')

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
    - List view: Lightweight serializer (no products loaded)
    - Detail view: Complete serializer with all products
    """
    from django.db.models.functions import Coalesce
    from django.db.models import Value, OuterRef, Subquery

    # Base queryset — each aggregate uses an isolated Subquery to avoid the
    # cartesian product that occurs when annotating across multiple FK relations
    # (produits × paiements) in a single .annotate() call.
    queryset = Commande.objects.select_related('fournisseur', 'closed_by') \
        .annotate(
            total_annotated=Coalesce(
                Subquery(
                    CommandeProduit.objects.filter(commande=OuterRef('pk'))
                    .values('commande')
                    .annotate(s=Sum(F('quantity') * F('price'), output_field=DecimalField()))
                    .values('s')[:1]
                ),
                Value(0, output_field=DecimalField())
            ),
            montant_paye_annotated=Coalesce(
                Subquery(
                    PaiementFournisseur.objects.filter(commande=OuterRef('pk'))
                    .values('commande')
                    .annotate(s=Sum('montant', output_field=DecimalField()))
                    .values('s')[:1]
                ),
                Value(0, output_field=DecimalField())
            ),
            items_count=Coalesce(
                Subquery(
                    CommandeProduit.objects.filter(commande=OuterRef('pk'))
                    .values('commande')
                    .annotate(c=Count('id'))
                    .values('c')[:1]
                ),
                Value(0)
            ),
        ).order_by('-date')
        
    serializer_class = CommandeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['type', 'status', 'fournisseur']
    search_fields = ['id', 'fournisseur__name', 'numero_facture', 'fournisseur_nom']
    ordering_fields = ['date', 'status']
    
    def get_serializer_class(self):
        if self.request.query_params.get('layout') == 'omnisearch':
            return CommandeOmnisearchSerializer
        return super().get_serializer_class()

    # Serializers optimisés
    list_serializer_class = CommandeListSerializer
    detail_serializer_class = CommandeDetailSerializer

    def get_queryset(self):
        """
        Override to add prefetch_related only for detail views or omnisearch.
        List view doesn't need product data unless omnisearch is active.
        """
        qs = super().get_queryset()
        
        # Le paramètre 'omnisearch' ou l'action détermine si on affiche la liste des produits
        is_omnisearch = self.request.query_params.get('layout') == 'omnisearch'
        
        # Only prefetch products for detail views or omnisearch
        if self.action in ['retrieve', 'update', 'partial_update'] or is_omnisearch:
            qs = qs.prefetch_related(
                'produits__produit', 
                'produits__commande__fournisseur',
                'produits__stock_lot'  # Fix: Empêche N+1 sur instance.stock_lot.first()
            )
        
        return qs

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def ajouter_produit_auto(self, request):
        """
        Ajoute un produit à une commande en préparation pour son fournisseur.
        Si aucune commande n'existe, en crée une nouvelle.
        """
        produit_id = request.data.get('produit_id')
        quantity = int(request.data.get('quantity', 1))
        
        if not produit_id:
            return Response({'error': 'produit_id requis'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            produit = Produit.objects.get(pk=produit_id)
        except Produit.DoesNotExist:
            return Response({'error': 'Produit introuvable'}, status=status.HTTP_404_NOT_FOUND)
            
        fournisseur = produit.fournisseur
        if not fournisseur:
            # Essayer de trouver le dernier fournisseur via les commandes
            latest_cp = CommandeProduit.objects.filter(produit=produit).order_by('-commande__date').first()
            if latest_cp and latest_cp.commande.fournisseur:
                fournisseur = latest_cp.commande.fournisseur
        
        if not fournisseur:
            return Response({'error': 'Aucun fournisseur associé à ce produit. Veuillez en définir un d\'abord.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Chercher une commande en préparation pour ce fournisseur
        commande = Commande.objects.filter(
            fournisseur=fournisseur,
            status=Commande.Status.EN_PREPARATION
        ).first()
        
        created = False
        if not commande:
            commande = Commande.objects.create(
                fournisseur=fournisseur,
                status=Commande.Status.EN_PREPARATION,
                numero_facture=f"REASSORT_AUTO_{fournisseur.id}_{timezone.now().strftime('%Y%m%d')}",
                date=timezone.now()
            )
            created = True
            
        # Chercher si le produit est déjà dans la commande
        item = CommandeProduit.objects.filter(commande=commande, produit=produit).first()
        
        if item:
            item.quantity += quantity
            item.save(update_fields=['quantity'])
            msg = f"Quantité mise à jour dans la commande #{commande.id}"
        else:
            item = CommandeProduit.objects.create(
                commande=commande,
                produit=produit,
                quantity=quantity,
                price=produit.cost_price,
                price_cost=produit.cost_price,
                selling_price=produit.selling_price,
                tva=produit.tva
            )
            msg = f"Produit ajouté à la commande #{commande.id}"
            
        return Response({
            'status': 'success',
            'message': msg,
            'commande_id': commande.id,
            'created_new_order': created
        })

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def ajouter_produits_bulk(self, request):
        """
        Ajoute plusieurs produits aux commandes en préparation de leurs fournisseurs respectifs.
        Regroupe automatiquement les produits par fournisseur.
        """
        produit_ids = request.data.get('produit_ids', [])
        quantity = int(request.data.get('quantity', 1))
        
        if not produit_ids or not isinstance(produit_ids, list):
            return Response({'error': 'Liste de produit_ids requise'}, status=status.HTTP_400_BAD_REQUEST)
            
        summary = {
            'added': 0,
            'updated': 0,
            'errors': [],
            'orders_involved': set()
        }
        
        # Récupérer tous les produits concernés
        produits = Produit.objects.filter(pk__in=produit_ids).select_related('fournisseur')
        
        for produit in produits:
            fournisseur = produit.fournisseur
            if not fournisseur:
                latest_cp = CommandeProduit.objects.filter(produit=produit).order_by('-commande__date').first()
                if latest_cp and latest_cp.commande.fournisseur:
                    fournisseur = latest_cp.commande.fournisseur
            
            if not fournisseur:
                summary['errors'].append(f"Produit {produit.name} n'a pas de fournisseur associé.")
                continue
                
            commande = Commande.objects.filter(
                fournisseur=fournisseur,
                status=Commande.Status.EN_PREPARATION
            ).first()
            
            if not commande:
                commande = Commande.objects.create(
                    fournisseur=fournisseur,
                    status=Commande.Status.EN_PREPARATION,
                    numero_facture=f"REASSORT_AUTO_{fournisseur.id}_{timezone.now().strftime('%Y%m%d')}",
                    date=timezone.now()
                )
            
            summary['orders_involved'].add(commande.id)
            
            item = CommandeProduit.objects.filter(commande=commande, produit=produit).first()
            if item:
                item.quantity += quantity
                item.save(update_fields=['quantity'])
                summary['updated'] += 1
            else:
                CommandeProduit.objects.create(
                    commande=commande,
                    produit=produit,
                    quantity=quantity,
                    price=produit.cost_price,
                    price_cost=produit.cost_price,
                    selling_price=produit.selling_price,
                    tva=produit.tva
                )
                summary['added'] += 1
        
        summary['orders_involved'] = list(summary['orders_involved'])
        
        message = f"Opération terminée : {summary['added']} produits ajoutés, {summary['updated']} mis à jour."
        if summary['errors']:
            message += f" ({len(summary['errors'])} erreurs)"
            
        return Response({
            'status': 'success',
            'message': message,
            'summary': summary
        })

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_delete(self, request):
        """
        Supprime plusieurs commandes en une seule requête.
        Seules les commandes EN_PREPARATION ou EN_ATTENTE peuvent être supprimées.
        """
        import logging
        logger = logging.getLogger(__name__)

        ids = request.data.get('ids', [])
        if not ids:
            return Response({'detail': 'Aucun ID fourni.'}, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"Bulk delete requested for IDs: {ids}")
        
        # Validation Sudo (Optionnelle, selon la politique)
        # validation_user, error_res = validate_sudo_mode(request, permission_attr='can_delete_commande')
        # if error_res:
        #      return error_res
        
        commandes = Commande.objects.filter(id__in=ids)
        total_found = commandes.count()
        deletable = commandes.exclude(status=Commande.Status.CLOTUREE)
        total_deletable = deletable.count()
        
        if total_found > 0 and total_deletable == 0:
            logger.warning(f"Bulk delete failed: {total_found} orders found but all are closed.")
            return Response({
                'detail': 'Les commandes sélectionnées sont déjà clôturées et ne peuvent pas être supprimées.'
            }, status=status.HTTP_400_BAD_REQUEST)
            
        if total_deletable == 0:
             return Response({'detail': 'Aucune commande supprimable trouvée (elles sont peut-être introuvables ou déjà supprimées).'}, status=status.HTTP_400_BAD_REQUEST)

        deleted_ids = list(deletable.values_list('id', flat=True))
        
        try:
            # On laisse le cascade delete ou ProtectedError faire son travail
            logger.info(f"Deleting {total_deletable} orders: {deleted_ids}")
            deletable.delete()
        except ProtectedError as e:
            logger.error(f"ProtectedError during bulk delete: {str(e)}")
            # Extraire les objets qui empêchent la suppression (ex: FactureProduitAllocation)
            protected_list = list(e.protected_objects)
            descriptions = []
            for obj in protected_list[:3]: # Limiter à 3 pour la lisibilité
                descriptions.append(str(obj))
            
            error_detail = "Certaines commandes ne peuvent pas être supprimées car elles contiennent des lots déjà utilisés."
            if descriptions:
                error_detail += f" Éléments bloquants : {', '.join(descriptions)}"
                if len(protected_list) > 3:
                    error_detail += " ..."
                    
            return Response({
                'detail': error_detail
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
             logger.exception(f"Unexpected error during bulk delete: {str(e)}")
             transaction.set_rollback(True)
             return Response({'detail': f'Erreur lors de la suppression : {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        log_audit(
            user=request.user,
            action=AuditLog.Action.ORDER_CANCEL, # Or a new bulk cancel action
            model_name='Commande',
            object_id=str(deleted_ids),
            description=f"Suppression groupée de {len(deleted_ids)} commandes : {deleted_ids}",
            details={'ids': deleted_ids},
            request=request
        )

        return Response({
            'status': 'success',
            'message': f'{len(deleted_ids)} commandes supprimées avec succès.',
            'deleted_ids': deleted_ids,
            'skipped_count': total_found - total_deletable
        })

    def perform_destroy(self, instance):
        try:
            super().perform_destroy(instance)
        except Exception as e:
            from rest_framework.exceptions import ValidationError
            
            if isinstance(e, ProtectedError) or "ProtectedError" in str(type(e)):
                 raise ValidationError("Impossible de supprimer : Des lots de cette commande ont déjà été vendus ou utilisés.")
            raise e

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cloturer(self, request, pk=None):
        """
        Clôture une commande, met à jour le stock et calcule le PMP.
        Utilise select_for_update pour empêcher les modifications concurrentes (ventes) pendant le calcul.
        """
        commande = self.get_object()
        business_logger.info(f"[COMMANDE] Cloture demandee #{commande.id} par {request.user.username}")
        if commande.status == Commande.Status.CLOTUREE:
            business_logger.warning(f"[COMMANDE] Cloture refusee #{commande.id} - deja cloturee")
            return Response({'detail': 'Cette commande est déjà clôturée.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validation Sudo
        validation_user, error_res = validate_sudo_mode(request, permission_attr='can_close_commande')
        if error_res:
             return error_res
        # -------------------------

        # Enregistrer l'utilisateur qui clôture
        commande.closed_by = request.user
        commande.date_cloture = timezone.now()

        # Prefetch tous les produits de la commande en une seule requête
        items = commande.produits.select_related('produit', 'produit__fournisseur').all()
        
        if not items.exists():
            return Response({'detail': 'Aucun produit dans cette commande.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # VERROUILLAGE: On récupère les IDs des produits pour les verrouiller
        product_ids = [item.produit_id for item in items]
        
        # On verrouille les produits pour empêcher toute modification de stock (ex: vente concomitante)
        # TRÈS IMPORTANT: order_by('id') pour éviter les deadlocks en DB !
        locked_products = list(Produit.objects.select_for_update().filter(id__in=product_ids).order_by('id'))
        product_map = {p.id: p for p in locked_products}
        
        # Préparer les lots de stock à créer en batch
        lots_to_create = []
        produits_to_update = []
        produits_dict = {}  # Pour éviter les doublons et suivre les mises à jour
        
        # Phase 1: Calculs en mémoire (pas de DB writes)
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
                continue # Devrait pas arriver avec l'intégrité référentielle
            
            # 1. Préparer le lot de stock (si gestion par lots activée)
            if produit.use_lot_management:
                # Auto-générer le numéro de lot si non fourni
                lot_number = item.lot
                if not lot_number:
                    lot_number = f"CMD{commande.id}-{item.id}"
                    # Sauvegarder le lot généré dans l'item pour l'historique
                    item.lot = lot_number
                
                lot = StockLot(
                    produit=produit,
                    commande_produit=item,
                    fournisseur=commande.fournisseur if commande.fournisseur else produit.fournisseur,
                    quantity_initial=total_qty,
                    quantity_paid=quantity_paid,
                    quantity_free=quantity_free,
                    quantity_remaining=0 if produit.has_reserve_storage else total_qty,
                    quantity_reserved=total_qty if produit.has_reserve_storage else 0,
                    price_cost=effective_cost,
                    selling_price=produit.selling_price,
                    lot=lot_number,
                    date_expiration=item.date_expiration,
                    date_reception=commande.date_cloture
                )
                lots_to_create.append(lot)
            
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
                
                # Mettre à jour le stock (Rayon ou Réserve) avec précaution pour les valeurs nulles
                res_stock = Decimal(produit.stock_reserve or 0)
                if produit.has_reserve_storage:
                    produit.stock_reserve = res_stock + qty_received
                else:
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
        
        # 2.1 Créer tous les lots en une seule requête
        if lots_to_create:
            StockLot.objects.bulk_create(lots_to_create, batch_size=100)
            # Sauvegarder les numéros de lot auto-générés dans les items
            items_with_lot = [item for item in items if item.lot]
            if items_with_lot:
                CommandeProduit.objects.bulk_update(items_with_lot, ['lot'], batch_size=100)
        
        # 2.2 Mettre à jour tous les produits en batch
        if produits_to_update:
            # Séparer les produits avec gestion de lots (update PMP only) 
            # et sans gestion de lots (update stock + PMP)
            produits_with_lots = [p for p in produits_to_update if p.use_lot_management]
            produits_without_lots = [p for p in produits_to_update if not p.use_lot_management]
            
            if produits_with_lots:
                Produit.objects.bulk_update(
                    produits_with_lots, 
                    ['pmp', 'stock', 'stock_reserve'], 
                    batch_size=100
                )
            
            if produits_without_lots:
                Produit.objects.bulk_update(
                    produits_without_lots, 
                    ['stock', 'stock_reserve', 'pmp'], 
                    batch_size=100
                )
        
        # 2.3 Mettre à jour le statut et la date de clôture de la commande
        commande.status = Commande.Status.CLOTUREE
        commande.date = commande.date_cloture  # La commande est datée au jour de clôture
        
        # Renommer si c'est le réassort auto pour libérer le code
        if commande.numero_facture == 'REASSORT_AUTO':
            commande.numero_facture = f"REASSORT_{commande.date_cloture.strftime('%Y%m%d_%H%M')}_{commande.id}"

        # Calcul de l'échéance si mode FACTURE
        if commande.fournisseur and commande.fournisseur.type_reglement == 'FACTURE':
            if commande.fournisseur.delai_paiement_jours > 0:
                commande.date_echeance = commande.date_cloture.date() + timedelta(days=commande.fournisseur.delai_paiement_jours)
            else:
                commande.date_echeance = commande.date_cloture.date()

        commande.save(update_fields=['status', 'date_cloture', 'date', 'date_echeance', 'numero_facture', 'closed_by'])
        
        # 2.4 Mettre à jour la date de dernier achat pour tous les produits
        today = date.today()
        # Important: utiliser l'ID du produit dans la liste product_ids
        Produit.objects.filter(id__in=product_ids).update(dernier_achat=today)

        # 2.5 Créer les mouvements de stock (historique) avec la date de clôture (aujourd'hui)
        from ...models import MouvementStock
        mouvements_to_create = []
        for item in items:
            produit = product_map.get(item.produit_id)
            if not produit:
                continue
            total_qty = item.quantity + item.unites_gratuites
            mouvements_to_create.append(MouvementStock(
                produit=produit,
                type_mouvement=MouvementStock.TypeMouvement.ENTREE,
                quantite=total_qty,
                stock_apres=produit.total_stock,
                user=request.user,
                commande=commande,
                description=f"Réception commande #{commande.id}{' (' + commande.numero_facture + ')' if commande.numero_facture else ''} - Lot: {item.lot or 'N/A'} - Fournisseur: {commande.fournisseur.name if commande.fournisseur else 'N/A'}"
            ))
        
        if mouvements_to_create:
            MouvementStock.objects.bulk_create(mouvements_to_create, batch_size=100)

        # 2.6 Invalider le cache du dashboard (car bulk_update ne déclenche pas les signaux)
        cache.delete('dashboard_stats')

        # 2.7 Log d'audit pour chaque produit (car bulk_update ne déclenche pas les signaux)
        # On le fait de façon groupée ou individuelle selon le besoin de traçabilité fine
        for p in produits_to_update:
            log_audit(
                user=request.user,
                action=AuditLog.Action.UPDATE,
                model_name='Produit',
                object_id=str(p.id),
                description=f"Stock/PMP mis à jour via clôture commande #{commande.id}",
                details={'stock': str(p.stock), 'pmp': str(p.pmp)},
                request=request
            )

        business_logger.info(
            f"[COMMANDE] Cloture OK #{commande.id} | "
            f"fournisseur={commande.fournisseur.name if commande.fournisseur else 'N/A'} | "
            f"produits={len(product_ids)} | lots={len(lots_to_create)} | user={request.user.username}"
        )
        return Response({'status': 'Commande clôturée, stock mis à jour (UG incluses) et lots créés.'})

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
        source_lines = list(source_commande.produits.all())
        target_lines_map = {line.produit_id: line for line in target_commande.produits.all()}

        lines_moved = 0
        lines_merged = 0
        targets_to_update = []   # lignes cible dont les qtés ont été modifiées
        sources_to_move   = []   # lignes source à déplacer vers la cible

        for source_line in source_lines:
            if source_line.produit_id in target_lines_map:
                # Le produit existe déjà dans la cible : on additionne les quantités
                target_line = target_lines_map[source_line.produit_id]
                target_line.quantity += source_line.quantity
                target_line.unites_gratuites += source_line.unites_gratuites
                targets_to_update.append(target_line)
                lines_merged += 1
            else:
                # Le produit n'existe pas : on déplace la ligne
                source_line.commande = target_commande
                sources_to_move.append(source_line)
                lines_moved += 1

        from ...models import CommandeProduit
        # ── Bulk writes (2 requêtes max au lieu de N) ──────────────────────
        if targets_to_update:
            CommandeProduit.objects.bulk_update(
                targets_to_update, ['quantity', 'unites_gratuites'], batch_size=100
            )
        if sources_to_move:
            CommandeProduit.objects.bulk_update(
                sources_to_move, ['commande'], batch_size=100
            )

        # Supprimer les lignes fusionnées restées dans la source, puis la commande
        source_commande.produits.all().delete()
        source_commande.delete()
        
        return Response({
            'status': 'success',
            'message': f'Fusion réussie : {lines_moved} lignes déplacées, {lines_merged} lignes fusionnées.',
            'lines_moved': lines_moved,
            'lines_merged': lines_merged
        })

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
        business_logger.info(f"[COMMANDE] Annulation reception demandee #{commande.id} par {request.user.username}")
        
        if commande.status != Commande.Status.CLOTUREE:
            business_logger.warning(f"[COMMANDE] Annulation refusee #{commande.id} - status={commande.status}")
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
        # TRÈS IMPORTANT: order_by('id') pour éviter les deadlocks en DB !
        product_ids = [item.produit_id for item in items]
        locked_products = list(Produit.objects.select_for_update().filter(id__in=product_ids).order_by('id'))
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
                stock_apres=int(produit.total_stock),
                user=request.user,
                commande=commande,
                description=f"Annulation réception commande #{commande.id}{' (' + commande.numero_facture + ')' if commande.numero_facture else ''}"
            ))
        
        # Phase 3: Vérifier l'absence de ventes sur ces lots avant suppression
        lots_to_delete = StockLot.objects.filter(commande_produit__commande=commande)
        
        # Vérifier si un de ces lots est déjà utilisé dans une vente (via allocation)
        # On évite le ProtectedError brutal et on renvoie un message métier
        if FactureProduitAllocation.objects.filter(stock_lot__in=lots_to_delete).exists():
            business_logger.warning(f"[COMMANDE] Annulation refusee #{commande.id} - du stock a deja ete vendu")
            return Response(
                {'detail': 'Impossible d\'annuler la réception : une partie de cette commande a déjà été vendue.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
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
        
        business_logger.info(
            f"[COMMANDE] Annulation reception OK #{commande.id} | "
            f"produits={len(produits_dict)} | lots_supprimes={deleted_lots_count} | user={request.user.username}"
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
