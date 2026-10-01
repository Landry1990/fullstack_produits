"""
Tests pour api/views/settings.py.

Couvre :
- PharmacySettingsView (GET/PUT singleton, permissions admin, validations, audit)
- InvoiceConfigurationView (GET/PUT singleton, permissions admin, validations)
- LoyaltySettingViewSet (singleton : list/create/get_object forcé pk=1, patch, delete)
- ConfigurationOptionViewSet (CRUD, filtres, unicité type+code, audit)
- TVAViewSet (CRUD, unicité taux, audit)
- WhatsAppTestView (validations, mock Meta API, erreurs/timeout)
- TelegramTestView / TelegramGetChatIdView (mock requests/TelegramService)
- TelegramRapportFlashView / FlashDate / Inventaire / Mensuel (mock send_message)

NOTE BUGS CORRIGÉS dans views/settings.py (chemin fallback "stats calculées côté
backend" de TelegramRapportFlashView) :
- `status='VALIDEE'` ne matchait aucune facture (valeur stockée : 'VAL')
  → remplacé par `Facture.Status.VALIDEE`.
- `Produit.objects.filter(stock_quantity__lte=0, est_actif=True)` levait un
  FieldError (champs inexistants) → `stock__lte=0, is_active=True`.
"""
from decimal import Decimal
from unittest.mock import MagicMock, patch

import requests
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    AuditLog,
    ConfigurationOption,
    Facture,
    Inventaire,
    InvoiceSettings,
    LigneInventaire,
    LoyaltySetting,
    PharmacySettings,
    TVA,
)
from .factories import TestDataFactory as F

ADMIN_PWD = 'adminpass123'

# Les serializers Pharmacy/Invoice appellent valider_licence_systeme() pour
# surcharger pharmacy_name / company_name — on le neutralise pour des
# assertions déterministes sur les valeurs en base.
LICENCE = 'api.utils_licence.valider_licence_systeme'
NO_LICENCE = (False, 'pas de licence', None)

TELEGRAM_SEND = 'api.telegram_service.TelegramService.send_message'


def _requests_mock(status_code=200, json_data=None, text=''):
    """Fabrique un mock de réponse `requests`."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.text = text
    if json_data is None:
        resp.json.side_effect = ValueError('no json')
    else:
        resp.json.return_value = json_data
    return resp


class SettingsBase(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = F.create_superuser(password=ADMIN_PWD)
        self.api.force_authenticate(user=self.admin)
        self.user = F.create_user()
        self.user_api = APIClient()
        self.user_api.force_authenticate(user=self.user)
        self.anon = APIClient()


# ── PharmacySettingsView ──────────────────────────────────────────────────────

class PharmacySettingsViewTest(SettingsBase):
    URL = 'pharmacy-settings'

    def test_get_anonyme_refuse(self):
        resp = self.anon.get(reverse(self.URL))
        self.assertIn(resp.status_code, (401, 403))

    def test_get_cree_singleton_et_server_time(self):
        self.assertFalse(PharmacySettings.objects.exists())
        resp = self.api.get(reverse(self.URL))
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(PharmacySettings.objects.filter(pk=1).exists())
        self.assertIn('server_time', resp.data)
        self.assertIn('custom_payment_modes', resp.data)

    @patch(LICENCE, return_value=NO_LICENCE)
    def test_get_retourne_valeurs_db(self, _m):
        PharmacySettings.objects.create(
            pharmacy_name='Pharma Test', city='Yaoundé', phone='699000000',
        )
        resp = self.api.get(reverse(self.URL))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['pharmacy_name'], 'Pharma Test')
        self.assertEqual(resp.data['city'], 'Yaoundé')

    def test_put_anonyme_refuse(self):
        resp = self.anon.put(reverse(self.URL), {'city': 'X'}, format='json')
        self.assertIn(resp.status_code, (401, 403))

    def test_put_non_admin_403(self):
        resp = self.user_api.put(
            reverse(self.URL), {'city': 'Bafoussam'}, format='json')
        self.assertEqual(resp.status_code, 403)

    @patch(LICENCE, return_value=NO_LICENCE)
    def test_put_admin_partiel_ok(self, _m):
        resp = self.api.put(reverse(self.URL), {
            'city': 'Bafoussam',
            'phone': '699111111',
            'taux_change_actif': '600.000',
            'auto_logout_timeout': 30,
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        ps = PharmacySettings.objects.get(pk=1)
        self.assertEqual(ps.city, 'Bafoussam')
        self.assertEqual(ps.phone, '699111111')
        self.assertEqual(ps.taux_change_actif, Decimal('600.000'))
        self.assertEqual(ps.auto_logout_timeout, 30)
        self.assertIn('server_time', resp.data)

    @patch(LICENCE, return_value=NO_LICENCE)
    def test_put_cree_audit_log(self, _m):
        resp = self.api.put(reverse(self.URL), {'city': 'Ebolowa'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(AuditLog.objects.filter(
            model_name='PharmacySettings', action='UPDATE',
            user=self.admin).exists())

    def test_put_email_invalide_400(self):
        resp = self.api.put(
            reverse(self.URL), {'email': 'pas-un-email'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('email', resp.data)

    def test_put_choix_invalide_400(self):
        resp = self.api.put(
            reverse(self.URL), {'regime_fiscal': 'INEXISTANT'}, format='json')
        self.assertEqual(resp.status_code, 400)
        resp = self.api.put(
            reverse(self.URL), {'mode_imposition': 'BAD'}, format='json')
        self.assertEqual(resp.status_code, 400)
        resp = self.api.put(
            reverse(self.URL), {'ticket_paper_width': 57}, format='json')
        self.assertEqual(resp.status_code, 400)

    @patch(LICENCE, return_value=NO_LICENCE)
    def test_put_modes_paiement_custom(self, _m):
        modes = [
            {'value': 'paypal', 'label': 'PayPal'},
            {'value': 'mtn_momo', 'label': 'MTN MoMo'},
        ]
        resp = self.api.put(reverse(self.URL), {
            'custom_payment_modes': modes,
            'disabled_payment_modes': ['cheque'],
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        ps = PharmacySettings.objects.get(pk=1)
        self.assertEqual(ps.custom_payment_modes, modes)
        self.assertEqual(ps.disabled_payment_modes, ['cheque'])
        self.assertEqual(resp.data['custom_payment_modes'], modes)

    @patch(LICENCE, return_value=NO_LICENCE)
    def test_put_pharmacy_name_readonly(self, _m):
        """pharmacy_name est un SerializerMethodField (sourced licence) :
        le champ est ignoré en écriture, la valeur DB ne change pas."""
        PharmacySettings.objects.create(pharmacy_name='Ancien Nom')
        resp = self.api.put(
            reverse(self.URL), {'pharmacy_name': 'Nouveau Nom'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(
            PharmacySettings.objects.get(pk=1).pharmacy_name, 'Ancien Nom')


# ── InvoiceConfigurationView ──────────────────────────────────────────────────

class InvoiceConfigurationViewTest(SettingsBase):
    URL = 'invoice-settings'

    def test_get_anonyme_refuse(self):
        resp = self.anon.get(reverse(self.URL))
        self.assertIn(resp.status_code, (401, 403))

    def test_get_cree_singleton(self):
        resp = self.api.get(reverse(self.URL))
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(InvoiceSettings.objects.filter(pk=1).exists())
        self.assertIn('header_layout', resp.data)
        self.assertIn('primary_color', resp.data)

    def test_put_non_admin_403(self):
        resp = self.user_api.put(
            reverse(self.URL), {'footer_text': 'X'}, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_put_admin_ok_et_audit(self):
        resp = self.api.put(reverse(self.URL), {
            'footer_text': 'Merci !',
            'header_layout': 'center',
            'primary_color': '#123456',
            'centralized_cash_register': True,
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        cfg = InvoiceSettings.objects.get(pk=1)
        self.assertEqual(cfg.footer_text, 'Merci !')
        self.assertEqual(cfg.header_layout, 'center')
        self.assertTrue(cfg.centralized_cash_register)
        self.assertTrue(AuditLog.objects.filter(
            model_name='InvoiceSettings', action='UPDATE').exists())

    def test_put_layout_invalide_400(self):
        resp = self.api.put(
            reverse(self.URL), {'header_layout': 'diagonal'}, format='json')
        self.assertEqual(resp.status_code, 400)


# ── LoyaltySettingViewSet (singleton) ─────────────────────────────────────────

class LoyaltySettingViewSetTest(SettingsBase):
    LIST = 'loyaltysetting-list'
    DETAIL = 'loyaltysetting-detail'

    def test_list_anonyme_refuse(self):
        resp = self.anon.get(reverse(self.LIST))
        self.assertIn(resp.status_code, (401, 403))

    def test_list_cree_singleton(self):
        self.assertFalse(LoyaltySetting.objects.exists())
        resp = self.api.get(reverse(self.LIST))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertTrue(LoyaltySetting.objects.filter(pk=1).exists())
        self.assertEqual(resp.data[0]['amount_per_point'], '1000')

    def test_post_upsert_singleton(self):
        """POST agit comme un upsert sur le singleton (200, pas 201)."""
        LoyaltySetting.objects.create(amount_per_point=500)
        resp = self.api.post(reverse(self.LIST), {
            'amount_per_point': '2000',
            'point_value': '25',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(LoyaltySetting.objects.count(), 1)
        obj = LoyaltySetting.objects.get(pk=1)
        self.assertEqual(obj.amount_per_point, Decimal('2000'))
        self.assertEqual(obj.point_value, Decimal('25'))

    def test_post_cree_si_absent(self):
        resp = self.api.post(reverse(self.LIST), {
            'auto_reward_threshold': 100,
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(
            LoyaltySetting.objects.get(pk=1).auto_reward_threshold, 100)

    def test_detail_ignore_pk_retourne_singleton(self):
        """get_object() retourne toujours pk=1 quel que soit le pk demandé."""
        LoyaltySetting.objects.create()
        resp = self.api.get(reverse(self.DETAIL, kwargs={'pk': 999}))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['id'], 1)

    def test_patch_detail_maj(self):
        LoyaltySetting.objects.create()
        resp = self.api.patch(reverse(self.DETAIL, kwargs={'pk': 1}), {
            'amount_per_point': '750',
            'auto_reward_percent': '5.00',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        obj = LoyaltySetting.objects.get(pk=1)
        self.assertEqual(obj.amount_per_point, Decimal('750'))
        self.assertEqual(obj.auto_reward_percent, Decimal('5.00'))
        self.assertTrue(AuditLog.objects.filter(
            model_name='LoyaltySetting', action='UPDATE').exists())

    def test_delete_singleton(self):
        LoyaltySetting.objects.create()
        resp = self.api.delete(reverse(self.DETAIL, kwargs={'pk': 1}))
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(LoyaltySetting.objects.exists())


# ── ConfigurationOptionViewSet ────────────────────────────────────────────────

class ConfigurationOptionViewSetTest(SettingsBase):
    LIST = 'configurationoption-list'
    DETAIL = 'configurationoption-detail'

    def _opt(self, code='PERIME', label='Produit périmé',
             type_='STOCK_ADJ', **kw):
        return ConfigurationOption.objects.create(
            code=code, label=label, type=type_, **kw)

    def test_list_anonyme_refuse(self):
        resp = self.anon.get(reverse(self.LIST))
        self.assertIn(resp.status_code, (401, 403))

    def test_list_paginee_et_filtre_type(self):
        self._opt(code='A', type_='STOCK_ADJ')
        self._opt(code='B', type_='STOCK_ADJ', is_active=False)
        self._opt(code='C', type_='MONEY_DENOM', value='10000')
        resp = self.api.get(reverse(self.LIST))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data['results']), 3)

        resp = self.api.get(reverse(self.LIST), {'type': 'MONEY_DENOM'})
        self.assertEqual(len(resp.data['results']), 1)
        self.assertEqual(resp.data['results'][0]['code'], 'C')

        resp = self.api.get(
            reverse(self.LIST), {'type': 'STOCK_ADJ', 'is_active': 'true'})
        self.assertEqual(len(resp.data['results']), 1)
        self.assertEqual(resp.data['results'][0]['code'], 'A')

    def test_create_ok_avec_audit(self):
        resp = self.api.post(reverse(self.LIST), {
            'code': 'CASSE', 'label': 'Produit cassé', 'type': 'STOCK_ADJ',
            'order': 5,
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data['type_display'], 'Motif Ajustement Stock')
        self.assertTrue(AuditLog.objects.filter(
            model_name='ConfigurationOption', action='CREATE').exists())

    def test_create_doublon_type_code_400(self):
        self._opt(code='DUP', type_='STOCK_ADJ')
        resp = self.api.post(reverse(self.LIST), {
            'code': 'DUP', 'label': 'Autre', 'type': 'STOCK_ADJ',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_create_type_invalide_400(self):
        resp = self.api.post(reverse(self.LIST), {
            'code': 'X', 'label': 'X', 'type': 'BAD_TYPE',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_update_avec_audit(self):
        opt = self._opt()
        resp = self.api.patch(
            reverse(self.DETAIL, kwargs={'pk': opt.pk}),
            {'label': 'Nouveau label', 'is_active': False}, format='json')
        self.assertEqual(resp.status_code, 200)
        opt.refresh_from_db()
        self.assertEqual(opt.label, 'Nouveau label')
        self.assertFalse(opt.is_active)
        self.assertTrue(AuditLog.objects.filter(
            model_name='ConfigurationOption', action='UPDATE').exists())

    def test_delete(self):
        opt = self._opt()
        resp = self.api.delete(reverse(self.DETAIL, kwargs={'pk': opt.pk}))
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(ConfigurationOption.objects.filter(pk=opt.pk).exists())


# ── TVAViewSet ────────────────────────────────────────────────────────────────

class TVAViewSetTest(SettingsBase):
    LIST = 'tva-list'
    DETAIL = 'tva-detail'

    def test_list_anonyme_refuse(self):
        resp = self.anon.get(reverse(self.LIST))
        self.assertIn(resp.status_code, (401, 403))

    def test_crud_complet(self):
        # create
        resp = self.api.post(reverse(self.LIST), {
            'taux': '21.00', 'libelle': 'Taux test',
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.data)
        tva_id = resp.data['id']
        self.assertTrue(AuditLog.objects.filter(
            model_name='TVA', action='CREATE').exists())

        # list (ordonné par -taux ; 19.25 et 0 existent via la migration seed)
        TVA.objects.create(taux=Decimal('5.50'))
        resp = self.api.get(reverse(self.LIST))
        self.assertEqual(resp.status_code, 200)
        taux_list = [r['taux'] for r in resp.data['results']]
        self.assertEqual(taux_list[0], '21.00')

        # update
        resp = self.api.patch(
            reverse(self.DETAIL, kwargs={'pk': tva_id}),
            {'is_active': False}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(TVA.objects.get(pk=tva_id).is_active)
        self.assertTrue(AuditLog.objects.filter(
            model_name='TVA', action='UPDATE').exists())

        # delete
        resp = self.api.delete(reverse(self.DETAIL, kwargs={'pk': tva_id}))
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(TVA.objects.filter(pk=tva_id).exists())
        self.assertTrue(AuditLog.objects.filter(
            model_name='TVA', action='DELETE').exists())

    def test_create_doublon_taux_400(self):
        # 19.25 existe déjà (migration 0260_seed_defauts)
        resp = self.api.post(reverse(self.LIST), {
            'taux': '19.25', 'libelle': 'Doublon',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_create_sans_taux_400(self):
        resp = self.api.post(reverse(self.LIST), {'libelle': 'X'}, format='json')
        self.assertEqual(resp.status_code, 400)


# ── WhatsAppTestView ──────────────────────────────────────────────────────────

class WhatsAppTestViewTest(SettingsBase):
    URL = 'whatsapp-test'

    def _settings(self, phone_id='', token=''):
        return PharmacySettings.objects.create(
            whatsapp_phone_id=phone_id, whatsapp_access_token=token)

    def test_anonyme_refuse(self):
        resp = self.anon.post(reverse(self.URL), {}, format='json')
        self.assertIn(resp.status_code, (401, 403))

    def test_numero_manquant_400(self):
        resp = self.api.post(reverse(self.URL), {}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('numero', resp.data['error'])

    def test_phone_id_manquant_400(self):
        self._settings(phone_id='', token='tok')
        resp = self.api.post(
            reverse(self.URL), {'numero': '699000000'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Phone Number ID', resp.data['message'])

    def test_token_manquant_400(self):
        self._settings(phone_id='12345', token='')
        resp = self.api.post(
            reverse(self.URL), {'numero': '699000000'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Access Token', resp.data['message'])

    def test_numero_trop_court_400(self):
        self._settings(phone_id='12345', token='tok')
        resp = self.api.post(
            reverse(self.URL), {'numero': '123'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Numéro invalide', resp.data['message'])

    @patch('requests.post')
    def test_envoi_succes(self, mock_post):
        self._settings(phone_id='12345', token='tok')
        mock_post.return_value = _requests_mock(200, {'messages': [{'id': 'w1'}]})
        resp = self.api.post(
            reverse(self.URL), {'numero': '+237 699 00 00 00'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['status'], 'ok')
        # numéro nettoyé (digits only)
        self.assertEqual(mock_post.call_args[1]['json']['to'], '237699000000')

    @patch('requests.post')
    def test_erreur_meta_token_expire_502(self, mock_post):
        self._settings(phone_id='12345', token='tok')
        mock_post.return_value = _requests_mock(400, {
            'error': {'code': 190, 'message': 'Invalid OAuth',
                      'error_user_msg': 'Token expiré', 'fbtrace_id': 'abc'},
        })
        resp = self.api.post(
            reverse(self.URL), {'numero': '699000000'}, format='json')
        self.assertEqual(resp.status_code, 502)
        self.assertEqual(resp.data['status'], 'error')
        self.assertEqual(resp.data['meta_code'], 190)
        self.assertIn('Token expiré', resp.data['hint'])
        self.assertIn('Token expiré', resp.data['message'])

    @patch('requests.post')
    def test_erreur_meta_code_100_hint(self, mock_post):
        self._settings(phone_id='12345', token='tok')
        mock_post.return_value = _requests_mock(400, {
            'error': {'code': 100, 'message': 'Bad parameter'},
        })
        resp = self.api.post(
            reverse(self.URL), {'numero': '699000000'}, format='json')
        self.assertEqual(resp.status_code, 502)
        self.assertIn('Phone Number ID', resp.data['hint'])

    @patch('requests.post')
    def test_reponse_non_json_502(self, mock_post):
        self._settings(phone_id='12345', token='tok')
        mock_post.return_value = _requests_mock(500, None, text='<html>err</html>')
        resp = self.api.post(
            reverse(self.URL), {'numero': '699000000'}, format='json')
        self.assertEqual(resp.status_code, 502)
        self.assertEqual(resp.data['meta_code'], 500)
        self.assertEqual(resp.data['detail'], {'raw': '<html>err</html>'})

    @patch('requests.post', side_effect=requests.exceptions.Timeout)
    def test_timeout_502(self, _m):
        self._settings(phone_id='12345', token='tok')
        resp = self.api.post(
            reverse(self.URL), {'numero': '699000000'}, format='json')
        self.assertEqual(resp.status_code, 502)
        self.assertIn('Timeout', resp.data['message'])

    @patch('requests.post', side_effect=Exception('connexion impossible'))
    def test_exception_generique_502(self, _m):
        self._settings(phone_id='12345', token='tok')
        resp = self.api.post(
            reverse(self.URL), {'numero': '699000000'}, format='json')
        self.assertEqual(resp.status_code, 502)
        self.assertIn('connexion impossible', resp.data['message'])


# ── TelegramTestView ──────────────────────────────────────────────────────────

class TelegramTestViewTest(SettingsBase):
    URL = 'telegram-test'

    def test_anonyme_refuse(self):
        resp = self.anon.post(reverse(self.URL), {}, format='json')
        self.assertIn(resp.status_code, (401, 403))

    def test_token_manquant_400(self):
        resp = self.api.post(reverse(self.URL), {}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Token', resp.data['message'])

    def test_chat_id_manquant_400(self):
        PharmacySettings.objects.create(
            telegram_bot_token='tok', telegram_chat_id='')
        resp = self.api.post(reverse(self.URL), {}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Chat ID', resp.data['message'])

    @patch(TELEGRAM_SEND, return_value=(True, 'Message envoyé'))
    def test_envoi_succes_via_settings(self, mock_send):
        PharmacySettings.objects.create(
            telegram_bot_token='tok', telegram_chat_id='777',
            pharmacy_name='Ma Pharma')
        resp = self.api.post(reverse(self.URL), {}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['status'], 'ok')
        mock_send.assert_called_once()
        self.assertEqual(mock_send.call_args[1]['bot_token'], 'tok')
        self.assertEqual(mock_send.call_args[1]['chat_id'], '777')
        self.assertIn('Ma Pharma', mock_send.call_args[1]['text'])

    @patch(TELEGRAM_SEND, return_value=(True, 'ok'))
    def test_override_body(self, mock_send):
        """bot_token/chat_id du body prennent le pas sur les settings."""
        PharmacySettings.objects.create(
            telegram_bot_token='tok_db', telegram_chat_id='111')
        resp = self.api.post(reverse(self.URL), {
            'bot_token': 'tok_body', 'chat_id': '222',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(mock_send.call_args[1]['bot_token'], 'tok_body')
        self.assertEqual(mock_send.call_args[1]['chat_id'], '222')

    @patch(TELEGRAM_SEND, return_value=(False, 'Échec envoi'))
    def test_envoi_echec_502(self, _m):
        PharmacySettings.objects.create(
            telegram_bot_token='tok', telegram_chat_id='777')
        resp = self.api.post(reverse(self.URL), {}, format='json')
        self.assertEqual(resp.status_code, 502)
        self.assertEqual(resp.data['status'], 'error')


# ── TelegramGetChatIdView ─────────────────────────────────────────────────────

class TelegramGetChatIdViewTest(SettingsBase):
    URL = 'telegram-get-chat-id'

    def test_token_manquant_400(self):
        resp = self.api.post(reverse(self.URL), {}, format='json')
        self.assertEqual(resp.status_code, 400)

    @patch('requests.get')
    def test_api_not_ok_400(self, mock_get):
        mock_get.return_value = _requests_mock(200, {
            'ok': False, 'description': 'Unauthorized'})
        resp = self.api.post(
            reverse(self.URL), {'bot_token': 'bad'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Unauthorized', resp.data['message'])

    @patch('requests.get')
    def test_aucun_message_waiting(self, mock_get):
        mock_get.return_value = _requests_mock(200, {'ok': True, 'result': []})
        resp = self.api.post(
            reverse(self.URL), {'bot_token': 'tok'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['status'], 'waiting')

    @patch('requests.get')
    def test_chat_id_depuis_message(self, mock_get):
        mock_get.return_value = _requests_mock(200, {'ok': True, 'result': [
            {'message': {'chat': {'id': 555, 'first_name': 'Bob'}}},
        ]})
        resp = self.api.post(
            reverse(self.URL), {'bot_token': 'tok'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['status'], 'ok')
        self.assertEqual(resp.data['chat_id'], '555')
        self.assertEqual(resp.data['chat_name'], 'Bob')

    @patch('requests.get')
    def test_chat_id_depuis_my_chat_member(self, mock_get):
        """Fallback `my_chat_member` quand la dernière update n'est pas un message."""
        mock_get.return_value = _requests_mock(200, {'ok': True, 'result': [
            {'my_chat_member': {'chat': {'id': 999, 'title': 'Groupe Pharma'}}},
        ]})
        resp = self.api.post(
            reverse(self.URL), {'bot_token': 'tok'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['chat_id'], '999')
        self.assertEqual(resp.data['chat_name'], 'Groupe Pharma')

    @patch('requests.get', side_effect=Exception('réseau HS'))
    def test_exception_502(self, _m):
        resp = self.api.post(
            reverse(self.URL), {'bot_token': 'tok'}, format='json')
        self.assertEqual(resp.status_code, 502)

    @patch('requests.get')
    def test_token_depuis_settings(self, mock_get):
        """Sans bot_token dans le body, le token des settings est utilisé."""
        PharmacySettings.objects.create(telegram_bot_token='tok_db')
        mock_get.return_value = _requests_mock(200, {'ok': True, 'result': []})
        resp = self.api.post(reverse(self.URL), {}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('bottok_db/getUpdates', mock_get.call_args[0][0])


# ── TelegramRapportFlashView ──────────────────────────────────────────────────

class TelegramRapportFlashViewTest(SettingsBase):
    URL = 'telegram-rapport-flash'

    def test_telegram_desactive_400(self):
        PharmacySettings.objects.create(telegram_enabled=False)
        resp = self.api.post(reverse(self.URL), {}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Telegram non activé', resp.data['message'])

    def test_pas_de_settings_400(self):
        resp = self.api.post(reverse(self.URL), {}, format='json')
        self.assertEqual(resp.status_code, 400)

    @patch(TELEGRAM_SEND, return_value=(True, 'envoyé'))
    def test_stats_fournies_par_frontend(self, mock_send):
        PharmacySettings.objects.create(telegram_enabled=True)
        resp = self.api.post(reverse(self.URL), {'stats': {
            'revenue': {'value': 50000, 'change': 12.5},
            'sales': {'value': 7},
            'receivables': {'value': 3000},
            'low_stock': {'value': 2},
        }}, format='json')
        self.assertEqual(resp.status_code, 200)
        text = mock_send.call_args[0][0]
        self.assertIn('50,000', text)
        self.assertIn('Ventes :</b> 7', text)
        self.assertIn('📈', text)  # change positif

    @patch(TELEGRAM_SEND, return_value=(True, 'envoyé'))
    def test_stats_calculees_backend(self, mock_send):
        """Sans stats frontend, les chiffres sont calculés depuis la DB.
        Couvre le fix : status='VALIDEE' → Facture.Status.VALIDEE ('VAL')
        et stock_quantity/est_actif → stock/is_active (FieldError → 500)."""
        PharmacySettings.objects.create(telegram_enabled=True)
        produit = F.create_produit(stock=0)  # rupture → compté par is_active/stock
        facture = F.create_facture(
            status='VAL', numero_facture='FAC-SET-FLASH',
            total_ttc=Decimal('10000'))
        resp = self.api.post(reverse(self.URL), {}, format='json')
        self.assertEqual(resp.status_code, 200)
        text = mock_send.call_args[0][0]
        self.assertIn('10,000', text)          # CA calculé côté backend
        self.assertIn('Ventes :</b> 1', text)  # la facture VAL est comptée
        self.assertIn('Ruptures :</b> 1', text)  # produit.stock=0 compté

    @patch(TELEGRAM_SEND, return_value=(False, 'fail'))
    def test_echec_envoi_502(self, _m):
        PharmacySettings.objects.create(telegram_enabled=True)
        resp = self.api.post(reverse(self.URL), {'stats': {}}, format='json')
        self.assertEqual(resp.status_code, 502)


# ── TelegramRapportFlashDateView ──────────────────────────────────────────────

class TelegramRapportFlashDateViewTest(SettingsBase):
    URL = 'telegram-rapport-flash-date'

    def setUp(self):
        super().setUp()
        PharmacySettings.objects.create(telegram_enabled=True)
        self.today = timezone.localtime(timezone.now()).date().isoformat()

    def test_telegram_desactive_400(self):
        PharmacySettings.objects.all().delete()
        PharmacySettings.objects.create(telegram_enabled=False)
        resp = self.api.post(
            reverse(self.URL), {'date': self.today}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_date_manquante_400(self):
        resp = self.api.post(reverse(self.URL), {}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('date', resp.data['message'].lower())

    def test_date_invalide_400(self):
        resp = self.api.post(
            reverse(self.URL), {'date': '31/12/2024'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Format de date invalide', resp.data['message'])

    @patch(TELEGRAM_SEND, return_value=(True, 'envoyé'))
    def test_rapport_date_avec_ventes(self, mock_send):
        produit = F.create_produit(cost_price=50, selling_price=100)
        produit.pmp = Decimal('40')  # coût unitaire pour le calcul de marge
        produit.save()
        facture = F.create_facture(
            status='PAY', numero_facture='FAC-SET-DATE',
            remise=Decimal('20'))
        # Le signal post_save de FactureProduit recalcule les totaux :
        # TTC brut = 2 * (100 - 10) = 180, remise 20 → TTC net = 160
        # Remises = lignes (10*2=20) + globale (20) = 40
        # Marge = (100 - pmp 40) * 2 = 120 → 75.0%
        F.create_facture_produit(
            facture, produit, quantity=2,
            selling_price=Decimal('100'), discount=Decimal('10'))
        F.create_caisse(facture, 500, mode_paiement='en_compte')

        resp = self.api.post(
            reverse(self.URL), {'date': self.today}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        text = mock_send.call_args[0][0]
        self.assertIn('CA TTC :</b> 160', text)
        self.assertIn('panier moy.', text)
        self.assertIn('Marge brute :</b> 120 FCFA (75.0%)', text)
        self.assertIn('Remises :</b> 40', text)
        self.assertIn('En compte :</b> 500', text)

    @patch(TELEGRAM_SEND, return_value=(False, 'fail'))
    def test_echec_envoi_502(self, _m):
        resp = self.api.post(
            reverse(self.URL), {'date': self.today}, format='json')
        self.assertEqual(resp.status_code, 502)


# ── TelegramRapportInventaireView ─────────────────────────────────────────────

class TelegramRapportInventaireViewTest(SettingsBase):
    URL = 'telegram-rapport-inventaire'

    def test_telegram_desactive_400(self):
        resp = self.api.post(reverse(self.URL), {}, format='json')
        self.assertEqual(resp.status_code, 400)

    @patch(TELEGRAM_SEND, return_value=(True, 'envoyé'))
    def test_sans_inventaire(self, mock_send):
        PharmacySettings.objects.create(telegram_enabled=True)
        resp = self.api.post(reverse(self.URL), {}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('Aucun inventaire', mock_send.call_args[0][0])

    @patch(TELEGRAM_SEND, return_value=(True, 'envoyé'))
    def test_dernier_inventaire_valide(self, mock_send):
        PharmacySettings.objects.create(telegram_enabled=True)
        produit = F.create_produit(cost_price=100, selling_price=150)
        produit.pmp = Decimal('100')
        produit.save()
        inv = Inventaire.objects.create(
            status='VALIDEE', description='Inventaire test')
        # +2 excédent
        LigneInventaire.objects.create(
            inventaire=inv, produit=produit,
            stock_theorique=10, quantite_physique=12)
        # -1 manquant
        p2 = F.create_produit(cost_price=200, selling_price=300)
        p2.pmp = Decimal('200')
        p2.save()
        LigneInventaire.objects.create(
            inventaire=inv, produit=p2,
            stock_theorique=5, quantite_physique=4)

        resp = self.api.post(reverse(self.URL), {}, format='json')
        self.assertEqual(resp.status_code, 200)
        text = mock_send.call_args[0][0]
        self.assertIn('Rapport Inventaire', text)
        self.assertIn('Excédents', text)
        self.assertIn('Manquants', text)
        self.assertIn('Top excédents', text)

    @patch(TELEGRAM_SEND, return_value=(True, 'envoyé'))
    def test_inventaire_par_id(self, mock_send):
        PharmacySettings.objects.create(telegram_enabled=True)
        inv = Inventaire.objects.create(
            status='EN_COURS', description='Ciblé')
        resp = self.api.post(
            reverse(self.URL), {'inventaire_id': inv.id}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('En cours', mock_send.call_args[0][0])

    @patch(TELEGRAM_SEND, return_value=(False, 'fail'))
    def test_echec_envoi_502(self, _m):
        PharmacySettings.objects.create(telegram_enabled=True)
        resp = self.api.post(reverse(self.URL), {}, format='json')
        self.assertEqual(resp.status_code, 502)


# ── TelegramRapportMensuelView ────────────────────────────────────────────────

class TelegramRapportMensuelViewTest(SettingsBase):
    URL = 'telegram-rapport-mensuel'

    def _payload(self):
        return {
            'periode': 'Janvier 2025',
            'rapport': {
                'ca': {
                    'ca_ttc': 100000, 'ca_ht': 80000,
                    'nb_ventes': 4, 'total_remises': 1500,
                },
                'marge': {'marge_brute': 30000, 'marge_pct': 30.0},
                'encaissements': [{'montant': 60000}, {'montant': 30000}],
                'mouvements_caisse': {'total_entrees': 5000, 'total_sorties': 2000},
                'achats_par_fournisseur': [
                    {'fournisseur_nom': 'Laborex', 'montant_total': 25000},
                ],
                'ventes_credit': 8000,
            },
        }

    def test_telegram_desactive_400(self):
        resp = self.api.post(reverse(self.URL), self._payload(), format='json')
        self.assertEqual(resp.status_code, 400)

    def test_rapport_manquant_400(self):
        PharmacySettings.objects.create(telegram_enabled=True)
        resp = self.api.post(reverse(self.URL), {}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('rapport', resp.data['message'].lower())

    @patch(TELEGRAM_SEND, return_value=(True, 'envoyé'))
    def test_rapport_complet(self, mock_send):
        PharmacySettings.objects.create(telegram_enabled=True)
        resp = self.api.post(
            reverse(self.URL), self._payload(), format='json')
        self.assertEqual(resp.status_code, 200)
        text = mock_send.call_args[0][0]
        self.assertIn("Rapport d'Activité", text)
        self.assertIn('Janvier 2025', text)
        self.assertIn('100,000', text)     # CA TTC
        self.assertIn('90,000', text)      # encaissements cumulés
        self.assertIn('Laborex', text)     # top fournisseur
        self.assertIn('Mouvements caisse', text)

    @patch(TELEGRAM_SEND, return_value=(True, 'envoyé'))
    def test_rapport_minimal(self, mock_send):
        """Sans mouvements caisse ni achats, ces sections sont omises."""
        PharmacySettings.objects.create(telegram_enabled=True)
        payload = self._payload()
        payload['rapport']['mouvements_caisse'] = {
            'total_entrees': 0, 'total_sorties': 0}
        payload['rapport']['achats_par_fournisseur'] = []
        resp = self.api.post(reverse(self.URL), payload, format='json')
        self.assertEqual(resp.status_code, 200)
        text = mock_send.call_args[0][0]
        self.assertNotIn('Mouvements caisse', text)
        self.assertNotIn('Top Fournisseurs', text)

    @patch(TELEGRAM_SEND, return_value=(False, 'fail'))
    def test_echec_envoi_502(self, _m):
        PharmacySettings.objects.create(telegram_enabled=True)
        resp = self.api.post(
            reverse(self.URL), self._payload(), format='json')
        self.assertEqual(resp.status_code, 502)
