from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import (
    F, Sum, DecimalField, Q, Count,
    Case, When, Value, ExpressionWrapper
)
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from decimal import Decimal
from django.db import IntegrityError
from django.core.exceptions import ValidationError

from ...models import (
    StockLot, Inventaire, LigneInventaire, StockAdjustment, Produit,
    MouvementStock, AuditLog
)
from ...serializers import InventaireSerializer, LigneInventaireSerializer
from ...serializers_optimized import InventaireListSerializer
from ...search_mixins import MultiTermSearchMixin
from ...audit_helpers import log_audit
from ...sudo_utils import validate_sudo_mode
from ...pagination import StandardResultsSetPagination
from .inventaire import (
    generate_ecarts_pdf, generate_etat_pdf, get_print_data,
    import_csv_inventaire,
    bulk_delete_lignes_inventaire, bulk_lignes_inventaire,
    merge_inventaires, merge_duplicate_lines,
    get_inventaire_stats, audit_discrepancies,
    validate_inventaire,
    generate_listing_excel,
)


class InventaireViewSet(MultiTermSearchMixin, viewsets.ModelViewSet):
    queryset = Inventaire.objects.all().order_by('-date')
    serializer_class = InventaireSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]

    filterset_fields = {
        'status': ['exact', 'in'],
        'created_by': ['exact'],
        'date': ['exact', 'gte', 'lte'],
    }
    search_fields = ['description', 'status']
    ordering_fields = ['date', 'status', 'total_ecart_valeur', 'total_ecart_quantite']

    def get_serializer_class(self):
        if self.action == 'list':
            return InventaireListSerializer
        return InventaireSerializer

    def get_queryset(self):
        queryset = super().get_queryset().filter(is_active=True)
        
        if self.action == 'list':
            from django.db.models import Subquery, OuterRef
            
            # Price expression: if pmp_snapshot > 0 use it, else use product cost_price
            line_price_expr = Case(
                When(pmp_snapshot__gt=0, then=F('pmp_snapshot')),
                default=F('produit__cost_price'),
                output_field=DecimalField()
            )
            
            # Sous-requête de base optimisée (utilise inventaire_id=OuterRef('pk'))
            base_subquery = LigneInventaire.objects.filter(
                inventaire_id=OuterRef('pk')
            )
            
            # Utilisation de Subquery pour la stabilité des calculs complexes
            queryset = queryset.annotate(
                total_valeur_theorique=Coalesce(
                    Subquery(
                        base_subquery.annotate(
                            val=F('stock_theorique') * line_price_expr
                        ).values('inventaire_id').annotate(
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
                        ).values('inventaire_id').annotate(
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
                        ).values('inventaire_id').annotate(
                            total=Sum('val')
                        ).values('total')[:1],
                        output_field=DecimalField()
                    ),
                    Value(0, output_field=DecimalField())
                ),
                total_ecart_quantite=Coalesce(
                    Subquery(
                        base_subquery.values('inventaire_id').annotate(
                            total=Sum('ecart')
                        ).values('total')[:1],
                        output_field=DecimalField()
                    ),
                    Value(0, output_field=DecimalField())
                ),
            ).select_related('created_by')
            
        return queryset


    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])

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
        """
        inventaire = self.get_object()
        return validate_inventaire(inventaire, request)


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
                
                # --- UPSERT / MERGE LOGIC ---
                # Chercher si une ligne existe déjà pour cet inventaire, produit et lot
                existing_ligne = LigneInventaire.objects.filter(
                    inventaire=inventaire,
                    produit_id=data.get('produit'),
                    stock_lot_id=data.get('stock_lot')
                ).first()

                if existing_ligne:
                    # Fusionner : on ajoute la quantité physique
                    # On recalcule l'écart par rapport au théorique initial
                    new_qte = data.get('quantite_physique', data.get('quantite_comptee', 0))
                    existing_ligne.quantite_physique += int(new_qte)
                    existing_ligne.save() # Le ecart est calculé dans save() du modèle
                    
                    serializer = LigneInventaireSerializer(existing_ligne)
                    return Response(serializer.data, status=status.HTTP_200_OK)
                
                # Sinon, création normale
                serializer = LigneInventaireSerializer(data=data)
                if serializer.is_valid():
                    serializer.save()
                    return Response(serializer.data, status=status.HTTP_201_CREATED)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
            except (StockLot.DoesNotExist, Produit.DoesNotExist) as e:
                transaction.set_rollback(True)
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            except ValidationError as e:
                transaction.set_rollback(True)
                return Response({'error': f"Erreur de validation: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
            except IntegrityError as e:
                transaction.set_rollback(True)
                return Response({'error': f"Erreur d'intégrité (doublon probable): {str(e)}"}, status=status.HTTP_409_CONFLICT)
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
        return bulk_delete_lignes_inventaire(inventaire, ids, request.user, request)

    @action(detail=True, methods=['post'], url_path='lignes/bulk')
    @transaction.atomic
    def bulk_lignes(self, request, pk=None):
        """
        Import en masse de lignes d'inventaire optimisé (Réduction N+1).
        """
        inventaire = self.get_object()
        lignes_data = request.data.get('lignes', [])
        return bulk_lignes_inventaire(inventaire, lignes_data)

    @action(detail=True, methods=['post'], url_path='import-csv')
    @transaction.atomic
    def import_csv(self, request, pk=None):
        """
        Importe des lignes d'inventaire depuis un fichier CSV.
        Format attendu: cip;quantite (cip obligatoire, quantite obligatoire)
        """
        inventaire = self.get_object()

        if 'file' not in request.FILES:
            return Response({'error': 'Aucun fichier fourni.'}, status=status.HTTP_400_BAD_REQUEST)

        return import_csv_inventaire(inventaire, request.FILES['file'])

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def merge(self, request, pk=None):
        """
        Fusionne un autre inventaire (source) dans l'inventaire actuel (cible).
        L'inventaire source est ensuite supprimé.
        """
        target_inventaire = self.get_object()
        source_id = request.data.get('source_inventaire_id')
        return merge_inventaires(target_inventaire, source_id, request.user, request)

    @action(detail=True, methods=['post'], url_path='merge-duplicates')
    @transaction.atomic
    def merge_duplicates(self, request, pk=None):
        """
        Fusionne les lignes en doublon au sein du même inventaire.
        Doublon défini par : même produit et même lot (ou pas de lot).
        """
        inventaire = self.get_object()
        return merge_duplicate_lines(inventaire)


    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """
        Retourne les statistiques de l'inventaire pour l'onglet Analyse.
        """
        inventaire = self.get_object()
        return get_inventaire_stats(inventaire)

    @action(detail=False, methods=['get'])
    def audit_discrepancies(self, request):
        """
        Audit global des écarts sur tous les inventaires validés.
        """
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        return audit_discrepancies(start_date, end_date)

    @action(detail=True, methods=['get'])
    def imprimer_ecarts(self, request, pk=None):
        """
        Génère un PDF listant uniquement les écarts.
        """
        inventaire = self.get_object()
        return generate_ecarts_pdf(inventaire)

    @action(detail=True, methods=['get'])
    def print_data(self, request, pk=None):
        """
        Retourne les données structurées pour l'impression frontend (React).
        Supporte les feuilles de saisie et les rapports d'écarts.
        """
        inventaire = self.get_object()
        group_by = request.query_params.get('group_by', 'rayon')
        is_report = (
            request.query_params.get('report', '0') == '1'
            or inventaire.status == Inventaire.Status.VALIDEE
        )
        data = get_print_data(inventaire, group_by=group_by, is_report=is_report)
        return Response(data)

    @action(detail=True, methods=['get'])
    def imprimer_etat(self, request, pk=None):
        """
        Génère un PDF de l'état d'inventaire groupé par rayon.
        """
        inventaire = self.get_object()
        return generate_etat_pdf(inventaire)

    @action(detail=False, methods=['get'], url_path='listing-json')
    def listing_json(self, request):
        """
        Retourne les données du listing de stock en JSON plat (pour export côté client).
        Paramètres identiques à listing-excel.
        """
        from .inventaire.listing_excel import _get_rows_from_stock, _get_rows_from_inventaire

        group_by = request.query_params.get('group_by', 'rayon')
        stock_filter = request.query_params.get('stock_filter', 'tous')
        filter_id_str = request.query_params.get('filter_id')
        inventaire_id_str = request.query_params.get('inventaire_id')

        filter_id = int(filter_id_str) if filter_id_str and filter_id_str.isdigit() else None
        inventaire_id = int(inventaire_id_str) if inventaire_id_str and inventaire_id_str.isdigit() else None

        if inventaire_id:
            grouped = _get_rows_from_inventaire(inventaire_id, group_by, stock_filter, filter_id)
        else:
            grouped = _get_rows_from_stock(group_by, stock_filter, filter_id)

        rows = []
        for group_name, group_rows in grouped.items():
            for r in group_rows:
                rows.append({**r, 'groupe': group_name})

        return Response(rows)

    @action(detail=False, methods=['get'], url_path='listing-excel')
    def listing_excel(self, request):
        """
        Génère un fichier Excel configurable du listing de stock.
        Paramètres :
          - group_by    : rayon | forme | groupe | fournisseur
          - stock_filter: tous | zero | non_zero
          - filter_id   : id de l'entité de regroupement (optionnel)
          - inventaire_id: id d'un inventaire précis (optionnel)
        """
        group_by = request.query_params.get('group_by', 'rayon')
        stock_filter = request.query_params.get('stock_filter', 'tous')
        filter_id_str = request.query_params.get('filter_id')
        inventaire_id_str = request.query_params.get('inventaire_id')

        filter_id = int(filter_id_str) if filter_id_str and filter_id_str.isdigit() else None
        inventaire_id = int(inventaire_id_str) if inventaire_id_str and inventaire_id_str.isdigit() else None

        return generate_listing_excel(
            group_by=group_by,
            stock_filter=stock_filter,
            filter_id=filter_id,
            inventaire_id=inventaire_id,
        )


class LigneInventaireViewSet(viewsets.ModelViewSet):
    queryset = LigneInventaire.objects.all().order_by('id')
    serializer_class = LigneInventaireSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
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
                new_lot: StockLot = StockLot.objects.create(
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
