"""Écritures d'inventaire et de suivi comptable :

- Régularisations (CCA/PCA/CAP/PAR) + extourne automatique en N+1
- Clôture d'exercice : résultat (120/129) + à-nouveaux + extournes
- Créances douteuses : dotation 691/491, reprise 491/781, perte 651/411
- Dépréciation du stock périmé : 691/391, reprise 391/781
- Paie mensuelle : D 661 + D 664 / C 422 + C 431 + C 447

Toutes les fonctions sont transactionnelles et auditées ; elles lèvent
``rest_framework.exceptions.ValidationError`` en cas de refus métier.
"""
import logging
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from api.audit_helpers import log_audit
from api.models import (
    AuditLog, CompteComptable, CreanceDouteuse, DepreciationStock,
    EcritureComptable, ExerciceComptable, JournalComptable, LigneEcriture,
    Regularisation,
)

logger = logging.getLogger(__name__)


def _compte(numero, libelle, type_):
    compte, _ = CompteComptable.objects.get_or_create(
        numero=numero, defaults={'libelle': libelle, 'type': type_})
    return compte


def _journal(code, nom):
    journal, _ = JournalComptable.objects.get_or_create(
        code=code, defaults={'nom': nom})
    JournalComptable.objects.select_for_update().get(pk=journal.pk)
    return journal


def _exercice_ouvert_pour(date_):
    exercice = ExerciceComptable.objects.select_for_update().filter(
        date_debut__lte=date_, date_fin__gte=date_, est_cloture=False).first()
    if exercice is None:
        raise ValidationError('Aucun exercice comptable ouvert ne couvre cette date.')
    return exercice


def _od(date_, journal, libelle, lignes, reference, exercice=None):
    """Crée une écriture équilibrée. `lignes` = [(compte, libelle, debit, credit)]."""
    exercice = exercice or _exercice_ouvert_pour(date_)
    ecriture = EcritureComptable.objects.create(
        date=date_, journal=journal, exercice=exercice,
        reference=reference, libelle=libelle)
    for compte, lib, debit, credit in lignes:
        LigneEcriture.objects.create(
            ecriture=ecriture, compte=compte, libelle_ligne=lib,
            debit=debit, credit=credit)
    if not ecriture.is_balanced():
        raise ValidationError('Écriture déséquilibrée générée — opération annulée.')
    return ecriture


# ── Régularisations ─────────────────────────────────────────

@transaction.atomic
def creer_regularisation(reg: Regularisation, user=None):
    """Génère l'OD initiale de la régularisation et la lie à l'objet."""
    numero, type_attendu, reg_debite = Regularisation.PARAMS[reg.type]
    compte = reg.compte
    if not compte.is_active or compte.type != type_attendu:
        raise ValidationError(
            f'Le compte {compte.numero} doit être actif et de type {type_attendu} '
            f'pour une régularisation {reg.type}.')
    exercice = _exercice_ouvert_pour(reg.date)
    libelle = f'Régularisation {reg.get_type_display()} — {reg.description}'
    lib_ligne = f'{reg.type} {compte.numero}'
    # CCA/PAR : le compte de régularisation est un actif débité ;
    # PCA/CAP : c'est un passif crédité.
    type_reg = 'ACTIF' if reg_debite else 'PASSIF'
    compte_reg = _compte(numero, libelle=reg.get_type_display(), type_=type_reg)
    if reg_debite:
        lignes = [
            (compte_reg, lib_ligne, reg.montant, Decimal('0')),
            (compte, lib_ligne, Decimal('0'), reg.montant),
        ]
    else:
        lignes = [
            (compte, lib_ligne, reg.montant, Decimal('0')),
            (compte_reg, lib_ligne, Decimal('0'), reg.montant),
        ]
    journal = _journal('OD', 'Opérations diverses')
    reg.ecriture = _od(reg.date, journal, libelle, lignes,
                       f'REG-{reg.type}-{reg.pk}', exercice=exercice)
    reg.save(update_fields=['ecriture'])
    return reg


def _creer_extourne(reg: Regularisation, exercice_n1):
    """Crée l'OD d'extourne au 1er jour de l'exercice N+1 (appelée à la clôture)."""
    numero, _, reg_debite = Regularisation.PARAMS[reg.type]
    compte_reg = _compte(numero, libelle=reg.get_type_display(), type_='ACTIF' if reg_debite else 'PASSIF')
    compte = reg.compte
    libelle = f'Extourne {reg.get_type_display()} — {reg.description}'
    lib_ligne = f'Extourne {reg.type} {compte.numero}'
    if reg_debite:
        lignes = [
            (compte, lib_ligne, reg.montant, Decimal('0')),
            (compte_reg, lib_ligne, Decimal('0'), reg.montant),
        ]
    else:
        lignes = [
            (compte_reg, lib_ligne, reg.montant, Decimal('0')),
            (compte, lib_ligne, Decimal('0'), reg.montant),
        ]
    journal = _journal('OD', 'Opérations diverses')
    return _od(exercice_n1.date_debut, journal, libelle, lignes,
               f'EXT-{reg.type}-{reg.pk}', exercice=exercice_n1)


# ── Clôture d'exercice ──────────────────────────────────────

def _soldes_par_compte(exercice):
    """Solde net par compte sur l'exercice : {compte: debit - credit}."""
    soldes = {}
    for ligne in LigneEcriture.objects.filter(
            ecriture__exercice=exercice).select_related('compte'):
        soldes[ligne.compte_id] = soldes.get(ligne.compte_id, Decimal('0')) + ligne.debit - ligne.credit
    return soldes


@transaction.atomic
def cloturer_exercice(exercice: ExerciceComptable, user=None):
    """Clôture un exercice : écriture du résultat (120/129), à-nouveaux
    des comptes de bilan en N+1 et extournes des régularisations."""
    exercice = ExerciceComptable.objects.select_for_update().get(pk=exercice.pk)
    if exercice.est_cloture:
        raise ValidationError('Cet exercice est déjà clôturé.')
    ecritures = exercice.ecritures.all()
    if ecritures.filter(date__gt=exercice.date_fin).exists():
        raise ValidationError('Des écritures postérieures à la fin de l\'exercice existent.')
    desequilibrees = [e.pk for e in ecritures if not e.is_balanced()]
    if desequilibrees:
        raise ValidationError(
            f'{len(desequilibrees)} écriture(s) déséquilibrée(s) — corrigez avant la clôture.')

    soldes = _soldes_par_compte(exercice)
    comptes = {c.pk: c for c in CompteComptable.objects.filter(pk__in=soldes)}
    lignes_cloture = []
    total_charges = Decimal('0')
    total_produits = Decimal('0')
    for compte_id, solde in soldes.items():
        compte = comptes[compte_id]
        # La ligne de clôture reprend le solde à l'envers : débit du compte
        # créditeur, crédit du compte débiteur.
        ligne_inverse = (compte, f'Clôture {compte.numero}',
                         -solde if solde < 0 else Decimal('0'),
                         solde if solde > 0 else Decimal('0'))
        if compte.type == 'CHARGE' and solde != 0:
            lignes_cloture.append(ligne_inverse)
            total_charges += solde
        elif compte.type == 'PRODUIT' and solde != 0:
            lignes_cloture.append(ligne_inverse)
            total_produits += -solde

    resultat = total_produits - total_charges
    if resultat > 0:
        compte_resultat = _compte('120000', "Résultat de l'exercice", 'PASSIF')
        lignes_cloture.append((compte_resultat, 'Résultat bénéficiaire', Decimal('0'), resultat))
    elif resultat < 0:
        compte_resultat = _compte('129000', "Résultat de l'exercice (déficit)", 'PASSIF')
        lignes_cloture.append((compte_resultat, 'Résultat déficitaire', -resultat, Decimal('0')))

    if not lignes_cloture:
        raise ValidationError('Aucun compte de gestion à solder — clôture refusée.')

    # Écriture de clôture (journal CL) datée de la fin de l'exercice
    journal_cl = _journal('CL', 'Clôture')
    ecriture_cloture = _od(
        exercice.date_fin, journal_cl,
        f'Clôture de l\'exercice {exercice.nom} — détermination du résultat',
        lignes_cloture, f'CLOT-{exercice.pk}', exercice=exercice)

    # Exercice N+1 : réutilise tout exercice existant couvrant le lendemain de
    # la clôture, sinon en crée un (année pleine par défaut).
    debut_n1 = exercice.date_fin + timedelta(days=1)
    exercice_n1 = ExerciceComptable.objects.filter(
        date_debut__lte=debut_n1, date_fin__gte=debut_n1
    ).order_by('date_debut').first()
    if exercice_n1 is None:
        exercice_n1 = ExerciceComptable.objects.create(
            nom=f'Exercice {debut_n1.year}', date_debut=debut_n1,
            date_fin=debut_n1.replace(year=debut_n1.year + 1) - timedelta(days=1))
    elif exercice_n1.est_cloture:
        raise ValidationError(
            f"L'exercice {exercice_n1.nom} est déjà clôturé — "
            'à-nouveaux et extournes impossibles.')

    # À-nouveaux : reprise des soldes bilanciaux (classes 1-5)
    soldes_apres = _soldes_par_compte(exercice)
    comptes = {c.pk: c for c in CompteComptable.objects.filter(pk__in=soldes_apres)}
    lignes_an = []
    for compte_id, solde in sorted(soldes_apres.items(), key=lambda kv: comptes[kv[0]].numero):
        compte = comptes[compte_id]
        if compte.type in ('CHARGE', 'PRODUIT') or solde == 0:
            continue
        if solde > 0:
            lignes_an.append((compte, f'À-nouveau {compte.numero}', solde, Decimal('0')))
        else:
            lignes_an.append((compte, f'À-nouveau {compte.numero}', Decimal('0'), -solde))
    ecriture_an = None
    if lignes_an:
        journal_an = _journal('AN', 'À-nouveaux')
        ecriture_an = _od(
            exercice_n1.date_debut, journal_an,
            f'À-nouveaux — reprise des soldes de {exercice.nom}',
            lignes_an, f'AN-{exercice.pk}', exercice=exercice_n1)

    # Extournes des régularisations de l'exercice clôturé
    extournes = 0
    for reg in Regularisation.objects.filter(
            ecriture__exercice=exercice, extourne_ecriture__isnull=True):
        reg.extourne_ecriture = _creer_extourne(reg, exercice_n1)
        reg.save(update_fields=['extourne_ecriture'])
        extournes += 1

    exercice.est_cloture = True
    exercice.save(update_fields=['est_cloture'])

    log_audit(user=user, action=AuditLog.Action.OTHER,
              model_name='ExerciceComptable', object_id=exercice.pk,
              description=f'Clôture {exercice.nom} : résultat {resultat}',
              details={'ecriture_cloture': ecriture_cloture.numero_piece,
                       'ecriture_an': ecriture_an.numero_piece if ecriture_an else None,
                       'resultat': str(resultat), 'extournes': extournes})
    return {
        'resultat': resultat,
        'ecriture_cloture': ecriture_cloture.numero_piece,
        'ecriture_an': ecriture_an.numero_piece if ecriture_an else None,
        'exercice_n1': exercice_n1.pk,
        'extournes': extournes,
    }


# ── Créances douteuses ──────────────────────────────────────

@transaction.atomic
def marquer_creance(creance: CreanceDouteuse, user=None):
    """D 691000 / C 491000 à la date du jour."""
    from django.utils import timezone
    date_ = timezone.localdate()
    journal = _journal('OD', 'Opérations diverses')
    lignes = [
        (_compte('691000', 'Dotations aux provisions', 'CHARGE'),
         f'Dépréciation créance {creance.client}', creance.montant, Decimal('0')),
        (_compte('491000', 'Dépréciations des comptes de clients', 'PASSIF'),
         f'Dépréciation créance {creance.client}', Decimal('0'), creance.montant),
    ]
    creance.dotation_ecriture = _od(
        date_, journal, f'Dépréciation créance client {creance.client}',
        lignes, f'DEPCLI-{creance.pk}')
    creance.save(update_fields=['dotation_ecriture'])
    log_audit(user=user, action=AuditLog.Action.CREATE,
              model_name='CreanceDouteuse', object_id=creance.pk,
              description=f'Créance douteuse {creance.client} : {creance.montant}')
    return creance


@transaction.atomic
def solder_creance(creance: CreanceDouteuse, mode: str, user=None):
    """mode 'recouvree' → D 491/C 781 ; 'irrecouvrable' → + D 651/C 411."""
    if creance.statut != CreanceDouteuse.Statut.DOUTEUSE:
        raise ValidationError('Cette créance est déjà soldée.')
    from django.utils import timezone
    date_ = timezone.localdate()
    journal = _journal('OD', 'Opérations diverses')
    libelle = f'{"Recouvrement" if mode == "recouvree" else "Perte"} créance douteuse {creance.client}'
    lignes = [
        (_compte('491000', 'Dépréciations des comptes de clients', 'PASSIF'),
         libelle, creance.montant, Decimal('0')),
        (_compte('781000', 'Reprises de provisions', 'PRODUIT'),
         libelle, Decimal('0'), creance.montant),
    ]
    if mode == 'irrecouvrable':
        lignes.extend([
            (_compte('651000', 'Pertes sur créances clients', 'CHARGE'),
             libelle, creance.montant, Decimal('0')),
            (_compte('411100', 'Clients', 'ACTIF'),
             libelle, Decimal('0'), creance.montant),
        ])
    creance.sortie_ecriture = _od(date_, journal, libelle, lignes, f'SOLDEPCLI-{creance.pk}')
    creance.statut = mode
    creance.save(update_fields=['statut', 'sortie_ecriture'])
    log_audit(user=user, action=AuditLog.Action.UPDATE,
              model_name='CreanceDouteuse', object_id=creance.pk,
              description=f'{libelle} : {creance.montant}')
    return creance


# ── Dépréciation du stock périmé ────────────────────────────

def valeur_stock_perime():
    """Valeur des lots expirés : quantité restante × prix d'achat du lot."""
    from django.db.models import ExpressionWrapper, F, DecimalField
    from django.utils import timezone
    from api.models import StockLot
    return StockLot.objects.filter(
        date_expiration__lt=timezone.localdate(),
        quantity_remaining__gt=0,
    ).aggregate(
        total=Sum(ExpressionWrapper(
            F('quantity_remaining') * F('price_cost'),
            output_field=DecimalField()))
    )['total'] or Decimal('0.00')


@transaction.atomic
def creer_depreciation_stock(dep: DepreciationStock, user=None):
    from django.utils import timezone
    date_ = timezone.localdate()
    journal = _journal('OD', 'Opérations diverses')
    lignes = [
        (_compte('691000', 'Dotations aux provisions', 'CHARGE'),
         dep.libelle, dep.montant, Decimal('0')),
        (_compte('391000', 'Dépréciations des stocks de marchandises', 'PASSIF'),
         dep.libelle, Decimal('0'), dep.montant),
    ]
    dep.dotation_ecriture = _od(
        date_, journal, f'Dépréciation stock — {dep.libelle}',
        lignes, f'DEPSTK-{dep.pk}')
    dep.save(update_fields=['dotation_ecriture'])
    return dep


@transaction.atomic
def reprendre_depreciation_stock(dep: DepreciationStock, user=None):
    if dep.statut != DepreciationStock.Statut.DOTEE:
        raise ValidationError('Cette dépréciation est déjà reprise.')
    from django.utils import timezone
    date_ = timezone.localdate()
    journal = _journal('OD', 'Opérations diverses')
    lignes = [
        (_compte('391000', 'Dépréciations des stocks de marchandises', 'PASSIF'),
         f'Reprise — {dep.libelle}', dep.montant, Decimal('0')),
        (_compte('781000', 'Reprises de provisions', 'PRODUIT'),
         f'Reprise — {dep.libelle}', Decimal('0'), dep.montant),
    ]
    dep.reprise_ecriture = _od(
        date_, journal, f'Reprise dépréciation stock — {dep.libelle}',
        lignes, f'REPDEPSTK-{dep.pk}')
    dep.statut = DepreciationStock.Statut.REPRISE
    dep.save(update_fields=['statut', 'reprise_ecriture'])
    return dep


# ── Paie ────────────────────────────────────────────────────

@transaction.atomic
def comptabiliser_paie(paie, user=None):
    """D 661 brut, D 664 patronales / C 422 net, C 431 cotisations, C 447 IRPP."""
    if paie.statut == 'comptabilisee':
        raise ValidationError('Cette paie est déjà comptabilisée.')
    net = paie.net_a_payer
    if net < 0:
        raise ValidationError('Le net à payer ne peut pas être négatif.')
    exercice = _exercice_ouvert_pour(paie.mois)
    journal = _journal('PA', 'Paie')
    nom = paie.employe.nom
    libelle = f'Paie {nom} — {paie.mois:%m/%Y}'
    lignes = [
        (_compte('661000', 'Salaires et rémunérations', 'CHARGE'),
         f'Brut {nom}', paie.brut, Decimal('0')),
        (_compte('664000', 'Charges sociales à la charge de l\'entreprise', 'CHARGE'),
         f'Charges patronales {nom}', paie.charges_patronales, Decimal('0')),
        (_compte('422000', 'Personnel - Rémunérations dues', 'PASSIF'),
         f'Net à payer {nom}', Decimal('0'), net),
        (_compte('431000', 'Sécurité sociale (CNPS)', 'PASSIF'),
         f'Cotisations {nom}', Decimal('0'),
         paie.cotisations_salariales + paie.charges_patronales),
        (_compte('447000', 'Autres impôts et taxes', 'PASSIF'),
         f'IRPP {nom}', Decimal('0'), paie.irpp),
    ]
    # Les lignes à montant nul n'ont pas lieu d'être
    lignes = [l for l in lignes if l[2] > 0 or l[3] > 0]
    if not lignes:
        raise ValidationError('Paie entièrement nulle — aucune écriture à générer.')
    paie.ecriture = _od(paie.mois, journal, libelle, lignes,
                        f'PAIE-{paie.pk}', exercice=exercice)
    paie.statut = 'comptabilisee'
    paie.save(update_fields=['statut', 'ecriture'])
    log_audit(user=user, action=AuditLog.Action.OTHER,
              model_name='PaieMois', object_id=paie.pk,
              description=f'{libelle} : net {net}', request=None)
    return paie


def virement_tresorerie(*, sens, montant, date_, libelle='', user=None):
    """Virement interne caisse ↔ banque.

    caisse_banque : D 521100 / C 571100 (dépôt d'espèces en banque)
    banque_caisse : D 571100 / C 521100 (retrait d'espèces à la banque)
    """
    try:
        montant = Decimal(str(montant))
    except InvalidOperation:
        raise ValidationError('Le montant est invalide.')
    if montant <= 0:
        raise ValidationError('Le montant doit être positif.')
    if sens not in ('caisse_banque', 'banque_caisse'):
        raise ValidationError("Sens de virement invalide.")

    caisse = _compte('571100', 'Caisse', 'ACTIF')
    banque = _compte('521100', 'Banque', 'ACTIF')
    debit, credit = (banque, caisse) if sens == 'caisse_banque' else (caisse, banque)
    titre = libelle or (
        'Dépôt espèces en banque' if sens == 'caisse_banque'
        else 'Retrait espèces à la banque')

    with transaction.atomic():
        ecriture = _od(date_, _journal('OD', 'Opérations diverses'), titre, [
            (debit, titre, montant, Decimal('0')),
            (credit, titre, Decimal('0'), montant),
        ], 'VIR-TRESO')
        ecriture.reference = f'VIR-TRESO-{ecriture.pk}'
        ecriture.save(update_fields=['reference'])
    log_audit(user=user, action=AuditLog.Action.OTHER,
              model_name='EcritureComptable', object_id=ecriture.pk,
              description=f'{titre} : {montant} F', request=None)
    return ecriture
