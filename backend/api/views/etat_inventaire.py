# -*- coding: utf-8 -*-
"""
État d'inventaire API - Génère des PDF d'états d'inventaire groupés par forme, rayon ou groupe.
Colonnes: ID, CIP1, Libellé, Stock, Prix de Vente, avec lignes par lot si multi-lots.
"""
import io
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.http import HttpResponse

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from ..models import Produit, Rayon, Forme, Groupe, StockLot


class EtatInventairePDFView(APIView):
    """
    Génère un PDF d'état d'inventaire groupé par forme, rayon ou groupe.
    
    GET /api/produits/etat-inventaire/pdf/
    Paramètres:
        - group_by: FORME | RAYON | GROUPE (requis)
        - stock_display: MACHINE | ZERO (défaut: MACHINE)
    
    Colonnes: ID | CIP1 | Libellé | Stock | Prix Vente | Qté Physique
    Si multi-lots: une ligne par lot avec le numéro de lot
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        group_by = request.query_params.get('group_by', '').upper()
        stock_display = request.query_params.get('stock_display', 'MACHINE').upper()
        filter_id = request.query_params.get('filter_id', None)

        if group_by not in ['FORME', 'RAYON', 'GROUPE']:
            return Response(
                {'error': 'Paramètre group_by invalide. Valeurs possibles: FORME, RAYON, GROUPE'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Récupérer tous les produits actifs avec leurs lots
        produits = Produit.objects.filter(is_active=True).select_related(
            'rayon', 'forme', 'groupe'
        ).prefetch_related('stock_lots').order_by('name')
        
        # Filtrer par entité spécifique si filter_id est fourni
        filter_name = None
        if filter_id:
            try:
                filter_id = int(filter_id)
                if group_by == 'RAYON':
                    produits = produits.filter(rayon_id=filter_id)
                    rayon = Rayon.objects.get(id=filter_id)
                    filter_name = rayon.name
                elif group_by == 'FORME':
                    produits = produits.filter(forme_id=filter_id)
                    forme = Forme.objects.get(id=filter_id)
                    filter_name = forme.nom
                elif group_by == 'GROUPE':
                    produits = produits.filter(groupe_id=filter_id)
                    groupe = Groupe.objects.get(id=filter_id)
                    filter_name = groupe.nom
            except (ValueError, Rayon.DoesNotExist, Forme.DoesNotExist, Groupe.DoesNotExist):
                pass  # Ignorer le filtre invalide

        # Grouper les produits
        grouped_data = {}
        
        for produit in produits:
            if group_by == 'FORME':
                key = produit.forme.nom if produit.forme else 'Sans Forme'
            elif group_by == 'RAYON':
                key = produit.rayon.name if produit.rayon else 'Sans Rayon'
            elif group_by == 'GROUPE':
                key = produit.groupe.nom if produit.groupe else 'Sans Groupe'
            
            if key not in grouped_data:
                grouped_data[key] = []
            
            # Récupérer les lots actifs (avec stock restant > 0)
            lots = list(produit.stock_lots.filter(quantity_remaining__gt=0).order_by('date_expiration'))
            
            if len(lots) > 1:
                # Multi-lots: une ligne par lot
                for lot in lots:
                    grouped_data[key].append({
                        'id': produit.id,
                        'cip1': produit.cip1 or '-',
                        'name': produit.name,
                        'lot_numero': lot.lot or '-',
                        'stock': lot.quantity_remaining if stock_display == 'MACHINE' else 0,
                        'selling_price': float(produit.selling_price) if produit.selling_price else 0,
                        'is_lot_line': True,
                    })
            else:
                # Pas de lot ou un seul lot: une seule ligne avec le stock du produit
                grouped_data[key].append({
                    'id': produit.id,
                    'cip1': produit.cip1 or '-',
                    'name': produit.name,
                    'lot_numero': lots[0].lot if lots else '-',
                    'stock': produit.stock if stock_display == 'MACHINE' else 0,
                    'selling_price': float(produit.selling_price) if produit.selling_price else 0,
                    'is_lot_line': False,
                })

        # Trier les groupes alphabétiquement
        sorted_groups = sorted(grouped_data.keys())

        # Support du format JSON pour l'impression frontend
        if request.query_params.get('format', '').lower() == 'json':
            return Response({
                'title': f"ÉTAT D'INVENTAIRE PAR {group_by}",
                'filter_name': filter_name,
                'group_label': group_by,
                'stock_label': 'Stock Machine' if stock_display == 'MACHINE' else 'Stock à Zéro',
                'date': datetime.now().isoformat(),
                'groups': {g: grouped_data[g] for g in sorted_groups}
            })

        # Générer le PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=A4,
            topMargin=15*mm,
            bottomMargin=15*mm,
            leftMargin=8*mm,
            rightMargin=8*mm
        )

        story = []
        styles = getSampleStyleSheet()
        
        # Style personnalisé pour le titre
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=14,
            spaceAfter=6*mm
        )
        
        # Style pour les titres de groupe
        group_style = ParagraphStyle(
            'GroupStyle',
            parent=styles['Heading2'],
            fontSize=11,
            spaceBefore=4*mm,
            spaceAfter=2*mm,
            textColor=colors.darkblue
        )
        
        # Style compact
        small_style = ParagraphStyle(
            'SmallStyle',
            parent=styles['Normal'],
            fontSize=7
        )
        
        # Style pour les lignes de lot (légèrement plus petit)
        lot_style = ParagraphStyle(
            'LotStyle',
            parent=styles['Normal'],
            fontSize=6,
            textColor=colors.grey
        )

        # En-tête
        group_label = {'FORME': 'FORME', 'RAYON': 'RAYON', 'GROUPE': 'GROUPE'}[group_by]
        stock_label = 'Stock Machine' if stock_display == 'MACHINE' else 'Stock à Zéro'
        
        from datetime import datetime
        date_str = datetime.now().strftime('%d/%m/%Y à %H:%M')
        
        # Titre avec filtre si applicable
        if filter_name:
            story.append(Paragraph(f"ÉTAT D'INVENTAIRE - {group_label}: {filter_name}", title_style))
        else:
            story.append(Paragraph(f"ÉTAT D'INVENTAIRE PAR {group_label}", title_style))
        story.append(Paragraph(f"Option: {stock_label} | Imprimé le {date_str}", small_style))
        story.append(Spacer(1, 5*mm))

        # Tableau par groupe
        for group_name in sorted_groups:
            items = grouped_data[group_name]
            
            # Trier les lignes alphabétiquement par nom
            items.sort(key=lambda x: (x['name'].lower(), x.get('lot_numero', '')))
            
            # Compter les produits uniques
            unique_products = len(set(item['id'] for item in items))
            story.append(Paragraph(f"<b>{group_name}</b> ({unique_products} produits)", group_style))
            
            # Données du tableau
            table_data = [['ID', 'CIP1', 'Libellé', 'Lot', 'Stock', 'PV', 'Qté Physique']]
            
            for item in items:
                # Pour les lignes de lot, afficher le lot en évidence
                if item['is_lot_line']:
                    name_display = Paragraph(f"  ↳ {item['name'][:35]}", lot_style)
                else:
                    name_display = Paragraph(item['name'][:40], small_style)
                
                table_data.append([
                    str(item['id']),
                    item['cip1'],
                    name_display,
                    item['lot_numero'][:10] if item['lot_numero'] else '-',
                    str(item['stock']),
                    f"{item['selling_price']:.0f}",
                    ''  # Colonne vide pour saisie manuelle
                ])
            
            # Créer le tableau avec les nouvelles colonnes
            # ID | CIP1 | Libellé | Lot | Stock | PV | Qté Physique
            col_widths = [12*mm, 25*mm, 70*mm, 22*mm, 15*mm, 18*mm, 25*mm]
            table = Table(table_data, colWidths=col_widths)
            table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 7),
                ('FONTSIZE', (0, 1), (-1, -1), 7),
                ('GRID', (0, 0), (-1, -1), 0.25, colors.black),
                ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.9, 0.9, 0.9)),
                ('ALIGN', (0, 0), (0, -1), 'CENTER'),  # ID
                ('ALIGN', (3, 0), (-1, -1), 'CENTER'),  # Lot, Stock, PV, Qté alignés au centre
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 2),
                ('RIGHTPADDING', (0, 0), (-1, -1), 2),
                ('TOPPADDING', (0, 0), (-1, -1), 2),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ]))
            
            story.append(table)
            story.append(Spacer(1, 3*mm))

        # Construire le PDF
        doc.build(story)
        
        # Préparer la réponse
        pdf = buffer.getvalue()
        buffer.close()
        
        response = HttpResponse(content_type='application/pdf')
        filename = f"etat_inventaire_{group_by.lower()}_{stock_display.lower()}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response.write(pdf)
        
        return response
