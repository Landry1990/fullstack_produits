from rest_framework import serializers

from ..models import Challenge, ChallengeEquipe, ChallengePointTier


class ChallengeEquipeSerializer(serializers.ModelSerializer):
    """Serializer pour la lecture des équipes d'un challenge."""
    membres = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    membres_count = serializers.SerializerMethodField()
    membres_names = serializers.SerializerMethodField()

    class Meta:
        model = ChallengeEquipe
        fields = ['id', 'nom', 'membres', 'membres_count', 'membres_names', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_membres_count(self, obj):
        return obj.membres.count()

    def get_membres_names(self, obj):
        return list(obj.membres.values_list('username', flat=True))


class ChallengePointTierSerializer(serializers.ModelSerializer):
    """Serializer pour les barèmes de points par niveau d'urgence de péremption."""
    class Meta:
        model = ChallengePointTier
        fields = ['id', 'mois_max', 'points']
        read_only_fields = ['id']


class ChallengeSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    type_objectif_display = serializers.CharField(source='get_type_objectif_display', read_only=True)
    mode_display = serializers.CharField(source='get_mode_display', read_only=True)
    source_produits_display = serializers.CharField(source='get_source_produits_display', read_only=True)
    participants_count = serializers.IntegerField(source='participants.count', read_only=True)
    produits_count = serializers.IntegerField(source='produits.count', read_only=True)
    is_ongoing = serializers.BooleanField(read_only=True)

    # Lecture : équipes imbriquées
    equipes = ChallengeEquipeSerializer(many=True, read_only=True)
    # Écriture : liste de {nom, membres: [ids]}
    equipes_data = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
        allow_empty=True,
        help_text="Liste des équipes [{nom: str, membres: [user_ids]}] pour le mode EQUIPES",
    )

    # Lecture : barèmes de points imbriqués (pour la Chasse au Trésor Anti-Péremption)
    point_tiers = ChallengePointTierSerializer(many=True, read_only=True)
    point_tiers_count = serializers.IntegerField(source='point_tiers.count', read_only=True)
    # Écriture : liste de {mois_max, points}
    point_tiers_data = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
        allow_empty=True,
        help_text="Liste des barèmes de points [{mois_max: int, points: int}] pour le type POINTS",
    )

    class Meta:
        model = Challenge
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and not validated_data.get('created_by'):
            validated_data['created_by'] = request.user

        equipes_data = validated_data.pop('equipes_data', [])
        point_tiers_data = validated_data.pop('point_tiers_data', [])
        challenge = super().create(validated_data)
        self._save_equipes(challenge, equipes_data)
        self._save_point_tiers(challenge, point_tiers_data)
        return challenge

    def update(self, instance, validated_data):
        equipes_data = validated_data.pop('equipes_data', None)
        point_tiers_data = validated_data.pop('point_tiers_data', None)
        challenge = super().update(instance, validated_data)
        if equipes_data is not None:
            self._save_equipes(challenge, equipes_data)
        if point_tiers_data is not None:
            self._save_point_tiers(challenge, point_tiers_data)
        return challenge

    def _save_equipes(self, challenge, equipes_data):
        """Synchronise les équipes du challenge avec la liste fournie."""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        # Mapping des équipes existantes par nom
        existing = {eq.nom: eq for eq in challenge.equipes.all()}
        seen_names = set()

        for item in equipes_data:
            nom = item.get('nom', '').strip()
            if not nom:
                continue
            membre_ids = item.get('membres', []) or []
            if not isinstance(membre_ids, list):
                membre_ids = [membre_ids]

            if nom in existing:
                equipe = existing[nom]
                equipe.membres.set(User.objects.filter(id__in=membre_ids))
            else:
                equipe = ChallengeEquipe.objects.create(challenge=challenge, nom=nom)
                equipe.membres.set(User.objects.filter(id__in=membre_ids))
            seen_names.add(nom)

        # Supprime les équipes qui ne sont plus dans la liste
        for nom, equipe in existing.items():
            if nom not in seen_names:
                equipe.delete()

    def _save_point_tiers(self, challenge, point_tiers_data):
        """Synchronise les barèmes de points du challenge avec la liste fournie.

        Clé de dédoublonnage : mois_max. Les tiers absents de la liste sont supprimés.
        """
        existing = {tier.mois_max: tier for tier in challenge.point_tiers.all()}
        seen_mois = set()

        for item in point_tiers_data:
            try:
                mois_max = int(item.get('mois_max'))
                points = int(item.get('points'))
            except (TypeError, ValueError):
                continue
            if mois_max < 0:
                continue

            if mois_max in existing:
                tier = existing[mois_max]
                tier.points = points
                tier.save(update_fields=['points'])
            else:
                ChallengePointTier.objects.create(
                    challenge=challenge,
                    mois_max=mois_max,
                    points=points,
                )
            seen_mois.add(mois_max)

        # Supprime les tiers qui ne sont plus dans la liste
        for mois_max, tier in existing.items():
            if mois_max not in seen_mois:
                tier.delete()
