from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import (
    Produit,
    Rayon,
    Fournisseur,
    Client,
    Commande,
    Commande,
    CommandeProduit,
    Substance,
    DrugInteraction,
    Forme,
    Groupe,
    FamilleRisque,
    Profile
)

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
    search_fields = ('name', 'description', 'cip1', 'cip2', 'cip3')


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