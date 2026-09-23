"""
Feuilles supplémentaires du rapport général mensuel.
Importé par excel_general.py
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from decimal import Decimal

from api.views.rapports.excel_general import (
    PALETTE,
    _align,
    _auto_width,
    _fill,
    _fmt,
    _font,
    _pct,
    _row_style,
    _write_col_headers,
    _write_sheet_header,
)

# ─────────────────────────────────────────────────────────────────────────────
# Helpers locaux
# ─────────────────────────────────────────────────────────────────────────────

def _section_title(ws, row: int, title: str):
    cell = ws.cell(row=row, column=1, value=title)
    cell.font = _font(bold=True, size=12, color=PALETTE["sub_bg"])
    cell.fill = _fill(PALETTE["alt_row"])


def _evolution(val_now, val_prev):
    """Retourne (delta, pct_str) entre val_now et val_prev."""
    try:
        n, p = float(val_now or 0), float(val_prev or 0)
        delta = n - p
        pct = (delta / p * 100) if p else 0.0
        arrow = "▲" if delta >= 0 else "▼"
        return delta, f"{arrow} {abs(pct):.1f} %"
    except Exception:
        return 0, "—"


# ─────────────────────────────────────────────────────────────────────────────
# Collecte données supplémentaires
# ─────────────────────────────────────────────────────────────────────────────

def collect_extra_data(date_debut, date_fin, lang: str | None = None):
    """Collecte les données pour les feuilles supplémentaires."""
    # ── Mois précédent (pour évolution) ─────────────────────────────────────
    from datetime import timedelta

    from api.utils_doclang import T, format_doc_date, get_document_language

    if not lang:
        lang = get_document_language()

    from django.db.models import Count, DecimalField, F, Q, Sum
    from django.db.models.functions import Coalesce
    from django.utils import timezone

    from api.models import (
        Client,
        ClotureCaisse,
        Facture,
        FactureProduitAllocation,
        MouvementCaisse,
        ObjectifCommercial,
        Promotion,
        StockAdjustment,
    )
    from api.models.billing import Caisse
    from api.views.rapports.tz_utils import local_trunc_date
    prev_fin   = date_debut
    prev_debut = (date_debut - timedelta(days=1)).replace(day=1)
    # make aware si nécessaire
    if timezone.is_naive(prev_debut):
        prev_debut = timezone.make_aware(datetime(prev_debut.year, prev_debut.month, 1))

    factures_cur  = Facture.objects.filter(
        status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
        date__gte=date_debut, date__lt=date_fin,
    )
    factures_prev = Facture.objects.filter(
        status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
        date__gte=prev_debut, date__lt=prev_fin,
    )

    agg_cur  = factures_cur.aggregate(
        ca=Coalesce(Sum("total_ttc"), Decimal(0)),
        nb=Count("id"),
        remises=Coalesce(Sum("remise"), Decimal(0)),
    )
    agg_prev = factures_prev.aggregate(
        ca=Coalesce(Sum("total_ttc"), Decimal(0)),
        nb=Count("id"),
    )

    # Marge courante simplifiée (via allocations)
    def _marge_alloc(qs):
        return FactureProduitAllocation.objects.filter(
            facture_produit__facture__in=qs
        ).aggregate(
            rev=Coalesce(Sum(F("selling_price") * F("quantity"), output_field=DecimalField()), Decimal(0)),
            cost=Coalesce(Sum(F("cost_price")   * F("quantity"), output_field=DecimalField()), Decimal(0)),
        )

    m_cur  = _marge_alloc(factures_cur)
    m_prev = _marge_alloc(factures_prev)
    marge_cur  = m_cur["rev"]  - m_cur["cost"]
    marge_prev = m_prev["rev"] - m_prev["cost"]

    # Objectif mensuel
    try:
        obj = ObjectifCommercial.objects.filter(
            periode="MOIS",
            date_debut__year=date_debut.year,
            date_debut__month=date_debut.month,
        ).order_by("-date_debut").first()
        ca_objectif = obj.ca_objectif if obj else Decimal(0)
    except Exception:
        ca_objectif = Decimal(0)

    evolution = {
        "ca_cur":       agg_cur["ca"],
        "ca_prev":      agg_prev["ca"],
        "ca_delta":     agg_cur["ca"] - agg_prev["ca"],
        "marge_cur":    marge_cur,
        "marge_prev":   marge_prev,
        "nb_cur":       agg_cur["nb"],
        "nb_prev":      agg_prev["nb"],
        "ca_objectif":  ca_objectif,
    }

    # ── Modes de paiement (global + par jour) ───────────────────────────────
    Caisse.objects.filter(
        facture__in=factures_cur,
        statut="completee",
    ).values("mode_paiement", "date_paiement")

    modes_global: dict = defaultdict(Decimal)
    modes_daily: dict  = {}  # {date: {mode: montant}}
    for p in Caisse.objects.filter(
        facture__in=factures_cur, statut="completee"
    ).values("mode_paiement").annotate(total=Sum("montant")):
        modes_global[p["mode_paiement"]] = p["total"] or Decimal(0)

    for p in Caisse.objects.filter(
        facture__in=factures_cur, statut="completee"
    ).annotate(day=local_trunc_date("date_paiement")).values("day", "mode_paiement").annotate(
        total=Sum("montant")
    ):
        day = p["day"]
        if day not in modes_daily:
            modes_daily[day] = defaultdict(Decimal)
        modes_daily[day][p["mode_paiement"]] = p["total"] or Decimal(0)

    # Aussi via details_paiement de ClotureCaisse (JSON)
    cloture_modes: dict = defaultdict(Decimal)
    for cl in ClotureCaisse.objects.filter(date__gte=date_debut, date__lt=date_fin):
        dp = cl.details_paiement or {}
        for mode, montant in dp.items():
            try:
                cloture_modes[mode] += Decimal(str(montant))
            except Exception:
                pass

    # ── Retours & Annulations ────────────────────────────────────────────────
    factures_ann = Facture.objects.filter(
        status=Facture.Status.ANNULEE,
        date_annulation__gte=date_debut,
        date_annulation__lt=date_fin,
    ).select_related("cancelled_by", "client")

    annulations_rows = []
    for f in factures_ann:
        annulations_rows.append({
            "date":         format_doc_date(f.date_annulation or f.date, lang),
            "numero":       f.numero_facture or f"F-{f.pk}",
            "client":       f.client.name if f.client else (f.client_name_override or T(lang, 'client_comptant')),
            "montant":      float(f.total_ttc or 0),
            "annule_par":   f.cancelled_by.get_full_name() if f.cancelled_by else "—",
            "motif":        f.notes or "—",
        })

    # Produits les plus retournés (via MouvementStock RETOUR)
    from api.models.stock import MouvementStock
    retours_prod = MouvementStock.objects.filter(
        type_mouvement=MouvementStock.TypeMouvement.RETOUR,
        date__gte=date_debut, date__lt=date_fin,
    ).values("produit__name").annotate(
        qte=Sum("quantite"), nb=Count("id")
    ).order_by("qte")[:20]

    retours_rows = [
        {
            "produit": r["produit__name"] or "—",
            "qte_retournee": abs(r["qte"] or 0),
            "nb_retours": r["nb"],
        }
        for r in retours_prod
    ]

    # ── Performance Vendeurs ─────────────────────────────────────────────────
    vendeurs: dict = {}
    for f in factures_cur.select_related("created_by", "cancelled_by"):
        uid = f.created_by_id or 0
        nom = (f.created_by.get_full_name().strip() or f.created_by.username) if f.created_by else T(lang, 'user_unknown')
        if uid not in vendeurs:
            vendeurs[uid] = {
                "nom": nom, "nb_ventes": 0, "ca": Decimal(0),
                "remises": Decimal(0), "annulations": 0,
            }
        vendeurs[uid]["nb_ventes"] += 1
        vendeurs[uid]["ca"] += f.total_ttc or Decimal(0)
        vendeurs[uid]["remises"] += (f.remise or Decimal(0)) + (f.montant_fidelite or Decimal(0))

    # Annulations par vendeur
    for f in factures_ann:
        uid = f.cancelled_by_id or 0
        if uid in vendeurs:
            vendeurs[uid]["annulations"] += 1

    perf_rows = sorted(vendeurs.values(), key=lambda x: x["ca"], reverse=True)
    for row in perf_rows:
        ca = float(row["ca"])
        row["panier_moyen"] = ca / row["nb_ventes"] if row["nb_ventes"] else 0
        row["taux_remise"]  = float(row["remises"]) / ca * 100 if ca else 0

    # ── Suivi Trésorerie ─────────────────────────────────────────────────────
    # Encaissements par semaine
    semaines: dict = {}
    for p in Caisse.objects.filter(
        facture__in=factures_cur, statut="completee"
    ).annotate(day=local_trunc_date("date_paiement")).values("day").annotate(
        total=Sum("montant")
    ):
        day = p["day"]
        if day:
            iso = day.isocalendar()
            sem_key = f"S{iso[1]:02d}"
            if sem_key not in semaines:
                semaines[sem_key] = {"label": sem_key, "encaissements": Decimal(0), "depenses": Decimal(0), "achats": Decimal(0)}
            semaines[sem_key]["encaissements"] += p["total"] or Decimal(0)

    # Dépenses par semaine
    for m in MouvementCaisse.objects.filter(
        date__gte=date_debut, date__lt=date_fin, type="SORTIE"
    ).annotate(day=local_trunc_date("date")).values("day").annotate(total=Sum("montant")):
        day = m["day"]
        if day:
            iso = day.isocalendar()
            sem_key = f"S{iso[1]:02d}"
            if sem_key not in semaines:
                semaines[sem_key] = {"label": sem_key, "encaissements": Decimal(0), "depenses": Decimal(0), "achats": Decimal(0)}
            semaines[sem_key]["depenses"] += m["total"] or Decimal(0)

    # Achats fournisseurs par semaine (via CommandeProduit.price_cost * quantity)

    from api.models.orders import Commande
    for cmd in Commande.objects.filter(
        date__gte=date_debut, date__lt=date_fin,
        status=Commande.Status.CLOTUREE,
        fournisseur__isnull=False,
    ).prefetch_related("produits"):
        day = cmd.date.date() if hasattr(cmd.date, "date") else cmd.date
        if day:
            iso = day.isocalendar()
            sem_key = f"S{iso[1]:02d}"
            if sem_key not in semaines:
                semaines[sem_key] = {"label": sem_key, "encaissements": Decimal(0), "depenses": Decimal(0), "achats": Decimal(0)}
            montant_cmd = sum(
                Decimal(str(cp.price_cost or 0)) * cp.quantity
                for cp in cmd.produits.all()
            )
            semaines[sem_key]["achats"] += montant_cmd

    tresorerie_rows = sorted(semaines.values(), key=lambda x: x["label"])
    # Calcul solde cumulé
    solde = Decimal(0)
    for row in tresorerie_rows:
        solde += row["encaissements"] - row["depenses"] - row["achats"]
        row["solde_cumule"] = float(solde)
        row["encaissements"] = float(row["encaissements"])
        row["depenses"] = float(row["depenses"])
        row["achats"] = float(row["achats"])

    # Créances à recouvrer (projection mois suivant)
    creances_total = Facture.objects.filter(
        status=Facture.Status.VALIDEE,
        client__isnull=False,
    ).aggregate(t=Coalesce(Sum("total_ttc"), Decimal(0)))["t"]

    # ── Périmés du mois ──────────────────────────────────────────────────────
    perimes_rows = []
    for adj in StockAdjustment.objects.filter(
        reason_type=StockAdjustment.ReasonType.PERIME,
        created_at__gte=date_debut, created_at__lt=date_fin,
    ).select_related("produit", "produit__rayon", "user").order_by("-created_at"):
        qte = abs(adj.quantity_change)
        pmp = float(adj.produit.pmp) if adj.produit and adj.produit.pmp else 0
        perimes_rows.append({
            "date":        format_doc_date(adj.created_at, lang),
            "produit":     adj.produit_nom or (adj.produit.name if adj.produit else "—"),
            "rayon":       adj.produit.rayon.name if adj.produit and adj.produit.rayon else "—",
            "quantite":    qte,
            "pmp":         pmp,
            "valeur_perte": qte * pmp,
            "user":        adj.user.get_full_name() if adj.user else "—",
            "detail":      adj.reason_detail or "",
        })

    # ── Promotions actives sur la période ───────────────────────────────────
    promos_rows = []
    for promo in Promotion.objects.filter(
        start_date__lt=date_fin, active=True,
    ).prefetch_related("products"):
        promos_rows.append({
            "nom":        promo.name,
            "type":       promo.get_discount_type_display(),
            "valeur":     float(promo.value or 0),
            "date_debut": format_doc_date(promo.start_date, lang) if promo.start_date else "—",
            "date_fin":   format_doc_date(promo.end_date, lang) if promo.end_date else "—",
            "nb_produits": promo.products.count(),
        })

    # ── Clients Pro / Mutuelles ──────────────────────────────────────────────
    clients_pro_rows = []
    for c in Client.objects.filter(
        client_type__in=["PRO", "MUTUELLE", "ENTREPRISE"],
        is_active=True,
    ).annotate(
        nb_f=Count("facture", filter=Q(
            facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
            facture__date__gte=date_debut, facture__date__lt=date_fin,
        )),
        ca_mois=Coalesce(Sum(
            "facture__total_ttc",
            filter=Q(
                facture__status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
                facture__date__gte=date_debut, facture__date__lt=date_fin,
            )
        ), Decimal(0)),
    ).filter(nb_f__gt=0).order_by("-ca_mois"):
        clients_pro_rows.append({
            "nom":         c.name,
            "type":        c.client_type,
            "nb_factures": c.nb_f,
            "ca_mois":     float(c.ca_mois),
            "encours":     float(c.solde_factures) if hasattr(c, "solde_factures") else 0,
            "plafond":     float(c.plafond) if c.plafond else 0,
        })

    return {
        "evolution":        evolution,
        "modes_global":     dict(modes_global),
        "modes_daily":      modes_daily,
        "cloture_modes":    dict(cloture_modes),
        "annulations_rows": annulations_rows,
        "retours_rows":     retours_rows,
        "perf_rows":        perf_rows,
        "tresorerie_rows":  tresorerie_rows,
        "creances_total":   float(creances_total),
        "perimes_rows":     perimes_rows,
        "promos_rows":      promos_rows,
        "clients_pro_rows": clients_pro_rows,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Enrichissement Feuille 1 — Synthèse (évolution + objectif)
# ─────────────────────────────────────────────────────────────────────────────

def enrich_synthese(ws, extra: dict, lang: str | None = None):
    """Ajoute un bloc Évolution et Objectif à la feuille Synthèse existante."""
    from api.utils_doclang import T, get_document_language

    if not lang:
        lang = get_document_language()

    evo   = extra["evolution"]
    # Cherche la dernière ligne utilisée
    last_row = ws.max_row + 2

    _section_title(ws, last_row, T(lang, 'xe_sec_evo'))
    last_row += 1

    ca_delta, ca_pct   = _evolution(evo["ca_cur"],    evo["ca_prev"])
    mg_delta, mg_pct   = _evolution(evo["marge_cur"], evo["marge_prev"])
    nb_delta, nb_pct   = _evolution(evo["nb_cur"],    evo["nb_prev"])

    evo_rows = [
        ('xe_ca_cur',     _fmt(evo["ca_cur"]),                 False),
        ('xe_ca_prev',    _fmt(evo["ca_prev"]),                False),
        ('xe_var_ca',     f"{_fmt(ca_delta)}  ({ca_pct})",     True),
        ('xe_marge_cur',  _fmt(evo["marge_cur"]),              False),
        ('xe_marge_prev', _fmt(evo["marge_prev"]),             False),
        ('xe_var_marge',  f"{_fmt(mg_delta)}  ({mg_pct})",     True),
        ('xe_nb_cur',     evo["nb_cur"],                       False),
        ('xe_nb_prev',    evo["nb_prev"],                      False),
        ('xe_var_nb',     f"{int(nb_delta):+d}  ({nb_pct})",   True),
    ]
    for i, (key, val, is_var) in enumerate(evo_rows):
        ws.cell(row=last_row, column=1, value=T(lang, key)).alignment = _align()
        cell = ws.cell(row=last_row, column=2, value=val)
        cell.alignment = _align(h="right")
        if is_var:
            is_neg = str(val).startswith("-") or "▼" in str(val)
            cell.font = _font(bold=True, color=PALETTE["neg"] if is_neg else PALETTE["pos"])
        _row_style(ws, last_row, 2, is_alt=(i % 2 == 0))
        last_row += 1

    # Objectif
    if evo["ca_objectif"] > 0:
        last_row += 1
        _section_title(ws, last_row, T(lang, 'xe_sec_obj'))
        last_row += 1
        taux_obj = float(evo["ca_cur"]) / float(evo["ca_objectif"]) * 100
        obj_rows = [
            ('xe_obj_ca',     _fmt(evo["ca_objectif"]),                                 False),
            ('xe_ca_realise', _fmt(evo["ca_cur"]),                                      False),
            ('xe_taux',       _pct(taux_obj),                                           True),
            ('xe_ecart_obj',  _fmt(float(evo["ca_cur"]) - float(evo["ca_objectif"])),   False),
        ]
        for i, (key, val, is_taux) in enumerate(obj_rows):
            ws.cell(row=last_row, column=1, value=T(lang, key)).alignment = _align()
            cell = ws.cell(row=last_row, column=2, value=val)
            cell.alignment = _align(h="right")
            if is_taux:
                color = PALETTE["pos"] if taux_obj >= 100 else (PALETTE["warning"] if taux_obj >= 80 else PALETTE["neg"])
                cell.font = _font(bold=True, color=color)
            _row_style(ws, last_row, 2, is_alt=(i % 2 == 0))
            last_row += 1


# ─────────────────────────────────────────────────────────────────────────────
# Feuille 11 — Modes de Paiement
# ─────────────────────────────────────────────────────────────────────────────

def _mode_label(m: str, lang: str = 'fr') -> str:
    from api.utils_doclang import T

    key = f"pay_{m.lower()}"
    v = T(lang, key)
    return v if v != key else m.replace("_", " ").title()


def sheet_modes_paiement(wb, extra: dict, pharmacy: dict, mois_label: str, logo_path, lang: str | None = None):
    from api.utils_doclang import T, format_doc_date, get_document_language

    if not lang:
        lang = get_document_language()

    ws = wb.create_sheet(T(lang, 'xe_sheet_modes'))
    start = _write_sheet_header(ws, pharmacy, T(lang, 'xe_t_modes', mois=mois_label), logo_path, lang=lang)

    # ── Récapitulatif global ──
    _section_title(ws, start, T(lang, 'xe_sec_recap'))
    r = start + 1

    modes_g = extra["modes_global"]
    total_g = sum(float(v) for v in modes_g.values()) or 1
    headers_g = [T(lang, 'col_mode_paiement'), T(lang, 'col_montant_total'), T(lang, 'col_part')]
    _write_col_headers(ws, r, headers_g)
    r += 1
    for i, (mode, montant) in enumerate(sorted(modes_g.items(), key=lambda x: -float(x[1]))):
        pct = float(montant) / total_g * 100
        for c, v in enumerate([_mode_label(mode, lang), _fmt(montant), _pct(pct)], 1):
            ws.cell(row=r, column=c, value=v).alignment = _align(h="right" if c > 1 else "left")
        _row_style(ws, r, 3, is_alt=(i % 2 == 0))
        r += 1
    for c, v in enumerate([T(lang, 'row_total'), _fmt(total_g), _pct(100)], 1):
        ws.cell(row=r, column=c, value=v)
    _row_style(ws, r, 3, is_total=True)
    r += 3

    # ── Détail par mode et par clôture (JSON details_paiement) ──
    if extra["cloture_modes"]:
        _section_title(ws, r, T(lang, 'xe_sec_cloture'))
        r += 1
        for i, (mode, montant) in enumerate(sorted(extra["cloture_modes"].items(), key=lambda x: -float(x[1]))):
            for c, v in enumerate([_mode_label(mode, lang), _fmt(montant)], 1):
                ws.cell(row=r, column=c, value=v).alignment = _align(h="right" if c > 1 else "left")
            _row_style(ws, r, 2, is_alt=(i % 2 == 0))
            r += 1
        r += 2

    # ── Évolution journalière ──
    modes_daily = extra["modes_daily"]
    if modes_daily:
        all_modes = sorted({m for d in modes_daily.values() for m in d})
        _section_title(ws, r, T(lang, 'xe_sec_evo_mode'))
        r += 1
        day_headers = [T(lang, 'col_date')] + [_mode_label(m, lang) for m in all_modes] + [T(lang, 'col_total_jour')]
        _write_col_headers(ws, r, day_headers)
        r += 1
        for i, day in enumerate(sorted(modes_daily.keys())):
            day_data = modes_daily[day]
            total_day = sum(float(v) for v in day_data.values())
            vals = [format_doc_date(day, lang) if hasattr(day, "strftime") else str(day)]
            vals += [_fmt(day_data.get(m, 0)) for m in all_modes]
            vals += [_fmt(total_day)]
            for c, v in enumerate(vals, 1):
                ws.cell(row=r, column=c, value=v).alignment = _align(h="right" if c > 1 else "left")
            _row_style(ws, r, len(day_headers), is_alt=(i % 2 == 0))
            r += 1

    _auto_width(ws)


# ─────────────────────────────────────────────────────────────────────────────
# Feuille 12 — Retours & Annulations
# ─────────────────────────────────────────────────────────────────────────────

def sheet_retours_annulations(wb, extra: dict, pharmacy: dict, mois_label: str, logo_path, lang: str | None = None):
    from api.utils_doclang import T, get_document_language

    if not lang:
        lang = get_document_language()

    ws = wb.create_sheet(T(lang, 'xe_sheet_retours'))
    start = _write_sheet_header(ws, pharmacy, T(lang, 'xe_t_retours', mois=mois_label), logo_path, lang=lang)
    r = start

    # ── Factures annulées ──
    _section_title(ws, r, T(lang, 'xe_sec_fact_ann'))
    r += 1
    ann = extra["annulations_rows"]
    headers_a = [T(lang, 'col_date_annulation'), T(lang, 'col_num_facture'), T(lang, 'col_client'), T(lang, 'col_montant_f'), T(lang, 'col_annule_par'), T(lang, 'col_motif')]
    _write_col_headers(ws, r, headers_a)
    r += 1
    total_ann = Decimal(0)
    for i, row in enumerate(ann):
        vals = [row["date"], row["numero"], row["client"],
                _fmt(row["montant"]), row["annule_par"], row["motif"]]
        for c, v in enumerate(vals, 1):
            ws.cell(row=r, column=c, value=v).alignment = _align(h="right" if c == 4 else "left")
        _row_style(ws, r, len(headers_a), is_alt=(i % 2 == 0))
        total_ann += Decimal(str(row["montant"]))
        r += 1
    for c, v in enumerate([T(lang, 'row_total'), "", "", _fmt(total_ann), "", ""], 1):
        ws.cell(row=r, column=c, value=v)
    _row_style(ws, r, len(headers_a), is_total=True)
    if not ann:
        ws.cell(row=r + 1, column=1, value=T(lang, 'xe_no_ann')).font = _font(italic=True, color="808080")
    r += 3

    # ── Produits les plus retournés ──
    _section_title(ws, r, T(lang, 'xe_sec_retours'))
    r += 1
    retours = extra["retours_rows"]
    if retours:
        headers_r = [T(lang, 'col_produit'), T(lang, 'col_qte_retournee'), T(lang, 'col_nb_mouvements')]
        _write_col_headers(ws, r, headers_r)
        r += 1
        for i, row in enumerate(retours):
            for c, v in enumerate([row["produit"], row["qte_retournee"], row["nb_retours"]], 1):
                ws.cell(row=r, column=c, value=v).alignment = _align(h="right" if c > 1 else "left")
            _row_style(ws, r, 3, is_alt=(i % 2 == 0))
            r += 1
    else:
        ws.cell(row=r, column=1, value=T(lang, 'xe_no_retour')).font = _font(italic=True, color="808080")
    _auto_width(ws)


# ─────────────────────────────────────────────────────────────────────────────
# Feuille 13 — Performance Vendeurs
# ─────────────────────────────────────────────────────────────────────────────

def sheet_performance_vendeurs(wb, extra: dict, pharmacy: dict, mois_label: str, logo_path, lang: str | None = None):
    from api.utils_doclang import T, get_document_language

    if not lang:
        lang = get_document_language()

    ws = wb.create_sheet(T(lang, 'xe_sheet_perf'))
    start = _write_sheet_header(ws, pharmacy, T(lang, 'xe_t_perf', mois=mois_label), logo_path, lang=lang)

    headers = [
        T(lang, 'col_rang'), T(lang, 'col_vendeur'), T(lang, 'kpi_nb_ventes'), T(lang, 'col_ca_ttc_f'),
        T(lang, 'col_panier_moyen') + " (F)", T(lang, 'col_remises_acc'),
        T(lang, 'col_taux_remise'), T(lang, 'col_annulations')
    ]
    _write_col_headers(ws, start, headers)
    r = start + 1
    totals = defaultdict(Decimal)
    perf = extra["perf_rows"]
    if not perf:
        ws.cell(row=r, column=1, value=T(lang, 'xe_no_perf')).font = _font(italic=True, color="808080")
        return

    for i, row in enumerate(perf):
        vals = [
            i + 1,
            row["nom"],
            row["nb_ventes"],
            _fmt(row["ca"]),
            _fmt(row["panier_moyen"]),
            _fmt(row["remises"]),
            _pct(row["taux_remise"]),
            row["annulations"],
        ]
        for c, v in enumerate(vals, 1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.alignment = _align(h="right" if c > 2 else "left")
            if c == 8 and int(row.get("annulations", 0)) > 3:
                cell.font = _font(color=PALETTE["warning"], bold=True)
        _row_style(ws, r, len(headers), is_alt=(i % 2 == 0))
        totals["nb_ventes"] += row["nb_ventes"]
        totals["ca"] += Decimal(str(row["ca"]))
        totals["remises"] += Decimal(str(row.get("remises", 0) or 0))
        totals["annulations"] += row.get("annulations", 0)
        r += 1

    ca_tot = float(totals["ca"])
    pm_tot = ca_tot / int(totals["nb_ventes"]) if totals["nb_ventes"] else 0
    tx_tot = float(totals["remises"]) / ca_tot * 100 if ca_tot else 0
    for c, v in enumerate([T(lang, 'row_total'), "", int(totals["nb_ventes"]),
                            _fmt(totals["ca"]), _fmt(pm_tot),
                            _fmt(totals["remises"]), _pct(tx_tot), int(totals["annulations"])], 1):
        ws.cell(row=r, column=c, value=v)
    _row_style(ws, r, len(headers), is_total=True)
    _auto_width(ws)


# ─────────────────────────────────────────────────────────────────────────────
# Feuille 14 — Suivi Trésorerie
# ─────────────────────────────────────────────────────────────────────────────

def sheet_tresorerie(wb, extra: dict, pharmacy: dict, mois_label: str, logo_path, lang: str | None = None):
    from api.utils_doclang import T, get_document_language

    if not lang:
        lang = get_document_language()

    ws = wb.create_sheet(T(lang, 'xe_sheet_treso'))
    start = _write_sheet_header(ws, pharmacy, T(lang, 'xe_t_treso', mois=mois_label), logo_path, lang=lang)

    headers = [
        T(lang, 'col_semaine'), T(lang, 'col_encaissements'), T(lang, 'col_depenses_f'),
        T(lang, 'col_achats_f'), T(lang, 'col_solde_net'), T(lang, 'col_solde_cumule')
    ]
    _write_col_headers(ws, start, headers)
    r = start + 1
    tresorerie = extra["tresorerie_rows"]
    totals = defaultdict(float)
    for i, row in enumerate(tresorerie):
        net_sem = row["encaissements"] - row["depenses"] - row["achats"]
        vals = [
            row["label"],
            _fmt(row["encaissements"]),
            _fmt(row["depenses"]),
            _fmt(row["achats"]),
            _fmt(net_sem),
            _fmt(row["solde_cumule"]),
        ]
        for c, v in enumerate(vals, 1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.alignment = _align(h="right" if c > 1 else "left")
            if c == 5:
                cell.font = _font(color=PALETTE["pos"] if net_sem >= 0 else PALETTE["neg"], bold=True)
        _row_style(ws, r, len(headers), is_alt=(i % 2 == 0))
        totals["encaissements"] += row["encaissements"]
        totals["depenses"]      += row["depenses"]
        totals["achats"]        += row["achats"]
        r += 1

    net_tot = totals["encaissements"] - totals["depenses"] - totals["achats"]
    for c, v in enumerate([T(lang, 'row_total'), _fmt(totals["encaissements"]), _fmt(totals["depenses"]),
                            _fmt(totals["achats"]), _fmt(net_tot), ""], 1):
        ws.cell(row=r, column=c, value=v)
    _row_style(ws, r, len(headers), is_total=True)
    r += 3

    # Projection
    if extra["creances_total"] > 0:
        _section_title(ws, r, T(lang, 'xe_sec_projection'))
        r += 1
        for key, val in [
            ('xe_creances_recouvrer', extra["creances_total"]),
            ('xe_solde_net',          net_tot),
            ('xe_treso_prev',         float(extra["creances_total"]) + float(net_tot)),
        ]:
            ws.cell(row=r, column=1, value=T(lang, key)).alignment = _align()
            ws.cell(row=r, column=2, value=_fmt(val)).alignment = _align(h="right")
            r += 1

    _auto_width(ws)


# ─────────────────────────────────────────────────────────────────────────────
# Feuille 15 — Périmés du mois
# ─────────────────────────────────────────────────────────────────────────────

def sheet_perimes(wb, extra: dict, pharmacy: dict, mois_label: str, logo_path, lang: str | None = None):
    from api.utils_doclang import T, get_document_language

    if not lang:
        lang = get_document_language()

    ws = wb.create_sheet(T(lang, 'xe_sheet_perimes'))
    start = _write_sheet_header(ws, pharmacy, T(lang, 'xe_t_perimes', mois=mois_label), logo_path, lang=lang)

    headers = [T(lang, 'col_date'), T(lang, 'col_produit'), T(lang, 'col_rayon'), T(lang, 'col_qte_detruite'), T(lang, 'col_pmp_f'), T(lang, 'col_valeur_perdue'), T(lang, 'col_saisi_par'), T(lang, 'col_detail')]
    _write_col_headers(ws, start, headers)
    r = start + 1
    perimes = extra["perimes_rows"]
    total_perte = 0.0
    for i, row in enumerate(perimes):
        vals = [
            row["date"], row["produit"], row["rayon"],
            row["quantite"], _fmt(row["pmp"]),
            _fmt(row["valeur_perte"]),
            row["user"], row["detail"],
        ]
        for c, v in enumerate(vals, 1):
            ws.cell(row=r, column=c, value=v).alignment = _align(h="right" if c in (4, 5, 6) else "left")
        _row_style(ws, r, len(headers), is_alt=(i % 2 == 0))
        total_perte += float(row["valeur_perte"])
        r += 1
    for c, v in enumerate([T(lang, 'row_total'), "", "", "", "", _fmt(total_perte), "", ""], 1):
        ws.cell(row=r, column=c, value=v)
    _row_style(ws, r, len(headers), is_total=True)
    if not perimes:
        ws.cell(row=r + 1, column=1, value=T(lang, 'xe_no_perime')).font = _font(italic=True, color="808080")
    _auto_width(ws)


# ─────────────────────────────────────────────────────────────────────────────
# Feuille 16 — Promotions
# ─────────────────────────────────────────────────────────────────────────────

def sheet_promotions(wb, extra: dict, pharmacy: dict, mois_label: str, logo_path, lang: str | None = None):
    from api.utils_doclang import T, get_document_language

    if not lang:
        lang = get_document_language()

    ws = wb.create_sheet(T(lang, 'xe_sheet_promos'))
    start = _write_sheet_header(ws, pharmacy, T(lang, 'xe_t_promos', mois=mois_label), logo_path, lang=lang)

    headers = [T(lang, 'col_promotion'), T(lang, 'col_type'), T(lang, 'col_valeur_remise'), T(lang, 'col_date_debut'), T(lang, 'col_date_fin'), T(lang, 'col_nb_produits')]
    _write_col_headers(ws, start, headers)
    r = start + 1
    promos = extra["promos_rows"]
    for i, row in enumerate(promos):
        vals = [
            row["nom"], row["type"],
            f"{row['valeur']} %" if row["valeur"] else "—",
            row["date_debut"], row["date_fin"],
            row["nb_produits"],
        ]
        for c, v in enumerate(vals, 1):
            ws.cell(row=r, column=c, value=v).alignment = _align(h="right" if c in (3, 6) else "left")
        _row_style(ws, r, len(headers), is_alt=(i % 2 == 0))
        r += 1
    if not promos:
        ws.cell(row=r, column=1, value=T(lang, 'xe_no_promo')).font = _font(italic=True, color="808080")
    _auto_width(ws)


# ─────────────────────────────────────────────────────────────────────────────
# Feuille 17 — Clients Pro / Mutuelles
# ─────────────────────────────────────────────────────────────────────────────

def sheet_clients_pro(wb, extra: dict, pharmacy: dict, mois_label: str, logo_path, lang: str | None = None):
    from api.utils_doclang import T, get_document_language

    if not lang:
        lang = get_document_language()

    ws = wb.create_sheet(T(lang, 'xe_sheet_clients_pro'))
    start = _write_sheet_header(ws, pharmacy, T(lang, 'xe_t_clients_pro', mois=mois_label), logo_path, lang=lang)

    headers = [
        T(lang, 'col_client'), T(lang, 'col_type'), T(lang, 'col_nb_factures'),
        T(lang, 'col_ca_mois'), T(lang, 'col_encours'), T(lang, 'col_plafond'), T(lang, 'col_taux_util')
    ]
    _write_col_headers(ws, start, headers)
    r = start + 1
    rows = extra["clients_pro_rows"]
    totals = defaultdict(float)
    for i, row in enumerate(rows):
        plafond = row["plafond"]
        taux_util = (row["encours"] / plafond * 100) if plafond else 0
        vals = [
            row["nom"], row["type"], row["nb_factures"],
            _fmt(row["ca_mois"]), _fmt(row["encours"]),
            _fmt(plafond) if plafond else "—",
            _pct(taux_util) if plafond else "—",
        ]
        for c, v in enumerate(vals, 1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.alignment = _align(h="right" if c > 2 else "left")
            if c == 7 and plafond and taux_util > 80:
                cell.font = _font(color=PALETTE["neg"], bold=True)
        _row_style(ws, r, len(headers), is_alt=(i % 2 == 0))
        totals["ca_mois"]  += row["ca_mois"]
        totals["encours"]  += row["encours"]
        r += 1
    for c, v in enumerate([T(lang, 'row_total'), "", "", _fmt(totals["ca_mois"]), _fmt(totals["encours"]), "", ""], 1):
        ws.cell(row=r, column=c, value=v)
    _row_style(ws, r, len(headers), is_total=True)
    if not rows:
        ws.cell(row=r + 1, column=1, value=T(lang, 'xe_no_client_pro')).font = _font(italic=True, color="808080")
    _auto_width(ws)
