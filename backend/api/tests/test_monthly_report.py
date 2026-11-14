"""
Tests de la commande send_monthly_report (rapport mensuel automatique).

Cible : l'envoi email réel était un TODO jamais implémenté, la commande
n'était jamais planifiée, et l'anti-doublon/reprise est assuré par
PharmacySettings.last_monthly_report_sent.

Lancer :
    docker exec fullstack_produits-backend-1 \\
        python manage.py test api.tests.test_monthly_report -v 2 --noinput
"""
from io import StringIO
from unittest.mock import patch

from django.core import mail
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from api.models import PharmacySettings

from .factories import TestDataFactory


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class MonthlyReportEmailTest(TestCase):
    """La commande envoie un email aux destinataires configurés."""

    @classmethod
    def setUpTestData(cls):
        cls.produit = TestDataFactory.create_produit(stock=50)
        cls.customer = TestDataFactory.create_client(client_type='PROFESSIONNEL')
        TestDataFactory.create_facture_produit(
            TestDataFactory.create_facture(client=cls.customer, status='VAL', total_ttc=1000),
            cls.produit, selling_price=1000,
        )
        cls.ps, _ = PharmacySettings.objects.get_or_create(pk=1)

    def setUp(self):
        ps = self.ps
        ps.monthly_report_enabled = True
        ps.report_send_telegram = False
        ps.telegram_enabled = False
        ps.last_monthly_report_sent = None
        ps.report_recipients_email = '  owner@pharma.test, compta@pharma.test ; '
        ps.save()

    def _run(self, *args):
        out = StringIO()
        call_command('send_monthly_report', *args, stdout=out)
        return out.getvalue()

    def test_email_sent_to_configured_recipients(self):
        out = self._run('--force')
        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertCountEqual(sent.to, ['owner@pharma.test', 'compta@pharma.test'])
        self.assertIn('Rapport', sent.subject)
        self.assertNotIn('<b>', sent.body)  # balises HTML converties en texte brut
        self.assertRegex(sent.body, r'^[\x00-\x7F\u00C0-\u00FF\u2013\u2019,;\.\s\S]*$')  # pas d'emoji
        self.assertNotRegex(sent.body, r'[\U0001F300-\U0001FAFF\u2600-\u27BF]')
        self.assertIn('RAPPORT MENSUEL', sent.body.upper())
        self.assertIn('Rapport Email envoyé', out)

    def test_marks_month_as_sent_and_skips_second_run(self):
        self._run('--force')
        self.ps.refresh_from_db()
        self.assertIsNotNone(self.ps.last_monthly_report_sent)
        self.assertEqual(len(mail.outbox), 1)
        # Deuxième appel (planificateur dans la journée) : anti-doublon.
        self._run()
        self.assertEqual(len(mail.outbox), 1)

    def test_skips_before_configured_day(self):
        self.ps.monthly_report_day = 28
        self.ps.save()
        self._run()  # pas --force, aujourd'hui < 28
        self.assertEqual(len(mail.outbox), 0)

    def test_no_channel_configured_not_marked_sent(self):
        """Aucun canal configuré → rapport non distribué, mois NON marqué
        (le planificateur continuera de retenter tant qu'aucun destinataire
        n'est renseigné, au lieu de marquer « envoyé » à personne)."""
        self.ps.report_recipients_email = ''
        self.ps.save()
        self._run('--force')
        self.assertEqual(len(mail.outbox), 0)
        self.ps.refresh_from_db()
        self.assertIsNone(self.ps.last_monthly_report_sent)

    def test_failure_does_not_mark_sent(self):
        with patch('django.core.mail.send_mail', side_effect=Exception('SMTP down')):
            self._run('--force')
        self.ps.refresh_from_db()
        self.assertIsNone(self.ps.last_monthly_report_sent)

    def test_disabled_report_skips(self):
        self.ps.monthly_report_enabled = False
        self.ps.save()
        self._run('--force')
        self.assertEqual(len(mail.outbox), 0)


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class MonthlyReportWhatsAppTest(TestCase):
    """La commande envoie le rapport via WhatsApp quand le canal est activé."""

    @classmethod
    def setUpTestData(cls):
        cls.ps, _ = PharmacySettings.objects.get_or_create(pk=1)

    def setUp(self):
        ps = self.ps
        ps.monthly_report_enabled = True
        ps.report_send_telegram = False
        ps.telegram_enabled = False
        ps.report_recipients_email = ''
        ps.last_monthly_report_sent = None
        ps.report_send_whatsapp = True
        ps.whatsapp_enabled = True
        ps.pharmacist_whatsapp_number = '237 699 00 00 00'
        ps.save()

    def _run(self, *args):
        out = StringIO()
        call_command('send_monthly_report', *args, stdout=out)
        return out.getvalue()

    def test_whatsapp_sent_when_enabled(self):
        with patch('api.whatsapp_service.WhatsAppService.send_text_message',
                   return_value=True) as send:
            out = self._run('--force')
        send.assert_called_once()
        kwargs = send.call_args.kwargs
        self.assertEqual(kwargs['recipient_number'], '237 699 00 00 00')
        self.assertEqual(kwargs['msg_type'], 'RAPPORT')
        # Markup WhatsApp : pas de balise HTML, gras en étoiles.
        self.assertNotIn('<b>', kwargs['message'])
        self.assertIn('Rapport Mensuel', kwargs['message'])
        self.assertIn('Rapport WhatsApp envoyé', out)
        self.ps.refresh_from_db()
        self.assertIsNotNone(self.ps.last_monthly_report_sent)

    def test_whatsapp_failure_does_not_mark_sent(self):
        with patch('api.whatsapp_service.WhatsAppService.send_text_message',
                   return_value=False):
            self._run('--force')
        self.ps.refresh_from_db()
        self.assertIsNone(self.ps.last_monthly_report_sent)

    def test_whatsapp_not_resent_if_already_sent_this_month(self):
        from api.models import WhatsAppLog
        WhatsAppLog.objects.create(
            recipient_number='237699000000',
            message='rapport',
            type=WhatsAppLog.Type.RAPPORT,
            status=WhatsAppLog.Status.SENT,
            sent_at=timezone.now(),
        )
        with patch('api.whatsapp_service.WhatsAppService.send_text_message',
                   return_value=True) as send:
            self._run('--force')
        send.assert_not_called()

    def test_whatsapp_skipped_when_flag_on_but_disabled(self):
        """report_send_whatsapp coché mais API désactivée → pas d'appel."""
        self.ps.whatsapp_enabled = False
        self.ps.save()
        with patch('api.whatsapp_service.WhatsAppService.send_text_message',
                   return_value=True) as send:
            out = self._run('--force')
        send.assert_not_called()
        self.assertIn('numéro titulaire manquant', out)
