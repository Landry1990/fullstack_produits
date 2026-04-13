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
import io
from django.http import HttpResponse
from django.db import IntegrityError
from django.core.exceptions import ValidationError

# ReportLab imports
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle, Spacer, Frame, PageTemplate, BaseDocTemplate

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


    permission_classes = [IsAuthenticated]

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

        # 1. Préparation et Verrouillage Atomique
        # On récupère toutes les lignes avec leurs relations
        lignes = list(inventaire.lignes.select_related('produit', 'stock_lot').all())
        if not lignes:
            return Response({'detail': 'Cet inventaire est vide.'}, status=status.HTTP_400_BAD_REQUEST)

        # On verrouille les Produits et les Lots pour éviter toute modification concurrentielle (ex: vente)
        product_ids = {l.produit_id for l in lignes if l.produit_id}
        lot_ids = {l.stock_lot_id for l in lignes if l.stock_lot_id}
        
        # TRÈS IMPORTANT: order_by('id') pour éviter les deadlocks
        locked_products_list = list(Produit.objects.select_for_update().filter(id__in=product_ids).order_by('id'))
        locked_products = {p.id: p for p in locked_products_list}
        
        locked_lots_list = list(StockLot.objects.select_for_update().filter(id__in=lot_ids).order_by('id'))
        locked_lots = {l.id: l for l in locked_lots_list}

        # Collections pour les opérations batch
        lots_to_update = {}            # {lot_id: lot_object}
        produits_to_update = {}        # {product_id: product_object}
        adjustments_to_create = []     # StockAdjustment objects
        mouvements_to_create = []      # MouvementStock objects
        remaining_capacities = {}      # {product_id: current_remaining_capacity}
        now = timezone.now()
        
        # Phase 2 : Traitement en mémoire
        for ligne in lignes:
            produit = locked_products.get(ligne.produit_id)
            if not produit: continue
            
            target_lot = locked_lots.get(ligne.stock_lot_id)
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
        
        # Phase 3 : Création Groupée (Writings)
        
        # 3a. Mise à jour des lignes
        if lignes:
            LigneInventaire.objects.bulk_update(lignes, ['ecart', 'pmp_snapshot', 'stock_lot'])
        
        # 3b. Mise à jour des lots
        if lots_to_update:
            StockLot.objects.bulk_update(lots_to_update.values(), ['quantity_remaining', 'quantity_reserved'])

        # 3c. Création des ajustements de stock
        if adjustments_to_create:
            StockAdjustment.objects.bulk_create(adjustments_to_create)

        # Phase 4 : Recalcul Groupé des Produits (Performance optimale)
        # On active la gestion par lots si nécessaire
        prods_needing_lot_flag = [p for p in locked_products_list if not p.use_lot_management]
        if prods_needing_lot_flag:
            for p in prods_needing_lot_flag:
                p.use_lot_management = True
            Produit.objects.bulk_update(prods_needing_lot_flag, ['use_lot_management'])
        
        # Recalcul massif des stocks consolidés (produit = somme des lots)
        from django.db.models import Sum
        for prod in locked_products_list:
            # On agrège les lots pour ce produit
            results = StockLot.objects.filter(produit=prod).aggregate(
                total_remaining=Sum('quantity_remaining'),
                total_reserved=Sum('quantity_reserved')
            )
            prod.stock = results['total_remaining'] or 0
            prod.stock_reserve = results['total_reserved'] or 0
            
            # Mise à jour du snapshot de stock final dans les objets mouvements EN MÉMOIRE
            # avant qu'ils ne soient créés en base
            for mov in mouvements_to_create:
                if mov.produit_id == prod.id:
                    mov.stock_apres = prod.total_stock

        # Phase 5 : Finalisation des écritures
        # 5a. Création des mouvements (avec le stock_apres maintenant renseigné)
        if mouvements_to_create:
            MouvementStock.objects.bulk_create(mouvements_to_create)

        # 5b. Sauvegarde massive des produits
        Produit.objects.bulk_update(locked_products_list, ['stock', 'stock_reserve'])

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
        
        if not ids:
            return Response({'error': 'Aucun ID fourni'}, status=status.HTTP_400_BAD_REQUEST)

        # On s'assure que les lignes appartiennent bien à cet inventaire
        lignes = LigneInventaire.objects.filter(id__in=ids, inventaire=inventaire)
        count = lignes.count()
        
        if count == 0:
            return Response({'error': 'Aucune ligne correspondante trouvée'}, status=status.HTTP_404_NOT_FOUND)

        # Log d'audit avant suppression
        log_audit(
            user=request.user,
            action=AuditLog.Action.DELETE,
            model_name='LigneInventaire',
            object_id=str(inventaire.id),
            description=f"Suppression massive de {count} ligne(s) dans l'inventaire #{inventaire.id}",
            details={'inventaire_id': inventaire.id, 'lignes_count': count, 'lignes_ids': list(ids)},
            request=request
        )

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

        # Groupement par (produit_id, lot_id) pour fusionner avant bulk_create
        lignes_finales = {} # {(p_id, lot_id): LigneInventaire}

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
                        try:
                            # Création à la volée du lot manquant
                            target_lot = StockLot.objects.create(
                                produit=produit,
                                lot=data['lot_numero'],
                                date_expiration=data.get('lot_expiration') if data.get('lot_expiration') else None,
                                quantity_remaining=0,
                                quantity_initial=0,
                                price_cost=produit.cost_price or 0,
                                selling_price=produit.selling_price or 0,
                                date_reception=timezone.now()
                            )
                            existing_lots_by_num[key] = target_lot
                        except ValidationError as ve:
                            errors.append(f"Ligne {index}: Date invalide pour le lot {data['lot_numero']}")
                            continue

                # Déterminer le stock théorique
                stock_theorique = target_lot.quantity_remaining if target_lot else produit.stock
                qte_saisie = int(data.get('quantite_physique', data.get('quantite_comptee', stock_theorique)))

                # --- MERGE IN BULK ---
                lot_id = target_lot.id if target_lot else None
                merge_key = (p_id, lot_id)
                
                if merge_key in lignes_finales:
                    lignes_finales[merge_key].quantite_physique += qte_saisie
                    # l'écart sera calculé lors du save() ou manuellement
                    lignes_finales[merge_key].ecart = lignes_finales[merge_key].quantite_physique - stock_theorique
                else:
                    # On vérifie s'il existe déjà une ligne en base pour cet inventaire
                    existing_in_db = LigneInventaire.objects.filter(
                        inventaire=inventaire, produit=produit, stock_lot=target_lot
                    ).first()
                    
                    if existing_in_db:
                        existing_in_db.quantite_physique += qte_saisie
                        existing_in_db.ecart = existing_in_db.quantite_physique - stock_theorique
                        existing_in_db.save()
                        imported_count += 1
                    else:
                        lignes_finales[merge_key] = LigneInventaire(
                            inventaire=inventaire,
                            produit=produit,
                            stock_lot=target_lot,
                            stock_theorique=stock_theorique,
                            quantite_physique=qte_saisie,
                            ecart=qte_saisie - stock_theorique,
                            pmp_snapshot=produit.pmp or produit.cost_price or 0
                        )
                        imported_count += 1

            except Exception as e:
                errors.append(f"Ligne {index}: {str(e)}")

        if lignes_finales:
            LigneInventaire.objects.bulk_create(lignes_finales.values())
        
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
            
            import csv, io as csv_io
            
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
            csv_reader = csv.DictReader(csv_io.StringIO(decoded_file), delimiter=delimiter)
            
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
        
        log_audit(
            user=request.user,
            action=AuditLog.Action.UPDATE,
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
        from django.db.models import Count as DjCount
        
        # On groupe par produit et stock_lot
        duplicates = inventaire.lignes.values('produit', 'stock_lot').annotate(
            count=DjCount('id')
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
        from django.db.models.functions import Cast
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
    def print_data(self, request, pk=None):
        """
        Retourne les données structurées pour l'impression frontend (React).
        Supporte les feuilles de saisie et les rapports d'écarts.
        """
        inventaire = self.get_object()
        lignes = inventaire.lignes.select_related('produit', 'produit__rayon', 'stock_lot').order_by('produit__rayon__name', 'produit__name')
        
        grouped = {}
        total_global_ecart = 0
        
        for l in lignes:
            rayon = l.produit.rayon.name if l.produit and l.produit.rayon else "AUTRES"
            if rayon not in grouped: grouped[rayon] = []
            
            # Calcul du PMP/Coût pour la valeur de l'écart
            pmp = l.pmp_snapshot or (l.produit.pmp if l.produit else 0) or (l.produit.cost_price if l.produit else 0)
            valeur_ecart = float(l.ecart) * float(pmp if pmp else 0)
            total_global_ecart += valeur_ecart
            
            grouped[rayon].append({
                'id': l.id,
                'cip1': l.produit.cip1 if l.produit else '-',
                'name': l.produit.name if l.produit else '-',
                'lot_numero': l.stock_lot.lot if l.stock_lot else (l.lot_numero if hasattr(l, 'lot_numero') else '-'),
                'stock': float(l.stock_theorique),
                'stock_theorique': float(l.stock_theorique),
                'quantite_physique': float(l.quantite_physique),
                'ecart': float(l.ecart),
                'valeur_ecart': valeur_ecart,
                'selling_price': float(l.produit.selling_price) if l.produit and l.produit.selling_price else 0,
                'is_lot_line': False
            })
            
        is_report = request.query_params.get('report', '0') == '1' or inventaire.status == Inventaire.Status.VALIDEE
        
        return Response({
            'title': "RAPPORT D'INVENTAIRE" if is_report else "FEUILLE DE SAISIE INVENTAIRE",
            'subtitle': f"Réf: #{inventaire.id} - {inventaire.description}" if inventaire.description else f"Réf: #{inventaire.id}",
            'date': inventaire.date.isoformat(),
            'groups': grouped,
            'is_report': is_report,
            'total_global_ecart': total_global_ecart
        })


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
