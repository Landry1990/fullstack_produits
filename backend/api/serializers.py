from rest_framework import serializers
from django.contrib.auth.models import User
from django.db.models import Sum
from decimal import Decimal
from .models import (
    Produit, Rayon, Fournisseur, Client, Commande, 
    CommandeProduit, Facture, FactureProduit, Caisse, Profile,
    StockLot, FactureProduitAllocation, AyantDroit, ClotureCaisse,
    Inventaire, LigneInventaire, MouvementCaisse, Avoir, LigneAvoir,
    RelationTransformation, HistoriqueTransformation, MouvementStock,
    InvoiceSettings, AuditLog, Promis, LoyaltySetting, StockAdjustment,
    Ordonnancier, LigneOrdonnancier
)

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['allowed_menus', 'can_do_returns', 'can_sell_negative_stock', 'can_cash_out', 'role']

class InvoiceSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceSettings
        fields = '__all__'

class LoyaltySettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltySetting
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(required=False)
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_superuser', 'password', 'profile']

    def create(self, validated_data):
        profile_data = validated_data.pop('profile', {})
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        
        # Profile is created by signal, update it
        if profile_data:
            profile = user.profile
            profile.allowed_menus = profile_data.get('allowed_menus', [])
            profile.can_do_returns = profile_data.get('can_do_returns', False)
            profile.can_sell_negative_stock = profile_data.get('can_sell_negative_stock', False)
            profile.can_cash_out = profile_data.get('can_cash_out', True) # Default to True for now
            profile.role = profile_data.get('role', 'VENDEUR')
            profile.save()
            
        return user

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})
        password = validated_data.pop('password', None)
        
        instance.username = validated_data.get('username', instance.username)
        instance.email = validated_data.get('email', instance.email)
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        
        if password:
            instance.set_password(password)
            
        instance.save()

        if profile_data:
            profile = instance.profile
            profile.allowed_menus = profile_data.get('allowed_menus', profile.allowed_menus)
            profile.can_do_returns = profile_data.get('can_do_returns', profile.can_do_returns)
            profile.can_sell_negative_stock = profile_data.get('can_sell_negative_stock', profile.can_sell_negative_stock)
            profile.can_cash_out = profile_data.get('can_cash_out', profile.can_cash_out)
            profile.role = profile_data.get('role', profile.role)
            profile.save()
            
        return instance

class RayonSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True)

    class Meta:
        model = Rayon
        fields = '__all__'

class FournisseurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fournisseur
        fields = '__all__'

from django.db import transaction

# ... (imports)

class AyantDroitSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all(), required=False)
    
    class Meta:
        model = AyantDroit
        fields = ['id', 'client', 'matricule', 'nom', 'societe', 'date_creation']


class ClientSerializer(serializers.ModelSerializer):
    ayants_droit = AyantDroitSerializer(many=True, required=False)
    current_debt = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Client
        fields = '__all__'

    @transaction.atomic
    def create(self, validated_data):
        ayants_droit_data = validated_data.pop('ayants_droit', [])
        client = Client.objects.create(**validated_data)
        for ad_data in ayants_droit_data:
            AyantDroit.objects.create(client=client, **ad_data)
        return client

    @transaction.atomic
    def update(self, instance, validated_data):
        ayants_droit_data = validated_data.pop('ayants_droit', None)
        
        # Mise à jour des champs du client
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Mise à jour des ayants droit si fournis
        if ayants_droit_data is not None:
            # IDs des ayants droit reçus (ceux qui ont un ID)
            incoming_ids = [item['id'] for item in ayants_droit_data if 'id' in item]
            
            # Supprimer ceux qui ne sont pas dans la liste reçue
            instance.ayants_droit.exclude(id__in=incoming_ids).delete()
            
            # Mettre à jour ou créer
            for ad_data in ayants_droit_data:
                ad_id = ad_data.get('id')
                if ad_id:
                    ad = AyantDroit.objects.get(id=ad_id, client=instance)
                    ad.matricule = ad_data.get('matricule', ad.matricule)
                    ad.nom = ad_data.get('nom', ad.nom)
                    ad.societe = ad_data.get('societe', ad.societe)
                    ad.save()
                else:
                    AyantDroit.objects.create(client=instance, **ad_data)
                    
        return instance

class ProduitSerializer(serializers.ModelSerializer):
    rayon_name = serializers.CharField(source='rayon.name', read_only=True)
    fournisseur_name = serializers.CharField(source='fournisseur.name', read_only=True)

    class Meta:
        model = Produit
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'taux_marge', 'pourcentage_marge']

class CommandeProduitSerializer(serializers.ModelSerializer):
    produit_nom = serializers.CharField(source='produit.name', read_only=True)
    produit_stock = serializers.IntegerField(source='produit.stock', read_only=True)
    produit_rotation_moyenne = serializers.CharField(source='produit.rotation_moyenne', read_only=True)
    commande_date = serializers.DateTimeField(source='commande.date', read_only=True)
    fournisseur_name = serializers.CharField(source='commande.fournisseur.name', read_only=True)
    total_quantity = serializers.IntegerField(read_only=True)
    effective_cost = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = CommandeProduit
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'total_quantity', 'effective_cost']

class CommandeSerializer(serializers.ModelSerializer):
    fournisseur_nom = serializers.CharField(source='fournisseur.name', read_only=True)
    produits = CommandeProduitSerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Commande
        fields = '__all__'
        read_only_fields = ['date', 'status']

class FactureProduitSerializer(serializers.ModelSerializer):
    produit_nom = serializers.CharField(source='produit.name', read_only=True)
    # Champ pour l'écriture : on envoie stock_lot_id depuis le frontend
    # Le source='stock_lot' permet d'écrire dans le champ stock_lot du modèle
    stock_lot_id = serializers.PrimaryKeyRelatedField(
        queryset=StockLot.objects.all(), source='stock_lot', write_only=True, required=False, allow_null=True
    )
    # Champ pour la lecture : retourner l'ID du lot dans les réponses
    stock_lot = serializers.PrimaryKeyRelatedField(read_only=True)
    
    # Champs détails facture pour les rapports/listes
    facture_numero = serializers.CharField(source='facture.numero_facture', read_only=True)
    facture_date = serializers.DateTimeField(source='facture.date', read_only=True)

    class Meta:
        model = FactureProduit
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

class CaisseSerializer(serializers.ModelSerializer):
    user_details = serializers.SerializerMethodField()
    client_name = serializers.SerializerMethodField()
    facture_numero = serializers.CharField(source='facture.numero_facture', read_only=True)
    mode_paiement_display = serializers.CharField(source='get_mode_paiement_display', read_only=True)
    is_creance_settlement = serializers.SerializerMethodField()
    
    releve_reference = serializers.CharField(source='releve.reference', read_only=True)
    releve_id = serializers.IntegerField(source='releve.id', read_only=True)
    
    class Meta:
        model = Caisse
        fields = '__all__'
        read_only_fields = ['date_paiement']
    
    def get_user_details(self, obj):
        if obj.user:
            full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return {
                'id': obj.user.id,
                'username': obj.user.username,
                'full_name': full_name or obj.user.username
            }
        return None
    
    def get_client_name(self, obj):
        if obj.facture.client:
            return obj.facture.client.name
        elif obj.facture.client_name_override:
            return obj.facture.client_name_override
        return "Client de passage"
    
    def get_is_creance_settlement(self, obj):
        """
        Détermine si ce paiement est un règlement de créance.
        Un règlement de créance = paiement sur une facture qui a un paiement initial 'en_compte'
        et le paiement actuel n'est pas 'en_compte' lui-même.
        """
        if obj.mode_paiement == 'en_compte':
            return False
        return obj.facture.paiements.filter(mode_paiement='en_compte').exists()

class FactureSerializer(serializers.ModelSerializer):
    client_nom = serializers.SerializerMethodField()
    client_name = serializers.SerializerMethodField()
    produits = FactureProduitSerializer(many=True, read_only=True)
    ayant_droit_details = AyantDroitSerializer(source='ayant_droit', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    total_ht = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_tva = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_ttc = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    is_remise_auto = serializers.SerializerMethodField()
    paiements = CaisseSerializer(many=True, read_only=True)

    def get_client_nom(self, obj):
        if obj.client:
            return obj.client.name
        return obj.client_name_override or "Client de passage"
    
    def get_client_name(self, obj):
        if obj.client:
            return obj.client.name
        return obj.client_name_override or "Client de passage"
    
    def get_is_remise_auto(self, obj):
        """Indique si la facture a potentiellement bénéficié d'une remise automatique"""
        # Vérifier si le client existe
        if not obj.client:
            return False
        
        # Vérifier si le client a une remise automatique configurée
        try:
            remise_auto = getattr(obj.client, 'remise_automatique', 0) or 0
        except AttributeError:
            return False
        
        # Si le client n'a pas de remise automatique configurée, retourner False
        if remise_auto == 0:
            return False
        
        # Si la facture a une remise > 0, on considère que c'est une remise automatique
        # (simplifié - on pourrait vérifier le pourcentage exact mais avec les arrondis c'est complexe)
        return obj.remise and obj.remise > 0

    class Meta:
        model = Facture
        fields = [
            'id', 'numero_facture', 'client', 'client_name', 'client_nom', 'client_name_override', 
            'ayant_droit', 'ayant_droit_details',
            'date', 'status', 'status_display', 'produits', 
            'total_ht', 'remise', 'tva', 'total_tva', 'total_ttc', 'notes',
            'points_fidelite_gagnes', 'points_fidelite_utilises', 'montant_fidelite',
            'is_remise_auto', 'part_client', 'paiements'
        ]

class StockLotSerializer(serializers.ModelSerializer):
    """Serializer pour les lots de stock avec traçabilité fournisseur"""
    produit_nom = serializers.CharField(source='produit.name', read_only=True)
    fournisseur_nom = serializers.CharField(source='fournisseur.name', read_only=True)
    
    class Meta:
        model = StockLot
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class FactureProduitAllocationSerializer(serializers.ModelSerializer):
    """Serializer pour les allocations de vente (traçabilité FIFO)"""
    fournisseur_nom = serializers.CharField(source='stock_lot.fournisseur.name', read_only=True)
    lot_numero = serializers.CharField(source='stock_lot.lot', read_only=True)
    margin = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    revenue = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = FactureProduitAllocation
        fields = '__all__'
        read_only_fields = ['created_at']

class ClotureCaisseSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    username = serializers.CharField(source='user.username', read_only=True, default='')
    
    class Meta:
        model = ClotureCaisse
        fields = '__all__'
        read_only_fields = ['date']

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return 'N/A'

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
    paiements = CaisseSerializer(many=True, read_only=True)
    
    class Meta:
        model = Facture
        fields = [
            'id', 'numero_facture', 'client', 'client_name', 'client_name_override',
            'ayant_droit', 'ayant_droit_details', 'date', 'status', 'status_display',
            'total_ht', 'remise', 'tva', 'total_tva', 'total_ttc',
            'montant_paye', 'reste_a_payer', 'paiements', 'notes'
        ]
    
    def get_client_name(self, obj):
        if obj.client:
            return obj.client.name
        return obj.client_name_override or "Client de passage"
    
    def get_montant_paye(self, obj):
        """Calcule le montant total payé (paiements réels uniquement, hors 'en_compte')"""
        total = obj.paiements.filter(
            statut='completee'
        ).exclude(
            mode_paiement='en_compte'
        ).aggregate(
            total=Sum('montant')
        )['total']
        return total or Decimal('0.00')
    
    def get_reste_a_payer(self, obj):
        """Calcule le reste à payer"""
        montant_paye = self.get_montant_paye(obj)
        return obj.total_ttc - montant_paye

class LigneInventaireSerializer(serializers.ModelSerializer):
    produit_nom = serializers.CharField(source='produit.name', read_only=True)
    produit_cip = serializers.CharField(source='produit.cip1', read_only=True)
    produit_rayon = serializers.CharField(source='produit.rayon.name', read_only=True)
    produit_description = serializers.CharField(source='produit.description', read_only=True)
    produit_cost_price = serializers.DecimalField(source='produit.cost_price', max_digits=10, decimal_places=2, read_only=True)
    produit_pmp = serializers.DecimalField(source='produit.pmp', max_digits=10, decimal_places=2, read_only=True)
    
    # Champs pour la gestion des lots
    lot_numero = serializers.CharField(source='stock_lot.lot', read_only=True, allow_null=True)
    lot_expiration = serializers.DateField(source='stock_lot.date_expiration', read_only=True, allow_null=True)
    lot_quantity_remaining = serializers.IntegerField(source='stock_lot.quantity_remaining', read_only=True, allow_null=True)
    
    class Meta:
        model = LigneInventaire
        fields = '__all__'

class InventaireSerializer(serializers.ModelSerializer):
    lignes = LigneInventaireSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    
    total_valeur_theorique = serializers.SerializerMethodField()
    total_valeur_physique = serializers.SerializerMethodField()
    total_ecart_valeur = serializers.SerializerMethodField()
    
    class Meta:
        model = Inventaire
        fields = '__all__'

    def get_total_valeur_theorique(self, obj):
        return sum(
            (ligne.stock_theorique * (ligne.pmp_snapshot or ligne.produit.cost_price or 0))
            for ligne in obj.lignes.all()
        )

    def get_total_valeur_physique(self, obj):
        return sum(
            (ligne.quantite_physique * (ligne.pmp_snapshot or ligne.produit.cost_price or 0))
            for ligne in obj.lignes.all()
        )

    def get_total_ecart_valeur(self, obj):
        return sum(
            (ligne.ecart * (ligne.pmp_snapshot or ligne.produit.cost_price or 0))
            for ligne in obj.lignes.all()
        )
        fields = '__all__'

class MouvementCaisseSerializer(serializers.ModelSerializer):
    user_nom = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = MouvementCaisse
        fields = '__all__'
        read_only_fields = ['date']
class LigneAvoirSerializer(serializers.ModelSerializer):
    produit_nom = serializers.CharField(source='produit.name', read_only=True)
    produit_cip = serializers.CharField(source='produit.cip1', read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    lot_numero = serializers.CharField(source='stock_lot.lot', read_only=True, allow_null=True)
    lot_expiration = serializers.DateField(source='stock_lot.date_expiration', read_only=True, allow_null=True)
    lot_quantity_remaining = serializers.IntegerField(source='stock_lot.quantity_remaining', read_only=True, allow_null=True)
    
    class Meta:
        model = LigneAvoir
        fields = '__all__'
        read_only_fields = ['total']


class AvoirSerializer(serializers.ModelSerializer):
    produits = LigneAvoirSerializer(many=True, read_only=True)
    fournisseur_name = serializers.CharField(source='fournisseur.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    total_ht = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    type_avoir_display = serializers.CharField(source='get_type_avoir_display', read_only=True)
    
    class Meta:
        model = Avoir
        fields = '__all__'
        read_only_fields = ['numero', 'date', 'created_at', 'updated_at', 'total_ht']
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return ''


class RelationTransformationSerializer(serializers.ModelSerializer):
    produit_source_nom = serializers.CharField(source='produit_source.name', read_only=True)
    produit_destination_nom = serializers.CharField(source='produit_destination.name', read_only=True)
    
    class Meta:
        model = RelationTransformation
        fields = '__all__'

class MouvementStockSerializer(serializers.ModelSerializer):
    user_nom = serializers.CharField(source='user.username', read_only=True)
    produit_nom = serializers.CharField(source='produit.name', read_only=True)

    class Meta:
        model = MouvementStock
        fields = '__all__'

class HistoriqueTransformationSerializer(serializers.ModelSerializer):
    user_nom = serializers.CharField(source='user.username', read_only=True)
    produit_source_nom = serializers.CharField(source='produit_source.name', read_only=True)
    produit_destination_nom = serializers.CharField(source='produit_destination.name', read_only=True)
    
    class Meta:
        model = HistoriqueTransformation
        fields = '__all__'

class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = ['id', 'user', 'user_name', 'action', 'action_display', 'model_name', 
                  'object_id', 'description', 'details', 'ip_address', 'timestamp']
    
    def get_user_name(self, obj):
        if obj.user:
            full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return full_name or obj.user.username
        return 'Système'


class StockAdjustmentSerializer(serializers.ModelSerializer):
    """Serializer pour les ajustements de stock avec traçabilité"""
    user_name = serializers.SerializerMethodField()
    username = serializers.CharField(source='user.username', read_only=True)
    produit_name = serializers.CharField(source='produit.name', read_only=True)
    produit_cip = serializers.CharField(source='produit.cip1', read_only=True)
    reason_type_display = serializers.CharField(source='get_reason_type_display', read_only=True)
    lot_number = serializers.CharField(source='stock_lot.lot', read_only=True, allow_null=True)
    
    class Meta:
        model = StockAdjustment
        fields = [
            'id', 'produit', 'produit_name', 'produit_cip', 
            'stock_lot', 'lot_number',
            'user', 'user_name', 'username',
            'quantity_before', 'quantity_after', 'quantity_change',
            'reason_type', 'reason_type_display', 'reason_detail',
            'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'quantity_change']
    
    def get_user_name(self, obj):
        if obj.user:
            full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return full_name or obj.user.username
        return ''


class PromisSerializer(serializers.ModelSerializer):
    client_display = serializers.CharField(read_only=True)
    client_phone_display = serializers.CharField(read_only=True)
    produit_name = serializers.CharField(read_only=True)
    produit_cip = serializers.CharField(source='produit.cip1', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    facture_numero = serializers.CharField(source='facture.numero_facture', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Promis
        fields = [
            'id', 'facture', 'facture_numero', 'client', 'client_name', 'client_phone',
            'client_display', 'client_phone_display', 'produit', 'produit_name', 'produit_cip',
            'quantite', 'status', 'status_display', 'date_promis', 'date_livraison',
            'notes', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['date_promis', 'date_livraison', 'created_by']



class LigneOrdonnancierSerializer(serializers.ModelSerializer):
    """Serializer pour une ligne de l'ordonnancier (un médicament)"""
    produit_name = serializers.CharField(source='produit.name', read_only=True, allow_null=True)
    ordonnancier = serializers.PrimaryKeyRelatedField(read_only=True) # Read-only for nested creation
    
    class Meta:
        model = LigneOrdonnancier
        fields = ['id', 'ordonnancier', 'produit', 'produit_name', 'produit_nom', 
                  'quantite', 'surveillance_category']


class OrdonnancierSerializer(serializers.ModelSerializer):
    """Serializer pour l'ordonnancier (registre des ordonnances)"""
    lignes = LigneOrdonnancierSerializer(many=True, read_only=True)
    enregistre_par_nom = serializers.SerializerMethodField()
    facture_numero = serializers.CharField(source='facture.numero_facture', read_only=True, allow_null=True)
    
    class Meta:
        model = Ordonnancier
        fields = ['numero_ordre', 'date_delivrance', 'patient_nom', 'prescripteur_nom', 
                  'facture', 'facture_numero', 'lignes', 'enregistre_par', 
                  'enregistre_par_nom', 'created_at']
        read_only_fields = ['numero_ordre', 'created_at']
    
    def get_enregistre_par_nom(self, obj):
        if obj.enregistre_par:
            full_name = f"{obj.enregistre_par.first_name} {obj.enregistre_par.last_name}".strip()
            return full_name or obj.enregistre_par.username
        return ''


class OrdonnancierCreateSerializer(serializers.ModelSerializer):
    """Serializer pour la création d'une entrée d'ordonnancier"""
    lignes = LigneOrdonnancierSerializer(many=True, required=False)
    
    class Meta:
        model = Ordonnancier
        fields = ['patient_nom', 'prescripteur_nom', 'facture', 'lignes']
    
    def validate(self, data):
        print("=== DEBUG ORDONNANCE VALIDATION ===")
        print(f"Data received: {data}")
        return data
    
    def create(self, validated_data):
        lignes_data = validated_data.pop('lignes', [])
        ordonnancier = Ordonnancier.objects.create(**validated_data)
        
        for ligne_data in lignes_data:
            LigneOrdonnancier.objects.create(ordonnancier=ordonnancier, **ligne_data)
        
        return ordonnancier
