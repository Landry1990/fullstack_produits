"""
Endpoints admin pour la gestion DCI : import, matching, liaison manuelle.
"""
import os
import tempfile
import re
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from ..models import Produit, Substance, MedicamentReference
from ..serializers import ProduitSerializer


class DCIAdminViewSet(viewsets.ViewSet):
    """Admin DCI : stats, upload, auto-match, produits non liés, liaison manuelle."""

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total_substances = Substance.objects.count()
        total_meds = MedicamentReference.objects.count()
        total_produits = Produit.objects.filter(is_active=True).count()
        linked_produits = Produit.objects.filter(
            Q(substances__isnull=False) | Q(dci_reference__isnull=False),
            is_active=True
        ).distinct().count()
        unlinked_produits = total_produits - linked_produits

        return Response({
            'substances': total_substances,
            'medicament_references': total_meds,
            'total_produits': total_produits,
            'linked_produits': linked_produits,
            'unlinked_produits': unlinked_produits,
            'link_rate': round((linked_produits / total_produits * 100), 1) if total_produits else 0,
        })

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_compo(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'Aucun fichier fourni'}, status=status.HTTP_400_BAD_REQUEST)

        # Sauvegarde temporaire
        with tempfile.NamedTemporaryFile(delete=False, suffix='.txt') as tmp:
            for chunk in file.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        try:
            # Utilise la commande existante import_substances (logique inline ici)
            created = 0
            skipped = 0
            encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
            lines = []
            for enc in encodings:
                try:
                    with open(tmp_path, 'r', encoding=enc) as f:
                        lines = f.readlines()
                    break
                except UnicodeDecodeError:
                    continue

            for line in lines:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                parts = line.split('\t')
                if len(parts) >= 2:
                    code = parts[0].strip()
                    nom = parts[1].strip()
                    if nom:
                        _, was_created = Substance.objects.get_or_create(
                            nom__iexact=nom,
                            defaults={'nom': nom.upper()}
                        )
                        if was_created:
                            created += 1
                        else:
                            skipped += 1

            return Response({
                'created': created,
                'skipped': skipped,
                'total': created + skipped,
            })
        finally:
            os.unlink(tmp_path)

    @action(detail=False, methods=['post'])
    def auto_match(self, request):
        """Lance le matching automatique produit ↔ substance et retourne les résultats."""
        from django.core.management import call_command
        from io import StringIO

        out = StringIO()
        try:
            call_command('link_dci_produits', stdout=out)
            output = out.getvalue()
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Parse la sortie texte
        linked = 0
        for line in output.split('\n'):
            if 'lié' in line.lower() or 'linked' in line.lower():
                m = re.search(r'(\d+)', line)
                if m:
                    linked = int(m.group(1))

        # Stats post-match
        total = Produit.objects.filter(is_active=True).count()
        linked_total = Produit.objects.filter(
            Q(substances__isnull=False) | Q(dci_reference__isnull=False),
            is_active=True
        ).distinct().count()

        return Response({
            'output': output,
            'newly_linked': linked,
            'total_linked': linked_total,
            'total_produits': total,
            'link_rate': round((linked_total / total * 100), 1) if total else 0,
        })

    @action(detail=False, methods=['get'])
    def unlinked(self, request):
        """Liste des produits actifs sans DCI, avec suggestions de substances."""
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        search = request.query_params.get('search', '')

        qs = Produit.objects.filter(
            dci_reference__isnull=True,
            substances__isnull=True,
            is_active=True
        )
        if search:
            qs = qs.filter(name__icontains=search)

        total = qs.count()
        start = (page - 1) * page_size
        end = start + page_size
        produits = qs[start:end]

        results = []
        for p in produits:
            # Suggestion : chercher une substance dont le nom est contenu dans le nom du produit
            suggestion = None
            for sub in Substance.objects.all()[:200]:  # Limite pour perf
                if sub.nom.upper() in p.name.upper():
                    suggestion = {'id': sub.id, 'nom': sub.nom}
                    break
            # Fallback : chercher dans MedicamentReference
            if not suggestion:
                med = MedicamentReference.objects.filter(nom__icontains=p.name.split()[0] if p.name else '').first()
                if med and med.substances:
                    first_sub = med.substances.split(';')[0].strip()
                    sub = Substance.objects.filter(nom__iexact=first_sub).first()
                    if sub:
                        suggestion = {'id': sub.id, 'nom': sub.nom}

            results.append({
                'id': p.id,
                'name': p.name,
                'cip1': p.cip1,
                'stock': p.stock,
                'selling_price': p.selling_price,
                'suggestion': suggestion,
            })

        return Response({
            'results': results,
            'count': total,
            'page': page,
            'page_size': page_size,
        })

    @action(detail=False, methods=['post'])
    def manual_link(self, request):
        """Lie manuellement un produit à une ou plusieurs substances."""
        produit_id = request.data.get('produit_id')
        substance_ids = request.data.get('substance_ids', [])
        dci_reference_id = request.data.get('dci_reference_id')

        if not produit_id:
            return Response({'error': 'produit_id requis'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            produit = Produit.objects.get(pk=produit_id)
        except Produit.DoesNotExist:
            return Response({'error': 'Produit introuvable'}, status=status.HTTP_404_NOT_FOUND)

        if substance_ids:
            produit.substances.set(substance_ids)
        if dci_reference_id:
            produit.dci_reference_id = dci_reference_id
            produit.save(update_fields=['dci_reference'])

        return Response({
            'success': True,
            'produit': produit.name,
            'substances': list(produit.substances.values_list('nom', flat=True)),
            'dci_reference': produit.dci_reference.nom if produit.dci_reference else None,
        })
