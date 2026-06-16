# -*- coding: utf-8 -*-
"""
Serializers pour la comptabilité (Comptes, Journaux, Ecritures).
"""
from rest_framework import serializers
from decimal import Decimal
from django.utils import timezone
from ..models import (
    CompteComptable, JournalComptable, ExerciceComptable,
    LigneEcriture, EcritureComptable,
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
