from rest_framework import serializers
from django.contrib.auth.models import User
from django.db.models import Sum, Q
from decimal import Decimal
from .models import (
    Produit, Rayon, Fournisseur, Client, Commande, 
    CommandeProduit, Facture, FactureProduit, Caisse, Profile,
    StockLot, FactureProduitAllocation, AyantDroit, ClotureCaisse,
    Inventaire, LigneInventaire, MouvementCaisse, Avoir, LigneAvoir,
    RelationTransformation, HistoriqueTransformation, MouvementStock,
    InvoiceSettings, AuditLog, Promis, LoyaltySetting, StockAdjustment,
    Ordonnancier, LigneOrdonnancier, PharmacySettings, CouponMonnaie,
    Groupe, SmsLog, SmsTemplate, PaiementFournisseur, ConfigurationOption,
    Promotion, PromotionPackItem, ObjectifCommercial, ConfigurationObjectifs, TVA,
    WhatsAppLog, TelegramLog, RuptureFournisseur, DepotClient, InternalMessage, MessageTemplate,
    ReapproSession, PosteCaisse, OrderSchedule,
    CompteComptable, JournalComptable, EcritureComptable, LigneEcriture, ExerciceComptable
)
from .services import PromotionService
from .pdf_utils import number_to_french

class PromotionPackItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    class Meta:
        model = PromotionPackItem
        fields = ['product', 'product_name', 'quantity']

class PromotionSerializer(serializers.ModelSerializer):
    """Serializer pour la gestion des promotions"""
    # OPTIMISATION: Utilise les annotations SQL au lieu de requêtes N+1 (.count)
    products_count = serializers.IntegerField(read_only=True)  # From annotation
    rayons_count = serializers.IntegerField(read_only=True)      # From annotation
    discount_type_display = serializers.CharField(source='get_discount_type_display', read_only=True)
    pack_items = PromotionPackItemSerializer(many=True, required=False)
    
    class Meta:
        model = Promotion
        fields = '__all__'

class ConfigurationObjectifsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfigurationObjectifs
        fields = '__all__'

    def create(self, validated_data):
        return ConfigurationObjectifs.objects.get_or_create(pk=1)[0]
        
    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class PromotionSerializer(serializers.ModelSerializer):
    """Serializer pour la gestion des promotions"""
    # OPTIMISATION: Utilise les annotations SQL au lieu de requêtes N+1 (.count)
    products_count = serializers.IntegerField(read_only=True)  # From annotation
    rayons_count = serializers.IntegerField(read_only=True)      # From annotation
    discount_type_display = serializers.CharField(source='get_discount_type_display', read_only=True)
    pack_items = PromotionPackItemSerializer(many=True, required=False)
    
    class Meta:
        model = Promotion
        fields = '__all__'
        read_only_fields = ['is_active', 'created_at', 'updated_at']

    def create(self, validated_data):
        pack_items_data = validated_data.pop('pack_items', [])
        products = validated_data.pop('products', [])
        rayons = validated_data.pop('rayons', [])
        
        promotion = Promotion.objects.create(**validated_data)
        
        if products:
            promotion.products.set(products)
        if rayons:
            promotion.rayons.set(rayons)
            
        for item in pack_items_data:
            PromotionPackItem.objects.create(promotion=promotion, **item)
            
        return promotion

    def update(self, instance, validated_data):
        pack_items_data = validated_data.pop('pack_items', None)
        products = validated_data.pop('products', None)
        rayons = validated_data.pop('rayons', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if products is not None:
            instance.products.set(products)
        if rayons is not None:
            instance.rayons.set(rayons)
            
        if pack_items_data is not None:
            instance.pack_items.all().delete()
            for item in pack_items_data:
                PromotionPackItem.objects.create(promotion=instance, **item)
                
        return instance

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = [
            'allowed_menus', 'can_do_returns', 'can_sell_negative_stock', 'can_cash_out', 'role',
            'can_delete_product', 'can_adjust_stock', 'can_delete_fournisseur', 'can_delete_commande', 'can_close_commande',
            'can_modify_price', 'max_discount_rate', 'can_cancel_invoice', 'can_modify_invoice',
            'can_cancel_promis', 'can_manage_perimes', 'can_manage_avoirs', 'can_validate_zero_amount'
        ]

class InvoiceSettingsSerializer(serializers.ModelSerializer):
    company_name = serializers.SerializerMethodField()

    class Meta:
        model = InvoiceSettings
        fields = '__all__'

    def get_company_name(self, obj):
        from .utils_licence import valider_licence_systeme
        valide, msg, payload = valider_licence_systeme()
        if valide and payload and payload.get('pharmacie_nom'):
            return payload.get('pharmacie_nom')
        return obj.company_name

class LoyaltySettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltySetting
        fields = '__all__'
        read_only_fields = ['points_earned', 'points_spent', 'current_points']


class PharmacySettingsSerializer(serializers.ModelSerializer):
    pharmacy_name = serializers.SerializerMethodField()

    class Meta:
        model = PharmacySettings
        fields = '__all__'

    def get_pharmacy_name(self, obj):
        from .utils_licence import valider_licence_systeme
        valide, msg, payload = valider_licence_systeme()
        if valide and payload and payload.get('pharmacie_nom'):
            return payload.get('pharmacie_nom')
        return obj.pharmacy_name

class PosteCaisseSerializer(serializers.ModelSerializer):
    ouvert_par_name = serializers.CharField(source='ouvert_par.username', read_only=True)
    
    class Meta:
        model = PosteCaisse
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

class TVASerializer(serializers.ModelSerializer):
    class Meta:
        model = TVA
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(required=False)
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_superuser', 'is_active', 'password', 'profile']
        read_only_fields = ['is_superuser']

    def create(self, validated_data):
        profile_data = validated_data.pop('profile', {})
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError({'password': 'Ce champ est obligatoire.'})

        request = self.context.get('request')
        if not (request and request.user and request.user.is_superuser):
            validated_data.pop('is_superuser', None)
            validated_data.pop('is_staff', None)

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
            profile.can_cancel_invoice = profile_data.get('can_cancel_invoice', False)
            profile.can_modify_invoice = profile_data.get('can_modify_invoice', False)
            profile.can_cancel_promis = profile_data.get('can_cancel_promis', False)
            profile.can_manage_perimes = profile_data.get('can_manage_perimes', False)
            profile.can_manage_avoirs = profile_data.get('can_manage_avoirs', False)
            profile.can_validate_zero_amount = profile_data.get('can_validate_zero_amount', False)
            profile.role = profile_data.get('role', 'VENDEUR')
            profile.save()
            
        return user

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})
        password = validated_data.pop('password', None)

        request = self.context.get('request')
        if not (request and request.user and request.user.is_superuser):
            validated_data.pop('is_superuser', None)
            validated_data.pop('is_staff', None)
        
        instance.username = validated_data.get('username', instance.username)
        instance.email = validated_data.get('email', instance.email)
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.is_active = validated_data.get('is_active', instance.is_active)
        
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
            profile.can_cancel_invoice = profile_data.get('can_cancel_invoice', profile.can_cancel_invoice)
            profile.can_modify_invoice = profile_data.get('can_modify_invoice', profile.can_modify_invoice)
            profile.can_cancel_promis = profile_data.get('can_cancel_promis', profile.can_cancel_promis)
            profile.can_manage_perimes = profile_data.get('can_manage_perimes', profile.can_manage_perimes)
            profile.can_manage_avoirs = profile_data.get('can_manage_avoirs', profile.can_manage_avoirs)
            profile.can_modify_price = profile_data.get('can_modify_price', profile.can_modify_price)
            profile.can_validate_zero_amount = profile_data.get('can_validate_zero_amount', profile.can_validate_zero_amount)
            profile.max_discount_rate = profile_data.get('max_discount_rate', profile.max_discount_rate)
            profile.role = profile_data.get('role', profile.role)
            profile.save()
            
        return instance

class RayonSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True)

    class Meta:
        model = Rayon
        fields = '__all__'
        read_only_fields = ['is_active', 'created_at', 'updated_at']

class FournisseurSerializer(serializers.ModelSerializer):
    solde_dette = serializers.SerializerMethodField()
    
    class Meta:
        model = Fournisseur
        fields = '__all__'
        read_only_fields = ['is_active', 'created_at', 'updated_at']

    def get_solde_dette(self, obj):
        solde = getattr(obj, 'solde_dette_annotated', None)
        if solde is not None:
            return solde
        return obj.solde_dette

from django.db import transaction

class DepotClientSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    facture_numero = serializers.CharField(source='facture.numero_facture', read_only=True)

    class Meta:
        model = DepotClient
        fields = '__all__'
        read_only_fields = ['date', 'created_by']

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
        read_only_fields = ['is_active', 'created_at', 'updated_at', 'solde_depot', 'points_fidelite', 'pending_discount']

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
        
        # Si on désactive la fidélité, on remet les points à zéro
        new_is_loyalty = validated_data.get('is_loyalty_member', instance.is_loyalty_member)
        if instance.is_loyalty_member and not new_is_loyalty:
            instance.points_fidelite = 0

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

class ProduitSerializer(serializers.ModelSerializer):
    rayon_nom = serializers.CharField(source='rayon.name', read_only=True)
    fournisseur_nom = serializers.CharField(source='fournisseur.name', read_only=True)
    forme_nom = serializers.CharField(source='forme.nom', read_only=True)
    groupe_nom = serializers.CharField(source='groupe.nom', read_only=True)
    famille_risque_nom = serializers.CharField(source='famille_risque.nom', read_only=True)
    famille_risque_niveau = serializers.CharField(source='famille_risque.niveau_risque', read_only=True)
    stock = serializers.IntegerField(read_only=True)
    # OPTIMISATION: Utilise les annotations SQL au lieu de requêtes N+1
    valeur_stock = serializers.DecimalField(
        source='valeur_stock_calc', 
        max_digits=15, 
        decimal_places=2, 
        read_only=True,
        allow_null=True
    )
    next_expiring_date = serializers.DateField(
        source='next_expiring_calc',
        read_only=True,
        allow_null=True
    )
    stock_lots = serializers.SerializerMethodField()
    active_promotion = serializers.SerializerMethodField()

    class Meta:
        model = Produit
        fields = [
            'id', 'rayon', 'rayon_nom', 'fournisseur', 'fournisseur_nom', 'forme', 'forme_nom',
            'groupe', 'groupe_nom', 'famille_risque', 'famille_risque_nom', 'famille_risque_niveau',
            'name', 'description', 'message_alerte',
            'stock', 'total_stock', 'stock_alert', 'cip1', 'cip2', 'cip3',
            'cost_price', 'selling_price', 'expire_date', 
            'valeur_stock', 'tva', 'use_lot_management', 'next_expiring_date',
            'stock_lots', 'requires_prescription', 'surveillance_category',
            'dernier_achat', 'dernier_vente', 'is_public',
            'taux_marge', 'pourcentage_marge', 'is_supplier_exclusive',
            'active_promotion', 'is_chronic', 'default_treatment_days',
            'stock_reserve', 'has_reserve_storage', 'capacite_rayon', 'min_rayon',
            'stock_minimum', 'stock_maximum', 'is_active', 'blocking_alerte'
        ]
        read_only_fields = ['created_at', 'updated_at', 'taux_marge', 'pourcentage_marge', 'total_stock']

    def validate(self, data):
        """
        Validations croisées pour le produit.
        """
        is_supplier_exclusive = data.get('is_supplier_exclusive', self.instance.is_supplier_exclusive if self.instance else False)
        fournisseur = data.get('fournisseur', self.instance.fournisseur if self.instance else None)

        if is_supplier_exclusive and not fournisseur:
            raise serializers.ValidationError({
                "is_supplier_exclusive": "Un produit ne peut être exclusif sans fournisseur attribué."
            })
        
        return data

    def get_stock_lots(self, obj):
        """
        Retourne les lots actifs. 
        OPTIMISATION: Utilise le prefetch 'active_lots' si disponible, sinon fallback sur requête.
        """
        try:
            if not obj.use_lot_management:
                return []
            
            # Si le prefetch a été fait, utiliser l'attribut préchargé
            if hasattr(obj, 'active_lots'):
                return StockLotSerializer(obj.active_lots, many=True).data
            
            # Fallback: requête seulement si nécessaire (pour les vues sans prefetch)
            lots = obj.stock_lots.filter(quantity_remaining__gt=0).order_by('date_expiration')
            return StockLotSerializer(lots, many=True).data
        except Exception:
            return []

    def get_active_promotion(self, obj):
        """
        Retourne la meilleure promotion active.
        OPTIMISATION: Vérifie d'abord si les promos sont préchargées.
        """
        try:
            # Si les promos sont préchargées via prefetch_related
            if hasattr(obj, '_prefetched_objects_cache') and 'promotions' in obj._prefetched_objects_cache:
                from datetime import date
                today = date.today()
                active_promos = [
                    p for p in obj.promotions.all() 
                    if p.is_active and p.start_date <= today and (p.end_date is None or p.end_date >= today)
                ]
                promo = active_promos[0] if active_promos else None
            else:
                # Fallback: requête optimisée
                promo = PromotionService.get_active_promotions().filter(
                    Q(products=obj) | Q(rayons=obj.rayon)
                ).select_related().first()
            
            if promo:
                return {
                    'id': promo.id,
                    'name': promo.name,
                    'discount_type': promo.discount_type,
                    'value': promo.value,
                    'buy_quantity': promo.buy_quantity,
                    'get_quantity': promo.get_quantity
                }
            return None
        except Exception:
            return None

class CommandeProduitSerializer(serializers.ModelSerializer):
    produit_nom = serializers.SerializerMethodField()
    produit_stock = serializers.SerializerMethodField()
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
        read_only_fields = ['created_at', 'updated_at', 'total_quantity', 'effective_cost']

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
                if lot.date_expiration:
                    repr['date_expiration'] = lot.date_expiration.isoformat()
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
        return obj.produit.rotation_moyenne if obj.produit else "0"

    def get_produit_cip(self, obj):
        return obj.produit.cip1 if obj.produit else ""

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

    def validate_status(self, value):
        """
        Empêche de passer manuellement au statut CLOT (Clôturée) via le serializer.
        Le statut CLOT doit être géré par l'action dédiée /cloturer/.
        """
        # On autorise les transitions vers PREP ou ATT
        if value == Commande.Status.CLOTUREE:
            raise serializers.ValidationError(
                "Le statut 'Clôturée' ne peut pas être défini manuellement. "
                "Utilisez l'action de clôture dédiée."
            )
        return value

    def get_fournisseur_nom(self, obj):
        return obj.fournisseur.name if obj.fournisseur else obj.fournisseur_nom

    def get_closed_by_name(self, obj):
        if obj.closed_by:
            return obj.closed_by.get_full_name() or obj.closed_by.username
        return ''

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

class OrderScheduleSerializer(serializers.ModelSerializer):
    fournisseur_name = serializers.CharField(source='fournisseur.name', read_only=True)
    
    class Meta:
        model = OrderSchedule
        fields = '__all__'
    
    def validate(self, data):
        """Empêcher 2 plannings actifs pour le même fournisseur."""
        is_active = data.get('is_active', True)
        fournisseur = data.get('fournisseur')
        
        # En création ou si on active un planning existant
        if is_active and fournisseur:
            existing_active = OrderSchedule.objects.filter(
                fournisseur=fournisseur,
                is_active=True
            )
            # Exclure l'instance actuelle en cas de mise à jour
            if self.instance:
                existing_active = existing_active.exclude(pk=self.instance.pk)
            
            if existing_active.exists():
                raise serializers.ValidationError({
                    'fournisseur': f"Un planning actif existe déjà pour ce fournisseur. Désactivez-le d'abord."
                })
        
        return data

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

    def create(self, validated_data):
        """
        Set default treatment duration from product if not provided.
        """
        if 'treatment_duration_days' not in validated_data or validated_data['treatment_duration_days'] is None:
            produit = validated_data.get('produit')
            if produit and produit.is_chronic:
                validated_data['treatment_duration_days'] = produit.default_treatment_days
        
        return super().create(validated_data)

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
    
    client_type = serializers.CharField(source='facture.client.client_type', read_only=True)
    
    # Nouveaux champs pour traçabilité (Saisie vs Validation)
    facture_created_by_name = serializers.SerializerMethodField()
    facture_validated_by_name = serializers.SerializerMethodField()
    total_lettres = serializers.SerializerMethodField()

    client_solde_depot = serializers.SerializerMethodField()
    client_points_fidelite = serializers.SerializerMethodField()

    class Meta:
        model = Caisse
        fields = [
            'id', 'facture', 'facture_numero', 'mode_paiement', 'mode_paiement_display',
            'montant', 'reference', 'statut', 'date_paiement', 'user', 'user_details',
            'client_name', 'client_type', 'client_solde_depot', 'client_points_fidelite', 'is_creance_settlement', 'releve_reference', 
            'releve_id', 'facture_created_by_name', 'facture_validated_by_name',
            'total_lettres'
        ]
        read_only_fields = ['date_paiement']

    def get_client_solde_depot(self, obj):
        try:
            if obj.facture and obj.facture.client:
                return str(obj.facture.client.solde_depot)
        except AttributeError:
            pass
        return None
    
    def get_client_points_fidelite(self, obj):
        try:
            if obj.facture and obj.facture.client:
                return obj.facture.client.points_fidelite
        except AttributeError:
            pass
        return 0
    
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
        if obj.facture.client_name_override:
            return obj.facture.client_name_override
        elif obj.facture.client:
            return obj.facture.client.name
        return "Client de passage"
    
    def get_is_creance_settlement(self, obj):
        """
        Détermine si ce paiement est un règlement de créance.
        Un règlement de créance = paiement sur une facture qui a un paiement initial 'en_compte'
        ET le paiement est fait à une date postérieure à la date de la facture.
        Les paiements du jour même de la facturation ne sont PAS des recouvrements.
        """
        if obj.mode_paiement == 'en_compte':
            return False
        if not obj.facture.paiements.filter(mode_paiement='en_compte').exists():
            return False
        # Same-day payment = not a recouvrement
        if obj.date_paiement and obj.facture.date:
            return obj.date_paiement.date() > obj.facture.date.date()
        return False

    def get_facture_created_by_name(self, obj):
        try:
            if obj.facture and obj.facture.created_by:
                return obj.facture.created_by.get_full_name() or obj.facture.created_by.username
        except AttributeError:
            pass
        return ''

    def get_facture_validated_by_name(self, obj):
        try:
            if obj.facture and obj.facture.validated_by:
                return obj.facture.validated_by.get_full_name() or obj.facture.validated_by.username
        except AttributeError:
            pass
        return ''

    def get_total_lettres(self, obj):
        try:
            # On utilise le montant du paiement (le ticket)
            # Utilisation de float puis int pour gérer les chaînes avec décimales
            return number_to_french(int(float(obj.montant)))
        except Exception:
            return ""

class FactureSerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField()
    client_nom = serializers.SerializerMethodField()
    client_solde_depot = serializers.SerializerMethodField()
    client_type = serializers.CharField(source='client.client_type', read_only=True)
    client_points_fidelite = serializers.SerializerMethodField()
    client_is_deposit_enabled = serializers.BooleanField(source='client.is_deposit_enabled', read_only=True)
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
    cancelled_by_name = serializers.SerializerMethodField()

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return ''

    def get_client_nom(self, obj):
        if obj.client_name_override:
            return obj.client_name_override
        if obj.client:
            return obj.client.name
        return "Client de passage"
    
    def get_client_name(self, obj):
        if obj.client_name_override:
            return obj.client_name_override
        if obj.client:
            return obj.client.name
        return "Client de passage"
    
    def get_client_solde_depot(self, obj):
        if obj.client:
            # We use solde_depot which is on the client model
            return str(obj.client.solde_depot)
        return "0.00"
    
    def get_client_points_fidelite(self, obj):
        if obj.client:
            return obj.client.points_fidelite
        return 0
    
    def get_validated_by_name(self, obj):
        if obj.validated_by:
            return obj.validated_by.get_full_name() or obj.validated_by.username
        return ''

    def get_cancelled_by_name(self, obj):
        if obj.cancelled_by:
            return obj.cancelled_by.get_full_name() or obj.cancelled_by.username
        return ''
    
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

    montant_regle = serializers.SerializerMethodField()
    montant_en_compte = serializers.SerializerMethodField()

    def get_montant_regle(self, obj):
        # Somme des paiements complétés hors 'en_compte'
        return obj.paiements.filter(
            statut='completee'
        ).exclude(mode_paiement='en_compte').aggregate(total=Sum('montant'))['total'] or Decimal('0.00')

    def get_montant_en_compte(self, obj):
        # Somme des paiements 'en_compte' complétés
        return obj.paiements.filter(
            statut='completee',
            mode_paiement='en_compte'
        ).aggregate(total=Sum('montant'))['total'] or Decimal('0.00')

    class Meta:
        model = Facture
        fields = [
            'id', 'numero_facture', 'client', 'client_name', 'client_nom', 'client_name_override', 
            'client_solde_depot', 'client_points_fidelite', 'client_type', 'client_is_deposit_enabled',
            'ayant_droit', 'ayant_droit_details',
            'date', 'date_document', 'status', 'status_display', 'produits', 
            'total_ht', 'remise', 'tva', 'total_tva', 'total_ttc', 'notes',
            'points_fidelite_gagnes', 'points_fidelite_utilises', 'montant_fidelite',
            'is_remise_auto', 'part_client', 'paiements', 'created_by_name',
            'validated_by_name', 'cancelled_by_name', 'session_ticket_number',
            'montant_regle', 'montant_en_compte', 'poste_caisse'
        ]

    session_ticket_number = serializers.IntegerField(source='ticket_session', read_only=True)

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
    cloture_par_name = serializers.SerializerMethodField()
    username = serializers.CharField(source='user.username', read_only=True, default='')
    poste_caisse_nom = serializers.SerializerMethodField()
    
    class Meta:
        model = ClotureCaisse
        fields = '__all__'
        read_only_fields = ['date']

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return 'N/A'

    def get_cloture_par_name(self, obj):
        if obj.cloture_par:
            return obj.cloture_par.get_full_name() or obj.cloture_par.username
        return 'N/A'

    def get_poste_caisse_nom(self, obj):
        return obj.poste_caisse.nom if obj.poste_caisse else 'N/A'

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
        return "Client de passage"
    
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
        read_only_fields = ['is_active', 'created_at', 'updated_at', 'reference']

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
    validated_by_name = serializers.SerializerMethodField()
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

    def get_validated_by_name(self, obj):
        if obj.validated_by:
            return obj.validated_by.get_full_name() or obj.validated_by.username
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
    reason_type_display = serializers.SerializerMethodField()
    lot_number = serializers.CharField(source='stock_lot.lot', read_only=True, allow_null=True)
    valorisation = serializers.SerializerMethodField()
    
    class Meta:
        model = StockAdjustment
        fields = [
            'id', 'produit', 'produit_name', 'produit_cip', 
            'stock_lot', 'lot_number',
            'user', 'user_name', 'username',
            'quantity_before', 'quantity_after', 'quantity_change',
            'reserve_before', 'reserve_after', 'reserve_change',
            'valorisation',
            'reason_type', 'reason_type_display', 'reason_detail',
            'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'quantity_change']
    
    def get_reason_type_display(self, obj):
        # Essayer d'abord les choix standards du modèle
        standard_label = dict(obj.ReasonType.choices).get(obj.reason_type)
        if standard_label:
            return standard_label
            
        # Sinon chercher dans les options de configuration
        from .models import ConfigurationOption
        config_opt = ConfigurationOption.objects.filter(
            type=ConfigurationOption.Type.STOCK_ADJUSTMENT_REASON,
            code=obj.reason_type
        ).first()
        
        return config_opt.label if config_opt else obj.reason_type

    def get_valorisation(self, obj):
        if obj.stock_lot:
            val = abs(obj.quantity_change) * (obj.stock_lot.price_cost or 0)
            return float(val)
        return 0
    
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
                  'enregistre_par_nom', 'image_ordonnance', 'created_at']
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
        fields = ['patient_nom', 'prescripteur_nom', 'facture', 'lignes', 'image_ordonnance']
    
    def validate(self, data):
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

    def get_part_assurance(self, obj):
        if obj.part_client is not None:
            return obj.total_ttc - obj.part_client
        return Decimal('0.00')

    def get_vendeur_nom(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.username
        return "Système"

    def get_validated_by_name(self, obj):
        if obj.validated_by:
            return f"{obj.validated_by.first_name} {obj.validated_by.last_name}".strip() or obj.validated_by.username
        return ""

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
        modes = set()
        for p in paiements:
            display = p.get_mode_paiement_display()
            if display:
                modes.add(str(display))
            elif p.mode_paiement:
                modes.add(str(p.mode_paiement))
            else:
                modes.add("Inconnu")
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
        try:
            return number_to_french(int(obj.total_ttc))
        except Exception:
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


class ObjectifCommercialSerializer(serializers.ModelSerializer):
    """Serializer pour les objectifs commerciaux"""
    periode_display = serializers.CharField(source='get_periode_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = ObjectifCommercial
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'created_by']
        validators = []

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)

class WhatsAppLogSerializer(serializers.ModelSerializer):
    sent_by_name = serializers.CharField(source='sent_by.username', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    facture_numero = serializers.CharField(source='facture.numero_facture', read_only=True)
    client_name_db = serializers.CharField(source='client.name', read_only=True)

    class Meta:
        model = WhatsAppLog
        fields = '__all__'


class TelegramLogSerializer(serializers.ModelSerializer):
    sent_by_name = serializers.CharField(source='sent_by.username', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    facture_numero = serializers.CharField(source='facture.numero_facture', read_only=True)
    client_name_db = serializers.CharField(source='client.name', read_only=True)

    class Meta:
        model = TelegramLog
        fields = '__all__'


class RuptureFournisseurSerializer(serializers.ModelSerializer):
    produit_nom = serializers.CharField(source='produit.name', read_only=True)
    fournisseur_nom = serializers.CharField(source='fournisseur.name', read_only=True)
    utilisateur_nom = serializers.CharField(source='utilisateur.username', read_only=True)
    
    class Meta:
        model = RuptureFournisseur
        fields = '__all__'

class InternalMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    recipient_name = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()
    parent_content = serializers.CharField(source='parent.content', read_only=True)
    parent_sender_name = serializers.CharField(source='parent.sender.username', read_only=True)
    is_archived = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()
    
    class Meta:
        model = InternalMessage
        fields = '__all__'
        read_only_fields = ['sender', 'created_at', 'read_by', 'archived_by']

    def get_attachment_url(self, obj):
        if obj.attachment:
            return obj.attachment.url  # Retourne /media/... (chemin relatif)
        return None

    def get_recipient_name(self, obj):
        return obj.recipient.username if obj.recipient else "Tous"

    def get_is_archived(self, obj):
        request = self.context.get('request')
        if not request or not request.user:
            return False
        if hasattr(obj, '_prefetched_objects_cache') and 'archived_by' in obj._prefetched_objects_cache:
            return any(u.id == request.user.id for u in obj.archived_by.all())
        return obj.archived_by.filter(id=request.user.id).exists()

    def get_is_read(self, obj):
        request = self.context.get('request')
        if not request or not request.user:
            return False
        if obj.sender_id == request.user.id:
            return True
            
        # Optimization: use python check if prefetched
        if hasattr(obj, '_prefetched_objects_cache') and 'read_by' in obj._prefetched_objects_cache:
            return any(u.id == request.user.id for u in obj.read_by.all())
        
        return obj.read_by.filter(id=request.user.id).exists()

class MessageTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = MessageTemplate
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at']

class ReapproAdjustmentSerializer(serializers.ModelSerializer):
    produit_name = serializers.CharField(source='produit.name', read_only=True)
    lot_num = serializers.CharField(source='stock_lot.lot', read_only=True)
    expiry = serializers.DateField(source='stock_lot.date_expiration', read_only=True)
    
    class Meta:
        model = StockAdjustment
        fields = ['id', 'produit', 'produit_name', 'lot_num', 'expiry', 'quantity_change']

class ReapproSessionSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    adjustments = ReapproAdjustmentSerializer(many=True, read_only=True)
    
    class Meta:
        model = ReapproSession
        fields = ['id', 'user', 'user_name', 'total_products', 'total_units', 'created_at', 'notes', 'adjustments']

class CompteComptableSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompteComptable
        fields = '__all__'

class JournalComptableSerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalComptable
        fields = '__all__'

class ExerciceComptableSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExerciceComptable
        fields = '__all__'

class LigneEcritureSerializer(serializers.ModelSerializer):
    compte_numero = serializers.CharField(source='compte.numero', read_only=True)
    compte_libelle = serializers.CharField(source='compte.libelle', read_only=True)
    
    class Meta:
        model = LigneEcriture
        fields = ['id', 'compte', 'compte_numero', 'compte_libelle', 'libelle_ligne', 'debit', 'credit']

class EcritureComptableSerializer(serializers.ModelSerializer):
    lignes = LigneEcritureSerializer(many=True)
    journal_code = serializers.CharField(source='journal.code', read_only=True)
    exercice = serializers.PrimaryKeyRelatedField(
        queryset=ExerciceComptable.objects.all(),
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = EcritureComptable
        fields = [
            'id', 'date', 'exercice', 'journal', 'journal_code', 
            'reference', 'libelle', 'created_at', 'lignes', 
            'total_debit', 'total_credit'
        ]

    def validate(self, data):
        lignes = data.get('lignes', [])
        if not lignes:
            raise serializers.ValidationError("Une écriture doit avoir au moins une ligne.")
        
        total_debit = sum(Decimal(str(l.get('debit', 0))) for l in lignes)
        total_credit = sum(Decimal(str(l.get('credit', 0))) for l in lignes)
        
        if total_debit != total_credit:
            raise serializers.ValidationError(
                f"L'écriture n'est pas équilibrée (Débit: {total_debit}, Crédit: {total_credit})"
            )
            
        # Assigner l'exercice automatiquement si manquant
        if not data.get('exercice'):
            date_ecriture = data.get('date') or timezone.now().date()
            exercice = ExerciceComptable.objects.filter(
                date_debut__lte=date_ecriture,
                date_fin__gte=date_ecriture,
                est_cloture=False
            ).first()
            
            if not exercice:
                # Essayer de prendre le dernier exercice ouvert
                exercice = ExerciceComptable.objects.filter(est_cloture=False).first()
            
            if not exercice:
                raise serializers.ValidationError(
                    "Aucun exercice comptable ouvert n'a été trouvé. Veuillez en créer un dans les paramètres."
                )
            data['exercice'] = exercice
            
        return data

    def create(self, validated_data):
        lignes_data = validated_data.pop('lignes')
        ecriture = EcritureComptable.objects.create(**validated_data)
        for ligne_data in lignes_data:
            LigneEcriture.objects.create(ecriture=ecriture, **ligne_data)
        return ecriture
