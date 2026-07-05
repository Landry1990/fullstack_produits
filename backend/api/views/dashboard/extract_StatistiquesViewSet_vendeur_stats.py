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

    from django.db.models import Case, When

    # ── 1. CA & ventes personnels ─────────────────────────────────────
    user_qs = Facture.objects.filter(
        created_by=user,
        status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
        date__date__gte=start_of_month,
    )
    personal = user_qs.aggregate(
        ca_jour=Coalesce(Sum(Case(When(date__date=today, then=F('total_ttc')), default=Value(0, output_field=DecimalField()))), Decimal('0')),
        nb_jour=Count(Case(When(date__date=today, then=Value(1)))),
        ca_sem=Coalesce(Sum(Case(When(date__date__gte=start_of_week, then=F('total_ttc')), default=Value(0, output_field=DecimalField()))), Decimal('0')),
        nb_sem=Count(Case(When(date__date__gte=start_of_week, then=Value(1)))),
        ca_mois=Coalesce(Sum(F('total_ttc')), Decimal('0')),
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
    obj_jour = objectifs['jour'].ca_objectif if objectifs['jour'] else Decimal('0')
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
            ca=Coalesce(Sum('total_ttc'), Decimal('0')),
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
            revenue=Coalesce(Sum(F('quantity') * (F('selling_price') - F('discount'))), Decimal('0')),
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
