from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        import api.signals
        import api.signals_restock # Register restock signals
        import api.cache_signals # Register cache invalidation signals
