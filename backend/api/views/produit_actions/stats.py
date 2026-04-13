from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.db.models import F, Sum, Count, Q
from django.db.models.functions import Coalesce, TruncMonth
from django.utils import timezone
from decimal import Decimal
from dateutil.relativedelta import relativedelta

from ...models import Produit, FactureProduit, CommandeProduit

class ProduitStatsMixin:
    """Mixin pour les statistiques et analyses des produits."""

    @action(detail=True, methods=['get'])
    def monthly_stats(self, request, pk=None):
        produit = self.get_object()
        
        ventes = FactureProduit.objects.filter(
            produit=produit,
            facture__status__in=['VAL', 'PAY']
        ).annotate(
            mois=TruncMonth('facture__date')
        ).values('mois').annotate(
            qte_v=Sum('quantity')
        ).order_by('-mois')
        
        commandes = CommandeProduit.objects.filter(
            produit=produit,
            commande__status='CLOT',
            commande__date_cloture__isnull=False
        ).annotate(
            mois=TruncMonth('commande__date_cloture')
        ).values('mois').annotate(
            qte_c=Sum('quantity'),
            nb_c=Count('id', distinct=True)
        ).order_by('-mois')
        
        stats_by_month = {}
        
        for v in ventes:
            if v['mois']:
                key = v['mois'].strftime('%Y-%m')
                if key not in stats_by_month:
                    stats_by_month[key] = {'year': v['mois'].year, 'month': v['mois'].month, 'qte_v': 0, 'qte_c': 0, 'nb_c': 0}
                stats_by_month[key]['qte_v'] = v['qte_v'] or 0
        
        for c in commandes:
            if c['mois']:
                key = c['mois'].strftime('%Y-%m')
                if key not in stats_by_month:
                    stats_by_month[key] = {'year': c['mois'].year, 'month': c['mois'].month, 'qte_v': 0, 'qte_c': 0, 'nb_c': 0}
                stats_by_month[key]['qte_c'] = c['qte_c'] or 0
                stats_by_month[key]['nb_c'] = c['nb_c'] or 0
        
        mois_noms = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                     'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
        
        result = []
        for key in sorted(stats_by_month.keys(), reverse=True):
            data = stats_by_month[key]
            result.append({
                'year': data['year'],
                'month': data['month'],
                'month_name': mois_noms[data['month']],
                'qte_v': data['qte_v'],
                'qte_c': data['qte_c'],
                'nb_c': data['nb_c']
            })
        
        return Response(result)

    @action(detail=False, methods=['get'])
    def stock_alerts(self, request):
        produits = Produit.objects.filter(is_active=True).filter(
            Q(stock__lt=F('rotation_moyenne'), rotation_moyenne__gt=0) |
            Q(stock__lte=F('stock_minimum'), stock_minimum__gt=0) |
            Q(stock__lt=0)
        ).order_by('name').values('id', 'name', 'stock', 'rotation_moyenne', 'stock_minimum', 'cip1')
        
        result = [
            {
                'nom_produit': p['name'],
                'cip': p['cip1'],
                'stock': p['stock'],
                'rotation': round(float(p['rotation_moyenne']), 1),
                'stock_min': p['stock_minimum']
            }
            for p in produits
        ]
        return Response(result)

    @action(detail=False, methods=['post'])
    def recalculate_rotation(self, request):
        from django.db import transaction
        try:
            today = timezone.now().date()
            
            ventes_par_produit = FactureProduit.objects.filter(
                facture__status__in=['VAL', 'PAY']
            ).values('produit_id').annotate(
                total=Sum('quantity')
            )
            
            sold_dict = {item['produit_id']: (item['total'] or 0) for item in ventes_par_produit}
            
            produits = Produit.objects.all()
            produits_to_update = []
            
            for produit in produits:
                months_since_creation = (today - produit.created_at.date()).days / 30.0
                months = max(1.0, months_since_creation)
                
                total_sold = sold_dict.get(produit.id, 0)
                rotation = float(total_sold) / months
                
                current_rotation = getattr(produit, 'rotation_moyenne', 0) or 0
                if abs(float(current_rotation) - rotation) > 0.001:
                    produit.rotation_moyenne = rotation
                    produits_to_update.append(produit)
            
            if produits_to_update:
                with transaction.atomic():
                    Produit.objects.bulk_update(produits_to_update, ['rotation_moyenne'], batch_size=1000)
                    
            return Response({'message': f'Rotation recalculée. {len(produits_to_update)} produits mis à jour sur {produits.count()}.'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def analyse_abc(self, request):
        try:
            periode = int(request.query_params.get('periode', 6))
        except ValueError:
            periode = 6
            
        rayon_id = request.query_params.get('rayon_id')
        fournisseur_id = request.query_params.get('fournisseur_id')
        
        date_debut = timezone.now() - relativedelta(months=periode)
        
        produit_filter = Q(
            facture__status__in=['VAL', 'PAY'],
            facture__date__gte=date_debut
        )
        
        if rayon_id:
            produit_filter &= Q(produit__rayon_id=rayon_id)
        if fournisseur_id:
            produit_filter &= Q(produit__fournisseur_id=fournisseur_id)
        
        ventes_par_produit = FactureProduit.objects.filter(
            produit_filter
        ).values(
            'produit', 'produit__name', 'produit__stock', 'produit__cip1', 
            'produit__selling_price', 'produit__rayon__name', 'produit__fournisseur__name'
        ).annotate(
            chiffre_affaires=Coalesce(Sum(F('quantity') * F('selling_price')), Decimal('0')),
            quantite_vendue=Coalesce(Sum('quantity'), 0)
        ).order_by('-chiffre_affaires')
        
        ca_total = sum(item['chiffre_affaires'] for item in ventes_par_produit)
        
        if ca_total == 0:
            return Response({
                'periode_mois': periode,
                'date_debut': date_debut.date().isoformat(),
                'ca_total': 0,
                'nb_produits_a': 0,
                'nb_produits_b': 0,
                'nb_produits_c': 0,
                'produits': []
            })
        
        seuil_a = Decimal('0.80')
        seuil_b = Decimal('0.95')
        
        ca_cumule = Decimal('0')
        produits_classes = []
        
        stats = {'A': 0, 'B': 0, 'C': 0}
        ca_par_categorie = {'A': Decimal('0'), 'B': Decimal('0'), 'C': Decimal('0')}
        
        for item in ventes_par_produit:
            ca_produit = item['chiffre_affaires']
            ca_cumule += ca_produit
            pourcentage_cumule = ca_cumule / ca_total
            pourcentage_ca = (ca_produit / ca_total * 100).quantize(Decimal('0.01'))
            
            if pourcentage_cumule <= seuil_a:
                categorie = 'A'
            elif pourcentage_cumule <= seuil_b:
                categorie = 'B'
            else:
                categorie = 'C'
            
            stats[categorie] += 1
            ca_par_categorie[categorie] += ca_produit
            
            produits_classes.append({
                'id': item['produit'],
                'nom': item['produit__name'],
                'cip': item['produit__cip1'] or '-',
                'rayon': item['produit__rayon__name'] or 'Sans rayon',
                'fournisseur': item['produit__fournisseur__name'] or '-',
                'stock': item['produit__stock'],
                'prix_vente': float(item['produit__selling_price'] or 0),
                'chiffre_affaires': float(ca_produit or 0),
                'quantite_vendue': item['quantite_vendue'],
                'pourcentage_ca': float(pourcentage_ca or 0),
                'pourcentage_cumule': float((pourcentage_cumule * 100).quantize(Decimal('0.01'))) if pourcentage_cumule is not None else 0.0,
                'categorie': categorie,
                'en_rupture': (item['produit__stock'] or 0) <= 0
            })
        
        produits_avec_ventes = [p['id'] for p in produits_classes]
        produits_sans_ventes_filter = ~Q(id__in=produits_avec_ventes)
        if rayon_id:
            produits_sans_ventes_filter &= Q(rayon_id=rayon_id)
        if fournisseur_id:
            produits_sans_ventes_filter &= Q(fournisseur_id=fournisseur_id)
        
        nb_produits_sans_ventes = Produit.objects.filter(produits_sans_ventes_filter).count()
        stats['C'] += nb_produits_sans_ventes
        
        include_no_sales = request.query_params.get('include_no_sales', 'false').lower() == 'true'
        limite_c = int(request.query_params.get('limite_c', 100))
        
        if include_no_sales:
            produits_sans_ventes = Produit.objects.filter(
                produits_sans_ventes_filter
            ).values('id', 'name', 'cip1', 'stock', 'selling_price', 'rayon__name', 'fournisseur__name')[:limite_c]
            
            for p in produits_sans_ventes:
                produits_classes.append({
                    'id': p['id'],
                    'nom': p['name'],
                    'cip': p['cip1'] or '-',
                    'rayon': p['rayon__name'] or 'Sans rayon',
                    'fournisseur': p['fournisseur__name'] or '-',
                    'stock': p['stock'],
                    'prix_vente': float(p['selling_price'] or 0),
                    'chiffre_affaires': 0,
                    'pourcentage_ca': 0,
                    'pourcentage_cumule': 100,
                    'categorie': 'C',
                    'en_rupture': p['stock'] <= 0
                })
        
        categorie_filter = request.query_params.get('categorie')
        if categorie_filter and categorie_filter in ['A', 'B', 'C']:
            produits_classes = [p for p in produits_classes if p['categorie'] == categorie_filter]
        
        produits_a_en_rupture = [p for p in produits_classes if p['categorie'] == 'A' and p['en_rupture']]
        
        return Response({
            'periode_mois': periode,
            'date_debut': date_debut.date().isoformat(),
            'ca_total': float(ca_total),
            'nb_produits_a': stats['A'],
            'nb_produits_b': stats['B'],
            'nb_produits_c': stats['C'],
            'nb_produits_c_sans_ventes': nb_produits_sans_ventes,
            'ca_categorie_a': float(ca_par_categorie['A']),
            'ca_categorie_b': float(ca_par_categorie['B']),
            'ca_categorie_c': float(ca_par_categorie['C']),
            'alertes_rupture_a': len(produits_a_en_rupture),
            'produits_a_en_rupture': [p['nom'] for p in produits_a_en_rupture[:5]],
            'produits': produits_classes
        })
