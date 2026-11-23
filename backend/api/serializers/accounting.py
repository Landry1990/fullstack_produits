"""
Serializers pour la comptabilité (Comptes, Journaux, Ecritures).
"""
from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from ..models import (
    CompteComptable,
    EcritureComptable,
    ExerciceComptable,
    JournalComptable,
    LigneEcriture,
)


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
            'total_debit', 'total_credit', 'est_liee'
        ]

    def validate(self, data):
        # Une écriture liée à un document métier (commande, facture, caisse,
        # stock, immobilisation…) ne se modifie pas ici : corriger la source.
        if self.instance is not None and self.instance.est_liee:
            raise serializers.ValidationError(
                "Cette écriture est liée à un document (commande, facture, caisse, "
                "stock ou immobilisation). Modifiez le document d'origine."
            )
        # En PATCH partiel sans lignes, on ne touche pas aux lignes existantes.
        if self.instance is None or 'lignes' in data:
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

    def update(self, instance, validated_data):
        lignes_data = validated_data.pop('lignes', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lignes_data is not None:
            instance.lignes.all().delete()
            for ligne_data in lignes_data:
                LigneEcriture.objects.create(ecriture=instance, **ligne_data)
        return instance


class DotationAmortissementSerializer(serializers.ModelSerializer):
    class Meta:
        from api.models import DotationAmortissement
        model = DotationAmortissement
        fields = ['id', 'annee', 'montant', 'ecriture', 'created_at']


class ImmobilisationSerializer(serializers.ModelSerializer):
    dotations = DotationAmortissementSerializer(many=True, read_only=True)
    compte_immo_numero = serializers.CharField(source='compte_immo.numero', read_only=True)
    compte_immo_libelle = serializers.CharField(source='compte_immo.libelle', read_only=True)
    compte_amortissement_numero = serializers.CharField(source='compte_amortissement.numero', read_only=True)
    cumul_amortissements = serializers.ReadOnlyField()
    valeur_nette_comptable = serializers.ReadOnlyField()
    dotation_annuelle = serializers.ReadOnlyField()
    comptabilisee = serializers.SerializerMethodField()

    def get_comptabilisee(self, obj):
        acquisition = getattr(obj, 'acquisition_comptabilisee', None)
        if acquisition is None:
            acquisition = EcritureComptable.objects.filter(reference=f'IMMO-{obj.pk}').exists()
        return acquisition or obj.dotations.exists()

    def validate(self, data):
        instance = self.instance
        financiers = ('compte_immo', 'compte_amortissement', 'date_acquisition',
                      'valeur_acquisition', 'duree_annees', 'valeur_residuelle', 'mode_paiement')
        if instance and self.get_comptabilisee(instance):
            modifies = [field for field in financiers if field in data and data[field] != getattr(instance, field)]
            if modifies:
                raise serializers.ValidationError({field: 'Donnée financière verrouillée après comptabilisation. Une écriture de correction est nécessaire.' for field in modifies})
            return data
        valeur = data.get('valeur_acquisition', getattr(instance, 'valeur_acquisition', Decimal('0')))
        residuelle = data.get('valeur_residuelle', getattr(instance, 'valeur_residuelle', Decimal('0')))
        duree = data.get('duree_annees', getattr(instance, 'duree_annees', 5))
        if duree < 1:
            raise serializers.ValidationError({'duree_annees': 'La durée doit être supérieure à zéro.'})
        if residuelle > valeur:
            raise serializers.ValidationError({'valeur_residuelle': 'La valeur résiduelle ne peut pas dépasser la valeur d’acquisition.'})
        compte = data.get('compte_immo', getattr(instance, 'compte_immo', None))
        amortissement = data.get('compte_amortissement', getattr(instance, 'compte_amortissement', None))
        if compte and (not compte.is_active or compte.type != 'ACTIF' or not compte.numero.startswith(('21', '23', '24'))):
            raise serializers.ValidationError({'compte_immo': 'Choisissez un compte actif d’immobilisation amortissable (21, 23 ou 24).'})
        if amortissement and (not amortissement.is_active or amortissement.type != 'PASSIF' or
                             not amortissement.numero.startswith(f'28{compte.numero[1]}')):
            raise serializers.ValidationError({'compte_amortissement': 'Choisissez le compte d’amortissement actif correspondant à la classe de l’immobilisation (281, 283 ou 284).'})
        date_acquisition = data.get('date_acquisition', getattr(instance, 'date_acquisition', None))
        if date_acquisition:
            if date_acquisition > timezone.localdate():
                raise serializers.ValidationError({'date_acquisition': 'La date d’acquisition ne peut pas être future.'})
            if not ExerciceComptable.objects.filter(date_debut__lte=date_acquisition, date_fin__gte=date_acquisition, est_cloture=False).exists():
                raise serializers.ValidationError({'date_acquisition': 'Aucun exercice comptable ouvert ne couvre cette date d’acquisition.'})
        return data

    class Meta:
        from api.models import Immobilisation
        model = Immobilisation
        fields = ['id', 'nom', 'compte_immo', 'compte_immo_numero', 'compte_immo_libelle',
                  'compte_amortissement', 'compte_amortissement_numero', 'date_acquisition',
                  'valeur_acquisition', 'duree_annees', 'valeur_residuelle', 'mode_paiement',
                  'is_active', 'dotation_annuelle', 'cumul_amortissements',
                  'valeur_nette_comptable', 'dotations', 'created_at', 'comptabilisee']
