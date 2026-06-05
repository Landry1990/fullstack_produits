# -*- coding: utf-8 -*-
"""
System Administration ViewSet.
Superadmin-only: Docker health, backup management.
"""
import os
import subprocess
import hashlib
from datetime import datetime
from pathlib import Path

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet


def _get_backup_dir() -> Path:
    return Path(settings.BASE_DIR).parent / 'backups'


def _get_backup_script() -> Path:
    return Path(settings.BASE_DIR).parent / 'backup-db.sh'


class SystemAdminViewSet(ViewSet):
    """
    Superadmin-only: Docker health check + backup management.
    """
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['get'])
    def status(self, request):
        """Retourne l'état des conteneurs Docker et du dernier backup."""
        containers = ['fullstack_produits-db-1', 'fullstack_produits-backend-1']
        docker_status = []

        for name in containers:
            try:
                result = subprocess.run(
                    ['docker', 'inspect', '--format',
                     '{{.State.Running}}|{{.HostConfig.RestartPolicy.Name}}|{{.State.StartedAt}}',
                     name],
                    capture_output=True, text=True, timeout=5
                )
                if result.returncode == 0:
                    parts = result.stdout.strip().split('|')
                    running = parts[0] == 'true' if len(parts) > 0 else False
                    restart_policy = parts[1] if len(parts) > 1 else 'unknown'
                    started_at = parts[2][:19].replace('T', ' ') if len(parts) > 2 else None
                    docker_status.append({
                        'name': name,
                        'running': running,
                        'restart_policy': restart_policy,
                        'started_at': started_at,
                        'auto_restart': restart_policy in ('always', 'unless-stopped'),
                    })
                else:
                    docker_status.append({
                        'name': name,
                        'running': False,
                        'restart_policy': 'unknown',
                        'started_at': None,
                        'auto_restart': False,
                        'error': result.stderr.strip(),
                    })
            except Exception as e:
                docker_status.append({
                    'name': name,
                    'running': False,
                    'restart_policy': 'unknown',
                    'started_at': None,
                    'auto_restart': False,
                    'error': str(e),
                })

        # Infos du dernier backup
        backup_dir = _get_backup_dir()
        last_backup = None
        backup_count = 0

        if backup_dir.exists():
            backups = sorted(backup_dir.glob('backup-*.sql'), key=lambda f: f.stat().st_mtime, reverse=True)
            backup_count = len(backups)
            if backups:
                latest = backups[0]
                stat = latest.stat()
                age_hours = (datetime.now().timestamp() - stat.st_mtime) / 3600
                checksum_file = latest.with_suffix('.sql.md5')
                last_backup = {
                    'filename': latest.name,
                    'size_mb': round(stat.st_size / (1024 * 1024), 2),
                    'age_hours': round(age_hours, 1),
                    'has_checksum': checksum_file.exists(),
                    'status': 'ok' if age_hours < 2 else ('warning' if age_hours < 24 else 'critical'),
                }

        return Response({
            'docker': docker_status,
            'backup': {
                'last': last_backup,
                'count': backup_count,
                'directory': str(backup_dir),
            }
        })

    @action(detail=False, methods=['get'])
    def backups(self, request):
        """Liste tous les fichiers de backup disponibles."""
        backup_dir = _get_backup_dir()
        if not backup_dir.exists():
            return Response({'backups': [], 'total': 0})

        backups = sorted(backup_dir.glob('backup-*.sql'), key=lambda f: f.stat().st_mtime, reverse=True)
        result = []
        for f in backups:
            stat = f.stat()
            checksum_file = f.with_suffix('.sql.md5')
            checksum = None
            if checksum_file.exists():
                try:
                    checksum = checksum_file.read_text().strip().split()[0]
                except Exception:
                    pass
            result.append({
                'filename': f.name,
                'size_mb': round(stat.st_size / (1024 * 1024), 2),
                'created_at': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                'has_checksum': checksum_file.exists(),
                'checksum': checksum,
                'age_hours': round((datetime.now().timestamp() - stat.st_mtime) / 3600, 1),
            })

        return Response({'backups': result, 'total': len(result)})

    @action(detail=False, methods=['post'])
    def run_backup(self, request):
        """Lance un backup manuel immédiat."""
        script = _get_backup_script()
        if not script.exists():
            return Response(
                {'detail': f'Script de backup introuvable: {script}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        try:
            result = subprocess.run(
                ['bash', str(script), '--retention-days', '30'],
                capture_output=True, text=True, timeout=120,
                cwd=str(script.parent)
            )
            success = result.returncode == 0
            return Response({
                'success': success,
                'output': result.stdout[-2000:] if result.stdout else '',
                'error': result.stderr[-500:] if result.stderr and not success else '',
                'message': 'Backup effectué avec succès' if success else 'Erreur lors du backup',
            }, status=status.HTTP_200_OK if success else status.HTTP_500_INTERNAL_SERVER_ERROR)
        except subprocess.TimeoutExpired:
            return Response(
                {'detail': 'Le backup a dépassé le délai de 120 secondes.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            return Response(
                {'detail': f'Erreur: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def fix_restart_policy(self, request):
        """Applique unless-stopped sur les conteneurs Docker."""
        containers = ['fullstack_produits-db-1', 'fullstack_produits-backend-1']
        results = []

        for name in containers:
            try:
                result = subprocess.run(
                    ['docker', 'update', '--restart=unless-stopped', name],
                    capture_output=True, text=True, timeout=10
                )
                results.append({
                    'container': name,
                    'success': result.returncode == 0,
                    'error': result.stderr.strip() if result.returncode != 0 else None,
                })
            except Exception as e:
                results.append({'container': name, 'success': False, 'error': str(e)})

        all_ok = all(r['success'] for r in results)
        return Response({
            'results': results,
            'message': 'Politique de redémarrage appliquée' if all_ok else 'Erreurs partielles',
        }, status=status.HTTP_200_OK if all_ok else status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def restore(self, request):
        """Restaure la base de données depuis un backup existant ou un fichier uploadé."""
        from django.core.management import call_command
        from io import StringIO
        import tempfile
        import shutil

        # Récupérer le fichier soit par nom, soit par upload
        uploaded_file = request.FILES.get('file')
        filename = request.data.get('filename')

        backup_path = None
        temp_path = None

        try:
            if uploaded_file:
                # Sauvegarder le fichier uploadé temporairement
                suffix = '.sql.gz' if uploaded_file.name.endswith('.gz') else '.sql'
                with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                    for chunk in uploaded_file.chunks():
                        tmp.write(chunk)
                    temp_path = tmp.name
                backup_path = temp_path
            elif filename:
                backup_dir = _get_backup_dir()
                backup_path = backup_dir / filename
                if not backup_path.exists():
                    return Response(
                        {'detail': f'Fichier introuvable: {filename}'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            else:
                return Response(
                    {'detail': 'Fournissez un fichier (file) ou un nom de backup (filename)'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Capturer la sortie de la commande
            out = StringIO()
            err = StringIO()

            call_command(
                'restore_database',
                str(backup_path),
                '--no-confirm',
                stdout=out,
                stderr=err
            )

            output = out.getvalue()
            errors = err.getvalue()

            success = 'successfully' in output.lower() or 'restored successfully' in output.lower()

            return Response({
                'success': success,
                'output': output,
                'error': errors,
                'message': 'Restauration terminée' if success else 'Erreur pendant la restauration',
            }, status=status.HTTP_200_OK if success else status.HTTP_500_INTERNAL_SERVER_ERROR)

        except Exception as e:
            return Response(
                {'detail': f'Erreur: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        finally:
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)
