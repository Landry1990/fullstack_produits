from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import F, Sum, DecimalField, Max, Q
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
import io
from django.http import HttpResponse
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment

# ReportLab imports
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, Table, TableStyle, Spacer, Frame, PageTemplate, BaseDocTemplate

from ..models import (
    StockLot, Inventaire, LigneInventaire, StockAdjustment, Produit, 
    MouvementStock, RelationTransformation, HistoriqueTransformation, 
    Fournisseur, Commande, CommandeProduit, AuditLog
)
from ..serializers import (
    StockLotSerializer, InventaireSerializer, LigneInventaireSerializer, 
    StockAdjustmentSerializer, RelationTransformationSerializer, 
    HistoriqueTransformationSerializer
)
from ..serializers_optimized import (
    StockLotListSerializer, StockLotDetailSerializer, 
    InventaireListSerializer
)
from ..serializer_mixins import OptimizedSerializerMixin
from ..search_mixins import MultiTermSearchMixin
from ..audit_helpers import log_audit
from ..sudo_utils import validate_sudo_mode

from django.db.models import F, Sum, DecimalField, Case, When, Value, ExpressionWrapper
from django.db.models.functions import Coalesce

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
        Supporte le mode SUDO pour valider par un autre utilisateur.
        """
        lot = self.get_object()
        quantity_to_remove = int(request.data.get('quantity', lot.quantity_remaining))
        reason = request.data.get('reason', 'Périmé')
        
        validation_user, error_res = validate_sudo_mode(request, permission_attr='can_manage_perimes')
        if error_res:
             return error_res
        # -------------------------
        
        if quantity_to_remove > lot.quantity_remaining:
            return Response({'detail': 'Quantité insuffisante dans le lot.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Capture quantity before for adjustment record
        quantity_before = lot.quantity_remaining

        # Update lot
        lot.quantity_remaining -= quantity_to_remove
        lot.save()
        
        # Update product stock
        produit = lot.produit
        if produit.use_lot_management:
            # Recalculate stock from all lots
            produit.calculate_stock_from_lots()
        else:
            produit.stock = F('stock') - quantity_to_remove
            produit.save(update_fields=['stock'])
        
        # Refresh to get actual stock value for MouvementStock
        produit.refresh_from_db()

        # Create StockAdjustment for traceability in Adjustment Journal
        StockAdjustment.objects.create(
            produit=produit,
            stock_lot=lot,
            user=validation_user,
            quantity_before=quantity_before,
            quantity_after=lot.quantity_remaining,
            quantity_change=-quantity_to_remove,
            reason_type=StockAdjustment.ReasonType.PERIME,
            reason_detail=f"Sortie périmés: {reason}"
        )
        
        # Create MouvementStock for traceability
        MouvementStock.objects.create(
            produit=produit,
            type_mouvement=MouvementStock.TypeMouvement.AVOIR, # ou AJUSTEMENT ? AVOIR semble utilisé pour "Sortie diverses" ici
            quantite=-quantity_to_remove,
            stock_apres=produit.stock,
            user=validation_user, # Utilise le validateur Sudo
            description=f"Sortie périmés - Lot {lot.lot}: {reason}"
        )
        
        # Log Audit
        log_audit(
            user=validation_user, # Utilise le validateur Sudo
            action=AuditLog.Action.STOCK_ADJUST,
            model_name='StockLot',
            object_id=lot.id,
            description=f"Sortie périmés par {validation_user.username}: {quantity_to_remove} unités (Lot {lot.lot})",
            details={
                'produit_id': produit.id,
                'produit_nom': produit.name,
                'quantity': -quantity_to_remove,
                'reason': reason,
                'lot': lot.lot,
                'sudo_mode': bool(validated_by_id)
            },
            request=request
        )

        return Response({'status': f'Lot mis à jour. {quantity_to_remove} unités sorties.', 'validated_by': validation_user.username})

    @action(detail=False, methods=['get'])
    def stats_perimes(self, request):
        """
        Statistiques des produits périmés et à risque d'expiration.
        Retourne:
        - Valeur des lots périmés (pertes financières)
        - Prévisions à 30/60/90 jours
        - Taux de perte vs CA
        """
        from api.models import Facture, FactureProduitAllocation
        from django.db.models import Q
        
        today = timezone.now().date()
        
        # Paramètres de période pour le CA (par défaut: 12 derniers mois)
        periode_jours = int(request.query_params.get('periode_jours', 365))
        date_debut_ca = today - timedelta(days=periode_jours)
        
        # === LOTS DÉJÀ PÉRIMÉS ===
        lots_perimes = StockLot.objects.filter(
            date_expiration__lt=today,
            quantity_remaining__gt=0
        ).select_related('produit')
        
        valeur_perimes_cout = Decimal('0')
        valeur_perimes_vente = Decimal('0')
        count_lots_perimes = 0
        details_perimes = []
        
        for lot in lots_perimes:
            valeur_cout = lot.price_cost * lot.quantity_remaining
            valeur_vente = lot.selling_price * lot.quantity_remaining
            valeur_perimes_cout += valeur_cout
            valeur_perimes_vente += valeur_vente
            count_lots_perimes += 1
            
            details_perimes.append({
                'lot_id': lot.id,
                'produit_id': lot.produit_id,
                'produit_nom': lot.produit_nom or (lot.produit.name if lot.produit else 'Inconnu'),
                'lot_numero': lot.lot,
                'date_expiration': lot.date_expiration.isoformat() if lot.date_expiration else None,
                'quantity': lot.quantity_remaining,
                'valeur_cout': float(valeur_cout),
                'valeur_vente': float(valeur_vente)
            })
        
        # === PRÉVISIONS 30/60/90 JOURS ===
        def calculer_prevision(jours):
            date_limite = today + timedelta(days=jours)
            lots = StockLot.objects.filter(
                date_expiration__gte=today,
                date_expiration__lt=date_limite,
                quantity_remaining__gt=0
            )
            total_cout = Decimal('0')
            total_vente = Decimal('0')
            count = 0
            
            for lot in lots:
                total_cout += lot.price_cost * lot.quantity_remaining
                total_vente += lot.selling_price * lot.quantity_remaining
                count += 1
                
            return {
                'jours': jours,
                'count_lots': count,
                'valeur_cout': float(total_cout),
                'valeur_vente': float(total_vente)
            }
        
        prevision_30j = calculer_prevision(30)
        prevision_60j = calculer_prevision(60)
        prevision_90j = calculer_prevision(90)
        
        # === CALCUL DU CA SUR LA PÉRIODE ===
        # Utilise les factures validées/payées
        factures_periode = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            date__gte=date_debut_ca
        )
        ca_total = factures_periode.aggregate(
            total=Sum('total_ttc')
        )['total'] or Decimal('0')
        
        # === PERTES HISTORIQUES (via MouvementStock) ===
        # Sorties pour périmés sur la période
        pertes_historiques = MouvementStock.objects.filter(
            type_mouvement=MouvementStock.TypeMouvement.AVOIR,
            description__icontains='périmé',
            date__gte=date_debut_ca
        ).aggregate(
            total_qty=Sum('quantite')
        )['total_qty'] or 0
        
        # === TAUX DE PERTE ===
        taux_perte = Decimal('0')
        if ca_total > 0:
            taux_perte = (valeur_perimes_vente / ca_total) * 100
        
        return Response({
            'date_reference': today.isoformat(),
            'periode_ca_jours': periode_jours,
            
            # Lots actuellement périmés
            'perimes': {
                'count_lots': count_lots_perimes,
                'valeur_cout': float(valeur_perimes_cout),
                'valeur_vente_perdue': float(valeur_perimes_vente),
                'details': details_perimes[:20]  # Limit to 20 for performance
            },
            
            # Prévisions
            'previsions': {
                '30j': prevision_30j,
                '60j': prevision_60j,
                '90j': prevision_90j
            },
            
            # Indicateurs financiers
            'indicateurs': {
                'ca_periode': float(ca_total),
                'taux_perte_pct': round(float(taux_perte), 2),
                'pertes_historiques_qty': abs(pertes_historiques)
            }
        })


from rest_framework.pagination import PageNumberPagination

class InventairePagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class InventaireViewSet(MultiTermSearchMixin, viewsets.ModelViewSet):
    queryset = Inventaire.objects.all().order_by('-date')
    serializer_class = InventaireSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = InventairePagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]

    filterset_fields = ['status']
    search_fields = ['description', 'status']
    ordering_fields = ['date', 'status']

    def get_serializer_class(self):
        if self.action == 'list':
            return InventaireListSerializer
        return InventaireSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        if self.action == 'list':
            # Price expression logic: if pmp_snapshot > 0 use it, else use product cost_price
            line_price_expr = Case(
                When(lignes__pmp_snapshot__gt=0, then=F('lignes__pmp_snapshot')),
                default=F('lignes__produit__cost_price'),
                output_field=DecimalField()
            )
            
            # Annotate Totals
            queryset = queryset.annotate(
                total_valeur_theorique=Coalesce(Sum(
                   F('lignes__stock_theorique') * line_price_expr,
                   output_field=DecimalField()
                ), Value(0, output_field=DecimalField())),
                
                total_valeur_physique=Coalesce(Sum(
                   F('lignes__quantite_physique') * line_price_expr,
                   output_field=DecimalField()
                ), Value(0, output_field=DecimalField())),
                
                total_ecart_valeur=Coalesce(Sum(
                   F('lignes__ecart') * line_price_expr,
                   output_field=DecimalField()
                ), Value(0, output_field=DecimalField()))
            ).select_related('created_by')
            
        return queryset

    def get_permissions(self):
        if self.action == 'imprimer_etat':
            return [permissions.AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def validate(self, request, pk=None):
        """
        Validation de l'inventaire avec support des lots.
        Support du mode SUDO (validated_by_id).
        """
        inventaire = self.get_object()
        if inventaire.status == Inventaire.Status.VALIDEE:
             return Response({'detail': 'Cet inventaire est déjà validé.'}, status=status.HTTP_400_BAD_REQUEST)
        
        validator, error_res = validate_sudo_mode(request, permission_attr='can_adjust_stock')
        if error_res:
             return error_res

        inventaire.validated_by = validator

        # Préparation du traitement groupé et recalcul
        lignes = list(inventaire.lignes.select_related('produit', 'stock_lot').all())
        products_to_recalculate = set()
        
        for ligne in lignes:
            produit = ligne.produit
            products_to_recalculate.add(produit)
            
            target_lot = ligne.stock_lot
            if not target_lot:
                lot_number = f"LOT-INV-{inventaire.id}"
                target_lot, created = StockLot.objects.get_or_create(
                    produit=produit, lot=lot_number,
                    defaults={
                        'quantity_initial': ligne.quantite_physique,
                        'quantity_remaining': ligne.quantite_physique,
                        'price_cost': ligne.pmp_snapshot or produit.cost_price or 0,
                        'date_reception': inventaire.date,
                        'fournisseur': produit.fournisseur
                    }
                )
                if not created:
                    target_lot.quantity_remaining = ligne.quantite_physique
                    target_lot.save()
                
                ligne.stock_lot = target_lot
                ligne.save(update_fields=['stock_lot'])

            # Mise à jour physique (Verrouillage du lot)
            StockLot.objects.filter(id=target_lot.id).select_for_update().update(
                quantity_remaining=ligne.quantite_physique
            )
            
            # Traçabilité
            ecart = ligne.quantite_physique - ligne.stock_theorique
            if ecart != 0:
                StockAdjustment.objects.create(
                    produit=produit, stock_lot=target_lot, user=validator,
                    quantity_before=ligne.stock_theorique,
                    quantity_after=ligne.quantite_physique,
                    quantity_change=ecart,
                    reason_type='INVENTAIRE',
                    reason_detail=f"Inventaire #{inventaire.id}"
                )

                MouvementStock.objects.create(
                    produit=produit,
                    inventaire=inventaire, # TRAÇABILITÉ
                    type_mouvement=MouvementStock.TypeMouvement.AJUSTEMENT,
                    quantite=ecart,
                    user=validator,
                    description=f"Inventaire #{inventaire.id} (Lot {target_lot.lot})",
                    date=timezone.now()
                )
             
        # Recalcul groupé (Hors boucle)
        for prod in products_to_recalculate:
            if not prod.use_lot_management:
                prod.use_lot_management = True
                prod.save(update_fields=['use_lot_management'])
            prod.calculate_stock_from_lots()
            MouvementStock.objects.filter(produit=prod, inventaire=inventaire).update(stock_apres=prod.stock)

        inventaire.status = Inventaire.Status.VALIDEE
        inventaire.save()
        
        log_audit(
            user=request.user,
            action=AuditLog.Action.INVENTORY_VALIDATE,
            model_name='Inventaire',
            object_id=inventaire.id,
            description=f"Inventaire #{inventaire.id} validé par {validator.username}",
            request=request
        )
        
        return Response({'status': 'Inventaire validé.', 'validated_by': validator.username})

    @action(detail=True, methods=['get', 'post'], url_path='lignes')
    def lignes(self, request, pk=None):
        """
        GET: Liste les lignes d'un inventaire.
        POST: Ajoute une nouvelle ligne à l'inventaire.
        URL: /api/inventaires/{id}/lignes/
        """
        inventaire = self.get_object()
        
        if request.method == 'GET':
            lignes = inventaire.lignes.select_related('produit', 'stock_lot').all()
            serializer = LigneInventaireSerializer(lignes, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            data = request.data.copy()
            data['inventaire'] = inventaire.id
            
        if 'stock_lot' in data and data['stock_lot']:
            try:
                lot = StockLot.objects.get(id=data['stock_lot'])
                data['stock_theorique'] = lot.quantity_remaining
                if 'quantite_physique' not in data:
                    data['quantite_physique'] = lot.quantity_remaining
            except StockLot.DoesNotExist:
                return Response({'error': 'Lot non trouvé'}, status=status.HTTP_400_BAD_REQUEST)
        
        elif 'lot_numero' in data and data['lot_numero']:
            # Mode NOUVEAU LOT ou LOT PAR NUMERO
            lot_num = data.get('lot_numero')
            lot_exp = data.get('lot_expiration') # Optional
            produit_id = data.get('produit')
            
            try:
                produit = Produit.objects.get(id=produit_id)
            except Produit.DoesNotExist:
                return Response({'error': 'Produit non trouvé'}, status=status.HTTP_400_BAD_REQUEST)
                
            # Chercher si le lot existe déjà pour ce produit
            existing_lot = StockLot.objects.filter(produit=produit, lot=lot_num).first()
            
            if existing_lot:
                # Utiliser le lot existant
                data['stock_lot'] = existing_lot.id
                data['stock_theorique'] = existing_lot.quantity_remaining
            else:
                # Créer un nouveau lot (vide par défaut)
                new_lot = StockLot.objects.create(
                    produit=produit,
                    lot=lot_num,
                    date_expiration=lot_exp if lot_exp else None,
                    quantity_remaining=0, # Stock théorique 0 car nouveau
                    quantity_initial=0,
                    price_cost=produit.cost_price,
                    selling_price=produit.selling_price,
                    date_reception=timezone.now()
                )
                data['stock_lot'] = new_lot.id
                data['stock_theorique'] = 0
            
            if 'quantite_physique' not in data:
                 data['quantite_physique'] = data.get('quantite_comptee', 0)

        else:
            # Mode PRODUIT GLOBAL: Utiliser le stock total
            try:
                produit = Produit.objects.get(id=data['produit'])
                if 'stock_theorique' not in data:
                    data['stock_theorique'] = produit.stock
                if 'quantite_physique' not in data:
                    data['quantite_physique'] = data.get('quantite_comptee', produit.stock)
            except Produit.DoesNotExist:
                return Response({'error': 'Produit non trouvé'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = LigneInventaireSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='lignes/bulk')
    @transaction.atomic
    def bulk_lignes(self, request, pk=None):
        """
        Import en masse de lignes d'inventaire optimisé (Réduction N+1).
        """
        inventaire = self.get_object()
        lignes_data = request.data.get('lignes', [])
        
        if not isinstance(lignes_data, list):
            return Response({'error': 'Format invalide'}, status=status.HTTP_400_BAD_REQUEST)

        # PRE-CHARGEMENT pour éviter le N+1
        produit_ids = {d.get('produit') for d in lignes_data if d.get('produit')}
        lot_ids = {d.get('stock_lot') for d in lignes_data if d.get('stock_lot')}
        
        produits_map = {p.id: p for p in Produit.objects.filter(id__in=produit_ids)}
        lots_map = {l.id: l for l in StockLot.objects.filter(id__in=lot_ids)}
        
        # Pour les recherches par numéro de lot
        lot_tuples = {(d.get('produit'), d.get('lot_numero')) for d in lignes_data if d.get('lot_numero') and d.get('produit')}
        existing_lots_by_num = {}
        if lot_tuples:
            for l in StockLot.objects.filter(produit_id__in=produit_ids):
                existing_lots_by_num[(l.produit_id, l.lot)] = l

        imported_count = 0
        errors = []
        lignes_a_creer = []

        for index, data in enumerate(lignes_data):
            try:
                p_id = data.get('produit')
                produit = produits_map.get(p_id)
                if not produit:
                    errors.append(f"Ligne {index}: Produit {p_id} inconnu")
                    continue

                target_lot = None
                
                # 1. Par ID de lot
                if data.get('stock_lot'):
                    target_lot = lots_map.get(data['stock_lot'])
                
                # 2. Par Numéro de lot
                elif data.get('lot_numero'):
                    key = (p_id, data['lot_numero'])
                    target_lot = existing_lots_by_num.get(key)
                    if not target_lot:
                        # Création à la volée du lot manquant
                        target_lot = StockLot.objects.create(
                            produit=produit,
                            lot=data['lot_numero'],
                            date_expiration=data.get('lot_expiration'),
                            quantity_remaining=0,
                            quantity_initial=0,
                            price_cost=produit.cost_price or 0,
                            selling_price=produit.selling_price or 0,
                            date_reception=timezone.now()
                        )
                        existing_lots_by_num[key] = target_lot

                # Déterminer le stock théorique
                stock_theorique = target_lot.quantity_remaining if target_lot else produit.stock
                quantite_physique = data.get('quantite_physique', data.get('quantite_comptee', stock_theorique))

                lignes_a_creer.append(LigneInventaire(
                    inventaire=inventaire,
                    produit=produit,
                    stock_lot=target_lot,
                    stock_theorique=stock_theorique,
                    quantite_physique=quantite_physique,
                    pmp_snapshot=produit.cost_price or 0
                ))
                imported_count += 1

            except Exception as e:
                errors.append(f"Ligne {index}: {str(e)}")

        if lignes_a_creer:
            LigneInventaire.objects.bulk_create(lignes_a_creer)
        
        return Response({
            'status': 'Import terminé',
            'imported': imported_count,
            'errors': errors
        }, status=status.HTTP_201_CREATED if imported_count > 0 else status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def merge(self, request, pk=None):
        """
        Fusionne un autre inventaire (source) dans l'inventaire actuel (cible).
        L'inventaire source est ensuite supprimé.
        """
        target_inventaire = self.get_object()
        source_id = request.data.get('source_inventaire_id')
        
        if not source_id:
             return Response({'error': 'source_inventaire_id requis'}, status=status.HTTP_400_BAD_REQUEST)
             
        if str(source_id) == str(target_inventaire.id):
             return Response({'error': 'Impossible de fusionner un inventaire avec lui-même'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            source_inventaire = Inventaire.objects.get(id=source_id)
        except Inventaire.DoesNotExist:
            return Response({'error': 'Inventaire source introuvable'}, status=status.HTTP_404_NOT_FOUND)

        if target_inventaire.status != Inventaire.Status.EN_COURS or source_inventaire.status != Inventaire.Status.EN_COURS:
             return Response({'error': 'Les deux inventaires doivent être EN_COURS'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Logique de fusion
        merged_count = 0
        moved_count = 0
        
        source_lignes = source_inventaire.lignes.all()
        
        for source_ligne in source_lignes:
            # Chercher une ligne compatible dans la cible (même produit ET même lot)
            compatible_line = LigneInventaire.objects.filter(
                inventaire=target_inventaire,
                produit=source_ligne.produit,
                stock_lot=source_ligne.stock_lot
            ).first()
            
            if compatible_line:
                # Fusionner : additionner la quantité saisie
                compatible_line.quantite_physique += source_ligne.quantite_physique
                compatible_line.save()
                source_ligne.delete()
                merged_count += 1
            else:
                # Déplacer : changer l'inventaire parent
                source_ligne.inventaire = target_inventaire
                source_ligne.save()
                moved_count += 1
                
        # Supprimer l'inventaire source vide
        source_inventaire.delete()
        
        # Mettre à jour les stats de l'inventaire cible (optionnel, calculé à la volée souvent)
        
        log_audit(
            user=request.user,
            action=AuditLog.Action.UPDATE, # Ou action spécifique MERGE
            model_name='Inventaire',
            object_id=target_inventaire.id,
            description=f"Fusion inventaire #{source_id} -> #{target_inventaire.id}",
            details={
                'source_id': source_id,
                'merged_lines': merged_count,
                'moved_lines': moved_count
            },
            request=request
        )

        return Response({
            'status': 'Fusion réussie',
            'merged_lines': merged_count,
            'moved_lines': moved_count,
            'source_deleted': True
        })

    @action(detail=True, methods=['post'], url_path='merge-duplicates')
    @transaction.atomic
    def merge_duplicates(self, request, pk=None):
        """
        Fusionne les lignes en doublon au sein du même inventaire.
        Doublon défini par : même produit et même lot (ou pas de lot).
        """
        inventaire = self.get_object()
        
        if inventaire.status != Inventaire.Status.EN_COURS:
             return Response({'error': 'L\'inventaire doit être EN_COURS'}, status=status.HTTP_400_BAD_REQUEST)

        # Identifier les groupes de doublons
        from django.db.models import Count
        
        # On groupe par produit et stock_lot
        duplicates = inventaire.lignes.values('produit', 'stock_lot').annotate(
            count=Count('id')
        ).filter(count__gt=1)
        
        total_merged = 0
        groups_processed = 0
        
        for group in duplicates:
            produit_id = group['produit']
            stock_lot_id = group['stock_lot']
            
            # Récupérer les lignes concernées
            lines = inventaire.lignes.filter(produit_id=produit_id, stock_lot_id=stock_lot_id).order_by('id')
            
            if lines.exists():
                primary_line = lines.first()
                other_lines = lines.exclude(id=primary_line.id)
                
                # Somme des quantités physiques
                total_qty = primary_line.quantite_physique + sum(l.quantite_physique for l in other_lines)
                
                # Mise à jour de la ligne principale
                primary_line.quantite_physique = total_qty
                primary_line.save()
                
                # Suppression des doublons
                deleted_count = other_lines.count()
                other_lines.delete()
                
                total_merged += deleted_count
                groups_processed += 1

        return Response({
            'status': 'Fusion des doublons terminée',
            'groups_processed': groups_processed,
            'lines_merged': total_merged
        })


    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """
        Retourne les statistiques de l'inventaire pour l'onglet Analyse.
        """
        inventaire = self.get_object()
        
        # 1. Top 10 Pertes (en valeur)
        # On calcule la valeur de l'écart pour chaque ligne
        # ecart * (pmp_snapshot OU produit.cost_price)
        # On veut les plus grandes PERTES (donc valeurs négatives les plus basses)
        
        lignes = inventaire.lignes.annotate(
            valeur_ecart=ExpressionWrapper(
                F('ecart') * Case(
                    When(pmp_snapshot__gt=0, then=F('pmp_snapshot')),
                    default=F('produit__cost_price'),
                    output_field=DecimalField()
                ),
                output_field=DecimalField()
            )
        ).filter(valeur_ecart__lt=0).select_related('produit').order_by('valeur_ecart')[:10]
        
        top_pertes = []
        for l in lignes:
            top_pertes.append({
                'produit_nom': l.produit.name if l.produit else l.produit_nom,
                'ecart': l.ecart,
                'valeur': l.valeur_ecart
            })
            
        # 2. Ecarts par Rayon
        # On groupe par rayon et on somme les écarts
        # Note: LigneInventaire -> Produit -> Rayon
        
        # Django Group By: values('produit__rayon__name').annotate(total=Sum('valeur_ecart'))
        # Il faut ré-annoter valeur_ecart car on ne l'a pas dans le queryset de base
        
        stats_rayon_qs = inventaire.lignes.annotate(
            valeur_ecart_line=ExpressionWrapper(
                F('ecart') * Case(
                    When(pmp_snapshot__gt=0, then=F('pmp_snapshot')),
                    default=F('produit__cost_price'),
                    output_field=DecimalField()
                ),
                output_field=DecimalField()
            )
        ).values('produit__rayon__name').annotate(
            total_ecart=Sum('valeur_ecart_line')
        ).order_by('total_ecart')
        
        stats_rayon = []
        for s in stats_rayon_qs:
            stats_rayon.append({
                'rayon': s['produit__rayon__name'] or 'Sans Rayon',
                'total': s['total_ecart'] or 0
            })
            
        return Response({
            'top_pertes': top_pertes,
            'par_rayon': stats_rayon
        })

    @action(detail=True, methods=['get'])
    def imprimer_ecarts(self, request, pk=None):
        """
        Génère un PDF listant uniquement les écarts.
        """
        inventaire = self.get_object()
        from django.http import HttpResponse
        response = HttpResponse(content_type='application/pdf')
        filename = f"ecarts_inventaire_{inventaire.id}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        buffer = io.BytesIO()
        # Marges réduites pour maximiser l'espace
        doc = BaseDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch, leftMargin=0.5*inch, rightMargin=0.5*inch)
        frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='normal')
        template = PageTemplate(id='main', frames=[frame])
        doc.addPageTemplates([template])
        
        story = []
        styles = getSampleStyleSheet()
        
        # Style économique
        from reportlab.lib.styles import ParagraphStyle
        styles.add(ParagraphStyle(name='Small', parent=styles['Normal'], fontSize=8, leading=10))
        
        story.append(Paragraph(f"RAPPORT DES ÉCARTS - #{inventaire.id}", styles['Title']))
        story.append(Paragraph(f"Date: {inventaire.date.strftime('%d/%m/%Y')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Filtre: Ecart != 0 (exclude 0)
        lignes = inventaire.lignes.exclude(ecart=0).select_related('produit', 'produit__rayon').order_by('produit__rayon__name', 'produit__name')
        
        if not lignes.exists():
            story.append(Paragraph("Aucun écart constaté.", styles['Normal']))
        else:
            grouped = {}
            for l in lignes:
                r = l.produit.rayon.name if l.produit and l.produit.rayon else "AUTRES"
                if r not in grouped: grouped[r] = []
                grouped[r].append(l)

            total_global_ecart = 0
            
            for rayon in sorted(grouped.keys()):
                story.append(Paragraph(f"<b>RAYON: {rayon}</b>", styles['Heading3']))
                
                # Colonnes ajoutées: ID, PMP
                data = [['ID', 'Produit', 'PMP', 'Theo.', 'Phys.', 'Ecart', 'Val.']]
                total_rayon = 0
                for l in grouped[rayon]:
                    price = l.pmp_snapshot if l.pmp_snapshot > 0 else (l.produit.cost_price if l.produit else 0)
                    val = l.ecart * price
                    total_rayon += val
                    
                    # Style pour ecart negatif (Rouge) / positif (Vert/Noir)
                    ecart_display = f"{l.ecart:+}" if l.ecart != 0 else "0"
                    val_display = f"{val:+.0f}" if val != 0 else "0"
                    price_display = f"{price:.0f}"
                    
                    data.append([
                        str(l.produit.id) if l.produit else "-",
                        Paragraph(l.produit.name[:50] if l.produit else "Inconnu", styles['Small']),
                        price_display,
                        str(l.stock_theorique),
                        str(l.quantite_physique),
                        ecart_display,
                        val_display
                    ])
                
                total_global_ecart += total_rayon
                data.append(['', '', '', '', '', 'TOTAL', f"{total_rayon:+.0f}"])
                
                # Largeur totale dispo ~ 7.5 inches
                t = Table(data, colWidths=[0.5*inch, 3.0*inch, 0.8*inch, 0.7*inch, 0.7*inch, 0.7*inch, 1.0*inch])
                t.setStyle(TableStyle([
                    ('GRID', (0,0), (-1,-2), 0.25, colors.black),
                    # ('BACKGROUND', (0,0), (-1,0), colors.lightgrey), # REMOVED FOR INK SAVING
                    ('ALIGN', (2,0), (-1,-1), 'RIGHT'),
                    ('LINEBELOW', (0,-2), (-1,-2), 0.25, colors.black),
                    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), # Header Bold
                    ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'), # Total Bold
                    ('FONTSIZE', (0,0), (-1,-1), 8), # Global Font Size
                    ('LEADING', (0,0), (-1,-1), 10), # Global Leading
                ]))
                story.append(t)
                story.append(Spacer(1, 15))
            
            # Grand Total
            story.append(Spacer(1, 15))
            story.append(Paragraph(f"TOTAL GLOBAL ÉCARTS (VALEUR): {total_global_ecart:+,.0f} F", styles['Heading2']))

        doc.build(story)
        pdf = buffer.getvalue()
        buffer.close()
        response.write(pdf)
        return response


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
                    f"{l.ecart:+}" if l.ecart != 0 else "0",
                    f"{val:+.0f}" if val != 0 else "0"
                ])
            data.append(['', '', '', 'TOTAL', f"{total_val:+.0f}"])
            
            t = Table(data, colWidths=[3*inch, 0.8*inch, 0.8*inch, 0.6*inch, 1*inch])
            t.setStyle(TableStyle([
                ('GRID', (0,0), (-1,-2), 1, colors.black),
                ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
                ('ALIGN', (1,0), (-1,-1), 'RIGHT'),
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
    queryset = LigneInventaire.objects.all().order_by('id')
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
            # Mode LOT EXISTANT: Utiliser l'ID du lot fourni
            try:
                lot = StockLot.objects.get(id=data['stock_lot'])
                data['stock_theorique'] = lot.quantity_remaining
                if 'quantite_physique' not in data:
                    data['quantite_physique'] = lot.quantity_remaining
            except StockLot.DoesNotExist:
                return Response({'error': 'Lot non trouvé'}, status=status.HTTP_400_BAD_REQUEST)
        
        elif 'lot_numero' in data and data['lot_numero']:
            # Mode NOUVEAU LOT ou LOT PAR NUMERO
            lot_num = data.get('lot_numero')
            lot_exp = data.get('lot_expiration') # Optional
            produit_id = data.get('produit')
            
            try:
                produit = Produit.objects.get(id=produit_id)
            except Produit.DoesNotExist:
                return Response({'error': 'Produit non trouvé'}, status=status.HTTP_400_BAD_REQUEST)
                
            # Chercher si le lot existe déjà pour ce produit
            existing_lot = StockLot.objects.filter(produit=produit, lot=lot_num).first()
            
            if existing_lot:
                # Utiliser le lot existant
                data['stock_lot'] = existing_lot.id
                data['stock_theorique'] = existing_lot.quantity_remaining
            else:
                # Créer un nouveau lot (vide par défaut)
                new_lot = StockLot.objects.create(
                    produit=produit,
                    lot=lot_num,
                    date_expiration=lot_exp if lot_exp else None,
                    quantity_remaining=0, # Stock théorique 0 car nouveau
                    quantity_initial=0,
                    price_cost=produit.cost_price,
                    date_reception=timezone.now()
                )
                data['stock_lot'] = new_lot.id
                data['stock_theorique'] = 0
            
            if 'quantite_physique' not in data:
                 data['quantite_physique'] = 0 # Default if not provided
                 
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

    @action(detail=False, methods=['get'])
    def export_excel(self, request):
        """
        Exporte le journal des ajustements filtré au format Excel.
        """
        queryset = self.filter_queryset(self.get_queryset())
        
        wb = Workbook()
        ws = wb.active
        ws.title = "Journal des Ajustements"
        
        # En-têtes
        headers = [
            "Date", "Heure", "Produit", "CIP", "Lot", 
            "Utilisateur", "Avant", "Après", "Diff", 
            "Motif", "Détails"
        ]
        
        for col_num, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num, value=header)
            cell.font = Font(bold=True)
            cell.alignment = Alignment(horizontal='center')
            # Ajuster largeur colonnes
            column_letter = cell.column_letter
            ws.column_dimensions[column_letter].width = 15
            
        ws.column_dimensions['C'].width = 30 # Produit
        ws.column_dimensions['K'].width = 40 # Détails
        
        # Données
        for row_num, adj in enumerate(queryset, 2):
            created_at = adj.created_at.astimezone(timezone.get_current_timezone())
            
            ws.cell(row=row_num, column=1, value=created_at.strftime('%d/%m/%Y'))
            ws.cell(row=row_num, column=2, value=created_at.strftime('%H:%M'))
            ws.cell(row=row_num, column=3, value=adj.produit.name if adj.produit else "N/A")
            ws.cell(row=row_num, column=4, value=adj.produit.cip1 if adj.produit else "")
            ws.cell(row=row_num, column=5, value=adj.stock_lot.lot if adj.stock_lot else "")
            ws.cell(row=row_num, column=6, value=adj.user.username if adj.user else "")
            ws.cell(row=row_num, column=7, value=adj.quantity_before)
            ws.cell(row=row_num, column=8, value=adj.quantity_after)
            ws.cell(row=row_num, column=9, value=adj.quantity_change)
            ws.cell(row=row_num, column=10, value=adj.get_reason_type_display())
            ws.cell(row=row_num, column=11, value=adj.reason_detail)
            
        # Préparer la réponse
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        
        filename = f"ajustements_stock_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response

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
    @action(detail=True, methods=['post'])
    def transformer(self, request, pk=None):
        relation = self.get_object()
        quantite = int(request.data.get('quantite', 1))
        
        if quantite <= 0:
            return Response({'error': 'La quantité doit être positive'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Verrouillage des produits pour éviter les conditions de course
            source = Produit.objects.select_for_update().get(pk=relation.produit_source.pk)
            destination = Produit.objects.select_for_update().get(pk=relation.produit_destination.pk)

            if source.stock < quantite:
                return Response({'error': f'Stock insuffisant pour {source.name}'}, status=status.HTTP_400_BAD_REQUEST)
            
            # --- 1. CONSOMMATION SOURCE (FIFO) ---
            consumed_lots_info = []
            
            if source.use_lot_management:
                # Vérification de cohérence
                total_lots = source.stock_lots.filter(quantity_remaining__gt=0).aggregate(total=Sum('quantity_remaining'))['total'] or 0
                
                # Si le stock global dit qu'on en a, mais les lots sont vides/insuffisants
                if total_lots < quantite:
                    # On pourrait bloquer, mais pour la résilience, on prévient juste ou on log
                    # Ici on va essayer de consommer ce qu'on peut et le reste sera "hors lot" (anomalie)
                    pass

                # FIFO Consumption : on prend les lots avec du stock du plus vieux au plus récent (date expiration)
                # Si date expiration identique, on prend le plus vieux par création
                lots = source.stock_lots.filter(quantity_remaining__gt=0).select_for_update().order_by('date_expiration', 'created_at')
                qty_remaining_to_consume = quantite
                
                for lot in lots:
                    if qty_remaining_to_consume <= 0:
                        break
                        
                    taken = min(lot.quantity_remaining, qty_remaining_to_consume)
                    
                    # Mise à jour du lot source
                    lot.quantity_remaining -= taken
                    lot.save()
                    
                    # Traceability (Utilisation de USAGE_INT comme motif générique)
                    StockAdjustment.objects.create(
                        produit=source,
                        stock_lot=lot,
                        user=request.user,
                        quantity_before=lot.quantity_remaining + taken,
                        quantity_after=lot.quantity_remaining,
                        quantity_change=-taken,
                        reason_type=StockAdjustment.ReasonType.USAGE_INTERNE, 
                        reason_detail=f"Transformation vers {destination.name}"
                    )
                    
                    consumed_lots_info.append({'lot': lot, 'qty': taken})
                    qty_remaining_to_consume -= taken
                
                # S'il reste de la quantité à consommer mais plus de lot (incohérence stock), 
                # cela sera déduit du stock global ci-dessous, mais sans traçabilité lot.
                
            # Décrémentation Stock Global
            source.stock -= quantite
            source.save()
                
            # --- 2. CRÉATION DESTINATION ---
            quantite_dest = int(quantite * relation.ratio)
            
            if destination.use_lot_management:
                # Déterminer date expiration : min(lots sources consommés)
                ref_expiry = None
                if consumed_lots_info:
                    valid_expiries = [l['lot'].date_expiration for l in consumed_lots_info if l['lot'].date_expiration]
                    if valid_expiries:
                        ref_expiry = min(valid_expiries)
                
                # Si pas d'expiration héritée (source sans date), on laisse NULL ou on pourrait appliquer une logique produit
                
                # Créer nouveau lot
                # Format numéro lot : TRANS-{ID_REL}-{TIMESTAMP}
                import time
                lot_number = f"TR{relation.id}-{int(time.time())}"
                
                new_lot_dest = StockLot.objects.create(
                    produit=destination,
                    lot=lot_number,
                    quantity_initial=quantite_dest,
                    quantity_remaining=quantite_dest,
                    quantity_paid=quantite_dest,     # Considéré comme "payé" car issu de stock payé
                    quantity_free=0,
                    price_cost=destination.cost_price or 0,
                    selling_price=destination.selling_price or 0,
                    date_expiration=ref_expiry,
                    date_reception=timezone.now(),
                    fournisseur=source.fournisseur # Héritage du fournisseur source
                )
                
                # Traceability Lot Dest
                StockAdjustment.objects.create(
                     produit=destination,
                     stock_lot=new_lot_dest,
                     user=request.user,
                     quantity_before=0,
                     quantity_after=quantite_dest,
                     quantity_change=quantite_dest,
                     reason_type=StockAdjustment.ReasonType.USAGE_INTERNE,
                     reason_detail=f"Transformation depuis {source.name}"
                )

            # Incrémentation Stock Global Destination
            destination.stock += quantite_dest
            destination.save()
            
            # --- 3. HISTORIQUE & MOUVEMENTS GLOBAUX ---
            
            # Mouvement Source
            MouvementStock.objects.create(
                produit=source,
                type_mouvement=MouvementStock.TypeMouvement.TRANSFORMATION_SORTIE,
                quantite=-quantite,
                stock_apres=source.stock,
                user=request.user,
                description=f"Transformation vers {destination.name}"
            )
            
            # Mouvement Destination
            MouvementStock.objects.create(
                produit=destination,
                type_mouvement=MouvementStock.TypeMouvement.TRANSFORMATION_ENTREE,
                quantite=quantite_dest,
                stock_apres=destination.stock,
                user=request.user,
                description=f"Transformation depuis {source.name}"
            )

            # Historique Transformation
            HistoriqueTransformation.objects.create(
                relation=relation,
                produit_source=source,
                produit_destination=destination,
                quantite_source=quantite,
                quantite_destination=quantite_dest,
                user=request.user,
                notes=request.data.get('notes', '')
            )

            # Log Audit transaction
            log_audit(
                user=request.user,
                action=AuditLog.Action.STOCK_ADJUST,
                model_name='Transformation',
                object_id=relation.id,
                description=f"Transformation: {quantite} {source.name} -> {quantite_dest} {destination.name}",
                details={
                    'source_id': source.id,
                    'destination_id': destination.id,
                    'qty_src': -quantite,
                    'qty_dest': quantite_dest,
                    'source_lots_used': [l['lot'].lot for l in consumed_lots_info]
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
        days_threshold = int(request.query_params.get('days', 90))  # Default: 90 days
        
        today = timezone.now()
        cutoff_date = (today - timedelta(days=days_threshold)).date()
        
        # Products with stock, where last sale is NULL or older than threshold
        produits = Produit.objects.filter(stock__gt=0).select_related('fournisseur')
        if fournisseur_id:
            produits = produits.filter(fournisseur_id=fournisseur_id)
        
        # Filter: last sale is NULL or older than threshold
        # AND product has been in stock long enough (dernier_achat or created_at before cutoff)
        produits = produits.filter(
            Q(dernier_vente__isnull=True) | Q(dernier_vente__lte=cutoff_date)
        ).filter(
            Q(dernier_achat__isnull=False, dernier_achat__lte=cutoff_date) |
            Q(dernier_achat__isnull=True, created_at__date__lte=cutoff_date)
        )
        
        results = []
        total_value = Decimal('0.00')
        
        for produit in produits:
            value = Decimal(str(produit.stock)) * Decimal(str(produit.cost_price))
            
            # Calculate days since last sale
            if produit.dernier_vente:
                days_since_sale = (today.date() - produit.dernier_vente).days
            elif produit.dernier_achat:
                days_since_sale = (today.date() - produit.dernier_achat).days
            else:
                days_since_sale = (today - produit.created_at).days
            
            results.append({
                'id': produit.id,
                'name': produit.name,
                'stock': produit.stock,
                'stock_maximum': produit.stock_maximum,
                'cost_price': float(produit.cost_price or 0),
                'selling_price': float(produit.selling_price or 0),
                'value': float(value),
                'days_since_sale': days_since_sale,
                'derniere_vente': produit.dernier_vente,
                'dernier_achat': produit.dernier_achat,
                'created_at': produit.created_at.date(),
                'fournisseur_name': produit.fournisseur.name if produit.fournisseur else 'N/A'
            })
            total_value += value
        
        # Sort by days since sale (most stagnant first)
        results.sort(key=lambda x: x['days_since_sale'], reverse=True)
        
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


class StockAnalysisShortageView(APIView):
    """
    Prévision intelligente des ruptures de stock.
    
    Améliorations par rapport à une moyenne simple :
    1. Moyenne pondérée : les 7 derniers jours pèsent 2x plus que les 23 précédents
       → détecte les hausses/baisses récentes de demande
    2. Commandes en cours : les commandes PREP/ATT sont prises en compte
       comme réapprovisionnement attendu
    3. Tendance : compare la semaine récente à la période précédente
       → identifie si la demande accélère ou ralentit
    4. Suggestion commande : quantité recommandée pour assurer 30j de couverture
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from ..models import Facture, FactureProduit

        fournisseur_id = request.query_params.get('fournisseur', None)
        horizon_jours = int(request.query_params.get('horizon', 30))
        today = timezone.now().date()
        date_30_days_ago = today - timedelta(days=30)
        date_7_days_ago = today - timedelta(days=7)

        # ── 1. Produits avec stock > 0 ──
        produits = Produit.objects.filter(stock__gt=0).select_related('fournisseur')
        if fournisseur_id:
            produits = produits.filter(fournisseur_id=fournisseur_id)

        # ── 2. Ventes des 30 derniers jours (séparées en 2 périodes) ──
        # Période récente : 7 derniers jours
        ventes_recentes = (
            FactureProduit.objects
            .filter(
                facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
                facture__date__date__gte=date_7_days_ago,
                produit__isnull=False
            )
            .values('produit_id')
            .annotate(total_vendu=Sum('quantity'))
        )
        map_recentes = {v['produit_id']: v['total_vendu'] for v in ventes_recentes}

        # Période ancienne : jours 8 à 30
        ventes_anciennes = (
            FactureProduit.objects
            .filter(
                facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
                facture__date__date__gte=date_30_days_ago,
                facture__date__date__lt=date_7_days_ago,
                produit__isnull=False
            )
            .values('produit_id')
            .annotate(total_vendu=Sum('quantity'))
        )
        map_anciennes = {v['produit_id']: v['total_vendu'] for v in ventes_anciennes}

        # ── 3. Commandes en cours (réapprovisionnement attendu) ──
        commandes_en_cours = (
            CommandeProduit.objects
            .filter(
                commande__status__in=[Commande.Status.EN_PREPARATION, Commande.Status.EN_ATTENTE],
                produit__isnull=False
            )
            .values('produit_id')
            .annotate(
                qte_commandee=Sum('quantity'),
                ug_commandees=Sum('unites_gratuites')
            )
        )
        map_commandes = {
            c['produit_id']: (c['qte_commandee'] or 0) + (c['ug_commandees'] or 0)
            for c in commandes_en_cours
        }

        # ── 4. Calcul prédictif pour chaque produit ──
        results = []
        total_value_at_risk = Decimal('0.00')

        for produit in produits:
            vendu_recent = map_recentes.get(produit.id, 0)    # 7 derniers jours
            vendu_ancien = map_anciennes.get(produit.id, 0)    # jours 8-30
            qte_en_commande = map_commandes.get(produit.id, 0)

            # Pas de ventes du tout → pas de prédiction possible
            if vendu_recent + vendu_ancien <= 0:
                continue

            # ── Moyenne pondérée ──
            # Poids 2x pour la période récente (7j) vs ancienne (23j)
            # Formule : (vendu_recent * 2 / 7 + vendu_ancien / 23) / 3
            # Le "3" normalise les poids (2 + 1)
            taux_journalier_recent = vendu_recent / 7.0
            taux_journalier_ancien = vendu_ancien / 23.0 if vendu_ancien > 0 else 0

            if taux_journalier_ancien > 0:
                # Moyenne pondérée : récent pèse 2x
                ventes_jour = (taux_journalier_recent * 2 + taux_journalier_ancien) / 3.0
            else:
                # Pas de données anciennes, utiliser uniquement le récent
                ventes_jour = taux_journalier_recent

            if ventes_jour <= 0:
                continue

            # ── Tendance (hausse/baisse de demande) ──
            # Compare le taux récent au taux ancien
            if taux_journalier_ancien > 0:
                tendance_pct = ((taux_journalier_recent - taux_journalier_ancien) / taux_journalier_ancien) * 100
            else:
                tendance_pct = 0

            # Déterminer direction de la tendance
            if tendance_pct > 15:
                tendance = 'hausse'
            elif tendance_pct < -15:
                tendance = 'baisse'
            else:
                tendance = 'stable'

            # ── Stock effectif (stock actuel + commandes en cours) ──
            stock_effectif = produit.stock + qte_en_commande

            # ── Jours avant rupture ──
            jours_avant_rupture = produit.stock / ventes_jour  # Sans les commandes
            jours_avec_commandes = stock_effectif / ventes_jour  # Avec les commandes

            # Filtrer : n'afficher que les produits à risque dans l'horizon
            if jours_avant_rupture > horizon_jours:
                continue

            # ── Niveau d'urgence ──
            if jours_avant_rupture < 7:
                urgence = 'critical'
            elif jours_avant_rupture < 14:
                urgence = 'warning'
            else:
                urgence = 'caution'

            # ── Quantité suggérée à commander ──
            # Objectif : assurer 30 jours de couverture totale
            couverture_cible = 30
            besoin_total = ventes_jour * couverture_cible
            qte_suggeree = max(0, int(besoin_total - stock_effectif + 0.5))

            # ── Valeur à risque ──
            value_at_risk = Decimal(str(produit.stock)) * Decimal(str(produit.cost_price or 0))
            total_value_at_risk += value_at_risk

            results.append({
                'id': produit.id,
                'name': produit.name,
                'stock': produit.stock,
                'avg_daily_sales': round(ventes_jour, 2),
                'days_until_stockout': round(jours_avant_rupture, 1),
                'days_with_pending_orders': round(jours_avec_commandes, 1),
                'cost_price': float(produit.cost_price or 0),
                'selling_price': float(produit.selling_price or 0),
                'value': float(value_at_risk),
                'urgency': urgence,
                'fournisseur_name': produit.fournisseur.name if produit.fournisseur else 'N/A',
                # Nouvelles données intelligentes
                'pending_orders': qte_en_commande,
                'suggested_order_qty': qte_suggeree,
                'trend': tendance,
                'trend_pct': round(tendance_pct, 1),
                'sold_last_7d': vendu_recent,
                'sold_prev_23d': vendu_ancien,
            })

        # Trier par urgence (jours restants croissants)
        results.sort(key=lambda x: x['days_until_stockout'])

        # Compteurs par urgence
        critical_count = sum(1 for r in results if r['urgency'] == 'critical')
        warning_count = sum(1 for r in results if r['urgency'] == 'warning')
        trending_up = sum(1 for r in results if r['trend'] == 'hausse')

        return Response({
            'type': 'shortage',
            'fournisseur': Fournisseur.objects.get(id=fournisseur_id).name if fournisseur_id and Fournisseur.objects.filter(id=fournisseur_id).exists() else 'Tous',
            'total_items': len(results),
            'total_value': float(total_value_at_risk),
            'critical_count': critical_count,
            'warning_count': warning_count,
            'trending_up_count': trending_up,
            'items': results
        })

