@action(detail=False, methods=['get'])
def ca_par_fournisseur(self, request):
    # Support des deux conventions de nommage de paramètres
    start_date = request.query_params.get('date_debut') or request.query_params.get('start_date')
    end_date = request.query_params.get('date_fin') or request.query_params.get('end_date')
    
    from ..models import Facture, FactureProduit, FactureProduitAllocation
    from collections import defaultdict
    
    # Filtre de base pour les factures
    factures_q = Q(status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE])
    
    if start_date:
        try:
            d_debut = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            if timezone.is_naive(d_debut): d_debut = timezone.make_aware(d_debut)
            factures_q &= Q(date__gte=d_debut)
        except ValueError:
            factures_q &= Q(date__gte=start_date)

    if end_date:
        try:
            d_fin = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            if timezone.is_naive(d_fin): d_fin = timezone.make_aware(d_fin)
            if d_fin.hour == 0 and d_fin.minute == 0 and d_fin.second == 0:
                d_fin = d_fin + timedelta(days=1)
                factures_q &= Q(date__lt=d_fin)
            else:
                factures_q &= Q(date__lte=d_fin)
        except ValueError:
            factures_q &= Q(date__lte=end_date)
    
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
        part_remise = (l['facture__remise'] or Decimal('0')) * ratio
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
                ratio_alloc = Decimal(a['quantity']) / Decimal(total_qty_alloc) if total_qty_alloc > 0 else Decimal('0')
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
