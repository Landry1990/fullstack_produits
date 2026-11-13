import shutil
import tempfile
from io import BytesIO

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from ..models import InternalMessage, MessageTemplate
from ..serializers import InternalMessageSerializer


class InternalMessagingSecurityTests(APITestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.settings_override = override_settings(MEDIA_ROOT=self.media_root)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.addCleanup(shutil.rmtree, self.media_root)
        self.sender = User.objects.create_user(username='message_sender', password='password')
        self.recipient = User.objects.create_user(username='message_recipient', password='password')
        self.outsider = User.objects.create_user(username='message_outsider', password='password')
        self.staff = User.objects.create_user(username='message_staff', password='password', is_staff=True)

    def test_conversations_group_both_directions_and_exclude_broadcasts(self):
        InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Bonjour')
        latest = InternalMessage.objects.create(sender=self.recipient, recipient=self.sender, content='Réponse')
        InternalMessage.objects.create(sender=self.outsider, recipient=self.staff, content='Secret')
        InternalMessage.objects.create(sender=self.staff, content='Annonce')
        self.authenticate(self.sender)
        response = self.client.get('/api/internal-messages/conversations/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        conversation = response.data['results'][0]
        self.assertEqual(conversation['peer_id'], self.recipient.pk)
        self.assertEqual(conversation['last_content'], latest.content)
        self.assertEqual(conversation['unread_count'], 1)

    def test_thread_cursor_does_not_duplicate_messages_after_new_arrival(self):
        for index in range(32):
            InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content=str(index))
        self.authenticate(self.recipient)
        first = self.client.get('/api/internal-messages/conversation/', {'peer': self.sender.pk}).data
        self.assertEqual(len(first['results']), 30)
        InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Nouveau')
        older = self.client.get('/api/internal-messages/conversation/', {'peer': self.sender.pk, 'before': first['next_before']}).data
        self.assertEqual(len(older['results']), 2)
        self.assertIsNone(older['next_before'])
        self.assertFalse({m['id'] for m in first['results']} & {m['id'] for m in older['results']})

    def test_thread_is_private_even_for_staff_and_hides_own_archives(self):
        message = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Secret')
        self.authenticate(self.staff)
        response = self.client.get('/api/internal-messages/conversation/', {'peer': self.sender.pk})
        self.assertEqual(response.data['results'], [])
        self.authenticate(self.recipient)
        message.archived_by.add(self.recipient)
        response = self.client.get('/api/internal-messages/conversation/', {'peer': self.sender.pk})
        self.assertEqual(response.data['results'], [])
        self.assertEqual(self.client.get('/api/internal-messages/conversations/').data['count'], 0)

    def test_conversation_read_only_marks_explicit_incoming_messages(self):
        incoming = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Reçu')
        outgoing = InternalMessage.objects.create(sender=self.recipient, recipient=self.sender, content='Envoyé')
        foreign = InternalMessage.objects.create(sender=self.outsider, recipient=self.recipient, content='Autre')
        self.authenticate(self.recipient)
        response = self.client.post('/api/internal-messages/conversation_read/', {
            'peer': self.sender.pk, 'ids': [incoming.pk, outgoing.pk, foreign.pk],
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(incoming.read_by.filter(pk=self.recipient.pk).exists())
        self.assertFalse(outgoing.read_by.exists())
        self.assertFalse(foreign.read_by.exists())

    def test_conversation_rejects_invalid_cursor_and_peer(self):
        self.authenticate(self.recipient)
        self.assertEqual(self.client.get('/api/internal-messages/conversation/', {'peer': 'abc'}).status_code, 400)
        self.assertEqual(self.client.get('/api/internal-messages/conversation/', {'peer': self.sender.pk, 'before': '-1'}).status_code, 400)
        self.assertEqual(self.client.post('/api/internal-messages/conversation_read/', {'peer': self.sender.pk, 'ids': 'all'}, format='json').status_code, 400)

    def image_attachment(self, name='image.png', image_format='PNG', content_type='image/png'):
        content = BytesIO()
        Image.new('RGB', (2, 2), color='red').save(content, format=image_format)
        return SimpleUploadedFile(name, content.getvalue(), content_type=content_type)

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_recipient_cannot_delete_received_message(self):
        message = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Confidentiel')
        self.authenticate(self.recipient)

        response = self.client.delete(f'/api/internal-messages/{message.id}/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(InternalMessage.objects.filter(pk=message.id).exists())

    def test_sender_cannot_physically_delete_message(self):
        message = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='À conserver')
        self.authenticate(self.sender)

        response = self.client.delete(f'/api/internal-messages/{message.id}/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(InternalMessage.objects.filter(pk=message.id).exists())

    def test_staff_can_delete_message(self):
        message = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Modération')
        self.authenticate(self.staff)

        response = self.client.delete(f'/api/internal-messages/{message.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(InternalMessage.objects.filter(pk=message.id).exists())

    def test_recipient_cannot_modify_received_message(self):
        message = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Original')
        self.authenticate(self.recipient)

        response = self.client.patch(
            f'/api/internal-messages/{message.id}/',
            {'content': 'Contenu falsifié'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        message.refresh_from_db()
        self.assertEqual(message.content, 'Original')

    def test_sender_cannot_modify_sent_message(self):
        message = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Original')
        self.authenticate(self.sender)

        response = self.client.patch(
            f'/api/internal-messages/{message.id}/',
            {'content': 'Contenu modifié'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        message.refresh_from_db()
        self.assertEqual(message.content, 'Original')

    def test_message_without_attachment_accepts_explicit_null(self):
        self.authenticate(self.sender)

        response = self.client.post(
            '/api/internal-messages/',
            {'recipient': self.recipient.id, 'content': 'Sans fichier', 'attachment': None},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(InternalMessage.objects.get(pk=response.data['id']).attachment.name)

    def test_regular_user_cannot_broadcast(self):
        self.authenticate(self.sender)

        response = self.client.post('/api/internal-messages/', {'recipient': None, 'content': 'Pour tous'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(InternalMessage.objects.exists())

    def test_staff_can_broadcast(self):
        self.authenticate(self.staff)

        response = self.client.post('/api/internal-messages/', {'recipient': None, 'content': 'Information générale'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(InternalMessage.objects.get(pk=response.data['id']).recipient_id)

    def test_reply_to_inaccessible_message_is_rejected(self):
        private_message = InternalMessage.objects.create(
            sender=self.sender,
            recipient=self.recipient,
            content='Conversation privée',
        )
        self.authenticate(self.outsider)

        response = self.client.post(
            '/api/internal-messages/',
            {'recipient': self.sender.id, 'content': 'Réponse indiscrète', 'parent': private_message.id},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(InternalMessage.objects.count(), 1)

    def test_reply_to_message_with_unrelated_recipient_is_rejected(self):
        private_message = InternalMessage.objects.create(
            sender=self.sender,
            recipient=self.recipient,
            content='Conversation privée',
        )
        self.authenticate(self.recipient)

        response = self.client.post(
            '/api/internal-messages/',
            {'recipient': self.outsider.id, 'content': 'Mauvais destinataire', 'parent': private_message.id},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(InternalMessage.objects.count(), 1)

    def test_archived_user_ids_are_not_exposed(self):
        message = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Archivé')
        message.archived_by.add(self.recipient)
        self.authenticate(self.recipient)

        response = self.client.get('/api/internal-messages/', {'box': 'archived'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('archived_by', response.data['results'][0])

    def test_sender_cannot_mark_own_message_as_read(self):
        message = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Message')
        self.authenticate(self.sender)

        response = self.client.post(f'/api/internal-messages/{message.id}/mark_as_read/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(message.read_by.filter(pk=self.sender.id).exists())

    def test_regular_user_cannot_create_template(self):
        self.authenticate(self.sender)

        response = self.client.post('/api/message-templates/', {'title': 'Privé', 'content': 'Contenu'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(MessageTemplate.objects.exists())

    def test_regular_user_can_list_templates(self):
        MessageTemplate.objects.create(title='Accueil', content='Bonjour', created_by=self.staff)
        self.authenticate(self.sender)

        response = self.client.get('/api/message-templates/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_staff_can_manage_templates(self):
        self.authenticate(self.staff)

        response = self.client.post('/api/message-templates/', {'title': 'Rappel', 'content': 'Rappel général'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(MessageTemplate.objects.get(pk=response.data['id']).created_by_id, self.staff.id)

    def test_unsupported_attachment_extension_is_rejected(self):
        self.authenticate(self.sender)
        attachment = SimpleUploadedFile('programme.exe', b'MZ-invalid', content_type='application/octet-stream')

        response = self.client.post(
            '/api/internal-messages/',
            {'recipient': self.recipient.id, 'content': 'Fichier', 'attachment': attachment},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(InternalMessage.objects.exists())

    def test_attachment_larger_than_ten_megabytes_is_rejected(self):
        self.authenticate(self.sender)
        attachment = SimpleUploadedFile('document.pdf', b'x' * (10 * 1024 * 1024 + 1), content_type='application/pdf')

        response = self.client.post(
            '/api/internal-messages/',
            {'recipient': self.recipient.id, 'content': 'Document', 'attachment': attachment},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(InternalMessage.objects.exists())

    def test_falsified_attachment_signature_is_rejected(self):
        self.authenticate(self.sender)
        attachment = SimpleUploadedFile('image.png', b'%PDF-faux contenu%%EOF', content_type='image/png')

        response = self.client.post(
            '/api/internal-messages/',
            {'recipient': self.recipient.id, 'content': 'Image', 'attachment': attachment},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(InternalMessage.objects.exists())

    def test_valid_supported_attachment_contents_are_accepted_and_pointer_is_preserved(self):
        attachments = [
            self.image_attachment(),
            self.image_attachment('image.jpg', 'JPEG', 'image/jpeg'),
            self.image_attachment('image.webp', 'WEBP', 'image/webp'),
            SimpleUploadedFile('document.pdf', b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF', content_type='application/pdf'),
        ]

        for attachment in attachments:
            with self.subTest(name=attachment.name):
                attachment.seek(2)
                self.assertIs(InternalMessageSerializer().validate_attachment(attachment), attachment)
                self.assertEqual(attachment.tell(), 2)

    def test_attachment_url_uses_protected_endpoint_and_participants_can_access_it(self):
        self.authenticate(self.sender)
        response = self.client.post(
            '/api/internal-messages/',
            {'recipient': self.recipient.id, 'content': 'Image', 'attachment': self.image_attachment()},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        attachment_url = response.data['attachment_url']
        self.assertNotIn('attachment', response.data)
        self.assertTrue(attachment_url.endswith(f"/api/internal-messages/{response.data['id']}/attachment/"))
        self.assertNotIn('/media/', attachment_url)
        self.assertEqual(self.client.get(attachment_url).status_code, status.HTTP_200_OK)
        self.authenticate(self.recipient)
        self.assertEqual(self.client.get(attachment_url).status_code, status.HTTP_200_OK)

    def test_outsider_and_anonymous_user_cannot_access_private_attachment(self):
        message = InternalMessage.objects.create(
            sender=self.sender,
            recipient=self.recipient,
            content='Privé',
            attachment=self.image_attachment(),
        )
        url = f'/api/internal-messages/{message.id}/attachment/'
        self.authenticate(self.outsider)

        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(url).status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_broadcast_recipient_and_staff_can_access_attachment(self):
        message = InternalMessage.objects.create(
            sender=self.staff,
            recipient=None,
            content='Diffusion',
            attachment=self.image_attachment(),
        )
        url = f'/api/internal-messages/{message.id}/attachment/'
        self.authenticate(self.outsider)

        self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK)
        private_message = InternalMessage.objects.create(
            sender=self.sender,
            recipient=self.recipient,
            content='Privé',
            attachment=self.image_attachment('staff.png'),
        )
        self.authenticate(self.staff)
        self.assertEqual(
            self.client.get(f'/api/internal-messages/{private_message.id}/attachment/').status_code,
            status.HTTP_200_OK,
        )


class InternalMessagingPhase3FilteringTests(APITestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.settings_override = override_settings(MEDIA_ROOT=self.media_root)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.addCleanup(shutil.rmtree, self.media_root)
        self.sender = User.objects.create_user(username='phase3_sender', password='password')
        self.recipient = User.objects.create_user(username='phase3_recipient', password='password')
        self.outsider = User.objects.create_user(username='phase3_outsider', password='password')
        self.staff = User.objects.create_user(username='phase3_staff', password='password', is_staff=True)

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def results(self, response):
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data['results']

    def test_received_box_returns_received_messages_excluding_sent_and_archived(self):
        received = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Reçu direct')
        broadcast = InternalMessage.objects.create(sender=self.staff, recipient=None, content='Diffusion générale')
        sent = InternalMessage.objects.create(sender=self.recipient, recipient=self.sender, content='Envoyé par moi')
        archived = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Archivé')
        archived.archived_by.add(self.recipient)
        other = InternalMessage.objects.create(sender=self.sender, recipient=self.outsider, content='Autre destinataire')

        self.authenticate(self.recipient)
        response = self.client.get('/api/internal-messages/', {'box': 'received'})
        ids = {item['id'] for item in self.results(response)}

        self.assertEqual(ids, {received.id, broadcast.id})
        self.assertNotIn(sent.id, ids)
        self.assertNotIn(archived.id, ids)
        self.assertNotIn(other.id, ids)

    def test_sent_box_returns_only_own_messages(self):
        own = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Mon envoi')
        InternalMessage.objects.create(sender=self.recipient, recipient=self.sender, content='Réponse')

        self.authenticate(self.sender)
        response = self.client.get('/api/internal-messages/', {'box': 'sent'})
        ids = {item['id'] for item in self.results(response)}

        self.assertEqual(ids, {own.id})

    def test_archived_box_returns_only_messages_archived_by_me(self):
        archived = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='À archiver')
        archived.archived_by.add(self.recipient)
        InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Non archivé')
        archived_by_other = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Archivé par autrui')
        archived_by_other.archived_by.add(self.outsider)

        self.authenticate(self.recipient)
        response = self.client.get('/api/internal-messages/', {'box': 'archived'})
        ids = {item['id'] for item in self.results(response)}

        self.assertEqual(ids, {archived.id})

    def test_all_box_is_forbidden_for_non_staff(self):
        self.authenticate(self.sender)

        response = self.client.get('/api/internal-messages/', {'box': 'all'})

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_all_box_allowed_for_staff(self):
        m1 = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Privé 1')
        m2 = InternalMessage.objects.create(sender=self.recipient, recipient=self.outsider, content='Privé 2')

        self.authenticate(self.staff)
        response = self.client.get('/api/internal-messages/', {'box': 'all'})
        ids = {item['id'] for item in self.results(response)}

        self.assertEqual(ids, {m1.id, m2.id})

    def test_search_matches_content_sender_and_recipient_usernames(self):
        by_content = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Rapport stock pharmacie')
        by_sender = InternalMessage.objects.create(sender=self.staff, recipient=self.recipient, content='Note interne')
        by_recipient = InternalMessage.objects.create(sender=self.recipient, recipient=self.staff, content='Question')

        self.authenticate(self.recipient)
        response = self.client.get('/api/internal-messages/', {'box': 'received', 'search': 'pharmacie'})
        self.assertEqual({item['id'] for item in self.results(response)}, {by_content.id})

        response = self.client.get('/api/internal-messages/', {'box': 'received', 'search': 'phase3_staff'})
        self.assertEqual({item['id'] for item in self.results(response)}, {by_sender.id})

        self.authenticate(self.sender)
        response = self.client.get('/api/internal-messages/', {'box': 'sent', 'search': 'phase3_staff'})
        sent_ids = {item['id'] for item in self.results(response)}
        self.assertNotIn(by_content.id, sent_ids)

        self.authenticate(self.recipient)
        response = self.client.get('/api/internal-messages/', {'box': 'sent', 'search': 'phase3_staff'})
        self.assertEqual({item['id'] for item in self.results(response)}, {by_recipient.id})

    def test_has_attachment_filter(self):
        with_attachment = InternalMessage.objects.create(
            sender=self.sender,
            recipient=self.recipient,
            content='Avec fichier',
            attachment=SimpleUploadedFile('doc.pdf', b'%PDF-1.4\n%%EOF', content_type='application/pdf'),
        )
        without = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Sans fichier')

        self.authenticate(self.recipient)
        response = self.client.get('/api/internal-messages/', {'box': 'received', 'has_attachment': 'true'})
        self.assertEqual({item['id'] for item in self.results(response)}, {with_attachment.id})

        response = self.client.get('/api/internal-messages/', {'box': 'received', 'has_attachment': 'false'})
        self.assertEqual({item['id'] for item in self.results(response)}, {without.id})

    def test_unread_filter(self):
        unread_msg = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Non lu')
        read_msg = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Lu')
        read_msg.read_by.add(self.recipient)

        self.authenticate(self.recipient)
        response = self.client.get('/api/internal-messages/', {'box': 'received', 'unread': 'true'})
        self.assertEqual({item['id'] for item in self.results(response)}, {unread_msg.id})

        response = self.client.get('/api/internal-messages/', {'box': 'received', 'unread': 'false'})
        self.assertEqual({item['id'] for item in self.results(response)}, {read_msg.id})

    def test_pagination_multiple_pages_and_count(self):
        for index in range(25):
            InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content=f'Message {index}')

        self.authenticate(self.recipient)
        response = self.client.get('/api/internal-messages/', {'box': 'received', 'page_size': 10, 'page': 1})
        self.assertEqual(response.data['count'], 25)
        self.assertEqual(len(response.data['results']), 10)

        response = self.client.get('/api/internal-messages/', {'box': 'received', 'page_size': 10, 'page': 2})
        self.assertEqual(response.data['count'], 25)
        self.assertEqual(len(response.data['results']), 10)

        response = self.client.get('/api/internal-messages/', {'box': 'received', 'page_size': 10, 'page': 3})
        self.assertEqual(response.data['count'], 25)
        self.assertEqual(len(response.data['results']), 5)

    def test_results_are_ordered_by_created_at_descending(self):
        first = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Premier')
        second = InternalMessage.objects.create(sender=self.sender, recipient=self.recipient, content='Deuxième')

        self.authenticate(self.recipient)
        response = self.client.get('/api/internal-messages/', {'box': 'received'})
        ids = [item['id'] for item in self.results(response)]

        self.assertEqual(ids, [second.id, first.id])

    def test_filters_are_composable(self):
        target = InternalMessage.objects.create(
            sender=self.staff,
            recipient=self.recipient,
            content='Pharmacie rapport',
            attachment=SimpleUploadedFile('doc.pdf', b'%PDF-1.4\n%%EOF', content_type='application/pdf'),
        )
        InternalMessage.objects.create(sender=self.staff, recipient=self.recipient, content='Pharmacie sans fichier')
        read_msg = InternalMessage.objects.create(
            sender=self.staff,
            recipient=self.recipient,
            content='Pharmacie lu',
            attachment=SimpleUploadedFile('doc2.pdf', b'%PDF-1.4\n%%EOF', content_type='application/pdf'),
        )
        read_msg.read_by.add(self.recipient)

        self.authenticate(self.recipient)
        response = self.client.get(
            '/api/internal-messages/',
            {'box': 'received', 'search': 'pharmacie', 'has_attachment': 'true', 'unread': 'true'},
        )
        ids = {item['id'] for item in self.results(response)}

        self.assertEqual(ids, {target.id})
