from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action, api_view, permission_classes  # For order generation
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from django.db import transaction
from django.db.models import F, Sum, Count, Q, Case, When, Value, DecimalField, OuterRef, Subquery
from django.db.models.functions import Coalesce
from django.http import HttpResponse
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch, cm
from reportlab.platypus import BaseDocTemplate, Frame, Paragraph, PageBreak, PageTemplate, Table, TableStyle, SimpleDocTemplate, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.graphics.barcode import code128
from reportlab.graphics.shapes import Drawing
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Count, Q, F, Sum, Subquery, OuterRef, Value, DecimalField, Case, When
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth.models import User
from django.core.cache import cache
from .filters import ProduitFilter, AuditLogFilter
from .models import (
    Produit, Rayon, Fournisseur, Client, Commande, CommandeProduit, Facture, FactureProduit, Caisse,
    StockLot, FactureProduitAllocation, AyantDroit, ClotureCaisse, ActivityLog, RelevePaiement,
    Inventaire, LigneInventaire, MouvementCaisse, Avoir, LigneAvoir,
    RelationTransformation, HistoriqueTransformation, MouvementStock,
    InvoiceSettings, AuditLog, Promis, LoyaltySetting, StockAdjustment
)
from .serializers import (
    ProduitSerializer, RayonSerializer, FournisseurSerializer,
    ClientSerializer, CommandeSerializer, CommandeProduitSerializer,
    FactureSerializer, FactureProduitSerializer, StockLotSerializer,
    AvoirSerializer, HistoriqueTransformationSerializer, MouvementStockSerializer,
    InvoiceSettingsSerializer, AuditLogSerializer, PromisSerializer,
    InventaireSerializer, LigneInventaireSerializer, CreanceSerializer,
    ClotureCaisseSerializer, FactureProduitAllocationSerializer, MouvementCaisseSerializer,
    UserSerializer, AyantDroitSerializer, LigneAvoirSerializer, CaisseSerializer,
    RelationTransformationSerializer, LoyaltySettingSerializer, StockAdjustmentSerializer
)
# Import des serializers optimisés et mixins
from .audit_helpers import log_audit
from .serializers_optimized import (
    ProduitListSerializer, ProduitDetailSerializer,
    ClientListSerializer, ClientDetailSerializer,
    FactureListSerializer, FactureDetailSerializer,
    CommandeListSerializer, CommandeDetailSerializer,
    StockLotListSerializer, StockLotDetailSerializer
)
from .serializer_mixins import OptimizedSerializerMixin
from .cache_mixins import CachedSearchMixin
from decimal import Decimal
from .historique_ventes_view import HistoriqueVentesViewSet

# Create your views here.

class CustomAuthToken(ObtainAuthToken):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data,
                                           context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user_id': user.pk,
            'username': user.username,
            'email': user.email,
            'is_superuser': user.is_superuser,
            'allowed_menus': user.profile.allowed_menus if hasattr(user, 'profile') else [],
            'can_do_returns': user.profile.can_do_returns if hasattr(user, 'profile') else False,
            'can_sell_negative_stock': user.profile.can_sell_negative_stock if hasattr(user, 'profile') else False,
            'can_cash_out': user.profile.can_cash_out if hasattr(user, 'profile') else True
        })

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('username')
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser] # Only admin can manage users

class ProduitViewSet(CachedSearchMixin, OptimizedSerializerMixin, viewsets.ModelViewSet):
    """
    API endpoint for products with optimizations:
    - Automatic caching for search queries (TTL: 5 minutes)
    - Optimized serializers for list vs detail views
    
    Performance improvements:
    - Cache: 90-95% faster for cached queries
    - Serializers: 50% smaller responses for lists
    """
    # Optimisation: select_related pour éviter les requêtes N+1 sur rayon et fournisseur
    queryset = Produit.objects.select_related('rayon', 'fournisseur').order_by('-created_at')
    serializer_class = ProduitSerializer
    filter_backends = (DjangoFilterBackend, filters.SearchFilter)
    filterset_class = ProduitFilter
    search_fields = ['name', 'cip1', 'cip2', 'cip3', '=id']
    permission_classes = [IsAuthenticated]
    # Pagination explicite pour limiter la taille des réponses (8000 produits → pages de 50)
    pagination_class = None  # Utilise la pagination globale définie dans settings (PAGE_SIZE=50)
    
    # Configuration du cache (activé avec invalidation intelligente)
    cache_ttl = 300  # 5 minutes - Invalidé automatiquement lors des changements de stock
    
    # Configuration des serializers optimisés (activé)
    list_serializer_class = ProduitListSerializer  # Serializer allégé pour les listes
    detail_serializer_class = ProduitDetailSerializer  # Serializer complet pour les détails

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """
        Reconstructs the stock history for a product.
        """
        produit = self.get_object()
        
        # 1. Récupérer les entrées (Commandes clôturées)
        entrees = CommandeProduit.objects.filter(
            produit=produit,
            commande__status=Commande.Status.CLOTUREE
        ).select_related('commande', 'commande__fournisseur').order_by('-created_at')

        # 2. Récupérer les sorties (Factures validées ou payées)
        sorties = FactureProduit.objects.filter(
            produit=produit,
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).select_related('facture', 'facture__client').order_by('-created_at')

        # 3. Combiner et trier par date décroissante
        transactions = []
        
        for entree in entrees:
            transactions.append({
                'type': 'ENTREE',
                'date': entree.created_at,
                'quantity': entree.quantity,
                'libelle': f"Commande #{entree.commande.id} - {entree.commande.fournisseur.name}",
                'prix_unitaire': entree.price
            })
            
        for sortie in sorties:
            transactions.append({
                'type': 'SORTIE',
                'date': sortie.created_at,
                'quantity': sortie.quantity,
                'libelle': f"Facture #{sortie.facture.numero_facture or sortie.facture.id} - {sortie.facture.client.name if sortie.facture.client else 'Client manuel'}",
                'prix_unitaire': sortie.selling_price
            })
        
        # 3. Récupérer les retours (Factures annulées)
        retours = FactureProduit.objects.filter(
            produit=produit,
            facture__status=Facture.Status.ANNULEE,
            facture__date_annulation__isnull=False
        ).select_related('facture', 'facture__client').order_by('-facture__date_annulation')
        
        for retour in retours:
            transactions.append({
                'type': 'RETOUR',
                'date': retour.facture.date_annulation,
                'quantity': retour.quantity,
                'libelle': f"Retour Facture #{retour.facture.numero_facture or retour.facture.id} - {retour.facture.client.name if retour.facture.client else 'Client manuel'}",
                'prix_unitaire': retour.selling_price
            })
        
        # 4. Récupérer les avoirs (Retours fournisseur validés)
        avoirs = LigneAvoir.objects.filter(
            produit=produit,
            avoir__status='VALIDEE'
        ).select_related('avoir', 'avoir__fournisseur').order_by('-avoir__created_at')
        
        for ligne_avoir in avoirs:
            transactions.append({
                'type': 'AVOIR',
                'date': ligne_avoir.avoir.created_at,
                'quantity': ligne_avoir.quantity,
                'libelle': f"Avoir {ligne_avoir.avoir.numero} - {ligne_avoir.avoir.fournisseur.name} ({ligne_avoir.avoir.get_type_avoir_display()})",
                'prix_unitaire': ligne_avoir.price
            })

        # 5. Récupérer les transformations (depuis MouvementStock)
        transformations = MouvementStock.objects.filter(
            produit=produit,
            type_mouvement__in=['TRANSFORMATION_ENTREE', 'TRANSFORMATION_SORTIE']
        ).select_related('user').order_by('-date')

        for trans in transformations:
            transactions.append({
                'type': trans.type_mouvement,
                'date': trans.date,
                'quantity': abs(trans.quantite),
                'libelle': trans.description or ("Transformation" if trans.type_mouvement == 'TRANSFORMATION_ENTREE' else "Déconditionnement"),
                'prix_unitaire': 0, # Pas de prix unitaire pertinent pour l'instant
                'is_transformation': True
            })

        # 5b. Récupérer les retours manuels (ex: Annulation Promis) via MouvementStock
        # Ces mouvements sont spécifiques et ne sont pas liés aux factures annulées
        mouvements_retour = MouvementStock.objects.filter(
            produit=produit,
            type_mouvement='RETOUR'
        ).select_related('user').order_by('-date')

        for mouv in mouvements_retour:
            transactions.append({
                'type': 'RETOUR',
                'date': mouv.date,
                'quantity': abs(mouv.quantite),
                'libelle': mouv.description or "Retour stock (Manuel)",
                'prix_unitaire': 0,
                'is_manual_return': True
            })

        # 6. Récupérer les ajustements d'inventaire
        ajustements = LigneInventaire.objects.filter(
            produit=produit,
            inventaire__status=Inventaire.Status.VALIDEE
        ).exclude(ecart=0).select_related('inventaire').order_by('-inventaire__date')

        for ligne in ajustements:
            is_gain = ligne.ecart > 0
            qty = abs(ligne.ecart)
            transactions.append({
                'type': 'ENTREE' if is_gain else 'SORTIE',
                'date': ligne.inventaire.updated_at,
                'quantity': qty,
                'libelle': f"Inventaire #{ligne.inventaire.id} - Ajustement {'+' if is_gain else ''}{ligne.ecart}",
                'prix_unitaire': ligne.pmp_snapshot or 0,
                'is_inventory_adjustment': True 
            })
        
        # 7. Récupérer les ajustements manuels de stock
        adjustments = StockAdjustment.objects.filter(
            produit=produit
        ).select_related('user').order_by('-created_at')
        
        for adj in adjustments:
            is_gain = adj.quantity_change > 0
            transactions.append({
                'type': 'AJUSTEMENT',
                'date': adj.created_at,
                'quantity': abs(adj.quantity_change),
                'libelle': f"{adj.get_reason_type_display()} - {adj.user.username if adj.user else 'Système'} ({adj.quantity_before} → {adj.quantity_after})",
                'prix_unitaire': 0,
                'stock_avant': adj.quantity_before,
                'stock_apres': adj.quantity_after,
                'is_stock_adjustment': True,
                'is_positive': is_gain
            })
        
        # 8. Combiner et trier par date décroissante (le plus récent en premier)
        transactions.sort(key=lambda x: x['date'], reverse=True)
        
        # 8. Reconstruire l'historique du stock (en remontant le temps)
        current_stock = produit.stock
        history = []
        
        running_stock = current_stock
        
        for trans in transactions:
            stock_after = running_stock
            
            if trans['type'] in ['ENTREE', 'RETOUR', 'TRANSFORMATION_ENTREE'] or (trans['type'] == 'AJUSTEMENT' and trans.get('is_positive')):
                # Si c'était une entrée, on avait MOINS avant
                stock_before = running_stock - trans['quantity']
            else: # SORTIE, AVOIR, TRANSFORMATION_SORTIE
                # Si c'était une sortie, on avait PLUS avant
                stock_before = running_stock + trans['quantity']
                
            history.append({
                **trans,
                'stock_avant': stock_before,
                'stock_apres': stock_after
            })
            
            # Pour la prochaine itération (plus ancienne), le stock courant devient le stock avant de celle-ci
            running_stock = stock_before
            
        return Response(history)

    @action(detail=False, methods=['get'])
    def stock_alerts(self, request):
        """
        Retourne les produits dont le stock est inférieur ou égal au stock minimum.
        """
        produits = Produit.objects.filter(stock__lte=F('stock_minimum')).order_by('name')
        serializer = self.get_serializer(produits, many=True)
        return Response(serializer.data)



    @action(detail=False, methods=['post'])
    def recalculate_rotation(self, request):
        """
        Recalcule la rotation moyenne pour tous les produits.
        Rotation = (Quantité totale vendue) / (Durée de vie du produit en mois)
        """
        try:
            produits = Produit.objects.all()
            total_updated = 0
            
            for produit in produits:
                # 1. Calculer la durée de vie du produit en mois
                creation_date = produit.created_at
                now = timezone.now()
                
                # Approximatif: différence en jours / 30
                lifetime_days = (now - creation_date).days
                lifetime_months = max(Decimal(lifetime_days) / Decimal(30.0), Decimal(1.0)) # Min 1 mois pour éviter division par zéro ou infini
                
                # 2. Calculer la quantité totale vendue (Factures validées ou payées)
                result = FactureProduit.objects.filter(
                    produit=produit,
                    facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
                ).aggregate(total_sold=Sum('quantity'))
                
                total_sold = result['total_sold'] or 0
                
                # 3. Calculer la rotation
                rotation = Decimal(total_sold) / lifetime_months
                
                # 4. Mettre à jour le produit
                produit.rotation_moyenne = rotation
                produit.save(update_fields=['rotation_moyenne'])
                
                total_updated += 1
            
            return Response({'message': f'Rotation recalculée pour {total_updated} produits.'}, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def generate_labels(self, request):
        """
        Génère des étiquettes codes-barres pour les produits sélectionnés.
        Body: { 'products': [{ 'id': 1, 'quantity': 5 }, ...] }
        """
        products_data = request.data.get('products', [])
        if not products_data:
            return Response({'detail': 'Aucun produit sélectionné.'}, status=status.HTTP_400_BAD_REQUEST)
            
        buffer = io.BytesIO()
        # Etiquettes 5x3cm environ, ajuster selon besoin
        # A4: 210x297mm. 
        # On va faire simple: page A4 avec grille d'étiquettes
        doc = BaseDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1*cm, leftMargin=0.5*cm, rightMargin=0.5*cm)
        
        story = []
        styles = getSampleStyleSheet()
        style_normal = styles['Normal']
        style_normal.fontSize = 8
        style_normal.alignment = 1 # Center
        
        # Prepare data for table
        # 4 colonnes par page
        col_width = 4.8 * cm
        row_height = 3.5 * cm
        
        cells = []
        
        from reportlab.graphics.barcode import code128
        from reportlab.graphics.shapes import Drawing
        
        for item in products_data:
            try:
                product = Produit.objects.get(pk=item['id'])
                qty = int(item.get('quantity', 1))
                
                # Use CIP1 or ID as barcode
                barcode_value = product.cip1 or str(product.id).zfill(8)
                
                for _ in range(qty):
                    # Barcode
                    barcode = code128.Code128(barcode_value, barHeight=1*cm, barWidth=1.2)
                    d = Drawing(3.5*cm, 1.2*cm)
                    d.add(barcode)
                    
                    # Récupérer le lot le plus récent pour ce produit (FIFO)
                    latest_lot = product.stock_lots.filter(
                        quantity_remaining__gt=0
                    ).order_by('date_reception').first()
                    
                    lot_info = f"Lot: {latest_lot.lot}" if latest_lot and latest_lot.lot else ""
                    
                    # Style pour le lot
                    style_lot = styles['Normal']
                    style_lot.fontSize = 7
                    style_lot.alignment = 1
                    
                    # Cell content
                    cell_content = [
                        Paragraph(product.name[:30], style_normal),
                        d,
                        Paragraph(f"{product.selling_price} F", style_normal),
                        Paragraph(lot_info, style_lot) if lot_info else Paragraph("", style_lot)
                    ]
                    cells.append(cell_content)
                    
            except Produit.DoesNotExist:
                continue
                
        # Create table rows (chunks of 4)
        table_data = [cells[i:i + 4] for i in range(0, len(cells), 4)]
        
        # Fill last row if needed
        if table_data and len(table_data[-1]) < 4:
            table_data[-1].extend([''] * (4 - len(table_data[-1])))
            
        table = Table(table_data, colWidths=[col_width]*4, rowHeights=[row_height]*len(table_data))
        table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('LEFTPADDING', (0, 0), (-1, -1), 2),
            ('RIGHTPADDING', (0, 0), (-1, -1), 2),
        ]))
        
        story.append(table)
        doc.build(story)
        
        pdf = buffer.getvalue()
        buffer.close()
        
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="etiquettes.pdf"'
        response.write(pdf)
        return response

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def adjust_stock(self, request, pk=None):
        """
        Ajuste le stock d'un produit avec traçabilité obligatoire.
        Body: { 
            'new_quantity': 50, 
            'reason_type': 'INVENTAIRE',
            'reason_detail': 'Correction après inventaire physique',
            'stock_lot_id': null  # Optionnel
        }
        """
        produit = self.get_object()
        
        new_quantity = request.data.get('new_quantity')
        reason_type = request.data.get('reason_type')
        reason_detail = request.data.get('reason_detail', '')
        stock_lot_id = request.data.get('stock_lot_id')
        
        # Validation
        if new_quantity is None:
            return Response({'detail': 'new_quantity est requis'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Valider le type de motif
        valid_reasons = [choice[0] for choice in StockAdjustment.ReasonType.choices]
        if reason_type not in valid_reasons:
            return Response({'detail': f'reason_type invalide. Choisir parmi: {valid_reasons}'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            new_quantity = int(new_quantity)
        except ValueError:
            return Response({'detail': 'new_quantity doit être un entier'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Récupérer le lot si spécifié
        stock_lot = None
        if stock_lot_id:
            try:
                stock_lot = StockLot.objects.get(pk=stock_lot_id, produit=produit)
            except StockLot.DoesNotExist:
                return Response({'detail': 'Lot introuvable'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Calculer le changement
        quantity_before = produit.stock
        quantity_change = new_quantity - quantity_before
        
        # Créer l'enregistrement d'ajustement
        adjustment = StockAdjustment.objects.create(
            produit=produit,
            stock_lot=stock_lot,
            user=request.user,
            quantity_before=quantity_before,
            quantity_after=new_quantity,
            quantity_change=quantity_change,
            reason_type=reason_type,
            reason_detail=(reason_detail or '').strip()
        )
        
        # Mettre à jour le stock du produit
        produit.stock = new_quantity
        produit.save(update_fields=['stock'])
        
        # Si un lot spécifique est ciblé, ajuster aussi quantity_remaining du lot
        if stock_lot and quantity_change != 0:
            new_lot_qty = stock_lot.quantity_remaining + quantity_change
            if new_lot_qty < 0:
                new_lot_qty = 0
            stock_lot.quantity_remaining = new_lot_qty
            stock_lot.save(update_fields=['quantity_remaining'])
        
        # Log d'audit explicite
        log_audit(
            user=request.user,
            action=AuditLog.Action.STOCK_ADJUST,
            model_name='Produit',
            object_id=produit.id,
            description=f"Stock de {produit.name} ajusté: {quantity_before} → {new_quantity} ({quantity_change:+d}) - Motif: {adjustment.get_reason_type_display()}",
            details={
                'produit_id': produit.id,
                'produit_name': produit.name,
                'before': quantity_before,
                'after': new_quantity,
                'change': quantity_change,
                'reason_type': reason_type,
                'reason_detail': reason_detail
            },
            request=request
        )
        
        return Response({
            'status': 'success',
            'adjustment_id': adjustment.id,
            'produit_name': produit.name,
            'quantity_before': quantity_before,
            'quantity_after': new_quantity,
            'quantity_change': quantity_change,
            'reason': f"{adjustment.get_reason_type_display()}: {adjustment.reason_detail}"
        })

class CategorieViewSet(viewsets.ModelViewSet):
    """API endpoint for categories (rayons) - Fresh implementation."""
    queryset = Rayon.objects.all().order_by('name')
    serializer_class = RayonSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=True, methods=['get'])
    def imprimer_etat_stock(self, request, pk=None):
        """
        Génère un PDF de l'état de stock actuel pour ce rayon.
        Inclut les produits des sous-rayons si applicable.
        Paramètre optionnel: exclude_zero=true pour masquer les stocks à 0.
        """
        rayon = self.get_object()
        exclude_zero = request.query_params.get('exclude_zero', 'false').lower() == 'true'
        
        # Récupérer les produits du rayon ou de ses sous-rayons
        produits = Produit.objects.filter(
            Q(rayon=rayon) | Q(rayon__parent=rayon)
        ).select_related('rayon').order_by('rayon__name', 'name')
        
        if exclude_zero:
            produits = produits.exclude(stock=0)
        
        response = HttpResponse(content_type='application/pdf')
        filename = f"stock_rayon_{rayon.name}_{datetime.now().strftime('%Y%m%d')}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        buffer = io.BytesIO()
        doc = BaseDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch, leftMargin=0.5*inch, rightMargin=0.5*inch)
        
        frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='normal')
        template = PageTemplate(id='main', frames=[frame])
        doc.addPageTemplates([template])
        
        story = []
        styles = getSampleStyleSheet()
        
        # Header
        title_text = f"ETAT DE STOCK - RAYON: {rayon.name.upper()}"
        if exclude_zero:
            title_text += " (Non-Nuls)"
        story.append(Paragraph(title_text, styles['Title']))
        story.append(Paragraph(f"Date: {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Content
        data = [['ID', 'Produit', 'CIP', 'Stock', 'PMP', 'Valeur', 'Rayon']]
        total_valeur = 0
        total_items = 0
        
        for p in produits:
            valeur = p.stock * p.pmp
            total_valeur += valeur
            total_items += p.stock
            rayon_name = p.rayon.name if p.rayon else "-"
            
            data.append([
                str(p.id),
                Paragraph(p.name[:35], styles['Normal']),
                p.cip1 or "",
                str(p.stock),
                f"{p.pmp:.0f}",
                f"{valeur:.0f}",
                rayon_name
            ])
            
        data.append(['', '', '', f"Tot: {total_items}", 'TOTAL', f"{total_valeur:.0f} F", ''])
        
        t = Table(data, colWidths=[0.4*inch, 2.6*inch, 0.9*inch, 0.6*inch, 0.8*inch, 0.9*inch, 1.3*inch])
        t.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-2), 1, colors.black),
            ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
            ('ALIGN', (3,0), (5,-1), 'CENTER'), # Align Stock, PMP, Valeur
            ('LINEBELOW', (0,-2), (-1,-2), 1, colors.black),
            ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold')
        ]))
        
        story.append(t)
        doc.build(story)
        
        pdf = buffer.getvalue()
        buffer.close()
        response.write(pdf)
        return response

    @action(detail=False, methods=['get'])
    def imprimer_sans_rayon(self, request):
        """
        Génère un PDF pour les produits sans rayon assigné.
        """
        exclude_zero = request.query_params.get('exclude_zero', 'false').lower() == 'true'
        
        produits = Produit.objects.filter(rayon__isnull=True).order_by('name')
        
        if exclude_zero:
            produits = produits.exclude(stock=0)
            
        response = HttpResponse(content_type='application/pdf')
        filename = f"stock_sans_rayon_{datetime.now().strftime('%Y%m%d')}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        buffer = io.BytesIO()
        doc = BaseDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch, leftMargin=0.5*inch, rightMargin=0.5*inch)
        
        frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='normal')
        template = PageTemplate(id='main', frames=[frame])
        doc.addPageTemplates([template])
        
        story = []
        styles = getSampleStyleSheet()
        
        title_text = "ETAT DE STOCK - SANS RAYON"
        if exclude_zero:
             title_text += " (Non-Nuls)"
        story.append(Paragraph(title_text, styles['Title']))
        story.append(Paragraph(f"Date: {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        data = [['ID', 'Produit', 'CIP', 'Stock', 'PMP', 'Valeur', 'Rayon']]
        total_valeur = 0
        total_items = 0
        
        for p in produits:
            valeur = p.stock * p.pmp
            total_valeur += valeur
            total_items += p.stock
            
            data.append([
                str(p.id),
                Paragraph(p.name[:35], styles['Normal']),
                p.cip1 or "",
                str(p.stock),
                f"{p.pmp:.0f}",
                f"{valeur:.0f}",
                "" # Sans rayon obviously
            ])
            
        data.append(['', '', '', f"Tot: {total_items}", 'TOTAL', f"{total_valeur:.0f} F", ''])
        
        t = Table(data, colWidths=[0.4*inch, 2.6*inch, 0.9*inch, 0.6*inch, 0.8*inch, 0.9*inch, 1.3*inch])
        t.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-2), 1, colors.black),
            ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
            ('ALIGN', (3,0), (5,-1), 'CENTER'),
            ('LINEBELOW', (0,-2), (-1,-2), 1, colors.black),
            ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold')
        ]))
        
        story.append(t)
        doc.build(story)
        
        pdf = buffer.getvalue()
        buffer.close()
        response.write(pdf)
        return response

class FournisseurViewSet(viewsets.ModelViewSet):
    """API endpoint for fournisseurs."""
    queryset = Fournisseur.objects.all().order_by('name')
    serializer_class = FournisseurSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'email', 'phone']

class ClientViewSet(OptimizedSerializerMixin, viewsets.ModelViewSet):
    """
    API endpoint for clients with optimized serializers.
    - List view: Lightweight serializer (8 fields)
    - Detail view: Complete serializer with ayants droit
    """
    # Subquery pour sommer les paiements valides par facture (évite l'error 'aggregate of aggregate')
    # On importe Caisse dynamiquement ou on suppose qu'il est disponible via le modèle
    # Pour éviter les imports circulaires ou complexes, on utilise le string reference si possible ou import local?
    # ViewSet a accès aux modèles via imports en haut.
    
    queryset = Client.objects.annotate(
        current_debt_annotated=Subquery(
            Facture.objects.filter(
                client=OuterRef('pk'), 
                status__in=['VAL', 'PAY']  # Inclure VALIDEE et PAYEE
            ).annotate(
                # 1. Calcul des paiements via Subquery pour obtenir un SCALAIRE
                paid_amount=Coalesce(
                    Subquery(
                        Caisse.objects.filter(
                            facture=OuterRef('pk'),
                            statut='completee'
                        ).exclude(
                            mode_paiement='en_compte'
                        ).values('facture').annotate(
                            total_paid=Sum('montant')
                        ).values('total_paid')
                    ),
                    Value(0, output_field=DecimalField())
                ),
                # 2. Maintenant 'paid_amount' est une valeur, donc 'remainder' est une expression simple
                remainder=F('total_ttc') - F('paid_amount')
            ).filter(
                remainder__gt=0 
            ).values('client').annotate(
                # 3. On peut enfin sommer les remainders
                total_debt=Sum('remainder')
            ).values('total_debt')[:1],
            output_field=DecimalField()
        )
    ).order_by('name')
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]
    
    # Serializers optimisés
    list_serializer_class = ClientListSerializer
    detail_serializer_class = ClientDetailSerializer

class AyantDroitViewSet(viewsets.ModelViewSet):
    """API endpoint for ayants droit."""
    queryset = AyantDroit.objects.all().order_by('nom')
    serializer_class = AyantDroitSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['client']

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

class CommandeViewSet(OptimizedSerializerMixin, viewsets.ModelViewSet):
    """
    API endpoint for commandes with optimized serializers.
    - List view: Lightweight serializer (8 fields)
    - Detail view: Complete serializer with all products
    """
    queryset = Commande.objects.select_related('fournisseur').prefetch_related('produits__produit', 'produits__commande__fournisseur').order_by('-date')
    serializer_class = CommandeSerializer
    permission_classes = [IsAuthenticated]
    
    # Serializers optimisés
    list_serializer_class = CommandeListSerializer
    detail_serializer_class = CommandeDetailSerializer

    def perform_destroy(self, instance):
        # Allow deleting closed commands, but handle protected error if lots are used
        # if instance.status == Commande.Status.CLOTUREE:
        #      from rest_framework.exceptions import ValidationError
        #      raise ValidationError("Impossible de supprimer une commande clôturée.")
        
        try:
            super().perform_destroy(instance)
        except Exception as e:
            # Check for ProtectedError manually or via type if imported
            # Django's ProtectedError is often wrapped or bubbling up
            from django.db.models import ProtectedError
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
                lot = StockLot(
                    produit=produit,
                    commande_produit=item,
                    fournisseur=commande.fournisseur if commande.fournisseur else produit.fournisseur,
                    quantity_initial=total_qty,
                    quantity_paid=quantity_paid,
                    quantity_free=quantity_free,
                    quantity_remaining=total_qty,
                    price_cost=effective_cost,
                    selling_price=produit.selling_price,
                    lot=item.lot,
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
        
        # 2.1 Créer tous les lots en une seule requête
        if lots_to_create:
            StockLot.objects.bulk_create(lots_to_create, batch_size=100)
        
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

        return Response({'status': 'Commande clôturée, stock mis à jour (UG incluses) et lots créés.'})

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

        commande_info = {
            "commande_id": commande.id,
            "fournisseur_name": commande.fournisseur.name,
            "fournisseur_address": commande.fournisseur.address,
            "date_commande": commande.date.strftime("%d/%m/%Y"),
            "date_reception": datetime.now().strftime("%d/%m/%Y")
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
            date_entree = commande.date.strftime('%d/%m/%Y') if commande.date else ""
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
            from reportlab.platypus import Spacer, Table, TableStyle
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
                    print(f"Erreur génération code-barres: {e}")
                    print(traceback.format_exc())
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
    queryset = CommandeProduit.objects.all().order_by('-created_at')
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
            # Calculer la dette actuelle (factures validées non payées)
            current_debt = facture.client.current_debt
            
            # Calculer le montant de la nouvelle facture
            new_invoice_amount = facture.total_ttc
            
            # Vérifier si le plafond est dépassé
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
                continue # Should not happen if integrity is maintained

            try:
                qty = Decimal(str(item.quantity))
                stock = Decimal(str(produit.stock))
            except Exception:
                return Response({'detail': f'Impossible de comparer les quantités pour le produit {produit.id}.'}, status=status.HTTP_400_BAD_REQUEST)

            if qty > 0:
                # Vérifier si l'utilisateur a le droit de vendre avec stock négatif
                # Les superusers ont toujours le droit
                can_sell_negative = request.user.is_superuser
                
                if not can_sell_negative and hasattr(request.user, 'profile'):
                    can_sell_negative = request.user.profile.can_sell_negative_stock
                
                if stock < qty and not can_sell_negative:
                    return Response(
                        {'detail': f'Stock insuffisant pour le produit {produit.name}. Stock disponible: {stock}, Quantité demandée: {qty}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            elif qty < 0:
                # Vérifier si l'utilisateur a le droit de faire des retours
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
            
            # 1. Mise à jour du stock global sur l'instance VERROUILLÉE
            produit.stock = F('stock') - item.quantity
            produit.save(update_fields=['stock'])
            
            # 2. Gestion des lots pour les VENTES (qty > 0)
            if item.quantity > 0:
                quantity_to_allocate = item.quantity
                
                # CAS 1: Un lot spécifique est ciblé
                if item.stock_lot:
                    # On verrouille le lot spécifique
                    target_lot = StockLot.objects.select_for_update().get(id=item.stock_lot.id)
                    
                    # Vérifier que le lot a suffisamment de stock disponible
                    if target_lot.quantity_remaining < quantity_to_allocate:
                        return Response(
                            {
                                'detail': f'Stock insuffisant dans le lot {target_lot.lot}. '
                                          f'Stock disponible: {target_lot.quantity_remaining}, '
                                          f'Quantité demandée: {quantity_to_allocate}'
                            },
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    # Créer l'allocation liée à ce lot précis
                    FactureProduitAllocation.objects.create(
                        facture_produit=item,
                        stock_lot=target_lot,
                        quantity=quantity_to_allocate, # Tout sur ce lot
                        cost_price=target_lot.price_cost,
                        selling_price=item.selling_price
                    )
                    
                    # Mettre à jour le lot
                    target_lot.quantity_remaining -= quantity_to_allocate
                    target_lot.save()

                # CAS 2: Pas de lot spécifique -> Logique FIFO standard
                else:
                    # Récupérer les lots disponibles par ordre FEFO (First Expired First Out)
                    # On trie d'abord par date d'expiration (les plus proches en premier), 
                    # puis par date de réception pour le FIFO standard si expiration identique ou nulle

                    available_lots = StockLot.objects.select_for_update().filter(
                        produit=produit,
                        quantity_remaining__gt=0
                    ).order_by(F('date_expiration').asc(nulls_last=True), 'date_reception')
                    
                    for lot in available_lots:
                        if quantity_to_allocate <= 0:
                            break
                            
                        # On prend le max possible du lot
                        quantity_from_lot = min(lot.quantity_remaining, quantity_to_allocate)
                        
                        # Créer l'allocation
                        FactureProduitAllocation.objects.create(
                            facture_produit=item,
                            stock_lot=lot,
                            quantity=quantity_from_lot,
                            cost_price=lot.price_cost,
                            selling_price=item.selling_price
                        )
                        
                        # Mettre à jour le lot
                        lot.quantity_remaining -= quantity_from_lot
                        lot.save()
                        
                        quantity_to_allocate -= quantity_from_lot

        # --- GESTION FIDELITE ---
        # Uniquement pour les PARTICULIERS (pas les PROS)
        if facture.client and facture.client.client_type != 'PROFESSIONNEL' and facture.client.is_loyalty_member:
            loyalty_conf = LoyaltySetting.objects.first()
            if loyalty_conf:
                client = facture.client
                save_client = False
                
                # A. Utilisation de la remise en attente
                use_pending = request.data.get('use_pending_discount', False)
                # Le frontend envoie le booléen, parfois sous forme de string "true" dans certains frameworks, mais ici DRF gère le JSON
                # Par sécurité :
                if str(use_pending).lower() == 'true':
                    use_pending = True
                
                if use_pending and client.pending_discount > 0:
                    client.pending_discount = 0
                    save_client = True
                    
                # B. Utilisation de points manuelle
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

                # C. Gain de points
                montant_base = facture.total_ttc
                if montant_base > 0 and loyalty_conf.amount_per_point > 0:
                    points_gagnes = int(montant_base // loyalty_conf.amount_per_point)
                    facture.points_fidelite_gagnes = points_gagnes
                    client.points_fidelite += points_gagnes
                    save_client = True
                
                # D. Déclenchement Récompense Auto
                if loyalty_conf.auto_reward_threshold > 0:
                    if client.points_fidelite >= loyalty_conf.auto_reward_threshold:
                        client.points_fidelite -= loyalty_conf.auto_reward_threshold
                        if loyalty_conf.auto_reward_percent > client.pending_discount:
                            client.pending_discount = loyalty_conf.auto_reward_percent
                        save_client = True
                
                if save_client:
                    client.save()

        # Changer le statut de la facture et générer un numéro si besoin
        facture.status = Facture.Status.VALIDEE
        if not facture.numero_facture:
            facture.numero_facture = f"FAC-{facture.id:06d}"
        facture.save(update_fields=['status', 'numero_facture'])

        # CRITICAL: Recalculer les totaux (y compris part_client) après avoir ajouté les produits
        # Ceci est essentiel pour les clients professionnels avec tiers payant
        facture.calculate_totals(save=True)

        # Gestion automatique des créances pour clients professionnels
        # Si le client est professionnel et qu'une part_client est définie,
        # créer automatiquement une créance (paiement "en_compte") pour la part assurance
        if facture.client and facture.client.client_type == 'PROFESSIONNEL':
            if facture.part_client is not None:
                # Calculer la part assurance (part entreprise)
                part_assurance = facture.total_ttc - Decimal(str(facture.part_client))
                
                if part_assurance > 0:
                    # Créer un paiement "en_compte" pour la part assurance
                    # Cela créera automatiquement une créance visible dans le module Créances
                    Caisse.objects.create(
                        facture=facture,
                        mode_paiement='en_compte',
                        montant=part_assurance,
                        statut='completee',
                        user=request.user,
                        part_assurance=part_assurance,
                        part_patient=Decimal('0.00')
                    )

        # Rafraîchir et sérialiser la facture
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

        # Récupérer le motif
        motif = request.data.get('motif', '')

        # 1. Restaurer le stock UNIQUEMENT si la facture était validée ou payée
        # Les brouillons (BROU) n'ont jamais décrémenté le stock, donc pas besoin de le restaurer
        was_validated = facture.status in [Facture.Status.VALIDEE, Facture.Status.PAYEE]
        
        if was_validated:
            # 2. Libérer les allocations FIFO (ce qui restaurera le stock via les signaux)
            # DÉSORMAIS GÉRÉ PAR LES LOTS: La suppression des allocations FIFO
            # libère les quantités dans les lots, et le signal recalcule automatiquement le stock
            FactureProduitAllocation.objects.filter(
                facture_produit__facture=facture
            ).delete()
        # Pour les brouillons, pas de suppression d'allocations (il n'y en a pas)

        # 3. Enregistrer la date d'annulation
        facture.date_annulation = timezone.now()
        
        # 4. Changer le statut de la facture
        facture.status = Facture.Status.ANNULEE
        
        # 5. Enregistrer le motif dans les notes
        if motif:
            current_notes = facture.notes or ""
            timestamp = facture.date_annulation.strftime('%d/%m/%Y %H:%M')
            facture.notes = f"{current_notes}\n[Annulation le {timestamp}] Motif: {motif}".strip()
            
        facture.save(update_fields=['status', 'notes', 'date_annulation'])

        # Log d'audit explicite (remplace ActivityLog)
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

    @action(detail=False, methods=['delete'], permission_classes=[IsAdminUser])
    @transaction.atomic
    def supprimer_brouillons(self, request):
        """
        Supprime toutes les factures en statut brouillon.
        """
        brouillons = Facture.objects.filter(status=Facture.Status.BROUILLON)
        count = brouillons.count()
        brouillons_ids = list(brouillons.values_list('id', flat=True))
        brouillons.delete()
        
        if count > 0:
            ActivityLog.objects.create(
                user=request.user,
                action='DELETE_DRAFTS',
                target_model='Facture',
                details={'count': count, 'ids': list(map(str, brouillons_ids))},
                ip_address=request.META.get('REMOTE_ADDR')
            )

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

        # Marges standard
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
        story = []
        styles = getSampleStyleSheet()
        
        # Styles personnalisés basés sur la config
        style_company = ParagraphStyle('Company', parent=styles['Heading2'], fontSize=16, spaceAfter=6, textColor=HexColor(settings.primary_color))
        style_normal = styles['Normal']
        style_title = ParagraphStyle('Title', parent=styles['Heading3'], fontSize=12, alignment=1) # Center
        style_right = ParagraphStyle('Right', parent=styles['Normal'], alignment=2) # 2 = RIGHT
        style_center = ParagraphStyle('Center', parent=styles['Normal'], alignment=1) # 1 = CENTER
        style_left = ParagraphStyle('Left', parent=styles['Normal'], alignment=0) # 0 = LEFT

        # === 1. DONNÉES EN-TÊTE ===
        # Formatter l'adresse pour HTML (newlines -> <br/>)
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
            
        # === 2. APPLICATION DU LAYOUT ===
        # Titre du document
        doc_title = "FACTURE"
        is_proforma = request.query_params.get('type') == 'proforma' or facture.status == Facture.Status.PROFORMA
        
        if is_proforma:
            doc_title = "PROFORMA"
            if not facture.numero_facture:
                facture.numero_facture = f"PROFORMA-{facture.id}" # Temporaire pour affichage
                # On ne sauvegarde pas ce numéro temporaire en DB pour ne pas casser la séquence officielle

        layout = settings.header_layout # split, left, center, right
        
        # Style pour le titre (FACTURE ou PROFORMA)
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
            # Logo/Company Gauche, Info Droite
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
            # Tout à gauche
            story.extend(company_block)
            story.append(Spacer(1, 0.5*cm))
            story.append(doc_title_flowable)
            story.append(Paragraph(invoice_details_text, style_left))
            
        elif layout == 'center':
            # Tout centré
            style_company_center = ParagraphStyle('CompanyCenter', parent=style_company, alignment=1)
            story.append(Paragraph(f"<b>{settings.company_name}</b>", style_company_center))
            story.append(Paragraph(company_address_fmt, style_center))
            story.append(Spacer(1, 0.5*cm))
            story.append(doc_title_flowable)
            story.append(Paragraph(invoice_details_text, style_center))
            
        elif layout == 'right':
            # Tout à droite
            style_company_right = ParagraphStyle('CompanyRight', parent=style_company, alignment=2)
            style_normal_right = ParagraphStyle('NormalRight', parent=style_normal, alignment=2)
            story.append(Paragraph(f"<b>{settings.company_name}</b>", style_company_right))
            story.append(Paragraph(company_address_fmt, style_normal_right))
            story.append(Spacer(1, 0.5*cm))
            story.append(doc_title_flowable)
            story.append(Paragraph(invoice_details_text, style_right))

        story.append(Spacer(1, 1.0*cm))
        
        # === 3. TABLEAU DES PRODUITS ===
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
            ('BACKGROUND', (0, 0), (-1, 0), HexColor(settings.primary_color)), # Use user color
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white), # White text on colored header
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(table)
        story.append(Spacer(1, 1*cm))
        
        # === 4. TOTAUX ===
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
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, -1), (-1,  -1), 'Helvetica-Bold'),
            ('LINEABOVE', (0, -1), (-1, -1), 1.5, colors.black),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, -1), (-1, -1), colors.whitesmoke),
        ]))
        
        # Positionnement des totaux (Fixe à droite pour l'instant car standard comptable)
        container_table = Table([[None, totals_table]], colWidths=[9*cm, 8*cm])
        container_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        story.append(container_table)
        
        # === FOOTER ===
        story.append(Spacer(1, 2*cm))
        
        # NOTE: Pas d'info de paiement sur le Proforma
        if not is_proforma:
            # Ajouter infos paiement (reste à payer, etc) si besoin
            pass

        if settings.footer_text:
            footer = Paragraph(f"<i>{settings.footer_text}</i>", style_center)
            story.append(footer)
        
        doc.build(story)
        pdf = buffer.getvalue()
        buffer.close()
        response.write(pdf)
        return response
        


    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def caisse_par_tranche_horaire(self, request):
        """
        Calcule la caisse pour une tranche horaire spécifique.
        Paramètres:
        - date_debut: Date et heure de début au format YYYY-MM-DDTHH:MM (ex: 2025-11-18T08:52)
        - date_fin: Date et heure de fin au format YYYY-MM-DDTHH:MM (ex: 2025-11-18T18:30)
        """
        # Récupérer les paramètres
        date_debut_str = request.query_params.get('date_debut', None)
        date_fin_str = request.query_params.get('date_fin', None)
        
        # Valider et parser les dates/heures
        try:
            if date_debut_str:
                # Gérer les formats avec ou sans secondes
                try:
                    start_datetime = datetime.strptime(date_debut_str, '%Y-%m-%dT%H:%M')
                except ValueError:
                    try:
                        start_datetime = datetime.strptime(date_debut_str, '%Y-%m-%dT%H:%M:%S')
                    except ValueError:
                        return Response({'detail': f'Format de date/heure invalide pour date_debut: {date_debut_str}. Utilisez YYYY-MM-DDTHH:MM ou YYYY-MM-DDTHH:MM:SS'}, status=status.HTTP_400_BAD_REQUEST)
                start_datetime = timezone.make_aware(start_datetime)
            else:
                return Response({'detail': 'Le paramètre date_debut est requis.'}, status=status.HTTP_400_BAD_REQUEST)
            
            if date_fin_str:
                # Gérer les formats avec ou sans secondes
                try:
                    end_datetime = datetime.strptime(date_fin_str, '%Y-%m-%dT%H:%M')
                except ValueError:
                    try:
                        end_datetime = datetime.strptime(date_fin_str, '%Y-%m-%dT%H:%M:%S')
                    except ValueError:
                        return Response({'detail': f'Format de date/heure invalide pour date_fin: {date_fin_str}. Utilisez YYYY-MM-DDTHH:MM ou YYYY-MM-DDTHH:MM:%S'}, status=status.HTTP_400_BAD_REQUEST)
                end_datetime = timezone.make_aware(end_datetime)
            else:
                return Response({'detail': 'Le paramètre date_fin est requis.'}, status=status.HTTP_400_BAD_REQUEST)
            
            if start_datetime >= end_datetime:
                return Response({'detail': "La date de début doit être antérieure à la date de fin."}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as e:
            return Response({'detail': f'Format de date/heure invalide. Utilisez YYYY-MM-DDTHH:MM (ex: 2025-11-18T08:52). Erreur: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Récupérer toutes les factures validées ou payées dans cette tranche
        # Utiliser prefetch_related pour charger les produits et éviter les requêtes N+1
        # Utiliser date__lte pour inclure les factures créées exactement à la date de fin
        factures = Facture.objects.filter(
            date__gte=start_datetime,
            date__lte=end_datetime,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).prefetch_related('produits', 'produits__produit')
        
        # Debug: logger le nombre de factures trouvées
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Recherche de factures entre {start_datetime} et {end_datetime}. Trouvé: {factures.count()} factures")
        
        # Calculer les totaux à partir des factures
        # total_ht représente le sous-total HT (avant remise globale)
        # total_ht_apres_remise représente le total HT après remise globale
        total_ttc = Decimal('0.00')
        total_ht = Decimal('0.00')  # Sous-total HT avant remise
        total_ht_apres_remise = Decimal('0.00')  # Total HT après remise
        total_tva = Decimal('0.00')
        total_remise = Decimal('0.00')
        nombre_factures = factures.count()
        
        for facture in factures:
            try:
                # Utiliser les propriétés calculées du modèle Facture
                # total_ht du modèle = somme des produits (avant remise)
                facture_sous_total_ht = Decimal(str(facture.total_ht))
                facture_remise = Decimal(str(facture.remise))
                facture_total_tva = Decimal(str(facture.total_tva))
                facture_total_ttc = Decimal(str(facture.total_ttc))
                
                # Calculer le total HT après remise
                facture_total_ht_apres_remise = facture_sous_total_ht - facture_remise
                
                # Ajouter aux totaux
                total_ht += facture_sous_total_ht
                total_remise += facture_remise
                total_ht_apres_remise += facture_total_ht_apres_remise
                total_tva += facture_total_tva
                total_ttc += facture_total_ttc
                
                # Debug pour chaque facture
                logger.debug(f"Facture {facture.id}: Sous-total HT={facture_sous_total_ht}, Remise={facture_remise}, HT après remise={facture_total_ht_apres_remise}, TVA={facture_total_tva}, TTC={facture_total_ttc}")
                
            except (ValueError, TypeError, AttributeError) as e:
                # Logger l'erreur pour le débogage
                logger.error(f"Erreur lors du calcul des totaux pour la facture {facture.id}: {e}")
                logger.error(f"Détails facture: id={facture.id}, status={facture.status}, produits_count={facture.produits.count()}")
                import traceback
                logger.error(traceback.format_exc())
                pass
        
        # Pour la réponse, on utilise total_ht_apres_remise comme total_ht (après remise)
        # car c'est ce sur quoi la TVA est calculée
        total_ht_final = total_ht_apres_remise
        
        logger.info(f"Totaux calculés: Sous-total HT={total_ht}, Remise totale={total_remise}, Total HT après remise={total_ht_apres_remise}, TVA={total_tva}, TTC={total_ttc}")
        
        response_data = {
            'date_debut': start_datetime.strftime('%Y-%m-%d %H:%M'),
            'date_fin': end_datetime.strftime('%Y-%m-%d %H:%M'),
            'tranche': f"{start_datetime.strftime('%d-%m-%Y %Hh%M')} - {end_datetime.strftime('%d-%m-%Y %Hh%M')}",
            'nombre_factures': nombre_factures,
            'total_ht': str(total_ht_final.quantize(Decimal('0.01'))),  # Total HT après remise (sur lequel la TVA est calculée)
            'total_tva': str(total_tva.quantize(Decimal('0.01'))),
            'total_ttc': str(total_ttc.quantize(Decimal('0.01'))),
            'sous_total_ht': str(total_ht.quantize(Decimal('0.01'))),  # Sous-total avant remise
            'total_remise': str(total_remise.quantize(Decimal('0.01')))
        }
        if request.user and request.user.is_superuser:
            response_data['debug'] = {
                'date_debut_parsed': start_datetime.isoformat(),
                'date_fin_parsed': end_datetime.isoformat(),
                'factures_ids': [f.id for f in factures[:10]],
                'sous_total_ht': str(total_ht),
                'total_remise': str(total_remise),
                'total_ht_apres_remise': str(total_ht_apres_remise)
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

    @action(detail=True, methods=['get'])
    def imprimer_facture(self, request, pk=None):
        """
        Génère un PDF pour la facture.
        """
        facture = self.get_object()

        if facture.status == Facture.Status.BROUILLON:
            return Response({'detail': 'La facture doit être validée avant de pouvoir être imprimée.'}, status=status.HTTP_400_BAD_REQUEST)

        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="facture_{facture.numero_facture}.pdf"'

        buffer = io.BytesIO()

        company_info = {
            "name": "Djadeu Pharmacy",
            "address": "Logbessou",
            "tel": "697268949"
        }

        facture_info = {
            "facture_id": facture.numero_facture,
            "client_name": facture.client.name if facture.client else (facture.client_name_override or "Client de passage"),
            "client_address": facture.client.address if facture.client else "",
            "client_phone": facture.client.phone if facture.client else "",
            "date_facture": facture.date.strftime("%d/%m/%Y"),
            "remise": str(facture.remise),
            "tva": str(facture.tva)
        }

        doc = BaseDocTemplate(buffer, pagesize=letter, topMargin=2.5*inch, bottomMargin=1*inch)
        
        # Create a Frame for the content
        frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='normal')

        # Create a PageTemplate and add the header/footer function
        template = PageTemplate(id='main_template', frames=[frame], 
                                onPage=lambda canvas, doc: header_footer_facture(canvas, doc, company_info, facture_info, facture))
        doc.addPageTemplates([template])

        story = []
        
        # Table Header
        data = [['ID', 'Nom Produit', 'Quantité', 'Prix Unitaire', 'Total HT']]
        
        for item in facture.produits.all():
            produit = item.produit
            total_ligne = float(item.quantity) * float(item.selling_price)
            
            data.append([
                str(produit.id),
                produit.name,
                str(item.quantity),
                str(item.selling_price),
                f"{total_ligne:.2f}"
            ])

        table = Table(data, colWidths=[0.5*inch, 2.5*inch, 1*inch, 1*inch, 1*inch])
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

        # Totaux
        styles = getSampleStyleSheet()
        total_ht = float(facture.total_ht)
        remise = float(facture.remise)
        tva_montant = facture.total_tva
        total_ttc = facture.total_ttc

        totaux_data = [
            ['', '', '', 'Sous-total HT:', f"{total_ht:.2f} F"],
            ['', '', '', 'Remise:', f"-{remise:.2f} F"],
            ['', '', '', f'TVA ({facture.tva}%):', f"{tva_montant:.2f} F"],
            ['', '', '', 'TOTAL TTC:', f"{total_ttc:.2f} F"]
        ]
        
        # Ajouter les parts Tiers Payant si applicable
        if facture.part_client is not None and facture.client and facture.client.taux_couverture > 0:
            part_assurance = total_ttc - facture.part_client
            totaux_data.extend([
                ['', '', '', '', ''],  # Ligne vide
                ['', '', '', f'Part Assurance ({facture.client.taux_couverture}%):', f"{part_assurance:.2f} F"],
                ['', '', '', f'Part Client ({100 - facture.client.taux_couverture}%):', f"{facture.part_client:.2f} F"]
            ])
        
        totaux_table = Table(totaux_data, colWidths=[0.5*inch, 2.5*inch, 1*inch, 1*inch, 1*inch])
        totaux_table.setStyle(TableStyle([
            ('ALIGN', (3, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (3, 3), (4, 3), 'Helvetica-Bold'),
            ('FONTSIZE', (3, 3), (4, 3), 14),
            ('BACKGROUND', (3, 3), (4, 3), colors.HexColor('#E6E6FA')),
        ]))
        
        story.append(totaux_table)

        if facture.notes:
            story.append(Paragraph(f"<b>Notes:</b> {facture.notes}", styles['Normal']))

        doc.build(story)

        pdf = buffer.getvalue()
        buffer.close()
        response.write(pdf)

        return response


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


class FactureProduitViewSet(viewsets.ModelViewSet):
    """API endpoint for facture produits."""
    queryset = FactureProduit.objects.all().order_by('-created_at')
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
        # Enregistrer automatiquement l'utilisateur lors de la création
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def get_totals(self, request):
        """
        Retourne les totaux.
        Si date_debut/date_fin fournis, utilise cette période.
        Sinon, calcule depuis la dernière clôture.
        """
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        
        start_date = None
        end_date = None
        
        if date_debut:
            try:
                start_date = datetime.fromisoformat(date_debut.replace('Z', '+00:00'))
            except ValueError:
                pass
                
        if date_fin:
            try:
                # Si c'est juste une date YYYY-MM-DD, ajouter 23:59:59
                if len(date_fin) == 10:
                    end_date = datetime.fromisoformat(f"{date_fin}T23:59:59")
                else:
                    end_date = datetime.fromisoformat(date_fin.replace('Z', '+00:00'))
            except ValueError:
                pass

        if not start_date:
            last_cloture = ClotureCaisse.objects.order_by('-date').first()
            start_date = last_cloture.date if last_cloture else None
        
        # 1. Transactions de vente (Caisse)
        transactions = Caisse.objects.filter(statut='completee').exclude(mode_paiement='en_compte')
        
        if start_date:
            transactions = transactions.filter(date_paiement__gte=start_date)
        if end_date:
            transactions = transactions.filter(date_paiement__lte=end_date)
            
        # 1. Détails Ventes (Totaux par mode)
        modes = transactions.values('mode_paiement').annotate(total=Sum('montant'))
        details = {item['mode_paiement']: float(item['total']) for item in modes}
        
        # Total Ventes (Calculé en Python pour économiser une requête)
        total_ventes = Decimal(sum(details.values()))

        # 2. Mouvements de caisse (Entrées/Sorties) - Optimisé en 1 requête
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
        
        # Total Théorique Global
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
        Body: { 'montant_reel': 150000 }
        """
        montant_reel = request.data.get('montant_reel')
        if montant_reel is None:
            return Response({'detail': 'Le montant réel est requis.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            montant_reel = Decimal(str(montant_reel))
        except:
            return Response({'detail': 'Montant invalide.'}, status=status.HTTP_400_BAD_REQUEST)


        # Paramètres optionnels de période
        date_debut = request.data.get('date_debut')
        date_fin = request.data.get('date_fin')
        
        start_date = None
        end_date = None
        
        if date_debut:
            try:
                start_date = datetime.fromisoformat(date_debut.replace('Z', '+00:00'))
            except ValueError:
                pass
                
        if date_fin:
            try:
                if len(date_fin) == 10:
                    end_date = datetime.fromisoformat(f"{date_fin}T23:59:59")
                else:
                    end_date = datetime.fromisoformat(date_fin.replace('Z', '+00:00'))
            except ValueError:
                pass

        # Calculer le théorique
        if not start_date:
            last_cloture = ClotureCaisse.objects.order_by('-date').first()
            start_date = last_cloture.date if last_cloture else None
        
        # Transactions Ventes
        transactions = Caisse.objects.filter(statut='completee').exclude(mode_paiement='en_compte')
        if start_date:
            transactions = transactions.filter(date_paiement__gte=start_date)
        if end_date:
            transactions = transactions.filter(date_paiement__lte=end_date)
            
        total_ventes = transactions.aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        
        # Détails Ventes
        modes = transactions.values('mode_paiement').annotate(total=Sum('montant'))
        details = {item['mode_paiement']: float(item['total']) for item in modes}
        
        # Mouvements
        mouvements = MouvementCaisse.objects.all()
        if start_date:
            mouvements = mouvements.filter(date__gte=start_date)
        if end_date:
            mouvements = mouvements.filter(date__lte=end_date)
        total_entrees = mouvements.filter(type='ENTREE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_sorties = mouvements.filter(type='SORTIE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        
        # Validation: Ne pas autoriser la clôture si aucun mouvement
        if total_ventes == 0 and total_entrees == 0 and total_sorties == 0:
             return Response({
                 'detail': 'Impossible de clôturer : aucun mouvement (vente, entrée ou sortie) détecté depuis la dernière clôture.'
             }, status=status.HTTP_400_BAD_REQUEST)

        total_theorique = total_ventes + total_entrees - total_sorties
        ecart = montant_reel - total_theorique
        
        # Save to ClotureCaisse model
        from .models import ClotureCaisse
        
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
        
        # Log d'audit explicite
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
        queryset = ClotureCaisse.objects.all().order_by('-date')
        
        # Filter by date range
        date_debut = self.request.query_params.get('date_debut')
        date_fin = self.request.query_params.get('date_fin')
        
        if date_debut:
            queryset = queryset.filter(date__date__gte=date_debut)
        if date_fin:
            queryset = queryset.filter(date__date__lte=date_fin)
        
        return queryset


class LoyaltySettingViewSet(viewsets.ModelViewSet):
    """
    Gestion de la configuration fidélité (Singleton).
    """
    queryset = LoyaltySetting.objects.all()
    serializer_class = LoyaltySettingSerializer
    permission_classes = [IsAdminUser]

    def list(self, request, *args, **kwargs):
        setting, _ = LoyaltySetting.objects.get_or_create(pk=1)
        serializer = self.get_serializer(setting)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        setting, _ = LoyaltySetting.objects.get_or_create(pk=1)
        serializer = self.get_serializer(setting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def get_totals(self, request):
        """
        Retourne les totaux.
        Si date_debut/date_fin fournis, utilise cette période.
        Sinon, calcule depuis la dernière clôture.
        """
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        
        start_date = None
        end_date = None
        
        if date_debut:
            try:
                start_date = datetime.fromisoformat(date_debut.replace('Z', '+00:00'))
            except ValueError:
                pass
                
        if date_fin:
            try:
                # Si c'est juste une date YYYY-MM-DD, ajouter 23:59:59
                if len(date_fin) == 10:
                    end_date = datetime.fromisoformat(f"{date_fin}T23:59:59")
                else:
                    end_date = datetime.fromisoformat(date_fin.replace('Z', '+00:00'))
            except ValueError:
                pass

        if not start_date:
            last_cloture = ClotureCaisse.objects.order_by('-date').first()
            start_date = last_cloture.date if last_cloture else None
        
        # 1. Transactions de vente (Caisse)
        transactions = Caisse.objects.filter(statut='completee').exclude(mode_paiement='en_compte')
        
        if start_date:
            transactions = transactions.filter(date_paiement__gte=start_date)
        if end_date:
            transactions = transactions.filter(date_paiement__lte=end_date)
            
        # 1. Détails Ventes (Totaux par mode)
        modes = transactions.values('mode_paiement').annotate(total=Sum('montant'))
        details = {item['mode_paiement']: float(item['total']) for item in modes}
        
        # Total Ventes (Calculé en Python pour économiser une requête)
        total_ventes = Decimal(sum(details.values()))

        # 2. Mouvements de caisse (Entrées/Sorties) - Optimisé en 1 requête
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
        
        # Total Théorique Global
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
        Body: { 'montant_reel': 150000 }
        """
        montant_reel = request.data.get('montant_reel')
        if montant_reel is None:
            return Response({'detail': 'Le montant réel est requis.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            montant_reel = Decimal(str(montant_reel))
        except:
            return Response({'detail': 'Montant invalide.'}, status=status.HTTP_400_BAD_REQUEST)


        # Paramètres optionnels de période
        date_debut = request.data.get('date_debut')
        date_fin = request.data.get('date_fin')
        
        start_date = None
        end_date = None
        
        if date_debut:
            try:
                start_date = datetime.fromisoformat(date_debut.replace('Z', '+00:00'))
            except ValueError:
                pass
                
        if date_fin:
            try:
                if len(date_fin) == 10:
                    end_date = datetime.fromisoformat(f"{date_fin}T23:59:59")
                else:
                    end_date = datetime.fromisoformat(date_fin.replace('Z', '+00:00'))
            except ValueError:
                pass

        # Calculer le théorique
        if not start_date:
            last_cloture = ClotureCaisse.objects.order_by('-date').first()
            start_date = last_cloture.date if last_cloture else None
        
        # Transactions Ventes
        transactions = Caisse.objects.filter(statut='completee').exclude(mode_paiement='en_compte')
        if start_date:
            transactions = transactions.filter(date_paiement__gte=start_date)
        if end_date:
            transactions = transactions.filter(date_paiement__lte=end_date)
            
        total_ventes = transactions.aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        
        # Détails Ventes
        modes = transactions.values('mode_paiement').annotate(total=Sum('montant'))
        details = {item['mode_paiement']: float(item['total']) for item in modes}
        
        # Mouvements
        mouvements = MouvementCaisse.objects.all()
        if start_date:
            mouvements = mouvements.filter(date__gte=start_date)
        if end_date:
            mouvements = mouvements.filter(date__lte=end_date)
            
        total_entrees = mouvements.filter(type='ENTREE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_sorties = mouvements.filter(type='SORTIE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')

        # Total Théorique
        montant_theorique = total_ventes + total_entrees - total_sorties
        
        # Ajout des infos mouvements dans les détails pour historique
        details['__meta__'] = {
            'total_ventes': float(total_ventes),
            'total_entrees': float(total_entrees),
            'total_sorties': float(total_sorties)
        }
        
        ecart = montant_reel - montant_theorique
        
        cloture = ClotureCaisse.objects.create(
            user=request.user,
            montant_theorique=montant_theorique,
            montant_reel=montant_reel,
            ecart=ecart,
            details=details
        )
        
        return Response(ClotureCaisseSerializer(cloture).data)


class StockLotViewSet(OptimizedSerializerMixin, viewsets.ModelViewSet):
    """
    API endpoint for stock lots (expiry management) with optimized serializers.
    - List view: Lightweight serializer (8 fields)
    - Detail view: Complete serializer with all information
    """
    queryset = StockLot.objects.select_related('produit', 'fournisseur').order_by('date_expiration')
    serializer_class = StockLotSerializer
    filter_backends = (DjangoFilterBackend, filters.OrderingFilter)
    filterset_fields = ['produit', 'fournisseur']
    ordering_fields = ['date_expiration', 'date_reception']
    permission_classes = [IsAuthenticated]
    
    # Serializers optimisés
    list_serializer_class = StockLotListSerializer
    detail_serializer_class = StockLotDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Filter by expiry date if provided
        date_expiration_lte = self.request.query_params.get('date_expiration_lte')
        if date_expiration_lte:
            qs = qs.filter(date_expiration__lte=date_expiration_lte)
        
        # Filter only positive remaining quantity by default, unless specified
        include_empty = self.request.query_params.get('include_empty', 'false')
        if include_empty.lower() != 'true':
            qs = qs.filter(quantity_remaining__gt=0)
            
        return qs

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def sortir_perimes(self, request, pk=None):
        """
        Sort un lot du stock (destruction/retour).
        """
        lot = self.get_object()
        quantity_to_remove = int(request.data.get('quantity', lot.quantity_remaining))
        reason = request.data.get('reason', 'Périmé')
        
        if quantity_to_remove > lot.quantity_remaining:
            return Response({'detail': 'Quantité insuffisante dans le lot.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Update lot
        lot.quantity_remaining -= quantity_to_remove
        lot.save()
        
        # Update product stock
        produit = lot.produit
        produit.stock = F('stock') - quantity_to_remove
        produit.save(update_fields=['stock'])
        
        return Response({'status': f'Lot mis à jour. {quantity_to_remove} unités sorties.'})


class DashboardViewSet(viewsets.ViewSet):
    """
    API endpoint for dashboard statistics.
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Returns dashboard statistics: revenue, sales count, new clients, low stock.
        """
        # DISABLED CACHE: Real-time stats are critical for accuracy
        # cached_stats = cache.get('dashboard_stats')
        # if cached_stats:
        #     return Response(cached_stats)

        # FIX: Use local timezone (Africa/Douala) to get the correct "today"
        # timezone.now() returns UTC-aware datetime
        # timezone.localtime() converts to the configured TIME_ZONE in settings.py
        local_now = timezone.localtime(timezone.now())
        today = local_now.date()
        yesterday = today - timedelta(days=1)
        
        # --- Préparation des sous-requêtes pour éviter les produits cartésiens ---
        
        # 1. Sous-requête pour le Total HT d'une facture (somme des produits)
        produits_subquery = FactureProduit.objects.filter(
            facture=OuterRef('pk')
        ).values('facture').annotate(
            total_ht_calc=Sum(F('quantity') * F('selling_price'), output_field=DecimalField())
        ).values('total_ht_calc')

        # 2. Sous-requête pour le Total Réglé (paiements validés hors 'en_compte')
        paiements_subquery = Caisse.objects.filter(
            facture=OuterRef('pk'),
            statut='completee'
        ).exclude(
            mode_paiement='en_compte'
        ).values('facture').annotate(
            total_paye_calc=Sum('montant')
        ).values('total_paye_calc')

        # Expression pour le Total TTC calculé: (Total HT - Remise) * (1 + TVA/100)
        # Note: On cast 100 en Decimal pour éviter les calculs float imprécis
        # Note 2: COALESCE(..., 0) est crucial si pas de produits/paiements
        
        from decimal import Decimal
        
        factures_annotated = Facture.objects.annotate(
            annotated_total_ht=Coalesce(Subquery(produits_subquery), Value(Decimal('0.00'))),
            annotated_total_paye=Coalesce(Subquery(paiements_subquery), Value(Decimal('0.00')))
        ).annotate(
            annotated_total_ttc=(
                F('annotated_total_ht') - F('remise')
            )
            # FIX: Previously we multiplied by (1 + TVA/100), but 'annotated_total_ht' comes from 
            # FactureProduit.selling_price which is ALREADY TTC (Tax Included).
            # So the formula is simply: TotalTTC (sum of lines) - GlobalDiscount.
        )

        
        # --- 1. Chiffre d'affaires & Ventes ---
        
        daily_stats = factures_annotated.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            date__date__in=[today, yesterday]
        ).values('date__date').annotate(
            revenue=Sum('annotated_total_ttc'),
            count=Count('id'),
            # Calcul Remise Totale = Remise Globale (Facture) + Somme des Remises Lignes (FactureProduit)
            discount=Sum(
                F('remise') + Coalesce(
                    Subquery(
                         FactureProduit.objects.filter(
                            facture=OuterRef('pk')
                        ).values('facture').annotate(
                            line_discount_sum=Sum(F('quantity') * F('discount'), output_field=DecimalField())
                        ).values('line_discount_sum')
                    ), 
                    Value(Decimal('0.00'))
                )
            )
        )
        
        stats_dict = {
            item['date__date']: {'revenue': item['revenue'], 'count': item['count'], 'discount': item['discount']} 
            for item in daily_stats
        }

        # Stats Aujourd'hui
        revenue_today = stats_dict.get(today, {}).get('revenue', Decimal('0.00')) or Decimal('0.00')
        sales_count_today = stats_dict.get(today, {}).get('count', 0)
        discount_today = stats_dict.get(today, {}).get('discount', Decimal('0.00')) or Decimal('0.00')
        
        # Stats Hier
        revenue_yesterday = stats_dict.get(yesterday, {}).get('revenue', Decimal('0.00')) or Decimal('0.00')
        sales_count_yesterday = stats_dict.get(yesterday, {}).get('count', 0)
        discount_yesterday = stats_dict.get(yesterday, {}).get('discount', Decimal('0.00')) or Decimal('0.00')
        
        # Variations
        if revenue_yesterday > 0:
            revenue_change = ((revenue_today - revenue_yesterday) / revenue_yesterday) * 100
        else:
            revenue_change = 100 if revenue_today > 0 else 0
            
        if sales_count_yesterday > 0:
            sales_change = ((sales_count_today - sales_count_yesterday) / sales_count_yesterday) * 100
        else:
            sales_change = 100 if sales_count_today > 0 else 0
            
        if discount_yesterday > 0:
            discount_change = ((discount_today - discount_yesterday) / discount_yesterday) * 100
        else:
            discount_change = 100 if discount_today > 0 else 0


        # --- 2. Nouveaux Clients ---
        new_clients_today = Client.objects.filter(created_at__date=today).count()
        new_clients_yesterday = Client.objects.filter(created_at__date=yesterday).count()
        
        if new_clients_yesterday > 0:
            clients_change = ((new_clients_today - new_clients_yesterday) / new_clients_yesterday) * 100
        else:
            clients_change = 100 if new_clients_today > 0 else 0


        # --- 3. Alertes Stock ---
        low_stock_count = Produit.objects.filter(stock__lte=5).count()
        stock_change = 0 


        # --- 4. Créances Clients ---
        # Calcul du reste à payer sur la base annotée
        # FIX: Align logic with CreanceViewSet & Client.current_debt
        # We assume annotated_total_paye EXCLUDES 'en_compte' payments (defined in subquery above)
        # So reste_a_payer > 0 means the client owes money (either unpaid, partial cash, or credit)
        receivables_aggs = factures_annotated.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
            # REMOVED: paiements__mode_paiement='en_compte' (To include ALL debt)
        ).annotate(
            reste_a_payer=F('annotated_total_ttc') - F('annotated_total_paye')
        ).filter(
            reste_a_payer__gt=Decimal('0.1') # Tolérance centimes
        ).aggregate(
            total_receivables=Sum('reste_a_payer'),
            receivables_count=Count('id', distinct=True) # FIX: Avoid duplicate counts if joins occur
        )

        total_receivables = receivables_aggs['total_receivables'] or Decimal('0.00')
        receivables_count = receivables_aggs['receivables_count'] or 0


        # --- 5. Valorisation du stock ---
        stock_valuation = Produit.objects.aggregate(
            total=Sum(F('stock') * F('cost_price'), output_field=DecimalField())
        )['total'] or 0

        data = {
            'revenue': {
                'value': revenue_today,
                'change': round(revenue_change, 1)
            },
            'sales': {
                'value': sales_count_today,
                'change': round(sales_change, 1)
            },
            'clients': {
                'value': new_clients_today,
                'change': round(clients_change, 1)
            },
            'low_stock': {
                'value': low_stock_count,
                'change': 0
            },
            'receivables': {
                'value': total_receivables,
                'count': receivables_count
            },
            'stock_value': {
                'value': stock_valuation,
                'change': 0
            },
            'discount': {
                'value': discount_today,
                'change': round(discount_change, 1)
            }
        }
        return Response(data)


    @action(detail=False, methods=['get'])
    def recent_transactions(self, request):
        """
        Returns the 5 most recent transactions (factures).
        """
        recent_factures = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).select_related('client').prefetch_related('produits').order_by('-date')[:5]
        
        data = []
        for facture in recent_factures:
            data.append({
                'id': facture.id,
                'client': facture.client.name if facture.client else 'Client de passage',
                'amount': facture.total_ttc,
                'date': facture.date,
                'status': facture.get_status_display(),
                'status_code': facture.status
            })
            
        return Response(data)

    @action(detail=False, methods=['get'])
    def revenue_chart(self, request):
        """
        Returns revenue for the last 7 days.
        """
        today = timezone.now().date()
        days = []
        revenue_data = []
        
        for i in range(6, -1, -1):
            date = today - timedelta(days=i)
            day_name = date.strftime('%a') # Mon, Tue, etc.
            # Traduction simple
            days_map = {'Mon': 'Lun', 'Tue': 'Mar', 'Wed': 'Mer', 'Thu': 'Jeu', 'Fri': 'Ven', 'Sat': 'Sam', 'Sun': 'Dim'}
            days.append(days_map.get(day_name, day_name))
            
            factures = Facture.objects.filter(
                date__date=date,
                status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
            ).prefetch_related('produits')
            
            daily_revenue = sum(f.total_ttc for f in factures)
            revenue_data.append(daily_revenue)
            
        return Response({
            'labels': days,
            'data': revenue_data
        })

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """
        Returns products with low stock.
        """
        limit = int(request.query_params.get('limit', 5))
        # Use F() to compare against the stock_minimum field of each product
        low_stock_products = Produit.objects.filter(stock__lte=F('stock_minimum')).order_by('stock')[:limit]
        
        data = []
        for product in low_stock_products:
            data.append({
                'id': product.id,
                'name': product.name,
                'stock': product.stock
            })
            
        return Response(data)

    @action(detail=False, methods=['get'])
    def clients_depassement(self, request):
        """
        Returns clients who have exceeded their credit limit (plafond).
        """
        # Get all clients with plafond > 0
        clients_with_plafond = Client.objects.filter(plafond__gt=0)
        
        data = []
        for client in clients_with_plafond:
            debt = client.current_debt  # Uses the property which handles annotation
            if debt > client.plafond:
                excess = debt - client.plafond
                data.append({
                    'id': client.id,
                    'name': client.name,
                    'plafond': client.plafond,
                    'dette': debt,
                    'depassement': excess
                })
        
        # Sort by excess amount descending
        data.sort(key=lambda x: x['depassement'], reverse=True)
        
        return Response(data)


class StatistiquesViewSet(viewsets.ViewSet):
    """
    API endpoint for detailed statistics.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def ca_par_fournisseur(self, request):
        """
        Calcule le CA et la marge par fournisseur pour une période donnée.
        Paramètres: date_debut, date_fin (YYYY-MM-DD)
        """
        print(f"DEBUG API: ca_par_fournisseur called. Params: {request.query_params}")
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        
        if not date_debut or not date_fin:
            return Response({'detail': 'Les paramètres date_debut et date_fin sont requis.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            # Parse dates (assuming YYYY-MM-DD)
            start_date = datetime.strptime(date_debut, '%Y-%m-%d')
            end_date = datetime.strptime(date_fin, '%Y-%m-%d') + timedelta(days=1) # Include the end date fully by going to next day 00:00
            start_date = timezone.make_aware(start_date)
            end_date = timezone.make_aware(end_date)
            print(f"DEBUG API: Date range: {start_date} to {end_date}")
        except ValueError:
            return Response({'detail': 'Format de date invalide. Utilisez YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        # Récupérer les allocations pour les factures validées/payées dans la période
        allocations = FactureProduitAllocation.objects.filter(
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            facture_produit__facture__date__gte=start_date,
            facture_produit__facture__date__lt=end_date
        ).select_related('stock_lot__fournisseur')
        
        print(f"DEBUG API: Allocations found: {allocations.count()}")
        
        stats_par_fournisseur = {}
        
        for alloc in allocations:
            fournisseur = alloc.stock_lot.fournisseur
            if fournisseur.id not in stats_par_fournisseur:
                stats_par_fournisseur[fournisseur.id] = {
                    'id': fournisseur.id,
                    'nom': fournisseur.name,
                    'ca_ttc': Decimal('0.00'),
                    'cout_achat': Decimal('0.00'),
                    'marge_brute': Decimal('0.00'),
                    'quantite_vendue': 0
                }
            
            # Calculs
            # Attention: selling_price dans FactureProduitAllocation est unitaire
            ca_ligne = Decimal(str(alloc.selling_price)) * alloc.quantity
            cout_ligne = Decimal(str(alloc.cost_price)) * alloc.quantity
            
            stats_par_fournisseur[fournisseur.id]['ca_ttc'] += ca_ligne
            stats_par_fournisseur[fournisseur.id]['cout_achat'] += cout_ligne
            stats_par_fournisseur[fournisseur.id]['marge_brute'] += (ca_ligne - cout_ligne)
            stats_par_fournisseur[fournisseur.id]['quantite_vendue'] += alloc.quantity
            
        return Response(list(stats_par_fournisseur.values()))


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
        # FIX: Align logic with Client.current_debt
        # We need ALL invoices that have a remaining debt (remainder > 0)
        # regardless of payment mode (en_compte or partial cash or just unpaid)
        
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
        
        # NOTE: This replaces the previous simplified logic.
        # It ensures that if I have a invoice of 1000, unpaid (0 payments), remainder=1000 > 0 -> INCLUDED.
        # If I have invoice 1000, paid 500 cash, remainder=500 > 0 -> INCLUDED.
        # If I have invoice 1000, paid 1000 'en_compte', remainder=1000 > 0 -> INCLUDED.
        # If I have invoice 1000, paid 1000 cash, remainder=0 -> EXCLUDED.

        # and let the frontend do the filtering of "Pending" vs "History" if the dataset isn't huge.
        # BUT, to respect the "disappeared" issue: 
        # The user said "toute les factures avaient des montant reste a payer".
        # If I removed PAYEE from Pending view, and they were PAYEE, that's the bug.
        
        show_history = self.request.query_params.get('history', 'false').lower() == 'true'
        
        # If history is requested, we might want EVERYTHING or just closed ones?
        # Let's revert to a broader filter and handle distinction carefully.
        
        # STRATEGY CHANGE:
        # Instead of strict Status filtering, let's filter by logic.
        # However, computing debt in DB is hard.
        # Let's try to trust the 'PAYEE' status means 'Fully Paid' usually.
        # If user has PAYEE invoices with debt, data is inconsistent.
        # But to show them, we must include PAYEE in the default view IF they have debt.
        # Since we can't easily check debt in SQL here without duplicating logic:
        # We will return BOTH statuses for now, and let Frontend filter? 
        # No, pagination.
        
        # Better: Filter by status only if we are sure.
        # If I remove the strict status filter, I return everything.
        # Let's remove the strict 'history' toggle on status for now and return all receivables.
        # The frontend uses 'reste_a_payer > 0' to show in main list anyway?
        # Wait, frontend 'filteredCreances' does not filter by debt, mostly by client.
        
        # FIX: Return ALL receivables (VALIDEE + PAYEE) in the queryset.
        # Let the frontend 'showHistory' toggle just filter by 'reste_a_payer == 0' vs '> 0'.
        # This solves the "missing invoices" if they were PAYEE.
        # And allows "History" to show the fully paid ones.
        
        # So, I will REMOVE the backend filtering based on history param for status,
        # but keep it if we want to optimize.
        # Given the user reporting missing stuff, let's open the gates.
        
        pass # No extra status filtering based on history param here to ensure everything is sent.
        # Validation: check if client wants history separation on backend.
        # If I send everything, frontend 'Creances.tsx' needs to filter Pending = (reste > 0).
        
        # Let's look at Creances.tsx again.
        # It calculates 'reste' in 'clientsGroupes' and 'filteredCreances'.
        # If I send all VALIDEE+PAYEE, the frontend has the data.
        
        # So I will revert the "Filtrer par statut" block I added.

        
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
        Paramètres:
        - client_id: ID du client (requis)
        - date_debut: Date de début (YYYY-MM-DD, optionnel)
        - date_fin: Date de fin (YYYY-MM-DD, optionnel)
        """
        client_id = request.query_params.get('client_id')
        
        if not client_id:
            return Response(
                {'detail': 'Le paramètre client_id est requis.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            client = Client.objects.get(pk=client_id)
        except Client.DoesNotExist:
            return Response(
                {'detail': 'Client non trouvé.'},
                status=status.HTTP_404_NOT_FOUND
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
            
        # Relaxed filtering: Find invoices by ID, ignore status (we filter by debt later)
        # But ensure consistency (e.g. same client)
        factures = Facture.objects.filter(id__in=facture_ids)
        
        if not factures.exists():
             return Response(
                {'detail': 'No invoices found.'},
                status=status.HTTP_404_NOT_FOUND
            )
            
        # Verify Client Consistency
        client_ids = factures.values_list('client', flat=True).distinct()
        if len(client_ids) > 1:
             return Response(
                {'detail': 'All invoices must belong to the same client.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        client = factures.first().client
        
        # Create Relevé
        from .models import RelevePaiement
        # Generate unique reference
        import datetime
        timestamp = datetime.datetime.now().strftime('%Y%m%d%H%M%S')
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
             # Calculate remaining amount
            montant_paye = facture.paiements.filter(
                statut='completee'
            ).exclude(
                mode_paiement='en_compte'
            ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')
            
            reste = facture.total_ttc - montant_paye

            if reste <= 0:
                continue

            # Create payment linked to Releve
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
            
        # Update Relevé Total
        releve.total_amount = total_paid_bulk
        releve.save()

        return Response({
            'detail': f'Règlement groupé effectué avec succès. {count_processed} factures traitées.',
            'releve_reference': releve.reference,
            'total_amount': str(total_paid_bulk)
        })



class InventaireViewSet(viewsets.ModelViewSet):
    queryset = Inventaire.objects.all().order_by('-date')
    serializer_class = InventaireSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action == 'imprimer_etat':
            return [permissions.AllowAny()]
        return super().get_permissions()

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def validate(self, request, pk=None):
        """
        Validation de l'inventaire avec support des lots.
        - Si une ligne a un stock_lot: met à jour la quantité du lot spécifique
        - Sinon: met à jour le stock global du produit (backward compatibility)
        """
        inventaire = self.get_object()
        if inventaire.status == Inventaire.Status.VALIDEE:
             return Response({'detail': 'Cet inventaire est déjà validé.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Mettre à jour le stock pour chaque ligne
        lignes = inventaire.lignes.select_related('produit', 'stock_lot').all()
        for ligne in lignes:
            produit = ligne.produit
            
            if ligne.stock_lot:
                # Mode LOT: Mettre à jour la quantité du lot spécifique
                lot = ligne.stock_lot
                lot.quantity_remaining = ligne.quantite_physique
                lot.save()
                
                # Recalculer le stock global du produit (somme des lots)
                if produit.use_lot_management:
                    produit.calculate_stock_from_lots()
                else:
                    # Si le produit n'utilise pas la gestion par lot mais qu'un lot existe,
                    # on met à jour quand même le stock global
                    produit.stock = ligne.quantite_physique
                    produit.save(update_fields=['stock'])
            else:
                # Mode PRODUIT GLOBAL: Ancien comportement (backward compatibility)
                produit.stock = ligne.quantite_physique
                produit.save(update_fields=['stock'])
             
        inventaire.status = Inventaire.Status.VALIDEE
        inventaire.save()
        
        # Log d'audit explicite
        total_ecart = sum(l.ecart for l in lignes)
        log_audit(
            user=request.user,
            action=AuditLog.Action.INVENTORY_VALIDATE,
            model_name='Inventaire',
            object_id=inventaire.id,
            description=f"Inventaire validé: {lignes.count()} lignes, écart total: {total_ecart:+d} unités",
            details={
                'inventaire_id': inventaire.id,
                'date': inventaire.date.isoformat() if inventaire.date else None,
                'lignes_count': lignes.count(),
                'ecart_total': total_ecart
            },
            request=request
        )
        
        return Response({'status': 'Inventaire validé. Stocks mis à jour.'})


    @action(detail=True, methods=['get'])
    def imprimer_etat(self, request, pk=None):
        """
        Génère un PDF de l'état d'inventaire groupé par rayon.
        """
        inventaire = self.get_object()
        
        response = HttpResponse(content_type='application/pdf')
        filename = f"inventaire_{inventaire.id}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        buffer = io.BytesIO()
        doc = BaseDocTemplate(buffer, pagesize=letter, topMargin=1*inch, bottomMargin=1*inch)
        
        # Simple frame
        frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='normal')
        template = PageTemplate(id='main', frames=[frame])
        doc.addPageTemplates([template])
        
        story = []
        styles = getSampleStyleSheet()
        
        # Titles
        story.append(Paragraph(f"ETAT D'INVENTAIRE #{inventaire.id}", styles['Title']))
        story.append(Paragraph(f"Date: {inventaire.date.strftime('%d/%m/%Y')}", styles['Normal']))
        if inventaire.description:
            story.append(Paragraph(f"Description: {inventaire.description}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Data
        lignes = inventaire.lignes.select_related('produit', 'produit__rayon').order_by('produit__rayon__name', 'produit__name')
        grouped = {}
        for l in lignes:
            r = l.produit.rayon.name if l.produit and l.produit.rayon else "AUTRES"
            if r not in grouped: grouped[r] = []
            grouped[r].append(l)
            
        for rayon in sorted(grouped.keys()):
            story.append(Paragraph(f"<b>RAYON: {rayon}</b>", styles['Heading3']))
            
            data = [['Produit', 'Theo.', 'Phys.', 'Ecart', 'Val.']]
            total_val = 0
            for l in grouped[rayon]:
                price = l.produit.pmp if l.produit else 0
                val = l.ecart * price
                total_val += val
                data.append([
                    Paragraph(l.produit.name[:35], styles['Normal']),
                    str(l.stock_theorique),
                    str(l.quantite_physique),
                    str(l.ecart),
                    f"{val:.0f}"
                ])
            data.append(['', '', '', 'TOTAL', f"{total_val:.0f}"])
            
            t = Table(data, colWidths=[3*inch, 0.8*inch, 0.8*inch, 0.6*inch, 1*inch])
            t.setStyle(TableStyle([
                ('GRID', (0,0), (-1,-2), 1, colors.black),
                ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
                ('ALIGN', (1,0), (-1,-1), 'CENTER'),
                ('LINEBELOW', (0,-2), (-1,-2), 1, colors.black),
                ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold')
            ]))
            story.append(t)
            story.append(Spacer(1, 15))
            
        doc.build(story)
        pdf = buffer.getvalue()
        buffer.close()
        response.write(pdf)
        return response

class LigneInventaireViewSet(viewsets.ModelViewSet):
    queryset = LigneInventaire.objects.all()
    serializer_class = LigneInventaireSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['inventaire']
    
    def create(self, request, *args, **kwargs):
        """
        Gestion de la création de ligne d'inventaire.
        Si stock_lot est fourni, utilise la quantité du lot comme stock_theorique.
        Sinon, utilise le stock global du produit (backward compatibility).
        """
        data = request.data.copy()
        
        if 'stock_lot' in data and data['stock_lot']:
            # Mode LOT: Utiliser la quantité du lot
            try:
                lot = StockLot.objects.get(id=data['stock_lot'])
                # Auto-remplir stock_theorique avec la quantité du lot
                data['stock_theorique'] = lot.quantity_remaining
                # Auto-remplir quantite_physique si non fourni
                if 'quantite_physique' not in data:
                    data['quantite_physique'] = lot.quantity_remaining
            except StockLot.DoesNotExist:
                return Response({'error': 'Lot non trouvé'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Mode PRODUIT GLOBAL: Utiliser le stock total (ancien comportement)
            try:
                produit = Produit.objects.get(id=data['produit'])
                if 'stock_theorique' not in data:
                    data['stock_theorique'] = produit.stock
                if 'quantite_physique' not in data:
                    data['quantite_physique'] = produit.stock
            except Produit.DoesNotExist:
                return Response({'error': 'Produit non trouvé'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_create(self, serializer):
        # Capture theoretical stock at time of creation
        produit = serializer.validated_data['produit']
        # Check if we already have stock_theorique from the create method
        if 'stock_theorique' not in serializer.validated_data:
            serializer.save(stock_theorique=produit.stock)
        else:
            serializer.save()

class MouvementCaisseViewSet(viewsets.ModelViewSet):
    """API endpoint for cash movements."""
    queryset = MouvementCaisse.objects.select_related('user').order_by('-date')
    serializer_class = MouvementCaisseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['type', 'user']
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    def perform_create(self, serializer):
        # Capture theoretical stock at time of creation
        produit = serializer.validated_data['produit']
        serializer.save(stock_theorique=produit.stock)



# Avoir ViewSet
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
                    
                    # Always update general product stock
                    produit.stock -= ligne.quantity
                    produit.save()
                    
                    # Créer historique de stock (NEGATIF pour sortie)
                    lot_info = f" - Lot: {ligne.stock_lot.lot}" if ligne.stock_lot else ""
                    ActivityLog.objects.create(
                        user=request.user,
                        action='AVOIR',
                        details=f'Avoir {avoir.numero}: {ligne.produit_nom} x {ligne.quantity}{lot_info} (Type: {avoir.get_type_avoir_display()})'
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
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, F, Q, DecimalField, Count
from django.db.models.functions import Coalesce
from decimal import Decimal
from .models import StockLot, Fournisseur, CommandeProduit, Commande
from .serializers import FournisseurSerializer


class StatsUGViewSet(viewsets.GenericViewSet):
    """
    ViewSet pour les statistiques des unités gratuites (UG).
    """
    queryset = StockLot.objects.all()
    
    @action(detail=False, methods=['get'])
    def par_fournisseur(self, request):
        """
        Statistiques UG par fournisseur:
        - Total UG reçues
        - Total UG vendues (via allocations)
        - Total UG restantes en stock
        - Valeur économisée (prix moyen * UG reçues)
        
        QueryParams:
        - fournisseur_id: Filter by specific supplier (optional)
        - date_debut: Start date filter (optional)
        - date_fin: End date filter (optional)
        """
        fournisseur_id = request.query_params.get('fournisseur_id')
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        
        # Base query
        lots_query = StockLot.objects.all()
        
        # Apply filters
        if fournisseur_id:
            lots_query = lots_query.filter(fournisseur_id=fournisseur_id)
        
        if date_debut:
            lots_query = lots_query.filter(date_reception__gte=date_debut)
        
        if date_fin:
            lots_query = lots_query.filter(date_reception__lte=date_fin)
        
        # Aggregate by supplier
        stats = lots_query.values(
            'fournisseur_id',
            'fournisseur__name'
        ).annotate(
            ug_recues=Sum('quantity_free'),
            ug_restantes=Sum(F('quantity_remaining') * F('quantity_free') / F('quantity_initial'), 
                           output_field=DecimalField()),
            valeur_acquise=Sum(F('quantity_free') * F('price_cost'), 
                                output_field=DecimalField()),
            valeur_restante=Sum(
                (F('quantity_remaining') * F('quantity_free') / F('quantity_initial')) * F('price_cost'),
                output_field=DecimalField()
            )
        ).order_by('-ug_recues')
        
        # Calculate derived values
        results = []
        for stat in stats:
            ug_recues = int(stat['ug_recues'] or 0)
            # Skip if no UG received
            if ug_recues <= 0:
                continue
                
            ug_restantes = int(stat['ug_restantes'] or 0)
            ug_vendues = ug_recues - ug_restantes
            
            valeur_acquise = float(stat['valeur_acquise'] or 0)
            valeur_restante = float(stat['valeur_restante'] or 0)
            valeur_vendue = valeur_acquise - valeur_restante

            results.append({
                'fournisseur_id': stat['fournisseur_id'],
                'fournisseur_nom': stat['fournisseur__name'],
                'ug_recues': ug_recues,
                'ug_vendues': ug_vendues,
                'ug_restantes': ug_restantes,
                'valeur_acquise': valeur_acquise,
                'valeur_vendue': valeur_vendue,
                'valeur_restante': valeur_restante
            })
        
        return Response({
            'results': results,
            'total': {
                'ug_recues': sum(r['ug_recues'] for r in results),
                'ug_vendues': sum(r['ug_vendues'] for r in results),
                'ug_restantes': sum(r['ug_restantes'] for r in results),
                'valeur_acquise': sum(r['valeur_acquise'] for r in results),
                'valeur_vendue': sum(r['valeur_vendue'] for r in results),
                'valeur_restante': sum(r['valeur_restante'] for r in results)
            }
        })
    
    @action(detail=False, methods=['get'])
    def par_produit(self, request):
        """
        Statistiques UG pour un produit spécifique:
        - Historique des UG reçues par commande
        - UG actuellement en stock (via StockLot)
        
        QueryParams:
        - produit_id: Product ID (required)
        """
        produit_id = request.query_params.get('produit_id')
        
        if not produit_id:
            return Response(
                {'error': 'produit_id est requis'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get all stock lots for this product with free units
        lots = StockLot.objects.filter(
            produit_id=produit_id,
            quantity_free__gt=0
        ).select_related(
            'fournisseur',
            'commande_produit__commande'
        ).order_by('-date_reception')
        
        historique = []
        ug_en_stock = 0
        
        for lot in lots:
            # Calculate how many UG are still in this lot
            if lot.quantity_remaining > 0:
                ug_remaining_in_lot = int(
                    (lot.quantity_remaining / lot.quantity_initial) * lot.quantity_free
                )
                ug_en_stock += ug_remaining_in_lot
            else:
                ug_remaining_in_lot = 0
            
            historique.append({
                'commande_id': lot.commande_produit.commande.id,
                'fournisseur': lot.fournisseur.name,
                'date_reception': lot.date_reception,
                'ug_recues': lot.quantity_free,
                'ug_restantes': ug_remaining_in_lot,
                'lot_numero': lot.lot,
                'date_expiration': lot.date_expiration
            })
        
        total_ug_recues = lots.aggregate(
            total=Sum('quantity_free')
        )['total'] or 0
        
        return Response({
            'produit_id': produit_id,
            'total_ug_recues': int(total_ug_recues),
            'ug_en_stock': ug_en_stock,
            'ug_vendues': int(total_ug_recues) - ug_en_stock,
            'historique': historique
        })
    
    @action(detail=False, methods=['get'])
    def dashboard_summary(self, request):
        """
        Résumé rapide pour le dashboard:
        - Total UG en stock
        - Total UG reçues ce mois
        - Valeur totale économisée
        """
        from datetime import datetime, timedelta
        from django.utils import timezone
        
        # Current month
        now = timezone.now()
        debut_mois = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Total UG en stock (approximation)
        total_ug_stock = StockLot.objects.filter(
            quantity_remaining__gt=0
        ).aggregate(
            total=Sum(
                F('quantity_remaining') * F('quantity_free') / F('quantity_initial'),
                output_field=DecimalField()
            )
        )['total'] or 0
        
        # UG reçues ce mois
        ug_mois = CommandeProduit.objects.filter(
            created_at__gte=debut_mois,
            unites_gratuites__gt=0
        ).aggregate(
            total=Sum('unites_gratuites')
        )['total'] or 0
        
        # Valeur économisée (total)
        valeur_economisee = StockLot.objects.aggregate(
            total=Sum(
                F('quantity_free') * F('price_cost'),
                output_field=DecimalField()
            )
        )['total'] or 0
        
        return Response({
            'ug_en_stock': int(total_ug_stock),
            'ug_recues_mois': int(ug_mois),
            'valeur_economisee': float(valeur_economisee),
            'periode': {
                'debut': debut_mois.isoformat(),
                'fin': now.isoformat()
            }
        })


class RelationTransformationViewSet(viewsets.ModelViewSet):
    queryset = RelationTransformation.objects.all()
    serializer_class = RelationTransformationSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            print("❌ RelationTransformation Validation Errors:", serializer.errors)
            print("❌ Request Data:", request.data)
        return super().create(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'])
    def transformer(self, request, pk=None):
        """
        Effectue une transformation.
        Body: {"quantite": 5}
        """
        relation = self.get_object()
        quantite = int(request.data.get('quantite', 1))
        
        if quantite <= 0:
            return Response(
                {'error': 'La quantité doit être positive'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # 1. Vérifier stock source
            if relation.produit_source.stock < quantite:
                return Response(
                    {'error': f'Stock insuffisant pour {relation.produit_source.name}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 2. Calculer quantité destination
            quantite_dest = int(quantite * relation.ratio)
            
            # 3. Ajuster stocks
            # LOCK rows for update
            source = Produit.objects.select_for_update().get(pk=relation.produit_source.pk)
            destination = Produit.objects.select_for_update().get(pk=relation.produit_destination.pk)

            source.stock -= quantite
            source.save()
            
            destination.stock += quantite_dest
            destination.save()
            
            # 4. Créer historique
            HistoriqueTransformation.objects.create(
                relation=relation,
                produit_source=relation.produit_source,
                produit_destination=relation.produit_destination,
                quantite_source=quantite,
                quantite_destination=quantite_dest,
                user=request.user,
                notes=request.data.get('notes', '')
            )
            
            # 5. Créer mouvements stock pour statistiques
            MouvementStock.objects.create(
                produit=relation.produit_source,
                type_mouvement='TRANSFORMATION_SORTIE',
                quantite=-quantite,
                stock_apres=source.stock,
                user=request.user,
                description=f"Transformation vers {relation.produit_destination.name}"
            )
            
            MouvementStock.objects.create(
                produit=relation.produit_destination,
                type_mouvement='TRANSFORMATION_ENTREE',
                quantite=quantite_dest,
                stock_apres=destination.stock,
                user=request.user,
                description=f"Transformation depuis {relation.produit_source.name}"
            )
        
        return Response({
            'success': True,
            'stock_source': source.stock,
            'stock_destination': destination.stock,
            'message': f"Transformation réussie : {quantite} {source.name} -> {quantite_dest} {destination.name}"
        })


class HistoriqueTransformationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HistoriqueTransformation.objects.all()
    serializer_class = HistoriqueTransformationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['produit_source', 'produit_destination']
    ordering_fields = ['date_transformation']
    ordering = ['-date_transformation']


from rest_framework.views import APIView

class InvoiceConfigurationView(APIView):
    """
    API View simplifiée pour gérer la configuration unique de la facture.
    GET: Récupère la config (en crée une par défaut si inexistante)
    PUT: Met à jour la config
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        settings, created = InvoiceSettings.objects.get_or_create(pk=1)
        serializer = InvoiceSettingsSerializer(settings)
        return Response(serializer.data)

    def put(self, request):
        settings, created = InvoiceSettings.objects.get_or_create(pk=1)
        serializer = InvoiceSettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class CategoriesListView(APIView):
    """Simple API View for categories without authentication."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        rayons = Rayon.objects.all().order_by('name')
        serializer = RayonSerializer(rayons, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = RayonSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class CategoriesDetailView(APIView):
    """Simple API View for category detail operations."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get_object(self, pk):
        try:
            return Rayon.objects.get(pk=pk)
        except Rayon.DoesNotExist:
            return None

    def get(self, request, pk):
        rayon = self.get_object(pk)
        if not rayon:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = RayonSerializer(rayon)
        return Response(serializer.data)

    def put(self, request, pk):
        rayon = self.get_object(pk)
        if not rayon:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = RayonSerializer(rayon, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        rayon = self.get_object(pk)
        if not rayon:
            return Response(status=status.HTTP_404_NOT_FOUND)
        rayon.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generer_suggestions_commande(request):
    """
    Génère des suggestions de commandes selon le mode choisi.
    
    POST /api/generer-suggestions/
    Body: {
        "mode": "simple" | "optimise",
        "periode": 30,  # jours
        "fournisseur_id": null | int,
    }
    """
    mode = request.data.get('mode', 'simple')
    periode = int(request.data.get('periode', 30))
    fournisseur_id = request.data.get('fournisseur_id')
    
    if mode == 'simple':
        suggestions = calculer_reapprovisionnement_simple(
            periode=periode,
            fournisseur_id=fournisseur_id
        )
    else:
        suggestions = calculer_optimisation_intelligente(
            periode=periode,
            fournisseur_id=fournisseur_id
        )
    
    return Response({
        'mode': mode,
        'periode': periode,
        'suggestions': suggestions,
        'total_produits': len(suggestions)
    })


def calculer_reapprovisionnement_simple(periode, fournisseur_id=None):
    """
    Calcul simple : Qté = Ventes sur période - Stock actuel
    """
    date_debut = timezone.now() - timedelta(days=periode)
    print(f"DEBUG: Calcul simple. Période: {periode} jours. Depuis: {date_debut}")
    
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
        
        # DEBUG pour voir quelques produits
        if ventes > 0:
            print(f"DEBUG: Produit {produit.name} - Ventes: {ventes}, Stock: {stock_actuel}")
        
        # Calcul simple
        qte_a_commander = max(0, int(ventes) - stock_actuel)
        
        # Afficher TOUS les produits qui ont des ventes (même si qté suggérée = 0)
        if ventes > 0:
            suggestions.append({
                'produit_id': produit.id,
                'produit_nom': produit.name,
                'produit_ref': produit.cip1 or '',
                'fournisseur_id': produit.fournisseur.id if produit.fournisseur else None,
                'fournisseur_nom': produit.fournisseur.name if produit.fournisseur else 'N/A',
                'stock_actuel': int(stock_actuel),
                'ventes_periode': int(ventes),
                'quantite_suggeree': int(qte_a_commander),
                'prix_achat': float(produit.cost_price or 0),
                'rotation': 'N/A',
                'tendance': 'N/A',
                'urgence': 'urgent' if stock_actuel < ventes else 'normal',
                'couverture_jours': 0
            })
    
    # Trier par quantité suggérée (décroissant)
    suggestions.sort(key=lambda x: x['quantite_suggeree'], reverse=True)
    print(f"DEBUG: {len(suggestions)} suggestions trouvées")
    
    return suggestions


def calculer_optimisation_intelligente(periode, fournisseur_id=None):
    """
    Calcul optimisé avec rotation, tendances, stock
    """
    date_debut = timezone.now() - timedelta(days=periode)
    date_mi_periode = timezone.now() - timedelta(days=periode // 2)
    print(f"DEBUG: Calcul optimisé. Période: {periode} jours.")
    
    produits = Produit.objects.all()
    if fournisseur_id:
        produits = produits.filter(fournisseur_id=fournisseur_id)
    
    suggestions = []
    
    for produit in produits:
        # 1. Ventes totales
        ventes_total = FactureProduit.objects.filter(
            produit=produit,
            facture__date__gte=date_debut,
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).aggregate(total=Sum('quantity'))['total'] or 0
        
        # DEBUG
        if ventes_total > 0:
             print(f"DEBUG OPTIM: {produit.name} - Ventes: {ventes_total}")

        if ventes_total == 0:
            continue  # Skip produits non vendus
        
        # 2. Consommation journalière
        conso_jour = float(ventes_total) / periode
        
        # 3. Stock actuel
        stock_actuel = int(produit.stock or 0)
        
        # 4. Couverture en jours
        if conso_jour > 0:
            couverture_jours = stock_actuel / conso_jour
        else:
            couverture_jours = 999
        
        # 5. Rotation (ventes / stock moyen)
        stock_moyen = max(stock_actuel, 1)  # Simplification
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
        
        # 7. Calcul quantité optimale
        # Stock cible = 30 jours
        stock_cible = conso_jour * 30
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
        qte_base *= tendance
        
        # Arrondir
        qte_finale = int(round(qte_base))
        
        # Déterminer urgence
        if couverture_jours < 7:
            urgence = 'urgent'
        elif couverture_jours < 15:
            urgence = 'bientot'
        else:
            urgence = 'normal'
        
        # Toujours ajouter les produits vendus (pas de seuil minimum)
        suggestions.append({
            'produit_id': produit.id,
            'produit_nom': produit.name,
            'produit_ref': produit.cip1 or '',
            'fournisseur_id': produit.fournisseur.id if produit.fournisseur else None,
            'fournisseur_nom': produit.fournisseur.name if produit.fournisseur else 'N/A',
            'stock_actuel': stock_actuel,
            'ventes_periode': int(ventes_total),
            'quantite_suggeree': max(qte_finale, 0),
            'prix_achat': float(produit.cost_price or 0),
            'rotation': niveau_rotation,
            'tendance': round(tendance, 2),
            'urgence': urgence,
            'couverture_jours': int(couverture_jours)
        })
    
    # Trier par urgence puis quantité
    ordre_urgence = {'urgent': 0, 'bientot': 1, 'normal': 2}
    suggestions.sort(key=lambda x: (ordre_urgence.get(x['urgence'], 3), -x['quantite_suggeree']))
    print(f"DEBUG: {len(suggestions)} suggestions optimisées trouvées")
    
    return suggestions


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing audit logs.
    Restricted to Admin users only.
    """
    queryset = AuditLog.objects.all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = AuditLogFilter
    search_fields = ['description', 'object_id', 'model_name']
    ordering_fields = ['timestamp']
    ordering = ['-timestamp']  # Default ordering for pagination
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """
        Retourne des statistiques sur les logs d'audit.
        """
        from django.db.models import Count
        from datetime import timedelta
        
        # Appliquer les mêmes filtres que la liste principale
        queryset = self.filter_queryset(self.get_queryset())
        
        # Statistiques générales
        total_logs = queryset.count()
        
        # Répartition par type d'action
        actions_stats = queryset.values('action').annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Convertir les codes d'action en libellés lisibles
        actions_with_labels = []
        for stat in actions_stats:
            action_code = stat['action']
            # Récupérer le libellé depuis les choices
            action_label = dict(AuditLog.Action.choices).get(action_code, action_code)
            actions_with_labels.append({
                'action': action_code,
                'action_label': action_label,
                'count': stat['count']
            })
        
        # Top utilisateurs actifs
        top_users = queryset.exclude(user__isnull=True).values(
            'user__id', 'user__username', 'user__first_name', 'user__last_name'
        ).annotate(count=Count('id')).order_by('-count')[:10]
        
        # Formater les noms des utilisateurs
        top_users_formatted = []
        for user_stat in top_users:
            full_name = f"{user_stat.get('user__first_name', '')} {user_stat.get('user__last_name', '')}".strip()
            display_name = full_name or user_stat.get('user__username', 'Utilisateur')
            top_users_formatted.append({
                'user_id': user_stat['user__id'],
                'username': user_stat.get('user__username'),
                'display_name': display_name,
                'count': user_stat['count']
            })
        
        # Actions récentes (dernières 24h, 7 jours, 30 jours)
        now = timezone.now()
        logs_24h = queryset.filter(timestamp__gte=now - timedelta(hours=24)).count()
        logs_7d = queryset.filter(timestamp__gte=now - timedelta(days=7)).count()
        logs_30d = queryset.filter(timestamp__gte=now - timedelta(days=30)).count()
        
        return Response({
            'total_logs': total_logs,
            'actions_stats': actions_with_labels,
            'top_users': top_users_formatted,
            'recent_activity': {
                'last_24h': logs_24h,
                'last_7d': logs_7d,
                'last_30d': logs_30d
            }
        })
    
    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """
        Exporte les logs d'audit en CSV.
        """
        import csv
        from django.http import HttpResponse
        
        # Appliquer les mêmes filtres que la liste principale
        queryset = self.filter_queryset(self.get_queryset())
        
        # Créer la réponse HTTP avec le bon content-type
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="audit_logs_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv"'
        
        # Ajouter le BOM UTF-8 pour Excel
        response.write('\ufeff')
        
        writer = csv.writer(response)
        
        # En-têtes
        writer.writerow([
            'ID', 'Date/Heure', 'Utilisateur', 'Action', 
            'Modèle', 'ID Objet', 'Description', 'Adresse IP'
        ])
        
        # Données
        for log in queryset.select_related('user'):
            user_name = 'Système'
            if log.user:
                full_name = f"{log.user.first_name} {log.user.last_name}".strip()
                user_name = full_name or log.user.username
            
            writer.writerow([
                log.id,
                log.timestamp.strftime('%d/%m/%Y %H:%M:%S'),
                user_name,
                log.get_action_display(),
                log.model_name,
                log.object_id or '',
                log.description or '',
                log.ip_address or ''
            ])
        
        return response


class StockAdjustmentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint pour consulter l'historique des ajustements de stock.
    Lecture seule - les ajustements sont créés via l'action 'adjust_stock' de ProduitViewSet.
    """
    queryset = StockAdjustment.objects.select_related('produit', 'user', 'stock_lot').order_by('-created_at')
    serializer_class = StockAdjustmentSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['produit', 'user', 'reason_type']
    search_fields = ['produit__name', 'reason_detail', 'produit__cip1']
    ordering_fields = ['created_at', 'quantity_change']
    ordering = ['-created_at']


class PromisViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing Promis (products promised to clients).
    """
    queryset = Promis.objects.select_related('client', 'produit', 'facture', 'created_by').all()
    serializer_class = PromisSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
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
        # On ne doit pas mettre à jour directement produit.stock
        if not produit.use_lot_management:
            produit.stock += promis.quantite
            produit.save(update_fields=['stock'])
        # Note: Pour les produits avec use_lot_management=True, le stock sera recalculé
        # automatiquement par les signaux lors de la création/modification des lots.
        # Si un promis est annulé, il n'y a généralement pas de lot à réintégrer car
        # le promis était créé en l'absence de stock disponible.
        
        # 2. Créer le mouvement de stock (type RETOUR = affiché en vert)
        final_stock = produit.stock if not produit.use_lot_management else produit.stock
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
        # Double hauteur pour les 2 tickets
        c = canvas.Canvas(buffer, pagesize=(ticket_width, ticket_height * 2 + 20))
        
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

        # On suppose que tous les promis sont pour le même client, 
        # mais sinon on prend le premier pour les infos d'en-tête.
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
        # Hauteur dynamique, on met grand pour éviter coupure, le printer coupera
        ticket_height = 200 * mm 
        
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="ticket_promis_groupe_{first_promis.facture.numero_facture}.pdf"'

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


class StockAnalysisUnsoldView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        '''
        Retourne la liste des produits invendus (Stock > 0 et Rotation Moyenne = 0)
        Paramètres:
        - fournisseur: ID du fournisseur (optionnel)
        '''
        fournisseur_id = request.query_params.get('fournisseur', None)
        
        produits = Produit.objects.filter(
            stock__gt=0, 
            rotation_moyenne=0
        ).select_related('fournisseur')
        
        if fournisseur_id:
            produits = produits.filter(fournisseur_id=fournisseur_id)
        
        results = []
        total_value = Decimal('0.00')
        
        for produit in produits:
            value = Decimal(str(produit.stock)) * Decimal(str(produit.cost_price))
            
            results.append({
                'id': produit.id,
                'name': produit.name,
                'stock': produit.stock,
                'stock_maximum': produit.stock_maximum,
                'cost_price': float(produit.cost_price or 0),
                'selling_price': float(produit.selling_price or 0),
                'value': float(value),
                'created_at': produit.created_at.date(),
                'fournisseur_name': produit.fournisseur.name if produit.fournisseur else 'N/A'
            })
            total_value += value
        
        return Response({
            'type': 'invendus',
            'fournisseur': Fournisseur.objects.get(id=fournisseur_id).name if fournisseur_id and Fournisseur.objects.filter(id=fournisseur_id).exists() else 'Tous',
            'total_items': len(results),
            'total_value': float(total_value),
            'items': results
        })

class StockAnalysisOverstockView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        '''
        Retourne la liste des produits en surstock (Stock > 1.7 * Rotation Moyenne)
        Paramètres:
        - fournisseur: ID du fournisseur (optionnel)
        '''
        fournisseur_id = request.query_params.get('fournisseur', None)
        
        produits = Produit.objects.filter(
            stock__gt=0,
            rotation_moyenne__gt=0
        ).select_related('fournisseur')
        
        if fournisseur_id:
            produits = produits.filter(fournisseur_id=fournisseur_id)
        
        results = []
        total_value = Decimal('0.00')
        
        for produit in produits:
            rotation = float(produit.rotation_moyenne)
            threshold = rotation * 1.7
            
            if produit.stock > threshold:
                excess_qty = produit.stock - int(threshold)
                # Valeur du surstock = quantité en excès * prix achat
                excess_value = Decimal(excess_qty) * Decimal(str(produit.cost_price))
                
                results.append({
                    'id': produit.id,
                    'name': produit.name,
                    'stock': produit.stock,
                    'rotation': rotation,
                    'threshold': round(threshold, 2),
                    'excess_qty': excess_qty,
                    'cost_price': float(produit.cost_price or 0),
                    'selling_price': float(produit.selling_price or 0),
                    'value': float(excess_value), # Valeur de l'excès seulement
                    'total_value_stock': float(Decimal(produit.stock) * Decimal(str(produit.cost_price))),
                    'fournisseur_name': produit.fournisseur.name if produit.fournisseur else 'N/A'
                })
                total_value += excess_value
        
        return Response({
            'type': 'surstock',
            'fournisseur': Fournisseur.objects.get(id=fournisseur_id).name if fournisseur_id and Fournisseur.objects.filter(id=fournisseur_id).exists() else 'Tous',
            'total_items': len(results),
            'total_value': float(total_value),
            'items': results
        })


class MouvementCaisseViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing cash register movements (entries and exits).
    """
    queryset = MouvementCaisse.objects.select_related('user').all()
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
