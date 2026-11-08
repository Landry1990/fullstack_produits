"""
Plan de pilotage expert du stock : quoi commander, quand, combien —
et quoi ne plus commander.

Mêmes formules que le moteur de suggestions « optimise »
(VMD historique ajustée par la tendance 4 s/8 s, seuils min/max
calculés depuis les délais fournisseur), agrégées en lecture seule.
La VMD est proratisée sur l'âge réel des données (première vente du
système, date de création du produit ; plancher 7 j) pour rester fiable
avant 90 j d'utilisation :

- ``commander``         : date limite de commande dépassée
                          (couverture <= délai livraison + marge retard)
- ``bientot``           : date limite de commande dans l'horizon
                          (= ``periode`` jours, défaut 30)
- ``ne_pas_commander``  : produits dormants (aucune vente depuis le seuil
                          ``dormant_stock_days`` des paramètres), quel que
                          soit le stock — un dormant en rupture ne doit
                          pas être réapprovisionné.

Les produits dormants sont exclus des listes de commande même si une
VMD résiduelle subsiste (dormant_stock_days < 90 j configuré).
"""
import math
from datetime import timedelta
from decimal import Decimal

from django.core.cache import cache
from django.db.models import Exists, OuterRef, Q, Sum
from django.utils import timezone

from api.models import Facture, MouvementStock, Produit
from api.services.replenishment_service import (
    compute_jours_dispo,
    compute_vmd_tendance,
    get_jours_donnees,
)
from api.utils.dates import day_start

CACHE_TTL = 300  # 5 min

_STATUTS_VENTE = [Facture.Status.VALIDEE, Facture.Status.PAYEE]


def compute_stock_pilotage(periode=30, fournisseur_id=None):
    """Retourne le plan de commande expert (mis en cache 5 min)."""
    cache_key = f"stock_pilotage:{periode}:{fournisseur_id or 'all'}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    from api.models.settings import PharmacySettings

    ps = PharmacySettings.objects.first()
    today = timezone.localtime(timezone.now()).date()
    dormant_days = ps.dormant_stock_days if (ps and ps.dormant_stock_days) else 90
    limit_date = today - timedelta(days=dormant_days)

    # Âge réel des données de vente : avant 90 j d'utilisation, la VMD est
    # proratisée (sinon les quantités suggérées seraient sous-estimées).
    jours_donnees = get_jours_donnees(today)

    # ── 1. Produits dormants → « ne plus commander » ──────────────────────
    # Même périmètre temporel que statistiques/stock_health, mais sans le
    # filtre stock > 0 : un dormant en rupture ne doit pas être recommandé.
    # Restreint aux produits ayant déjà eu du mouvement (vente, achat ou
    # mouvement de stock) — les fiches catalogue jamais utilisées n'ont
    # pas vocation à apparaître ici.
    a_eu_mouvement = (
        Q(dernier_vente__isnull=False) |
        Q(dernier_achat__isnull=False) |
        Exists(MouvementStock.objects.filter(produit=OuterRef('pk')))
    )
    dormant_qs = Produit.objects.filter(
        is_active=True, type_produit='PRODUIT'
    ).filter(a_eu_mouvement).filter(
        Q(dernier_vente__lte=limit_date) |
        (Q(dernier_vente__isnull=True) & Q(dernier_achat__lte=limit_date)) |
        (Q(dernier_vente__isnull=True) & Q(dernier_achat__isnull=True) &
         Q(created_at__lt=day_start(limit_date + timedelta(days=1))))
    )
    # Exclusion globale des listes de commande (indépendante du filtre fournisseur)
    dormant_ids = set(dormant_qs.values_list('id', flat=True))
    if fournisseur_id:
        dormant_qs = dormant_qs.filter(fournisseur_id=fournisseur_id)
    dormant_qs = dormant_qs.select_related('fournisseur')

    ne_pas_commander = []
    for p in dormant_qs.iterator(chunk_size=500):
        if p.dernier_vente:
            jours_sans_vente = max(0, (today - p.dernier_vente).days)
        else:
            ref = p.dernier_achat or (p.created_at.date() if p.created_at else None)
            jours_sans_vente = max(0, (today - ref).days) if ref else dormant_days
        stock = int(p.stock or 0)
        valeur = float(stock) * float(p.pmp or 0)
        ne_pas_commander.append({
            'produit_id': p.id,
            'produit_nom': p.name or '',
            'produit_ref': p.cip1 or '',
            'fournisseur_id': p.fournisseur_id,
            'fournisseur_nom': p.fournisseur.name if p.fournisseur_id else 'N/A',
            'stock': stock,
            'valeur_stock': round(valeur, 2),
            'jours_sans_vente': jours_sans_vente,
            'derniere_vente': p.dernier_vente.isoformat() if p.dernier_vente else None,
            'en_rupture': stock <= 0,
        })
    ne_pas_commander.sort(key=lambda x: (-x['valeur_stock'], -x['jours_sans_vente']))

    # ── 2. Ventes agrégées (mêmes fenêtres que calculer_optimisation_intelligente)
    date_90j = timezone.now() - timedelta(days=90)
    date_4s = timezone.now() - timedelta(days=28)
    date_8s = timezone.now() - timedelta(days=56)

    produits = Produit.objects.filter(
        is_active=True, type_produit='PRODUIT'
    ).select_related('fournisseur').annotate(
        ventes_90j=Sum('factureproduit__quantity', filter=Q(
            factureproduit__facture__date__gte=date_90j,
            factureproduit__facture__status__in=_STATUTS_VENTE,
        )),
        ventes_4s=Sum('factureproduit__quantity', filter=Q(
            factureproduit__facture__date__gte=date_4s,
            factureproduit__facture__status__in=_STATUTS_VENTE,
        )),
        ventes_8s_4s=Sum('factureproduit__quantity', filter=Q(
            factureproduit__facture__date__gte=date_8s,
            factureproduit__facture__date__lt=date_4s,
            factureproduit__facture__status__in=_STATUTS_VENTE,
        )),
    )
    if fournisseur_id:
        from api.models import StockLot
        lots_produit_ids = StockLot.objects.filter(
            fournisseur_id=fournisseur_id
        ).values_list('produit_id', flat=True)
        produits = produits.filter(
            Q(fournisseur_id=fournisseur_id) | Q(id__in=lots_produit_ids)
        )

    # ── 3. Plan de commande ───────────────────────────────────────────────
    commander, bientot = [], []
    for produit in produits.iterator(chunk_size=500):
        if produit.id in dormant_ids:
            continue

        ventes_90j = produit.ventes_90j or 0
        ventes_4s = produit.ventes_4s or 0
        ventes_8s_4s = produit.ventes_8s_4s or 0

        # Jours pendant lesquels le produit a réellement pu être vendu :
        # borné par l'âge des données globales ET l'âge du produit.
        jours_dispo = compute_jours_dispo(
            produit.created_at, today=today, jours_donnees=jours_donnees
        )
        vmd_historique, vmd_ajustee, tendance = compute_vmd_tendance(
            ventes_90j, ventes_4s, ventes_8s_4s, jours_dispo
        )
        if vmd_historique <= 0:
            continue  # pas de ventes 90 j et pas dormant (ex. nouveauté)
        vmd = vmd_ajustee
        if vmd <= 0:
            continue

        fournisseur = produit.fournisseur
        delai_livraison = getattr(fournisseur, 'delai_livraison_jours', None) or 2
        marge_retard = getattr(fournisseur, 'marge_retard_jours', None) or 2

        stock = int(produit.stock or 0)
        stock_securite = vmd * marge_retard
        stock_minimum = (vmd * delai_livraison) + stock_securite
        stock_maximum = stock_minimum + (vmd * periode)

        couverture = stock / vmd
        # Il faut commander quand la couverture atteint délai + marge
        jours_avant_commande = couverture - (delai_livraison + marge_retard)
        if jours_avant_commande > periode:
            continue  # stock suffisant au-delà de l'horizon de couverture

        quantite = max(0, int(math.ceil(stock_maximum - stock)))
        if quantite <= 0:
            continue

        prix_achat = float(produit.cost_price or 0)
        montant_ht = round(prix_achat * quantite, 2)
        date_rupture = today + timedelta(days=int(couverture))
        date_limite = today + timedelta(days=max(0, math.ceil(jours_avant_commande)))

        if stock <= 0:
            urgence = 'rupture'
        elif couverture <= delai_livraison:
            urgence = 'critique'
        else:
            urgence = 'alerte'

        item = {
            'produit_id': produit.id,
            'produit_nom': produit.name or '',
            'produit_ref': produit.cip1 or '',
            'fournisseur_id': produit.fournisseur_id,
            'fournisseur_nom': produit.fournisseur.name if produit.fournisseur else 'N/A',
            'stock': stock,
            'vmd': round(vmd, 2),
            'rotation_mois': round(vmd * 30, 1),
            'stock_minimum': math.ceil(stock_minimum),
            'stock_maximum': math.ceil(stock_maximum),
            'jours_base': jours_dispo,
            'tendance': round(tendance, 2),
            'couverture_jours': int(couverture),
            'quantite_suggeree': quantite,
            'prix_achat': prix_achat,
            'montant_ht': montant_ht,
            'urgence': urgence,
            'date_limite': date_limite.isoformat(),
            'date_rupture': date_rupture.isoformat(),
            'delai_livraison': delai_livraison,
            'raison': _build_raison(stock, stock_minimum, stock_maximum, vmd),
        }
        if jours_avant_commande <= 0:
            commander.append(item)
        else:
            bientot.append(item)

    commander.sort(key=lambda x: (x['couverture_jours'], -x['montant_ht']))
    bientot.sort(key=lambda x: x['date_limite'])

    result = {
        'periode': periode,
        'dormant_days': dormant_days,
        'jours_donnees': jours_donnees,
        'summary': {
            'commander_count': len(commander),
            'commander_montant_ht': round(sum(i['montant_ht'] for i in commander), 2),
            'bientot_count': len(bientot),
            'bientot_montant_ht': round(sum(i['montant_ht'] for i in bientot), 2),
            'ne_pas_commander_count': len(ne_pas_commander),
            'ne_pas_commander_valeur': round(sum(i['valeur_stock'] for i in ne_pas_commander), 2),
        },
        'commander': commander,
        'bientot': bientot,
        'ne_pas_commander': ne_pas_commander,
    }
    cache.set(cache_key, result, CACHE_TTL)
    return result


def _build_raison(stock, stock_minimum, stock_maximum, vmd):
    if stock <= 0:
        return f"RUPTURE. Objectif={stock_maximum:.0f}. VMD={vmd:.2f}u/j."
    return (
        f"Stock={stock} ≤ SeuilMin={stock_minimum:.1f}. "
        f"Objectif={stock_maximum:.1f}. VMD={vmd:.2f}u/j."
    )
