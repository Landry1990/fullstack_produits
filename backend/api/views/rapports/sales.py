import csv
from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, F, Sum, Value
from django.db.models.functions import Coalesce, TruncMonth
from django.http import HttpResponse
from django.utils import timezone
from django.utils.formats import date_format
from rest_framework.decorators import action
from rest_framework.response import Response

from api.models import Facture, FactureProduit, FactureProduitAllocation, Fournisseur

from .tz_utils import parse_api_datetime


class RapportSalesMixin:
    """
    Rapports de performance commerciale et analytique des ventes.
    """
    
    @action(detail=False, methods=['get'])
    def stats_vendeurs(self, request):
        db_str, df_str = request.query_params.get('date_debut'), request.query_params.get('date_fin')
        if not db_str or not df_str: return Response({'error': 'Dates requises'}, status=400)
        date_debut = parse_api_datetime(db_str)
        date_fin = parse_api_datetime(df_str, end_of_day=True)
        if date_debut is None or date_fin is None:
            return Response({'error': 'Date invalide'}, status=400)

        # Si le frontend envoie une heure de fin (ex: 23:59), on ajoute une minute
        # pour inclure les secondes de la borne (ex: 23:59:30).
        if len(df_str.strip()) > 10:
            date_fin += timedelta(minutes=1)

        # ── 1 seule requête GROUP BY created_by ────────────────────────────
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user_map = {u.id: (u.get_full_name() or u.username) for u in User.objects.all()}

        rows = (
            Facture.objects
            .filter(
                status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
                date__gte=date_debut,
                date__lt=date_fin,
            )
            .values('created_by_id')
            .annotate(
                nbre_ventes=Count('id'),
                chiffre_affaires=Coalesce(Sum('total_ttc'), Value(0, output_field=DecimalField())),
            )
            .order_by('-chiffre_affaires')
        )

        results = []
        total_v, total_ca = 0, Decimal('0.00')
        for row in rows:
            vid = row['created_by_id'] or 0
            nom = user_map.get(vid, 'Non Attribuées')
            ca  = row['chiffre_affaires']
            results.append({
                'vendeur_id':       vid,
                'vendeur':          nom,
                'nbre_ventes':      row['nbre_ventes'],
                'chiffre_affaires': float(ca),
            })
            total_v  += row['nbre_ventes']
            total_ca += ca

        if results:
            results.append({
                'vendeur_id': None, 'vendeur': 'TOTAL',
                'nbre_ventes': total_v, 'chiffre_affaires': float(total_ca),
            })
        return Response(results)

    @action(detail=False, methods=['get'])
    def meilleurs_clients(self, request):
        db_str, df_str = request.query_params.get('date_debut'), request.query_params.get('date_fin')
        fmt = request.query_params.get('format')
        if not db_str or not df_str: return Response({'error': 'Dates requises'}, status=400)
        date_debut = parse_api_datetime(db_str)
        date_fin = parse_api_datetime(df_str, end_of_day=True)
        if date_debut is None or date_fin is None:
            return Response({'error': 'Date invalide'}, status=400)

        # ── 1 seule requête GROUP BY client ─────────────────────────────────
        rows = (
            Facture.objects
            .filter(
                date__range=(date_debut, date_fin),
                status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
                client__isnull=False,
            )
            .values('client_id', 'client__name', 'client__client_type')
            .annotate(
                nb_ventes=Count('id'),
                chiffre_affaires=Coalesce(Sum('total_ttc'), Value(0, output_field=DecimalField())),
            )
            .order_by('-chiffre_affaires')
        )

        results = []
        for i, row in enumerate(rows, 1):
            ca = float(row['chiffre_affaires'])
            nv = row['nb_ventes']
            results.append({
                'rang':             i,
                'client_id':        row['client_id'],
                'client_name':      row['client__name'],
                'client_type':      row['client__client_type'],
                'nb_ventes':        nv,
                'chiffre_affaires': ca,
                'panier_moyen':     round(ca / nv, 2) if nv > 0 else 0,
            })

        if fmt == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="meilleurs_clients.csv"'; response.write('\ufeff'.encode('utf8'))
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
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user_map = {u.id: (u.get_full_name() or u.username) for u in User.objects.all()}

        rows = (
            Facture.objects
            .filter(status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE], date__gte=date_debut, date__lt=date_fin)
            .values('created_by_id')
            .annotate(nbre_ventes=Count('id'), chiffre_affaires=Coalesce(Sum('total_ttc'), Value(0, output_field=DecimalField())))
            .order_by('-chiffre_affaires')
        )

        results = []
        for i, row in enumerate(rows, 1):
            vid = row['created_by_id'] or 0
            ca  = float(row['chiffre_affaires'])
            nv  = row['nbre_ventes']
            results.append({'rang': i, 'vendeur_id': vid, 'vendeur': user_map.get(vid, 'Non Attribuées'),
                            'nbre_ventes': nv, 'chiffre_affaires': ca,
                            'panier_moyen': round(ca / nv, 2) if nv > 0 else 0})
        return Response({'data': results, 'periode': {'debut': date_debut.strftime('%Y-%m-%d'), 'fin': date_fin.strftime('%Y-%m-%d'), 'type': periode}})

    @action(detail=False, methods=['get'])
    def evolution_vendeur(self, request):
        vid_param = request.query_params.get('vendeur_id')
        if not vid_param: return Response({'error': 'vendeur_id requis'}, status=400)
        from django.contrib.auth import get_user_model
        User, now = get_user_model(), timezone.now()

        # Fenêtre temporelle : 12 mois glissants
        start = timezone.make_aware(datetime((now - timedelta(days=365)).year,
                                             (now - timedelta(days=365)).month, 1))

        # Sélectionner les vendeurs ciblés
        if vid_param == 'all':
            v_list = list(User.objects.filter(
                id__in=Facture.objects.filter(
                    date__gte=now - timedelta(days=365),
                    created_by__isnull=False
                ).values_list('created_by', flat=True).distinct()
            ))
        else:
            try:
                v_list = [User.objects.get(id=int(vid_param))]
            except User.DoesNotExist:
                return Response({'error': 'Vendeur introuvable'}, status=404)

        vendeur_ids = [v.id for v in v_list]

        # ── 1 seule requête GROUP BY (created_by, mois) ──────────────────────
        rows = (
            Facture.objects
            .filter(
                status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
                date__gte=start,
                created_by_id__in=vendeur_ids,
            )
            .annotate(
                mois=TruncMonth('date')
            )
            .values('created_by_id', 'mois')
            .annotate(ca=Coalesce(Sum('total_ttc'), Value(0, output_field=DecimalField())))
            .order_by('created_by_id', 'mois')
        )

        # Indexer par (vendeur_id, 'YYYY-MM') pour lookup O(1)
        ca_map: dict[tuple, float] = {}
        for row in rows:
            key = (row['created_by_id'], row['mois'].strftime('%Y-%m'))
            ca_map[key] = float(row['ca'])

        # Construire les 12 labels mois
        m_labels = []
        for i in range(11, -1, -1):
            d = now - timedelta(days=i * 30)
            m_labels.append({
                'key': d.strftime('%Y-%m'),
                'label': date_format(d, "M Y"),
            })

        # Assembler la réponse sans aucune requête supplémentaire
        res = []
        for v in v_list:
            hist = [
                {
                    'mois': m['key'],
                    'label': m['label'],
                    'chiffre_affaires': ca_map.get((v.id, m['key']), 0.0),
                }
                for m in m_labels
            ]
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
        
        date_debut = parse_api_datetime(db_str) if db_str else timezone.now() - timedelta(days=30)
        date_fin = parse_api_datetime(df_str, end_of_day=True) if df_str else timezone.now()
        if date_debut is None or date_fin is None:
            return Response({'error': 'Dates invalides'}, status=400)

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

    @action(detail=False, methods=['get'])
    def ventes_operateur_lots(self, request):
        """
        Rapport détaillé des produits vendus par opérateur avec lots, dates de péremption,
        quantités, numéro de facture, remise et date de création.
        """
        from django.contrib.auth import get_user_model
        get_user_model()

        db_str = request.query_params.get('date_debut')
        df_str = request.query_params.get('date_fin')
        vendeur_id = request.query_params.get('vendeur_id')

        if not db_str or not df_str:
            return Response({'error': 'Dates requises'}, status=400)

        date_debut = parse_api_datetime(db_str)
        date_fin = parse_api_datetime(df_str, end_of_day=True)
        if date_debut is None or date_fin is None:
            return Response({'error': 'Date invalide'}, status=400)

        if len(df_str.strip()) > 10:
            date_fin += timedelta(minutes=1)

        qs = FactureProduit.objects.select_related(
            'produit', 'facture', 'facture__created_by', 'stock_lot'
        ).filter(
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            facture__date__gte=date_debut,
            facture__date__lt=date_fin,
            facture__is_active=True,
        )

        if vendeur_id:
            qs = qs.filter(facture__created_by_id=vendeur_id)

        qs = qs.order_by('-facture__date')

        page = self.paginator.paginate_queryset(qs, request, view=self)

        results = []
        for item in (page if page is not None else qs):
            user = item.facture.created_by
            operateur = user.get_full_name() or user.username if user else 'Non attribué'

            stock_lot = item.stock_lot
            lot_number = item.lot or (stock_lot.lot if stock_lot else '') or ''
            date_peremption = None
            if stock_lot and stock_lot.date_expiration:
                date_peremption = stock_lot.date_expiration.isoformat()
            elif item.date_expiration:
                date_peremption = item.date_expiration.isoformat()

            results.append({
                'operateur': operateur,
                'produit': item.produit.name if item.produit else (item.produit_nom or 'N/A'),
                'lot': lot_number,
                'date_peremption': date_peremption,
                'quantite': item.quantity,
                'numero_facture': item.facture.numero_facture or f'#{item.facture.id}',
                'remise': float(item.discount or 0),
                'prix_vente': float(item.selling_price or 0),
                'montant': float(item.selling_price or 0) * item.quantity,
                'date_creation': item.facture.date.isoformat() if item.facture.date else None,
            })

        return self.paginator.get_paginated_response(results) if page is not None else Response(results)
