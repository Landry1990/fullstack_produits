"""
Collecte unifiée des ventes « par lot » pour les rapports.

Une vente est comptée une seule fois, depuis l'une de ces deux sources :
- ses allocations de lots (FactureProduitAllocation) — coût = prix d'achat du lot ;
- à défaut d'allocation (vente sans traçabilité lot), la ligne de facture
  elle-même — lot « Sans lot », coût = PMP actuel du produit.

Règles communes :
- factures actives, validées ou payées ; une VALIDEE doit avoir au moins un
  paiement complété ;
- CA TTC net de la remise ligne ET de la remise globale de la facture
  (répartie au prorata du brut des lignes) ;
- CA HT = CA TTC / (1 + TVA de la ligne) ; marge = CA HT − coût d'achat HT.
"""
from decimal import Decimal

from django.db.models import Case, CharField, Exists, F, OuterRef, Q, Sum, Value, When
from django.db.models.functions import Coalesce

from ..models import Caisse, Facture, FactureProduit, FactureProduitAllocation
from ..utils_doclang import T, get_document_language


def factures_retenues(date_debut=None, date_fin=None):
    """Factures prises en compte par les rapports de ventes."""
    qs = Facture.objects.annotate(
        has_paiement=Exists(Caisse.objects.filter(facture=OuterRef('pk'), statut='completee'))
    ).filter(
        is_active=True,
        status__in=[Facture.Status.VALIDEE, Facture.Status.PAYEE],
    ).exclude(status=Facture.Status.VALIDEE, has_paiement=False)
    if date_debut:
        qs = qs.filter(date__gte=date_debut)
    if date_fin:
        qs = qs.filter(date__lte=date_fin)
    return qs


def collect_sales_records(date_debut=None, date_fin=None, fournisseur_id=None, lang=None):
    """
    Retourne une liste de ventes unitaires (une par allocation ou par ligne sans
    allocation) avec les clés : facture_id, date, numero, f_id, f_nom, produit_id,
    p_nom, cip, lot, exp, qte, ug, pu, tva, vente (TTC), vente_ht, achat, sort.
    """
    lang = lang or get_document_language()
    factures = factures_retenues(date_debut, date_fin)
    text = CharField()
    inconnu = Value(T(lang, 'fournisseur_inconnu'))
    sans_lot = T(lang, 'sans_lot')

    # 1. Ventes tracées par lot. Fournisseur = celui du lot, sinon celui du produit.
    allocs = FactureProduitAllocation.objects.filter(facture_produit__facture__in=factures)
    if fournisseur_id:
        allocs = allocs.filter(
            Q(stock_lot__fournisseur_id=fournisseur_id)
            | Q(stock_lot__fournisseur__isnull=True, facture_produit__produit__fournisseur_id=fournisseur_id)
        )
    allocs = allocs.annotate(
        f_id=Coalesce('stock_lot__fournisseur_id', 'facture_produit__produit__fournisseur_id'),
        f_nom=Coalesce(
            'stock_lot__fournisseur__name', 'facture_produit__produit__fournisseur__name',
            'stock_lot__fournisseur_nom', inconnu, output_field=text,
        ),
        p_nom=Coalesce(
            'facture_produit__produit__name', 'facture_produit__produit_nom',
            'stock_lot__produit_nom', Value('N/A'), output_field=text,
        ),
        lot_label=Case(
            When(stock_lot__isnull=False, then=Coalesce('stock_lot__lot', Value(''), output_field=text)),
            When(is_pending=True, then=Value(T(lang, 'sans_lot_attente'))),
            default=Value(sans_lot),
            output_field=text,
        ),
    ).values(
        'id', 'facture_produit__facture_id', 'facture_produit__facture__date',
        'facture_produit__facture__numero_facture', 'f_id', 'f_nom', 'facture_produit__produit_id',
        'p_nom', 'facture_produit__produit__cip1', 'lot_label', 'stock_lot__date_expiration',
        'quantity', 'quantity_free', 'cost_price',
        'facture_produit__selling_price', 'facture_produit__discount', 'facture_produit__tva',
    )

    # 2. Lignes vendues sans aucune allocation → coût au PMP du produit.
    lignes = FactureProduit.objects.filter(facture__in=factures).annotate(
        has_alloc=Exists(FactureProduitAllocation.objects.filter(facture_produit=OuterRef('pk')))
    ).filter(has_alloc=False)
    if fournisseur_id:
        lignes = lignes.filter(produit__fournisseur_id=fournisseur_id)
    lignes = lignes.annotate(
        f_nom=Coalesce('produit__fournisseur__name', inconnu, output_field=text),
        p_nom=Coalesce('produit__name', 'produit_nom', Value('N/A'), output_field=text),
    ).values(
        'id', 'facture_id', 'facture__date', 'facture__numero_facture', 'produit__fournisseur_id',
        'f_nom', 'produit_id', 'p_nom', 'produit__cip1', 'date_expiration', 'quantity',
        'produit__pmp', 'selling_price', 'discount', 'tva',
    )

    records = []
    for a in allocs:
        records.append({
            'sort': (a['facture_produit__facture__date'], 0, a['id']),
            'facture_id': a['facture_produit__facture_id'],
            'date': a['facture_produit__facture__date'],
            'numero': a['facture_produit__facture__numero_facture'],
            'f_id': a['f_id'], 'f_nom': a['f_nom'],
            'produit_id': a['facture_produit__produit_id'], 'p_nom': a['p_nom'],
            'cip': a['facture_produit__produit__cip1'] or '',
            'lot': a['lot_label'], 'exp': a['stock_lot__date_expiration'],
            'qte': a['quantity'], 'ug': a['quantity_free'], 'cost': a['cost_price'] or Decimal(0),
            'pu': (a['facture_produit__selling_price'] or Decimal(0)) - (a['facture_produit__discount'] or Decimal(0)),
            'tva': a['facture_produit__tva'] or Decimal(0),
        })
    for line in lignes:
        records.append({
            'sort': (line['facture__date'], 1, line['id']),
            'facture_id': line['facture_id'],
            'date': line['facture__date'],
            'numero': line['facture__numero_facture'],
            'f_id': line['produit__fournisseur_id'], 'f_nom': line['f_nom'],
            'produit_id': line['produit_id'], 'p_nom': line['p_nom'],
            'cip': line['produit__cip1'] or '',
            'lot': sans_lot, 'exp': line['date_expiration'],
            'qte': line['quantity'], 'ug': 0, 'cost': line['produit__pmp'] or Decimal(0),
            'pu': (line['selling_price'] or Decimal(0)) - (line['discount'] or Decimal(0)),
            'tva': line['tva'] or Decimal(0),
        })

    # Remise globale : facteur (1 − remise / brut des lignes) par facture.
    involved = {r['facture_id'] for r in records}
    bruts = dict(
        FactureProduit.objects.filter(facture_id__in=involved).values('facture_id')
        .annotate(b=Sum(F('quantity') * (F('selling_price') - F('discount'))))
        .values_list('facture_id', 'b')
    )
    facteur = {}
    for f_id, remise in Facture.objects.filter(id__in=involved).values_list('id', 'remise'):
        brut = bruts.get(f_id) or Decimal(0)
        facteur[f_id] = (Decimal(1) - (remise or Decimal(0)) / brut) if brut > 0 else Decimal(1)

    for r in records:
        vente = r['qte'] * r['pu'] * facteur.get(r['facture_id'], Decimal(1))
        r['vente'] = vente
        r['vente_ht'] = vente * 100 / (100 + r['tva'])
        r['achat'] = r['qte'] * r['cost']
    return records


def money(value) -> float:
    return float(Decimal(value).quantize(Decimal('0.01')))


def taux(marge, base) -> float:
    return round(float(marge) / float(base) * 100, 2) if base else 0
