from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum, F, DecimalField, Value
from django.db.models.functions import TruncDate, Coalesce
from django.utils import timezone
from datetime import datetime, timedelta, time
from decimal import Decimal
import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from django.http import HttpResponse
from api.models import Produit, CommandeProduit, Facture, FactureProduit, MouvementStock

class RapportInventoryMixin:
    """
    Rapports liés à la gestion des stocks et de l'inventaire.
    """
    
    @action(detail=False, methods=['get'])
    def valeur_stock_journalier(self, request):
        date_debut_str = request.query_params.get('date_debut')
        date_fin_str = request.query_params.get('date_fin')
        if not date_debut_str or not date_fin_str:
            return Response({'error': 'Dates requises'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            date_debut = datetime.fromisoformat(date_debut_str.replace('Z', '+00:00')).date()
            date_fin = datetime.fromisoformat(date_fin_str.replace('Z', '+00:00')).date()
        except ValueError:
            return Response({'error': 'Format de date invalide'}, status=status.HTTP_400_BAD_REQUEST)

        stock_totals = Produit.objects.filter(stock__gt=0).aggregate(
            total_cost=Coalesce(Sum(F('stock') * F('pmp'), output_field=DecimalField()), Value(0, output_field=DecimalField())),
            total_ttc=Coalesce(Sum(F('stock') * F('selling_price'), output_field=DecimalField()), Value(0, output_field=DecimalField())),
        )
        current_stock_cost = stock_totals['total_cost']
        current_stock_ttc = stock_totals['total_ttc']
        today = timezone.now().date()
        
        ventes_ca = Facture.objects.filter(date__date__gte=date_debut, status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]).annotate(jour=TruncDate('date')).values('jour').annotate(ca_net=Sum('total_ttc')).order_by('-jour')
        ventes_details = FactureProduit.objects.filter(facture__date__date__gte=date_debut, facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]).annotate(jour=TruncDate('facture__date')).values('jour').annotate(ventes_ttc_brut=Sum(F('quantity') * F('selling_price'), output_field=DecimalField()), cout_ventes=Sum(F('quantity') * F('produit__pmp'), output_field=DecimalField())).order_by('-jour')
        achats = CommandeProduit.objects.filter(commande__date_cloture__date__gte=date_debut, commande__status='CLOT').annotate(jour=TruncDate('commande__date_cloture')).values('jour').annotate(achats_cout=Sum((F('quantity') + F('unites_gratuites')) * F('price_cost'), output_field=DecimalField()), achats_ttc_virtuel=Sum((F('quantity') + F('unites_gratuites')) * F('produit__selling_price'), output_field=DecimalField())).order_by('-jour')
        
        mouvements_map = {}
        for v in ventes_ca:
            d = v['jour']
            if d not in mouvements_map: mouvements_map[d] = {'ventes_ttc_net': 0, 'ventes_ttc_brut': 0, 'cout_ventes': 0, 'achats_cout': 0, 'achats_ttc': 0}
            mouvements_map[d]['ventes_ttc_net'] = v['ca_net'] or 0
        for v in ventes_details:
            d = v['jour']
            if d not in mouvements_map: mouvements_map[d] = {'ventes_ttc_net': 0, 'ventes_ttc_brut': 0, 'cout_ventes': 0, 'achats_cout': 0, 'achats_ttc': 0}
            mouvements_map[d]['ventes_ttc_brut'] = v['ventes_ttc_brut'] or 0
            mouvements_map[d]['cout_ventes'] = v['cout_ventes'] or 0
        for a in achats:
            d = a['jour']
            if d not in mouvements_map: mouvements_map[d] = {'ventes_ttc_net': 0, 'ventes_ttc_brut': 0, 'cout_ventes': 0, 'achats_cout': 0, 'achats_ttc': 0}
            mouvements_map[d]['achats_cout'] = a['achats_cout'] or 0
            mouvements_map[d]['achats_ttc'] = a['achats_ttc_virtuel'] or 0
            
        resultats = []
        running_cost, running_ttc = float(current_stock_cost), float(current_stock_ttc)
        delta = (today - date_debut).days
        for i in range(delta + 1):
            current_day = today - timedelta(days=i)
            mops = mouvements_map.get(current_day, {'ventes_ttc_net': 0, 'ventes_ttc_brut': 0, 'cout_ventes': 0, 'achats_cout': 0, 'achats_ttc': 0})
            st_cost, st_ttc = running_cost - float(mops['achats_cout']) + float(mops['cout_ventes']), running_ttc - float(mops['achats_ttc']) + float(mops['ventes_ttc_brut'])
            if date_debut <= current_day <= date_fin:
                marge = float(mops['ventes_ttc_net']) - float(mops['cout_ventes'])
                resultats.append({'date': current_day.strftime('%Y-%m-%d'), 'valeur_stock_cout': round(running_cost, 0), 'valeur_stock_ttc': round(running_ttc, 0), 'achats_jour': round(float(mops['achats_cout']), 0), 'ventes_jour': round(float(mops['ventes_ttc_net']), 0), 'cout_ventes': round(float(mops['cout_ventes']), 0), 'marge': round(marge, 0), 'marge_pourcent': round((marge / float(mops['ventes_ttc_net']) * 100), 1) if mops['ventes_ttc_net'] > 0 else 0})
            running_cost, running_ttc = st_cost, st_ttc
        return Response(resultats)

    @action(detail=False, methods=['get'])
    def stocks_morts(self, request):
        try:
            min_value = Decimal(request.query_params.get('min_value', 100000))
            months = int(request.query_params.get('months', 6))
            export_format = request.query_params.get('format')
        except (ValueError, TypeError): return Response({'error': 'Paramètres invalides'}, status=status.HTTP_400_BAD_REQUEST)

        limit_date = (timezone.now() - timedelta(days=months*30)).date()
        produits = Produit.objects.filter(stock__gt=0).select_related('rayon', 'fournisseur')
        results = []
        for p in produits:
            valeur = (p.pmp or Decimal(0)) * p.stock
            if valeur >= min_value and (not p.dernier_vente or p.dernier_vente < limit_date):
                results.append({'id': p.id, 'name': p.name, 'cip': p.cip1, 'stock': p.stock, 'valeur': valeur, 'pmp': p.pmp, 'dernier_vente': p.dernier_vente, 'rayon': p.rayon.name if p.rayon else '', 'fournisseur': p.fournisseur.name if p.fournisseur else ''})
        
        results.sort(key=lambda x: x['valeur'], reverse=True)
        if export_format == 'csv':
            import csv
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="stocks_morts_{timezone.now().date()}.csv"'
            response.write(u'\ufeff'.encode('utf8'))
            writer = csv.writer(response, delimiter=';')
            writer.writerow(['Produit', 'CIP', 'Rayon', 'Fournisseur', 'Stock', 'PMP', 'Valeur Stock', 'Dernière Vente'])
            for r in results: writer.writerow([r['name'], r['cip'], r['rayon'], r['fournisseur'], str(r['stock']).replace('.', ','), str(r['pmp']).replace('.', ','), str(r['valeur']).replace('.', ','), r['dernier_vente'].strftime('%d/%m/%Y') if r['dernier_vente'] else 'Jamais'])
            return response
        return Response(results)

    @action(detail=False, methods=['get'])
    def balance_stock_excel(self, request):
        db_param, df_param = request.query_params.get('date_debut'), request.query_params.get('date_fin')
        lang, exclude_zero = request.query_params.get('lang', 'fr'), request.query_params.get('exclude_zero') == 'true'
        if not db_param or not df_param: return Response({'error': 'Dates requises'}, status=400)
        try:
            from django.utils.dateparse import parse_date
            date_debut, date_fin = datetime.combine(parse_date(db_param), time.min), datetime.combine(parse_date(df_param), time.max)
        except: return Response({'error': 'Date invalide'}, status=400)

        produits = Produit.objects.filter(is_active=True).only('id', 'name', 'cip1', 'stock', 'stock_reserve')
        stock_initial_dict = {item['produit_id']: item['total'] or 0 for item in MouvementStock.objects.filter(date__lt=date_debut).values('produit_id').annotate(total=Sum('quantite'))}
        mouvements_dict = {}
        for item in MouvementStock.objects.filter(date__range=(date_debut, date_fin)).values('produit_id', 'type_mouvement').annotate(total=Sum('quantite')):
            pid, tm, val = item['produit_id'], item['type_mouvement'], item['total'] or 0
            if pid not in mouvements_dict: mouvements_dict[pid] = {}
            mouvements_dict[pid][tm] = val

        wb = openpyxl.Workbook()
        ws = wb.active
        h = {'fr': {'title': "Balance des Stocks", 'cip': "Code CIP", 'designation': "Désignation", 'stock_initial': "Stock Initial", 'achats': "Achats", 'ventes': "Ventes", 'ajustements': "Ajustements", 'stock_final': "Stock Final"}, 'en': {'title': "Stock Balance", 'cip': "CIP Code", 'designation': "Designation", 'stock_initial': "Initial Stock", 'achats': "Purchases", 'ventes': "Sales", 'ajustements': "Adjustments", 'stock_final': "Final Stock"}}.get(lang, 'fr')
        
        ws.merge_cells('A1:G1'); ws['A1'] = f"{h['title']} - {date_debut.strftime('%d/%m/%Y')} au {date_fin.strftime('%d/%m/%Y')}"
        ws['A1'].font = Font(bold=True, size=14); ws.append([]); ws.append([h['cip'], h['designation'], h['stock_initial'], h['achats'], h['ventes'], h['ajustements'], h['stock_final']])
        
        for p in produits:
            si, pm = stock_initial_dict.get(p.id, 0), mouvements_dict.get(p.id, {})
            ac, vt = pm.get(MouvementStock.TypeMouvement.ENTREE, 0), pm.get(MouvementStock.TypeMouvement.SORTIE, 0)
            aj = sum(v for t, v in pm.items() if t not in [MouvementStock.TypeMouvement.ENTREE, MouvementStock.TypeMouvement.SORTIE])
            sf = si + sum(pm.values())
            if not(exclude_zero and si==0 and ac==0 and vt==0 and aj==0 and sf==0):
                ws.append([p.cip1 or "", p.name, si, ac, -vt, aj, sf])

        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="Balance_Stocks.xlsx"'; wb.save(response)
        return response
