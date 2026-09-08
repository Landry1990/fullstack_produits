from datetime import timedelta
from decimal import Decimal

from django.db.models import (
    Case,
    Count,
    DecimalField,
    ExpressionWrapper,
    F,
    Q,
    Sum,
    Value,
    When,
)
from django.db.models.functions import Coalesce, TruncDay
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ...models import (
    Commande,
    CommandeProduit,
    Facture,
    FactureProduit,
    FactureProduitAllocation,
    ObjectifCommercial,
    Produit,
)
from ..rapports.tz_utils import parse_api_datetime


class StatistiquesViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def ca_par_fournisseur(self, request):
        # Support des deux conventions de nommage de paramètres
        start_date = request.query_params.get('date_debut') or request.query_params.get('start_date')
        end_date = request.query_params.get('date_fin') or request.query_params.get('end_date')
    
        from collections import defaultdict

        from ...models import Facture, FactureProduit
    
        # Filtre de base pour les factures
        factures_q = Q(status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE])
    
        if start_date:
            d_debut = parse_api_datetime(start_date)
            if d_debut:
                factures_q &= Q(date__gte=d_debut)

        if end_date:
            d_fin = parse_api_datetime(end_date, end_of_day=True)
            if d_fin:
                factures_q &= Q(date__lte=d_fin)
    
        # 1. Identifier les IDs des factures concernées
        facture_ids = Facture.objects.filter(factures_q).values_list('id', flat=True)
    
        # 2. Récupérer les lignes de facture avec les infos nécessaires
        lignes = FactureProduit.objects.filter(facture_id__in=facture_ids).values(
            'id', 'quantity', 'selling_price', 'discount', 
            'facture__id', 'facture__remise',
            'produit__fournisseur__id', 'produit__fournisseur__name'
        )
    
        # 3. Récupérer les allocations pour la traçabilité FIFO/FEFO
        allocations = FactureProduitAllocation.objects.filter(
            facture_produit__facture_id__in=facture_ids
        ).values(
            'facture_produit__id', 'quantity', 'cost_price', 
            'stock_lot__fournisseur__id', 'stock_lot__fournisseur__name'
        )
    
        # Organisation en map pour un accès rapide
        alloc_map = defaultdict(list)
        for a in allocations:
            alloc_map[a['facture_produit__id']].append(a)
    
        # Calcul du brut total par facture pour la répartition de la remise globale
        facture_bruts = defaultdict(Decimal)
        for l in lignes:
            facture_bruts[l['facture__id']] += l['quantity'] * (l['selling_price'] - l['discount'])
    
        stats_fournisseur = defaultdict(lambda: {
            'ca_ttc': Decimal('0.00'), 'cout_achat': Decimal('0.00'), 
            'quantite_vendue': 0, 'nom': 'Inconnu'
        })
    
        for l in lignes:
            line_gross = l['quantity'] * (l['selling_price'] - l['discount'])
            total_gross_facture = facture_bruts[l['facture__id']]
    
            # Ratio pour la remise globale (proportionnelle au brut TTC de la ligne)
            ratio = line_gross / total_gross_facture if total_gross_facture > 0 else Decimal('0.00')
            part_remise = (l['facture__remise'] or Decimal(0)) * ratio
            line_net = line_gross - part_remise
    
            line_allocs = alloc_map.get(l['id'], [])
    
            if not line_allocs:
                # Fallback sur le fournisseur par défaut du produit
                fid = l['produit__fournisseur__id'] or 0
                fname = l['produit__fournisseur__name'] or 'Inconnu'
                stats_fournisseur[fid]['ca_ttc'] += line_net
                stats_fournisseur[fid]['quantite_vendue'] += l['quantity']
                stats_fournisseur[fid]['nom'] = fname
            else:
                total_qty_alloc = sum(a['quantity'] for a in line_allocs)
                for a in line_allocs:
                    # Répartition du net de la ligne au prorata de la quantité du lot
                    ratio_alloc = Decimal(a['quantity']) / Decimal(total_qty_alloc) if total_qty_alloc > 0 else Decimal(0)
                    alloc_net = line_net * ratio_alloc
                    alloc_cost = a['quantity'] * a['cost_price']
    
                    # Le fournisseur du lot est prioritaire, sinon celui du produit
                    fid = a['stock_lot__fournisseur__id'] or l['produit__fournisseur__id'] or 0
                    fname = a['stock_lot__fournisseur__name'] or l['produit__fournisseur__name'] or 'Inconnu'
    
                    stats_fournisseur[fid]['ca_ttc'] += alloc_net
                    stats_fournisseur[fid]['cout_achat'] += alloc_cost
                    stats_fournisseur[fid]['quantite_vendue'] += a['quantity']
                    stats_fournisseur[fid]['nom'] = fname
    
        # Formatage du résultat final
        resultat = []
        for fid, s in stats_fournisseur.items():
            ca_ttc = s['ca_ttc']
            cout_achat = s['cout_achat']
            marge_brute = ca_ttc - cout_achat
            resultat.append({
                'id': fid,
                'nom': s['nom'],
                'ca_ttc': float(ca_ttc),
                'cout_achat': float(cout_achat),
                'marge_brute': float(marge_brute),
                'quantite_vendue': s['quantite_vendue']
            })
    
        return Response(sorted(resultat, key=lambda x: x['ca_ttc'], reverse=True))
    
    @action(detail=False, methods=['get'])
    def cancel_alerts(self, request):
        """
        Retourne la liste des utilisateurs ayant annulé plus de X factures
        sur une période donnée.
        """
        from django.contrib.auth.models import User

        from ...models import AuditLog
    
        threshold = int(request.query_params.get('threshold', 5))
        days = int(request.query_params.get('days', 30))
    
        start_date = timezone.localtime(timezone.now()) - timedelta(days=days)
    
        # Compter les annulations par utilisateur
        cancellations = AuditLog.objects.filter(
            action=AuditLog.Action.INVOICE_CANCEL,
            timestamp__gte=start_date
        ).values('user').annotate(
            count=Count('id')
        ).filter(count__gte=threshold).order_by('-count')
    
        # Charger tous les utilisateurs concernés en une seule fois
        user_ids = [c['user'] for c in cancellations if c['user']]
        users_map = {}
        if user_ids:
            users = User.objects.filter(id__in=user_ids)
            users_map = {u.id: (u.get_full_name() or u.username) for u in users}
    
        results = []
        for c in cancellations:
            user_id = c['user']
            if not user_id:
                name = "Système / Inconnu"
            else:
                name = users_map.get(user_id, f"Utilisateur #{user_id}")
    
            # Note: total_amount might need cleaner extraction depending on DB/Django version JSONField support
            # For now returning count is the MVP
            results.append({
                'Utilisateur': name,
                'Nombre Annulations': c['count'],
                'Période (jours)': days,
                'Seuil': threshold
            })
    
        return Response(results)
    
    @action(detail=False, methods=['get'])
    def stock_health(self, request):
        """
        Analyse experte de la santé du stock.
        Calcul du capital dormant, des pertes sur ruptures et du score de santé global.
        """
        from api.models.settings import PharmacySettings
        ps = PharmacySettings.objects.first()
    
        # 1. Capital Dormant
        today = timezone.localtime(timezone.now()).date()
        dormant_days = ps.dormant_stock_days if (ps and ps.dormant_stock_days) else 90
        limit_date = today - timedelta(days=dormant_days)
    
        dormant_qs = Produit.objects.filter(stock__gt=0, is_active=True).filter(
            Q(dernier_vente__lte=limit_date) | 
            (Q(dernier_vente__isnull=True) & Q(dernier_achat__lte=limit_date)) |
            (Q(dernier_vente__isnull=True) & Q(dernier_achat__isnull=True) & Q(created_at__date__lte=limit_date))
        )
    
        dead_stock_value = dormant_qs.aggregate(
            total=Coalesce(Sum(ExpressionWrapper(F('stock') * F('pmp'), output_field=DecimalField())), Decimal(0))
        )['total']
    
        dead_stock_count = dormant_qs.count()
    
        # 2. Pertes Estimées sur Ruptures (Ventes manquées)
        rupture_qs = Produit.objects.filter(stock__lte=0, rotation_moyenne__gt=0, is_active=True)
    
        lost_revenue_monthly = rupture_qs.aggregate(
            total=Coalesce(Sum(ExpressionWrapper(F('rotation_moyenne') * F('selling_price'), output_field=DecimalField())), Decimal(0))
        )['total']
    
        lost_margin_monthly = rupture_qs.aggregate(
            total=Coalesce(Sum(ExpressionWrapper(F('rotation_moyenne') * (F('selling_price') - F('pmp')), output_field=DecimalField())), Decimal(0))
        )['total']
    
        # 3. Ruptures Imminentes — aligné sur l'onglet Ruptures (ventes réelles pondérées)
        critical_days = ps.critical_stock_days if (ps and ps.critical_stock_days) else 7
        date_30_days_ago = today - timedelta(days=30)
        date_7_days_ago = today - timedelta(days=7)

        ventes_recentes = (
            FactureProduit.objects
            .filter(
                facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
                facture__date__date__gte=date_7_days_ago,
                produit__isnull=False
            )
            .values('produit_id')
            .annotate(total_vendu=Sum('quantity'))
        )
        map_recentes = {v['produit_id']: v['total_vendu'] for v in ventes_recentes}

        ventes_anciennes = (
            FactureProduit.objects
            .filter(
                facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
                facture__date__date__gte=date_30_days_ago,
                facture__date__date__lt=date_7_days_ago,
                produit__isnull=False
            )
            .values('produit_id')
            .annotate(total_vendu=Sum('quantity'))
        )
        map_anciennes = {v['produit_id']: v['total_vendu'] for v in ventes_anciennes}

        commandes_en_cours = (
            CommandeProduit.objects
            .filter(
                commande__status__in=[Commande.Status.EN_PREPARATION, Commande.Status.EN_ATTENTE],
                produit__isnull=False
            )
            .values('produit_id')
            .annotate(
                qte_commandee=Sum('quantity'),
                ug_commandees=Sum('unites_gratuites')
            )
        )
        {
            c['produit_id']: (c['qte_commandee'] or 0) + (c['ug_commandees'] or 0)
            for c in commandes_en_cours
        }

        critical_soon_count = 0
        critical_soon_value = Decimal(0)
        produits_actifs = Produit.objects.filter(stock__gt=0, is_active=True).select_related('fournisseur')
        for produit in produits_actifs:
            vendu_recent = map_recentes.get(produit.id, 0)
            vendu_ancien = map_anciennes.get(produit.id, 0)

            if vendu_recent + vendu_ancien <= 0:
                continue

            taux_journalier_recent = vendu_recent / 7.0
            taux_journalier_ancien = vendu_ancien / 23.0 if vendu_ancien > 0 else 0
            if taux_journalier_ancien > 0:
                ventes_jour = (taux_journalier_recent * 2 + taux_journalier_ancien) / 3.0
            else:
                ventes_jour = taux_journalier_recent

            if ventes_jour <= 0:
                continue

            jours_avant_rupture = produit.stock / ventes_jour
            if jours_avant_rupture < critical_days:
                critical_soon_count += 1
                critical_soon_value += Decimal(str(produit.stock)) * Decimal(str(produit.pmp or 0))
    
        # 4. Score de Santé Global — 5 composantes dynamiques
        Produit.objects.filter(is_active=True).count() or 1
        total_stock_value = Produit.objects.filter(is_active=True, stock__gt=0).aggregate(
            total=Coalesce(Sum(ExpressionWrapper(F('stock') * F('pmp'), output_field=DecimalField())), Decimal(0))
        )['total'] or Decimal(1)

        # ── Définition des produits pertinents ─────────────────────────────────
        # Un produit est pertinent s'il est en stock OU a eu de l'activité récente (vente/achat < 90j)
        relevant_days = 90
        relevant_cutoff = today - timedelta(days=relevant_days)
        relevant_qs = Produit.objects.filter(
            is_active=True
        ).filter(
            Q(stock__gt=0) |
            Q(dernier_vente__gte=relevant_cutoff) |
            Q(dernier_achat__gte=relevant_cutoff)
        )
        relevant_count = relevant_qs.count() or 1

        # ── Composante A : Disponibilité (pas de rupture) — 30 pts ──────────────
        # Disponibilité = % des produits pertinents qui sont actuellement en stock
        available_relevant_count = relevant_qs.filter(stock__gt=0).count()
        availability_rate = (float(available_relevant_count) / float(relevant_count)) * 100
        relevant_qs.filter(stock__lte=0).count()
        score_a = availability_rate * 0.30  # max 30 pts
    
        # ── Composante B : Fluidité du stock (peu de stock dormant) — 25 pts ────
        produits_avec_rotation = Produit.objects.filter(is_active=True, rotation_moyenne__gt=0).count() or 1
        dormant_avec_rotation = dormant_qs.filter(rotation_moyenne__gt=0).count()
        fluidity_rate = (1 - float(dormant_avec_rotation) / float(produits_avec_rotation)) * 100
        fluidity_rate = max(0.0, min(100.0, fluidity_rate))
        score_b = fluidity_rate * 0.25  # max 25 pts
    
        # ── Composante C : Couverture de stock (ni sur-stock ni sous-stock) — 20 pts
        min_coverage = ps.good_coverage_min_days if (ps and ps.good_coverage_min_days) else 15
        max_coverage = ps.good_coverage_max_days if (ps and ps.good_coverage_max_days) else 90
        produits_avec_rot = Produit.objects.filter(is_active=True, rotation_moyenne__gt=0, stock__gt=0)
        bonne_couverture = 0
        for p in produits_avec_rot:
            daily = float(p.rotation_moyenne) / 30.0
            if daily > 0:
                jours = float(p.stock) / daily
                if min_coverage <= jours <= max_coverage:
                    bonne_couverture += 1
        total_avec_rot = produits_avec_rot.count() or 1
        coverage_rate = (bonne_couverture / total_avec_rot) * 100
        score_c = coverage_rate * 0.20  # max 20 pts
    
        # ── Composante D : Activité récente des ventes (30 derniers jours) — 15 pts
        thirty_days_ago = today - timedelta(days=30)
        produits_vendus_recemment = Produit.objects.filter(
            is_active=True, rotation_moyenne__gt=0,
            dernier_vente__gte=thirty_days_ago
        ).count()
        activity_rate = (float(produits_vendus_recemment) / float(produits_avec_rotation)) * 100
        activity_rate = min(100.0, activity_rate)
        score_d = activity_rate * 0.15  # max 15 pts
    
        # ── Composante E : Pas de sur-immobilisation financière — 10 pts ─────────
        # Ratio stock dormant / valeur totale du stock (avec rotation comme filtre)
        dead_stock_value_rot = dormant_qs.filter(rotation_moyenne__gt=0).aggregate(
            total=Coalesce(Sum(ExpressionWrapper(F('stock') * F('pmp'), output_field=DecimalField())), Decimal(0))
        )['total'] or Decimal(0)
        immo_ratio = float(dead_stock_value_rot) / float(total_stock_value)
        immo_score = max(0.0, (1 - immo_ratio)) * 100
        score_e = immo_score * 0.10  # max 10 pts
    
        # ── Top 5 Pénalités ──────────────────────────────────────────────────────
        # Réutilise rupture_qs et dormant_qs déjà calculés pour éviter un appel API supplémentaire
        penalties = []
        for p in rupture_qs.filter(rotation_moyenne__gt=1):
            penalties.append({
                'id': p.id,
                'name': p.name or '',
                'cip': p.cip1 or '',
                'quadrant': 'HEMORRAGIE',
                'days_since_sale': 0,
                'stock_value': 0.0,
                'impact_pts': -2.5,
                'rotation': round(float(p.rotation_moyenne or 0), 1),
                'days_until_stockout': 0,
            })
        for p in dormant_qs.filter(rotation_moyenne__gt=0):
            last_sale = p.dernier_vente
            days_since_sale = max(0, (today - last_sale).days) if last_sale else dormant_days
            stock_value = float(p.stock) * float(p.pmp or 0)
            impact_pts = round(-1.8 * stock_value / 100000, 1)
            penalties.append({
                'id': p.id,
                'name': p.name or '',
                'cip': p.cip1 or '',
                'quadrant': 'SOMNIFERE',
                'days_since_sale': days_since_sale,
                'stock_value': stock_value,
                'impact_pts': impact_pts,
                'rotation': round(float(p.rotation_moyenne or 0), 1),
                'days_until_stockout': None,
            })
        penalties.sort(key=lambda x: x['impact_pts'])
        top_penalties = penalties[:5]

        # ── Score final ──────────────────────────────────────────────────────────
        health_score_raw = score_a + score_b + score_c + score_d + score_e
        health_score = max(0.0, min(100.0, health_score_raw))

        # Rotation = part des produits actuellement en stock qui ont généré des ventes sur les 30 derniers jours
        produits_en_stock_ids = set(
            Produit.objects.filter(is_active=True, stock__gt=0).values_list('id', flat=True)
        )
        produits_avec_ventes_recentes = len(
            (set(map_recentes.keys()) | set(map_anciennes.keys())) & produits_en_stock_ids
        )
        produits_en_stock_count = len(produits_en_stock_ids) or 1
        rotation_rate = (produits_avec_ventes_recentes / produits_en_stock_count) * 100

        # Poids (pour l'affichage UI — on garde les settings mais la formule est fixe maintenant)
        avail_weight = Decimal(str(ps.availability_weight)) / Decimal('100.0') if ps else Decimal('0.6')
        rot_weight = Decimal(str(ps.rotation_weight)) / Decimal('100.0') if ps else Decimal('0.4')

        rupture_rate = 100.0 - availability_rate

        return Response({
            'health_score': round(float(health_score), 1),
            'availability_rate': round(float(availability_rate), 1),
            'rotation_rate': round(float(rotation_rate), 1),
            'rupture_rate': round(float(rupture_rate), 1),
            'availability_weight': int(avail_weight * 100),
            'rotation_weight': int(rot_weight * 100),
            'score_details': {
                'disponibilite': {'score': round(score_a, 1), 'rate': round(availability_rate, 1), 'weight': 30},
                'fluidite':      {'score': round(score_b, 1), 'rate': round(fluidity_rate, 1),    'weight': 25},
                'couverture':    {'score': round(score_c, 1), 'rate': round(coverage_rate, 1),    'weight': 20},
                'activite':      {'score': round(score_d, 1), 'rate': round(activity_rate, 1),    'weight': 15},
                'immobilisation':{'score': round(score_e, 1), 'rate': round(immo_score, 1),       'weight': 10},
            },
            'dead_stock': {
                'value': float(dead_stock_value),
                'count': dead_stock_count,
                'days_threshold': dormant_days
            },
            'missed_sales': {
                'monthly_revenue': float(lost_revenue_monthly),
                'monthly_margin': float(lost_margin_monthly),
                'daily_revenue': float(lost_revenue_monthly) / 30.0
            },
            'critical_alerts': {
                'soon_out_of_stock_count': critical_soon_count,
                'soon_out_of_stock_value': float(critical_soon_value),
                'rupture_count': len([p for p in penalties if p['quadrant'] == 'HEMORRAGIE']),
            },
            'top_penalties': top_penalties,
            'total_stock_value': float(total_stock_value)
        })

    @action(detail=False, methods=['get'])
    def vendeur_stats(self, request):
        """
        Dashboard personnalisé pour un vendeur/caissier.
        CA perso jour/semaine/mois, rang classement, objectif, sparkline 7j, top produits perso.
        """
        user = request.user
        now = timezone.localtime(timezone.now())
        today = now.date()
        start_of_week = today - timedelta(days=today.weekday())
        start_of_month = today.replace(day=1)
        start_7d = today - timedelta(days=6)
    
    
        # ── 1. CA & ventes personnels ─────────────────────────────────────
        user_qs = Facture.objects.filter(
            created_by=user,
            status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            date__date__gte=start_of_month,
        )
        personal = user_qs.aggregate(
            ca_jour=Coalesce(Sum(Case(When(date__date=today, then=F('total_ttc')), default=Value(0, output_field=DecimalField()))), Decimal(0)),
            nb_jour=Count(Case(When(date__date=today, then=Value(1)))),
            ca_sem=Coalesce(Sum(Case(When(date__date__gte=start_of_week, then=F('total_ttc')), default=Value(0, output_field=DecimalField()))), Decimal(0)),
            nb_sem=Count(Case(When(date__date__gte=start_of_week, then=Value(1)))),
            ca_mois=Coalesce(Sum(F('total_ttc')), Decimal(0)),
            nb_mois=Count('id'),
        )
        ca_jour = personal['ca_jour']
        nb_jour = personal['nb_jour']
        ca_sem  = personal['ca_sem']
        nb_sem  = personal['nb_sem']
        ca_mois = personal['ca_mois']
        nb_mois = personal['nb_mois']
        panier_jour = float(ca_jour / nb_jour) if nb_jour > 0 else 0.0
        panier_mois = float(ca_mois / nb_mois) if nb_mois > 0 else 0.0
    
        # ── 2. Rang dans le classement du mois ───────────────────────────
        classement_mois = list(
            Facture.objects.filter(
                status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
                date__date__gte=start_of_month,
                date__date__lte=today,
            )
            .values('created_by_id')
            .annotate(ca=Coalesce(Sum('total_ttc'), Value(0, output_field=DecimalField())))
            .order_by('-ca')
        )
        rang = None
        total_vendeurs = len(classement_mois)
        for i, row in enumerate(classement_mois, 1):
            if row['created_by_id'] == user.id:
                rang = i
                break
    
        # ── 3. Objectif du jour ──────────────────────────────────────────
        objectifs = ObjectifCommercial.get_objectifs_courants()
        obj_jour = objectifs['jour'].ca_objectif if objectifs['jour'] else Decimal(0)
        nb_actifs = max(total_vendeurs, 1)
        objectif_perso = float(obj_jour / nb_actifs) if obj_jour > 0 else 0.0
        progression_perso = float((ca_jour / Decimal(str(objectif_perso))) * 100) if objectif_perso > 0 else 0.0
        progression_global = float((ca_jour / obj_jour) * 100) if obj_jour > 0 else 0.0
    
        # ── 4. Sparkline 7 jours ─────────────────────────────────────────
        daily_qs = (
            Facture.objects.filter(
                created_by=user,
                status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
                date__date__gte=start_7d,
                date__date__lte=today,
            )
            .annotate(day=TruncDay('date'))
            .values('day')
            .annotate(
                ca=Coalesce(Sum('total_ttc'), Decimal(0)),
                nb=Count('id'),
            )
            .order_by('day')
        )
        day_map = {item['day'].date(): {'ca': float(item['ca']), 'nb': item['nb']} for item in daily_qs}
        DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
        sparkline = []
        cur = start_7d
        while cur <= today:
            d = day_map.get(cur, {'ca': 0, 'nb': 0})
            sparkline.append({'label': DAY_NAMES[cur.weekday()], 'ca': d['ca'], 'nb': d['nb'], 'is_today': cur == today})
            cur += timedelta(days=1)
    
        # ── 5. Top 5 produits perso (mois) ───────────────────────────────
        top_produits = (
            FactureProduit.objects.filter(
                facture__created_by=user,
                facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
                facture__date__date__gte=start_of_month,
            )
            .values('produit_id', 'produit__name')
            .annotate(
                qty=Sum('quantity'),
                revenue=Coalesce(Sum(F('quantity') * (F('selling_price') - F('discount'))), Decimal(0)),
            )
            .order_by('-revenue')[:5]
        )
        top_produits_data = [
            {'id': p['produit_id'], 'name': p['produit__name'] or '—', 'qty': int(p['qty']), 'revenue': float(p['revenue'])}
            for p in top_produits
        ]
    
        # ── 6. Dernière vente ────────────────────────────────────────────
        derniere = (
            Facture.objects.filter(
                created_by=user,
                status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            )
            .order_by('-date')
            .values('date', 'numero_facture', 'total_ttc')
            .first()
        )
        derniere_vente = None
        if derniere:
            derniere_vente = {
                'numero': derniere['numero_facture'],
                'montant': float(derniere['total_ttc']),
                'date': derniere['date'].isoformat(),
            }
    
        return Response({
            'vendeur': user.get_full_name() or user.username,
            'ca_jour': float(ca_jour),
            'nb_jour': nb_jour,
            'panier_jour': panier_jour,
            'ca_sem': float(ca_sem),
            'nb_sem': nb_sem,
            'ca_mois': float(ca_mois),
            'nb_mois': nb_mois,
            'panier_mois': panier_mois,
            'rang': rang,
            'total_vendeurs': total_vendeurs,
            'objectif_jour_global': float(obj_jour),
            'objectif_jour_perso': objectif_perso,
            'progression_perso': round(progression_perso, 1),
            'progression_global': round(progression_global, 1),
            'sparkline': sparkline,
            'top_produits': top_produits_data,
            'derniere_vente': derniere_vente,
        })
    
