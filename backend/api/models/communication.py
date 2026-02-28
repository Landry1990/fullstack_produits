# -*- coding: utf-8 -*-
"""
Communication models: SMS Logs, Templates, etc.
"""
from django.db import models
from django.contrib.auth.models import User

class SmsLog(models.Model):
    """Log des SMS envoyés."""
    class Type(models.TextChoices):
        PROMIS = 'PROMIS', 'Disponibilité Promis'
        RAPPEL = 'RAPPEL', 'Rappel Prise'
        MANUEL = 'MANUEL', 'Envoi Manuel'
        MARKETING = 'MARKETING', 'Marketing'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'En attente'
        SENT = 'SENT', 'Envoyé'
        FAILED = 'FAILED', 'Échec'
        DELIVERED = 'DELIVERED', 'Reçu'

    recipient_number = models.CharField(max_length=20, help_text="Numéro de téléphone du destinataire")
    recipient_name = models.CharField(max_length=100, blank=True, help_text="Nom du destinataire")
    message = models.TextField(help_text="Contenu du SMS")
    
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.MANUEL)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    
    provider_id = models.CharField(max_length=100, blank=True, null=True, help_text="ID renvoyé par le fournisseur SMS")
    provider_response = models.TextField(blank=True, null=True, help_text="Réponse brute du fournisseur (JSON)")
    
    # Context links
    promis = models.ForeignKey('Promis', on_delete=models.SET_NULL, null=True, blank=True, related_name='sms_logs')
    client = models.ForeignKey('Client', on_delete=models.SET_NULL, null=True, blank=True, related_name='sms_logs')
    
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    
    sent_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Journal SMS"
        verbose_name_plural = "Journal SMS"

    def __str__(self):
        return f"SMS à {self.recipient_name or self.recipient_number} ({self.get_status_display()})"


class SmsTemplate(models.Model):
    """Modèles de messages SMS pré-définis."""
    name = models.CharField(max_length=100, unique=True, help_text="Nom du template (ex: 'Promis Dispo')")
    content = models.TextField(help_text="Contenu avec variables (ex: 'Bonjour {name}, votre {product} est arrivé.')")
    is_active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = "Modèle SMS"
        verbose_name_plural = "Modèles SMS"

    def __str__(self):
        return self.name


class WhatsAppLog(models.Model):
    """Log des messages WhatsApp envoyés."""
    class Type(models.TextChoices):
        FACTURE = 'FACTURE', 'Envoi Facture'
        PROMIS = 'PROMIS', 'Disponibilité Promis'
        MANUEL = 'MANUEL', 'Envoi Manuel'
        RAPPEL = 'RAPPEL', 'Rappel Paiement'
        RENOUVELLEMENT = 'RENOUVELLEMENT', 'Renouvellement Traitement'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'En attente'
        SENT = 'SENT', 'Envoyé'
        FAILED = 'FAILED', 'Échec'
        DELIVERED = 'DELIVERED', 'Reçu'
        READ = 'READ', 'Lu'

    recipient_number = models.CharField(max_length=20)
    recipient_name = models.CharField(max_length=100, blank=True)
    message = models.TextField()
    
    # Attachment info
    has_attachment = models.BooleanField(default=False)
    attachment_path = models.CharField(max_length=255, blank=True, null=True)
    
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.FACTURE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    
    provider_id = models.CharField(max_length=100, blank=True, null=True)
    provider_response = models.TextField(blank=True, null=True)
    
    facture = models.ForeignKey('Facture', on_delete=models.SET_NULL, null=True, blank=True, related_name='whatsapp_logs')
    client = models.ForeignKey('Client', on_delete=models.SET_NULL, null=True, blank=True, related_name='whatsapp_logs')
    
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    sent_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Journal WhatsApp"
        verbose_name_plural = "Journal WhatsApp"

    def __str__(self):
        return f"WhatsApp à {self.recipient_name or self.recipient_number} ({self.get_status_display()})"
