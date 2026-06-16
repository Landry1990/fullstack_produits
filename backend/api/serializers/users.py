# -*- coding: utf-8 -*-
"""
Serializers pour les utilisateurs, profils et caisse.
"""
from rest_framework import serializers
from django.contrib.auth.models import User
from django.db.models import Sum
from decimal import Decimal
from ..models import Profile, PosteCaisse, SessionCaisse


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = [
            'allowed_menus', 'can_do_returns', 'can_sell_negative_stock', 'can_cash_out', 'role',
            'can_delete_product', 'can_adjust_stock', 'can_delete_fournisseur', 'can_delete_commande', 'can_close_commande',
            'can_modify_price', 'max_discount_rate', 'can_cancel_invoice', 'can_modify_invoice',
            'can_cancel_promis', 'can_manage_perimes', 'can_manage_avoirs', 'can_validate_zero_amount', 'can_view_cash_sessions'
        ]


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
            profile = user.profile  # type: ignore[attr-defined]
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
            profile.can_view_cash_sessions = profile_data.get('can_view_cash_sessions', False)
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
            profile = instance.profile  # type: ignore[attr-defined]
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
            profile.can_view_cash_sessions = profile_data.get('can_view_cash_sessions', profile.can_view_cash_sessions)
            profile.max_discount_rate = profile_data.get('max_discount_rate', profile.max_discount_rate)
            profile.role = profile_data.get('role', profile.role)
            profile.save()

        return instance


class PosteCaisseSerializer(serializers.ModelSerializer):
    ouvert_par_name = serializers.SerializerMethodField()
    session_active = serializers.SerializerMethodField()

    def get_ouvert_par_name(self, obj):
        if obj.ouvert_par:
            return obj.ouvert_par.get_full_name() or obj.ouvert_par.username
        return None

    class Meta:
        model = PosteCaisse
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def get_session_active(self, obj):
        session = obj.sessions.filter(est_active=True).first()
        if session:
            return {
                'id': session.id,
                'fond_de_caisse': str(session.fond_de_caisse) if session.fond_de_caisse else None,
                'date_ouverture': session.date_ouverture,
                'ouvert_par_name': (session.ouvert_par.get_full_name() or session.ouvert_par.username) if session.ouvert_par else None,
            }
        return None


class SessionCaisseSerializer(serializers.ModelSerializer):
    poste_nom = serializers.CharField(source='poste.nom', read_only=True)
    ouvert_par_name = serializers.SerializerMethodField()
    ventilation_paiements = serializers.SerializerMethodField()

    def get_ouvert_par_name(self, obj):
        if obj.ouvert_par:
            return obj.ouvert_par.get_full_name() or obj.ouvert_par.username
        return None

    class Meta:
        model = SessionCaisse
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def get_ventilation_paiements(self, obj):
        from django.utils import timezone
        from ..models import Caisse

        start_date = obj.date_ouverture
        end_date = obj.date_fermeture or timezone.now()

        queryset = Caisse.objects.filter(
            facture__poste_caisse=obj.poste,
            date_paiement__gte=start_date,
            date_paiement__lte=end_date
        ).values('mode_paiement').annotate(total=Sum('montant'))

        breakdown = {}
        for item in queryset:
            mode = item['mode_paiement']
            total = item['total'] or Decimal('0.00')
            breakdown[mode] = float(total)

        return breakdown
