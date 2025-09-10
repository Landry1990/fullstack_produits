from django.contrib import admin
from .models import (
    Produit,
    Rayon,
    Fournisseur,
    Client,
    Commande,
    CommandeProduit
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

# Enregistrement simple pour les autres modèles
admin.site.register(Rayon)
admin.site.register(Fournisseur)
admin.site.register(Client)
admin.site.register(CommandeProduit)