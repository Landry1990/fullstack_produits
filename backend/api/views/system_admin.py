"""
System Administration ViewSet.
Superadmin-only: Docker health, backup management.
"""
import os
import subprocess
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
        containers = [settings.DOCKER_DB_CONTAINER, settings.DOCKER_BACKEND_CONTAINER]
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
        """Lance un backup manuel immédiat via la commande Django backup_database."""
        from io import StringIO

        from django.core.management import call_command

        out = StringIO()
        err = StringIO()

        try:
            call_command('backup_database', stdout=out, stderr=err)
            output = out.getvalue()
            err.getvalue()

            # La commande backup_database retourne une erreur si pg_dump est introuvable
            if 'pg_dump not found' in output:
                return Response({
                    'success': False,
                    'output': output[-2000:],
                    'error': 'pg_dump non trouvé. Installez postgresql-client dans le conteneur.',
                    'message': 'Erreur: pg_dump introuvable',
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            if 'Backup failed' in output:
                return Response({
                    'success': False,
                    'output': output[-2000:],
                    'error': output[-500:],
                    'message': 'Erreur lors du backup',
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            return Response({
                'success': True,
                'output': output[-2000:],
                'error': '',
                'message': 'Backup effectué avec succès',
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'output': out.getvalue()[-2000:],
                'error': str(e),
                'message': 'Erreur lors du backup',
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def fix_restart_policy(self, request):
        """Applique unless-stopped sur les conteneurs Docker."""
        containers = [settings.DOCKER_DB_CONTAINER, settings.DOCKER_BACKEND_CONTAINER]
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
        import tempfile
        from io import StringIO

        from django.core.management import call_command

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
                {'detail': f'Erreur: {e!s}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        finally:
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)

    @action(detail=False, methods=['get'])
    def wal_status(self, request):
        """Retourne le statut de l'archivage WAL (PITR)."""
        wal_dir = Path('/wal_archive')
        if not wal_dir.exists():
            wal_dir = Path(settings.BASE_DIR).parent / 'wal_archive'

        wal_files = []
        wal_count = 0
        wal_size_mb = 0
        oldest_wal = None
        newest_wal = None

        if wal_dir.exists():
            wal_files = sorted(wal_dir.glob('*'), key=lambda f: f.stat().st_mtime)
            wal_count = len(wal_files)
            wal_size_mb = round(sum(f.stat().st_size for f in wal_files) / (1024 * 1024), 2)
            if wal_files:
                oldest_wal = datetime.fromtimestamp(wal_files[0].stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                newest_wal = datetime.fromtimestamp(wal_files[-1].stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')

        # Vérifier si l'archivage est actif via SQL
        archive_active = False
        try:
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("SHOW archive_mode;")
                row = cursor.fetchone()
                archive_active = row and row[0] == 'on'
        except Exception:
            pass

        # Lister les base backups disponibles
        base_dir = _get_backup_dir() / 'base'
        base_backups = []
        if base_dir.exists():
            for d in sorted(base_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
                if d.is_dir() and d.name.startswith('base-'):
                    # Calculer la taille réelle du dossier (récursif)
                    total_size = sum(f.stat().st_size for f in d.rglob('*') if f.is_file())
                    base_backups.append({
                        'name': d.name,
                        'size_mb': round(total_size / (1024 * 1024), 2),
                        'created_at': datetime.fromtimestamp(d.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                    })

        return Response({
            'archive_active': archive_active,
            'wal_count': wal_count,
            'wal_size_mb': wal_size_mb,
            'oldest_wal': oldest_wal,
            'newest_wal': newest_wal,
            'wal_directory': str(wal_dir),
            'base_backups': base_backups[:10],
            'base_backups_count': len(base_backups),
        })

    @action(detail=False, methods=['post'])
    def base_backup(self, request):
        """Lance un pg_basebackup pour créer un backup de base compatible WAL."""
        from io import StringIO

        from django.core.management import call_command

        out = StringIO()
        err = StringIO()

        try:
            call_command('base_backup', stdout=out, stderr=err)
            output = out.getvalue()
            errors = err.getvalue()
            success = '[OK]' in output

            return Response({
                'success': success,
                'output': output[-3000:],
                'error': errors if not success else '',
                'message': 'Base backup créé avec succès' if success else 'Erreur lors du base backup',
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'output': out.getvalue()[-3000:],
                'error': str(e),
                'message': 'Erreur lors du base backup',
            }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def pitr_restore(self, request):
        """Restauration PITR: base backup + replay WAL jusqu'au timestamp."""
        from io import StringIO

        from django.core.management import call_command

        base_backup_dir = request.data.get('base_backup_dir', '')
        target_time = request.data.get('target_time', '')

        if not base_backup_dir:
            # Utiliser le plus récent base backup
            base_dir = _get_backup_dir() / 'base'
            if base_dir.exists():
                bases = sorted(base_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
                for b in bases:
                    if b.is_dir() and b.name.startswith('base-'):
                        base_backup_dir = str(b)
                        break
            if not base_backup_dir:
                return Response(
                    {'detail': 'Aucun base backup trouvé. Lancez d\'abord un base backup.'},
                    status=status.HTTP_404_NOT_FOUND
                )

        out = StringIO()
        err = StringIO()

        try:
            cmd_args = [base_backup_dir]
            if target_time:
                cmd_args.append(f'--target-time={target_time}')
            cmd_args.append('--no-confirm')

            call_command(
                'pitr_restore',
                *cmd_args,
                stdout=out,
                stderr=err
            )
            output = out.getvalue()
            errors = err.getvalue()
            success = 'TERMINÉE' in output

            return Response({
                'success': success,
                'output': output,
                'error': errors if not success else '',
                'message': 'Restauration PITR terminée' if success else 'Erreur lors de la restauration PITR',
            }, status=status.HTTP_200_OK if success else status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response(
                {'detail': f'Erreur: {e!s}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def check_update(self, request):
        """Vérifie si une mise à jour est disponible sur GitHub."""
        import subprocess as sp
        import urllib.request
        import json

        app_dir = os.environ.get('APP_DIR', '/opt/zenith-pharma')
        repo = os.environ.get('GITHUB_REPO', 'Landry1990/fullstack_produits').strip('/')

        def _get_local_commit():
            # Essayer git d'abord
            try:
                proc = sp.run(['git', 'rev-parse', 'HEAD'],
                              capture_output=True, text=True, timeout=10, cwd=app_dir)
                if proc.returncode == 0 and proc.stdout.strip():
                    return proc.stdout.strip()
            except Exception:
                pass
            # Fallback : lire .git/HEAD
            head_file = os.path.join(app_dir, '.git', 'HEAD')
            ref_file = os.path.join(app_dir, '.git', 'refs', 'heads', 'main')
            if os.path.exists(ref_file):
                with open(ref_file, 'r') as f:
                    return f.read().strip()
            if os.path.exists(head_file):
                with open(head_file, 'r') as f:
                    ref = f.read().strip()
                    if ref.startswith('ref:'):
                        ref_path = ref.split()[-1]
                        full_ref = os.path.join(app_dir, '.git', ref_path)
                        if os.path.exists(full_ref):
                            with open(full_ref, 'r') as f2:
                                return f2.read().strip()
            return 'unknown'

        def _get_remote_commit():
            # Essayer git fetch + rev-parse
            try:
                sp.run(['git', 'fetch', 'origin', 'main', '--quiet'],
                       capture_output=True, timeout=30, cwd=app_dir)
                proc = sp.run(['git', 'rev-parse', 'origin/main'],
                              capture_output=True, text=True, timeout=10, cwd=app_dir)
                if proc.returncode == 0 and proc.stdout.strip():
                    return proc.stdout.strip()
            except Exception:
                pass
            # Fallback API GitHub publique
            try:
                url = f'https://api.github.com/repos/{repo}/commits/main'
                req = urllib.request.Request(url, headers={'Accept': 'application/vnd.github+json'})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    return data.get('sha', '')
            except Exception:
                return ''

        local_commit = _get_local_commit()
        remote_commit = _get_remote_commit()

        if not remote_commit:
            return Response({
                'update_available': False,
                'current_version': local_commit[:8] if len(local_commit) >= 8 else local_commit,
                'error': 'Impossible de contacter GitHub',
                'message': 'Impossible de vérifier les mises à jour',
            }, status=status.HTTP_200_OK)

        if local_commit == remote_commit:
            return Response({
                'update_available': False,
                'current_version': local_commit[:8] if len(local_commit) >= 8 else local_commit,
                'message': 'Système déjà à jour',
            })
        return Response({
            'update_available': True,
            'current_version': local_commit[:8] if len(local_commit) >= 8 else local_commit,
            'latest_version': remote_commit[:8] if len(remote_commit) >= 8 else remote_commit,
            'message': 'Une mise à jour est disponible',
        })

    @action(detail=False, methods=['post'])
    def run_update(self, request):
        """Lance le script nightly-update.sh pour mettre à jour le système."""
        import threading
        import subprocess as sp

        app_dir = os.environ.get('APP_DIR', '/opt/zenith-pharma')
        script_path = os.path.join(app_dir, 'nightly-update.sh')

        if not os.path.exists(script_path):
            return Response({
                'success': False,
                'message': 'Script de mise à jour introuvable',
            }, status=status.HTTP_404_NOT_FOUND)

        # Vérifier la connexion internet
        try:
            sp.run(['ping', '-c', '1', 'github.com'],
                   capture_output=True, timeout=10)
        except Exception:
            return Response({
                'success': False,
                'message': 'Pas de connexion Internet — mise à jour impossible',
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # Lancer le script en arrière-plan (peut prendre plusieurs minutes)
        def _run_update():
            try:
                os.chmod(script_path, 0o755)
            except Exception:
                pass
            sp.run(
                ['bash', script_path],
                capture_output=True,
                timeout=900,  # 15 min max
                cwd=app_dir,
            )

        thread = threading.Thread(target=_run_update, daemon=True)
        thread.start()

        return Response({
            'success': True,
            'message': 'Mise à jour lancée — l\'application sera temporairement indisponible pendant quelques minutes',
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def update_schedule(self, request):
        """Retourne l'heure de mise à jour automatique configurée."""
        import re
        app_dir = os.environ.get('APP_DIR', '/opt/zenith-pharma')
        conf_file = os.path.join(app_dir, 'update-time.conf')

        # Lire la préférence
        update_time = '02:00'
        auto_update_enabled = True

        if os.path.exists(conf_file):
            try:
                with open(conf_file, 'r') as f:
                    content = f.read().strip()
                if content.startswith('DISABLED'):
                    auto_update_enabled = False
                elif re.match(r'^[0-2][0-9]:[0-5][0-9]$', content):
                    update_time = content
            except Exception:
                pass

        # Lire l'heure actuelle du timer systemd
        timer_file = '/etc/systemd/system/zenith-nightly-update.timer'
        if os.path.exists(timer_file):
            try:
                with open(timer_file, 'r') as f:
                    for line in f:
                        if 'OnCalendar' in line:
                            match = re.search(r'(\d{2}:\d{2}):\d{2}', line)
                            if match:
                                update_time = match.group(1)
            except Exception:
                pass

        return Response({
            'update_time': update_time,
            'auto_update_enabled': auto_update_enabled,
        })

    @action(detail=False, methods=['post'])
    def set_update_schedule(self, request):
        """Modifie l'heure de mise à jour automatique."""
        import subprocess as sp

        update_time = request.data.get('update_time', '02:00')
        auto_update_enabled = request.data.get('auto_update_enabled', True)
        app_dir = os.environ.get('APP_DIR', '/opt/zenith-pharma')
        conf_file = os.path.join(app_dir, 'update-time.conf')
        script_path = os.path.join(app_dir, 'set-update-time.sh')

        if not auto_update_enabled:
            # Désactiver la mise à jour automatique
            try:
                with open(conf_file, 'w') as f:
                    f.write('DISABLED')
                sp.run(['docker', 'run', '--rm', '--privileged', '--pid=host',
                        '-v', '/etc/systemd/system:/etc/systemd/system',
                        'alpine:latest', 'sh', '-c',
                        'systemctl stop zenith-nightly-update.timer 2>/dev/null; '
                        'systemctl disable zenith-nightly-update.timer 2>/dev/null; '
                        'true'],
                       capture_output=True, timeout=30)
                return Response({
                    'success': True,
                    'message': 'Mise à jour automatique désactivée. Vous devrez lancer les mises à jour manuellement.',
                })
            except Exception as e:
                return Response({
                    'success': False,
                    'message': f'Erreur: {e!s}',
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Valider le format HH:MM
        import re
        if not re.match(r'^[0-2][0-9]:[0-5][0-9]$', update_time):
            return Response({
                'success': False,
                'message': 'Format invalide. Utilisez HH:MM (ex: 02:00, 03:30)',
            }, status=status.HTTP_400_BAD_REQUEST)

        if not os.path.exists(script_path):
            return Response({
                'success': False,
                'message': 'Script set-update-time.sh introuvable',
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            # Écrire la préférence
            with open(conf_file, 'w') as f:
                f.write(update_time)

            # Lancer le script via un conteneur privilégié (accès systemd sur l'hôte)
            result = sp.run([
                'docker', 'run', '--rm', '--privileged', '--pid=host',
                '-v', '/etc/systemd/system:/etc/systemd/system',
                '-v', f'{app_dir}:{app_dir}',
                'alpine:latest', 'sh', '-c',
                f'apk add --no-cache bash >/dev/null 2>&1; '
                f'bash {script_path} {update_time}'
            ], capture_output=True, text=True, timeout=60)

            if result.returncode == 0:
                return Response({
                    'success': True,
                    'update_time': update_time,
                    'message': f'Mise à jour automatique configurée à {update_time}',
                })
            else:
                return Response({
                    'success': False,
                    'message': result.stderr.strip() or 'Erreur lors de la configuration',
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Erreur: {e!s}',
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
