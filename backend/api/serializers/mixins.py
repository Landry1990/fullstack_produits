"""
Mixin pour normaliser automatiquement les champs texte en MAJUSCULES.
Applique .upper() sur tous les CharField/TextField writables,
sauf les champs exclus (email, password, username, token, etc.).
"""
from rest_framework import serializers

# Champs à ne PAS mettre en majuscules
UPPERCASE_EXCLUDE_FIELDS = frozenset({
    'email', 'password', 'password1', 'password2',
    'username', 'token', 'api_key', 'secret',
    'uuid', 'slug', 'url', 'website',
    'color', 'colour',
    'morning_start', 'morning_end', 'night_start', 'night_end',
    'shift_type', 'leave_type', 'status', 'role',
    'team_mode', 'default_shift',
    'mode_paiement', 'currency', 'locale', 'timezone',
    'cip1', 'cip2', 'cip3', 'cip4', 'cip',
    'barcode', 'qr_code',
    'phone', 'telephone', 'mobile', 'whatsapp',
    'numero_facture', 'numero_avoir', 'numero_commande',
    'lot', 'batch_number',
    'date', 'start_date', 'end_date', 'date_expiration',
    'date_ouverture', 'date_fermeture', 'date_reception',
    'approved_at', 'created_at', 'updated_at',
})


class UppercaseSerializerMixin:
    """
    Mixin à ajouter sur un ModelSerializer pour uppercase automatiquement
    tous les champs CharField/TextField en écriture, sauf exclusions.
    """

    def to_internal_value(self, data):
        data = dict(data)  # copie mutable
        for field_name, field in self.fields.items():
            if field.read_only:
                continue
            if field_name in UPPERCASE_EXCLUDE_FIELDS:
                continue
            if isinstance(field, serializers.CharField):
                value = data.get(field_name)
                if isinstance(value, str) and value != value.upper():
                    data[field_name] = value.upper()
        return super().to_internal_value(data)
