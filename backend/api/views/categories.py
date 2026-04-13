import io
from datetime import datetime
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django.db.models import Q
from django.http import HttpResponse

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import BaseDocTemplate, Frame, Paragraph, PageTemplate, Table, TableStyle, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from ..models import Rayon, Produit
from ..serializers import RayonSerializer
from ..pagination import StandardResultsSetPagination

class CategorieViewSet(viewsets.ModelViewSet):
    """API endpoint for categories (rayons) - Fresh implementation."""
    queryset = Rayon.objects.all().order_by('name')
    serializer_class = RayonSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

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
        filename = f"stock_{rayon.name}_{datetime.now().strftime('%Y%m%d')}.pdf"
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
