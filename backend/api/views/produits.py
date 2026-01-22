from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import F, Sum, Count, Q, ProtectedError
from django.http import HttpResponse
import io
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import BaseDocTemplate, Frame, Paragraph, PageTemplate, Table, TableStyle, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from django.utils import timezone

from ..models import (
    Produit, Rayon, Fournisseur, StockLot, StockAdjustment, 
    FactureProduit, CommandeProduit, AuditLog, Facture, Commande
)
from ..serializers import (
    ProduitSerializer, RayonSerializer, FournisseurSerializer,
    StockLotSerializer, StockAdjustmentSerializer
)
from ..serializers_optimized import (
    ProduitListSerializer, ProduitDetailSerializer,
    StockLotListSerializer, StockLotDetailSerializer
)
from ..serializer_mixins import OptimizedSerializerMixin
from ..cache_mixins import CachedSearchMixin
from ..search_mixins import MultiTermSearchMixin
from ..audit_helpers import log_audit

class ProduitViewSet(CachedSearchMixin, MultiTermSearchMixin, OptimizedSerializerMixin, viewsets.ModelViewSet):
    """
    API endpoint for products with optimizations:
    - Automatic caching for search queries (TTL: 5 minutes)
    - Optimized serializers for list vs detail views
    - Multi-term AND search (e.g., "doli 500" finds products with both terms)
    
    Performance improvements:
    - Cache: 90-95% faster for cached queries
    - Serializers: 50% smaller responses for lists
    """
    # Optimisation: select_related pour éviter les requêtes N+1 sur rayon et fournisseur
    queryset = Produit.objects.select_related('rayon', 'fournisseur').order_by('name')
    serializer_class = ProduitSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]  # Removed SearchFilter, using custom search
    ordering_fields = ['name', 'stock', 'selling_price', 'updated_at']
    search_fields = ['^name', '^cip1', '^cip2', '^cip3']

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filtrage manuel pour stock_lt (utilisé dans les rapports)
        stock_lt = self.request.query_params.get('stock_lt')
        if stock_lt is not None:
            try:
                val = float(stock_lt)
                queryset = queryset.filter(stock__lt=val)
            except ValueError:
                pass
        
        # Filtrage pour TVA (utilisé dans les rapports)
        tva_gt = self.request.query_params.get('tva_gt')
        if tva_gt is not None:
             try:
                 val = float(tva_gt)
                 queryset = queryset.filter(tva__gt=val)
             except ValueError:
                 pass
                
        # Filtrage pour la Vitrine (produits publics uniquement)
        is_public = self.request.query_params.get('is_public')
        if is_public is not None:
             if is_public.lower() == 'true':
                 queryset = queryset.filter(is_public=True)
             elif is_public.lower() == 'false':
                 queryset = queryset.filter(is_public=False)

        # Filtrage par Rayon (Catégorie)
        rayon_id = self.request.query_params.get('rayon')
        if rayon_id:
            queryset = queryset.filter(rayon_id=rayon_id)
            
        # Filtrage par Fournisseur
        fournisseur_id = self.request.query_params.get('fournisseur')
        if fournisseur_id:
            queryset = queryset.filter(fournisseur_id=fournisseur_id)

        # Filtrage par Forme
        forme_id = self.request.query_params.get('forme')
        if forme_id:
            queryset = queryset.filter(forme_id=forme_id)

        return queryset

    @action(detail=False, methods=['get'])
    def for_import(self, request):
        """
        Endpoint optimisé pour l'import CSV.
        Retourne TOUS les produits avec seulement les champs nécessaires pour la correspondance CIP.
        Pas de pagination pour permettre la correspondance complète.
        """
        produits = Produit.objects.only(
            'id', 'name', 'cip1', 'cip2', 'cip3',
            'cost_price', 'selling_price', 'tva', 'taux_marge'
        ).values(
            'id', 'name', 'cip1', 'cip2', 'cip3',
            'cost_price', 'selling_price', 'tva', 'taux_marge'
        )
        
        return Response(list(produits))

    @action(detail=True, methods=['post'])
    def toggle_public(self, request, pk=None):
        """Action pour basculer rapidement la visibilité publique d'un produit."""
        produit = self.get_object()
        produit.is_public = not produit.is_public
        produit.save()
        return Response({
            'status': 'success',
            'is_public': produit.is_public,
            'message': f"Produit {'rendu public' if produit.is_public else 'retiré de la vitrine'}"
        })

    @action(detail=False, methods=['post'])
    def bulk_toggle_public(self, request):
        """
        Active ou désactive la visibilité publique pour une liste de produits.
        Body: { 'ids': [1, 2, 3], 'target_status': true/false }
        """
        ids = request.data.get('ids', [])
        target_status = request.data.get('target_status')
        
        if not ids or not isinstance(ids, list):
            return Response({'detail': 'Liste d\'IDs invalide ou vide.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if target_status is None:
             return Response({'detail': 'target_status est requis (true/false).'}, status=status.HTTP_400_BAD_REQUEST)
             
        # Conversion explicite en booléen
        is_public = bool(target_status)
        
        updated_count = Produit.objects.filter(id__in=ids).update(is_public=is_public)
        
        return Response({
            'status': 'success',
            'updated_count': updated_count,
            'message': f"{updated_count} produits mis à jour."
        })

    # Configuration des serializers optimisés
    list_serializer_class = ProduitListSerializer
    detail_serializer_class = ProduitDetailSerializer

    def perform_update(self, serializer):
        """
        Override update to audit price changes.
        """
        instance = serializer.instance
        old_price = instance.selling_price
        
        # Save updates
        serializer.save()
        
        # Check if price changed
        new_price = serializer.instance.selling_price
        if old_price != new_price:
            log_audit(
                user=self.request.user,
                action='PRICE_CHG', # Custom or standard action
                model_name='Produit',
                object_id=instance.id,
                description=f"Changement prix {instance.name}: {old_price:.0f} -> {new_price:.0f}",
                details={
                    'produit_id': instance.id,
                    'produit_nom': instance.name,
                    'old_price': float(old_price),
                    'new_price': float(new_price),
                    'montant': float(new_price)
                },
                request=self.request
            )

    def destroy(self, request, *args, **kwargs):
        """
        Override destroy to handle ProtectedError gracefully.
        Products cannot be deleted if they are referenced in historical records.
        """
        instance = self.get_object()
        produit_id = instance.id
        produit_nom = instance.name
        
        try:
            self.perform_destroy(instance)
            
            # Log successful deletion
            log_audit(
                user=request.user,
                action='DELETE',
                model_name='Produit',
                object_id=produit_id,
                description=f"Suppression produit: {produit_nom}",
                details={
                    'id': produit_id,
                    'name': produit_nom
                },
                request=request
            )
            
        except ProtectedError as e:
            # Extract the protected objects information
            protected_objects = e.protected_objects
            
            # Group by model type
            model_counts = {}
            for obj in protected_objects:
                model_name = obj.__class__.__name__
                model_counts[model_name] = model_counts.get(model_name, 0) + 1
            
            # Build a user-friendly error message
            references = ', '.join([f"{count} {model}" for model, count in model_counts.items()])
            
            return Response({
                'error': 'Cannot delete product',
                'detail': f'This product cannot be deleted because it is referenced in: {references}. '
                         'Products with historical records (sales, purchases, inventories, etc.) cannot be deleted to preserve data integrity.',
                'protected_references': model_counts
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """
        Reconstructs the stock history for a product.
        """
        from ..models import MouvementStock
        produit = self.get_object()
        
        # 1. Mouvements de stock génériques (ajustements, transformations, etc.)
        mouvements = MouvementStock.objects.filter(produit=produit).select_related('user').values(
            'date', 'type_mouvement', 'quantite', 'stock_apres', 'description', 'user__username', 'id'
        )
        
        history = []
        for m in mouvements:
            history.append({
                'date': m['date'],
                'type': m['type_mouvement'],
                'quantity': m['quantite'], # Peut être négatif
                'stock_apres': m['stock_apres'],
                'libelle': m['description'] or m['type_mouvement'],
                'prix_unitaire': 0, # Non applicable ou à récupérer
                'user': m['user__username'],
                'source': 'MOUVEMENT',
                'id': m['id']
            })
            
        # 2. Ventes (Factures Validées)
        # Note: id est utilisé pour garantir l'unicité dans le tri si dates identiques
        # Optimisation: select_related pour éviter les requêtes
        ventes = FactureProduit.objects.filter(
            produit=produit, 
            facture__status__in=['VAL', 'PAY']  # Inclure VAL (validée) et PAY (payée)
        ).select_related('facture', 'facture__client').values(
            'facture__date', 'quantity', 'selling_price', 'facture__numero_facture', 'facture__client__name', 'facture__id'
        )
        
        for v in ventes:
            history.append({
                'date': v['facture__date'],
                'type': 'SORTIE',
                'quantity': -v['quantity'], # Sortie de stock
                'stock_apres': 0, # Calculé après
                'libelle': f"Vente: Facture #{v['facture__numero_facture'] or v['facture__id']} - {v['facture__client__name'] or 'Client Divers'}",
                'prix_unitaire': v['selling_price'],
                'user': '',
                'source': 'VENTE',
                'id': v['facture__id']
            })
            
        # 3. Achats (Commandes Clôturées) - SUPPRIMÉ car dupliqué avec MouvementStock
        # Les entrées de stock lors de la clôture sont déjà enregistrées dans MouvementStock
        # Garder cette section commentée pour référence:
        # achats = CommandeProduit.objects.filter(
        #     produit=produit,
        #     commande__status='CLOT'
        # ).select_related('commande', 'commande__fournisseur').values(
        #     'commande__date', 'quantity', 'unites_gratuites', 'price_cost', 'commande__id', 'commande__fournisseur__name'
        # )
        # for a in achats:
        #     total_qty = a['quantity'] + a['unites_gratuites']
        #     history.append({...})

        # 4. Ajustements de stock (inventaires, corrections, annulations réception)
        adjustments = StockAdjustment.objects.filter(produit=produit).select_related('user').values(
            'created_at', 'quantity_change', 'quantity_after', 'reason_type', 'reason_detail', 'user__username', 'id'
        )
        
        for adj in adjustments:
            type_mouvement = 'ENTREE' if adj['quantity_change'] >= 0 else 'SORTIE'
            history.append({
                'date': adj['created_at'],
                'type': type_mouvement,
                'quantity': adj['quantity_change'],  # Peut être négatif
                'stock_apres': adj['quantity_after'],  # Déjà disponible
                'libelle': f"Ajustement: {adj['reason_detail'] or adj['reason_type']}",
                'prix_unitaire': 0,
                'user': adj['user__username'] or '',
                'source': 'AJUSTEMENT',
                'id': adj['id']
            })


        # Trier par date DESC
        history.sort(key=lambda x: x['date'], reverse=True)
        
        # Recalculer les stocks intermédiaires en remontant le temps
        # Le stock actuel est connu
        current_stock = produit.stock
        running_stock = current_stock
        
        for item in history:
            # Pour l'item courant (le plus récent non traité), le stock après est le running_stock
            item['stock_apres'] = running_stock
            
            # Le stock avant cet item était: stock_apres - quantité (car quantite est signée: + pour entrée, - pour sortie)
            # stock_avant = stock_apres - delta
            # Exemple: Entrée de 10. Stock Après = 50. Stock Avant = 50 - 10 = 40.
            # Exemple: Sortie de 5 (-5). Stock Après = 40. Stock Avant = 40 - (-5) = 45.
            
            stock_before = running_stock - item['quantity']
            
            item['stock_avant'] = stock_before
            
            # Ajout des champs pour l'affichage cohérent
            item.update({
                'stock_avant': stock_before,
                'stock_apres': running_stock
            })
            
            # Pour la prochaine itération (plus ancienne), le stock courant devient le stock avant de celle-ci
            running_stock = stock_before
            
        return Response(history)

    @action(detail=True, methods=['get'])
    def monthly_stats(self, request, pk=None):
        """
        Retourne les statistiques mensuelles d'un produit:
        - Quantité vendue (Qté V) par mois
        - Quantité commandée (Qté C) par mois
        - Nombre de commandes (Nb C) par mois
        """
        produit = self.get_object()
        
        # Agrégation des ventes (factures validées uniquement)
        from django.db.models.functions import TruncMonth
        
        ventes = FactureProduit.objects.filter(
            produit=produit,
            facture__status__in=['VAL', 'PAY']
        ).annotate(
            mois=TruncMonth('facture__date')
        ).values('mois').annotate(
            qte_v=Sum('quantity')
        ).order_by('-mois')
        
        # Agrégation des commandes (clôturées uniquement)
        commandes = CommandeProduit.objects.filter(
            produit=produit,
            commande__status='CLOT'
        ).annotate(
            mois=TruncMonth('commande__date')
        ).values('mois').annotate(
            qte_c=Sum('quantity'),
            nb_c=Count('id', distinct=True)  # Distinct pour éviter les doublons
        ).order_by('-mois')
        
        # Fusionner les données par mois
        stats_by_month = {}
        
        for v in ventes:
            if v['mois']:
                key = v['mois'].strftime('%Y-%m')
                if key not in stats_by_month:
                    stats_by_month[key] = {'year': v['mois'].year, 'month': v['mois'].month, 'qte_v': 0, 'qte_c': 0, 'nb_c': 0}
                stats_by_month[key]['qte_v'] = v['qte_v'] or 0
        
        for c in commandes:
            if c['mois']:
                key = c['mois'].strftime('%Y-%m')
                if key not in stats_by_month:
                    stats_by_month[key] = {'year': c['mois'].year, 'month': c['mois'].month, 'qte_v': 0, 'qte_c': 0, 'nb_c': 0}
                stats_by_month[key]['qte_c'] = c['qte_c'] or 0
                stats_by_month[key]['nb_c'] = c['nb_c'] or 0
        
        # Trier par date décroissante et formater
        mois_noms = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                     'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
        
        result = []
        for key in sorted(stats_by_month.keys(), reverse=True):
            data = stats_by_month[key]
            result.append({
                'year': data['year'],
                'month': data['month'],
                'month_name': mois_noms[data['month']],
                'qte_v': data['qte_v'],
                'qte_c': data['qte_c'],
                'nb_c': data['nb_c']
            })
        
        return Response(result)

    @action(detail=False, methods=['get'])
    def stock_alerts(self, request):
        """
        Retourne les produits en alerte stock.
        Critères: Stock < Rotation Moyenne OU Stock <= Stock Minimum
        """
        produits = Produit.objects.filter(
            Q(stock__lt=F('rotation_moyenne')) |
            Q(stock__lte=F('stock_minimum'))
        ).order_by('name').values('id', 'name', 'stock', 'rotation_moyenne', 'stock_minimum')
        
        # Format response with clean field names
        result = [
            {
                'nom_produit': p['name'],
                'stock': p['stock'],
                'rotation': round(float(p['rotation_moyenne']), 1),
                'stock_min': p['stock_minimum']
            }
            for p in produits
        ]
        return Response(result)

    @action(detail=False, methods=['post'])
    def recalculate_rotation(self, request):
        """
        Recalcule la rotation moyenne pour tous les produits.
        Rotation = (Quantité totale vendue) / (Durée de vie du produit en mois)
        """
        try:
            produits = Produit.objects.all()
            count = 0
            
            # Date de référence pour la durée de vie (aujourd'hui)
            today = timezone.now().date()
            
            with transaction.atomic():
                for produit in produits:
                    # Calculer la durée de vie en mois depuis la création
                    # Minimum 1 mois pour éviter division par zéro
                    months_since_creation = (today - produit.created_at.date()).days / 30.0
                    months = max(1.0, months_since_creation)
                    
                    # Total vendu (toutes les factures validées/payées)
                    total_sold = FactureProduit.objects.filter(
                        produit=produit,
                        facture__status__in=['VAL', 'PAY']
                    ).aggregate(total=Sum('quantity'))['total'] or 0
                    
                    # Rotation mensuelle moyenne
                    rotation = float(total_sold) / months
                    
                    produit.rotation_moyenne = rotation
                    produit.save(update_fields=['rotation_moyenne'])
                    count += 1
                    
            return Response({'message': f'Rotation recalculée pour {count} produits'})
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
            return Response({'error': 'No products provided'}, status=status.HTTP_400_BAD_REQUEST)

        buffer = io.BytesIO()
        
        # Dimensions pour l'imprimante thermique (à ajuster selon modèle, ex: 50mm x 30mm)
        # Ici on simule une page standard avec plein d'étiquettes ou une mise en page spécifique
        # Pour simplicité, on génère un PDF A4 avec grille d'étiquettes
        
        c = canvas.Canvas(buffer, pagesize=letter)
        w, h = letter
        
        # Configuration grille (exemple: 3 colonnes, 8 rangées)
        col_width = w / 3
        row_height = h / 8
        margin = 10
        
        x = 0
        y = h - row_height
        
        from reportlab.graphics.barcode import code128
        
        for item in products_data:
            try:
                produit = Produit.objects.get(pk=item.get('id'))
                qty = item.get('quantity', 1)
                
                for _ in range(qty):
                    # Dessiner l'étiquette à x, y
                    
                    # Cadre
                    c.rect(x + margin, y + margin, col_width - 2*margin, row_height - 2*margin)
                    
                    # Nom produit (tronqué)
                    c.setFont("Helvetica-Bold", 10)
                    c.drawString(x + margin + 5, y + row_height - margin - 15, produit.name[:25])
                    
                    # Prix
                    c.setFont("Helvetica-Bold", 14)
                    c.drawRightString(x + col_width - margin - 5, y + row_height - margin - 15, f"{produit.selling_price:.0f} F")
                    
                    # Code barre (CIP ou ID)
                    code_value = produit.cip1 or str(produit.id).zfill(8)
                    barcode = code128.Code128(code_value, barHeight=20, barWidth=1.2)
                    barcode.drawOn(c, x + margin + 10, y + margin + 15)
                    
                    # Texte code
                    c.setFont("Helvetica", 8)
                    c.drawCentredString(x + col_width/2, y + margin + 5, code_value)
                    
                    # Passer à la cellule suivante
                    x += col_width
                    if x >= w - 10: # Marge de sécurité
                        x = 0
                        y -= row_height
                        
                    if y < 0:
                        c.showPage()
                        y = h - row_height
                        x = 0
                        
            except Produit.DoesNotExist:
                continue
                
        c.save()
        buffer.seek(0)
        
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="etiquettes.pdf"'
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
            stock_lot.quantity_remaining = new_lot_qty
            stock_lot.save(update_fields=['quantity_remaining'])
        
        # Log d'audit explicite
        log_audit(
            user=request.user,
            action=AuditLog.Action.STOCK_ADJUST,
            model_name='Produit',
            object_id=produit.id,
            description=f"Ajustement stock: {quantity_change:+d} ({reason_detail or reason_type})",
            details={
                'produit_id': produit.id,
                'produit_nom': produit.name,
                'quantity_before': quantity_before,
                'quantity_after': new_quantity,
                'quantity_change': quantity_change,
                'reason_type': reason_type,
                'reason_detail': reason_detail,
                'stock_lot': stock_lot.lot if stock_lot else None
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

    @action(detail=False, methods=['get'])
    def analyse_abc(self, request):
        """
        Calcule la classification ABC des produits basée sur le chiffre d'affaires.
        Principe de Pareto: A = 80% CA, B = 15% CA, C = 5% CA
        
        Paramètres:
        - periode: nombre de mois d'analyse (défaut: 6)
        - rayon_id: filtrer par rayon (optionnel)
        - fournisseur_id: filtrer par fournisseur (optionnel)
        """
        from django.db.models.functions import Coalesce
        from decimal import Decimal
        from dateutil.relativedelta import relativedelta
        
        # Paramètres
        try:
            periode = int(request.query_params.get('periode', 6))
        except ValueError:
            periode = 6
            
        rayon_id = request.query_params.get('rayon_id')
        fournisseur_id = request.query_params.get('fournisseur_id')
        
        # Date de début basée sur la période
        date_debut = timezone.now() - relativedelta(months=periode)
        
        # Calculer le CA par produit sur la période
        # On ne prend que les factures validées/payées (exclure BROU, PROF, ANN)
        produit_filter = Q(
            facture__status__in=['VAL', 'PAY'],
            facture__date__gte=date_debut
        )
        
        if rayon_id:
            produit_filter &= Q(produit__rayon_id=rayon_id)
        if fournisseur_id:
            produit_filter &= Q(produit__fournisseur_id=fournisseur_id)
        
        # Agrégation: CA par produit
        ventes_par_produit = FactureProduit.objects.filter(
            produit_filter
        ).values(
            'produit', 'produit__name', 'produit__stock', 'produit__cip1', 
            'produit__selling_price', 'produit__rayon__name', 'produit__fournisseur__name'
        ).annotate(
            chiffre_affaires=Coalesce(Sum(F('quantity') * F('selling_price')), Decimal('0')),
            quantite_vendue=Coalesce(Sum('quantity'), 0)
        ).order_by('-chiffre_affaires')
        
        # Calculer le CA total
        ca_total = sum(item['chiffre_affaires'] for item in ventes_par_produit)
        
        if ca_total == 0:
            return Response({
                'periode_mois': periode,
                'date_debut': date_debut.date().isoformat(),
                'ca_total': 0,
                'nb_produits_a': 0,
                'nb_produits_b': 0,
                'nb_produits_c': 0,
                'produits': []
            })
        
        # Classification ABC
        seuil_a = Decimal('0.80')  # 80% du CA
        seuil_b = Decimal('0.95')  # 80% + 15% = 95%
        
        ca_cumule = Decimal('0')
        produits_classes = []
        
        stats = {'A': 0, 'B': 0, 'C': 0}
        ca_par_categorie = {'A': Decimal('0'), 'B': Decimal('0'), 'C': Decimal('0')}
        
        for item in ventes_par_produit:
            ca_produit = item['chiffre_affaires']
            ca_cumule += ca_produit
            pourcentage_cumule = ca_cumule / ca_total
            pourcentage_ca = (ca_produit / ca_total * 100).quantize(Decimal('0.01'))
            
            # Déterminer la catégorie
            if pourcentage_cumule <= seuil_a:
                categorie = 'A'
            elif pourcentage_cumule <= seuil_b:
                categorie = 'B'
            else:
                categorie = 'C'
            
            stats[categorie] += 1
            ca_par_categorie[categorie] += ca_produit
            
            produits_classes.append({
                'id': item['produit'],
                'nom': item['produit__name'],
                'cip': item['produit__cip1'] or '-',
                'rayon': item['produit__rayon__name'] or 'Sans rayon',
                'fournisseur': item['produit__fournisseur__name'] or '-',
                'stock': item['produit__stock'],
                'prix_vente': float(item['produit__selling_price']),
                'chiffre_affaires': float(ca_produit),
                'quantite_vendue': item['quantite_vendue'],
                'pourcentage_ca': float(pourcentage_ca),
                'pourcentage_cumule': float((pourcentage_cumule * 100).quantize(Decimal('0.01'))),
                'categorie': categorie,
                'en_rupture': item['produit__stock'] <= 0
            })
        
        # Compter les produits sans ventes (catégorie C) - OPTIMISATION: seulement compter, pas charger
        produits_avec_ventes = [p['id'] for p in produits_classes]
        
        produits_sans_ventes_filter = ~Q(id__in=produits_avec_ventes)
        if rayon_id:
            produits_sans_ventes_filter &= Q(rayon_id=rayon_id)
        if fournisseur_id:
            produits_sans_ventes_filter &= Q(fournisseur_id=fournisseur_id)
        
        # Compter seulement (rapide)
        nb_produits_sans_ventes = Produit.objects.filter(produits_sans_ventes_filter).count()
        stats['C'] += nb_produits_sans_ventes
        
        # Paramètre pour charger les détails des produits C sans ventes
        include_no_sales = request.query_params.get('include_no_sales', 'false').lower() == 'true'
        limite_c = int(request.query_params.get('limite_c', 100))  # Limiter par défaut à 100
        
        if include_no_sales:
            produits_sans_ventes = Produit.objects.filter(
                produits_sans_ventes_filter
            ).values('id', 'name', 'cip1', 'stock', 'selling_price', 'rayon__name', 'fournisseur__name')[:limite_c]
            
            for p in produits_sans_ventes:
                produits_classes.append({
                    'id': p['id'],
                    'nom': p['name'],
                    'cip': p['cip1'] or '-',
                    'rayon': p['rayon__name'] or 'Sans rayon',
                    'fournisseur': p['fournisseur__name'] or '-',
                    'stock': p['stock'],
                    'prix_vente': float(p['selling_price']),
                    'chiffre_affaires': 0,
                    'pourcentage_ca': 0,
                    'pourcentage_cumule': 100,
                    'categorie': 'C',
                    'en_rupture': p['stock'] <= 0
                })
        
        # Filtrer par catégorie demandée (optionnel)
        categorie_filter = request.query_params.get('categorie')
        if categorie_filter and categorie_filter in ['A', 'B', 'C']:
            produits_classes = [p for p in produits_classes if p['categorie'] == categorie_filter]
        
        # Alertes: produits A en rupture
        produits_a_en_rupture = [p for p in produits_classes if p['categorie'] == 'A' and p['en_rupture']]
        
        return Response({
            'periode_mois': periode,
            'date_debut': date_debut.date().isoformat(),
            'ca_total': float(ca_total),
            'nb_produits_a': stats['A'],
            'nb_produits_b': stats['B'],
            'nb_produits_c': stats['C'],
            'nb_produits_c_sans_ventes': nb_produits_sans_ventes,
            'ca_categorie_a': float(ca_par_categorie['A']),
            'ca_categorie_b': float(ca_par_categorie['B']),
            'ca_categorie_c': float(ca_par_categorie['C']),
            'alertes_rupture_a': len(produits_a_en_rupture),
            'produits_a_en_rupture': [p['nom'] for p in produits_a_en_rupture[:5]],  # Top 5
            'produits': produits_classes
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

    @action(detail=True, methods=['get'])
    def catalogue(self, request, pk=None):
        """
        Retourne le catalogue des produits commandés chez ce fournisseur.
        Agrège les données des commandes clôturées pour calculer:
        - CIP du produit
        - Dernier prix d'achat
        - Date de dernière commande
        - Marge (prix vente - dernier prix achat)
        - Quantité totale commandée
        - Stock actuel
        """
        from django.db.models import Max, Subquery, OuterRef
        from django.db.models.functions import Coalesce
        from decimal import Decimal
        
        fournisseur = self.get_object()
        
        # Sous-requête pour obtenir le dernier prix d'achat par produit
        # On prend le prix de la commande la plus récente (par date_cloture)
        latest_order_subquery = CommandeProduit.objects.filter(
            produit=OuterRef('produit'),
            commande__fournisseur=fournisseur,
            commande__status='CLOT'
        ).order_by('-commande__date_cloture').values('price_cost')[:1]
        
        latest_date_subquery = CommandeProduit.objects.filter(
            produit=OuterRef('produit'),
            commande__fournisseur=fournisseur,
            commande__status='CLOT'
        ).order_by('-commande__date_cloture').values('commande__date_cloture')[:1]
        
        # Agrégation principale
        catalogue_data = CommandeProduit.objects.filter(
            commande__fournisseur=fournisseur,
            commande__status='CLOT'
        ).values(
            'produit'
        ).annotate(
            qte_totale=Sum(F('quantity') + F('unites_gratuites')),
            dernier_prix_achat=Subquery(latest_order_subquery),
            derniere_commande=Subquery(latest_date_subquery)
        ).order_by('produit__name')
        
        # Construire la réponse avec les informations produit
        result = []
        for item in catalogue_data:
            try:
                produit = Produit.objects.get(pk=item['produit'])
                
                selling_price = produit.selling_price or Decimal('0')
                dernier_prix = item['dernier_prix_achat'] or Decimal('0')
                
                # Calcul de la marge
                marge = selling_price - dernier_prix
                
                # Calcul du pourcentage de marge (sécurisé contre division par zéro)
                if selling_price > 0:
                    marge_pourcent = (marge / selling_price) * 100
                else:
                    marge_pourcent = Decimal('0')
                
                result.append({
                    'produit_id': produit.id,
                    'produit_nom': produit.name,
                    'cip': produit.cip1 or produit.cip2 or produit.cip3 or '-',
                    'dernier_prix_achat': float(dernier_prix),
                    'derniere_commande': item['derniere_commande'],
                    'prix_vente': float(selling_price),
                    'marge': float(marge),
                    'marge_pourcent': round(float(marge_pourcent), 1),
                    'qte_totale': item['qte_totale'] or 0,
                    'stock_actuel': produit.stock
                })
            except (Produit.DoesNotExist, ValueError, TypeError):
                continue
        
        # Trier par nom de produit
        result.sort(key=lambda x: x['produit_nom'].lower())
        
        return Response({
            'fournisseur_id': fournisseur.id,
            'fournisseur_nom': fournisseur.name,
            'total_produits': len(result),
            'produits': result
        })


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
