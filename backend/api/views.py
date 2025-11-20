from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from django.db import transaction
from django.db.models import F
from django.http import HttpResponse
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import BaseDocTemplate, Frame, Paragraph, PageBreak, PageTemplate, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Count, Q
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth.models import User
from .filters import ProduitFilter
from .models import (
    Produit, Rayon, Fournisseur, Client, Commande, CommandeProduit, Facture, FactureProduit, Caisse
)
from .serializers import (
    ProduitSerializer, RayonSerializer, FournisseurSerializer,
    ClientSerializer, CommandeSerializer, CommandeProduitSerializer,
    FactureSerializer, FactureProduitSerializer, CaisseSerializer,
    UserSerializer # Assuming PaiementSerializer is not needed for this specific change, but UserSerializer is.
)
from decimal import Decimal

# Create your views here.

class CustomAuthToken(ObtainAuthToken):
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
            'allowed_menus': user.profile.allowed_menus if hasattr(user, 'profile') else []
        })

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser] # Only admin can manage users

class ProduitViewSet(viewsets.ModelViewSet):
    """
    API endpoint for products.
    """
    queryset = Produit.objects.all().order_by('-created_at')
    serializer_class = ProduitSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_class = ProduitFilter
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
                'libelle': f"Facture #{sortie.facture.numero_facture or sortie.facture.id} - {sortie.facture.client.name}",
                'prix_unitaire': sortie.selling_price
            })
            
        # Trier par date décroissante (le plus récent en premier)
        transactions.sort(key=lambda x: x['date'], reverse=True)
        
        # 4. Reconstruire l'historique du stock (en remontant le temps)
        current_stock = produit.stock
        history = []
        
        running_stock = current_stock
        
        for trans in transactions:
            stock_after = running_stock
            
            if trans['type'] == 'ENTREE':
                # Si c'était une entrée, on avait MOINS avant
                stock_before = running_stock - trans['quantity']
            else: # SORTIE
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

class RayonViewSet(viewsets.ModelViewSet):
    """API endpoint for rayons."""
    queryset = Rayon.objects.all().order_by('name')
    serializer_class = RayonSerializer

class FournisseurViewSet(viewsets.ModelViewSet):
    """API endpoint for fournisseurs."""
    queryset = Fournisseur.objects.all().order_by('name')
    serializer_class = FournisseurSerializer

class ClientViewSet(viewsets.ModelViewSet):
    """API endpoint for clients."""
    queryset = Client.objects.all().order_by('name')
    serializer_class = ClientSerializer

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
    queryset = Commande.objects.all().order_by('-date')
    serializer_class = CommandeSerializer

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cloturer(self, request, pk=None):
        """
        Clôture une commande et met à jour le stock des produits.
        """
        commande = self.get_object()
        if commande.status == Commande.Status.CLOTUREE:
            return Response({'detail': 'Cette commande est déjà clôturée.'}, status=status.HTTP_400_BAD_REQUEST)

        # Mettre à jour le stock pour chaque produit dans la commande
        for item in commande.produits.all():
            produit = item.produit
            produit.stock = F('stock') + item.quantity
            produit.save(update_fields=['stock'])

        # Changer le statut de la commande
        commande.status = Commande.Status.CLOTUREE
        commande.save(update_fields=['status'])

        return Response({'status': 'Commande clôturée et stock mis à jour.'})

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

    def perform_create(self, serializer):
        selling_price = serializer.validated_data.pop('selling_price', None)
        commande_produit = serializer.save()
        if selling_price is not None:
            produit = commande_produit.produit
            produit.selling_price = selling_price
            produit.save(update_fields=['selling_price'])


class FactureViewSet(viewsets.ModelViewSet):
    """API endpoint for factures."""
    queryset = Facture.objects.all().order_by('-date')
    serializer_class = FactureSerializer

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def valider(self, request, pk=None):
        """
        Valide une facture et met à jour le stock des produits.
        """
        facture = self.get_object()
        if facture.status == Facture.Status.VALIDEE:
            return Response({'detail': 'Cette facture est déjà validée.'}, status=status.HTTP_400_BAD_REQUEST)

        # Récupère et verrouille les lignes de facture + produits pour éviter les conditions de concurrence
        items = FactureProduit.objects.select_for_update().select_related('produit').filter(facture=facture)

        # Vérifier le stock avant validation (comparaisons en Decimal)
        # Les quantités négatives sont autorisées (retours de produits)
        for item in items:
            produit = item.produit
            try:
                qty = Decimal(str(item.quantity))
                stock = Decimal(str(produit.stock))
            except Exception:
                return Response({'detail': f'Impossible de comparer les quantités pour le produit {produit.id}.'}, status=status.HTTP_400_BAD_REQUEST)

            # Seulement vérifier le stock si la quantité est positive (vente)
            # Les quantités négatives (retours) sont autorisées et augmenteront le stock
            if qty > 0 and stock < qty:
                return Response(
                    {'detail': f'Stock insuffisant pour le produit {produit.name}. Stock disponible: {stock}, Quantité demandée: {qty}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Mettre à jour le stock (opération atomique au niveau DB)
        # Si quantity est négatif, cela augmente le stock (retour)
        # Si quantity est positif, cela diminue le stock (vente)
        for item in items:
            Produit.objects.filter(pk=item.produit.pk).update(stock=F('stock') - item.quantity)

        # Changer le statut de la facture et générer un numéro si besoin
        facture.status = Facture.Status.VALIDEE
        if not facture.numero_facture:
            facture.numero_facture = f"FAC-{facture.id:06d}"
        facture.save(update_fields=['status', 'numero_facture'])

        # Rafraîchir et sérialiser la facture
        facture.refresh_from_db()
        serializer = self.get_serializer(facture)
        return Response(serializer.data)

    @action(detail=False, methods=['delete'])
    @transaction.atomic
    def supprimer_brouillons(self, request):
        """
        Supprime toutes les factures en statut brouillon.
        """
        brouillons = Facture.objects.filter(status=Facture.Status.BROUILLON)
        count = brouillons.count()
        brouillons.delete()
        return Response({
            'detail': f'{count} facture(s) brouillon supprimée(s) avec succès.',
            'count': count
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
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
                        return Response({'detail': f'Format de date/heure invalide pour date_fin: {date_fin_str}. Utilisez YYYY-MM-DDTHH:MM ou YYYY-MM-DDTHH:MM:SS'}, status=status.HTTP_400_BAD_REQUEST)
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
        
        return Response({
            'date_debut': start_datetime.strftime('%Y-%m-%d %H:%M'),
            'date_fin': end_datetime.strftime('%Y-%m-%d %H:%M'),
            'tranche': f"{start_datetime.strftime('%d-%m-%Y %Hh%M')} - {end_datetime.strftime('%d-%m-%Y %Hh%M')}",
            'nombre_factures': nombre_factures,
            'total_ht': str(total_ht_final.quantize(Decimal('0.01'))),  # Total HT après remise (sur lequel la TVA est calculée)
            'total_tva': str(total_tva.quantize(Decimal('0.01'))),
            'total_ttc': str(total_ttc.quantize(Decimal('0.01'))),
            'sous_total_ht': str(total_ht.quantize(Decimal('0.01'))),  # Sous-total avant remise
            'total_remise': str(total_remise.quantize(Decimal('0.01'))),  # Total des remises
            'debug': {
                'date_debut_parsed': start_datetime.isoformat(),
                'date_fin_parsed': end_datetime.isoformat(),
                'factures_ids': [f.id for f in factures[:10]],  # Limiter à 10 pour éviter une réponse trop grande
                'sous_total_ht': str(total_ht),
                'total_remise': str(total_remise),
                'total_ht_apres_remise': str(total_ht_apres_remise)
            }
        }, status=status.HTTP_200_OK)

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
            "client_name": facture.client.name,
            "client_address": facture.client.address,
            "client_phone": facture.client.phone,
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


class CaisseViewSet(viewsets.ModelViewSet):
    """API endpoint for caisse (paiements)."""
    queryset = Caisse.objects.select_related('facture', 'facture__client').order_by('-date_paiement')
    serializer_class = CaisseSerializer
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ['facture', 'mode_paiement', 'statut']


class DashboardViewSet(viewsets.ViewSet):
    """
    API endpoint for dashboard statistics.
    """
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Returns dashboard statistics: revenue, sales count, new clients, low stock.
        """
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
        
        return Response({
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
            }
        })

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
        low_stock_products = Produit.objects.filter(stock__lte=5).order_by('stock')[:limit]
        
        data = []
        for product in low_stock_products:
            data.append({
                'id': product.id,
                'name': product.name,
                'stock': product.stock
            })
            
        return Response(data)
