from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        # ── Compat USE_TZ=False : monkey-patch timezone ──────────────────
        # Avec USE_TZ=False, les datetimes DB sont naïves (heure locale).
        # timezone.localtime() crash sur les naïves → on le rend no-op.
        # timezone.make_aware() crée des aware → on le rend identité (naive).
        from django.utils import timezone as _tz
        _orig_localtime = _tz.localtime

        def _safe_localtime(value=None, timezone=None):
            if value is None:
                value = _tz.now()
            if _tz.is_naive(value):
                return value
            return _orig_localtime(value, timezone) if timezone else _orig_localtime(value)

        _tz.localtime = _safe_localtime

        _orig_make_aware = _tz.make_aware

        def _safe_make_aware(value, timezone=None, is_dst=None):
            if _tz.is_aware(value):
                return value
            # Avec USE_TZ=False, on garde naive (heure locale)
            return value

        _tz.make_aware = _safe_make_aware


        # Start the integrated background task runner for automated orders
        from .scheduler import start_background_tasks
        start_background_tasks()
