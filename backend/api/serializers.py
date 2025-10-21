from rest_framework import serializers
from .models import (
    Produit, Rayon, Fournisseur, Client, Commande, CommandeProduit, Facture, FactureProduit
)

class ProduitSerializer(serializers.ModelSerializer):
    # Pour un affichage plus clair, on utilise le nom des objets liés.
    # C'est en lecture seule.
    rayon_name = serializers.CharField(source='rayon.name', read_only=True)
    fournisseur_name = serializers.CharField(source='fournisseur.name', read_only=True)

    # Pour la création/mise à jour, on attend les IDs.
    # 'source' pointe vers le champ du modèle, 'queryset' valide l'entrée.
    rayon = serializers.PrimaryKeyRelatedField(
        queryset=Rayon.objects.all(), write_only=True, required=False, allow_null=True
    )
    fournisseur = serializers.PrimaryKeyRelatedField(
        queryset=Fournisseur.objects.all(), write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = Produit
        # On liste explicitement les champs pour la sécurité et la clarté.
        fields = [
            'id', 'name', 'description', 'stock', 'cip1', 'cip2', 'cip3',
            'cost_price', 'selling_price', 'expire_date', 'stock_alert',
            'stock_minimum', 'stock_maximum', 'created_at', 'updated_at',
            'rayon', 'fournisseur', 'rayon_name', 'fournisseur_name'
        ]

class RayonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rayon
        fields = ['id', 'name']

class FournisseurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fournisseur
        fields = ['id', 'name', 'address', 'phone', 'email']

class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ['id', 'name', 'address', 'phone', 'email']


class CommandeProduitSerializer(serializers.ModelSerializer):
    # On imbrique le serializer du produit pour avoir tous les détails du produit
    # au lieu de juste son ID. C'est en lecture seule (read_only=True).
    # Le champ 'produit' correspond au champ du modèle.
    produit = ProduitSerializer(read_only=True)
    commande_date = serializers.DateTimeField(source='commande.date', read_only=True)
    fournisseur_name = serializers.CharField(source='commande.fournisseur.name', read_only=True)
    # Pour permettre la création/mise à jour, on ajoute un champ pour l'ID.
    produit_id = serializers.PrimaryKeyRelatedField(
        queryset=Produit.objects.all(), source='produit', write_only=True
    )
    selling_price = serializers.DecimalField(max_digits=10, decimal_places=2, write_only=True, required=False)

    class Meta:
        model = CommandeProduit
        fields = [
            'id', 'commande', 'commande_date', 'fournisseur_name',
            'produit', 'produit_id', 'quantity', 'price', 'price_cost', 'lot', 'date_expiration',
            'selling_price'
        ]

class CommandeSerializer(serializers.ModelSerializer):
    # On imbrique les lignes de commande pour les voir directement avec la commande.
    produits = CommandeProduitSerializer(many=True, read_only=True)
    # On définit 'total' comme un champ en lecture seule qui utilise la propriété du modèle.
    # Il sera calculé automatiquement et inclus dans les réponses GET, mais ne sera pas
    # attendu dans les requêtes POST ou PUT.
    total = serializers.ReadOnlyField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Commande
        fields = ['id', 'fournisseur', 'numero_facture', 'date', 'status', 'status_display', 'total', 'produits']


class FactureProduitSerializer(serializers.ModelSerializer):
    # On imbrique le serializer du produit pour avoir tous les détails du produit
    produit = ProduitSerializer(read_only=True)
    # Pour permettre la création/mise à jour, on ajoute un champ pour l'ID.
    produit_id = serializers.PrimaryKeyRelatedField(
        queryset=Produit.objects.all(), source='produit', write_only=True
    )

    class Meta:
        model = FactureProduit
        fields = [
            'id', 'produit', 'produit_id', 'quantity', 'selling_price', 'lot', 'date_expiration'
        ]


class FactureSerializer(serializers.ModelSerializer):
    # On imbrique les lignes de facture pour les voir directement avec la facture.
    produits = FactureProduitSerializer(many=True, read_only=True)
    # On définit les totaux comme des champs en lecture seule qui utilisent les propriétés du modèle.
    total_ht = serializers.ReadOnlyField()
    total_tva = serializers.ReadOnlyField()
    total_ttc = serializers.ReadOnlyField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    client_name = serializers.CharField(source='client.name', read_only=True)

    class Meta:
        model = Facture
        fields = [
            'id', 'client', 'client_name', 'numero_facture', 'date', 'status', 'status_display',
            'remise', 'tva', 'notes', 'total_ht', 'total_tva', 'total_ttc', 'produits'
        ]