"""
ViewSet pour la gestion des interactions médicamenteuses (DrugInteraction).
CRUD complet + recherche + statistiques + import CSV.
"""
import csv
import io
import os
import tempfile
import unicodedata
import re
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q, Count
from ..models import DrugInteraction, Substance
from ..serializers import DrugInteractionSerializer
from ..centralized_configs import StandardResultsSetPagination


def _normalize(text):
    if not text:
        return ""
    text = "".join(c for c in unicodedata.normalize('NFKD', text) if not unicodedata.combining(c))
    text = text.upper().strip()
    text = re.sub(r'[,\.;:/!|_\(\)]', ' ', text)
    text = " ".join(text.split())
    return text


class DrugInteractionViewSet(viewsets.ModelViewSet):
    """CRUD pour les interactions médicamenteuses entre substances."""
    serializer_class = DrugInteractionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    ordering_fields = ['gravity', 'substance_a__nom', 'substance_b__nom']
    ordering = ['substance_a__nom']

    def get_queryset(self):
        qs = DrugInteraction.objects.select_related('substance_a', 'substance_b')
        gravity = self.request.query_params.get('gravity')
        if gravity:
            qs = qs.filter(gravity=gravity)
        substance = self.request.query_params.get('substance')
        if substance:
            qs = qs.filter(Q(substance_a_id=substance) | Q(substance_b_id=substance))
        return qs

    def get_search_fields(self):
        return ['substance_a__nom', 'substance_b__nom', 'description']

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Statistiques sur les interactions."""
        total = DrugInteraction.objects.count()
        by_gravity = {}
        for choice in DrugInteraction.GRAVITY_CHOICES:
            code, label = choice
            by_gravity[code] = DrugInteraction.objects.filter(gravity=code).count()
        substances_with_interactions = Substance.objects.filter(
            Q(interactions_a__isnull=False) | Q(interactions_b__isnull=False)
        ).distinct().count()
        total_substances = Substance.objects.count()

        return Response({
            'total': total,
            'by_gravity': by_gravity,
            'substances_with_interactions': substances_with_interactions,
            'total_substances': total_substances,
        })

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_csv(self, request):
        """
        Import d'un fichier CSV d'interactions.
        Format attendu (en-têtes): substance_a,substance_b,gravity,description
        gravity: PRECAUTION | A_PRENDRE_EN_COMPTE | DECONSEILLE | CONTRE_INDIQUE
        """
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'Aucun fichier fourni'}, status=status.HTTP_400_BAD_REQUEST)

        with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp:
            for chunk in file.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        try:
            encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
            content = None
            for enc in encodings:
                try:
                    with open(tmp_path, 'r', encoding=enc) as f:
                        content = f.read()
                    break
                except UnicodeDecodeError:
                    continue

            if content is None:
                return Response({'error': 'Encodage non supporté'}, status=status.HTTP_400_BAD_REQUEST)

            reader = csv.DictReader(io.StringIO(content))
            created = 0
            updated = 0
            skipped = 0
            errors = []

            substances_cache = {}
            for s in Substance.objects.all():
                substances_cache[_normalize(s.nom)] = s

            for row_num, row in enumerate(reader, start=2):
                nom_a = (row.get('substance_a') or '').strip()
                nom_b = (row.get('substance_b') or '').strip()
                gravity = (row.get('gravity') or 'PRECAUTION').strip().upper()
                description = (row.get('description') or '').strip()

                if not nom_a or not nom_b:
                    skipped += 1
                    continue

                valid_gravities = [c[0] for c in DrugInteraction.GRAVITY_CHOICES]
                if gravity not in valid_gravities:
                    errors.append(f"Ligne {row_num}: gravité '{gravity}' invalide")
                    skipped += 1
                    continue

                sub_a = substances_cache.get(_normalize(nom_a))
                sub_b = substances_cache.get(_normalize(nom_b))

                if not sub_a:
                    sub_a, _ = Substance.objects.get_or_create(
                        nom__iexact=nom_a, defaults={'nom': nom_a.upper()}
                    )
                    substances_cache[_normalize(nom_a)] = sub_a

                if not sub_b:
                    sub_b, _ = Substance.objects.get_or_create(
                        nom__iexact=nom_b, defaults={'nom': nom_b.upper()}
                    )
                    substances_cache[_normalize(nom_b)] = sub_b

                if sub_a.id == sub_b.id:
                    skipped += 1
                    continue

                pair_a, pair_b = (sub_a, sub_b) if sub_a.id < sub_b.id else (sub_b, sub_a)

                obj, was_created = DrugInteraction.objects.update_or_create(
                    substance_a=pair_a,
                    substance_b=pair_b,
                    defaults={'gravity': gravity, 'description': description}
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

            return Response({
                'created': created,
                'updated': updated,
                'skipped': skipped,
                'errors': errors[:20],
                'total': created + updated + skipped,
            })
        finally:
            os.unlink(tmp_path)

    def perform_create(self, serializer):
        sub_a = serializer.validated_data['substance_a']
        sub_b = serializer.validated_data['substance_b']
        if sub_a.id == sub_b.id:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Les deux substances doivent être différentes.")
        pair_a, pair_b = (sub_a, sub_b) if sub_a.id < sub_b.id else (sub_b, sub_a)
        serializer.save(substance_a=pair_a, substance_b=pair_b)

    def perform_update(self, serializer):
        sub_a = serializer.validated_data.get('substance_a', serializer.instance.substance_a)
        sub_b = serializer.validated_data.get('substance_b', serializer.instance.substance_b)
        if sub_a.id == sub_b.id:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Les deux substances doivent être différentes.")
        pair_a, pair_b = (sub_a, sub_b) if sub_a.id < sub_b.id else (sub_b, sub_a)
        serializer.save(substance_a=pair_a, substance_b=pair_b)
