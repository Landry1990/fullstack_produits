from datetime import date, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.test import TestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIRequestFactory, force_authenticate

from api.models import (
    CompteComptable, CreanceDouteuse, DepreciationStock,
    EcritureComptable, Employe, ExerciceComptable, PaieMois, Regularisation,
)
from api.services.compta_inventaire import (
    cloturer_exercice, comptabiliser_paie, creer_depreciation_stock,
    creer_regularisation, marquer_creance, reprendre_depreciation_stock,
    solder_creance, virement_tresorerie,
)
from .factories import TestDataFactory


YEAR = 2026


def _compte(numero, type_):
    compte, _ = CompteComptable.objects.get_or_create(
        numero=numero, defaults={'libelle': numero, 'type': type_})
    if compte.type != type_:
        compte.type = type_
        compte.save(update_fields=['type'])
    return compte


def _solde(numero, exercice):
    from django.db.models import Sum
    from api.models import LigneEcriture
    agg = LigneEcriture.objects.filter(
        ecriture__exercice=exercice, compte__numero=numero
    ).aggregate(d=Sum('debit'), c=Sum('credit'))
    return (agg['d'] or Decimal('0')) - (agg['c'] or Decimal('0'))


class BaseCompta(TestCase):
    def setUp(self):
        self.admin = TestDataFactory.create_superuser()
        # L'exercice couvre YEAR (écritures de test) ET la date du jour :
        # marquer_creance / solder_creance / creer_depreciation_stock postent
        # à timezone.localdate().
        today = date.today()
        self.exercice = ExerciceComptable.objects.create(
            nom=f'EX{YEAR}',
            date_debut=min(date(YEAR, 1, 1), date(today.year, 1, 1)),
            date_fin=max(date(YEAR, 12, 31), date(today.year, 12, 31)))

    def od(self, lignes, ref, jour=date(YEAR, 6, 15)):
        """[(numero, debit, credit)] → écriture OD équilibrée dans l'exercice."""
        from api.models import JournalComptable, LigneEcriture
        journal, _ = JournalComptable.objects.get_or_create(code='OD', defaults={'nom': 'OD'})
        ecriture = EcritureComptable.objects.create(
            date=jour, journal=journal, exercice=self.exercice,
            reference=ref, libelle=ref)
        for numero, debit, credit in lignes:
            type_ = 'CHARGE' if numero[0] == '6' else ('PRODUIT' if numero[0] == '7' else 'ACTIF')
            LigneEcriture.objects.create(
                ecriture=ecriture, compte=_compte(numero, type_),
                debit=debit, credit=credit)
        return ecriture


class RegularisationTests(BaseCompta):
    def setUp(self):
        super().setUp()
        self.charge = _compte('622200', 'CHARGE')
        self.produit = _compte('701100', 'PRODUIT')

    def test_cca_debite_481_credite_charge(self):
        reg = Regularisation.objects.create(
            type='CCA', compte=self.charge, montant=Decimal('300000'),
            date=date(YEAR, 12, 31), description='Loyer janvier payé d’avance')
        creer_regularisation(reg)
        ecriture = reg.ecriture
        self.assertTrue(ecriture.is_balanced())
        self.assertEqual(_solde('481000', self.exercice), Decimal('300000'))
        self.assertEqual(_solde('622200', self.exercice), Decimal('-300000'))

    def test_cap_credite_482(self):
        reg = Regularisation.objects.create(
            type='CAP', compte=self.charge, montant=Decimal('50000'),
            date=date(YEAR, 12, 31), description='Facture ENEO décembre non reçue')
        creer_regularisation(reg)
        self.assertEqual(_solde('482000', self.exercice), Decimal('-50000'))
        self.assertEqual(_solde('622200', self.exercice), Decimal('50000'))

    def test_compte_type_refuse(self):
        reg = Regularisation.objects.create(
            type='CCA', compte=self.produit, montant=Decimal('1000'),
            date=date(YEAR, 12, 31), description='Mauvais type')
        with self.assertRaises(ValidationError):
            creer_regularisation(reg)

    def test_patch_montant_regenere_od(self):
        """La modification d'une régularisation remplace son OD — le journal
        ne doit pas garder l'ancien montant."""
        from rest_framework.test import APIClient
        api_client = APIClient()
        api_client.force_authenticate(self.admin)
        reg = Regularisation.objects.create(
            type='CCA', compte=self.charge, montant=Decimal('300000'),
            date=date(YEAR, 12, 31), description='Loyer payé d’avance')
        creer_regularisation(reg)
        ancienne_od = reg.ecriture
        response = api_client.patch(
            f'/api/compta/regularisations/{reg.pk}/',
            {'montant': '500000'}, format='json')
        self.assertEqual(response.status_code, 200)
        reg.refresh_from_db()
        self.assertIsNotNone(reg.ecriture_id)
        self.assertNotEqual(reg.ecriture_id, ancienne_od.pk)
        self.assertFalse(EcritureComptable.objects.filter(pk=ancienne_od.pk).exists())
        self.assertEqual(_solde('481000', self.exercice), Decimal('500000'))
        self.assertEqual(_solde('622200', self.exercice), Decimal('-500000'))


class ClotureTests(BaseCompta):
    def setUp(self):
        super().setUp()
        # Vente 1 000 000, charge 600 000 → bénéfice 400 000
        self.od([('571100', 1000000, 0), ('701100', 0, 1000000)], 'V1')
        self.od([('622200', 600000, 0), ('571100', 0, 600000)], 'C1')
        # Régularisation à extourner
        reg = Regularisation.objects.create(
            type='CAP', compte=_compte('622200', 'CHARGE'), montant=Decimal('50000'),
            date=date(YEAR, 12, 31), description='Charge déc à payer')
        creer_regularisation(reg)
        self.reg = reg

    def test_cloture_genere_resultat_et_anouveaux(self):
        # Produits 1 000 000 − charges (600 000 + 50 000 CAP) = 350 000
        resultat = cloturer_exercice(self.exercice, user=self.admin)
        self.assertEqual(resultat['resultat'], Decimal('350000'))
        self.exercice.refresh_from_db()
        self.assertTrue(self.exercice.est_cloture)
        n1 = ExerciceComptable.objects.get(pk=resultat['exercice_n1'])
        self.assertEqual(n1.date_debut, self.exercice.date_fin + timedelta(days=1))
        # Résultat crédité en 120000
        self.assertEqual(_solde('120000', self.exercice), Decimal('-350000'))
        # À-nouveaux : caisse reprise en N+1
        self.assertEqual(_solde('571100', n1), Decimal('400000'))
        # Extourne de la CAP en N+1 : 482 repris par les à-nouveaux puis
        # soldé par l'extourne (net 0), la charge repart en 622200.
        self.reg.refresh_from_db()
        self.assertIsNotNone(self.reg.extourne_ecriture)
        self.assertEqual(_solde('482000', n1), Decimal('0'))
        self.assertEqual(_solde('622200', n1), Decimal('-50000'))

    def test_double_cloture_refusee(self):
        cloturer_exercice(self.exercice)
        with self.assertRaises(ValidationError):
            cloturer_exercice(self.exercice)

    def test_ecriture_interdite_apres_cloture(self):
        cloturer_exercice(self.exercice)
        self.exercice.refresh_from_db()  # select_for_update a chargé une autre instance
        with self.assertRaises(DjangoValidationError):
            self.od([('571100', 1000, 0), ('471000', 0, 1000)], 'V2')


class CreanceDouteuseTests(BaseCompta):
    def setUp(self):
        super().setUp()
        self.client = TestDataFactory.create_client()

    def test_cycle_complet_perte(self):
        creance = CreanceDouteuse.objects.create(
            client=self.client, montant=Decimal('120000'), commentaire='test')
        marquer_creance(creance)
        self.assertEqual(_solde('691000', self.exercice), Decimal('120000'))
        self.assertEqual(_solde('491000', self.exercice), Decimal('-120000'))
        solder_creance(creance, 'irrecouvrable')
        self.assertEqual(creance.statut, 'irrecouvrable')
        # Reprise + perte : 491 soldé, 651 débité, 411 crédité
        self.assertEqual(_solde('491000', self.exercice), Decimal('0'))
        self.assertEqual(_solde('651000', self.exercice), Decimal('120000'))
        self.assertEqual(_solde('411100', self.exercice), Decimal('-120000'))

    def test_recouvrement(self):
        creance = CreanceDouteuse.objects.create(
            client=self.client, montant=Decimal('80000'))
        marquer_creance(creance)
        solder_creance(creance, 'recouvree')
        self.assertEqual(creance.statut, 'recouvree')
        self.assertEqual(_solde('781000', self.exercice), Decimal('-80000'))
        with self.assertRaises(ValidationError):
            solder_creance(creance, 'recouvree')


class DepreciationStockTests(BaseCompta):
    def test_dotation_et_reprise(self):
        dep = DepreciationStock.objects.create(
            libelle='Périmés déc 2026', montant=Decimal('45000'))
        creer_depreciation_stock(dep)
        self.assertEqual(_solde('391000', self.exercice), Decimal('-45000'))
        reprendre_depreciation_stock(dep)
        self.assertEqual(dep.statut, 'reprise')
        self.assertEqual(_solde('391000', self.exercice), Decimal('0'))
        self.assertEqual(_solde('781000', self.exercice), Decimal('-45000'))


class PaieTests(BaseCompta):
    def setUp(self):
        super().setUp()
        self.employe = Employe.objects.create(nom='Caissière', salaire_brut=Decimal('150000'))
        self.paie = PaieMois.objects.create(
            employe=self.employe, mois=date(YEAR, 6, 1), brut=Decimal('150000'),
            cotisations_salariales=Decimal('6300'), irpp=Decimal('7500'),
            charges_patronales=Decimal('15000'))

    def test_od_equilibree(self):
        comptabiliser_paie(self.paie, user=self.admin)
        self.assertTrue(self.paie.ecriture.is_balanced())
        self.assertEqual(self.paie.statut, 'comptabilisee')
        # D 661 150000, D 664 15000 / C 422 136200, C 431 21300, C 447 7500
        self.assertEqual(_solde('661000', self.exercice), Decimal('150000'))
        self.assertEqual(_solde('664000', self.exercice), Decimal('15000'))
        self.assertEqual(_solde('422000', self.exercice), Decimal('-136200'))
        self.assertEqual(_solde('431000', self.exercice), Decimal('-21300'))
        self.assertEqual(_solde('447000', self.exercice), Decimal('-7500'))

    def test_net_negatif_refuse(self):
        self.paie.cotisations_salariales = Decimal('200000')
        with self.assertRaises(ValidationError):
            comptabiliser_paie(self.paie)

    def test_double_comptabilisation_refusee(self):
        comptabiliser_paie(self.paie)
        with self.assertRaises(ValidationError):
            comptabiliser_paie(self.paie)

    def test_paie_nulle_refusee(self):
        self.paie.brut = Decimal('0')
        self.paie.cotisations_salariales = Decimal('0')
        self.paie.irpp = Decimal('0')
        self.paie.charges_patronales = Decimal('0')
        with self.assertRaises(ValidationError):
            comptabiliser_paie(self.paie)
        self.paie.refresh_from_db()
        self.assertEqual(self.paie.statut, 'brouillon')
        self.assertIsNone(self.paie.ecriture_id)


class VirementTresorerieTests(BaseCompta):
    def test_virement_caisse_banque(self):
        ecriture = virement_tresorerie(
            sens='caisse_banque', montant='250000',
            date_=date(YEAR, 6, 15), libelle='', user=self.admin)
        self.assertTrue(ecriture.is_balanced())
        self.assertEqual(_solde('521100', self.exercice), Decimal('250000'))
        self.assertEqual(_solde('571100', self.exercice), Decimal('-250000'))

    def test_montant_invalide_renvoie_400(self):
        for montant in ('abc', None, '-100'):
            with self.assertRaises(ValidationError):
                virement_tresorerie(
                    sens='caisse_banque', montant=montant,
                    date_=date(YEAR, 6, 15))
