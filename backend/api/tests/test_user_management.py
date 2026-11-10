"""
Tests d'intégration pour la gestion des utilisateurs.
Couvre : création, mise à jour, mot de passe, validation, permissions, login_options.
"""
from django.contrib.auth.models import User
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.authtoken.models import Token
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from api.models import Profile
from api.tests.factories import TestDataFactory


@override_settings(CACHES={'default': {
    'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    'LOCATION': 'user-management-tests',
}})
class UserManagementTest(TestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.client = APIClient()
        self.factory = TestDataFactory()
        self.admin = self.factory.create_superuser(
            username='admin_users', email='admin_users@test.com', password='AdminPass99!'
        )
        self.client.force_authenticate(user=self.admin)

    # --- Création ---

    def test_create_user_with_4_digit_password(self):
        """Création d'un utilisateur avec un mot de passe de 4 chiffres (minimum légal)."""
        url = reverse('user-list')
        data = {
            'username': 'vendeur1',
            'password': '4729',
            'first_name': 'Jean',
            'last_name': 'Dupont',
            'email': 'jean@test.com',
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='vendeur1').exists())
        user = User.objects.get(username='vendeur1')
        self.assertTrue(user.check_password('4729'))
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.is_active)

    def test_create_user_password_too_short(self):
        """Un mot de passe de 3 caractères doit être rejeté (min_length=4)."""
        url = reverse('user-list')
        data = {
            'username': 'shortpw',
            'password': '123',
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)
        self.assertFalse(User.objects.filter(username='shortpw').exists())

    def test_create_user_without_password_rejected(self):
        """La création sans mot de passe doit échouer."""
        url = reverse('user-list')
        data = {
            'username': 'nopw',
            'email': 'nopw@test.com',
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_user_with_profile(self):
        """Création avec un profil personnalisé (role, permissions)."""
        url = reverse('user-list')
        data = {
            'username': 'caissiere1',
            'password': 'MyPass77',
            'first_name': 'Marie',
            'last_name': 'Curie',
            'profile': {
                'role': 'CAISSIER',
                'can_do_returns': True,
                'can_cash_out': True,
                'can_cancel_invoice': False,
                'can_create_client_credit': True,
            }
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username='caissiere1')
        self.assertTrue(hasattr(user, 'profile'))
        self.assertEqual(user.profile.role, 'CAISSIER')
        self.assertTrue(user.profile.can_do_returns)
        self.assertTrue(user.profile.can_cash_out)
        self.assertFalse(user.profile.can_cancel_invoice)
        self.assertTrue(user.profile.can_create_client_credit)

    def test_create_user_duplicate_password_rejected(self):
        """Deux utilisateurs ne peuvent pas avoir le même mot de passe."""
        # Créer un premier utilisateur
        url = reverse('user-list')
        self.client.post(url, {'username': 'user_a', 'password': 'UniquePass55'}, format='json')

        # Tenter de créer un deuxième avec le même mot de passe
        data = {
            'username': 'user_b',
            'password': 'UniquePass55',
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('déjà utilisé', str(response.data.get('password', '')))

    # --- Mise à jour ---

    def test_update_user_password(self):
        """Mise à jour du mot de passe d'un utilisateur existant."""
        user = User.objects.create_user(username='toupdate', password='OldPass44')
        url = reverse('user-detail', args=[user.id])
        response = self.client.patch(url, {'password': 'NewPass88'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.check_password('NewPass88'))
        self.assertFalse(user.check_password('OldPass44'))

    def test_update_user_profile_role(self):
        """Mise à jour du rôle via le profil."""
        user = User.objects.create_user(username='promote', password='PromotePass99')
        self.assertEqual(user.profile.role, 'VENDEUR')

        url = reverse('user-detail', args=[user.id])
        response = self.client.patch(url, {
            'profile': {'role': 'PHARMACIEN'}
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.profile.role, 'PHARMACIEN')

    def test_update_user_can_create_client_credit(self):
        """Mise à jour de la permission can_create_client_credit via le profil."""
        user = User.objects.create_user(username='credit_user', password='CreditPass99')
        self.assertFalse(user.profile.can_create_client_credit)

        url = reverse('user-detail', args=[user.id])
        response = self.client.patch(url, {
            'profile': {'can_create_client_credit': True}
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.profile.can_create_client_credit)
        self.assertIn('can_create_client_credit', response.data.get('profile', {}))

    def test_update_user_without_changing_password(self):
        """PATCH sans mot de passe ne doit pas changer le mot de passe."""
        user = User.objects.create_user(username='keep_pw', password='KeepPass33')
        url = reverse('user-detail', args=[user.id])
        response = self.client.patch(url, {'first_name': 'Updated'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.first_name, 'Updated')
        self.assertTrue(user.check_password('KeepPass33'))

    # --- Permissions ---

    def test_non_admin_cannot_list_users(self):
        """Un utilisateur non-admin ne peut pas lister tous les utilisateurs."""
        regular = User.objects.create_user(username='regular', password='RegularPass11')
        client = APIClient()
        client.force_authenticate(user=regular)
        url = reverse('user-list')
        response = client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_admin_can_only_see_self(self):
        """Un utilisateur non-admin ne voit que lui-même dans la liste."""
        regular = User.objects.create_user(username='solo', password='SoloPass22')
        client = APIClient()
        client.force_authenticate(user=regular)
        url = reverse('user-list')
        # Les non-admins n'ont pas accès du tout (IsAdminUser sur list)
        response = client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_delete_user(self):
        """Un admin peut supprimer un utilisateur."""
        user = User.objects.create_user(username='todelete', password='DeletePass44')
        url = reverse('user-detail', args=[user.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(id=user.id).exists())

    def test_superuser_cannot_be_deleted(self):
        """Un superuser ne peut pas être supprimé via l'API."""
        other_admin = self.factory.create_superuser(
            username='other_admin', email='other@test.com', password='OtherPass55!'
        )
        url = reverse('user-detail', args=[other_admin.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(User.objects.filter(id=other_admin.id).exists())

    def test_superuser_cannot_be_deactivated(self):
        """Un superuser ne peut pas être désactivé via PATCH is_active=False."""
        other_admin = self.factory.create_superuser(
            username='other_admin2', email='other2@test.com', password='OtherPass66!'
        )
        url = reverse('user-detail', args=[other_admin.id])
        response = self.client.patch(url, {'is_active': False}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        other_admin.refresh_from_db()
        self.assertTrue(other_admin.is_active)

    # --- Endpoints utilitaires ---

    def test_login_options_public(self):
        """L'endpoint login_options est accessible sans authentification."""
        client = APIClient()
        url = reverse('user-login-options')
        response = client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        # L'admin doit apparaître dans la liste
        usernames = [u['username'] for u in response.data]
        self.assertIn('admin_users', usernames)

    def test_login_options_only_active_users(self):
        """login_options ne retourne que les utilisateurs actifs."""
        User.objects.create_user(username='inactive', password='InactivePass55', is_active=False)
        client = APIClient()
        url = reverse('user-login-options')
        response = client.get(url)
        usernames = [u['username'] for u in response.data]
        self.assertIn('admin_users', usernames)
        self.assertNotIn('inactive', usernames)

    def test_me_endpoint(self):
        """L'endpoint /me retourne les infos de l'utilisateur connecté."""
        url = reverse('user-me')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'admin_users')
        self.assertIn('profile', response.data)

    def test_operators_endpoint(self):
        """L'endpoint /operators retourne les utilisateurs actifs."""
        User.objects.create_user(username='op1', password='Op1Pass55', first_name='Op', last_name='One')
        url = reverse('user-operators')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        ids = [u['id'] for u in response.data]
        self.assertIn(self.admin.id, ids)

    # --- Authentification ---

    def test_user_can_authenticate_with_4_digit_password(self):
        """Un utilisateur créé avec un mot de passe de 4 chiffres peut s'authentifier."""
        url = reverse('user-list')
        self.client.post(url, {'username': 'auth_test', 'password': '4729'}, format='json')

        user = User.objects.get(username='auth_test')
        self.assertTrue(user.check_password('4729'))

        # Tester l'authentification via token
        client = APIClient()
        url_token = reverse('token-auth')
        response = client.post(url_token, {'username': 'auth_test', 'password': '4729'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('token', response.data)

    def test_user_cannot_authenticate_with_wrong_password(self):
        """Échec d'authentification avec un mauvais mot de passe."""
        User.objects.create_user(username='auth_fail', password='CorrectPass55')
        client = APIClient()
        url = reverse('token-auth')
        response = client.post(url, {'username': 'auth_fail', 'password': 'WrongPass99'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_by_password_only_identifies_user(self):
        """Login par mot de passe seul : le système identifie automatiquement l'utilisateur."""
        User.objects.create_user(username='solo_user', password='SoloPass55')
        client = APIClient()
        url = reverse('token-auth')
        response = client.post(url, {'password': 'SoloPass55'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('token', response.data)
        self.assertEqual(response.data['username'], 'solo_user')

    def test_login_by_password_only_fails_for_inactive_user(self):
        """Un compte désactivé ne peut pas se connecter par mot de passe seul."""
        User.objects.create_user(username='inactive_solo', password='InactivePass55', is_active=False)
        client = APIClient()
        url = reverse('token-auth')
        response = client.post(url, {'password': 'InactivePass55'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_by_password_only_fails_with_wrong_password(self):
        """Login par mot de passe seul avec un mauvais mot de passe échoue."""
        User.objects.create_user(username='solo_fail', password='CorrectSolo55')
        client = APIClient()
        url = reverse('token-auth')
        response = client.post(url, {'password': 'WrongSolo99'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # --- Désactivation ---

    def test_deactivate_user(self):
        """Désactiver un utilisateur via PATCH is_active=False."""
        user = User.objects.create_user(username='deactivate', password='DeactivatePass55')
        url = reverse('user-detail', args=[user.id])
        response = self.client.patch(url, {'is_active': False}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertFalse(user.is_active)

    def test_deactivated_user_not_in_login_options(self):
        """Un utilisateur désactivé n'apparaît plus dans login_options."""
        user = User.objects.create_user(username='willdeactivate', password='DeactPass55')
        client = APIClient()

        # Vérifier qu'il apparaît avant désactivation
        url = reverse('user-login-options')
        response = client.get(url)
        usernames = [u['username'] for u in response.data]
        self.assertIn('willdeactivate', usernames)

        # Désactiver
        url_detail = reverse('user-detail', args=[user.id])
        self.client.patch(url_detail, {'is_active': False}, format='json')

        # Vérifier qu'il n'apparaît plus
        response = client.get(url)
        usernames = [u['username'] for u in response.data]
        self.assertNotIn('willdeactivate', usernames)

    def test_admin_password_reset_revokes_existing_token(self):
        user = User.objects.create_user(username='reset_target', password='OldPass99')
        token = Token.objects.create(user=user)
        response = self.client.patch(reverse('user-detail', args=[user.pk]),
                                     {'password': 'NewPass99'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Token.objects.filter(key=token.key).exists())
        previous_session = APIClient()
        previous_session.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        self.assertEqual(previous_session.get(reverse('user-me')).status_code, 401)
        user.refresh_from_db()
        self.assertTrue(user.profile.must_change_password)

    def test_profile_update_preserves_existing_token(self):
        user = User.objects.create_user(username='profile_target', password='OldPass99')
        token = Token.objects.create(user=user)
        response = self.client.patch(reverse('user-detail', args=[user.pk]),
                                     {'first_name': 'Marie'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(Token.objects.filter(key=token.key).exists())


@override_settings(CACHES={'default': {
    'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    'LOCATION': 'login-security-tests',
}})
class LoginSecurityTest(TestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.client = APIClient()
        self.url = reverse('token-auth')
        self.user = User.objects.create_user(username='operator', password='4729')
        self.throttle = patch('api.views.users.CustomAuthToken.get_throttles', return_value=[])
        self.throttle.start()
        self.addCleanup(self.throttle.stop)

    def login(self, password='wrong', ip='192.0.2.10', **data):
        return self.client.post(self.url, {'password': password, **data}, format='json',
                                REMOTE_ADDR=ip, HTTP_X_FORWARDED_FOR=ip)

    def test_progressive_lockout_and_expiry(self):
        with patch('api.views.users.time.time', return_value=1000):
            for _ in range(9):
                self.assertEqual(self.login().status_code, 400)
            response = self.login()
            self.assertEqual(response.status_code, 429)
            self.assertEqual(int(response['Retry-After']), 30)
            with patch.object(User, 'check_password') as check:
                self.assertEqual(self.login('4729').status_code, 429)
                check.assert_not_called()
        with patch('api.views.users.time.time', return_value=1031):
            response = self.login()
            self.assertEqual(response.status_code, 429)
            self.assertEqual(int(response['Retry-After']), 60)
        with patch('api.views.users.time.time', return_value=1092):
            self.assertEqual(self.login('4729').status_code, 200)
            self.assertEqual(self.login().status_code, 400)

    def test_lockout_is_capped_at_fifteen_minutes(self):
        now = 1000
        with patch('api.views.users.time.time', side_effect=lambda: now):
            for _ in range(9):
                self.login()
            for delay in (30, 60, 120, 240, 480, 900, 900):
                response = self.login()
                self.assertEqual(response.status_code, 429)
                self.assertEqual(int(response['Retry-After']), delay)
                now += delay + 1

    def test_cache_outage_does_not_check_password(self):
        with patch('api.views.users.caches') as backends:
            backends.__getitem__.return_value.get.side_effect = ConnectionError()
            with patch.object(User, 'check_password') as check:
                self.assertEqual(self.login('4729').status_code, 503)
                check.assert_not_called()

    def test_existing_rate_limit_still_applies(self):
        self.throttle.stop()
        for _ in range(5):
            self.assertEqual(self.login().status_code, 400)
        self.assertEqual(self.login().status_code, 429)

    def test_other_ip_is_not_locked(self):
        for _ in range(10):
            self.login()
        self.assertEqual(self.login('4729', ip='192.0.2.11').status_code, 200)

    def test_workstation_and_username_changes_do_not_bypass_lockout(self):
        for _ in range(10):
            self.login()
        response = self.login('4729', username='operator', workstation='new-device')
        self.assertEqual(response.status_code, 429)

    def test_non_string_credentials_are_rejected(self):
        self.assertEqual(self.login(password=['4729']).status_code, 400)
        self.assertEqual(self.login(password='4729', username=['operator']).status_code, 400)

    @override_settings(CACHES={'default': {
        'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
    }})
    def test_missing_security_cache_fails_closed(self):
        self.assertEqual(self.login('4729').status_code, 503)
