from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api.tests.factories import TestDataFactory


class FournisseurVisibilityTestCase(APITestCase):
    def setUp(self):
        self.factory = TestDataFactory()
        self.user = self.factory.create_superuser(username='admin_supplier', password='adminpass123')
        self.client.force_authenticate(self.user)
        self.active = self.factory.create_fournisseur(name='Actif')
        self.inactive = self.factory.create_fournisseur(name='Supprimé', is_active=False)

    def test_include_inactive_false_excludes_inactive_suppliers(self):
        response = self.client.get(reverse('fournisseur-list'), {'include_inactive': 'false', 'page_size': 50})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {item['id'] for item in response.data['results']}
        self.assertIn(self.active.id, ids)
        self.assertNotIn(self.inactive.id, ids)

    def test_include_inactive_true_includes_inactive_suppliers(self):
        response = self.client.get(reverse('fournisseur-list'), {'include_inactive': 'true', 'page_size': 50})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {item['id'] for item in response.data['results']}
        self.assertIn(self.active.id, ids)
        self.assertIn(self.inactive.id, ids)

    def test_delete_active_supplier_soft_deletes_it(self):
        response = self.client.delete(reverse('fournisseur-detail', kwargs={'pk': self.active.pk}), {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.active.refresh_from_db()
        self.assertFalse(self.active.is_active)
        self.assertIsNotNone(self.active.deleted_at)
        self.assertEqual(self.active.deleted_by, self.user)

    def test_delete_inactive_supplier_returns_404(self):
        response = self.client.delete(reverse('fournisseur-detail', kwargs={'pk': self.inactive.pk}), {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_bulk_delete_ignores_inactive_suppliers(self):
        response = self.client.post(
            reverse('fournisseur-bulk-delete'),
            {'ids': [self.active.id, self.inactive.id]},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('1 fournisseurs supprimés', response.data['message'])
        self.active.refresh_from_db()
        self.inactive.refresh_from_db()
        self.assertFalse(self.active.is_active)
        self.assertFalse(self.inactive.is_active)
