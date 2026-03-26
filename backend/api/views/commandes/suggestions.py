from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta, datetime

from ...models import Produit, Facture, FactureProduit


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generer_suggestions_commande(request):
    """
    Génère des suggestions de commandes selon le mode choisi.
    Supporte un budget_max optionnel pour limiter le montant total HT.
    """
    mode = request.data.get('mode', 'simple')
    periode = int(request.data.get('periode', 30))
    fournisseur_id = request.data.get('fournisseur_id')
    budget_max = request.data.get('budget_max')  # Optionnel, en HT
    
    # Convertir budget en float si fourni
    if budget_max:
        try:
            budget_max = float(budget_max)
        except (ValueError, TypeError):
            budget_max = None
    
    if mode == 'ventes_horaire':
        date_debut = request.data.get('date_debut')
        date_fin = request.data.get('date_fin')
        if not date_debut or not date_fin:
            return Response({'error': 'date_debut et date_fin sont requis pour le mode ventes_horaire'}, status=400)
        suggestions, total_ht = calculer_ventes_tranche_horaire(
            date_debut=date_debut,
            date_fin=date_fin,
            fournisseur_id=fournisseur_id
        )
    elif mode == 'simple':
        suggestions, total_ht = calculer_reapprovisionnement_simple(
            periode=periode,
            fournisseur_id=fournisseur_id,
            budget_max=budget_max
        )
    else:
        suggestions, total_ht = calculer_optimisation_intelligente(
            periode=periode,
            fournisseur_id=fournisseur_id,
            budget_max=budget_max
        )
    
    # ── Enrichir avec indicateurs Promis & Rupture Fournisseur ──
    if suggestions:
        from django.db.models import Sum, Q
        from api.models import Promis, RuptureFournisseur
        
        produit_ids = [s['produit_id'] for s in suggestions]
        
        # Promis en attente: agrège quantité par produit
        promis_qs = Promis.objects.filter(
            produit_id__in=produit_ids,
            status=Promis.Status.EN_ATTENTE
        ).values('produit_id').annotate(total_promis=Sum('quantite'))
        promis_map = {p['produit_id']: p['total_promis'] for p in promis_qs}
        
        # Ruptures fournisseur actives
        rupture_ids = set(RuptureFournisseur.objects.filter(
            produit_id__in=produit_ids,
            est_resolu=False
        ).values_list('produit_id', flat=True))
        
        for s in suggestions:
            pid = s['produit_id']
            s['promis_count'] = promis_map.get(pid, 0)
            s['en_rupture_fournisseur'] = pid in rupture_ids
    
    return Response({
        'mode': mode,
        'periode': periode,
        'budget_max': budget_max,
        'total_ht': total_ht,
        'suggestions': suggestions,
        'total_produits': len(suggestions)
    })


def calculer_reapprovisionnement_simple(periode, fournisseur_id=None, budget_max=None):
    """
    Calcul simple : Qté = Quantité vendue sur la période.
    On remplace exactement ce qui est sorti.
    Si budget_max est fourni, on priorise les meilleurs vendeurs.
    """
    date_debut = timezone.now() - timedelta(days=periode)
    from django.db.models import Sum, Q
    
    # Récupérer tous les produits
    produits = Produit.objects.all()
    fournisseur_obj = None
    if fournisseur_id:
        from api.models import Fournisseur, StockLot
        fournisseur_obj = Fournisseur.objects.filter(id=fournisseur_id).first()
        lots_produit_ids = set(StockLot.objects.filter(fournisseur_id=fournisseur_id).values_list('produit_id', flat=True))
        produits = produits.filter(
            Q(fournisseur_id=fournisseur_id) | Q(id__in=lots_produit_ids)
        )
        
    produits = produits.annotate(
        ventes_periode=Sum('factureproduit__quantity', filter=Q(
            factureproduit__facture__date__gte=date_debut,
            factureproduit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ))
    )
    
    suggestions = []
    
    for produit in produits:
        # Récupérer l'annotation calculée
        ventes = produit.ventes_periode or 0
        
        stock_actuel = produit.stock or 0
        
        # Réassort simple = on commande exactement ce qu'on a vendu
        qte_a_commander = int(ventes)
        
        # Calculer le montant HT
        prix_achat = float(produit.cost_price or 0)
        montant_ht = prix_achat * qte_a_commander
        
        # Calculer la raison
        raison = f"Vendu: {int(ventes)} unités sur {periode}j"
        if stock_actuel <= 0:
            raison += " (RUPTURE)"
        elif stock_actuel < ventes:
            raison += f" | Stock restant: {int(stock_actuel)}"
        
        # Ne garder que les produits avec des ventes ET quantité > 0
        if ventes > 0 and qte_a_commander > 0:
            suggestions.append({
                'produit_id': produit.id,
                'produit_nom': produit.name,
                'produit_ref': produit.cip1 or '',
                'fournisseur_id': fournisseur_obj.id if fournisseur_obj else (produit.fournisseur.id if produit.fournisseur else None),
                'fournisseur_nom': fournisseur_obj.name if fournisseur_obj else (produit.fournisseur.name if produit.fournisseur else 'N/A'),
                'stock_actuel': int(stock_actuel),
                'ventes_periode': int(ventes),
                'quantite_suggeree': qte_a_commander,
                'prix_achat': prix_achat,
                'montant_ht': montant_ht,
                'prix_vente': float(produit.selling_price or 0),
                'tva': str(produit.tva or '0'),
                'taux_marge': str(produit.taux_marge or '1.3'),
                'rotation': 'N/A',
                'tendance': 'N/A',
                'urgence': 'urgent' if stock_actuel <= 0 else 'normal',
                'couverture_jours': int((stock_actuel / ventes) * periode) if ventes > 0 else 999,
                'is_supplier_exclusive': produit.is_supplier_exclusive,
                'exclusive_fournisseur_nom': produit.fournisseur.name if (produit.is_supplier_exclusive and produit.fournisseur) else None,
                'raison': raison
            })
    
    # Trier par ventes élevées (priorité selon demande utilisateur)
    suggestions.sort(key=lambda x: -x['ventes_periode'])
    
    # Appliquer le budget max si fourni
    if budget_max and budget_max > 0:
        filtered_suggestions = []
        cumul_ht = 0.0
        
        for item in suggestions:
            cost = item['montant_ht']
            
            if cumul_ht + cost <= budget_max * 1.05:  # Tolérance 5% pour le total
                filtered_suggestions.append(item)
                cumul_ht += cost
            else:
                # Essayer d'ajouter une quantité partielle
                remaining = budget_max - cumul_ht
                unit_price = item['prix_achat']
                
                if unit_price > 0 and remaining > 0:
                    qty_possible = int(remaining // unit_price)
                    # Si on peut en prendre au moins 1 et que ça en vaut la peine
                    if qty_possible > 0:
                        item['quantite_suggeree'] = qty_possible
                        item['montant_ht'] = qty_possible * unit_price
                        item['raison'] += " (Budget)"
                        filtered_suggestions.append(item)
                        cumul_ht += item['montant_ht']
                
                # On arrête dès qu'on ne peut plus ajouter un article complet ou partiel prioritaire
                break
        
        return filtered_suggestions, round(cumul_ht, 2)
    
    # Calculer le total HT
    total_ht = sum(item['montant_ht'] for item in suggestions)
    return suggestions, round(total_ht, 2)


def calculer_optimisation_intelligente(periode, fournisseur_id=None, budget_max=None):
    """
    Calcul optimisé avec rotation, tendances, stock.
    Stock cible = période sélectionnée (en jours de consommation).
    Si budget_max est fourni, on priorise les produits à plus fortes ventes.
    """
    # Utiliser une période d'analyse plus longue (30j minimum) pour des stats fiables
    periode_analyse = max(periode, 30)
    date_debut = timezone.now() - timedelta(days=periode_analyse)
    date_mi_periode = timezone.now() - timedelta(days=periode_analyse // 2)
    from django.db.models import Sum, Q

    produits = Produit.objects.all()
    fournisseur_obj = None
    if fournisseur_id:
        from api.models import Fournisseur, StockLot
        from django.db.models import Q
        fournisseur_obj = Fournisseur.objects.filter(id=fournisseur_id).first()
        lots_produit_ids = set(StockLot.objects.filter(fournisseur_id=fournisseur_id).values_list('produit_id', flat=True))
        produits = produits.filter(
            Q(fournisseur_id=fournisseur_id) | Q(id__in=lots_produit_ids)
        )
        
    produits = produits.annotate(
        ventes_total_annotation=Sum('factureproduit__quantity', filter=Q(
            factureproduit__facture__date__gte=date_debut,
            factureproduit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        )),
        ventes_recentes_annotation=Sum('factureproduit__quantity', filter=Q(
            factureproduit__facture__date__gte=date_mi_periode,
            factureproduit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ))
    )
    
    suggestions = []
    
    for produit in produits:
        # 1. Ventes totales sur période d'analyse
        ventes_total = produit.ventes_total_annotation or 0
        
        if ventes_total == 0:
            continue
        
        # 2. Consommation journalière moyenne
        conso_jour = float(ventes_total) / periode_analyse
        
        # 3. Stock actuel
        stock_actuel = int(produit.stock or 0)
        
        # 4. Couverture actuelle en jours
        if conso_jour > 0:
            couverture_jours = stock_actuel / conso_jour
        else:
            couverture_jours = 999
        
        # 5. Rotation (ventes / stock moyen)
        stock_moyen = max(stock_actuel, 1)
        rotation = float(ventes_total) / stock_moyen
        
        # 6. Tendance (période récente vs ancienne)
        ventes_recentes = produit.ventes_recentes_annotation or 0
        
        ventes_anciennes = ventes_total - ventes_recentes
        if ventes_anciennes > 0:
            tendance = ventes_recentes / ventes_anciennes
        else:
            tendance = 1.0 if ventes_recentes > 0 else 0
        
        # 7. Stock cible = consommation journalière × période demandée
        stock_cible = conso_jour * periode
        qte_base = max(0, stock_cible - stock_actuel)
        
        # Ajustement selon rotation
        if rotation > 3:  # Haute rotation
            qte_base *= 1.2
            niveau_rotation = 'haute'
        elif rotation < 1:  # Faible rotation
            qte_base *= 0.8
            niveau_rotation = 'faible'
        else:
            niveau_rotation = 'normale'
        
        # Ajustement selon tendance
        qte_base *= min(tendance, 2.0)  # Plafonner à 2x pour éviter les excès
        
        qte_finale = int(round(qte_base))
        
        # Déterminer urgence selon la couverture vs période demandée
        ratio_couverture = couverture_jours / periode if periode > 0 else 999
        if ratio_couverture < 0.25:  # Moins de 25% de la période couverte
            urgence = 'urgent'
            score_urgence = 80
        elif ratio_couverture < 0.5:  # Moins de 50%
            urgence = 'bientot'
            score_urgence = 50
        else:
            urgence = 'normal'
            score_urgence = 20
        
        # Construire la raison
        raison = f"Couverture: {int(couverture_jours)}j/{periode}j. "
        if niveau_rotation == 'haute':
            raison += "Rotation élevée (+20%). "
        elif niveau_rotation == 'faible':
            raison += "Rotation faible (-20%). "
        if tendance > 1.2:
            raison += f"Tendance hausse (+{int((tendance-1)*100)}%)."
        elif tendance < 0.8:
            raison += f"Tendance baisse ({int((tendance-1)*100)}%)."
        
        # Calculer montant HT
        prix_achat = float(produit.cost_price or 0)
        qte_finale_finale = max(qte_finale, 0)
        montant_ht = prix_achat * qte_finale_finale
        
        # Ne garder que les produits avec quantité suggérée > 0
        if qte_finale_finale > 0:
            suggestions.append({
                'produit_id': produit.id,
                'produit_nom': produit.name,
                'produit_ref': produit.cip1 or '',
                'fournisseur_id': fournisseur_obj.id if fournisseur_obj else (produit.fournisseur.id if produit.fournisseur else None),
                'fournisseur_nom': fournisseur_obj.name if fournisseur_obj else (produit.fournisseur.name if produit.fournisseur else 'N/A'),
                'stock_actuel': stock_actuel,
                'ventes_periode': int(ventes_total),
                'quantite_suggeree': qte_finale_finale,
                'prix_achat': prix_achat,
                'montant_ht': montant_ht,
                'prix_vente': float(produit.selling_price or 0),
                'tva': str(produit.tva or '0'),
                'taux_marge': str(produit.taux_marge or '1.3'),
                'rotation': niveau_rotation,
                'tendance': round(tendance, 2),
                'urgence': urgence,
                'score_urgence': score_urgence,
                'couverture_jours': int(couverture_jours),
                'is_supplier_exclusive': produit.is_supplier_exclusive,
                'exclusive_fournisseur_nom': produit.fournisseur.name if (produit.is_supplier_exclusive and produit.fournisseur) else None,
                'raison': raison
            })
    
    # Trier par ventes élevées (priorité selon demande utilisateur)
    suggestions.sort(key=lambda x: -x['ventes_periode'])
    
    # Appliquer le budget max si fourni
    if budget_max and budget_max > 0:
        filtered_suggestions = []
        cumul_ht = 0.0
        
        for item in suggestions:
            cost = item['montant_ht']
            
            if cumul_ht + cost <= budget_max * 1.05:  # Tolérance 5%
                filtered_suggestions.append(item)
                cumul_ht += cost
            else:
                 # Essayer d'ajouter une quantité partielle
                remaining = budget_max - cumul_ht
                unit_price = item['prix_achat']
                
                if unit_price > 0 and remaining > 0:
                    qty_possible = int(remaining // unit_price)
                    # Si on peut en prendre au moins 1
                    if qty_possible > 0:
                        item['quantite_suggeree'] = qty_possible
                        item['montant_ht'] = qty_possible * unit_price
                        item['raison'] += " (Budget)"
                        filtered_suggestions.append(item)
                        cumul_ht += item['montant_ht']
                
                break
        
        return filtered_suggestions, round(cumul_ht, 2)
    
    # Calculer le total HT
    total_ht = sum(item['montant_ht'] for item in suggestions)
    return suggestions, round(total_ht, 2)


def calculer_ventes_tranche_horaire(date_debut, date_fin, fournisseur_id=None):
    """
    Génère des suggestions basées sur les produits vendus pendant une tranche horaire.
    Agrège les quantités vendues par produit sur la plage [date_debut, date_fin].
    """
    from django.db.models import Sum, Q
    from django.utils.dateparse import parse_datetime
    
    # Parser les dates ISO
    dt_debut = parse_datetime(date_debut)
    dt_fin = parse_datetime(date_fin)
    
    if not dt_debut or not dt_fin:
        return [], 0
    
    # Si les dates sont naïves, les rendre aware
    if timezone.is_naive(dt_debut):
        dt_debut = timezone.make_aware(dt_debut)
    if timezone.is_naive(dt_fin):
        dt_fin = timezone.make_aware(dt_fin)
    
    # Filtrer les lignes de facture dans la plage horaire
    qs = FactureProduit.objects.filter(
        facture__date__gte=dt_debut,
        facture__date__lte=dt_fin,
        facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
        produit__isnull=False
    )
    
    # Filtrer par fournisseur si demandé
    fournisseur_obj = None
    if fournisseur_id:
        from api.models import Fournisseur, StockLot
        fournisseur_obj = Fournisseur.objects.filter(id=fournisseur_id).first()
        lots_produit_ids = set(StockLot.objects.filter(fournisseur_id=fournisseur_id).values_list('produit_id', flat=True))
        qs = qs.filter(
            Q(produit__fournisseur_id=fournisseur_id) | Q(produit_id__in=lots_produit_ids)
        )
    
    # Agréger les quantités par produit
    ventes = qs.values('produit_id').annotate(
        total_vendu=Sum('quantity')
    ).order_by('-total_vendu')
    
    # Récupérer les objets Produit en une seule requête
    produit_ids = [v['produit_id'] for v in ventes]
    produits_map = {p.id: p for p in Produit.objects.filter(id__in=produit_ids).select_related('fournisseur')}
    
    suggestions = []
    
    for vente in ventes:
        produit = produits_map.get(vente['produit_id'])
        if not produit:
            continue
        
        qte_vendue = vente['total_vendu'] or 0
        if qte_vendue <= 0:
            continue
        
        stock_actuel = produit.stock or 0
        prix_achat = float(produit.cost_price or 0)
        montant_ht = prix_achat * qte_vendue
        
        raison = f"Vendu: {qte_vendue} unités ({dt_debut.strftime('%d/%m %H:%M')} → {dt_fin.strftime('%d/%m %H:%M')})"
        if stock_actuel <= 0:
            raison += " (RUPTURE)"
        elif stock_actuel < qte_vendue:
            raison += f" | Stock restant: {stock_actuel}"
        
        suggestions.append({
            'produit_id': produit.id,
            'produit_nom': produit.name,
            'produit_ref': produit.cip1 or '',
            'fournisseur_id': fournisseur_obj.id if fournisseur_obj else (produit.fournisseur.id if produit.fournisseur else None),
            'fournisseur_nom': fournisseur_obj.name if fournisseur_obj else (produit.fournisseur.name if produit.fournisseur else 'N/A'),
            'stock_actuel': stock_actuel,
            'ventes_periode': qte_vendue,
            'quantite_suggeree': qte_vendue,
            'prix_achat': prix_achat,
            'montant_ht': montant_ht,
            'prix_vente': float(produit.selling_price or 0),
            'tva': str(produit.tva or '0'),
            'taux_marge': str(produit.taux_marge or '1.3'),
            'rotation': 'N/A',
            'tendance': 'N/A',
            'urgence': 'urgent' if stock_actuel <= 0 else 'normal',
            'couverture_jours': 0,
            'is_supplier_exclusive': produit.is_supplier_exclusive,
            'exclusive_fournisseur_nom': produit.fournisseur.name if (produit.is_supplier_exclusive and produit.fournisseur) else None,
            'raison': raison
        })
    
    total_ht = sum(item['montant_ht'] for item in suggestions)
    return suggestions, round(total_ht, 2)
