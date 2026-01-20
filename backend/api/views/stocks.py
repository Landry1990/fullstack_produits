from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import F, Sum, DecimalField
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
import io

# ReportLab imports
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, Table, TableStyle, Spacer, Frame, PageTemplate, BaseDocTemplate

from ..models import (
    StockLot, Inventaire, LigneInventaire, StockAdjustment, Produit, 
    MouvementStock, RelationTransformation, HistoriqueTransformation, 
    Fournisseur, CommandeProduit, AuditLog
)
from ..serializers import (
    StockLotSerializer, InventaireSerializer, LigneInventaireSerializer, 
    StockAdjustmentSerializer, RelationTransformationSerializer, 
    HistoriqueTransformationSerializer
)
from ..serializers_optimized import StockLotListSerializer, StockLotDetailSerializer
from ..serializer_mixins import OptimizedSerializerMixin
from ..search_mixins import MultiTermSearchMixin
from ..audit_helpers import log_audit

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
        
        # Log Audit
        log_audit(
            user=request.user,
            action='STOCK_ADJ',
            model_name='StockLot',
            object_id=lot.id,
            description=f"Sortie périmés: {quantity_to_remove} unités (Lot {lot.lot})",
            details={
                'produit_id': produit.id,
                'produit_nom': produit.name,
                'quantity': -quantity_to_remove,
                'reason': reason,
                'lot': lot.lot
            },
            request=request
        )

        return Response({'status': f'Lot mis à jour. {quantity_to_remove} unités sorties.'})


class InventaireViewSet(MultiTermSearchMixin, viewsets.ModelViewSet):
    queryset = Inventaire.objects.all().order_by('-date')
    serializer_class = InventaireSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status']
    search_fields = ['description', 'status']
    ordering_fields = ['date', 'status']

    def get_permissions(self):
        if self.action == 'imprimer_etat':
            return [permissions.AllowAny()]
        return super().get_permissions()

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def validate(self, request, pk=None):
        """
        Validation de l'inventaire avec support des lots.
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
                    produit.stock = ligne.quantite_physique
                    produit.save(update_fields=['stock'])
            else:
                # Mode PRODUIT GLOBAL: Ancien comportement
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
        
        response = io.BytesIO() # We will return content via HttpResponse outside
        # Wait, DRF actions should return Response or HttpResponse.
        from django.http import HttpResponse
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
                data['stock_theorique'] = lot.quantity_remaining
                if 'quantite_physique' not in data:
                    data['quantite_physique'] = lot.quantity_remaining
            except StockLot.DoesNotExist:
                return Response({'error': 'Lot non trouvé'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Mode PRODUIT GLOBAL: Utiliser le stock total
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
        if 'stock_theorique' not in serializer.validated_data:
            serializer.save(stock_theorique=produit.stock)
        else:
            serializer.save()

class StockAdjustmentViewSet(MultiTermSearchMixin, viewsets.ReadOnlyModelViewSet):
    """
    API endpoint pour consulter l'historique des ajustements de stock.
    Lecture seule - les ajustements sont créés via l'action 'adjust_stock' de ProduitViewSet.
    """
    queryset = StockAdjustment.objects.select_related('produit', 'user', 'stock_lot').order_by('-created_at')
    serializer_class = StockAdjustmentSerializer
    permission_classes = [permissions.AllowAny] # As per original view
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = {
        'produit': ['exact'],
        'user': ['exact'],
        'reason_type': ['exact'],
        'created_at': ['gte', 'lte', 'date'],
    }
    search_fields = ['produit__name', 'reason_detail', 'produit__cip1']
    ordering_fields = ['created_at', 'quantity_change']
    ordering = ['-created_at']

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Calculates statistics based on current filters.
        """
        queryset = self.filter_queryset(self.get_queryset())
        
        # Aggregation
        # Positive changes (Entrées)
        positive = queryset.filter(quantity_change__gt=0).aggregate(
            total=Sum('quantity_change')
        )['total'] or 0
        
        # Negative changes (Sorties)
        negative = queryset.filter(quantity_change__lt=0).aggregate(
            total=Sum('quantity_change')
        )['total'] or 0
        
        return Response({
            'total_count': queryset.count(),
            'positive_sum': int(positive),
            'negative_sum': int(negative)
        })

class StatsUGViewSet(viewsets.GenericViewSet):
    """
    ViewSet pour les statistiques des unités gratuites (UG).
    """
    queryset = StockLot.objects.all()
    
    @action(detail=False, methods=['get'])
    def par_fournisseur(self, request):
        fournisseur_id = request.query_params.get('fournisseur_id')
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        
        lots_query = StockLot.objects.all()
        if fournisseur_id:
            lots_query = lots_query.filter(fournisseur_id=fournisseur_id)
        if date_debut:
            lots_query = lots_query.filter(date_reception__gte=date_debut)
        if date_fin:
            lots_query = lots_query.filter(date_reception__lte=date_fin)
        
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
        
        results = []
        for stat in stats:
            ug_recues = int(stat['ug_recues'] or 0)
            if ug_recues <= 0: continue
                
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
        produit_id = request.query_params.get('produit_id')
        if not produit_id:
            return Response({'error': 'produit_id est requis'}, status=status.HTTP_400_BAD_REQUEST)
        
        lots = StockLot.objects.filter(
            produit_id=produit_id,
            quantity_free__gt=0
        ).select_related('fournisseur', 'commande_produit__commande').order_by('-date_reception')
        
        historique = []
        ug_en_stock = 0
        
        for lot in lots:
            if lot.quantity_remaining > 0:
                ug_remaining_in_lot = int((lot.quantity_remaining / lot.quantity_initial) * lot.quantity_free)
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
        
        total_ug_recues = lots.aggregate(total=Sum('quantity_free'))['total'] or 0
        
        return Response({
            'produit_id': produit_id,
            'total_ug_recues': int(total_ug_recues),
            'ug_en_stock': ug_en_stock,
            'ug_vendues': int(total_ug_recues) - ug_en_stock,
            'historique': historique
        })
    
    @action(detail=False, methods=['get'])
    def dashboard_summary(self, request):
        now = timezone.now()
        debut_mois = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        total_ug_stock = StockLot.objects.filter(quantity_remaining__gt=0).aggregate(
            total=Sum(F('quantity_remaining') * F('quantity_free') / F('quantity_initial'), output_field=DecimalField())
        )['total'] or 0
        
        ug_mois = CommandeProduit.objects.filter(
            created_at__gte=debut_mois, unites_gratuites__gt=0
        ).aggregate(total=Sum('unites_gratuites'))['total'] or 0
        
        valeur_economisee = StockLot.objects.aggregate(
            total=Sum(F('quantity_free') * F('price_cost'), output_field=DecimalField())
        )['total'] or 0
        
        return Response({
            'ug_en_stock': int(total_ug_stock),
            'ug_recues_mois': int(ug_mois),
            'valeur_economisee': float(valeur_economisee),
            'periode': {'debut': debut_mois.isoformat(), 'fin': now.isoformat()}
        })

class RelationTransformationViewSet(viewsets.ModelViewSet):
    queryset = RelationTransformation.objects.all()
    serializer_class = RelationTransformationSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def transformer(self, request, pk=None):
        relation = self.get_object()
        quantite = int(request.data.get('quantite', 1))
        
        if quantite <= 0:
            return Response({'error': 'La quantité doit être positive'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if relation.produit_source.stock < quantite:
                return Response({'error': f'Stock insuffisant pour {relation.produit_source.name}'}, status=status.HTTP_400_BAD_REQUEST)
            
            quantite_dest = int(quantite * relation.ratio)
            
            source = Produit.objects.select_for_update().get(pk=relation.produit_source.pk)
            destination = Produit.objects.select_for_update().get(pk=relation.produit_destination.pk)

            source.stock -= quantite
            source.save()
            
            destination.stock += quantite_dest
            destination.save()
            
            HistoriqueTransformation.objects.create(
                relation=relation,
                produit_source=relation.produit_source,
                produit_destination=relation.produit_destination,
                quantite_source=quantite,
                quantite_destination=quantite_dest,
                user=request.user,
                notes=request.data.get('notes', '')
            )
            
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

            # Log Audit transaction
            log_audit(
                user=request.user,
                action='STOCK_ADJ',
                model_name='Transformation',
                object_id=relation.id,
                description=f"Transformation: {quantite} {source.name} -> {quantite_dest} {destination.name}",
                details={
                    'source_id': source.id,
                    'source_nom': source.name,
                    'destination_id': destination.id,
                    'destination_nom': destination.name,
                    'quantite_source': -quantite,
                    'quantite_destination': quantite_dest,
                    'quantity': -quantite # Convention: negative for source consumption
                },
                request=request
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

class StockAnalysisUnsoldView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        fournisseur_id = request.query_params.get('fournisseur', None)
        
        produits = Produit.objects.filter(stock__gt=0, rotation_moyenne=0).select_related('fournisseur')
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
        fournisseur_id = request.query_params.get('fournisseur', None)
        
        produits = Produit.objects.filter(stock__gt=0, rotation_moyenne__gt=0).select_related('fournisseur')
        if fournisseur_id:
            produits = produits.filter(fournisseur_id=fournisseur_id)
        
        results = []
        total_value = Decimal('0.00')
        
        for produit in produits:
            rotation = float(produit.rotation_moyenne)
            threshold = rotation * 1.7
            
            if produit.stock > threshold:
                excess_qty = produit.stock - int(threshold)
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
                    'value': float(excess_value),
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
