from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User

from django.utils import timezone

from .models import (
    Client,
    Commande,
    CommandeProduit,
    DrugInteraction,
    FamilleRisque,
    Feedback,
    Forme,
    Fournisseur,
    Groupe,
    Produit,
    Profile,
    Rayon,
    Substance,
)
from .services.email_service import email_service


class CommandeProduitInline(admin.TabularInline):
    model = CommandeProduit
    extra = 1 # Nombre de lignes vides à afficher pour l'ajout

@admin.register(Commande)
class CommandeAdmin(admin.ModelAdmin):
    list_display = ('id', 'fournisseur', 'date', 'total')
    list_filter = ('date', 'fournisseur')
    inlines = [CommandeProduitInline]

@admin.register(Produit)
class ProduitAdmin(admin.ModelAdmin):
    list_display = ('name', 'rayon', 'fournisseur', 'stock', 'selling_price')
    list_filter = ('rayon', 'fournisseur')
    search_fields = ('name', 'description', 'cip1', 'cip2', 'cip3', 'cip4')


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = 'Profil'


class UserAdmin(BaseUserAdmin):
    inlines = (ProfileInline,)


admin.site.unregister(User)
admin.site.register(User, UserAdmin)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'is_terminal_account')
    list_filter = ('is_terminal_account', 'role')
    search_fields = ('user__username', 'user__first_name', 'user__last_name')


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ('subject', 'category', 'priority', 'status', 'user', 'created_at', 'responded_at')
    list_filter = ('status', 'category', 'priority', 'created_at')
    search_fields = ('subject', 'description', 'user__username', 'page_url')
    ordering = ('-created_at',)
    readonly_fields = (
        'user', 'page_url', 'browser_info', 'screenshot',
        'created_at', 'updated_at', 'responded_at', 'responded_by',
    )
    fieldsets = (
        (None, {
            'fields': ('user', 'category', 'priority', 'status', 'subject', 'description'),
        }),
        ('Contexte', {
            'fields': ('page_url', 'browser_info', 'screenshot'),
        }),
        ('Réponse', {
            'fields': ('admin_response', 'responded_at', 'responded_by'),
        }),
        ('Dates', {
            'fields': ('created_at', 'updated_at'),
        }),
    )

    def save_model(self, request, obj, form, change):
        response_written = change and 'admin_response' in form.changed_data and obj.admin_response
        if response_written:
            obj.responded_at = timezone.now()
            obj.responded_by = request.user
        super().save_model(request, obj, form, change)
        if response_written:
            email_service.send_feedback_response(obj)


# Enregistrement simple pour les autres modèles
admin.site.register(Rayon)
admin.site.register(Fournisseur)
admin.site.register(Client)
admin.site.register(CommandeProduit)
admin.site.register(Substance)
admin.site.register(DrugInteraction)
admin.site.register(Forme)
admin.site.register(Groupe)
admin.site.register(FamilleRisque)