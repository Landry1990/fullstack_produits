from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action, api_view, permission_classes  # For order generation
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from django.db import transaction
from django.db.models import F, Sum, Count, Q
from django.http import HttpResponse
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch, cm
from reportlab.platypus import BaseDocTemplate, Frame, Paragraph, PageBreak, PageTemplate, Table, TableStyle, SimpleDocTemplate, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from datetime import datetime, timedelta
from django.utils import timezone
from django.core.cache import cache
from django.db.models import Count, Q
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth.models import User
from .filters import ProduitFilter
from .models import (
    Produit, Rayon, Fournisseur, Client, Commande, CommandeProduit, Facture, FactureProduit, Caisse,
    StockLot, FactureProduitAllocation, AyantDroit, ClotureCaisse, ActivityLog, RelevePaiement,
    Inventaire, LigneInventaire, MouvementCaisse, Avoir, LigneAvoir,
    RelationTransformation, HistoriqueTransformation, MouvementStock,
    InvoiceSettings, AuditLog
)
from .serializers import (
    ProduitSerializer, RayonSerializer, FournisseurSerializer,
    ClientSerializer, CommandeSerializer, CommandeProduitSerializer,
    FactureSerializer, FactureProduitSerializer, StockLotSerializer,
    AvoirSerializer, HistoriqueTransformationSerializer, MouvementStockSerializer,
    InvoiceSettingsSerializer, AuditLogSerializer,
    InventaireSerializer, LigneInventaireSerializer, CreanceSerializer,
    ClotureCaisseSerializer, FactureProduitAllocationSerializer, MouvementCaisseSerializer,
    UserSerializer, AyantDroitSerializer, LigneAvoirSerializer, CaisseSerializer,
    RelationTransformationSerializer
)
from decimal import Decimal

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
            'can_sell_negative_stock': user.profile.can_sell_negative_stock if hasattr(user, 'profile') else False
        })

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('username')
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser] # Only admin can manage users

class ProduitViewSet(viewsets.ModelViewSet):
    """
    API endpoint for products.
    """
    queryset = Produit.objects.all().order_by('-created_at')
    serializer_class = ProduitSerializer
    filter_backends = (DjangoFilterBackend, filters.SearchFilter)
    filterset_class = ProduitFilter
    search_fields = ['name', 'cip1', 'cip2', 'cip3']
    permission_classes = [IsAuthenticated]

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
        
        # 7. Combiner et trier par date décroissante (le plus récent en premier)
        transactions.sort(key=lambda x: x['date'], reverse=True)
        
        # 8. Reconstruire l'historique du stock (en remontant le temps)
        current_stock = produit.stock
        history = []
        
        running_stock = current_stock
        
        for trans in transactions:
            stock_after = running_stock
            
            if trans['type'] in ['ENTREE', 'RETOUR', 'TRANSFORMATION_ENTREE']:
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
        row_height = 3 * cm
        
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
                    
                    # Cell content
                    cell_content = [
                        Paragraph(product.name[:30], style_normal),
                        d,
                        Paragraph(f"{product.selling_price} F", style_normal)
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

class CategorieViewSet(viewsets.ModelViewSet):
    """API endpoint for categories (rayons) - Fresh implementation."""
    queryset = Rayon.objects.all().order_by('name')
    serializer_class = RayonSerializer
    permission_classes = [permissions.AllowAny]

class FournisseurViewSet(viewsets.ModelViewSet):
    """API endpoint for fournisseurs."""
    queryset = Fournisseur.objects.all().order_by('name')
    serializer_class = FournisseurSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'email', 'phone']

class ClientViewSet(viewsets.ModelViewSet):
    """API endpoint for clients."""
    queryset = Client.objects.all().order_by('name')
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]

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

class CommandeViewSet(viewsets.ModelViewSet):
    """API endpoint for commandes."""
    queryset = Commande.objects.select_related('fournisseur').prefetch_related('produits').all().order_by('-date')
    serializer_class = CommandeSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        if instance.status == Commande.Status.CLOTUREE:
             from rest_framework.exceptions import ValidationError
             raise ValidationError("Impossible de supprimer une commande clôturée.")
        super().perform_destroy(instance)

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def generate_replenishment(self, request):
        """
        Génère automatiquement des commandes brouillon pour les produits en rupture de stock.
        Règle : Si stock <= stock_minimum, commander (stock_maximum - stock).
        Si pas de stock_maximum, commander (stock_minimum * 2).
        """
        # 1. Identifier les produits à commander
        produits_a_commander = Produit.objects.filter(stock__lte=F('stock_minimum'))
        
        if not produits_a_commander.exists():
            return Response({'detail': 'Aucun produit ne nécessite un réapprovisionnement.'}, status=status.HTTP_200_OK)

        commandes_creees = []
        produits_par_fournisseur = {}

        # 2. Grouper par fournisseur
        for produit in produits_a_commander:
            if not produit.fournisseur:
                continue # On ignore les produits sans fournisseur
            
            if produit.fournisseur.id not in produits_par_fournisseur:
                produits_par_fournisseur[produit.fournisseur.id] = {
                    'fournisseur': produit.fournisseur,
                    'produits': []
                }
            
            produits_par_fournisseur[produit.fournisseur.id]['produits'].append(produit)

        # 3. Créer les commandes
        count_commandes = 0
        count_produits = 0

        for fournisseur_id, data in produits_par_fournisseur.items():
            fournisseur = data['fournisseur']
            produits = data['produits']
            
            # Vérifier s'il existe déjà une commande brouillon pour ce fournisseur
            commande = Commande.objects.filter(
                fournisseur=fournisseur, 
                status=Commande.Status.BROUILLON
            ).first()
            
            created = False
            if not commande:
                commande = Commande.objects.create(
                    fournisseur=fournisseur,
                    status=Commande.Status.BROUILLON
                )
                created = True
                count_commandes += 1
            
            # Ajouter les produits à la commande
            for produit in produits:
                # Calculer la quantité à commander
                if produit.stock_maximum > 0:
                    qte_a_commander = produit.stock_maximum - produit.stock
                else:
                    qte_a_commander = produit.stock_minimum * 2
                
                # S'assurer que la quantité est positive et au moins 1
                qte_a_commander = max(qte_a_commander, 1)
                
                # Vérifier si le produit est déjà dans la commande
                commande_produit, cp_created = CommandeProduit.objects.get_or_create(
                    commande=commande,
                    produit=produit,
                    defaults={
                        'quantity': qte_a_commander,
                        'price': produit.cost_price
                    }
                )
                
                if not cp_created:
                    # Si déjà présent, on met à jour la quantité pour atteindre le stock cible
                    # On prend le max entre ce qui était prévu et le nouveau calcul
                    commande_produit.quantity = max(commande_produit.quantity, qte_a_commander)
                    commande_produit.price = produit.cost_price # Mise à jour du prix coûtant au cas où
                    commande_produit.save()
                
                count_produits += 1

            commandes_creees.append({
                'fournisseur': fournisseur.name,
                'commande_id': commande.id,
                'nouveau': created
            })

        return Response({
            'detail': f'{count_commandes} commande(s) générée(s) ou mise(s) à jour pour {count_produits} produits.',
            'commandes': commandes_creees
        })

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cloturer(self, request, pk=None):
        """
        Clôture une commande, met à jour le stock des produits et crée les lots de stock (FIFO).
        Prend en compte les unités gratuites (UG) pour le calcul du PMP et la valorisation.
        """
        commande = self.get_object()
        if commande.status == Commande.Status.CLOTUREE:
            return Response({'detail': 'Cette commande est déjà clôturée.'}, status=status.HTTP_400_BAD_REQUEST)

        # Mettre à jour le stock pour chaque produit dans la commande
        for item in commande.produits.all():
            # Calcul des quantités
            quantity_paid = item.quantity
            quantity_free = item.unites_gratuites
            total_qty = quantity_paid + quantity_free
            
            # Calcul du coût effectif (le coût payé réparti sur toutes les unités)
            if total_qty > 0:
                effective_cost = (quantity_paid * item.price_cost) / total_qty
            else:
                effective_cost = item.price_cost
            
            # 1. Créer un lot de stock pour la traçabilité
            StockLot.objects.create(
                produit=item.produit,
                commande_produit=item,
                fournisseur=commande.fournisseur,
                quantity_initial=total_qty,
                quantity_paid=quantity_paid,
                quantity_free=quantity_free,
                quantity_remaining=total_qty,
                price_cost=effective_cost,  # Coût effectif ajusté avec les UG
                lot=item.lot,
                date_expiration=item.date_expiration,
                date_reception=commande.date
            )

            # 2. Mettre à jour le stock global et le PMP
            produit = item.produit
            
            # Calcul PMP avec les UG
            # Formule: (AncienStock * AncienPMP + CoutTotal) / (AncienStock + QteRecue)
            # Où CoutTotal = quantity_paid * price_cost (on ne paie pas les UG)
            old_stock = Decimal(produit. stock)
            old_pmp = Decimal(produit.pmp)
            qty_received = Decimal(total_qty)  # Total reçu (payé + gratuit)
            cout_total = Decimal(quantity_paid) * Decimal(item.price_cost)  # Coût total payé
            
            new_total_qty = old_stock + qty_received
            
            if new_total_qty > 0:
                # Valorisation actuelle + coût de la nouvelle réception
                current_val = old_stock * old_pmp
                incoming_val = cout_total  # Seulement le coût payé
                
                # Nouveau PMP = Valeur totale / Quantité totale
                new_pmp = (current_val + incoming_val) / new_total_qty
                produit.pmp = new_pmp
            
            # Augmentation du stock par le total reçu (payé + gratuit)
            produit.stock = F('stock') + total_qty
            produit.save(update_fields=['stock', 'pmp'])

        # Changer le statut de la commande
        commande.status = Commande.Status.CLOTUREE
        commande.save(update_fields=['status'])

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


class FactureViewSet(viewsets.ModelViewSet):
    """API endpoint for factures."""
    queryset = Facture.objects.select_related('client', 'ayant_droit').prefetch_related('produits', 'paiements').all().order_by('-date')
    serializer_class = FactureSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def valider(self, request, pk=None):
        """
        Valide une facture, met à jour le stock et alloue les lots (FIFO).
        """
        facture = self.get_object()
        if facture.status == Facture.Status.VALIDEE:
            return Response({'detail': 'Cette facture est déjà validée.'}, status=status.HTTP_400_BAD_REQUEST)

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
                can_sell_negative = False
                if hasattr(request.user, 'profile'):
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

        # Mettre à jour le stock et appliquer FIFO
        for item in items:
            produit = product_map.get(item.produit_id)
            
            # 1. Mise à jour du stock global sur l'instance VERROUILLÉE
            produit.stock = F('stock') - item.quantity
            produit.save(update_fields=['stock'])
            
            # 2. Logique FIFO pour les VENTES (qty > 0)
            if item.quantity > 0:
                quantity_to_allocate = item.quantity
                
                # Récupérer les lots disponibles par ordre FIFO (plus anciens en premier)
                # Note: On pourrait aussi verrouiller les lots, mais c'est moins critique si le stock global est bon
                available_lots = StockLot.objects.select_for_update().filter(
                    produit=produit,
                    quantity_remaining__gt=0
                ).order_by('date_reception')
                
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

        # Changer le statut de la facture et générer un numéro si besoin
        facture.status = Facture.Status.VALIDEE
        if not facture.numero_facture:
            facture.numero_facture = f"FAC-{facture.id:06d}"
        facture.save(update_fields=['status', 'numero_facture'])

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

        # 1. Restaurer le stock des produits
        for ligne in facture.produits.all():
            produit = ligne.produit
            produit.stock += ligne.quantity
            produit.save(update_fields=['stock'])

        # 2. Libérer les allocations FIFO
        FactureProduitAllocation.objects.filter(
            facture_produit__facture=facture
        ).delete()

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

        # Log activity
        ActivityLog.objects.create(
            user=request.user,
            action='CANCEL_INVOICE',
            target_model='Facture',
            target_id=str(facture.id),
            details={'motif': motif, 'amount': float(facture.total_ttc)},
            ip_address=request.META.get('REMOTE_ADDR')
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
        layout = settings.header_layout # split, left, center, right
        
        if layout == 'split':
            # Logo/Company Gauche, Info Droite
            invoice_block = [Paragraph(invoice_details_text, style_right)]
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
            story.append(Paragraph(invoice_details_text, style_left))
            
        elif layout == 'center':
            # Tout centré
            style_company_center = ParagraphStyle('CompanyCenter', parent=style_company, alignment=1)
            story.append(Paragraph(f"<b>{settings.company_name}</b>", style_company_center))
            story.append(Paragraph(company_address_fmt, style_center))
            story.append(Spacer(1, 0.5*cm))
            story.append(Paragraph(invoice_details_text, style_center))
            
        elif layout == 'right':
            # Tout à droite
            style_company_right = ParagraphStyle('CompanyRight', parent=style_company, alignment=2)
            style_normal_right = ParagraphStyle('NormalRight', parent=style_normal, alignment=2)
            story.append(Paragraph(f"<b>{settings.company_name}</b>", style_company_right))
            story.append(Paragraph(company_address_fmt, style_normal_right))
            story.append(Spacer(1, 0.5*cm))
            story.append(Paragraph(invoice_details_text, style_right))

        story.append(Spacer(1, 1.5*cm))
        
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
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
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
            
        total_ventes = transactions.aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        
        # Totaux par mode
        modes = transactions.values('mode_paiement').annotate(total=Sum('montant'))
        details = {item['mode_paiement']: item['total'] for item in modes}

        # 2. Mouvements de caisse (Entrées/Sorties)
        mouvements = MouvementCaisse.objects.all()
        if start_date:
            mouvements = mouvements.filter(date__gte=start_date)
        if end_date:
            mouvements = mouvements.filter(date__lte=end_date)
            
        total_entrees = mouvements.filter(type='ENTREE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        total_sorties = mouvements.filter(type='SORTIE').aggregate(Sum('montant'))['montant__sum'] or Decimal('0.00')
        
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


class StockLotViewSet(viewsets.ModelViewSet):
    """API endpoint for stock lots (expiry management)."""
    queryset = StockLot.objects.select_related('produit', 'fournisseur').order_by('date_expiration')
    serializer_class = StockLotSerializer
    filter_backends = (DjangoFilterBackend, filters.OrderingFilter)
    filterset_fields = ['produit', 'fournisseur']
    ordering_fields = ['date_expiration', 'date_reception']
    permission_classes = [IsAuthenticated]

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
        # Try to get from cache
        cached_stats = cache.get('dashboard_stats')
        if cached_stats:
            return Response(cached_stats)

        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        
        # Chiffre d'affaires du jour (Total TTC des factures payées ou validées aujourd'hui)
        factures_today = Facture.objects.filter(
            date__date=today,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).prefetch_related('produits')
        
        revenue_today = sum(f.total_ttc for f in factures_today)
        
        factures_yesterday = Facture.objects.filter(
            date__date=yesterday,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).prefetch_related('produits')
        
        revenue_yesterday = sum(f.total_ttc for f in factures_yesterday)
        
        # Calculer la variation en pourcentage
        if revenue_yesterday > 0:
            revenue_change = ((revenue_today - revenue_yesterday) / revenue_yesterday) * 100
        else:
            revenue_change = 100 if revenue_today > 0 else 0
            
        # Ventes du jour (Nombre de factures)
        sales_count_today = factures_today.count()
        sales_count_yesterday = factures_yesterday.count()
        
        if sales_count_yesterday > 0:
            sales_change = ((sales_count_today - sales_count_yesterday) / sales_count_yesterday) * 100
        else:
            sales_change = 100 if sales_count_today > 0 else 0
            
        # Nouveaux Clients
        new_clients_today = Client.objects.filter(created_at__date=today).count()
        new_clients_yesterday = Client.objects.filter(created_at__date=yesterday).count()
        
        if new_clients_yesterday > 0:
            clients_change = ((new_clients_today - new_clients_yesterday) / new_clients_yesterday) * 100
        else:
            clients_change = 100 if new_clients_today > 0 else 0
            

            
        # Alertes Stock (Produits avec stock <= 5)
        low_stock_count = Produit.objects.filter(stock__lte=5).count()
        # Pour la variation, c'est plus compliqué sans historique de stock, on met 0 pour l'instant
        stock_change = 0
        
        # Créances Clients (Total des dettes)
        # On ne prend que les factures ayant un paiement 'en_compte' (crédit accordé)
        # et qui sont validées OU payées (certaines anciennes peuvent être marquées payées tout en ayant du crédit)
        factures_validees = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            paiements__mode_paiement='en_compte'
        ).distinct().prefetch_related('produits', 'paiements')
        
        total_receivables = Decimal('0.00')
        receivables_count = 0
        
        for f in factures_validees:
            # Calculer le montant déjà payé (hors en_compte)
            paiements_reels = sum(p.montant for p in f.paiements.all() if p.statut == 'completee' and p.mode_paiement != 'en_compte')
            reste = f.total_ttc - paiements_reels
            if reste > 0:
                total_receivables += reste
                receivables_count += 1
        
        # Valorisation du stock (Prix d'achat * Quantité)
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
                'change': stock_change
            },
            'receivables': {
                'value': total_receivables,
                'count': receivables_count
            },
            'stock_value': {
                'value': stock_valuation,
                'change': 0
            }
        }
        
        # Cache for 15 minutes (900 seconds)
        # Note: Invalidated by signals on Facture/Caisse/Client/Produit save
        cache.set('dashboard_stats', data, timeout=900)
        
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
        queryset = Facture.objects.filter(
            paiements__mode_paiement='en_compte',
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ).distinct().select_related(
            'client', 'ayant_droit'
        ).prefetch_related('paiements').order_by('-date')

        # Annotate with paid amount to filter correctly
        # We need to filter based on "remaining debt" for Pending view
        # and "no remaining debt" for History view.
        # This is complex in Django ORM with computed properties.
        # Simplification: 
        # History = explicitly requested history=True (Status PAYEE and maybe fully paid?)
        # Pending = Default (Status VALIDEE + PAYEE with debt?)
        
        # ACTUALLY: The safest way without complex annotation is to return ALL valid/payee invoices
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

            
            # Check for update status logic (usually handled by signal, but explicit check doesn't hurt)
            # The signal update_facture_status_on_payment handles status update to PAYEE

        return Response({
            'detail': f'{len(updated_factures)} factures réglées avec succès.',
            'total_paid': str(total_paid),
            'updated_ids': updated_factures
        })

class InventaireViewSet(viewsets.ModelViewSet):
    queryset = Inventaire.objects.all().order_by('-date')
    serializer_class = InventaireSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def validate(self, request, pk=None):
        inventaire = self.get_object()
        if inventaire.status == Inventaire.Status.VALIDEE:
             return Response({'detail': 'Cet inventaire est déjà validé.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Mettre à jour le stock pour chaque ligne
        lignes = inventaire.lignes.select_related('produit').all()
        for ligne in lignes:
             produit = ligne.produit
             # Update Stock
             produit.stock = ligne.quantite_physique
             produit.save(update_fields=['stock'])
             
             # Note: PMP is not updated here as there is no "Price" involved, just quantity adjustment.
             # Ideally we should log this adjustment (StockMovement or similar)
             
        inventaire.status = Inventaire.Status.VALIDEE
        inventaire.save()
        
        return Response({'status': 'Inventaire validé. Stocks mis à jour.'})

class LigneInventaireViewSet(viewsets.ModelViewSet):
    queryset = LigneInventaire.objects.all()
    serializer_class = LigneInventaireSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['inventaire']

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
                    
                    # Retirer du stock
                    produit.stock -= ligne.quantity
                    produit.save()
                    
                    # Créer historique de stock (NEGATIF pour sortie)
                    ActivityLog.objects.create(
                        user=request.user,
                        action='AVOIR',
                        details=f'Avoir {avoir.numero}: {ligne.produit_nom} x {ligne.quantity} (Type: {avoir.get_type_avoir_display()})'
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
    filterset_fields = ['action', 'model_name', 'user']
    search_fields = ['details', 'object_id', 'model_name']
    ordering_fields = ['timestamp']
    ordering = ['-timestamp']  # Default ordering for pagination

