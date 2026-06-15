# -*- coding: utf-8 -*-
"""
Data Purge / Maintenance ViewSet.
Superadmin-only tool to preview, export and purge old transactional data.
"""
import csv
import io
import os
import zipfile
from datetime import datetime
from io import StringIO

from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet
from django.contrib.auth import authenticate
from django.core.management import call_command
from django.conf import settings


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
        user = request.user
        password_valid = (
            user.check_password(password) or
            user.check_password(password.lower()) or
            user.check_password(password.upper()) or
            user.check_password(password.capitalize())
        )
        
        if not password_valid or not user.is_superuser:
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

    @action(detail=False, methods=['post'])
    def backup(self, request):
        """
        Trigger a manual database backup.
        """
        try:
            # We use call_command to run the existing management command
            from io import StringIO
            out = StringIO()
            call_command('backup_database', stdout=out)
            output = out.getvalue()
            
            # Check if double backup is needed (copying to secondary path)
            from api.models.settings import PharmacySettings
            import shutil
            import os
            
            settings, _ = PharmacySettings.objects.get_or_create(pk=1)
            secondary_msg = ""
            
            if settings.secondary_backup_path:
                if os.path.exists(settings.secondary_backup_path):
                    # Find the latest backup file
                    from django.conf import settings as django_settings
                    backup_dir = os.path.join(django_settings.BASE_DIR, 'backups')
                    backups = [f for f in os.listdir(backup_dir) if f.endswith('.sql.gz')]
                    if backups:
                        latest_backup = max([os.path.join(backup_dir, f) for f in backups], key=os.path.getmtime)
                        dest_path = os.path.join(settings.secondary_backup_path, os.path.basename(latest_backup))
                        shutil.copy2(latest_backup, dest_path)
                        secondary_msg = f" + Copie secondaire effectuée vers {settings.secondary_backup_path}"
                else:
                    secondary_msg = f" (Note: Chemin secondaire {settings.secondary_backup_path} inaccessible)"

            return Response({
                'message': f'Sauvegarde terminée avec succès.{secondary_msg}',
                'details': output
            })
        except Exception as e:
            return Response({'detail': f'Erreur lors de la sauvegarde: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def restore(self, request):
        """
        Execute the restoration. Requires superadmin password confirmation.
        Body (FormData): { file: <binary>, password: "xxx" }
        """
        password = request.data.get('password', '')
        file_obj = request.FILES.get('file')

        if not file_obj:
            return Response({'detail': 'Fichier de sauvegarde requis.'}, status=status.HTTP_400_BAD_REQUEST)

        if not password:
            return Response({'detail': 'Le mot de password est requis pour confirmer la restauration.'}, status=status.HTTP_400_BAD_REQUEST)

        # Verify superadmin password
        user = request.user
        password_valid = user.check_password(password)
        
        if not password_valid or not user.is_superuser:
            return Response({'detail': 'Mot de passe incorrect ou droits insuffisants.'}, status=status.HTTP_403_FORBIDDEN)

        # Save uploaded file to a temporary location
        import tempfile
        import os
        from io import StringIO

        with tempfile.NamedTemporaryFile(suffix='.sql.gz', delete=False) as tmp:
            for chunk in file_obj.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        try:
            self.stdout = StringIO()
            # Call the restoration command
            call_command('restore_database', tmp_path, no_confirm=True, stdout=self.stdout)
            output = self.stdout.getvalue()
            
            # Clean up
            os.unlink(tmp_path)

            return Response({
                'message': 'Base de données restaurée avec succès.',
                'details': output
            })
        except Exception as e:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            return Response({'detail': f'Erreur lors de la restauration: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def produits_count(self, request):
        """Retourne le nombre de produits en base."""
        from api.models import Produit
        return Response({'count': Produit.objects.count()})

    @action(detail=False, methods=['post'])
    def import_produits(self, request):
        """
        Lance l'import en tâche de fond (thread séparé).
        Retourne immédiatement un job_id pour suivre la progression.
        """
        import tempfile, threading, uuid, json, glob, re
        from django.core.cache import cache

        # Vérifier qu'un import n'est pas déjà en cours
        running = cache.get('import_produits_running')
        if running:
            return Response({'detail': 'Un import est déjà en cours. Attendez la fin avant de relancer.'}, status=status.HTTP_409_CONFLICT)

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'detail': 'Aucun fichier fourni.'}, status=status.HTTP_400_BAD_REQUEST)

        suffix = os.path.splitext(file_obj.name)[1].lower()
        if suffix not in ['.xlsx', '.xls', '.csv']:
            return Response({'detail': 'Format non supporté. Utilisez .xlsx, .xls ou .csv'}, status=status.HTTP_400_BAD_REQUEST)

        # Sauvegarder le fichier dans un endroit persistant
        os.makedirs(settings.REPORTS_DIR, exist_ok=True)
        job_id = str(uuid.uuid4())[:8]
        tmp_path = os.path.join(settings.REPORTS_DIR, f'import_tmp_{job_id}{suffix}')
        with open(tmp_path, 'wb') as f:
            for chunk in file_obj.chunks():
                f.write(chunk)

        # Initialiser l'état dans le cache
        cache.set(f'import_{job_id}', {
            'status': 'running',
            'progress': 0,
            'current': 0,
            'total': 0,
            'created': 0,
            'updated': 0,
            'errors': 0,
            'message': 'Démarrage...',
            'rapport_xlsx': None,
            'rapport_txt': None,
        }, timeout=3600)
        cache.set('import_produits_running', job_id, timeout=3600)

        def run_import():
            try:
                from django.core.cache import cache as c

                # Buffer qui intercepte chaque ligne et met à jour le cache
                class ProgressBuffer:
                    def __init__(self):
                        self._buf = []
                    def write(self, msg, style_func=None, ending=None):
                        self._buf.append(str(msg))
                        state = c.get(f'import_{job_id}') or {}
                        m = re.search(r'(\d+)/(\d+)', str(msg))
                        if m:
                            cur, tot = int(m.group(1)), int(m.group(2))
                            state['current'] = cur
                            state['total'] = tot
                            state['progress'] = int(cur / tot * 100) if tot else 0
                            state['message'] = f'{cur}/{tot} produits traités...'
                            c.set(f'import_{job_id}', state, timeout=3600)
                    def flush(self):
                        pass
                    def getvalue(self):
                        return '\n'.join(self._buf)

                buf = ProgressBuffer()
                call_command('import_excel_csv', file=tmp_path, stdout=buf)
                output = buf.getvalue()

                created = updated = errors = 0
                m = re.search(r'Créés\s*:\s*(\d+)', output)
                if m: created = int(m.group(1))
                m = re.search(r'Mis à jour\s*:\s*(\d+)', output)
                if m: updated = int(m.group(1))
                m = re.search(r'Erreurs\s*:\s*(\d+)', output)
                if m: errors = int(m.group(1))

                rapport_xlsx = rapport_txt = None
                rapports = sorted(glob.glob(os.path.join(settings.REPORTS_DIR, 'rapport_import_*.xlsx')), reverse=True)
                if rapports: rapport_xlsx = os.path.basename(rapports[0])
                rapports_txt = sorted(glob.glob(os.path.join(settings.REPORTS_DIR, 'rapport_import_*.txt')), reverse=True)
                if rapports_txt: rapport_txt = os.path.basename(rapports_txt[0])

                c.set(f'import_{job_id}', {
                    'status': 'done',
                    'progress': 100,
                    'created': created,
                    'updated': updated,
                    'errors': errors,
                    'rapport_xlsx': rapport_xlsx,
                    'rapport_txt': rapport_txt,
                    'message': f'Terminé : {created} créés, {updated} mis à jour, {errors} erreurs.',
                }, timeout=3600)

            except Exception as e:
                from django.core.cache import cache as c
                c.set(f'import_{job_id}', {
                    'status': 'error',
                    'progress': 0,
                    'message': f'Erreur : {str(e)}',
                    'created': 0, 'updated': 0, 'errors': 0,
                    'rapport_xlsx': None, 'rapport_txt': None,
                }, timeout=3600)
            finally:
                from django.core.cache import cache as c
                c.delete('import_produits_running')
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)

        t = threading.Thread(target=run_import, daemon=True)
        t.start()

        return Response({'job_id': job_id, 'message': 'Import lancé en arrière-plan.'}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['get'])
    def import_status(self, request):
        """Retourne l'état d'avancement d'un import en cours."""
        from django.core.cache import cache
        job_id = request.query_params.get('job_id', '')
        if not job_id:
            # Retourner l'import en cours s'il y en a un
            running_id = cache.get('import_produits_running')
            if running_id:
                job_id = running_id
            else:
                return Response({'status': 'idle'})

        state = cache.get(f'import_{job_id}')
        if not state:
            return Response({'status': 'not_found'}, status=status.HTTP_404_NOT_FOUND)
        return Response({**state, 'job_id': job_id})

    @action(detail=False, methods=['post'])
    def purge_produits(self, request):
        """
        Purge les produits.
        Body: { password: str, sans_ventes: bool }
        """
        from api.models import Produit
        from django.contrib.auth import authenticate

        password = request.data.get('password', '')
        sans_ventes = request.data.get('sans_ventes', False)

        if not password:
            return Response({'detail': 'Mot de passe requis.'}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(username=request.user.username, password=password)
        if not user:
            return Response({'detail': 'Mot de passe incorrect.'}, status=status.HTTP_403_FORBIDDEN)

        qs = Produit.objects.all()
        conserves = 0

        if sans_ventes:
            ids_lies = set()
            try:
                from api.models import FactureProduit
                ids_lies |= set(FactureProduit.objects.values_list('produit_id', flat=True).distinct())
            except Exception:
                pass
            try:
                from api.models import CommandeProduit
                ids_lies |= set(CommandeProduit.objects.values_list('produit_id', flat=True).distinct())
            except Exception:
                pass
            conserves = len(ids_lies)
            qs = qs.exclude(id__in=ids_lies)

        total_avant = Produit.objects.count()
        deleted, _ = qs.delete()

        return Response({
            'deleted': deleted,
            'conserves': conserves,
            'total_avant': total_avant,
            'message': f'{deleted} produit(s) supprimé(s). {conserves} conservé(s) (liés à des ventes).',
        })

    @action(detail=False, methods=['get'])
    def download_rapport(self, request):
        """Télécharge un rapport d'import."""
        import glob
        from django.http import FileResponse
        filename = request.query_params.get('file', '')
        if not filename or '/' in filename or '..' in filename:
            return Response({'detail': 'Fichier invalide.'}, status=status.HTTP_400_BAD_REQUEST)
        path = os.path.join(settings.REPORTS_DIR, filename)
        if not os.path.exists(path):
            return Response({'detail': 'Fichier non trouvé.'}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(open(path, 'rb'), as_attachment=True, filename=filename)
