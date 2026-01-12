"""
ViewSet pour le système d'ordonnancier de la pharmacie.
Gère le registre des médicaments délivrés sur ordonnance.
"""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from django.db.models import Q
from django.utils import timezone
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
import io

from .models import Ordonnancier, LigneOrdonnancier, Produit
from .serializers import OrdonnancierSerializer, OrdonnancierCreateSerializer


class OrdonnancierViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer l'ordonnancier de la pharmacie.
    
    Actions disponibles:
    - list: Liste toutes les entrées de l'ordonnancier
    - retrieve: Détail d'une entrée
    - create: Créer une nouvelle entrée
    - export_pdf: Exporter l'ordonnancier en PDF
    """
    queryset = Ordonnancier.objects.all().prefetch_related('lignes', 'lignes__produit')
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['patient_nom', 'prescripteur_nom', 'lignes__produit_nom']
    ordering_fields = ['numero_ordre', 'date_delivrance', 'patient_nom', 'prescripteur_nom']
    ordering = ['-numero_ordre']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return OrdonnancierCreateSerializer
        return OrdonnancierSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filtres par date
        date_debut = self.request.query_params.get('date_debut')
        date_fin = self.request.query_params.get('date_fin')
        
        if date_debut:
            try:
                date_debut = datetime.strptime(date_debut, '%Y-%m-%d')
                queryset = queryset.filter(date_delivrance__date__gte=date_debut)
            except ValueError:
                pass
        
        if date_fin:
            try:
                date_fin = datetime.strptime(date_fin, '%Y-%m-%d')
                queryset = queryset.filter(date_delivrance__date__lte=date_fin)
            except ValueError:
                pass
        
        # Filtre par patient
        patient = self.request.query_params.get('patient')
        if patient:
            queryset = queryset.filter(patient_nom__icontains=patient)
        
        # Filtre par prescripteur
        prescripteur = self.request.query_params.get('prescripteur')
        if prescripteur:
            queryset = queryset.filter(prescripteur_nom__icontains=prescripteur)
        
        # Filtre par produit
        produit = self.request.query_params.get('produit')
        if produit:
            queryset = queryset.filter(
                Q(lignes__produit_nom__icontains=produit) |
                Q(lignes__produit__name__icontains=produit)
            ).distinct()
        
        # Filtre par catégorie de surveillance
        surveillance = self.request.query_params.get('surveillance')
        if surveillance and surveillance != 'NONE':
            queryset = queryset.filter(lignes__surveillance_category=surveillance).distinct()
        
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(enregistre_par=self.request.user)
    
    @action(detail=False, methods=['get'])
    def export_pdf(self, request):
        """Exporter l'ordonnancier en PDF"""
        queryset = self.get_queryset()
        
        # Limiter pour la lisibilité
        limit = int(request.query_params.get('limit', 100))
        entries = queryset[:limit]
        
        # Créer le PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, 
                                leftMargin=15*mm, rightMargin=15*mm,
                                topMargin=15*mm, bottomMargin=15*mm)
        
        elements = []
        styles = getSampleStyleSheet()
        
        # Titre
        title_style = ParagraphStyle(
            'Title',
            parent=styles['Heading1'],
            fontSize=16,
            alignment=1,
            spaceAfter=10*mm
        )
        elements.append(Paragraph("📋 ORDONNANCIER", title_style))
        
        # Info période
        date_info = f"Généré le {timezone.now().strftime('%d/%m/%Y à %H:%M')}"
        date_debut = request.query_params.get('date_debut', '')
        date_fin = request.query_params.get('date_fin', '')
        if date_debut or date_fin:
            date_info += f" | Période: {date_debut or '...'} → {date_fin or '...'}"
        elements.append(Paragraph(date_info, styles['Normal']))
        elements.append(Spacer(1, 5*mm))
        
        # Tableau
        data = [['N°', 'Date', 'Patient', 'Prescripteur', 'Médicaments', 'Surv.']]
        
        for entry in entries:
            medicaments = ", ".join([f"{l.produit_nom} x{l.quantite}" for l in entry.lignes.all()])
            surv = any(l.surveillance_category != 'NONE' for l in entry.lignes.all())
            
            data.append([
                str(entry.numero_ordre),
                entry.date_delivrance.strftime('%d/%m/%Y'),
                entry.patient_nom[:20] + '...' if len(entry.patient_nom) > 20 else entry.patient_nom,
                entry.prescripteur_nom[:15] + '...' if len(entry.prescripteur_nom) > 15 else entry.prescripteur_nom,
                medicaments[:40] + '...' if len(medicaments) > 40 else medicaments,
                '⚠️' if surv else ''
            ])
        
        table = Table(data, colWidths=[25*mm, 25*mm, 35*mm, 30*mm, 50*mm, 15*mm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#007B3C')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f0f0')]),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ]))
        
        elements.append(table)
        
        # Footer
        elements.append(Spacer(1, 10*mm))
        footer_text = f"Total: {len(entries)} entrée(s)"
        if len(entries) >= limit:
            footer_text += f" (limité à {limit})"
        elements.append(Paragraph(footer_text, styles['Normal']))
        
        doc.build(elements)
        
        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="ordonnancier_{timezone.now().strftime("%Y%m%d")}.pdf"'
        
        return response
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Statistiques de l'ordonnancier"""
        queryset = self.get_queryset()
        
        total_entries = queryset.count()
        total_medicaments = sum(entry.lignes.count() for entry in queryset[:1000])
        
        # Top prescripteurs
        from django.db.models import Count
        top_prescripteurs = (
            Ordonnancier.objects.values('prescripteur_nom')
            .annotate(count=Count('numero_ordre'))
            .order_by('-count')[:5]
        )
        
        # Médicaments sous surveillance
        surveillance_count = LigneOrdonnancier.objects.exclude(surveillance_category='NONE').count()
        
        return Response({
            'total_entries': total_entries,
            'total_medicaments': total_medicaments,
            'surveillance_count': surveillance_count,
            'top_prescripteurs': list(top_prescripteurs)
        })
