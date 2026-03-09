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

from django.db.models import F, Sum, DecimalField, Case, When, Value, ExpressionWrapper, Count
from django.db.models.functions import Coalesce, Cast, Abs

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
        if produit:
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
            stock_apres=produit.total_stock if produit else 0,
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
                'produit_id': produit.id if produit else None,
                'produit_nom': produit.name if produit else lot.produit_nom,
                'quantity': -quantity_to_remove,
                'reason': reason,
                'lot': lot.lot,
                'sudo_mode': validation_user != request.user
            },
            request=request
        )

        return Response({'status': f'Lot mis à jour. {quantity_to_remove} unités sorties.', 'validated_by': validation_user.username})

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def bulk_sortir_perimes(self, request):
        """
        Sortie groupée de plusieurs lots périmés.
        """
        lot_ids = request.data.get('lot_ids', [])
        reason = request.data.get('reason', 'Sortie groupée périmés')
        
        if not lot_ids:
            return Response({'detail': 'Aucun lot sélectionné.'}, status=status.HTTP_400_BAD_REQUEST)
            
        validation_user, error_res = validate_sudo_mode(request, permission_attr='can_manage_perimes')
        if error_res:
             return error_res
             
        lots = StockLot.objects.filter(id__in=lot_ids, quantity_remaining__gt=0).select_related('produit')
        count = 0
        
        for lot in lots:
            quantity_to_remove = lot.quantity_remaining
            quantity_before = lot.quantity_remaining
            
            # Update lot
            lot.quantity_remaining = 0
            lot.save()
            
            # Update product stock
            produit = lot.produit
            if produit:
                if produit.use_lot_management:
                    produit.calculate_stock_from_lots()
                else:
                    produit.stock = F('stock') - quantity_to_remove
                    produit.save(update_fields=['stock'])
                
                produit.refresh_from_db()
            
            # Traceability
            StockAdjustment.objects.create(
                produit=produit, stock_lot=lot, user=validation_user,
                quantity_before=quantity_before, quantity_after=0,
                quantity_change=-quantity_to_remove,
                reason_type=StockAdjustment.ReasonType.PERIME,
                reason_detail=f"Sortie groupée: {reason}"
            )
            
            MouvementStock.objects.create(
                produit=produit,
                type_mouvement=MouvementStock.TypeMouvement.AVOIR,
                quantite=-quantity_to_remove,
                stock_apres=produit.total_stock if produit else 0,
                user=validation_user,
                description=f"Sortie groupée périmés - Lot {lot.lot}"
            )
            
            count += 1
            
        # Global Audit
        log_audit(
            user=validation_user,
            action=AuditLog.Action.STOCK_ADJUST,
            model_name='StockLot',
            object_id=0,
            description=f"Sortie groupée de {count} lots périmés par {validation_user.username}",
            details={'lot_ids': lot_ids, 'reason': reason, 'count': count},
            request=request
        )
        
        return Response({'status': f'{count} lots sortis du stock.', 'validated_by': validation_user.username})

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

    @action(detail=False, methods=['get'])
    def rapport_ug(self, request):
        """
        Rapport des Unités Gratuites (UG) groupées par fournisseur, avec détails par lot.
        """
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')

        qs = StockLot.objects.filter(quantity_free__gt=0).select_related('fournisseur', 'produit', 'commande_produit__commande')

        if date_debut:
            qs = qs.filter(date_reception__gte=date_debut)
        if date_fin:
            try:
                date_fin_obj = datetime.strptime(date_fin, '%Y-%m-%d')
                date_fin_inclusive = date_fin_obj + timedelta(days=1) - timedelta(seconds=1)
                qs = qs.filter(date_reception__lte=date_fin_inclusive)
            except ValueError:
                 pass

        # Since we want details, pulling all matching lots into memory is fine if the volume of UG is reasonable.
        # Alternatively, we can group in Python.
        lots = list(qs)
        
        fournisseurs_map = {}
        global_total_ug = 0
        global_total_ug_restantes = 0
        global_total_valeur = Decimal('0')
        global_total_valeur_restante = Decimal('0')

        for lot in lots:
            # Prioritize the wholesaler from the Command over the manufacturer from the Lot
            f_id = lot.fournisseur_id or 0
            f_name = lot.fournisseur.name if lot.fournisseur else "Fournisseur Inconnu"
            
            if lot.commande_produit and lot.commande_produit.commande and lot.commande_produit.commande.fournisseur:
                f_id = lot.commande_produit.commande.fournisseur.id
                f_name = lot.commande_produit.commande.fournisseur.name
                
            if f_id not in fournisseurs_map:
                fournisseurs_map[f_id] = {
                    'fournisseur_id': f_id,
                    'fournisseur_nom': f_name,
                    'total_ug': 0,
                    'total_ug_restantes': 0,
                    'total_valeur': Decimal('0'),
                    'total_valeur_restante': Decimal('0'),
                    'lots_count': 0,
                    'details': []
                }
            
            valeur_estimee = Decimal(lot.quantity_free) * lot.selling_price
            valeur_restante = Decimal(lot.quantity_free_remaining) * lot.selling_price
            
            fournisseurs_map[f_id]['total_ug'] += lot.quantity_free
            fournisseurs_map[f_id]['total_ug_restantes'] += lot.quantity_free_remaining
            fournisseurs_map[f_id]['total_valeur'] += valeur_estimee
            fournisseurs_map[f_id]['total_valeur_restante'] += valeur_restante
            fournisseurs_map[f_id]['lots_count'] += 1
            
            global_total_ug += lot.quantity_free
            global_total_ug_restantes += lot.quantity_free_remaining
            global_total_valeur += valeur_estimee
            global_total_valeur_restante += valeur_restante

            # Build detailed info
            cmd_numero = "N/A"
            facture_numero = "N/A"
            if lot.commande_produit and lot.commande_produit.commande:
                cmd_numero = f"CMD-{lot.commande_produit.commande.id}"
                if lot.commande_produit.commande.numero_facture:
                    facture_numero = lot.commande_produit.commande.numero_facture

            fournisseurs_map[f_id]['details'].append({
                'lot_id': lot.id,
                'lot_numero': lot.lot,
                'produit_nom': lot.produit.name if lot.produit else (lot.produit_nom or 'Inconnu'),
                'date_reception': lot.date_reception.isoformat() if lot.date_reception else None,
                'commande_numero': cmd_numero,
                'facture_numero': facture_numero,
                'quantity_free': lot.quantity_free,
                'quantity_free_remaining': lot.quantity_free_remaining,
                'valeur_estimee': float(valeur_estimee),
                'valeur_restante': float(valeur_restante),
                'prix_vente': float(lot.selling_price)
            })

        # Convert back to list and sort by total_valeur desc
        result = list(fournisseurs_map.values())
        result.sort(key=lambda x: x['total_valeur'], reverse=True)
        
        # Convert Decimal to float for JSON serialization
        for r in result:
            r['total_valeur'] = float(r['total_valeur'])
            r['total_valeur_restante'] = float(r['total_valeur_restante'])

        return Response({
            'global_total_ug': global_total_ug,
            'global_total_ug_restantes': global_total_ug_restantes,
            'global_total_valeur': float(global_total_valeur),
            'global_total_valeur_restante': float(global_total_valeur_restante),
            'fournisseurs': result
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

    filterset_fields = {
        'status': ['exact', 'in'],
        'created_by': ['exact'],
        'date': ['exact', 'gte', 'lte'],
    }
    search_fields = ['description', 'status']
    ordering_fields = ['date', 'status']

    def get_serializer_class(self):
        if self.action == 'list':
            return InventaireListSerializer
        return InventaireSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        if self.action == 'list':
            from django.db.models import Subquery, OuterRef
            
            # Price expression: if pmp_snapshot > 0 use it, else use product cost_price
            line_price_expr = Case(
                When(pmp_snapshot__gt=0, then=F('pmp_snapshot')),
                default=F('produit__cost_price'),
                output_field=DecimalField()
            )
            
            # Sous-requête pour les totaux par inventaire (évite les JOINs multiplicatifs)
            base_subquery = LigneInventaire.objects.filter(
                inventaire=OuterRef('pk')
            )
            
            queryset = queryset.annotate(
                total_valeur_theorique=Coalesce(
                    Subquery(
                        base_subquery.annotate(
                            val=F('stock_theorique') * line_price_expr
                        ).values('inventaire').annotate(
                            total=Sum('val')
                        ).values('total')[:1],
                        output_field=DecimalField()
                    ),
                    Value(0, output_field=DecimalField())
                ),
                total_valeur_physique=Coalesce(
                    Subquery(
                        base_subquery.annotate(
                            val=F('quantite_physique') * line_price_expr
                        ).values('inventaire').annotate(
                            total=Sum('val')
                        ).values('total')[:1],
                        output_field=DecimalField()
                    ),
                    Value(0, output_field=DecimalField())
                ),
                total_ecart_valeur=Coalesce(
                    Subquery(
                        base_subquery.annotate(
                            val=F('ecart') * line_price_expr
                        ).values('inventaire').annotate(
                            total=Sum('val')
                        ).values('total')[:1],
                        output_field=DecimalField()
                    ),
                    Value(0, output_field=DecimalField())
                ),
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
    def pre_populate(self, request, pk=None):
        """
        Pré-remplit l'inventaire avec les produits d'une catégorie (rayon, groupe, forme).
        """
        inventaire = self.get_object()
        if inventaire.status == Inventaire.Status.VALIDEE:
             return Response({'detail': 'Cet inventaire est déjà validé.'}, status=status.HTTP_400_BAD_REQUEST)
        
        rayon_id = request.data.get('rayon_id')
        groupe_id = request.data.get('groupe_id')
        forme_id = request.data.get('forme_id')
        
        # Filtrer les produits
        filters = Q(is_active=True)
        if rayon_id:
            filters &= Q(rayon_id=rayon_id)
        if groupe_id:
            filters &= Q(groupe_id=groupe_id)
        if forme_id:
            filters &= Q(forme_id=forme_id)
            
        products = Produit.objects.filter(filters).prefetch_related('stock_lots')
        
        lignes_a_creer = []
        for produit in products:
            if produit.use_lot_management:
                lots = produit.stock_lots.filter(
                    Q(quantity_remaining__gt=0) | Q(quantity_reserved__gt=0)
                )
                for lot in lots:
                    # Déterminer le stock théorique selon le type d'inventaire
                    stock_th = lot.quantity_remaining
                    if inventaire.inventory_type == Inventaire.TypeStock.RESERVE:
                        stock_th = lot.quantity_reserved
                    elif inventaire.inventory_type == Inventaire.TypeStock.GLOBAL:
                        stock_th = lot.quantity_remaining + lot.quantity_reserved
                        
                    lignes_a_creer.append(LigneInventaire(
                        inventaire=inventaire,
                        produit=produit,
                        stock_lot=lot,
                        stock_theorique=stock_th,
                        quantite_physique=stock_th, # Par défaut, on suppose que le stock est correct
                        ecart=0,
                        pmp_snapshot=produit.pmp or produit.cost_price or 0
                    ))
            else:
                stock_th = produit.stock
                if inventaire.inventory_type == Inventaire.TypeStock.RESERVE:
                    stock_th = produit.stock_reserve
                elif inventaire.inventory_type == Inventaire.TypeStock.GLOBAL:
                    stock_th = produit.total_stock
                    
                lignes_a_creer.append(LigneInventaire(
                    inventaire=inventaire,
                    produit=produit,
                    stock_theorique=stock_th,
                    quantite_physique=stock_th,
                    ecart=0,
                    pmp_snapshot=produit.pmp or produit.cost_price or 0
                ))
        
        if lignes_a_creer:
            # On évite les doublons si déjà cliqué
            existing_prod_ids = set(inventaire.lignes.values_list('produit_id', flat=True))
            lignes_filtered = [l for l in lignes_a_creer if l.produit_id not in existing_prod_ids]
            LigneInventaire.objects.bulk_create(lignes_filtered)
            
        return Response({'status': 'Pre-population terminee', 'count': len(lignes_a_creer)})

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def validate(self, request, pk=None):
        """
        Validation de l'inventaire avec support des lots.
        Support du mode SUDO (validated_by_id).
        Optimisé: utilise bulk_update/bulk_create pour minimiser les requêtes SQL.
        """
        inventaire = self.get_object()
        if inventaire.status == Inventaire.Status.VALIDEE:
             return Response({'detail': 'Cet inventaire est déjà validé.'}, status=status.HTTP_400_BAD_REQUEST)
        
        validator, error_res = validate_sudo_mode(request, permission_attr='can_adjust_stock')
        if error_res:
             return error_res

        inventaire.validated_by = validator

        # Préparation du traitement groupé et recalcul
        lignes = list(inventaire.lignes.select_related('produit', 'produit__fournisseur', 'stock_lot').all())
        products_to_recalculate = set()
        
        # Collections pour les opérations batch
        lots_to_update = {}            # {lot_id: lot_object}
        remaining_capacities = {}      # {product_id: current_remaining_capacity}
        adjustments_to_create = []     # StockAdjustment objects
        mouvements_to_create = []      # MouvementStock objects
        now = timezone.now()
        
        # Phase 1 : Préparer les données en mémoire (modifications minimales en DB)
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
                ligne.stock_lot = target_lot

            # Calculer l'écart et le PMP en mémoire
            ligne.ecart = ligne.quantite_physique - ligne.stock_theorique
            if (not ligne.pmp_snapshot or ligne.pmp_snapshot == 0) and ligne.produit:
                ligne.pmp_snapshot = ligne.produit.pmp or ligne.produit.cost_price or 0

            # Déterminer la répartition du stock sur le lot
            if inventaire.inventory_type == Inventaire.TypeStock.GLOBAL:
                # Logique d'overflow : on remplit le rayon jusqu'à capacité, le reste en réserve
                if produit.id not in remaining_capacities:
                    # On initialise la capacité restante basée sur les paramètres du produit
                    remaining_capacities[produit.id] = produit.capacite_rayon if produit.has_reserve_storage else 999999999
                
                qty_rayon = min(ligne.quantite_physique, remaining_capacities[produit.id])
                qty_reserve = ligne.quantite_physique - qty_rayon
                remaining_capacities[produit.id] -= qty_rayon
                
                target_lot.quantity_remaining = qty_rayon
                target_lot.quantity_reserved = qty_reserve
            elif inventaire.inventory_type == Inventaire.TypeStock.RESERVE:
                target_lot.quantity_reserved = ligne.quantite_physique
            else:
                # RAYON
                target_lot.quantity_remaining = ligne.quantite_physique

            lots_to_update[target_lot.id] = target_lot

            # Préparer la traçabilité (sans écrire en DB)
            ecart = ligne.ecart
            if ecart != 0:
                adjustments_to_create.append(StockAdjustment(
                    produit=produit, stock_lot=target_lot, user=validator,
                    quantity_before=ligne.stock_theorique,
                    quantity_after=ligne.quantite_physique,
                    quantity_change=ecart,
                    reason_type='INVENTAIRE',
                    reason_detail=f"Inventaire #{inventaire.id}"
                ))
                mouvements_to_create.append(MouvementStock(
                    produit=produit,
                    inventaire=inventaire,
                    type_mouvement=MouvementStock.TypeMouvement.AJUSTEMENT,
                    quantite=ecart,
                    user=validator,
                    description=f"Inventaire #{inventaire.id} (Lot {target_lot.lot})",
                    date=now
                ))
        
        # Phase 2 : Écrire en DB avec des opérations groupées
        
        # 2a. Mise à jour groupée des lignes (écart, pmp_snapshot, stock_lot)
        if lignes:
            LigneInventaire.objects.bulk_update(lignes, ['ecart', 'pmp_snapshot', 'stock_lot'])
        
        # 2b. Mise à jour groupée des lots (quantity_remaining et quantity_reserved)
        if lots_to_update:
            StockLot.objects.bulk_update(lots_to_update.values(), ['quantity_remaining', 'quantity_reserved'])

        # 2c. Création groupée des ajustements et mouvements
        if adjustments_to_create:
            StockAdjustment.objects.bulk_create(adjustments_to_create)
        if mouvements_to_create:
            MouvementStock.objects.bulk_create(mouvements_to_create)

        # Phase 3 : Recalcul groupé des produits (hors boucle principale)
        prods_needing_lot_flag = [p for p in products_to_recalculate if not p.use_lot_management]
        if prods_needing_lot_flag:
            for p in prods_needing_lot_flag:
                p.use_lot_management = True
            Produit.objects.bulk_update(prods_needing_lot_flag, ['use_lot_management'])
        
        for prod in products_to_recalculate:
            prod.calculate_stock_from_lots()
            MouvementStock.objects.filter(produit=prod, inventaire=inventaire).update(stock_apres=prod.total_stock)

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
    @transaction.atomic
    def lignes(self, request, pk=None):
        """
        GET: Liste les lignes d'un inventaire.
        POST: Ajoute une nouvelle ligne à l'inventaire.
        URL: /api/inventaires/{id}/lignes/
        """
        inventaire = self.get_object()
        
        if request.method == 'GET':
            lignes_objs = inventaire.lignes.select_related('produit', 'stock_lot').all()
            # AUTO-REPAIR: Fix potentially missing ecarts or pmp_snapshots (refactoring casualty)
            for l in lignes_objs:
                needs_save = False
                expected_ecart = l.quantite_physique - l.stock_theorique
                if l.ecart != expected_ecart:
                    l.ecart = expected_ecart
                    needs_save = True
                if (not l.pmp_snapshot or l.pmp_snapshot == 0) and l.produit:
                    l.pmp_snapshot = l.produit.pmp or l.produit.cost_price or 0
                    needs_save = True
                if needs_save:
                    l.save(update_fields=['ecart', 'pmp_snapshot'])
            
            serializer = LigneInventaireSerializer(lignes_objs, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            try:
                data = request.data.copy()
                data['inventaire'] = inventaire.id
                
                if 'stock_lot' in data and data['stock_lot']:
                    lot = StockLot.objects.get(id=data['stock_lot'])
                    data['stock_theorique'] = lot.quantity_remaining
                    if 'quantite_physique' not in data:
                        data['quantite_physique'] = lot.quantity_remaining
                
                elif 'lot_numero' in data and data['lot_numero']:
                    # Mode NOUVEAU LOT ou LOT PAR NUMERO
                    lot_num = data.get('lot_numero')
                    lot_exp = data.get('lot_expiration') # Optional
                    produit_id = data.get('produit')
                    
                    produit = Produit.objects.get(id=produit_id)
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
                    produit = Produit.objects.get(id=data['produit'])
                    if 'stock_theorique' not in data:
                        data['stock_theorique'] = produit.stock
                    if 'quantite_physique' not in data:
                        data['quantite_physique'] = data.get('quantite_comptee', produit.stock)
                
                serializer = LigneInventaireSerializer(data=data)
                if serializer.is_valid():
                    serializer.save()
                    return Response(serializer.data, status=status.HTTP_201_CREATED)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
            except (StockLot.DoesNotExist, Produit.DoesNotExist) as e:
                transaction.set_rollback(True)
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                transaction.set_rollback(True)
                return Response({'error': f'Erreur interne: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='lignes/bulk-delete')
    @transaction.atomic
    def bulk_delete_lignes(self, request, pk=None):
        """
        Suppression groupée de lignes d'inventaire.
        """
        inventaire = self.get_object()
        ids = request.data.get('ids', [])
        
        if not ids:
            return Response({'error': 'Aucun ID fourni'}, status=status.HTTP_400_BAD_REQUEST)

        # On s'assure que les lignes appartiennent bien à cet inventaire
        lignes = LigneInventaire.objects.filter(id__in=ids, inventaire=inventaire)
        count = lignes.count()
        
        if count == 0:
            return Response({'error': 'Aucune ligne correspondante trouvée'}, status=status.HTTP_404_NOT_FOUND)

        lignes.delete()

        return Response({
            'status': 'success',
            'message': f'{count} lignes supprimées avec succès.',
            'count': count
        })

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
                    ecart=quantite_physique - stock_theorique,
                    pmp_snapshot=produit.pmp or produit.cost_price or 0
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

    @action(detail=True, methods=['post'], url_path='import-csv')
    @transaction.atomic
    def import_csv(self, request, pk=None):
        """
        Importe des lignes d'inventaire depuis un fichier CSV.
        Format attendu: cip;quantite (cip obligatoire, quantite obligatoire)
        """
        inventaire = self.get_object()
        
        if inventaire.status != Inventaire.Status.EN_COURS:
            return Response({'error': 'L\'inventaire doit être EN_COURS pour importer des lignes.'}, status=status.HTTP_400_BAD_REQUEST)

        if 'file' not in request.FILES:
            return Response({'error': 'Aucun fichier fourni.'}, status=status.HTTP_400_BAD_REQUEST)
        
        uploaded_file = request.FILES['file']
        
        try:
            try:
                decoded_file = uploaded_file.read().decode('utf-8')
            except UnicodeDecodeError:
                uploaded_file.seek(0)
                decoded_file = uploaded_file.read().decode('latin-1')
            
            import csv, io
            
            # Plus de robustesse pour la détection du dialecte
            content_sample = decoded_file[:1024]
            try:
                if not content_sample.strip():
                     return Response({'error': 'Le fichier est vide.'}, status=status.HTTP_400_BAD_REQUEST)
                dialect = csv.Sniffer().sniff(content_sample, delimiters=";,")
            except Exception:
                # Fallback si le sniffer échoue (souvent le cas avec très peu de lignes)
                if ';' in content_sample:
                    dialect = 'excel' # delimiter=';' par défaut dans certains contextes, mais on va forcer
                else:
                    dialect = 'excel-tab' if '\t' in content_sample else 'excel'

            # On utilise DictReader avec un séparateur explicite si on a une idée, sinon le dialecte détecté
            delimiter = ';' if ';' in content_sample else ','
            csv_reader = csv.DictReader(io.StringIO(decoded_file), delimiter=delimiter)
            
            # Nettoyage des en-têtes (strip, minuscule, suppression BOM)
            if csv_reader.fieldnames:
                csv_reader.fieldnames = [field.strip().lower().replace('\ufeff', '') for field in csv_reader.fieldnames]
            else:
                return Response({'error': 'En-têtes CSV manquants.'}, status=status.HTTP_400_BAD_REQUEST)

            imported_count = 0
            errors = []
            lignes_a_creer = []

            for row_num, row in enumerate(csv_reader, start=2):
                try:
                    # Recherche des colonnes flexibles
                    cip = row.get('cip') or row.get('code') or row.get('barcode') or ''
                    quantite_str = row.get('quantite') or row.get('qte') or row.get('qty') or ''
                    
                    cip = str(cip).strip()
                    quantite_str = str(quantite_str).strip()

                    if not cip:
                        # On saute les lignes vides sans erreur bloquante
                        if not any(row.values()): continue
                        errors.append(f"Ligne {row_num}: Colonne 'cip' ou 'code' manquante.")
                        continue
                        
                    if not quantite_str:
                        errors.append(f"Ligne {row_num}: Quantité manquante.")
                        continue

                    try:
                        quantite = float(quantite_str.replace(',', '.'))
                        if quantite.is_integer():
                            quantite = int(quantite)
                    except ValueError:
                        errors.append(f"Ligne {row_num}: Quantité invalide '{quantite_str}'.")
                        continue

                    produit = Produit.objects.filter(cip1=cip).first() or \
                              Produit.objects.filter(cip2=cip).first() or \
                              Produit.objects.filter(cip3=cip).first()

                    if not produit:
                        errors.append(f"Ligne {row_num}: Produit '{cip}' introuvable.")
                        continue

                    stock_theorique = produit.stock
                    lignes_a_creer.append(LigneInventaire(
                        inventaire=inventaire,
                        produit=produit,
                        stock_lot=None,
                        stock_theorique=stock_theorique,
                        quantite_physique=quantite,
                        ecart=quantite - stock_theorique,
                        pmp_snapshot=produit.pmp or produit.cost_price or 0
                    ))
                    imported_count += 1

                except Exception as e:
                    errors.append(f"Ligne {row_num}: Erreur inattendue: {str(e)}")

            if lignes_a_creer:
                LigneInventaire.objects.bulk_create(lignes_a_creer)

            return Response({
                'status': 'Import CSV terminé',
                'imported': imported_count,
                'errors': errors,
                'total_rows_processed': row_num - 1 if 'row_num' in locals() else 0
            }, status=status.HTTP_201_CREATED if imported_count > 0 else status.HTTP_400_BAD_REQUEST)

        except csv.Error as e:
             return Response({'error': f'Erreur de format CSV: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Erreur lors du traitement: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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

        if target_inventaire.status != source_inventaire.status:
             return Response({'error': 'Les deux inventaires doivent avoir le même état (Clôturé ou En préparation)'}, status=status.HTTP_400_BAD_REQUEST)
        
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
                # Fusionner : additionner la quantité saisie ET le théorique pour garder l'écart juste
                compatible_line.quantite_physique += source_ligne.quantite_physique
                compatible_line.stock_theorique += source_ligne.stock_theorique
                compatible_line.save()
                source_ligne.delete()
                merged_count += 1
            else:
                # Déplacer : changer l'inventaire parent
                source_ligne.inventaire = target_inventaire
                source_ligne.save()
                moved_count += 1
                
        # Rattacher les mouvements de stock de la source vers la cible avant suppression
        source_inventaire.mouvements_stock.update(inventaire=target_inventaire)
                
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
                'ecart': float(l.ecart),
                'valeur': float(l.valeur_ecart)
            })

        # 1.5. Top 10 Surplus (en valeur)
        lignes_surplus = inventaire.lignes.annotate(
            valeur_ecart=ExpressionWrapper(
                F('ecart') * Case(
                    When(pmp_snapshot__gt=0, then=F('pmp_snapshot')),
                    default=F('produit__cost_price'),
                    output_field=DecimalField()
                ),
                output_field=DecimalField()
            )
        ).filter(valeur_ecart__gt=0).select_related('produit').order_by('-valeur_ecart')[:10]

        top_surplus = []
        for l in lignes_surplus:
            top_surplus.append({
                'produit_nom': l.produit.name if l.produit else l.produit_nom,
                'ecart': float(l.ecart),
                'valeur': float(l.valeur_ecart)
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
            'top_surplus': top_surplus,
            'par_rayon': stats_rayon
        })

    @action(detail=False, methods=['get'])
    def audit_discrepancies(self, request):
        """
        Audit global des écarts sur tous les inventaires validés.
        """
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        queryset = LigneInventaire.objects.filter(inventaire__status=Inventaire.Status.VALIDEE)
        
        if start_date:
            queryset = queryset.filter(inventaire__date__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(inventaire__date__date__lte=end_date)

        # Annotation de la valeur de l'écart (ecart * pmp)
        queryset = queryset.annotate(
            valeur_ecart=ExpressionWrapper(
                Cast(F('ecart'), output_field=DecimalField(max_digits=12, decimal_places=2)) * Case(
                    When(pmp_snapshot__gt=Decimal('0'), then=F('pmp_snapshot')),
                    default=Coalesce(F('produit__cost_price'), Value(Decimal('0'), output_field=DecimalField(max_digits=12, decimal_places=2))),
                    output_field=DecimalField(max_digits=12, decimal_places=2)
                ),
                output_field=DecimalField(max_digits=12, decimal_places=2)
            )
        )

        # 1. Top Produits par Pertes (somme des écarts négatifs)
        top_pertes = queryset.filter(valeur_ecart__lt=Decimal('0')).values(
            'produit__id', 'produit__name', 'produit__cip1'
        ).annotate(
            total_valeur=Sum('valeur_ecart'),
            total_quantite=Sum('ecart'),
            occurrence=Count('id')
        ).order_by('total_valeur')[:20]

        # 2. Top Produits par Surplus
        top_surplus = queryset.filter(valeur_ecart__gt=Decimal('0')).values(
            'produit__id', 'produit__name'
        ).annotate(
            total_valeur=Sum('valeur_ecart'),
            total_quantite=Sum('ecart'),
            occurrence=Count('id')
        ).order_by('-total_valeur')[:20]

        # 3. Répartition par Rayon
        par_rayon = queryset.values('produit__rayon__name').annotate(
            total_valeur=Coalesce(Sum('valeur_ecart'), Value(Decimal('0'), output_field=DecimalField())),
            perte_valeur=Coalesce(Sum(Case(When(valeur_ecart__lt=Decimal('0'), then=F('valeur_ecart')), default=Value(Decimal('0'), output_field=DecimalField()))), Value(Decimal('0'), output_field=DecimalField())),
            gain_valeur=Coalesce(Sum(Case(When(valeur_ecart__gt=Decimal('0'), then=F('valeur_ecart')), default=Value(Decimal('0'), output_field=DecimalField()))), Value(Decimal('0'), output_field=DecimalField())),
            nombre_lignes=Count('id')
        ).order_by('total_valeur')

        # 4. Répartition par Groupe
        par_groupe = queryset.values(produit__groupe__name=F('produit__groupe__nom')).annotate(
            total_valeur=Coalesce(Sum('valeur_ecart'), Value(Decimal('0'), output_field=DecimalField())),
            perte_valeur=Coalesce(Sum(Case(When(valeur_ecart__lt=Decimal('0'), then=F('valeur_ecart')), default=Value(Decimal('0'), output_field=DecimalField()))), Value(Decimal('0'), output_field=DecimalField())),
            gain_valeur=Coalesce(Sum(Case(When(valeur_ecart__gt=Decimal('0'), then=F('valeur_ecart')), default=Value(Decimal('0'), output_field=DecimalField()))), Value(Decimal('0'), output_field=DecimalField())),
        ).order_by('total_valeur')

        return Response({
            'top_pertes': top_pertes,
            'top_surplus': top_surplus,
            'par_rayon': par_rayon,
            'par_groupe': par_groupe,
            'stats_globales': queryset.aggregate(
                total_perte=Coalesce(Sum(Case(When(valeur_ecart__lt=Decimal('0'), then=F('valeur_ecart')), default=Value(Decimal('0'), output_field=DecimalField()))), Value(Decimal('0'), output_field=DecimalField())),
                total_gain=Coalesce(Sum(Case(When(valeur_ecart__gt=Decimal('0'), then=F('valeur_ecart')), default=Value(Decimal('0'), output_field=DecimalField()))), Value(Decimal('0'), output_field=DecimalField())),
                net=Coalesce(Sum('valeur_ecart'), Value(Decimal('0'), output_field=DecimalField())),
                nombre_inventaires=Count('inventaire', distinct=True),
                nombre_lignes=Count('id')
            )
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
        
        # On calcule la valorisation via annotation pour pouvoir faire un Sum
        queryset = queryset.annotate(
            valorisation_calcul=ExpressionWrapper(
                Abs(F('quantity_change')) * Coalesce(F('stock_lot__price_cost'), Value(0, output_field=DecimalField())),
                output_field=DecimalField()
            )
        )

        stats = queryset.aggregate(
            total_count=Count('id'),
            total_valorisation=Sum('valorisation_calcul')
        )
        
        return Response({
            'count': stats['total_count'] or 0,
            'total_valorisation': stats['total_valorisation'] or 0
        })

    @action(detail=False, methods=['get'])
    def export_excel(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        
        # Même annotation pour l'export
        queryset = queryset.annotate(
            valorisation_calcul=ExpressionWrapper(
                Abs(F('quantity_change')) * Coalesce(F('stock_lot__price_cost'), Value(0, output_field=DecimalField())),
                output_field=DecimalField()
            )
        )

        wb = Workbook()
        sheet = wb.active
        sheet.title = "Ajustements Stock"

        # En-tête
        columns = [
            "Date", "Produit", "CIP", "Type", "Lot", "Qté Change", "Valorisation", "Utilisateur"
        ]
        sheet.append(columns)
        
        # Style en-tête
        for cell in sheet[1]:
            cell.font = Font(bold=True)
            cell.alignment = Alignment(horizontal='center')

        # Données
        for adj in queryset:
            row = [
                adj.created_at.strftime("%d/%m/%Y %H:%M") if adj.created_at else "",
                adj.produit_name if hasattr(adj, 'produit_name') else (adj.produit.name if adj.produit else "-"),
                adj.produit_cip if hasattr(adj, 'produit_cip') else (adj.produit.cip1 if adj.produit else "-"),
                adj.get_reason_type_display(),
                adj.lot_number if hasattr(adj, 'lot_number') else (adj.stock_lot.lot if adj.stock_lot else "-"),
                adj.quantity_change,
                adj.valorisation_calcul,
                adj.username if hasattr(adj, 'username') else (adj.user.username if adj.user else "Système")
            ]
            sheet.append(row)

        # Ajuster largeur colonnes
        dims = {}
        for row in sheet.rows:
            for cell in row:
                if cell.value:
                    dims[cell.column_letter] = max((dims.get(cell.column_letter, 0), len(str(cell.value))))
        for col, value in dims.items():
            sheet.column_dimensions[col].width = value + 2

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename=journal_sorties_perimes.xlsx'
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
        
        lots_query = StockLot.objects.filter(quantity_free__gt=0)
        if fournisseur_id:
            lots_query = lots_query.filter(fournisseur_id=fournisseur_id)
        if date_debut:
            lots_query = lots_query.filter(date_reception__gte=date_debut)
        if date_fin:
            lots_query = lots_query.filter(date_reception__lte=date_fin)
        
        # Coalesce: use Command Supplier if available, else Lot Supplier
        stats = lots_query.annotate(
            effective_fournisseur_id=Coalesce(
                'commande_produit__commande__fournisseur_id',
                'fournisseur_id'
            ),
            effective_fournisseur_name=Coalesce(
                'commande_produit__commande__fournisseur__name',
                'fournisseur__name'
            )
        ).values(
            'effective_fournisseur_id',
            'effective_fournisseur_name'
        ).annotate(
            ug_recues=Sum('quantity_free'),
            ug_restantes=Sum('quantity_free_remaining'),
            valeur_acquise=Sum(F('quantity_free') * F('selling_price'), 
                                output_field=DecimalField()),
            valeur_restante=Sum(F('quantity_free_remaining') * F('selling_price'),
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
                'fournisseur_id': stat['effective_fournisseur_id'],
                'fournisseur_nom': stat['effective_fournisseur_name'],
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
            ug_remaining_in_lot = lot.quantity_free_remaining
            ug_en_stock += ug_remaining_in_lot
            
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
        
        total_ug_stock = StockLot.objects.filter(quantity_free_remaining__gt=0).aggregate(
            total=Sum('quantity_free_remaining')
        )['total'] or 0
        
        ug_mois = CommandeProduit.objects.filter(
            created_at__gte=debut_mois, unites_gratuites__gt=0
        ).aggregate(total=Sum('unites_gratuites'))['total'] or 0
        
        valeur_economisee = StockLot.objects.filter(quantity_free__gt=0).aggregate(
            total=Sum(F('quantity_free') * F('selling_price'), output_field=DecimalField())
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
            ratio = Decimal(str(relation.ratio))
            
            if destination.use_lot_management:
                if consumed_lots_info:
                    for item in consumed_lots_info:
                        source_lot = item['lot']
                        taken_qty = item['qty']
                        quantite_dest_lot = int(Decimal(str(taken_qty)) * ratio)
                        
                        if quantite_dest_lot <= 0:
                            continue

                        # Find or create a lot in destination with same lot number
                        # We try to find by lot number, product, and optionally expiration/supplier
                        dest_lot, created = StockLot.objects.get_or_create(
                            produit=destination,
                            lot=source_lot.lot,
                            defaults={
                                'quantity_initial': quantite_dest_lot,
                                'quantity_remaining': quantite_dest_lot,
                                'quantity_paid': quantite_dest_lot,
                                'quantity_free': 0,
                                'price_cost': destination.cost_price or 0,
                                'selling_price': destination.selling_price or 0,
                                'date_expiration': source_lot.date_expiration,
                                'date_reception': timezone.now(),
                                'fournisseur': source_lot.fournisseur or source.fournisseur
                            }
                        )

                        if not created:
                            # Update existing lot
                            dest_lot.quantity_initial += quantite_dest_lot
                            dest_lot.quantity_remaining += quantite_dest_lot
                            dest_lot.quantity_paid += quantite_dest_lot
                            # Optionally update expiry if it was null
                            if not dest_lot.date_expiration and source_lot.date_expiration:
                                dest_lot.date_expiration = source_lot.date_expiration
                            dest_lot.save()

                        # Traceability Lot Dest
                        StockAdjustment.objects.create(
                             produit=destination,
                             stock_lot=dest_lot,
                             user=request.user,
                             quantity_before=dest_lot.quantity_remaining - quantite_dest_lot,
                             quantity_after=dest_lot.quantity_remaining,
                             quantity_change=quantite_dest_lot,
                             reason_type=StockAdjustment.ReasonType.USAGE_INTERNE,
                             reason_detail=f"Transformation depuis {source.name} (Lot {source_lot.lot})"
                        )
                else:
                    # Fallback if source was NOT managed by lot but destination IS
                    quantite_dest = int(Decimal(str(quantite)) * ratio)
                    if quantite_dest > 0:
                        lot_number = f"TR{relation.id}-{int(time.time())}"
                        new_lot_dest = StockLot.objects.create(
                            produit=destination,
                            lot=lot_number,
                            quantity_initial=quantite_dest,
                            quantity_remaining=quantite_dest,
                            quantity_paid=quantite_dest,
                            quantity_free=0,
                            price_cost=destination.cost_price or 0,
                            selling_price=destination.selling_price or 0,
                            date_expiration=None,
                            date_reception=timezone.now(),
                            fournisseur=source.fournisseur
                        )
                        StockAdjustment.objects.create(
                             produit=destination,
                             stock_lot=new_lot_dest,
                             user=request.user,
                             quantity_before=0,
                             quantity_after=quantite_dest,
                             quantity_change=quantite_dest,
                             reason_type=StockAdjustment.ReasonType.USAGE_INTERNE,
                             reason_detail=f"Transformation depuis {source.name} (Sans lot source)"
                        )
            
            # Recalculate total quantities to ensure consistency
            quantite_dest_total = int(Decimal(str(quantite)) * ratio)
            destination.stock += quantite_dest_total
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
                quantite=quantite_dest_total,
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
                quantite_destination=quantite_dest_total,
                user=request.user,
                notes=request.data.get('notes', '')
            )

            # Log Audit transaction
            log_audit(
                user=request.user,
                action=AuditLog.Action.STOCK_ADJUST,
                model_name='Transformation',
                object_id=relation.id,
                description=f"Transformation: {quantite} {source.name} -> {quantite_dest_total} {destination.name}",
                details={
                    'source_id': source.id,
                    'destination_id': destination.id,
                    'qty_src': -quantite,
                    'qty_dest': quantite_dest_total,
                    'source_lots_used': [l['lot'].lot for l in consumed_lots_info]
                },
                request=request
            )
        
        return Response({
            'success': True,
            'stock_source': source.stock,
            'stock_destination': destination.stock,
            'message': f"Transformation réussie : {quantite} {source.name} -> {quantite_dest_total} {destination.name}"
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
        days_threshold = int(request.query_params.get('days', 30))  # Default: 30 jours après dernière entrée
        
        # Paramètres de pagination
        try:
            page = int(request.query_params.get('page', 1))
            if page < 1: page = 1
        except ValueError:
            page = 1
            
        try:
            page_size = int(request.query_params.get('page_size', 50))
            if page_size < 1: page_size = 50
        except ValueError:
            page_size = 50
        
        today = timezone.now()
        cutoff_date = (today - timedelta(days=days_threshold)).date()
        
        # Invendus = produits en stock dont la dernière ENTRÉE (dernier_achat)
        # date de plus de X jours ET aucune vente depuis cette entrée
        produits = Produit.objects.filter(
            stock__gt=0,
            dernier_achat__isnull=False,
            dernier_achat__lte=cutoff_date  # Entrée en stock depuis + de X jours
        ).filter(
            # Pas de vente du tout, OU dernière vente AVANT la dernière entrée en stock
            Q(dernier_vente__isnull=True) | Q(dernier_vente__lt=F('dernier_achat'))
        ).select_related('fournisseur')
        
        if fournisseur_id:
            produits = produits.filter(fournisseur_id=fournisseur_id)
        
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
                'cip': produit.cip1 if hasattr(produit, 'cip1') else '',
                'name': produit.name,
                'stock': produit.stock,
                'stock_maximum': produit.stock_maximum,
                'cost_price': float(produit.cost_price or 0),
                'selling_price': float(produit.selling_price or 0),
                'value': float(value),
                'days_since_sale': days_since_sale,
                'derniere_vente': produit.dernier_vente,
                'dernier_achat': produit.dernier_achat,
                'fournisseur_name': produit.fournisseur.name if produit.fournisseur else 'N/A'
            })
            total_value += value
        
        # Sort by days since sale (most stagnant first)
        results.sort(key=lambda x: x['days_since_sale'], reverse=True)
        
        # Pagination
        total_items = len(results)
        total_pages = (total_items + page_size - 1) // page_size if total_items > 0 else 1
        
        start = (page - 1) * page_size
        end = start + page_size
        paginated_results = results[start:end]
        
        return Response({
            'type': 'invendus',
            'fournisseur': Fournisseur.objects.get(id=fournisseur_id).name if fournisseur_id and Fournisseur.objects.filter(id=fournisseur_id).exists() else 'Tous',
            'total_items': total_items, # Conserve global count
            'total_value': float(total_value), # Conserve global value
            'current_page': page,
            'total_pages': total_pages,
            'page_size': page_size,
            'items': paginated_results
        })

class StockAnalysisOverstockView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        fournisseur_id = request.query_params.get('fournisseur', None)
        
        # Paramètres de pagination
        try:
            page = int(request.query_params.get('page', 1))
            if page < 1: page = 1
        except ValueError:
            page = 1
            
        try:
            page_size = int(request.query_params.get('page_size', 50))
            if page_size < 1: page_size = 50
        except ValueError:
            page_size = 50
        
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
                    'cip': produit.cip1 if hasattr(produit, 'cip1') else '',
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
        
        # Pagination
        total_items = len(results)
        total_pages = (total_items + page_size - 1) // page_size if total_items > 0 else 1
        
        start = (page - 1) * page_size
        end = start + page_size
        paginated_results = results[start:end]
        
        return Response({
            'type': 'surstock',
            'fournisseur': Fournisseur.objects.get(id=fournisseur_id).name if fournisseur_id and Fournisseur.objects.filter(id=fournisseur_id).exists() else 'Tous',
            'total_items': total_items, # Conserve global count
            'total_value': float(total_value), # Conserve global value
            'current_page': page,
            'total_pages': total_pages,
            'page_size': page_size,
            'items': paginated_results
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
        
        # Paramètres de pagination
        try:
            page = int(request.query_params.get('page', 1))
            if page < 1: page = 1
        except ValueError:
            page = 1
            
        try:
            page_size = int(request.query_params.get('page_size', 50))
            if page_size < 1: page_size = 50
        except ValueError:
            page_size = 50
            
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
                'cip': produit.cip1 if hasattr(produit, 'cip1') else '',
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

        # Compteurs par urgence globaux
        critical_count = sum(1 for r in results if r['urgency'] == 'critical')
        warning_count = sum(1 for r in results if r['urgency'] == 'warning')
        trending_up = sum(1 for r in results if r['trend'] == 'hausse')
        
        # Pagination
        total_items = len(results)
        total_pages = (total_items + page_size - 1) // page_size if total_items > 0 else 1
        
        start = (page - 1) * page_size
        end = start + page_size
        paginated_results = results[start:end]

        return Response({
            'type': 'shortage',
            'fournisseur': Fournisseur.objects.get(id=fournisseur_id).name if fournisseur_id and Fournisseur.objects.filter(id=fournisseur_id).exists() else 'Tous',
            'total_items': total_items, # Conserve global
            'total_value': float(total_value_at_risk), # Conserve global
            'critical_count': critical_count,
            'warning_count': warning_count,
            'trending_up_count': trending_up,
            'current_page': page,
            'total_pages': total_pages,
            'page_size': page_size,
            'items': paginated_results
        })

