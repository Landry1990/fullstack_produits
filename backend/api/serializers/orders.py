# -*- coding: utf-8 -*-
"""
Serializers pour les commandes, fournisseurs et paiements.
"""
from rest_framework import serializers
from django.db.models import Sum, Q
from decimal import Decimal
from ..models import (
    Fournisseur, Commande, CommandeProduit, PaiementFournisseur, OrderSchedule,
)


class FournisseurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fournisseur
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class PaiementFournisseurSerializer(serializers.ModelSerializer):
    fournisseur_name = serializers.CharField(source='fournisseur.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    commande_numero = serializers.CharField(source='commande.numero_facture', read_only=True, allow_null=True)
    # Accepter une liste d'IDs pour relier plusieurs commandes lors du pointage global
    commande_ids = serializers.PrimaryKeyRelatedField(
        queryset=Commande.objects.all(),
        many=True,
        write_only=True,
        required=False
    )
    # Afficher les numéros des factures liées
    commandes_liees = serializers.SerializerMethodField()

    class Meta:
        model = PaiementFournisseur
        fields = '__all__'

    def get_commandes_liees(self, obj):
        # Retourne une liste de numéros de factures pour un affichage facile
        return [c.numero_facture or f"CMD-{c.id}" for c in obj.commandes.all()]

    def create(self, validated_data):
        commande_ids = validated_data.pop('commande_ids', [])
        paiement = super().create(validated_data)
        if commande_ids:
            paiement.commandes.set(commande_ids)
        return paiement


class CommandeProduitSerializer(serializers.ModelSerializer):
    produit_nom = serializers.SerializerMethodField()
    produit_stock = serializers.SerializerMethodField()
    produit_stock_apres_reception = serializers.IntegerField(source='stock_apres_reception', read_only=True)
    produit_rotation_moyenne = serializers.SerializerMethodField()
    produit_cip = serializers.SerializerMethodField()

    # Nouveaux champs pour l'aide à la décision
    produit_dernier_achat = serializers.SerializerMethodField()
    produit_dernier_vente = serializers.SerializerMethodField()
    produit_stock_minimum = serializers.SerializerMethodField()
    produit_stock_maximum = serializers.SerializerMethodField()
    produit_stock_alert = serializers.SerializerMethodField()
    produit_cost_price = serializers.SerializerMethodField()

    commande_date = serializers.DateTimeField(source='commande.date', read_only=True)
    fournisseur_name = serializers.SerializerMethodField()
    total_quantity = serializers.IntegerField(read_only=True)
    effective_cost = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = CommandeProduit
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'total_quantity', 'effective_cost', 'stock_apres_reception']

    def validate(self, data):
        # Allow instance prices if not provided in data
        price_cost = data.get('price_cost')
        selling_price = data.get('selling_price')

        # If updating partial, fallback to existing
        if self.instance:
            if price_cost is None:
                price_cost = self.instance.price_cost
            if selling_price is None:
                selling_price = self.instance.selling_price

        # Final validation
        if price_cost is not None and price_cost < 0:
            raise serializers.ValidationError({"price_cost": "Le prix d'achat ne peut pas être négatif."})
        if selling_price is not None and selling_price < 0:
            raise serializers.ValidationError({"selling_price": "Le prix de vente ne peut pas être négatif."})

        return data

    def to_representation(self, instance):
        repr = super().to_representation(instance)

        # Retro-compatibilité pour l'affichage (si le lot n'est pas sur la ligne de commande mais dans StockLot)
        # Ceci corrige les anciennes commandes et compense le bug d'écrasement des lots par auto-save
        if not repr.get('lot') and instance.commande and instance.commande.status == 'CLOT':
            # Utilisation des objets pré-chargés pour éviter les requêtes N+1
            lots = list(instance.stock_lot.all())
            lot = lots[0] if lots else None
            if lot:
                repr['lot'] = lot.lot
                repr['date_expiration'] = lot.date_expiration.isoformat() if lot.date_expiration else None

        return repr

    def get_produit_nom(self, obj):
        if obj.produit:
            return obj.produit.name
        if obj.produit_nom:
            return f"{obj.produit_nom} (supprimé)"
        return "Produit inconnu (supprimé)"

    def get_produit_stock(self, obj):
        return obj.produit.total_stock if obj.produit else 0

    def get_produit_rotation_moyenne(self, obj):
        return obj.produit.rotation_moyenne if obj.produit else 0

    def get_produit_cip(self, obj):
        return obj.produit.cip1 if obj.produit else None

    def get_produit_dernier_achat(self, obj):
        return obj.produit.dernier_achat if obj.produit else None

    def get_produit_dernier_vente(self, obj):
        return obj.produit.dernier_vente if obj.produit else None

    def get_produit_stock_minimum(self, obj):
        return obj.produit.stock_minimum if obj.produit else 0

    def get_produit_stock_maximum(self, obj):
        return obj.produit.stock_maximum if obj.produit else 0

    def get_produit_stock_alert(self, obj):
        return obj.produit.stock_alert if obj.produit else 0

    def get_produit_cost_price(self, obj):
        return obj.produit.cost_price if obj.produit else None

    def get_fournisseur_name(self, obj):
        if obj.commande.fournisseur:
            return obj.commande.fournisseur.name
        return obj.commande.fournisseur_nom


class CommandeSerializer(serializers.ModelSerializer):
    fournisseur_nom = serializers.SerializerMethodField()
    produits = CommandeProduitSerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_ht = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_tva = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_ttc = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    closed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Commande
        fields = '__all__'
        # Supprimé 'status' des champs en lecture seule pour permettre les transitions PREP <-> ATT
        read_only_fields = ['date', 'closed_by', 'is_active']
        extra_kwargs = {
            'fournisseur': {
                'required': False,
                'allow_null': True,
                'error_messages': {
                    'null': 'Le fournisseur ne peut pas être vide.'
                }
            }
        }

    def get_fournisseur_nom(self, obj):
        if obj.fournisseur:
            return obj.fournisseur.name
        return obj.fournisseur_nom

    def get_closed_by_name(self, obj):
        if obj.closed_by:
            return obj.closed_by.get_full_name() or obj.closed_by.username
        return None

    def validate_status(self, value):
        """
        Le statut CLOT doit être géré par l'action dédiée /cloturer/.
        """
        # On autorise les transitions vers PREP ou ATT
        if value == Commande.Status.CLOTUREE:
            raise serializers.ValidationError(
                "Le statut 'Clôturée' ne peut pas être défini manuellement. "
                "Utilisez l'action de clôture dédiée."
            )
        return value


class OrderScheduleSerializer(serializers.ModelSerializer):
    fournisseur_name = serializers.CharField(source='fournisseur.name', read_only=True)

    class Meta:
        model = OrderSchedule
        fields = '__all__'

    def validate_start_date(self, value):
        """Valider que la date de début n'est pas dans le passé."""
        from datetime import date
        if value < date.today():
            raise serializers.ValidationError("La date de début ne peut pas être dans le passé.")
        return value

    def validate(self, data):
        """Valider que la date de fin est après la date de début."""
        if data.get('end_date') and data.get('start_date'):
            if data['end_date'] < data['start_date']:
                raise serializers.ValidationError("La date de fin doit être après la date de début.")
        return data
