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
    Ordonnancier, LigneOrdonnancier, PharmacySettings, CouponMonnaie,
    Groupe, SmsLog, SmsTemplate, PaiementFournisseur, ConfigurationOption
)

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = [
            'allowed_menus', 'can_do_returns', 'can_sell_negative_stock', 'can_cash_out', 'role',
            'can_delete_product', 'can_adjust_stock', 'can_delete_fournisseur', 'can_delete_commande', 'can_close_commande',
            'can_generate_coupon', 'can_modify_price', 'max_discount_rate'
        ]

class InvoiceSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceSettings
        fields = '__all__'

class LoyaltySettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltySetting
        fields = '__all__'


class PharmacySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PharmacySettings
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
            profile.can_cash_out = profile_data.get('can_cash_out', True)
            profile.can_delete_product = profile_data.get('can_delete_product', False)
            profile.can_adjust_stock = profile_data.get('can_adjust_stock', False)
            profile.can_delete_fournisseur = profile_data.get('can_delete_fournisseur', False)
            profile.can_delete_commande = profile_data.get('can_delete_commande', False)
            profile.can_close_commande = profile_data.get('can_close_commande', False)
            profile.can_generate_coupon = profile_data.get('can_generate_coupon', False)
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
            profile.can_delete_product = profile_data.get('can_delete_product', profile.can_delete_product)
            profile.can_adjust_stock = profile_data.get('can_adjust_stock', profile.can_adjust_stock)
            profile.can_delete_fournisseur = profile_data.get('can_delete_fournisseur', profile.can_delete_fournisseur)
            profile.can_delete_commande = profile_data.get('can_delete_commande', profile.can_delete_commande)
            profile.can_close_commande = profile_data.get('can_close_commande', profile.can_close_commande)
            profile.can_generate_coupon = profile_data.get('can_generate_coupon', profile.can_generate_coupon)
            profile.can_modify_price = profile_data.get('can_modify_price', profile.can_modify_price)
            profile.max_discount_rate = profile_data.get('max_discount_rate', profile.max_discount_rate)
            profile.role = profile_data.get('role', profile.role)
            profile.save()
            
        return instance

class RayonSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True)

    class Meta:
        model = Rayon
        fields = '__all__'

class FournisseurSerializer(serializers.ModelSerializer):
    solde_dette = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    
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

class GroupeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Groupe
        fields = ['id', 'nom', 'description']

class PaiementFournisseurSerializer(serializers.ModelSerializer):
    fournisseur_name = serializers.CharField(source='fournisseur.name', read_only=True)
    commande_numero = serializers.CharField(source='commande.numero_facture', read_only=True, allow_null=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = PaiementFournisseur
        fields = '__all__'

class ProduitSerializer(serializers.ModelSerializer):
    rayon_nom = serializers.CharField(source='rayon.name', read_only=True)
    fournisseur_nom = serializers.CharField(source='fournisseur.name', read_only=True)
    forme_nom = serializers.CharField(source='forme.nom', read_only=True)
    groupe_nom = serializers.CharField(source='groupe.nom', read_only=True)
    famille_risque_nom = serializers.CharField(source='famille_risque.nom', read_only=True)
    famille_risque_niveau = serializers.CharField(source='famille_risque.niveau_risque', read_only=True)
    stock = serializers.IntegerField(read_only=True)
    valeur_stock = serializers.SerializerMethodField()
    next_expiring_date = serializers.SerializerMethodField()
    stock_lots = serializers.SerializerMethodField()

    class Meta:
        model = Produit
        fields = [
            'id', 'rayon', 'rayon_nom', 'fournisseur', 'fournisseur_nom', 'forme', 'forme_nom',
            'groupe', 'groupe_nom', 'famille_risque', 'famille_risque_nom', 'famille_risque_niveau',
            'name', 'description', 
            'stock', 'stock_alert', 'cip1', 'cip2', 'cip3',
            'cost_price', 'selling_price', 'expire_date', 
            'valeur_stock', 'tva', 'use_lot_management', 'next_expiring_date',
            'stock_lots', 'requires_prescription', 'surveillance_category',
            'dernier_achat', 'dernier_vente', 'is_public',
            'taux_marge', 'pourcentage_marge', 'is_supplier_exclusive'
        ]
        read_only_fields = ['created_at', 'updated_at', 'taux_marge', 'pourcentage_marge']

    def get_valeur_stock(self, obj):
        # Calcul de la valeur totale du stock pour ce produit
        # Si gestion par lot, somme des valeurs des lots
        if obj.use_lot_management:
            from django.db.models import F, DecimalField
            total_value = obj.stock_lots.aggregate(
                total=Sum(F('quantity_remaining') * F('price_cost'), output_field=DecimalField())
            )['total']
            return total_value if total_value is not None else Decimal('0.00')
        # Sinon, stock * prix d'achat
        return obj.stock * obj.cost_price if obj.stock is not None and obj.cost_price is not None else Decimal('0.00')

    def get_stock_lots(self, obj):
        if obj.use_lot_management:
            # Retourne les lots avec stock > 0, triés par date d'expiration
            return StockLotSerializer(obj.stock_lots.filter(quantity_remaining__gt=0).order_by('date_expiration'), many=True).data
        return []

    def get_next_expiring_date(self, obj):
        """
        Retourne la date d'expiration la plus proche :
        1. Soit celle définie directement sur le produit (si produit simple)
        2. Soit celle du lot qui expire le plus tôt (si gestion par lot)
        """
        # Priorité à la date directe si présente (produit simple) ou gestion hybride
        direct_date = obj.expire_date
        
        # Si gestion par lots, chercher le lot le plus proche ayant du stock
        # Note: On pourrait aussi regarder TOUS les lots (même stock 0 ?) -> Non, seulement stock dispo pertinent
        min_lot_date = None
        if obj.use_lot_management:
            # On utilise related_name par defaut 'stocklot_set' ou on suppose 'stock_lots' ?
            # Verifions le model StockLot, il a un FK vers Produit.
            # L'accès inverse est 'stock_lots' (défini dans models.py).
            lot = obj.stock_lots.filter(
                quantity_remaining__gt=0, 
                date_expiration__isnull=False
            ).order_by('date_expiration').first()
            
            if lot:
                min_lot_date = lot.date_expiration
        
        # Logique de fusion : prendre le plus urgent des deux (ou celui qui existe)
        if direct_date and min_lot_date:
            return min(direct_date, min_lot_date)
        return direct_date or min_lot_date

class CommandeProduitSerializer(serializers.ModelSerializer):
    produit_nom = serializers.SerializerMethodField()
    produit_stock = serializers.IntegerField(source='produit.stock', read_only=True)
    produit_rotation_moyenne = serializers.CharField(source='produit.rotation_moyenne', read_only=True)
    produit_cip = serializers.CharField(source='produit.cip1', read_only=True)
    commande_date = serializers.DateTimeField(source='commande.date', read_only=True)
    fournisseur_name = serializers.SerializerMethodField()
    total_quantity = serializers.IntegerField(read_only=True)
    effective_cost = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = CommandeProduit
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'total_quantity', 'effective_cost']

    def get_produit_nom(self, obj):
        return obj.produit.name if obj.produit else obj.produit_nom

    def get_fournisseur_name(self, obj):
        if obj.commande.fournisseur:
            return obj.commande.fournisseur.name
        return obj.commande.fournisseur_nom

class CommandeSerializer(serializers.ModelSerializer):
    fournisseur_nom = serializers.SerializerMethodField()
    produits = CommandeProduitSerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Commande
        fields = '__all__'
        read_only_fields = ['date', 'status']
        extra_kwargs = {
            'fournisseur': {
                'required': True,
                'allow_null': False,
                'error_messages': {
                    'required': 'Le fournisseur est obligatoire pour créer une commande.',
                    'null': 'Le fournisseur ne peut pas être vide.'
                }
            }
        }

    def get_fournisseur_nom(self, obj):
        return obj.fournisseur.name if obj.fournisseur else obj.fournisseur_nom

    def create(self, validated_data):
        # Auto-save fournisseur_nom as backup when fournisseur is linked
        fournisseur = validated_data.get('fournisseur')
        if fournisseur and not validated_data.get('fournisseur_nom'):
            validated_data['fournisseur_nom'] = fournisseur.name
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Auto-update fournisseur_nom when fournisseur changes
        fournisseur = validated_data.get('fournisseur', instance.fournisseur)
        if fournisseur:
            validated_data['fournisseur_nom'] = fournisseur.name
        return super().update(instance, validated_data)

class FactureProduitSerializer(serializers.ModelSerializer):
    produit_nom = serializers.SerializerMethodField()
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

    def get_produit_nom(self, obj):
        return obj.produit.name if obj.produit else obj.produit_nom

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
    produit_nom = serializers.SerializerMethodField()
    fournisseur_nom = serializers.SerializerMethodField()
    
    class Meta:
        model = StockLot
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def get_produit_nom(self, obj):
        return obj.produit.name if obj.produit else obj.produit_nom

    def get_fournisseur_nom(self, obj):
        return obj.fournisseur.name if obj.fournisseur else obj.fournisseur_nom


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
    produit_nom = serializers.SerializerMethodField()
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

    def get_produit_nom(self, obj):
        return obj.produit.name if obj.produit else obj.produit_nom

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
    produit_nom = serializers.SerializerMethodField()
    produit_cip = serializers.CharField(source='produit.cip1', read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    lot_numero = serializers.CharField(source='stock_lot.lot', read_only=True, allow_null=True)
    lot_expiration = serializers.DateField(source='stock_lot.date_expiration', read_only=True, allow_null=True)
    lot_quantity_remaining = serializers.IntegerField(source='stock_lot.quantity_remaining', read_only=True, allow_null=True)
    
    class Meta:
        model = LigneAvoir
        fields = '__all__'
        read_only_fields = ['total']

    def get_produit_nom(self, obj):
        return obj.produit.name if obj.produit else obj.produit_nom


class AvoirSerializer(serializers.ModelSerializer):
    produits = LigneAvoirSerializer(many=True, read_only=True)
    fournisseur_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    total_ht = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    type_avoir_display = serializers.CharField(source='get_type_avoir_display', read_only=True)
    
    class Meta:
        model = Avoir
        fields = '__all__'
        read_only_fields = ['numero', 'date', 'created_at', 'updated_at', 'total_ht']

    def get_fournisseur_name(self, obj):
        return obj.fournisseur.name if obj.fournisseur else obj.fournisseur_nom
    
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
    produit_nom = serializers.SerializerMethodField()

    class Meta:
        model = MouvementStock
        fields = '__all__'

    def get_produit_nom(self, obj):
        return obj.produit.name if obj.produit else obj.produit_nom

class HistoriqueTransformationSerializer(serializers.ModelSerializer):
    user_nom = serializers.CharField(source='user.username', read_only=True)
    produit_source_nom = serializers.SerializerMethodField()
    produit_destination_nom = serializers.SerializerMethodField()
    
    class Meta:
        model = HistoriqueTransformation
        fields = '__all__'
    
    def get_produit_source_nom(self, obj):
        return obj.produit_source.name if obj.produit_source else obj.produit_source_nom

    def get_produit_destination_nom(self, obj):
        return obj.produit_destination.name if obj.produit_destination else obj.produit_destination_nom

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
    produit_name = serializers.SerializerMethodField()
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
    
    def get_produit_name(self, obj):
        return obj.produit.name if obj.produit else obj.produit_nom
    
    def get_user_name(self, obj):
        if obj.user:
            full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return full_name or obj.user.username
        return ''


class PromisSerializer(serializers.ModelSerializer):
    client_display = serializers.CharField(read_only=True)
    client_phone_display = serializers.CharField(read_only=True)
    produit_name = serializers.SerializerMethodField()
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

    def get_produit_name(self, obj):
        return obj.produit.name if obj.produit else obj.produit_nom



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


class FacturePrintSerializer(serializers.ModelSerializer):
    """
    Serializer optimisé pour l'impression de facture.
    Retourne TOUTES les informations nécessaires pour le rendu frontend.
    """
    client = ClientSerializer(read_only=True)
    vendeur_nom = serializers.SerializerMethodField()
    produits = FactureProduitSerializer(many=True, read_only=True)
    montant_recu = serializers.SerializerMethodField()
    montant_rendu = serializers.SerializerMethodField()
    mode_reglement = serializers.SerializerMethodField()
    tva_analysis = serializers.SerializerMethodField()
    total_lettres = serializers.SerializerMethodField()

    class Meta:
        model = Facture
        fields = [
            'id', 'numero_facture', 'date', 'status',
            'client', 'client_name_override', 
            'total_ht', 'total_tva', 'total_ttc', 'remise',
            'vendeur_nom', 'produits',
            'montant_recu', 'montant_rendu', 'mode_reglement',
            'tva_analysis', 'total_lettres', 'notes'
        ]

    def get_vendeur_nom(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return "Système"

    def get_montant_recu(self, obj):
        # Somme des paiements
        total = sum(p.montant for p in obj.paiements.all())
        return total

    def get_montant_rendu(self, obj):
        # Pour l'instant on ne stocke pas explicitement la monnaie rendue, 
        # mais on peut le déduire si on avait le montant versé vs montant dû.
        # Ici on retourne 0 ou on pourrait ajouter un champ au modèle Caisse.
        # Pour l'instant on retourne 0.
        return Decimal('0.00')

    def get_mode_reglement(self, obj):
        paiements = obj.paiements.all()
        if not paiements:
            return "Non réglé"
        modes = set(p.get_mode_paiement_display() for p in paiements)
        return ", ".join(modes)

    def get_tva_analysis(self, obj):
        """
        Calcule la répartition par taux de TVA.
        Utilise la méthode centralisée du modèle et formate pour JSON.
        """
        analysis = obj.get_tva_analysis()
        return [
            {
                'taux': str(taux), # Convert key to string if it's Decimal
                'base_ht': vals['base_ht'],
                'montant_tva': vals['montant_tva']
            }
            for taux, vals in analysis.items()
        ]

    def get_total_lettres(self, obj):
        # TODO: Implémenter la conversion chiffres -> lettres si besoin
        # Pour l'instant on retourne une chaîne vide ou on utilise une lib
        return ""


class CouponMonnaieSerializer(serializers.ModelSerializer):
    """Serializer pour les coupons de monnaie (bons de reste)."""
    cree_par_nom = serializers.SerializerMethodField()
    utilise_par_nom = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = CouponMonnaie
        fields = [
            'id', 'numero', 'montant', 'status', 'status_display',
            'date_creation', 'date_utilisation',
            'cree_par', 'cree_par_nom', 'utilise_par', 'utilise_par_nom',
            'facture_origine', 'facture_utilisation', 'notes'
        ]
        read_only_fields = ['id', 'numero', 'date_creation', 'date_utilisation']
    
    def get_cree_par_nom(self, obj):
        if obj.cree_par:
            full_name = f"{obj.cree_par.first_name} {obj.cree_par.last_name}".strip()
            return full_name or obj.cree_par.username
        return ''
    
    def get_utilise_par_nom(self, obj):
        if obj.utilise_par:
            full_name = f"{obj.utilise_par.first_name} {obj.utilise_par.last_name}".strip()
            return full_name or obj.utilise_par.username
        return ''


# Communication Serializers
class SmsTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SmsTemplate
        fields = '__all__'

class SmsLogSerializer(serializers.ModelSerializer):
    sent_by_name = serializers.CharField(source='sent_by.username', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    client_name = serializers.CharField(source='client.name', read_only=True)
    promis_detail = serializers.SerializerMethodField()

    class Meta:
        model = SmsLog
        fields = '__all__'
        read_only_fields = ['status', 'sent_at', 'provider_response', 'sent_by']

    def get_promis_detail(self, obj):
        if obj.promis:
            return f"{obj.promis.produit_name} ({obj.promis.quantite})"
        return None


class ConfigurationOptionSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    
    class Meta:
        model = ConfigurationOption
        fields = '__all__'
