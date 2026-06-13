from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        import api.signals
        import api.signals_depot
        import api.signals_comptabilite
        import api.cache_invalidation
        import api.signals_rotation  # Rotation auto après chaque vente
        import api.signals_stock_levels  # Seuils min/max auto
        
        # Start the integrated background task runner for automated orders
        from .scheduler import start_background_tasks
        start_background_tasks()
