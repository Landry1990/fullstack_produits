"""
Tests pour les endpoints génériques / MQ de api/views/dci_admin.py.

Couvre la sécurité des données cliniques :
- link_generic : auto-lien, produit inactif, lien déjà déclaré ailleurs,
  circularité, référence sans substance, mismatch de substances (409 +
  force), union additive (jamais d'écrasement), provenance
  (produit_reference / is_generic / dci_reference), audit.
- unlink_generic : refuse tout lien non déclaré (ne touche jamais aux
  substances issues d'import/liaison manuelle), retire le lien déclaré.
- generiques : liste des liens déclarés + substances partagées.
- manual_link : union additive (ne vide plus les substances existantes),
  id invalide → 400, substance inexistante → 404.
- mq_run / mq_job : validation des actions.
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from ..models import AuditLog, Produit, Substance
from .factories import TestDataFactory as F


class GenericsBase(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = F.create_superuser()
        self.api.force_authenticate(user=self.admin)
        self.paracetamol = Substance.objects.create(nom='PARACETAMOL')
        self.ibuprofene = Substance.objects.create(nom='IBUPROFENE')

    def produit(self, name, **kw):
        return F.create_produit(name=name, **kw)


class LinkGenericValidationTest(GenericsBase):
    url = 'dci-admin-link-generic'

    def post(self, **data):
        return self.api.post(reverse(self.url), data, format='json')

    def test_self_link_rejected(self):
        p = self.produit('DOLIPRANE')
        resp = self.post(produit_id=p.id, generic_id=p.id)
        self.assertEqual(resp.status_code, 400)

    def test_invalid_id_returns_400_not_500(self):
        resp = self.post(produit_id='abc', generic_id=1)
        self.assertEqual(resp.status_code, 400)

    def test_missing_product_returns_404(self):
        p = self.produit('DOLIPRANE')
        resp = self.post(produit_id=p.id, generic_id=999999)
        self.assertEqual(resp.status_code, 404)

    def test_inactive_generic_rejected(self):
        ref = self.produit('DOLIPRANE')
        ref.substances.add(self.paracetamol)
        gen = self.produit('PARA GENERIC', is_active=False)
        resp = self.post(produit_id=ref.id, generic_id=gen.id)
        self.assertEqual(resp.status_code, 400)
        gen.refresh_from_db()
        self.assertIsNone(gen.produit_reference_id)
        self.assertFalse(gen.is_generic)

    def test_reference_without_substance_rejected(self):
        ref = self.produit('SANS DCI')
        gen = self.produit('CANDIDAT')
        resp = self.post(produit_id=ref.id, generic_id=gen.id)
        self.assertEqual(resp.status_code, 400)

    def test_circular_link_rejected(self):
        a = self.produit('A')
        b = self.produit('B')
        a.substances.add(self.paracetamol)
        b.substances.add(self.paracetamol)
        b.produit_reference = a
        b.is_generic = True
        b.save()
        resp = self.post(produit_id=b.id, generic_id=a.id)
        self.assertEqual(resp.status_code, 400)

    def test_already_declared_elsewhere_rejected(self):
        ref_a = self.produit('MARQUE A')
        ref_b = self.produit('MARQUE B')
        gen = self.produit('GENERIQUE')
        for p in (ref_a, ref_b):
            p.substances.add(self.paracetamol)
        gen.produit_reference = ref_a
        gen.is_generic = True
        gen.save()
        resp = self.post(produit_id=ref_b.id, generic_id=gen.id)
        self.assertEqual(resp.status_code, 409)
        gen.refresh_from_db()
        self.assertEqual(gen.produit_reference_id, ref_a.id)

    def test_substance_mismatch_requires_confirmation(self):
        ref = self.produit('EFFERALGAN')
        ref.substances.add(self.paracetamol)
        gen = self.produit('ADVIL')
        gen.substances.add(self.ibuprofene)
        resp = self.post(produit_id=ref.id, generic_id=gen.id)
        self.assertEqual(resp.status_code, 409)
        self.assertTrue(resp.data['requires_confirmation'])
        gen.refresh_from_db()
        self.assertIsNone(gen.produit_reference_id)
        self.assertEqual(set(gen.substances.values_list('id', flat=True)),
                         {self.ibuprofene.id})

    def test_substance_mismatch_force_succeeds(self):
        ref = self.produit('EFFERALGAN')
        ref.substances.add(self.paracetamol)
        gen = self.produit('ADVIL')
        gen.substances.add(self.ibuprofene)
        resp = self.post(produit_id=ref.id, generic_id=gen.id, force=True)
        self.assertEqual(resp.status_code, 200)
        gen.refresh_from_db()
        self.assertEqual(gen.produit_reference_id, ref.id)
        self.assertTrue(gen.is_generic)
        # Les deux substances coexistent (union, pas d'écrasement)
        self.assertEqual(
            set(gen.substances.values_list('id', flat=True)),
            {self.paracetamol.id, self.ibuprofene.id},
        )


class LinkGenericSuccessTest(GenericsBase):
    def setUp(self):
        super().setUp()
        self.ref = self.produit('DOLIPRANE 500')
        self.ref.substances.add(self.paracetamol)
        self.ref.dci_reference = self.paracetamol
        self.ref.save()
        self.gen = self.produit('PARACETAMOL GENERIQUE')
        self.resp = self.api.post(reverse('dci-admin-link-generic'), {
            'produit_id': self.ref.id, 'generic_id': self.gen.id,
        }, format='json')

    def test_link_succeeds(self):
        self.assertEqual(self.resp.status_code, 200)
        self.gen.refresh_from_db()
        self.assertEqual(self.gen.produit_reference_id, self.ref.id)
        self.assertTrue(self.gen.is_generic)
        self.assertIn(self.paracetamol, self.gen.substances.all())
        self.assertEqual(self.gen.dci_reference_id, self.paracetamol.id)

    def test_link_is_additive(self):
        """Les substances pré-existantes du générique sont conservées."""
        vit = Substance.objects.create(nom='VITAMINE C')
        gen2 = self.produit('GEN2')
        gen2.substances.add(vit)
        self.api.post(reverse('dci-admin-link-generic'), {
            'produit_id': self.ref.id, 'generic_id': gen2.id, 'force': True,
        }, format='json')
        self.assertEqual(
            set(gen2.substances.values_list('id', flat=True)),
            {vit.id, self.paracetamol.id},
        )

    def test_link_audited(self):
        log = AuditLog.objects.filter(
            model_name='Produit', object_id=str(self.gen.pk),
        ).order_by('-timestamp').first()
        self.assertIsNotNone(log)
        self.assertIn('Générique manuel', log.description)
        self.assertEqual(log.details['reference_id'], self.ref.pk)
        self.assertIn('PARACETAMOL', log.details['substances_added'])

    def test_idempotent_relink(self):
        resp = self.api.post(reverse('dci-admin-link-generic'), {
            'produit_id': self.ref.id, 'generic_id': self.gen.id,
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['substances_added'], [])


class UnlinkGenericTest(GenericsBase):
    def setUp(self):
        super().setUp()
        self.ref = self.produit('DOLIPRANE')
        self.ref.substances.add(self.paracetamol)
        self.ref.dci_reference = self.paracetamol
        self.ref.save()
        self.gen = self.produit('PARA GEN')
        self.api.post(reverse('dci-admin-link-generic'), {
            'produit_id': self.ref.id, 'generic_id': self.gen.id,
        }, format='json')

    def test_unlink_removes_declared_link(self):
        resp = self.api.post(reverse('dci-admin-unlink-generic'), {
            'produit_id': self.ref.id, 'generic_id': self.gen.id,
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.gen.refresh_from_db()
        self.assertIsNone(self.gen.produit_reference_id)
        self.assertFalse(self.gen.is_generic)
        self.assertIsNone(self.gen.dci_reference_id)
        self.assertEqual(self.gen.substances.count(), 0)

    def test_unlink_preserves_preexisting_substances(self):
        """Une substance commune déjà liée AVANT link_generic ne doit pas
        être retirée par unlink_generic (régression : le unlink retirait
        toutes les substances partagées, y compris les pré-existantes)."""
        gen2 = self.produit('GEN PREEXIST')
        gen2.substances.add(self.paracetamol, self.ibuprofene)
        self.api.post(reverse('dci-admin-link-generic'), {
            'produit_id': self.ref.id, 'generic_id': gen2.id,
        }, format='json')
        resp = self.api.post(reverse('dci-admin-unlink-generic'), {
            'produit_id': self.ref.id, 'generic_id': gen2.id,
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['removed'], [])
        gen2.refresh_from_db()
        self.assertIsNone(gen2.produit_reference_id)
        self.assertEqual(
            set(gen2.substances.values_list('id', flat=True)),
            {self.paracetamol.id, self.ibuprofene.id},
        )

    def test_unlink_removes_only_link_added_substances(self):
        """Seules les substances réellement ajoutées par le lien sont
        retirées ; les autres (lien manuel/import) sont conservées."""
        gen3 = self.produit('GEN MIXTE')
        gen3.substances.add(self.ibuprofene)
        self.api.post(reverse('dci-admin-link-generic'), {
            'produit_id': self.ref.id, 'generic_id': gen3.id, 'force': True,
        }, format='json')
        resp = self.api.post(reverse('dci-admin-unlink-generic'), {
            'produit_id': self.ref.id, 'generic_id': gen3.id,
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['removed'], ['PARACETAMOL'])
        gen3.refresh_from_db()
        self.assertEqual(
            set(gen3.substances.values_list('id', flat=True)),
            {self.ibuprofene.id},
        )

    def test_unlink_refuses_undeclared_link(self):
        """Un produit qui partage juste une substance n'est PAS délié —
        on ne supprime jamais des données liées par import."""
        other = self.produit('AUTRE PARA')
        other.substances.add(self.paracetamol)
        resp = self.api.post(reverse('dci-admin-unlink-generic'), {
            'produit_id': self.ref.id, 'generic_id': other.id,
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn(self.paracetamol, other.substances.all())

    def test_unlink_audited(self):
        self.api.post(reverse('dci-admin-unlink-generic'), {
            'produit_id': self.ref.id, 'generic_id': self.gen.id,
        }, format='json')
        log = AuditLog.objects.filter(
            model_name='Produit', object_id=str(self.gen.pk),
            description__icontains='retiré',
        ).first()
        self.assertIsNotNone(log)
        self.assertIn('PARACETAMOL', log.details['substances_removed'])


class GeneriquesListTest(GenericsBase):
    def test_lists_declared_and_shared(self):
        ref = self.produit('DOLIPRANE')
        ref.substances.add(self.paracetamol)
        declared = self.produit('GEN DECLARE')
        declared.produit_reference = ref
        declared.is_generic = True
        declared.save()
        shared = self.produit('AUTRE PARA')
        shared.substances.add(self.paracetamol)
        unrelated = self.produit('ADVIL')
        unrelated.substances.add(self.ibuprofene)

        resp = self.api.get(reverse('dci-admin-generiques'),
                            {'produit_id': ref.id})
        self.assertEqual(resp.status_code, 200)
        results = {r['id']: r for r in resp.data['results']}
        self.assertIn(declared.id, results)
        self.assertTrue(results[declared.id]['declared'])
        self.assertIn(shared.id, results)
        self.assertFalse(results[shared.id]['declared'])
        self.assertIn('PARACETAMOL', results[shared.id]['shared'])
        self.assertNotIn(unrelated.id, results)


class ManualLinkSafetyTest(GenericsBase):
    def test_manual_link_is_additive(self):
        """manual_link ne doit PLUS écraser les substances existantes
        (régression : .set() vidait les liens importés MQ)."""
        p = self.produit('DOLIPRANE')
        p.substances.add(self.ibuprofene)
        resp = self.api.post(reverse('dci-admin-manual-link'), {
            'produit_id': p.id, 'substance_ids': [self.paracetamol.id],
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(
            set(p.substances.values_list('id', flat=True)),
            {self.paracetamol.id, self.ibuprofene.id},
        )

    def test_manual_link_unknown_substance_404(self):
        p = self.produit('DOLIPRANE')
        resp = self.api.post(reverse('dci-admin-manual-link'), {
            'produit_id': p.id, 'substance_ids': [999999],
        }, format='json')
        self.assertEqual(resp.status_code, 404)

    def test_manual_link_invalid_id_400(self):
        p = self.produit('DOLIPRANE')
        resp = self.api.post(reverse('dci-admin-manual-link'), {
            'produit_id': p.id, 'substance_ids': ['abc'],
        }, format='json')
        self.assertEqual(resp.status_code, 400)


class SubstanceRenameTest(GenericsBase):
    def test_admin_can_rename(self):
        stub = Substance.objects.create(nom='MQ-12345')
        resp = self.api.patch(
            reverse('substance-detail', args=[stub.id]),
            {'nom': 'VERAPAMIL'}, format='json',
        )
        self.assertEqual(resp.status_code, 200)
        stub.refresh_from_db()
        self.assertEqual(stub.nom, 'VERAPAMIL')

    def test_rename_audited(self):
        stub = Substance.objects.create(nom='MQ-99999')
        self.api.patch(
            reverse('substance-detail', args=[stub.id]),
            {'nom': 'NICARDIPINE'}, format='json',
        )
        self.assertTrue(
            AuditLog.objects.filter(
                model_name='Substance', object_id=str(stub.pk),
            ).exists()
        )

    def test_non_staff_cannot_rename(self):
        api = APIClient()
        api.force_authenticate(user=F.create_user())
        stub = Substance.objects.create(nom='MQ-77777')
        resp = api.patch(
            reverse('substance-detail', args=[stub.id]),
            {'nom': 'HACK'}, format='json',
        )
        self.assertIn(resp.status_code, (401, 403))
        stub.refresh_from_db()
        self.assertEqual(stub.nom, 'MQ-77777')

    def test_non_staff_can_read(self):
        api = APIClient()
        api.force_authenticate(user=F.create_user())
        Substance.objects.create(nom='PARA-TEST')
        resp = api.get(reverse('substance-list'), {'search': 'PARA-TEST'})
        self.assertEqual(resp.status_code, 200)

    def test_unresolved_filter(self):
        Substance.objects.create(nom='MQ-11111')
        Substance.objects.create(nom='VERAPAMIL')
        resp = self.api.get(reverse('substance-list'), {'unresolved': '1'})
        noms = [r['nom'] for r in resp.data['results']]
        self.assertIn('MQ-11111', noms)
        self.assertNotIn('VERAPAMIL', noms)

    def test_duplicate_rename_rejected(self):
        Substance.objects.create(nom='EXISTANT')
        stub = Substance.objects.create(nom='MQ-22222')
        resp = self.api.patch(
            reverse('substance-detail', args=[stub.id]),
            {'nom': 'EXISTANT'}, format='json',
        )
        self.assertEqual(resp.status_code, 400)
        stub.refresh_from_db()
        self.assertEqual(stub.nom, 'MQ-22222')


class MqJobTest(GenericsBase):
    def test_mq_run_unknown_action_400(self):
        resp = self.api.post(reverse('dci-admin-mq-run'),
                             {'action': 'nope'}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_mq_run_returns_job_id(self):
        from unittest.mock import patch
        with patch('api.views.dci_admin.threading.Thread') as t:
            resp = self.api.post(reverse('dci-admin-mq-run'),
                                 {'action': 'resolve'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('job_id', resp.data)
        t.assert_called_once()

    def test_mq_job_unknown_404(self):
        resp = self.api.get(reverse('dci-admin-mq-job'),
                            {'job_id': 'doesnotexist'})
        self.assertEqual(resp.status_code, 404)

    def test_staff_required(self):
        api = APIClient()
        api.force_authenticate(user=F.create_user())
        resp = api.post(reverse('dci-admin-mq-run'),
                        {'action': 'resolve'}, format='json')
        self.assertIn(resp.status_code, (401, 403))
