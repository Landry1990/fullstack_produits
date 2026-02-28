# -*- coding: utf-8 -*-
"""
Data Purge / Maintenance ViewSet.
Superadmin-only tool to preview, export and purge old transactional data.
"""
import csv
import io
import zipfile
from datetime import datetime

from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet
from django.contrib.auth import authenticate


# ── Registry of purgeable tables ──────────────────────────────────────────
# Each entry: key → (label_fr, Model import path, date_field, [child relations])
# Child relations are cascaded automatically by Django when using on_delete=CASCADE,
# but we list them here for the CSV export and the preview count.

def _get_purge_registry():
    """Lazy import to avoid circular imports."""
    from api.models.billing import (
        Facture, FactureProduit, FactureProduitAllocation,
        Caisse, ClotureCaisse, CouponMonnaie, Promis, RelevePaiement,
    )
    from api.models.orders import Commande, CommandeProduit, Avoir, LigneAvoir
    from api.models.paiements import PaiementFournisseur
    from api.models.stock import MouvementStock, StockAdjustment
    from api.models.audit import (
        ActivityLog, AuditLog, MouvementCaisse, Ordonnancier, LigneOrdonnancier,
    )
    from api.models.objectif import ObjectifCommercial
    from api.models.communication import SmsLog

    return {
        'factures': {
            'label': 'Factures (ventes)',
            'model': Facture,
            'date_field': 'date',
            'children': [
                {'model': FactureProduit, 'fk': 'facture', 'label': 'Lignes facture'},
                {'model': FactureProduitAllocation, 'fk': 'facture_produit__facture', 'label': 'Allocations lots'},
                {'model': Caisse, 'fk': 'facture', 'label': 'Paiements caisse'},
            ],
        },
        'commandes': {
            'label': 'Commandes (achats)',
            'model': Commande,
            'date_field': 'date',
            'children': [
                {'model': CommandeProduit, 'fk': 'commande', 'label': 'Lignes commande'},
            ],
        },
        'avoirs': {
            'label': 'Avoirs fournisseurs',
            'model': Avoir,
            'date_field': 'date',
            'children': [
                {'model': LigneAvoir, 'fk': 'avoir', 'label': 'Lignes avoir'},
            ],
        },
        'paiements_fournisseur': {
            'label': 'Paiements fournisseurs',
            'model': PaiementFournisseur,
            'date_field': 'date_paiement',
            'children': [],
        },
        'mouvements_stock': {
            'label': 'Mouvements de stock',
            'model': MouvementStock,
            'date_field': 'date',
            'children': [],
        },
        'ajustements_stock': {
            'label': 'Ajustements de stock',
            'model': StockAdjustment,
            'date_field': 'created_at',
            'children': [],
        },
        'caisse': {
            'label': 'Paiements en caisse',
            'model': Caisse,
            'date_field': 'date_paiement',
            'children': [],
        },
        'clotures_caisse': {
            'label': 'Clôtures de caisse',
            'model': ClotureCaisse,
            'date_field': 'date',
            'children': [],
        },
        'mouvements_caisse': {
            'label': 'Mouvements de caisse (E/S)',
            'model': MouvementCaisse,
            'date_field': 'date',
            'children': [],
        },
        'ordonnancier': {
            'label': 'Ordonnancier',
            'model': Ordonnancier,
            'date_field': 'date_delivrance',
            'children': [
                {'model': LigneOrdonnancier, 'fk': 'ordonnancier', 'label': 'Lignes ordonnancier'},
            ],
        },
        'objectifs': {
            'label': 'Objectifs commerciaux',
            'model': ObjectifCommercial,
            'date_field': 'date_debut',
            'children': [],
        },
        'promis': {
            'label': 'Promis clients',
            'model': Promis,
            'date_field': 'date_promis',
            'children': [],
        },
        'releves': {
            'label': 'Relevés de paiement',
            'model': RelevePaiement,
            'date_field': 'created_at',
            'children': [],
        },
        'coupons': {
            'label': 'Coupons monnaie',
            'model': CouponMonnaie,
            'date_field': 'date_creation',
            'children': [],
        },
        'audit_logs': {
            'label': 'Journal d\'audit',
            'model': AuditLog,
            'date_field': 'timestamp',
            'children': [],
        },
        'activity_logs': {
            'label': 'Logs d\'activité',
            'model': ActivityLog,
            'date_field': 'timestamp',
            'children': [],
        },
        'sms_logs': {
            'label': 'Journal SMS',
            'model': SmsLog,
            'date_field': 'created_at',
            'children': [],
        },
    }


def _build_date_filter(date_field, date_from, date_to):
    """Build a Django ORM filter dict for a date range."""
    filters = {}
    if date_from:
        filters[f'{date_field}__gte'] = date_from
    if date_to:
        filters[f'{date_field}__lte'] = date_to
    return filters


def _queryset_to_csv(qs, model):
    """Convert a queryset into CSV string content."""
    output = io.StringIO()
    fields = [f.name for f in model._meta.get_fields() if hasattr(f, 'column')]
    writer = csv.writer(output)
    writer.writerow(fields)
    for obj in qs.values_list(*fields):
        writer.writerow([str(v) for v in obj])
    return output.getvalue()


class PurgeViewSet(ViewSet):
    """
    Superadmin-only maintenance tool to preview, export, and purge data.
    """
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['get'])
    def tables(self, request):
        """Return the list of purgeable table categories."""
        registry = _get_purge_registry()
        result = []
        for key, info in registry.items():
            result.append({
                'key': key,
                'label': info['label'],
                'children': [c['label'] for c in info['children']],
            })
        return Response(result)

    @action(detail=False, methods=['post'])
    def preview(self, request):
        """
        Preview how many rows would be purged.
        Body: { tables: ["factures", "commandes"], date_from: "2024-01-01", date_to: "2024-12-31" }
        """
        tables = request.data.get('tables', [])
        date_from = request.data.get('date_from')
        date_to = request.data.get('date_to')

        if not tables:
            return Response({'detail': 'Veuillez sélectionner au moins une table.'}, status=status.HTTP_400_BAD_REQUEST)

        registry = _get_purge_registry()
        result = []

        for table_key in tables:
            info = registry.get(table_key)
            if not info:
                continue

            date_filter = _build_date_filter(info['date_field'], date_from, date_to)
            parent_qs = info['model'].objects.filter(**date_filter)
            parent_count = parent_qs.count()

            children_counts = []
            for child in info['children']:
                child_filter = {}
                fk_path = child['fk']
                # Build the filter through the FK to the parent's date field
                child_date_key = f'{fk_path}__{info["date_field"]}'
                if date_from:
                    child_filter[f'{child_date_key}__gte'] = date_from
                if date_to:
                    child_filter[f'{child_date_key}__lte'] = date_to

                child_count = child['model'].objects.filter(**child_filter).count()
                children_counts.append({
                    'label': child['label'],
                    'count': child_count,
                })

            result.append({
                'key': table_key,
                'label': info['label'],
                'count': parent_count,
                'children': children_counts,
            })

        return Response(result)

    @action(detail=False, methods=['post'])
    def export(self, request):
        """
        Export data to be purged as a ZIP of CSV files.
        Body: { tables: [...], date_from: "...", date_to: "..." }
        """
        tables = request.data.get('tables', [])
        date_from = request.data.get('date_from')
        date_to = request.data.get('date_to')

        if not tables:
            return Response({'detail': 'Veuillez sélectionner au moins une table.'}, status=status.HTTP_400_BAD_REQUEST)

        registry = _get_purge_registry()

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            for table_key in tables:
                info = registry.get(table_key)
                if not info:
                    continue

                date_filter = _build_date_filter(info['date_field'], date_from, date_to)
                parent_qs = info['model'].objects.filter(**date_filter)

                # Export parent
                csv_content = _queryset_to_csv(parent_qs, info['model'])
                zf.writestr(f'{table_key}.csv', csv_content)

                # Export children
                for child in info['children']:
                    fk_path = child['fk']
                    child_date_key = f'{fk_path}__{info["date_field"]}'
                    child_filter = {}
                    if date_from:
                        child_filter[f'{child_date_key}__gte'] = date_from
                    if date_to:
                        child_filter[f'{child_date_key}__lte'] = date_to

                    child_qs = child['model'].objects.filter(**child_filter)
                    csv_content = _queryset_to_csv(child_qs, child['model'])
                    child_name = child['label'].lower().replace(' ', '_').replace("'", '')
                    zf.writestr(f'{table_key}_{child_name}.csv', csv_content)

        zip_buffer.seek(0)
        now_str = timezone.now().strftime('%Y%m%d_%H%M')
        response = HttpResponse(zip_buffer.read(), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="purge_backup_{now_str}.zip"'
        return response

    @action(detail=False, methods=['post'])
    def purge(self, request):
        """
        Execute the purge (DELETE). Requires superadmin password confirmation.
        Body: { tables: [...], date_from: "...", date_to: "...", password: "xxx" }
        """
        tables = request.data.get('tables', [])
        date_from = request.data.get('date_from')
        date_to = request.data.get('date_to')
        password = request.data.get('password', '')

        if not tables:
            return Response({'detail': 'Veuillez sélectionner au moins une table.'}, status=status.HTTP_400_BAD_REQUEST)

        if not password:
            return Response({'detail': 'Le mot de passe est requis pour confirmer la purge.'}, status=status.HTTP_400_BAD_REQUEST)

        # Verify superadmin password
        user = authenticate(username=request.user.username, password=password)
        if user is None or not user.is_superuser:
            return Response({'detail': 'Mot de passe incorrect.'}, status=status.HTTP_403_FORBIDDEN)

        registry = _get_purge_registry()
        results = []

        with transaction.atomic():
            for table_key in tables:
                info = registry.get(table_key)
                if not info:
                    continue

                date_filter = _build_date_filter(info['date_field'], date_from, date_to)
                qs = info['model'].objects.filter(**date_filter)
                count = qs.count()
                qs.delete()  # CASCADE will handle children automatically

                results.append({
                    'key': table_key,
                    'label': info['label'],
                    'deleted': count,
                })

        # Log the purge action
        try:
            from api.models.audit import AuditLog
            AuditLog.objects.create(
                user=request.user,
                action=AuditLog.Action.DELETE,
                model_name='Purge',
                description=f"Purge de données: {', '.join(tables)} du {date_from or 'début'} au {date_to or 'fin'}",
                details={'tables': tables, 'date_from': date_from, 'date_to': date_to, 'results': results},
            )
        except Exception:
            pass  # Don't fail the purge if audit logging fails

        return Response({
            'message': 'Purge effectuée avec succès.',
            'results': results,
        })
