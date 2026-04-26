from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum, F, DecimalField, Q, Count, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import datetime, timedelta, time
import csv
from decimal import Decimal
import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from django.http import HttpResponse
from io import BytesIO
from api.models import Facture, FactureProduit, FactureProduitAllocation, Caisse
from django.db.models import OuterRef, Exists


def _write_pharma_header(ws, PharmacySettings, title: str) -> None:
    """Écrit un en-tête pharmacie (nom, adresse, téléphone, date d'édition, titre) dans la feuille Excel."""
    from django.utils import timezone as tz
    try:
        pharmacy = PharmacySettings.objects.get(pk=1)
        pharma_name = pharmacy.pharmacy_name or "ZENITH"
        pharma_address = f"{pharmacy.address} - {pharmacy.city}".strip(" -") if (pharmacy.address or pharmacy.city) else ""
        pharma_phone = f"Tél : {pharmacy.phone}" if pharmacy.phone else ""
    except Exception:
        pharma_name, pharma_address, pharma_phone = "ZENITH", "", ""

    now_str = tz.localtime(tz.now()).strftime("%d/%m/%Y à %H:%M")
    for line in [pharma_name, pharma_address, pharma_phone, f"Édité le : {now_str}", "", title]:
        ws.append([line])
    ws.append([])  # ligne vide avant le tableau


class RapportFinanceMixin:
    """
    Rapports financiers, comptables et analyse de TVA.
    """
    
    @action(detail=False, methods=['get'])
    def rapport_mensuel(self, request):
        mois = request.query_params.get('mois')
        if not mois: return Response({'detail': 'Mois requis'}, status=400)
        try:
            date_debut = timezone.make_aware(datetime.strptime(f"{mois}-01", '%Y-%m-%d'))
            date_fin = (date_debut + timedelta(days=32)).replace(day=1)
        except: return Response({'detail': 'Format mois invalide'}, status=400)
        return Response(self._get_rapport_data(date_debut, date_fin, mois))

    @action(detail=False, methods=['get'])
    def rapport_par_dates(self, request):
        """Rapport complet sur une tranche de dates arbitraire (jour, semaine, plage personnalisée)."""
        date_debut_str = request.query_params.get('date_debut')
        date_fin_str = request.query_params.get('date_fin')
        if not date_debut_str or not date_fin_str:
            return Response({'detail': 'date_debut et date_fin requis'}, status=400)
        try:
            date_debut = timezone.make_aware(datetime.combine(
                datetime.strptime(date_debut_str, '%Y-%m-%d').date(), time.min
            ))
            date_fin = timezone.make_aware(datetime.combine(
                datetime.strptime(date_fin_str, '%Y-%m-%d').date(), time.max
            ))
            # Ensure date_fin is end-of-day by pushing to next day midnight for lt queries
            date_fin_exclusive = timezone.make_aware(datetime.combine(
                datetime.strptime(date_fin_str, '%Y-%m-%d').date() + timedelta(days=1), time.min
            ))
        except Exception:
            return Response({'detail': 'Format de date invalide (YYYY-MM-DD attendu)'}, status=400)

        label = f"{date_debut_str} → {date_fin_str}"
        data = self._get_rapport_data(date_debut, date_fin_exclusive, label)
        data['date_debut'] = date_debut_str
        data['date_fin'] = date_fin_str
        return Response(data)

    @action(detail=False, methods=['get'])
    def rapport_par_dates_pdf(self, request):
        """PDF du rapport sur une tranche de dates arbitraire."""
        date_debut_str = request.query_params.get('date_debut')
        date_fin_str = request.query_params.get('date_fin')
        if not date_debut_str or not date_fin_str:
            return Response({'detail': 'date_debut et date_fin requis'}, status=400)
        try:
            date_debut = timezone.make_aware(datetime.combine(
                datetime.strptime(date_debut_str, '%Y-%m-%d').date(), time.min
            ))
            date_fin_exclusive = timezone.make_aware(datetime.combine(
                datetime.strptime(date_fin_str, '%Y-%m-%d').date() + timedelta(days=1), time.min
            ))
        except Exception:
            return Response({'detail': 'Format de date invalide'}, status=400)

        label = f"{date_debut_str} → {date_fin_str}"
        data = self._get_rapport_data(date_debut, date_fin_exclusive, label)
        title = f"RAPPORT D'ACTIVITÉ — {date_debut_str} au {date_fin_str}"
        filename = f"rapport_{date_debut_str}_{date_fin_str}.pdf"
        return self._build_rapport_pdf(data, title, filename)

    @action(detail=False, methods=['get'])
    def rapport_mensuel_pdf(self, request):
        from api.pdf_utils import get_pharma_styles, draw_pharma_header, format_currency, PharmaColors
        mois = request.query_params.get('mois')
        if not mois: return Response({'detail': 'Mois requis'}, status=400)
        date_debut = timezone.make_aware(datetime.strptime(f"{mois}-01", '%Y-%m-%d'))
        date_fin = (date_debut + timedelta(days=32)).replace(day=1)
        data = self._get_rapport_data(date_debut, date_fin, mois)
        title = f"RAPPORT MENSUEL — {mois}"
        filename = f"rapport_{mois}.pdf"
        return self._build_rapport_pdf(data, title, filename)

    def _build_rapport_pdf(self, data, title_text, filename):
        """Construit un PDF A4 complet et bien disposé avec toutes les sections du rapport."""
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import cm, mm
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
        from api.pdf_utils import get_pharma_styles, draw_pharma_header, draw_pharma_footer, format_currency, PharmaColors

        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=12*mm, leftMargin=12*mm, topMargin=28*mm, bottomMargin=18*mm)
        story = []
        styles = get_pharma_styles()
        W = doc.width  # largeur utile ≈ 186mm

        # -- Styles compacts --
        s_section = ParagraphStyle('SectionTitle', parent=styles['Heading2'], fontSize=11, textColor=PharmaColors.GREEN_DARK, fontName='Helvetica-Bold', spaceBefore=10, spaceAfter=4)
        s_cell = ParagraphStyle('Cell', fontSize=7, fontName='Helvetica', leading=9, textColor=PharmaColors.TEXT)
        s_cell_b = ParagraphStyle('CellBold', fontSize=7, fontName='Helvetica-Bold', leading=9, textColor=PharmaColors.TEXT)
        s_cell_r = ParagraphStyle('CellRight', fontSize=7, fontName='Helvetica-Bold', leading=9, textColor=PharmaColors.TEXT, alignment=TA_RIGHT)
        s_header = ParagraphStyle('THeader', fontSize=7, fontName='Helvetica-Bold', leading=9, textColor=colors.white)
        s_header_r = ParagraphStyle('THeaderR', fontSize=7, fontName='Helvetica-Bold', leading=9, textColor=colors.white, alignment=TA_RIGHT)

        def compact_table_style():
            return TableStyle([
                ('BACKGROUND', (0,0), (-1,0), PharmaColors.GREEN),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('FONTSIZE', (0,0), (-1,-1), 7),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                ('LEFTPADDING', (0,0), (-1,-1), 4),
                ('RIGHTPADDING', (0,0), (-1,-1), 4),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, PharmaColors.GRAY_LIGHTER]),
                ('GRID', (0,0), (-1,-1), 0.3, PharmaColors.GRAY),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ])

        # =====================================================================
        # TITRE
        # =====================================================================
        story.append(Paragraph(f"<b>{title_text}</b>", styles['Title']))
        story.append(Spacer(1, 2*mm))

        # =====================================================================
        # 1. KPIs — barre horizontale compacte
        # =====================================================================
        kpi_items = [
            ('CA TTC', format_currency(data['ca']['ca_ttc'])),
            ('CA HT', format_currency(data['ca']['ca_ht'])),
            ('Marge Brute', format_currency(data['marge']['marge_brute'])),
            (f"Marge %", f"{data['marge']['marge_pct']}%"),
            ('Remises', format_currency(data['ca']['total_remises'])),
            ('Nb Ventes', str(data['ca']['nb_ventes'])),
        ]
        kpi_header = [[Paragraph(f"<b>{k}</b>", s_header) for k, _ in kpi_items]]
        kpi_values = [[Paragraph(f"<b>{v}</b>", ParagraphStyle('KpiVal', fontSize=9, fontName='Helvetica-Bold', leading=11, textColor=PharmaColors.GREEN_DARK, alignment=TA_CENTER)) for _, v in kpi_items]]
        kw = W / len(kpi_items)
        t_kpi = Table(kpi_header + kpi_values, colWidths=[kw]*len(kpi_items))
        t_kpi.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), PharmaColors.GREEN),
            ('BACKGROUND', (0,1), (-1,1), PharmaColors.GREEN_LIGHT),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('BOX', (0,0), (-1,-1), 1, PharmaColors.GREEN),
            ('INNERGRID', (0,0), (-1,-1), 0.3, PharmaColors.GREEN),
        ]))
        story.append(t_kpi)
        story.append(Spacer(1, 4*mm))

        # =====================================================================
        # 2. DEUX COLONNES: Encaissements (gauche) + Achats Fournisseurs (droite)
        # =====================================================================
        half_w = (W - 4*mm) / 2

        # -- Encaissements --
        enc_rows = [[Paragraph('<b>Mode</b>', s_header), Paragraph('<b>Montant</b>', s_header_r)]]
        for e in data.get('encaissements', []):
            montant = float(e.get('montant', 0))
            if montant > 0:
                enc_rows.append([Paragraph(str(e.get('mode_label', '')), s_cell), Paragraph(format_currency(montant), s_cell_r)])
        # Dépôts
        if float(data.get('depots_total', 0)) > 0:
            enc_rows.append([Paragraph('Dépôts', s_cell), Paragraph(format_currency(data['depots_total']), s_cell_r)])
        # Sous-total
        total_enc = sum(float(e.get('montant', 0)) for e in data.get('encaissements', [])) + float(data.get('depots_total', 0))
        enc_rows.append([Paragraph('<b>Total Encaissements</b>', s_cell_b), Paragraph(f'<b>{format_currency(total_enc)}</b>', s_cell_r)])
        # Crédit / Coupons
        if float(data.get('ventes_credit', 0)) > 0:
            enc_rows.append([Paragraph('Ventes à crédit', s_cell), Paragraph(format_currency(data['ventes_credit']), s_cell_r)])
        if float(data.get('coupons_total', 0)) > 0:
            enc_rows.append([Paragraph('Coupons', s_cell), Paragraph(format_currency(data['coupons_total']), s_cell_r)])
        t_enc = Table(enc_rows, colWidths=[half_w*0.55, half_w*0.45])
        t_enc.setStyle(compact_table_style())

        # -- Achats fournisseurs --
        ach_rows = [[Paragraph('<b>Fournisseur</b>', s_header), Paragraph('<b>Cmd</b>', s_header_r), Paragraph('<b>Montant</b>', s_header_r)]]
        for f in data.get('achats_par_fournisseur', [])[:10]:
            ach_rows.append([
                Paragraph(str(f.get('fournisseur_nom', ''))[:30], s_cell),
                Paragraph(str(f.get('nb_commandes', 0)), s_cell_r),
                Paragraph(format_currency(f.get('montant_total', 0)), s_cell_r)
            ])
        if not data.get('achats_par_fournisseur'):
            ach_rows.append([Paragraph('Aucun achat', s_cell), Paragraph('-', s_cell_r), Paragraph('-', s_cell_r)])
        total_ach = sum(float(f.get('montant_total', 0)) for f in data.get('achats_par_fournisseur', []))
        ach_rows.append([Paragraph('<b>Total</b>', s_cell_b), Paragraph('', s_cell_r), Paragraph(f'<b>{format_currency(total_ach)}</b>', s_cell_r)])
        t_ach = Table(ach_rows, colWidths=[half_w*0.50, half_w*0.15, half_w*0.35])
        t_ach.setStyle(compact_table_style())

        # Assemblage deux colonnes
        story.append(Paragraph('<b>💰 Encaissements & Achats</b>', s_section))
        two_col = Table([[t_enc, t_ach]], colWidths=[half_w, half_w], hAlign='LEFT')
        two_col.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (0,0), 2*mm),
            ('LEFTPADDING', (1,0), (1,0), 2*mm),
        ]))
        story.append(two_col)
        story.append(Spacer(1, 4*mm))

        # =====================================================================
        # 3. DEUX COLONNES: Clients Pro (gauche) + UG (droite)
        # =====================================================================
        pro = data.get('clients_professionnels', {})

        # -- Clients Pro --
        pro_rows = [[Paragraph('<b>Client</b>', s_header), Paragraph('<b>CA</b>', s_header_r), Paragraph('<b>Reste</b>', s_header_r)]]
        for c in pro.get('top_clients', [])[:7]:
            pro_rows.append([
                Paragraph(str(c.get('client_nom', ''))[:25], s_cell),
                Paragraph(format_currency(c.get('ca_total', 0)), s_cell_r),
                Paragraph(format_currency(c.get('reste_a_payer', 0)), s_cell_r)
            ])
        # Totaux
        pro_rows.append([
            Paragraph(f"<b>Total ({pro.get('taux_recouvrement_pct', 0):.0f}% recouv.)</b>", s_cell_b),
            Paragraph(f"<b>{format_currency(pro.get('ca_total', 0))}</b>", s_cell_r),
            Paragraph(f"<b>{format_currency(pro.get('reste_a_payer', 0))}</b>", s_cell_r)
        ])
        t_pro = Table(pro_rows, colWidths=[half_w*0.45, half_w*0.28, half_w*0.27])
        t_pro.setStyle(compact_table_style())

        # -- Unités Gratuites --
        ug = data.get('unites_gratuites', {})
        ug_rows = [[Paragraph('<b>Produit</b>', s_header), Paragraph('<b>Qté</b>', s_header_r), Paragraph('<b>Valeur</b>', s_header_r)]]
        for p in ug.get('top_produits', [])[:7]:
            ug_rows.append([
                Paragraph(str(p.get('produit_nom', ''))[:25], s_cell),
                Paragraph(str(p.get('quantite_gratuite', 0)), s_cell_r),
                Paragraph(format_currency(p.get('valeur_totale', 0)), s_cell_r)
            ])
        ug_rows.append([
            Paragraph(f"<b>Total ({ug.get('pct_du_ca', 0):.1f}% CA)</b>", s_cell_b),
            Paragraph(f"<b>{ug.get('quantite_totale', 0)}</b>", s_cell_r),
            Paragraph(f"<b>{format_currency(ug.get('valeur_totale', 0))}</b>", s_cell_r)
        ])
        t_ug = Table(ug_rows, colWidths=[half_w*0.45, half_w*0.20, half_w*0.35])
        t_ug.setStyle(compact_table_style())

        story.append(Paragraph('<b>👥 Clients Professionnels & Unités Gratuites</b>', s_section))
        two_col2 = Table([[t_pro, t_ug]], colWidths=[half_w, half_w], hAlign='LEFT')
        two_col2.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (0,0), 2*mm),
            ('LEFTPADDING', (1,0), (1,0), 2*mm),
        ]))
        story.append(two_col2)
        story.append(Spacer(1, 4*mm))

        # =====================================================================
        # 4. DEUX COLONNES: TVA (gauche) + Créances + Mouvements Caisse (droite)
        # =====================================================================

        # -- CA par TVA --
        tva_rows = [[Paragraph('<b>Taux</b>', s_header), Paragraph('<b>CA HT</b>', s_header_r), Paragraph('<b>TVA</b>', s_header_r), Paragraph('<b>TTC</b>', s_header_r)]]
        for tva in data.get('ca_par_tva', []):
            tva_rows.append([
                Paragraph(f"{tva.get('taux', 0)}%", s_cell),
                Paragraph(format_currency(tva.get('ca_ht', 0)), s_cell_r),
                Paragraph(format_currency(tva.get('montant_tva', 0)), s_cell_r),
                Paragraph(format_currency(tva.get('ca_ttc', 0)), s_cell_r)
            ])
        t_tva = Table(tva_rows, colWidths=[half_w*0.20, half_w*0.27, half_w*0.26, half_w*0.27])
        t_tva.setStyle(compact_table_style())

        # -- Créances + Mouvements caisse (empilés) --
        mvts = data.get('mouvements_caisse', {})
        right_elements = []

        # Créances box
        creance_val = format_currency(data.get('creances_a_percevoir', 0))
        creance_data = [
            [Paragraph('<b>Créances à Percevoir</b>', s_header), Paragraph(f'<b>{creance_val}</b>', s_header_r)]
        ]
        t_cr = Table(creance_data, colWidths=[half_w*0.55, half_w*0.45])
        t_cr.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), PharmaColors.GREEN_LIGHT),
            ('BOX', (0,0), (-1,-1), 0.5, PharmaColors.GREEN),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 4),
            ('RIGHTPADDING', (0,0), (-1,-1), 4),
            ('TEXTCOLOR', (0,0), (-1,-1), PharmaColors.GREEN_DARK),
        ]))
        right_elements.append(t_cr)
        right_elements.append(Spacer(1, 2*mm))

        # Mouvements caisse résumé
        mvt_data = [
            [Paragraph('<b>Mouvements Caisse</b>', s_header), Paragraph('<b>Montant</b>', s_header_r)],
            [Paragraph('Entrées diverses', s_cell), Paragraph(format_currency(mvts.get('total_entrees', 0)), s_cell_r)],
            [Paragraph('Sorties diverses', s_cell), Paragraph(format_currency(mvts.get('total_sorties', 0)), s_cell_r)],
            [Paragraph('<b>Solde</b>', s_cell_b), Paragraph(f"<b>{format_currency(mvts.get('solde', 0))}</b>", s_cell_r)],
        ]
        t_mvt = Table(mvt_data, colWidths=[half_w*0.55, half_w*0.45])
        t_mvt.setStyle(compact_table_style())
        right_elements.append(t_mvt)

        # Stack right column
        right_table = Table([[e] for e in right_elements], colWidths=[half_w])
        right_table.setStyle(TableStyle([
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))

        story.append(Paragraph('<b>📊 TVA, Créances & Mouvements</b>', s_section))
        two_col3 = Table([[t_tva, right_table]], colWidths=[half_w, half_w], hAlign='LEFT')
        two_col3.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (0,0), 2*mm),
            ('LEFTPADDING', (1,0), (1,0), 2*mm),
        ]))
        story.append(two_col3)

        # =====================================================================
        # 5. Détails mouvements de caisse (si présents, sur la suite)
        # =====================================================================
        mvt_liste = mvts.get('liste', [])
        if mvt_liste:
            story.append(Spacer(1, 4*mm))
            story.append(Paragraph('<b>📋 Détail des Mouvements de Caisse</b>', s_section))
            mvt_detail_rows = [[
                Paragraph('<b>Date</b>', s_header),
                Paragraph('<b>Type</b>', s_header),
                Paragraph('<b>Motif</b>', s_header),
                Paragraph('<b>Utilisateur</b>', s_header),
                Paragraph('<b>Montant</b>', s_header_r),
            ]]
            for m in mvt_liste[:15]:
                date_str = str(m.get('date', ''))[:10]
                type_label = 'Entrée' if m.get('type') == 'ENTREE' else 'Sortie'
                sign = '+' if m.get('type') == 'ENTREE' else '-'
                mvt_detail_rows.append([
                    Paragraph(date_str, s_cell),
                    Paragraph(type_label, s_cell),
                    Paragraph(str(m.get('motif', ''))[:35], s_cell),
                    Paragraph(str(m.get('user', ''))[:15], s_cell),
                    Paragraph(f"{sign}{format_currency(m.get('montant', 0))}", s_cell_r),
                ])
            t_mvt_d = Table(mvt_detail_rows, colWidths=[W*0.13, W*0.10, W*0.37, W*0.18, W*0.22])
            t_mvt_d.setStyle(compact_table_style())
            story.append(t_mvt_d)

        # =====================================================================
        # BUILD
        # =====================================================================
        doc.build(story,
                  onFirstPage=lambda c, d: (draw_pharma_header(c, d, title="RAPPORT"), draw_pharma_footer(c, d)),
                  onLaterPages=lambda c, d: (draw_pharma_header(c, d, title="RAPPORT"), draw_pharma_footer(c, d)))
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response.write(buffer.getvalue())
        return response

    @action(detail=False, methods=['get'])
    def rapport_ca_multi_annuel(self, request):
        annees = [d.year for d in Facture.objects.filter(status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]).dates('date', 'year', order='DESC')]
        if not annees: return Response([])
        m_keys = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
        results = [{'Mois': k, '_index': i+1} for i, k in enumerate(m_keys)]
        totaux = {'Mois': 'total_general', '_index': 13}

        for annee in sorted(annees):
            at_tva, at_exo = Decimal('0.00'), Decimal('0.00')
            for m_idx in range(1, 13):
                date_debut = timezone.make_aware(datetime(annee, m_idx, 1))
                date_fin = (date_debut + timedelta(days=32)).replace(day=1)
                ca_tva, ca_exo_v = Decimal('0.00'), Decimal('0.00')
                for item in self._calculate_ca_par_tva(self._get_factures_periode(date_debut, date_fin)):
                    if item['taux'] > 0: ca_tva += item['ca_ttc']
                    else: ca_exo_v += item['ca_ttc']
                row = results[m_idx-1]
                row[f"{annee}_ca_tva"], row[f"{annee}_ca_exo"], row[f"{annee}_total"] = ca_tva, ca_exo_v, ca_tva + ca_exo_v
                at_tva += ca_tva; at_exo += ca_exo_v
            totaux[f"{annee}_ca_tva"], totaux[f"{annee}_ca_exo"], totaux[f"{annee}_total"] = at_tva, at_exo, at_tva + at_exo
        
        results.append(totaux); results.sort(key=lambda x: x['_index'])
        for r in results: del r['_index']
        return Response(results)

    @action(detail=False, methods=['get'])
    def rapport_tva_vendus(self, request):
        db_str, df_str = request.query_params.get('date_debut'), request.query_params.get('date_fin')
        if not db_str or not df_str: return Response({'error': 'Dates requises'}, status=400)
        try:
            date_debut, date_fin = timezone.make_aware(datetime.fromisoformat(db_str.replace('Z', '+00:00'))), timezone.make_aware(datetime.fromisoformat(df_str.replace('Z', '+00:00')))
            if date_fin.hour == 0: date_fin += timedelta(days=1)
        except: return Response({'error': 'Format de date invalide'}, status=400)

        lignes = FactureProduit.objects.filter(facture__date__range=(date_debut, date_fin), facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE], tva__gt=0).values('produit__name', 'produit__cip1', 'tva').annotate(total_qty=Sum('quantity'), total_ttc=Sum(F('quantity') * (F('selling_price') - F('discount')))).order_by('produit__name')
        data = []
        for l in lignes:
            tva, ttc = l['tva'] or 0, l['total_ttc'] or 0
            mt_tva = (ttc * tva) / (100 + tva) if tva > 0 else 0
            data.append({'produit': l['produit__name'], 'cip': l['produit__cip1'], 'quantite': l['total_qty'], 'taux_tva': f"{float(tva)} %", 'total_ttc': round(ttc, 0), 'montant_tva': round(mt_tva, 0)})
        return Response(data)

    @action(detail=False, methods=['get'])
    def export_comptable_csv(self, request):
        # Implementation of accounting CSV export
        db_str, df_str = request.query_params.get('date_debut'), request.query_params.get('date_fin')
        try:
            date_debut = timezone.make_aware(datetime.fromisoformat(db_str.replace('Z', '+00:00')))
            date_fin = timezone.make_aware(datetime.fromisoformat(df_str.replace('Z', '+00:00')))
            if date_fin.hour == 0: date_fin += timedelta(days=1)
        except: return Response({'error': 'Date invalide'}, status=status.HTTP_400_BAD_REQUEST)
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="export_comptable.csv"'; response.write(u'\ufeff'.encode('utf8'))
        writer = csv.writer(response, delimiter=';'); writer.writerow(['Date', 'Heure', 'Facture #', 'Client', 'Status', 'Total HT', 'Total TVA', 'Total TTC', 'Remise', 'Mode de Paiement', 'Caissier'])
        for f in Facture.objects.filter(date__range=(date_debut, date_fin), status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]).select_related('client', 'created_by').prefetch_related('paiements'):
            modes = ", ".join([dict(Caisse.MODES_PAIEMENT).get(m, m) for m in f.paiements.filter(statut='completee').values_list('mode_paiement', flat=True).distinct()])
            writer.writerow([f.date.strftime('%d/%m/%Y'), f.date.strftime('%H:%M'), f.numero_facture or f.id, f.client.name if f.client else 'Passage', f.get_status_display(), str(f.total_ht).replace('.', ','), str(f.total_tva).replace('.', ','), str(f.total_ttc).replace('.', ','), str(f.remise).replace('.', ','), modes, f.created_by.get_full_name() if f.created_by else 'Système'])
        return response

    @action(detail=False, methods=['get'])
    def rapport_remises(self, request):
        db_s, df_s = request.query_params.get('date_debut'), request.query_params.get('date_fin')
        try:
            date_debut = timezone.make_aware(datetime.combine(datetime.strptime(db_s, '%Y-%m-%d'), time.min))
            date_fin = timezone.make_aware(datetime.combine(datetime.strptime(df_s, '%Y-%m-%d'), time.max))
        except: return Response({"error": "Dates invalides"}, status=400)
        factures = Facture.objects.filter(status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE], date__gte=date_debut, date__lte=date_fin).select_related('validated_by')
        stats = factures.values('validated_by__id', 'validated_by__username', 'validated_by__first_name', 'validated_by__last_name').annotate(remise_globale=Coalesce(Sum('remise'), Decimal('0.00')), remise_fidelite=Coalesce(Sum('montant_fidelite'), Decimal('0.00')), ca_ttc=Coalesce(Sum('total_ttc'), Decimal('0.00')), nb_factures=Count('id')).order_by('-remise_globale')
        line_s = {s['facture__validated_by__id']: s['remise_lignes'] for s in FactureProduit.objects.filter(facture__in=factures).values('facture__validated_by__id').annotate(remise_lignes=Coalesce(Sum(F('discount') * F('quantity')), Decimal('0.00')))}
        res = []
        for s in stats:
            uid, rl = s['validated_by__id'], line_s.get(s['validated_by__id'], Decimal('0.00'))
            total = s['remise_globale'] + s['remise_fidelite'] + rl
            res.append({'user_id': uid, 'username': s['validated_by__username'], 'full_name': f"{s['validated_by__first_name'] or ''} {s['validated_by__last_name'] or ''}".strip(), 'nb_factures': s['nb_factures'], 'ca_ttc': s['ca_ttc'], 'remise_globale': s['remise_globale'], 'remise_lignes': rl, 'remise_fidelite': s['remise_fidelite'], 'total_remise': total, 'ratio_remise_pct': float(total / s['ca_ttc'] * 100) if s['ca_ttc'] > 0 else 0})
        return Response(res)

    @action(detail=False, methods=['get'])
    def rapport_remises_details(self, request):
        """Liste détaillée des factures avec remises sur la période."""
        db_s, df_s = request.query_params.get('date_debut'), request.query_params.get('date_fin')
        try:
            date_debut = timezone.make_aware(datetime.combine(datetime.strptime(db_s, '%Y-%m-%d'), time.min))
            date_fin = timezone.make_aware(datetime.combine(datetime.strptime(df_s, '%Y-%m-%d'), time.max))
        except: return Response({"error": "Dates invalides"}, status=400)
        
        factures = Facture.objects.filter(
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            date__gte=date_debut, date__lte=date_fin
        ).select_related('client', 'validated_by').prefetch_related('produits')
        
        # Ne garder que les factures qui ont au moins une remise
        results = []
        for f in factures:
            remise_globale = float(f.remise or 0)
            remise_fidelite = float(f.montant_fidelite or 0)
            remise_lignes = sum(float(l.discount or 0) * l.quantity for l in f.produits.all())
            total_remise = remise_globale + remise_fidelite + remise_lignes
            
            if total_remise <= 0:
                continue
            
            results.append({
                'numero_facture': f.numero_facture or f'#{f.id}',
                'date': f.date.strftime('%d/%m/%Y %H:%M'),
                'client': f.client.name if f.client else 'Passage',
                'total_ttc': float(f.total_ttc or 0),
                'remise_globale': remise_globale,
                'remise_lignes': round(remise_lignes, 2),
                'remise_fidelite': remise_fidelite,
                'total_remise': round(total_remise, 2),
                'ratio_remise_pct': round(total_remise / float(f.total_ttc) * 100, 2) if f.total_ttc and f.total_ttc > 0 else 0,
                'vendeur': f.validated_by.get_full_name() or f.validated_by.username if f.validated_by else 'N/A',
            })
        
        results.sort(key=lambda x: -x['total_remise'])
        return Response(results)

    @action(detail=False, methods=['get'])
    def rapport_remises_details_excel(self, request):
        from api.models import PharmacySettings
        data = self.rapport_remises_details(request).data
        wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Détails Remises"
        _write_pharma_header(ws, PharmacySettings, "Détail des Remises par Facture")
        ws.append(["Facture", "Date", "Client", "Total TTC", "Remise Globale", "Remise Lignes", "Remise Fidélité", "Total Remise", "% / CA", "Vendeur"])
        header_row = ws.max_row
        for cell in ws[header_row]: cell.font = Font(bold=True)
        for item in data: ws.append([item['numero_facture'], item['date'], item['client'], item['total_ttc'], item['remise_globale'], item['remise_lignes'], item['remise_fidelite'], item['total_remise'], f"{item['ratio_remise_pct']:.2f}%", item['vendeur']])
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); response['Content-Disposition'] = 'attachment; filename="Details_Remises.xlsx"'; wb.save(response); return response


    @action(detail=False, methods=['get'])
    def rapport_detail_marges(self, request):
        """
        Rapport détaillé des marges par produit et par lot.
        Inclut le coût exact (Lot) ou PMP (si non alloué).
        """
        db_s, df_s = request.query_params.get('date_debut'), request.query_params.get('date_fin')
        if not db_s or not df_s:
            return Response({"error": "Dates requises (date_debut, date_fin)"}, status=400)
            
        try:
            date_debut = timezone.make_aware(datetime.combine(datetime.strptime(db_s, '%Y-%m-%d'), time.min))
            date_fin = timezone.make_aware(datetime.combine(datetime.strptime(df_s, '%Y-%m-%d'), time.max))
        except Exception:
            return Response({"error": "Format de date invalide (YYYY-MM-DD)"}, status=400)

        # Base query for invoices
        factures = Facture.objects.filter(
            date__range=(date_debut, date_fin),
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        )

        # Results list
        results = []

        # 1. Process Allocated Items (Lot by Lot)
        allocations = FactureProduitAllocation.objects.filter(
            facture_produit__facture__in=factures
        ).select_related(
            'facture_produit', 
            'facture_produit__facture', 
            'facture_produit__produit',
            'stock_lot'
        ).order_by('-facture_produit__facture__date')

        for alloc in allocations:
            item = alloc.facture_produit
            f = item.facture
            p = item.produit
            
            qty = float(alloc.quantity)
            price = float(item.selling_price - item.discount)
            cost = float(alloc.cost_price)
            margin = (price - cost) * qty
            
            results.append({
                'date': f.date.strftime('%d/%m/%Y'),
                'facture': f.numero_facture or f'#{f.id}',
                'produit': p.name,
                'lot': alloc.stock_lot.lot if alloc.stock_lot else 'N/A',
                'quantite': qty,
                'prix_vente_net': round(price, 2),
                'cout_achat': round(cost, 2),
                'marge': round(margin, 2),
                'taux_marge': round((price - cost) / price * 100, 1) if price > 0 else 0
            })

        # 2. Process Unallocated Items (Fallback to PMP)
        unallocated = FactureProduit.objects.filter(
            facture__in=factures
        ).annotate(
            has_alloc=Exists(FactureProduitAllocation.objects.filter(facture_produit=OuterRef('pk')))
        ).filter(has_alloc=False).select_related('facture', 'produit')

        for item in unallocated:
            f = item.facture
            p = item.produit
            
            qty = float(item.quantity)
            price = float(item.selling_price - item.discount)
            cost = float(p.pmp or 0)
            margin = (price - cost) * qty
            
            results.append({
                'date': f.date.strftime('%d/%m/%Y'),
                'facture': f.numero_facture or f'#{f.id}',
                'produit': p.name,
                'lot': 'SANS LOT (PMP)',
                'quantite': qty,
                'prix_vente_net': round(price, 2),
                'cout_achat': round(cost, 2),
                'marge': round(margin, 2),
                'taux_marge': round((price - cost) / price * 100, 1) if price > 0 else 0
            })

        results.sort(key=lambda x: x.get('date', ''), reverse=True)

        return Response(results)


    @action(detail=False, methods=['get'])
    def rapport_dynamique(self, request):
        """
        Génère un rapport basé sur des paramètres dynamiques avec support des conditions complexes.
        """
        source = request.query_params.get('source', 'ventes')
        db_s = request.query_params.get('date_debut')
        df_s = request.query_params.get('date_fin')
        vendeur_id = request.query_params.get('vendeur_id')
        client_id = request.query_params.get('client_id')
        fournisseur_id = request.query_params.get('fournisseur_id')
        famille_id = request.query_params.get('famille_id')
        requested_fields = request.query_params.get('fields', '').split(',')
        conditions_raw = request.query_params.get('conditions', '[]')
        
        import json
        try:
            conditions = json.loads(conditions_raw)
        except:
            conditions = []

        if not db_s or not df_s:
            return Response({"error": "Dates requises"}, status=400)

        try:
            date_debut = timezone.make_aware(datetime.combine(datetime.strptime(db_s, '%Y-%m-%d'), time.min))
            date_fin = timezone.make_aware(datetime.combine(datetime.strptime(df_s, '%Y-%m-%d'), time.max))
        except Exception:
            return Response({"error": "Format de date invalide"}, status=400)

        results = []

        def apply_dynamic_conditions(queryset, source_type):
            """Applique les conditions personnalisées au QuerySet."""
            field_map = {
                'quantite': {
                    'ventes': 'quantite',
                    'achats': 'quantite_recue',
                    'stock': 'quantity_remaining',
                    'produits': 'stock' 
                },
                'total_ht': {
                    'ventes': 'total_ht',
                    'achats': 'total_ht',
                    'stock': 'price_cost', 
                    'produits': 'stock' 
                },
                'prix_vente': {
                    'ventes': 'prix_unitaire_ttc',
                    'produits': 'selling_price'
                },
                'cout_achat': {
                    'ventes': 'cost_price', 
                    'achats': 'prix_achat_ht',
                    'stock': 'price_cost',
                    'produits': 'pmp'
                }
            }

            for cond in conditions:
                f = cond.get('field')
                op = cond.get('operator')
                val = cond.get('value')
                
                if not f or not op or val is None: continue
                
                db_field = field_map.get(f, {}).get(source_type)
                if not db_field: continue
                
                try:
                    num_val = float(val)
                except:
                    continue

                if op == 'gte': queryset = queryset.filter(**{f"{db_field}__gte": num_val})
                elif op == 'lte': queryset = queryset.filter(**{f"{db_field}__lte": num_val})
                elif op == 'gt': queryset = queryset.filter(**{f"{db_field}__gt": num_val})
                elif op == 'lt': queryset = queryset.filter(**{f"{db_field}__lt": num_val})
                elif op == 'eq': queryset = queryset.filter(**{f"{db_field}": num_val})
            
            return queryset

        if source == 'ventes':
            from api.models.billing import FactureProduit
            
            filters = {
                'facture__date_facture__range': (date_debut, date_fin),
                'facture__status': 'VAL'
            }
            if vendeur_id: filters['facture__created_by_id'] = vendeur_id
            if client_id: filters['facture__client_id'] = client_id
            if famille_id: filters['produit__famille_risque_id'] = famille_id

            qs = FactureProduit.objects.filter(**filters)
            qs = apply_dynamic_conditions(qs, 'ventes')
            
            items = qs.select_related(
                'facture', 'facture__client', 'facture__created_by', 
                'produit', 'produit__famille_risque', 'produit__rayon', 'produit__forme'
            )
            
            for item in items:
                row = {}
                p = item.produit
                f = item.facture
                if 'date' in requested_fields: row['Date'] = f.date_facture.strftime('%d/%m/%Y')
                if 'facture' in requested_fields: row['Facture'] = f.numero_facture
                if 'client' in requested_fields: row['Client'] = f.client.name if f.client else 'Passage'
                if 'vendeur' in requested_fields: row['Vendeur'] = f.created_by.username if f.created_by else 'N/A'
                if 'produit' in requested_fields: row['Produit'] = p.name if p else item.produit_nom
                if 'famille' in requested_fields: row['Famille'] = p.famille_risque.nom if p and p.famille_risque else 'N/A'
                if 'quantite' in requested_fields: row['Quantité'] = item.quantite
                if 'prix_vente' in requested_fields: row['Prix Vente'] = round(float(item.prix_unitaire_ttc), 2)
                if 'total_ht' in requested_fields: row['Total HT'] = round(float(item.total_ht), 2)
                if 'tva' in requested_fields: row['TVA (%)'] = float(p.tva) if p else 0
                if 'rayon' in requested_fields: row['Rayon'] = p.rayon.name if p and p.rayon else 'N/A'
                if 'cip' in requested_fields: row['Code CIP'] = p.cip1 if p else 'N/A'
                if 'forme' in requested_fields: row['Forme'] = p.forme.nom if p and p.forme else 'N/A'
                
                if any(x in requested_fields for x in ['cout_achat', 'marge', 'pourcentage_marge']):
                    from api.models.billing import FactureProduitAllocation
                    allocs = FactureProduitAllocation.objects.filter(facture_produit=item)
                    total_cost = sum(a.quantity * a.cost_price for a in allocs)
                    if 'cout_achat' in requested_fields:
                        row['Coût Achat'] = round(float(total_cost / item.quantite), 2) if item.quantite > 0 else 0
                    if 'marge' in requested_fields:
                        row['Marge Brute'] = round(float(item.total_ht - total_cost), 2)
                    if 'pourcentage_marge' in requested_fields:
                        margin = float(item.total_ht - total_cost)
                        row['Marge (%)'] = round((margin / float(item.total_ht)) * 100, 2) if item.total_ht > 0 else 0
                results.append(row)

        elif source == 'achats':
            from api.models.orders import CommandeProduit
            filters = {
                'commande__date_reception__range': (date_debut, date_fin),
                'commande__status': 'RECU'
            }
            if fournisseur_id: filters['commande__fournisseur_id'] = fournisseur_id
            if famille_id: filters['produit__famille_risque_id'] = famille_id

            qs = CommandeProduit.objects.filter(**filters)
            qs = apply_dynamic_conditions(qs, 'achats')

            items = qs.select_related(
                'commande', 'commande__fournisseur', 
                'produit', 'produit__famille_risque', 'produit__rayon', 'produit__forme'
            )
            for cp in items:
                row = {}
                p = cp.produit
                cmd = cp.commande
                if 'date' in requested_fields: row['Réception'] = cmd.date_reception.strftime('%d/%m/%Y')
                if 'facture' in requested_fields: row['Commande'] = cmd.numero_commande
                if 'fournisseur' in requested_fields: row['Fournisseur'] = cmd.fournisseur.name if cmd.fournisseur else 'N/A'
                if 'produit' in requested_fields: row['Produit'] = p.name if p else cp.produit_nom
                if 'famille' in requested_fields: row['Famille'] = p.famille_risque.nom if p and p.famille_risque else 'N/A'
                if 'quantite' in requested_fields: row['Quantité'] = cp.quantite_recue
                if 'cout_achat' in requested_fields: row['P.U Achat'] = round(float(cp.prix_achat_ht), 2)
                if 'total_ht' in requested_fields: row['Total HT'] = round(float(cp.total_ht), 2)
                if 'tva' in requested_fields: row['TVA (%)'] = float(p.tva) if p else 0
                if 'rayon' in requested_fields: row['Rayon'] = p.rayon.name if p and p.rayon else 'N/A'
                if 'cip' in requested_fields: row['Code CIP'] = p.cip1 if p else 'N/A'
                if 'forme' in requested_fields: row['Forme'] = p.forme.nom if p and p.forme else 'N/A'
                results.append(row)

        elif source == 'stock':
            from api.models.stock import StockLot
            filters = {
                'date_reception__range': (date_debut, date_fin)
            }
            if fournisseur_id: filters['fournisseur_id'] = fournisseur_id
            if famille_id: filters['produit__famille_risque_id'] = famille_id

            qs = StockLot.objects.filter(**filters)
            qs = apply_dynamic_conditions(qs, 'stock')

            items = qs.select_related(
                'produit', 'produit__famille_risque', 'produit__rayon', 'produit__forme', 'fournisseur'
            )
            for lot in items:
                row = {}
                p = lot.produit
                if 'date' in requested_fields: row['Réception'] = lot.date_reception.strftime('%d/%m/%Y')
                if 'produit' in requested_fields: row['Produit'] = p.name if p else lot.produit_nom
                if 'famille' in requested_fields: row['Famille'] = p.famille_risque.nom if p and p.famille_risque else 'N/A'
                if 'lot' in requested_fields: row['Lot'] = lot.lot
                if 'quantite' in requested_fields: row['Stock Restant'] = lot.quantity_remaining
                if 'cout_achat' in requested_fields: row['P.U Achat'] = round(float(lot.price_cost), 2)
                if 'total_ht' in requested_fields: row['Valeur Stock'] = round(float(lot.price_cost * lot.quantity_remaining), 2)
                if 'tva' in requested_fields: row['TVA (%)'] = float(p.tva) if p else 0
                if 'rayon' in requested_fields: row['Rayon'] = p.rayon.name if p and p.rayon else 'N/A'
                if 'cip' in requested_fields: row['Code CIP'] = p.cip1 if p else 'N/A'
                if 'forme' in requested_fields: row['Forme'] = p.forme.nom if p and p.forme else 'N/A'
                if 'fournisseur' in requested_fields: row['Fournisseur'] = lot.fournisseur.name if lot.fournisseur else 'N/A'
                results.append(row)

        elif source == 'produits':
            from api.models.products import Produit
            filters = {}
            if famille_id: filters['famille_risque_id'] = famille_id

            qs = Produit.objects.filter(**filters)
            qs = apply_dynamic_conditions(qs, 'produits')

            items = qs.select_related('famille_risque', 'rayon', 'forme', 'fournisseur')
            for p in items:
                row = {}
                if 'produit' in requested_fields: row['Produit'] = p.name
                if 'famille' in requested_fields: row['Famille'] = p.famille_risque.nom if p.famille_risque else 'N/A'
                if 'prix_vente' in requested_fields: row['Prix Vente'] = round(float(p.selling_price), 2)
                if 'cout_achat' in requested_fields: row['PMP'] = round(float(p.pmp), 2)
                if 'quantite' in requested_fields: row['Stock Total'] = p.total_stock
                if 'total_ht' in requested_fields: row['Valeur Totale'] = round(float(p.total_stock * p.pmp), 2)
                if 'tva' in requested_fields: row['TVA (%)'] = float(p.tva)
                if 'rayon' in requested_fields: row['Rayon'] = p.rayon.name if p.rayon else 'N/A'
                if 'cip' in requested_fields: row['Code CIP'] = p.cip1
                if 'forme' in requested_fields: row['Forme'] = p.forme.nom if p and p.forme else 'N/A'
                if 'fournisseur' in requested_fields: row['Fournisseur'] = p.fournisseur.name if p.fournisseur else 'N/A'
                if 'stock_minimum' in requested_fields: row['Stock Min'] = p.stock_minimum
                if 'pourcentage_marge' in requested_fields: row['Marge (%)'] = round(float(p.pourcentage_marge), 2)
                results.append(row)

        if results:
            first_key = list(results[0].keys())[0]
            results.sort(key=lambda x: x.get(first_key, ''), reverse=True)

        return Response(results)


    @action(detail=False, methods=['get'])
    def rapport_mensuel_pdf(self, request):
        # This one is long, but I'll migrate it fully to keep functionality
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from api.pdf_utils import get_pharma_styles, draw_pharma_header, draw_pharma_footer, format_currency, PharmaColors
        
        mois = request.query_params.get('mois')
        if not mois: return Response({'detail': 'Mois requis'}, status=400)
        date_debut = timezone.make_aware(datetime.strptime(f"{mois}-01", '%Y-%m-%d'))
        date_fin = (date_debut + timedelta(days=32)).replace(day=1)
        data = self._get_rapport_data(date_debut, date_fin, mois)
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=15, leftMargin=15, topMargin=80, bottomMargin=40)
        story = []
        styles = get_pharma_styles()
        story.append(Paragraph(f"<b>RAPPORT MENSUEL - {mois}</b>", styles['Title']))
        
        kpi_data = [[f"CA TTC\n{format_currency(data['ca']['ca_ttc'])}", f"CA HT\n{format_currency(data['ca']['ca_ht'])}", f"Marge\n{format_currency(data['marge']['marge_brute'])}", f"Remises\n{format_currency(data['ca']['total_remises'])}", f"Créances\n{format_currency(data['creances']['total'])}"]]
        t_kpi = Table(kpi_data, colWidths=[3.5*cm]*5); t_kpi.setStyle([('BACKGROUND', (0,0), (-1,-1), PharmaColors.GREEN_LIGHT), ('ALIGN', (0,0), (-1,-1), 'CENTER'), ('GRID', (0,0), (-1,-1), 0.5, PharmaColors.GREEN)])
        story.append(t_kpi); story.append(Spacer(1, 10))
        
        doc.build(story, onFirstPage=lambda c, d: draw_pharma_header(c, d, title="RAPPORT"), onLaterPages=lambda c, d: draw_pharma_header(c, d, title="RAPPORT"))
        response = HttpResponse(content_type='application/pdf'); response['Content-Disposition'] = f'attachment; filename="rapport_{mois}.pdf"'; response.write(buffer.getvalue()); return response

    @action(detail=False, methods=['get'])
    def rapport_remises_excel(self, request):
        from api.models import PharmacySettings
        data = self.rapport_remises(request).data
        wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Remises"
        _write_pharma_header(ws, PharmacySettings, "Rapport des Remises par Utilisateur")
        ws.append(["Utilisateur", "Nb Factures", "CA TTC", "Remise Globale", "Remise Lignes", "Remise Fidélité", "Total Remise", "% / CA"])
        header_row = ws.max_row
        for cell in ws[header_row]: cell.font = Font(bold=True)
        for item in data: ws.append([item['full_name'], item['nb_factures'], item['ca_ttc'], item['remise_globale'], item['remise_lignes'], item['remise_fidelite'], item['total_remise'], f"{item['ratio_remise_pct']:.2f}%"])
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); response['Content-Disposition'] = 'attachment; filename="Remises.xlsx"'; wb.save(response); return response
