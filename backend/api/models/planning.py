# -*- coding: utf-8 -*-
"""
Planning des opérateurs : quarts, gardes, repos, congés.
"""
from django.db import models
from django.contrib.auth.models import User


class ShiftConfig(models.Model):
    """Configuration des règles de rotation des quarts."""
    work_days_before_rest = models.PositiveIntegerField(
        default=5, verbose_name="Jours de travail avant repos"
    )
    rest_days = models.PositiveIntegerField(
        default=2, verbose_name="Jours de repos"
    )
    rotate_shifts = models.BooleanField(
        default=True, verbose_name="Rotation matin/nuit"
    )
    guard_frequency_days = models.PositiveIntegerField(
        default=7, verbose_name="Fréquence des gardes (jours)"
    )
    morning_start = models.CharField(
        max_length=5, default="08:00", verbose_name="Début quart matin"
    )
    morning_end = models.CharField(
        max_length=5, default="16:00", verbose_name="Fin quart matin"
    )
    night_start = models.CharField(
        max_length=5, default="16:00", verbose_name="Début quart nuit"
    )
    night_end = models.CharField(
        max_length=5, default="22:00", verbose_name="Fin quart nuit"
    )
    annual_leave_days = models.PositiveIntegerField(
        default=26, verbose_name="Jours de congé annuel"
    )

    class Meta:
        verbose_name = "Configuration des quarts"
        verbose_name_plural = "Configurations des quarts"

    def __str__(self):
        return f"Config ({self.work_days_before_rest}j travail / {self.rest_days}j repos)"


class ShiftSchedule(models.Model):
    """Planning mensuel d'un mois donné."""
    month = models.DateField(verbose_name="Mois (1er jour)")
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_schedules'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_published = models.BooleanField(
        default=False, verbose_name="Publié (visible par les opérateurs)"
    )

    class Meta:
        verbose_name = "Planning mensuel"
        verbose_name_plural = "Plannings mensuels"
        unique_together = ('month',)
        ordering = ['-month']

    def __str__(self):
        return f"Planning {self.month.strftime('%m/%Y')}"


class ShiftAssignment(models.Model):
    """Affectation d'un opérateur à un quart pour un jour donné."""
    SHIFT_TYPES = [
        ('MATIN', 'Matin'),
        ('NUIT', 'Nuit'),
        ('GARDE', 'Garde'),
        ('REPOS', 'Repos'),
        ('CONGE', 'Congé'),
    ]
    schedule = models.ForeignKey(
        ShiftSchedule, on_delete=models.CASCADE, related_name='assignments'
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='shift_assignments'
    )
    date = models.DateField()
    shift_type = models.CharField(max_length=10, choices=SHIFT_TYPES)
    notes = models.TextField(blank=True, default='')

    class Meta:
        verbose_name = "Affectation"
        verbose_name_plural = "Affectations"
        unique_together = ('schedule', 'user', 'date')
        ordering = ['date', 'user__username']

    def __str__(self):
        return f"{self.user.username} - {self.date} - {self.shift_type}"


class LeaveRequest(models.Model):
    """Demande de congé ou absence."""
    LEAVE_TYPES = [
        ('CONGE', 'Congé payé'),
        ('MALADIE', 'Maladie'),
        ('SANS_SOLDE', 'Sans solde'),
        ('AUTRE', 'Autre'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'En attente'),
        ('APPROVED', 'Approuvé'),
        ('REJECTED', 'Refusé'),
    ]
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='leave_requests'
    )
    start_date = models.DateField(verbose_name="Date de début")
    end_date = models.DateField(verbose_name="Date de fin")
    leave_type = models.CharField(
        max_length=10, choices=LEAVE_TYPES, default='CONGE'
    )
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default='PENDING'
    )
    notes = models.TextField(blank=True, default='')
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approved_leaves'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Demande de congé"
        verbose_name_plural = "Demandes de congé"
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.user.username} - {self.start_date} → {self.end_date} ({self.leave_type})"

    @property
    def days_count(self):
        """Nombre de jours de congé (inclusif)."""
        if self.start_date and self.end_date:
            return (self.end_date - self.start_date).days + 1
        return 0
