# -*- coding: utf-8 -*-
"""
Feedback models: User feedback system
"""
from django.db import models
from django.contrib.auth.models import User

class Feedback(models.Model):
    """User feedback for the application."""
    
    class Category(models.TextChoices):
        BUG = 'BUG', 'Bug / Erreur'
        FEATURE = 'FEATURE', 'Nouvelle fonctionnalité'
        IMPROVEMENT = 'IMPROVEMENT', 'Amélioration'
        QUESTION = 'QUESTION', 'Question'
        OTHER = 'OTHER', 'Autre'
    
    class Priority(models.TextChoices):
        LOW = 'LOW', 'Faible'
        MEDIUM = 'MEDIUM', 'Moyenne'
        HIGH = 'HIGH', 'Haute'
        URGENT = 'URGENT', 'Urgente'
    
    class Status(models.TextChoices):
        NEW = 'NEW', 'Nouveau'
        IN_PROGRESS = 'IN_PROGRESS', 'En cours'
        RESOLVED = 'RESOLVED', 'Résolu'
        CLOSED = 'CLOSED', 'Fermé'
    
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='feedbacks')
    
    category = models.CharField(
        max_length=20, 
        choices=Category.choices, 
        default=Category.OTHER,
        help_text="Catégorie du feedback"
    )
    
    priority = models.CharField(
        max_length=20, 
        choices=Priority.choices, 
        default=Priority.MEDIUM,
        help_text="Priorité du feedback"
    )
    
    status = models.CharField(
        max_length=20, 
        choices=Status.choices, 
        default=Status.NEW,
        help_text="Statut du feedback"
    )
    
    subject = models.CharField(max_length=200, help_text="Sujet du feedback")
    description = models.TextField(help_text="Description détaillée du feedback")
    
    # Screenshot attachment
    screenshot = models.ImageField(
        upload_to='feedback/screenshots/', 
        null=True, 
        blank=True,
        help_text="Capture d'écran optionnelle"
    )
    
    # Context information
    page_url = models.CharField(max_length=500, blank=True, help_text="URL de la page concernée")
    browser_info = models.TextField(blank=True, help_text="Informations sur le navigateur")
    
    # Admin response
    admin_response = models.TextField(blank=True, help_text="Réponse de l'administrateur")
    responded_at = models.DateTimeField(null=True, blank=True)
    responded_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='responded_feedbacks'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Feedback"
        verbose_name_plural = "Feedbacks"
    
    def __str__(self):
        return f"{self.get_category_display()} - {self.subject}"
