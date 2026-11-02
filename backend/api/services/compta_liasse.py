"""
Liasse OHADA simplifiée : bilan (actif/passif) et compte de résultat
au format des lignes officielles SYSCOHADA.

⚠️ V1 — mapping compte → ligne de liasse approximatif, à faire valider par
un expert-comptable avant usage fiscal. Les refs suivent la nomenclature
SYSCOHADA révisé (bilan actif AD…BZ, passif CA…DZ ; résultat TA…XF).

Usage : EcritureComptableViewSet.export_document?type=liasse
"""

from collections import OrderedDict
from decimal import Decimal

from django.db.models import F, Sum
from django.db.models.functions import Coalesce
from django.db.models import DecimalField

from ..models import LigneEcriture, Produit

# (ref, libellé, préfixes de comptes). sens :
#   actif/charge  → solde = débit − crédit
#   passif/produit → solde = crédit − débit

BILAN_ACTIF = [
    ('AD', 'Immobilisations incorporelles', ['20', '21']),
    ('AE', 'Immobilisations corporelles', ['22', '23', '24']),
    ('AG', 'Immobilisations financières', ['25', '26', '27']),
    ('AZ', 'TOTAL ACTIF IMMOBILISÉ', ['2']),
    ('BA', 'Stocks et encours', ['31', '32', '33', '34', '35', '36', '37', '38', '39']),
    ('BB', 'Fournisseurs avances versées', ['409']),
    ('BG', 'Clients', ['411', '414', '415', '416', '418']),
    ('BH', 'Autres créances', ['412', '413', '417', '419', '421', '422', '425', '428', '44', '45', '46', '47', '48', '49']),
    ('BK', 'Titres de placement', ['50', '52', '53', '54']),
    ('BQ', 'Trésorerie-actif (caisse, banques)', ['51', '56', '57', '58', '59']),
    ('BZ', 'TOTAL ACTIF CIRCULANT + TRÉSORERIE', None),  # calculé
]

BILAN_PASSIF = [
    ('CA', 'Capital', ['10', '101', '102', '103', '104', '105', '108', '109']),
    ('CB', 'Réserves et primes', ['11', '110', '111', '112', '118']),
    ('CC', 'Report à nouveau', ['12', '120', '121', '129']),
    ('CD', 'Résultat net de l\'exercice', ['13', '130', '131', '132', '139']),
    ('CE', 'Autres capitaux propres', ['14', '15', '19']),
    ('CZ', 'TOTAL CAPITAUX PROPRES', ['1']),
    ('DA', 'Emprunts et dettes financières', ['16', '17', '18']),
    ('DB', 'Dettes de location-acquisition / leasing', ['167', '172', '176']),
    ('DD', 'Provisions pour risques et charges', ['19']),
    ('DF', 'Fournisseurs et comptes rattachés', ['401', '402', '404', '405', '408', '419']),
    ('DG', 'Clients avances reçues', ['4191']),
    ('DH', 'Dettes fiscales et sociales', ['42', '43', '44', '45']),
    ('DI', 'Autres dettes', ['46', '47', '48', '49']),
    ('DJ', 'Provisions pour risques à court terme', ['499', '599']),
    ('DR', 'Trésorerie-passif (découverts)', ['520', '560', '565']),
    ('DZ', 'TOTAL PASSIF CIRCULANT + TRÉSORERIE', None),  # calculé
]

COMPTE_RESULTAT = [
    ('TA', 'Ventes de marchandises', ['701', '702'], 'produit'),
    ('TB', 'Ventes de produits fabriqués et services', ['703', '704', '705', '706'], 'produit'),
    ('TC', 'Travaux, services vendus', ['706', '707'], 'produit'),
    ('TD', 'Production stockée / déstockée', ['71', '72'], 'produit'),
    ('TE', 'Production immobilisée', ['73'], 'produit'),
    ('TF', 'Autres produits', ['74', '75', '77', '78', '79'], 'produit'),
    ('TG', 'TOTAL PRODUITS', None, 'produit'),
    ('RA', 'Achats de marchandises', ['601', '6021'], 'charge'),
    ('RB', 'Variation des stocks de marchandises', ['603'], 'charge'),
    ('RC', 'Achats de matières et fournitures', ['602', '604', '605'], 'charge'),
    ('RD', 'Autres achats et variations', ['606', '607', '608'], 'charge'),
    ('RE', 'Transports', ['61'], 'charge'),
    ('RF', 'Services extérieurs', ['62', '63'], 'charge'),
    ('RG', 'Impôts et taxes', ['64'], 'charge'),
    ('RH', 'Autres charges', ['65', '66', '67', '68', '69'], 'charge'),
    ('RG2', 'Dotations aux amortissements', ['681'], 'charge'),
    ('RH2', 'Dotations aux provisions', ['691'], 'charge'),
    ('RJ', 'TOTAL CHARGES', None, 'charge'),
    ('XE', 'RÉSULTAT NET (produits − charges)', None, 'net'),
]


def _soldes_par_compte(date_debut, date_fin):
    """Solde débit−crédit par numéro de compte sur la période (toutes lignes)."""
    from django.db.models import Q
    filters = Q()
    if date_debut:
        filters &= Q(ecriture__date__gte=date_debut)
    if date_fin:
        filters &= Q(ecriture__date__lte=date_fin)
    qs = LigneEcriture.objects.filter(filters).values('compte__numero').annotate(
        solde=Sum('debit') - Sum('credit'))
    return {r['compte__numero']: (r['solde'] or Decimal('0.00')) for r in qs}


def _montant(prefixes, soldes, signe):
    """Somme des soldes des comptes commençant par un des préfixes.
    signe 'actif'/'charge' → débit−crédit ; 'passif'/'produit' → crédit−débit."""
    total = Decimal('0.00')
    for num, solde in soldes.items():
        if any(num.startswith(p) for p in prefixes):
            total += solde
    return -total if signe in ('passif', 'produit') else total


def compute_liasse(date_debut, date_fin):
    """Retourne les lignes de la liasse avec montants calculés."""
    soldes = _soldes_par_compte(date_debut, date_fin)

    # Injection du stock physique (comme l'action bilan) : compte 311000 à l'actif
    valeur_stock = Produit.objects.filter(is_active=True).aggregate(
        total=Coalesce(Sum(F('stock') * Coalesce(F('pmp'), F('cost_price'))),
                       Decimal('0.00'), output_field=DecimalField()))['total']

    def lignes(table, signe):
        out = []
        for ref, lib, prefixes, *_ in table:
            if ref.endswith('Z'):
                continue  # totaux calculés après
            montant = _montant(prefixes, soldes, signe)
            if ref == 'BA':  # stocks : ajouter la valeur physique
                montant += valeur_stock
            out.append({'ref': ref, 'libelle': lib, 'montant': montant})
        return out

    actif = lignes(BILAN_ACTIF, 'actif')
    passif = lignes(BILAN_PASSIF, 'passif')
    # Résultat injecté au passif (compte 13) comme dans l'action bilan
    produits = _montant(['7'], soldes, 'produit') + valeur_stock
    charges = _montant(['6'], soldes, 'charge')
    resultat = produits - charges
    for l in passif:
        if l['ref'] == 'CD':
            l['montant'] = resultat

    cr_lines = []
    for ref, lib, prefixes, sens in COMPTE_RESULTAT:
        if prefixes is None:
            montant = produits if sens == 'produit' else charges if sens == 'charge' else resultat
        else:
            montant = _montant(prefixes, soldes, sens)
            if ref == 'RB':  # variation de stock : valeur physique estimée
                montant += valeur_stock
        cr_lines.append({'ref': ref, 'libelle': lib, 'montant': montant})

    return {
        'actif': actif,
        'passif': passif,
        'resultat': cr_lines,
        'totaux': {
            'total_actif': sum(l['montant'] for l in actif),
            'total_passif': sum(l['montant'] for l in passif),
            'total_produits': produits,
            'total_charges': charges,
            'resultat_net': resultat,
        },
        'valeur_stock': valeur_stock,
    }
