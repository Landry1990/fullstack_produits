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
from api.models import Facture, FactureProduit, Caisse

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
        data = self.rapport_remises_details(request).data
        wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Détails Remises"
        ws.append(["Facture", "Date", "Client", "Total TTC", "Remise Globale", "Remise Lignes", "Remise Fidélité", "Total Remise", "% / CA", "Vendeur"])
        for item in data: ws.append([item['numero_facture'], item['date'], item['client'], item['total_ttc'], item['remise_globale'], item['remise_lignes'], item['remise_fidelite'], item['total_remise'], f"{item['ratio_remise_pct']:.2f}%", item['vendeur']])
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); response['Content-Disposition'] = 'attachment; filename="Details_Remises.xlsx"'; wb.save(response); return response


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
        data = self.rapport_remises(request).data
        wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Remises"
        ws.append(["Utilisateur", "Nb Factures", "CA TTC", "Remise Globale", "Remise Lignes", "Remise Fidélité", "Total Remise", "% / CA"])
        for item in data: ws.append([item['full_name'], item['nb_factures'], item['ca_ttc'], item['remise_globale'], item['remise_lignes'], item['remise_fidelite'], item['total_remise'], f"{item['ratio_remise_pct']:.2f}%"])
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); response['Content-Disposition'] = 'attachment; filename="Remises.xlsx"'; wb.save(response); return response
