from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta, datetime
from django.conf import settings

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
            budget_max=budget_max,
            delai_couverture=periode,
        )
    
    # ── Enrichir avec indicateurs Promis & Rupture Fournisseur ──
    if suggestions:
        from django.db.models import Sum, Q
        from ...models import Promis, RuptureFournisseur
        
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
    
    # Récupérer les produits actifs uniquement (pas les inactifs/supprimés)
    # Limiter à 5000 produits max pour éviter les timeouts
    produits = Produit.objects.filter(is_active=True).select_related('fournisseur')[:5000]
    fournisseur_obj = None
    if fournisseur_id:
        from ...models import Fournisseur, StockLot
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
    
    if fournisseur_id:
        from django.db.models import OuterRef, Subquery
        from ...models import StockLot
        last_price_subquery = StockLot.objects.filter(
            produit=OuterRef('pk'),
            fournisseur_id=fournisseur_id
        ).order_by('-date_reception').values('price_cost')[:1]
        
        produits = produits.annotate(
            last_supplier_price=Subquery(last_price_subquery)
        )
    
    suggestions = []
    
    for produit in produits:
        # Récupérer l'annotation calculée
        ventes = produit.ventes_periode or 0
        
        stock_actuel = produit.stock or 0
        
        # Réassort simple = on commande exactement ce qu'on a vendu
        qte_a_commander = int(ventes)
        
        # Calculer le montant HT
        # Prioriser le prix du fournisseur spécifique si disponible
        prix_achat = float(getattr(produit, 'last_supplier_price', None) or produit.cost_price or 0)
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


def calculer_optimisation_intelligente(periode, fournisseur_id=None, budget_max=None, delai_couverture=None):
    """
    Calcul optimisé avec rotation, tendances, stock.
    Stock cible = délai de couverture (en jours de consommation).
    Le délai de couverture est paramétrable par commande/schedule (pas figé sur le fournisseur).
    Si budget_max est fourni, on priorise les produits à plus fortes ventes.
    """
    # Défaut : delai_couverture = periode si non spécifié
    delai_couverture = delai_couverture or periode
    # Utiliser une période d'analyse plus longue (30j minimum) pour des stats fiables
    periode_analyse = max(periode, 30)
    date_debut = timezone.now() - timedelta(days=periode_analyse)
    date_mi_periode = timezone.now() - timedelta(days=periode_analyse // 2)
    from django.db.models import Sum, Q

    # Produits actifs uniquement, filtrer par fournisseur si spécifié
    from django.db.models import Q
    produits_qs = Produit.objects.filter(is_active=True)
    
    fournisseur_obj = None
    if fournisseur_id:
        from ...models import Fournisseur, StockLot
        fournisseur_obj = Fournisseur.objects.filter(id=fournisseur_id).first()
        lots_produit_ids = list(StockLot.objects.filter(fournisseur_id=fournisseur_id).values_list('produit_id', flat=True))
        produits_qs = produits_qs.filter(
            Q(fournisseur_id=fournisseur_id) | Q(id__in=lots_produit_ids)
        )
    
    # Dates pour le moteur de réapprovisionnement (90j, 4 semaines, 8 semaines)
    date_90j = timezone.now() - timedelta(days=90)
    date_4s = timezone.now() - timedelta(days=28)
    date_8s = timezone.now() - timedelta(days=56)

    # Annoter puis limiter pour éviter les timeouts
    produits = produits_qs.select_related('fournisseur').annotate(
        ventes_total_annotation=Sum('factureproduit__quantity', filter=Q(
            factureproduit__facture__date__gte=date_debut,
            factureproduit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        )),
        ventes_recentes_annotation=Sum('factureproduit__quantity', filter=Q(
            factureproduit__facture__date__gte=date_mi_periode,
            factureproduit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        )),
        ventes_90j_annotation=Sum('factureproduit__quantity', filter=Q(
            factureproduit__facture__date__gte=date_90j,
            factureproduit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        )),
        ventes_4s_annotation=Sum('factureproduit__quantity', filter=Q(
            factureproduit__facture__date__gte=date_4s,
            factureproduit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        )),
        ventes_8s_4s_annotation=Sum('factureproduit__quantity', filter=Q(
            factureproduit__facture__date__gte=date_8s,
            factureproduit__facture__date__lt=date_4s,
            factureproduit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ))
    )

    if fournisseur_id:
        from django.db.models import OuterRef, Subquery
        from ...models import StockLot
        last_price_subquery = StockLot.objects.filter(
            produit=OuterRef('pk'),
            fournisseur_id=fournisseur_id
        ).order_by('-date_reception').values('price_cost')[:1]
        
        produits = produits.annotate(
            last_supplier_price=Subquery(last_price_subquery)
        )
    
    suggestions = []
    
    for produit in produits:
        # ── 1. Données brutes ──
        ventes_total = produit.ventes_total_annotation or 0
        ventes_90j = produit.ventes_90j_annotation or 0
        ventes_4s = produit.ventes_4s_annotation or 0
        ventes_8s_4s = produit.ventes_8s_4s_annotation or 0

        stock_actuel = int(produit.stock or 0)

        # ── 2. Paramètres logistiques du fournisseur ──
        fournisseur = produit.fournisseur
        delai_livraison = getattr(fournisseur, 'delai_livraison_jours', 7) or 7
        marge_retard = getattr(fournisseur, 'marge_retard_jours', 2) or 2
        # delai_couverture vient du paramètre de la commande/schedule, pas du fournisseur

        # ── 3. VMD ajustée ──
        vmd_historique = float(ventes_90j) / 90.0

        # Tendance court terme (4 dernières semaines vs 4 semaines précédentes)
        if ventes_8s_4s > 0:
            tendance_court_terme = ventes_4s / ventes_8s_4s
        else:
            tendance_court_terme = 1.0 if ventes_4s > 0 else 0.0

        # Saisonnalité : placeholder (à enrichir quand on aura assez d'historique N-1/N-2)
        indice_saisonnalite = 1.0

        k_ajustement = tendance_court_terme * indice_saisonnalite
        # Plafonner K pour éviter les excès
        k_ajustement = max(0.5, min(k_ajustement, 2.0))

        vmd_ajustee = vmd_historique * k_ajustement

        # ── 4. Seuils dynamiques ──
        stock_securite = vmd_ajustee * marge_retard
        stock_minimum = (vmd_ajustee * delai_livraison) + stock_securite
        stock_maximum = stock_minimum + (vmd_ajustee * delai_couverture)

        # ── 5. Décision de commande ──
        en_rupture = stock_actuel <= 0
        en_alerte = stock_actuel <= stock_minimum

        if ventes_90j == 0 and not en_rupture and not en_alerte:
            continue

        if en_rupture or en_alerte:
            stock_objectif = stock_maximum
            besoin_net = max(0, stock_objectif - stock_actuel)
            qte_finale = int(round(besoin_net))

            urgence = 'urgent'
            score_urgence = 90 if en_rupture else 70
            raison = (
                f"Stock={stock_actuel} ≤ SeuilMin={stock_minimum:.1f}. "
                f"Objectif={stock_maximum:.1f}. "
                f"VMD={vmd_ajustee:.2f}u/j. "
                f"Sécurité={stock_securite:.1f}j. "
            )
            if en_rupture:
                raison += "RUPTURE."
            else:
                raison += "ALERTE STOCK."
        else:
            qte_finale = 0
            urgence = 'normal'
            score_urgence = 20
            raison = (
                f"Stock={stock_actuel} > SeuilMin={stock_minimum:.1f}. "
                f"Couverture sécurisée."
            )

        # ── 6. Métriques de retour ──
        conso_jour = vmd_ajustee
        couverture_jours = int(stock_actuel / conso_jour) if conso_jour > 0 else 999
        niveau_rotation = 'normale'
        if vmd_historique > 0:
            if k_ajustement > 1.3:
                niveau_rotation = 'haute'
            elif k_ajustement < 0.7:
                niveau_rotation = 'faible'
        
        # Calculer montant HT
        # Prioriser le prix du fournisseur spécifique si disponible
        prix_achat = float(getattr(produit, 'last_supplier_price', None) or produit.cost_price or 0)
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
                'tendance': round(tendance_court_terme, 2),
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
    
    # Si les dates sont naïves et que USE_TZ est True, les rendre aware
    if settings.USE_TZ:
        if timezone.is_naive(dt_debut):
            dt_debut = timezone.make_aware(dt_debut)
        if timezone.is_naive(dt_fin):
            dt_fin = timezone.make_aware(dt_fin)
    else:
        # Si USE_TZ est False, s'assurer que les dates sont naïves pour la comparaison DB
        if not timezone.is_naive(dt_debut):
            dt_debut = timezone.make_naive(dt_debut)
        if not timezone.is_naive(dt_fin):
            dt_fin = timezone.make_naive(dt_fin)
    
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
        from ...models import Fournisseur, StockLot
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
    produits_qs = Produit.objects.filter(id__in=produit_ids).select_related('fournisseur')
    
    if fournisseur_id:
        from django.db.models import OuterRef, Subquery
        from ...models import StockLot
        last_price_subquery = StockLot.objects.filter(
            produit=OuterRef('pk'),
            fournisseur_id=fournisseur_id
        ).order_by('-date_reception').values('price_cost')[:1]
        
        produits_qs = produits_qs.annotate(
            last_supplier_price=Subquery(last_price_subquery)
        )
        
    produits_map = {p.id: p for p in produits_qs}
    
    suggestions = []
    
    for vente in ventes:
        produit = produits_map.get(vente['produit_id'])
        if not produit:
            continue
        
        qte_vendue = vente['total_vendu'] or 0
        if qte_vendue <= 0:
            continue
        
        stock_actuel = produit.stock or 0
        # Prioriser le prix du fournisseur spécifique si disponible
        prix_achat = float(getattr(produit, 'last_supplier_price', None) or produit.cost_price or 0)
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


def calculer_reapprovisionnement_cumulatif(fournisseur_id, periode_fallback=30, budget_max=None):
    """
    Mode cumulatif : compte les ventes depuis la dernière commande auto-générée.
    Si aucune commande auto existante, utilise la période de fallback.
    
    Ex: Lundi 14h génération → Mercredi 14h compte les ventes de Lundi 14h01 à Mercredi 14h
    """
    from ...models import Commande
    from django.db.models import Sum, Q, OuterRef, Subquery
    from ...models import StockLot as StockLotModel, Fournisseur
    
    # Trouver la dernière commande auto-générée pour ce fournisseur
    last_auto_order = Commande.objects.filter(
        fournisseur_id=fournisseur_id,
        source=Commande.Source.AUTO_SCHEDULE,
        status__in=[Commande.Status.EN_PREPARATION, Commande.Status.EN_ATTENTE, Commande.Status.CLOTUREE]
    ).order_by('-date').first()
    
    if last_auto_order:
        # On commence 1 minute après la dernière commande pour ne pas compter 2x
        date_debut = last_auto_order.date + timedelta(minutes=1)
        mode_info = f"depuis dernière cmd ({last_auto_order.date.strftime('%d/%m %H:%M')})"
    else:
        # Fallback : première exécution, on utilise la période standard
        date_debut = timezone.now() - timedelta(days=periode_fallback)
        mode_info = f"période initiale ({periode_fallback}j)"
    
    date_fin = timezone.now()
    
    # Filtrer les produits du fournisseur
    fournisseur_obj = Fournisseur.objects.filter(id=fournisseur_id).first()
    
    lots_produit_ids = set(StockLotModel.objects.filter(
        fournisseur_id=fournisseur_id
    ).values_list('produit_id', flat=True))
    
    produits = Produit.objects.filter(
        Q(fournisseur_id=fournisseur_id) | Q(id__in=lots_produit_ids)
    )
    
    # Annoter avec les ventes depuis la date de début
    produits = produits.annotate(
        ventes_periode=Sum('factureproduit__quantity', filter=Q(
            factureproduit__facture__date__gte=date_debut,
            factureproduit__facture__date__lte=date_fin,
            factureproduit__facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE]
        ))
    )
    
    # Prix du fournisseur
    last_price_subquery = StockLotModel.objects.filter(
        produit=OuterRef('pk'),
        fournisseur_id=fournisseur_id
    ).order_by('-date_reception').values('price_cost')[:1]
    
    produits = produits.annotate(
        last_supplier_price=Subquery(last_price_subquery)
    )
    
    suggestions = []
    
    for produit in produits:
        ventes = produit.ventes_periode or 0
        if ventes <= 0:
            continue
        
        stock_actuel = produit.stock or 0
        qte_a_commander = int(ventes)
        
        prix_achat = float(getattr(produit, 'last_supplier_price', None) or produit.cost_price or 0)
        montant_ht = prix_achat * qte_a_commander
        
        raison = f"Vendu: {int(ventes)}u ({mode_info})"
        if stock_actuel <= 0:
            raison += " (RUPTURE)"
        
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
            'couverture_jours': 0,
            'is_supplier_exclusive': produit.is_supplier_exclusive,
            'exclusive_fournisseur_nom': produit.fournisseur.name if (produit.is_supplier_exclusive and produit.fournisseur) else None,
            'raison': raison
        })
    
    # Trier par montant décroissant
    suggestions.sort(key=lambda x: x['montant_ht'], reverse=True)
    
    total_ht = sum(item['montant_ht'] for item in suggestions)
    return suggestions, round(total_ht, 2)
