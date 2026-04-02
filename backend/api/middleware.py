# -*- coding: utf-8 -*-
"""
Middleware de protection du serveur :
- CrashGuardMiddleware : intercepte les exceptions non gérées pour éviter qu'elles ne tuent le worker.
- HealthCheckMiddleware : endpoint /api/health/ rapide, avant tout traitement DRF.
- MemoryWatchdogMiddleware : surveille la consommation mémoire et log des alertes.
"""
import logging
import os
import time
import traceback

from django.conf import settings
from django.db import connection
from django.http import JsonResponse

logger = logging.getLogger('api')
business_logger = logging.getLogger('api.business')


# ──────────────────────────────────────────────────────────────────────────────
# 1. Crash Guard — Dernier filet de sécurité
# ──────────────────────────────────────────────────────────────────────────────
class CrashGuardMiddleware:
    """
    Intercepte les exceptions fatales (non gérées par DRF) pour :
    - Empêcher le crash du worker Gunicorn / runserver
    - Logger le traceback complet dans error.log
    - Retourner un JSON 500 propre au client
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            response = self.get_response(request)
            return response
        except Exception as exc:
            # Ne pas intercepter SystemExit / KeyboardInterrupt
            if isinstance(exc, (SystemExit, KeyboardInterrupt)):
                raise

            logger.critical(
                "CrashGuard — Exception fatale interceptée sur %s %s\n%s",
                request.method,
                request.path,
                traceback.format_exc(),
            )

            return JsonResponse(
                {
                    "error": "Erreur interne du serveur",
                    "detail": (
                        str(exc) if settings.DEBUG
                        else "Une erreur inattendue est survenue. L'équipe technique a été notifiée."
                    ),
                },
                status=500,
            )


# ──────────────────────────────────────────────────────────────────────────────
# 2. Health Check — Endpoint léger pour monitoring / Docker
# ──────────────────────────────────────────────────────────────────────────────
class HealthCheckMiddleware:
    """
    Répond directement à GET /api/health/ sans passer par le routage Django/DRF.
    Vérifie :
    - Connexion DB (requête SELECT 1)
    - Espace disque disponible
    - Accessibilité des logs en écriture
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == '/api/health/' and request.method == 'GET':
            return self._health_response()
        return self.get_response(request)

    def _health_response(self):
        checks = {}
        overall_ok = True

        # ── DB ──
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            checks['database'] = {'status': 'ok'}
        except Exception as e:
            checks['database'] = {'status': 'error', 'detail': str(e)}
            overall_ok = False

        # ── Disk space ──
        try:
            disk_info = self._get_disk_space()
            free_mb = disk_info['free_mb']
            checks['disk'] = {
                'status': 'ok' if free_mb > 500 else 'warning',
                'free_mb': free_mb,
                'total_mb': disk_info['total_mb'],
            }
            if free_mb < 100:
                checks['disk']['status'] = 'critical'
                overall_ok = False
        except Exception as e:
            checks['disk'] = {'status': 'error', 'detail': str(e)}

        # ── Logs writable ──
        try:
            log_dir = settings.BASE_DIR / 'logs'
            test_file = log_dir / '.health_check_test'
            test_file.write_text('ok')
            test_file.unlink()
            checks['logs'] = {'status': 'ok'}
        except Exception as e:
            checks['logs'] = {'status': 'error', 'detail': str(e)}
            overall_ok = False

        # ── Backup directory ──
        try:
            backup_dir = settings.BASE_DIR / 'backups'
            if backup_dir.exists():
                backup_files = list(backup_dir.glob('backup_*.sql.gz'))
                latest = None
                if backup_files:
                    latest = max(backup_files, key=lambda f: f.stat().st_mtime)
                    age_hours = (time.time() - latest.stat().st_mtime) / 3600
                    checks['backups'] = {
                        'status': 'ok' if age_hours < 48 else 'warning',
                        'latest': latest.name,
                        'age_hours': round(age_hours, 1),
                        'count': len(backup_files),
                    }
                else:
                    checks['backups'] = {'status': 'warning', 'detail': 'Aucune sauvegarde trouvée'}
            else:
                checks['backups'] = {'status': 'warning', 'detail': 'Dossier backups inexistant'}
        except Exception as e:
            checks['backups'] = {'status': 'error', 'detail': str(e)}

        status_code = 200 if overall_ok else 503
        return JsonResponse(
            {
                'status': 'healthy' if overall_ok else 'unhealthy',
                'checks': checks,
            },
            status=status_code,
        )

    @staticmethod
    def _get_disk_space():
        """Retourne l'espace disque en MB pour le volume courant."""
        import shutil
        usage = shutil.disk_usage(settings.BASE_DIR)
        return {
            'free_mb': round(usage.free / (1024 * 1024)),
            'total_mb': round(usage.total / (1024 * 1024)),
        }


# ──────────────────────────────────────────────────────────────────────────────
# 3. Memory Watchdog — Alerte si la mémoire explose
# ──────────────────────────────────────────────────────────────────────────────
class MemoryWatchdogMiddleware:
    """
    Surveille la consommation mémoire du processus.
    Log un WARNING si > 80% de la RAM système ou si le processus > 512 MB.
    Ne vérifie que toutes les 60 secondes (pas à chaque requête) pour la perf.
    """

    CHECK_INTERVAL = 60  # secondes entre chaque vérification
    PROCESS_MB_THRESHOLD = 512  # MB par processus

    def __init__(self, get_response):
        self.get_response = get_response
        self._last_check = 0

    def __call__(self, request):
        now = time.time()
        if now - self._last_check > self.CHECK_INTERVAL:
            self._last_check = now
            self._check_memory()
        return self.get_response(request)

    def _check_memory(self):
        try:
            import psutil
            process = psutil.Process(os.getpid())
            mem_info = process.memory_info()
            process_mb = mem_info.rss / (1024 * 1024)

            if process_mb > self.PROCESS_MB_THRESHOLD:
                logger.warning(
                    "MemoryWatchdog — Le processus utilise %.0f MB (seuil: %d MB). PID=%d",
                    process_mb,
                    self.PROCESS_MB_THRESHOLD,
                    os.getpid(),
                )

            sys_mem = psutil.virtual_memory()
            if sys_mem.percent > 85:
                logger.warning(
                    "MemoryWatchdog — RAM système à %.1f%% (%.0f MB libre sur %.0f MB)",
                    sys_mem.percent,
                    sys_mem.available / (1024 * 1024),
                    sys_mem.total / (1024 * 1024),
                )
        except ImportError:
            # psutil non installé — on désactive silencieusement
            self.CHECK_INTERVAL = 999999  # Ne plus vérifier
        except Exception as e:
            logger.debug("MemoryWatchdog — Erreur lors du check mémoire: %s", e)
