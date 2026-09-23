from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import PharmacySettings, PosteCaisse, PosteVente

from .factories import TestDataFactory


class SettingsPermissionTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = TestDataFactory.create_user(username='settings-user')
        self.admin = TestDataFactory.create_superuser(username='settings-admin')

    def tearDown(self):
        cache.clear()

    def test_invoice_settings_read_requires_authentication_even_after_cache_prime(self):
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.get(reverse('invoice-settings')).status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(reverse('invoice-settings')).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_regular_user_can_read_but_cannot_update_invoice_settings(self):
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.get(reverse('invoice-settings')).status_code, status.HTTP_200_OK)

        response = self.client.put(
            reverse('invoice-settings'),
            {'centralized_cash_register': False},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_update_invoice_settings(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.put(
            reverse('invoice-settings'),
            {'centralized_cash_register': False},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['centralized_cash_register'])

    def test_pharmacy_settings_read_requires_authentication_even_after_cache_prime(self):
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.get(reverse('pharmacy-settings')).status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(reverse('pharmacy-settings')).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_regular_user_can_read_but_cannot_update_pharmacy_settings(self):
        PharmacySettings.objects.get_or_create(pk=1)
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.get(reverse('pharmacy-settings')).status_code, status.HTTP_200_OK)

        response = self.client.put(
            reverse('pharmacy-settings'),
            {'pharmacy_name': 'Modification interdite'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_update_pharmacy_settings(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.put(
            reverse('pharmacy-settings'),
            {'city': 'Yaoundé'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['city'], 'Yaoundé')


class CashRegisterAdministrationPermissionTests(APITestCase):
    def setUp(self):
        self.owner = TestDataFactory.create_user(username='register-owner')
        self.other = TestDataFactory.create_user(username='register-other')
        self.admin = TestDataFactory.create_superuser(username='register-admin')

    def test_regular_user_can_list_but_cannot_create_physical_register(self):
        PosteCaisse.objects.create(nom='Caisse existante', code='EXISTANTE')
        self.client.force_authenticate(user=self.owner)
        self.assertEqual(self.client.get(reverse('postecaisse-list')).status_code, status.HTTP_200_OK)

        response = self.client.post(
            reverse('postecaisse-list'),
            {'nom': 'Caisse interdite', 'code': 'INTERDITE'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_physical_register(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            reverse('postecaisse-list'),
            {'nom': 'Caisse autorisée', 'code': 'AUTORISEE'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_regular_user_cannot_create_or_delete_register_definition(self):
        poste = PosteVente.objects.create(nom='Définition POS', est_actif=False)
        self.client.force_authenticate(user=self.owner)

        create_response = self.client.post(
            reverse('postevente-list'),
            {'nom': 'POS interdit'},
            format='json',
        )
        delete_response = self.client.delete(reverse('postevente-detail', kwargs={'pk': poste.pk}))

        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(delete_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(PosteVente.objects.filter(pk=poste.pk).exists())

    def test_user_can_activate_available_register_for_self(self):
        poste = PosteVente.objects.create(nom='POS disponible', est_actif=False)
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(reverse('postevente-activer', kwargs={'pk': poste.pk}), {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        poste.refresh_from_db()
        self.assertEqual(poste.vendeur, self.owner)
        self.assertTrue(poste.est_actif)

    def test_user_cannot_close_another_users_register(self):
        poste = PosteVente.objects.create(
            nom='POS propriétaire',
            vendeur=self.owner,
            est_actif=True,
            mode_pos=True,
        )
        self.client.force_authenticate(user=self.other)

        response = self.client.post(reverse('postevente-fermer', kwargs={'pk': poste.pk}), {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        poste.refresh_from_db()
        self.assertTrue(poste.est_actif)

    def test_owner_can_close_own_empty_register(self):
        poste = PosteVente.objects.create(
            nom='POS du propriétaire',
            vendeur=self.owner,
            est_actif=True,
            mode_pos=True,
        )
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(reverse('postevente-fermer', kwargs={'pk': poste.pk}), {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        poste.refresh_from_db()
        self.assertFalse(poste.est_actif)


class AdministrativeEndpointPermissionTests(APITestCase):
    def setUp(self):
        self.user = TestDataFactory.create_user(username='ordinary-user')
        self.admin = TestDataFactory.create_superuser(username='ordinary-admin')

    def test_regular_user_cannot_access_recycle_bin(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(reverse('corbeille-list'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_restore_soft_deleted_product(self):
        product = TestDataFactory.create_produit(name='Produit à restaurer')
        product.is_active = False
        product.save(update_fields=['is_active'])
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            reverse('corbeille-restore'),
            {'model': 'produit', 'ids': [product.id]},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        product.refresh_from_db()
        self.assertTrue(product.is_active)

    def test_admin_can_permanently_delete_soft_deleted_product(self):
        product = TestDataFactory.create_produit(name='Produit à supprimer définitivement')
        product.is_active = False
        product.save(update_fields=['is_active'])
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            reverse('corbeille-purge'),
            {'model': 'produit', 'ids': [product.id]},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(type(product).objects.filter(pk=product.pk).exists())

    def test_recycle_bin_never_permanently_deletes_superuser(self):
        protected_admin = TestDataFactory.create_superuser(username='protected-superuser')
        protected_admin.is_active = False
        protected_admin.save(update_fields=['is_active'])
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            reverse('corbeille-purge'),
            {'model': 'user', 'ids': [protected_admin.id]},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(type(protected_admin).objects.filter(pk=protected_admin.pk).exists())

    def test_regular_user_cannot_access_system_admin(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(reverse('system-admin-status'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_regular_user_cannot_list_or_create_backups(self):
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.get(reverse('backup-list')).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.post(reverse('backup-create'), {}, format='json').status_code, status.HTTP_403_FORBIDDEN)
