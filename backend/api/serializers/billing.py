# -*- coding: utf-8 -*-
"""
Serializers pour la facturation, caisse et paiements.
"""
from rest_framework import serializers
from django.db.models import Sum
from decimal import Decimal
from ..models import (
    FactureProduitAllocation, FactureProduit, Caisse, ClotureCaisse,
    Facture,
)
from .clients import AyantDroitSerializer


class FactureProduitAllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = FactureProduitAllocation
        fields = '__all__'


class FactureProduitSerializer(serializers.ModelSerializer):
    produit_nom = serializers.SerializerMethodField()
    produit_cip = serializers.CharField(source='produit.cip1', read_only=True)
    produit_tva = serializers.DecimalField(source='produit.tva', max_digits=5, decimal_places=2, read_only=True)
    allocations = FactureProduitAllocationSerializer(many=True, read_only=True)
    cost_price = serializers.DecimalField(source='produit.cost_price', max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = FactureProduit
        fields = '__all__'

    def get_produit_nom(self, obj):
        return obj.produit_nom or (obj.produit.name if obj.produit else 'Produit inconnu')


class CaisseSerializer(serializers.ModelSerializer):
    facture_numero = serializers.CharField(source='facture.numero_facture', read_only=True)
    client_name = serializers.SerializerMethodField()

    class Meta:
        model = Caisse
        fields = '__all__'
        read_only_fields = ['date_paiement']

    def get_client_name(self, obj):
        if obj.facture:
            if obj.facture.client:
                return obj.facture.client.name
            return obj.facture.client_name_override or 'Client de passage'
        return 'N/A'


class ClotureCaisseSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = ClotureCaisse
        fields = '__all__'


class FactureSerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField()
    vendeur_name = serializers.SerializerMethodField()
    produits = FactureProduitSerializer(many=True, read_only=True)
    ayant_droit_details = AyantDroitSerializer(source='ayant_droit', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    total_ht = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_tva = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_ttc = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    is_remise_auto = serializers.SerializerMethodField()
    paiements = CaisseSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()
    validated_by_name = serializers.SerializerMethodField()
    montant_paye = serializers.SerializerMethodField()
    reste_a_payer = serializers.SerializerMethodField()

    class Meta:
        model = Facture
        fields = [
            'id', 'numero_facture', 'client', 'client_name', 'client_name_override',
            'client_phone', 'client_email', 'client_address', 'client_niu',
            'client_solde_depot', 'client_points_fidelite', 'client_type', 'client_is_deposit_enabled',
            'ayant_droit', 'ayant_droit_details',
            'date', 'date_document', 'status', 'status_display', 'produits',
            'total_ht', 'remise', 'tva', 'total_tva', 'total_ttc', 'notes',
            'vendeur_name', 'created_by_name', 'validated_by_name',
            'is_remise_auto', 'part_client', 'part_assurance',
            'created_by', 'validated_by',
            'montant_paye', 'reste_a_payer', 'paiements',
            'poste_caisse', 'is_gift', 'is_modification'
        ]

    def get_vendeur_name(self, obj):
        if obj.created_by:
            full = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return full or obj.created_by.username
        return 'Système'

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return 'Système'

    def get_validated_by_name(self, obj):
        if obj.validated_by:
            return obj.validated_by.get_full_name() or obj.validated_by.username
        return None

    def get_client_name(self, obj):
        if obj.client_name_override:
            return obj.client_name_override
        if obj.client:
            return obj.client.name
        return 'Client de passage'

    def get_montant_paye(self, obj):
        total = obj.paiements.filter(
            statut='completee'
        ).exclude(
            mode_paiement='en_compte'
        ).aggregate(
            total=Sum('montant')
        )['total']
        return total or Decimal('0.00')

    def get_reste_a_payer(self, obj):
        montant_paye = self.get_montant_paye(obj)
        return obj.total_ttc - montant_paye

    def get_is_remise_auto(self, obj):
        if not obj.remise or obj.remise <= 0:
            return False
        for fp in obj.produits.all():
            if fp.promotion_applied:
                return True
        return False


class FacturePrintSerializer(serializers.ModelSerializer):
    """Serializer optimisé pour l'impression de facture."""
    client = serializers.SerializerMethodField()
    vendeur_nom = serializers.SerializerMethodField()
    validated_by_name = serializers.SerializerMethodField()
    produits = FactureProduitSerializer(many=True, read_only=True)
    montant_recu = serializers.SerializerMethodField()
    montant_rendu = serializers.SerializerMethodField()
    mode_reglement = serializers.SerializerMethodField()
    tva_analysis = serializers.SerializerMethodField()
    total_lettres = serializers.SerializerMethodField()
    part_assurance = serializers.SerializerMethodField()
    ayant_droit_details = AyantDroitSerializer(source='ayant_droit', read_only=True)

    class Meta:
        model = Facture
        fields = [
            'id', 'numero_facture', 'date', 'status',
            'client', 'client_name_override', 'ayant_droit', 'ayant_droit_details',
            'total_ht', 'total_tva', 'total_ttc', 'remise',
            'vendeur_nom', 'validated_by_name', 'produits',
            'montant_recu', 'montant_rendu', 'mode_reglement',
            'tva_analysis', 'total_lettres', 'notes',
            'part_client', 'part_assurance'
        ]

    def get_client(self, obj):
        from .clients import ClientSerializer
        if obj.client:
            return ClientSerializer(obj.client).data
        return None

    def get_part_assurance(self, obj):
        if obj.part_client is not None:
            return obj.total_ttc - obj.part_client
        return Decimal('0.00')

    def get_vendeur_nom(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return 'Système'

    def get_validated_by_name(self, obj):
        if obj.validated_by:
            return f"{obj.validated_by.first_name} {obj.validated_by.last_name}".strip() or obj.validated_by.username
        return ''

    def get_montant_recu(self, obj):
        return sum(p.montant for p in obj.paiements.all())

    def get_montant_rendu(self, obj):
        return Decimal('0.00')

    def get_mode_reglement(self, obj):
        paiements = obj.paiements.all()
        if not paiements:
            return 'Non réglé'
        modes = set()
        for p in paiements:
            display = p.get_mode_paiement_display()
            if display:
                modes.add(str(display))
            elif p.mode_paiement:
                modes.add(str(p.mode_paiement))
            else:
                modes.add('Inconnu')
        return ', '.join(modes)

    def get_tva_analysis(self, obj):
        analysis = obj.get_tva_analysis()
        return [
            {
                'taux': str(taux),
                'base_ht': vals['base_ht'],
                'montant_tva': vals['montant_tva']
            }
            for taux, vals in analysis.items()
        ]

    def get_total_lettres(self, obj):
        try:
            from ..pdf_utils import number_to_french
            return number_to_french(int(obj.total_ttc))
        except Exception:
            return ''


class CreanceSerializer(serializers.ModelSerializer):
    """Serializer pour les créances (ventes en compte)"""
    client_name = serializers.SerializerMethodField()
    ayant_droit_details = AyantDroitSerializer(source='ayant_droit', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    total_ht = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_tva = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_ttc = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    montant_paye = serializers.SerializerMethodField()
    reste_a_payer = serializers.SerializerMethodField()
    _paiements = CaisseSerializer(many=True, read_only=True, source='paiements')

    class Meta:
        model = Facture
        fields = [
            'id', 'client', 'numero_facture', 'client_name',
            'ayant_droit_details', 'date', 'status_display',
            'total_ht', 'remise', 'tva', 'total_tva', 'total_ttc',
            'montant_paye', 'reste_a_payer', '_paiements', 'notes'
        ]

    def get_client_name(self, obj):
        if obj.client_name_override:
            return obj.client_name_override
        if obj.client:
            return obj.client.name
        return 'Client de passage'

    def get_montant_paye(self, obj):
        total = obj.paiements.filter(
            statut='completee'
        ).exclude(
            mode_paiement='en_compte'
        ).aggregate(
            total=Sum('montant')
        )['total']
        return total or Decimal('0.00')

    def get_reste_a_payer(self, obj):
        montant_paye = self.get_montant_paye(obj)
        return obj.total_ttc - montant_paye
