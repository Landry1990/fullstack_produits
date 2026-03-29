from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum, DecimalField, Count, F, Q
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
from api.models import Facture, FactureProduit, FactureProduitAllocation, Fournisseur
from django.utils.formats import date_format
import csv
from django.http import HttpResponse

class RapportSalesMixin:
    """
    Rapports de performance commerciale et analytique des ventes.
    """
    
    @action(detail=False, methods=['get'])
    def stats_vendeurs(self, request):
        db_str, df_str = request.query_params.get('date_debut'), request.query_params.get('date_fin')
        if not db_str or not df_str: return Response({'error': 'Dates requises'}, status=400)
        try:
            date_debut = timezone.make_aware(datetime.fromisoformat(db_str.replace('Z', '+00:00')))
            date_fin = timezone.make_aware(datetime.fromisoformat(df_str.replace('Z', '+00:00')))
            # Si l'heure n'est pas précisée (minuit), on prend la journée entière
            if date_fin.hour == 0 and date_fin.minute == 0:
                date_fin += timedelta(days=1)
            else:
                # Sinon on s'assure d'inclure les secondes si le sélecteur s'arrête à la minute (ex: 23:59)
                date_fin += timedelta(minutes=1)
        except: return Response({'error': 'Date invalide'}, status=400)

        factures = Facture.objects.filter(status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE], date__gte=date_debut, date__lt=date_fin).select_related('created_by')
        stats = {}
        for f in factures:
            vid = f.created_by.id if f.created_by else 0
            if vid not in stats:
                stats[vid] = {
                    'vendeur_id': vid,
                    'vendeur': (f.created_by.get_full_name() or f.created_by.username) if vid else 'Non Attribuées',
                    'nbre_ventes': 0,
                    'chiffre_affaires': Decimal('0.00')
                }
            stats[vid]['nbre_ventes'] += 1; stats[vid]['chiffre_affaires'] += f.total_ttc
        
        results = sorted(stats.values(), key=lambda x: x['chiffre_affaires'], reverse=True)
        if results:
            total_v = sum(r['nbre_ventes'] for r in results)
            total_ca = sum(r['chiffre_affaires'] for r in results)
            results.append({
                'vendeur_id': None,
                'vendeur': 'TOTAL',
                'nbre_ventes': total_v,
                'chiffre_affaires': total_ca
            })
        return Response(results)

    @action(detail=False, methods=['get'])
    def meilleurs_clients(self, request):
        db_str, df_str = request.query_params.get('date_debut'), request.query_params.get('date_fin')
        fmt = request.query_params.get('format')
        if not db_str or not df_str: return Response({'error': 'Dates requises'}, status=400)
        try:
            date_debut, date_fin = timezone.make_aware(datetime.fromisoformat(db_str.replace('Z', '+00:00'))), timezone.make_aware(datetime.fromisoformat(df_str.replace('Z', '+00:00')))
            if date_fin.hour == 0 and date_fin.minute == 0: date_fin += timedelta(days=1)
        except: return Response({'error': 'Date invalide'}, status=400)

        factures = Facture.objects.filter(date__range=(date_debut, date_fin), status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE], client__isnull=False).select_related('client')
        stats = {}
        for f in factures:
            cid = f.client.id
            if cid not in stats: stats[cid] = {'client_id': cid, 'client_name': f.client.name, 'client_type': f.client.client_type, 'nb_ventes': 0, 'chiffre_affaires': Decimal('0.00')}
            stats[cid]['nb_ventes'] += 1; stats[cid]['chiffre_affaires'] += f.total_ttc

        results = sorted(stats.values(), key=lambda x: x['chiffre_affaires'], reverse=True)
        for i, r in enumerate(results, 1):
            r['rang'], r['panier_moyen'] = i, float(r['chiffre_affaires'] / r['nb_ventes']) if r['nb_ventes'] > 0 else 0
            r['chiffre_affaires'] = float(r['chiffre_affaires'])

        if fmt == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="meilleurs_clients.csv"'; response.write(u'\ufeff'.encode('utf8'))
            writer = csv.writer(response, delimiter=';'); writer.writerow(['Rang', 'Client', 'Type', 'Nb Ventes', 'Chiffre Affaires', 'Panier Moyen'])
            for r in results: writer.writerow([r['rang'], r['client_name'], r['client_type'], r['nb_ventes'], str(r['chiffre_affaires']).replace('.', ','), str(r['panier_moyen']).replace('.', ',')])
            return response
        return Response(results)

    @action(detail=False, methods=['get'])
    def produits_annules(self, request):
        db, df = request.query_params.get('date_debut'), request.query_params.get('date_fin')
        qs = FactureProduit.objects.filter(facture__status=Facture.Status.ANNULEE).select_related('facture', 'produit', 'facture__cancelled_by').order_by('-facture__date_annulation')
        if db: qs = qs.filter(facture__date_annulation__gte=db)
        if df: qs = qs.filter(facture__date_annulation__lte=df)
        
        page = self.paginator.paginate_queryset(qs, request, view=self)
        data = []
        for fp in (page if page is not None else qs):
            notes = fp.facture.notes or ""
            data.append({
                'date_annulation': fp.facture.date_annulation.strftime('%d/%m/%Y %H:%M') if fp.facture.date_annulation else "",
                'numero_facture': fp.facture.numero_facture or f"#{fp.facture.id}",
                'nom_produit': fp.produit.name if fp.produit else fp.produit_nom,
                'quantite_annulee': fp.quantity, 'lot': fp.lot, 'stock_actuel': fp.produit.stock if fp.produit else 0,
                'annule_par': fp.facture.cancelled_by.username if fp.facture.cancelled_by else "Système",
                'motif': notes.split('Motif: ')[-1] if 'Motif: ' in notes else "",
                'source': "CAISSE_CENTRALE" if "Caisse Centrale" in notes else "VENTES"
            })
        return self.paginator.get_paginated_response(data) if page is not None else Response(data)

    @action(detail=False, methods=['get'])
    def classement_vendeurs_mensuel(self, request):
        mois_str, periode = request.query_params.get('mois'), request.query_params.get('periode', 'mois')
        now = timezone.now()
        try:
            if mois_str:
                y, m = map(int, mois_str.split('-'))
                date_debut = timezone.make_aware(datetime(y, m, 1))
            else: date_debut = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            date_fin = (date_debut + timedelta(days=32)).replace(day=1)
        except: return Response({'error': 'Format mois invalide'}, status=400)
        
        factures = Facture.objects.filter(status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE], date__gte=date_debut, date__lt=date_fin).select_related('created_by')
        stats = {}
        for f in factures:
            vid = f.created_by.id if f.created_by else 0
            if vid not in stats: stats[vid] = {'vendeur_id': vid, 'vendeur': (f.created_by.get_full_name() or f.created_by.username) if vid else 'Non Attribuées', 'nbre_ventes': 0, 'chiffre_affaires': Decimal('0.00')}
            stats[vid]['nbre_ventes'] += 1; stats[vid]['chiffre_affaires'] += f.total_ttc
        
        results = sorted(stats.values(), key=lambda x: x['chiffre_affaires'], reverse=True)
        for i, r in enumerate(results, 1):
            r['rang'], r['panier_moyen'] = i, round(float(r['chiffre_affaires']) / r['nbre_ventes'], 2) if r['nbre_ventes'] > 0 else 0
            r['chiffre_affaires'] = float(r['chiffre_affaires'])
        return Response({'data': results, 'periode': {'debut': date_debut.strftime('%Y-%m-%d'), 'fin': date_fin.strftime('%Y-%m-%d'), 'type': periode}})

    @action(detail=False, methods=['get'])
    def evolution_vendeur(self, request):
        vid_param = request.query_params.get('vendeur_id')
        if not vid_param: return Response({'error': 'vendeur_id requis'}, status=400)
        from django.contrib.auth import get_user_model
        User, now = get_user_model(), timezone.now()
        v_list = User.objects.filter(id__in=Facture.objects.filter(date__gte=now-timedelta(days=365), created_by__isnull=False).values_list('created_by', flat=True).distinct()) if vid_param == 'all' else [User.objects.get(id=int(vid_param))]
        
        m_labels = []
        for i in range(11, -1, -1):
            d = now - timedelta(days=i * 30)
            m_labels.append({'key': d.strftime('%Y-%m'), 'label': date_format(d, "M Y"), 'start': timezone.make_aware(datetime(d.year, d.month, 1))})

        res = []
        for v in v_list:
            hist = []
            for m in m_labels:
                df = (m['start'] + timedelta(days=32)).replace(day=1)
                ca = Facture.objects.filter(status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE], date__gte=m['start'], date__lt=df, created_by=v).aggregate(ca=Sum('total_ttc'))['ca'] or 0
                hist.append({'mois': m['key'], 'label': m['label'], 'chiffre_affaires': float(ca)})
            res.append({'vendeur': v.get_full_name() or v.username, 'vendeur_id': v.id, 'data': hist})
        return Response(res)

    @action(detail=False, methods=['get'])
    def top_selling_products(self, request):
        """
        Rapport des produits les plus vendus.
        Optimisé pour calculer CA, Qté et Marge via les allocations de lots.
        """
        db_str = request.query_params.get('date_debut')
        df_str = request.query_params.get('date_fin')
        fid = request.query_params.get('fournisseur_id')
        
        try:
            date_debut = timezone.make_aware(datetime.fromisoformat(db_str.replace('Z', '+00:00'))) if db_str else timezone.now() - timedelta(days=30)
            date_fin = timezone.make_aware(datetime.fromisoformat(df_str.replace('Z', '+00:00'))) if df_str else timezone.now()
            if date_fin.hour == 0 and date_fin.minute == 0: date_fin += timedelta(days=1)
        except: return Response({'error': 'Dates invalides'}, status=400)

        # Base QuerySet: Filtrage sur les factures validées/payées ayant au moins un paiement
        # On utilise FactureProduitAllocation pour la précision des marges (prix d'achat réel du lot)
        qs = FactureProduitAllocation.objects.annotate(
            num_p=Count('facture_produit__facture__paiements')
        ).filter(
            facture_produit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            facture_produit__facture__date__range=(date_debut, date_fin)
        ).exclude(facture_produit__facture__status='VAL', num_p=0)

        if fid:
            qs = qs.filter(stock_lot__fournisseur_id=fid)

        # Agrégation optimisée
        stats = qs.values(
            'facture_produit__produit__id',
            'facture_produit__produit__name',
            'facture_produit__produit__cip1'
        ).annotate(
            qty=Sum('quantity'),
            catttc=Sum(F('quantity') * F('selling_price'), output_field=DecimalField(max_digits=12, decimal_places=2)),
            marge=Sum(F('quantity') * (F('selling_price') - F('cost_price')), output_field=DecimalField(max_digits=12, decimal_places=2))
        ).order_by('-qty')

        # Pagination
        page = self.paginator.paginate_queryset(stats, request, view=self)
        
        results = []
        for item in (page if page is not None else stats):
            results.append({
                'id': item['facture_produit__produit__id'],
                'name': item['facture_produit__produit__name'],
                'cip1': item['facture_produit__produit__cip1'],
                'qty': item['qty'],
                'catttc': float(item['catttc']),
                'marge': float(item['marge']),
                'taux_marge': round((float(item['marge']) / float(item['catttc']) * 100), 2) if item['catttc'] > 0 else 0
            })

        return self.paginator.get_paginated_response(results) if page is not None else Response(results)

    @action(detail=False, methods=['get'])
    def suppliers_with_stock(self, request):
        """Retourne la liste des fournisseurs ayant déjà effectué des entrées en stock (lots)."""
        from api.models import StockLot
        active_fids = StockLot.objects.filter(fournisseur__isnull=False).values_list('fournisseur_id', flat=True).distinct()
        suppliers = Fournisseur.objects.filter(id__in=active_fids, is_active=True).values('id', 'name').order_by('name')
        return Response(list(suppliers))
