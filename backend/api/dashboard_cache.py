"""
Cache spécifique pour les statistiques du Dashboard.
Optimise les performances des calculs lourds (CA, stock, ventes).
"""
from django.core.cache import cache
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import hashlib
import json


class DashboardCache:
    """
    Gestionnaire de cache pour les statistiques du Dashboard.
    TTL: 5 minutes (300s) pour les stats, 1 minute (60s) pour les alertes temps réel.
    """
    
    # TTL par type de donnée
    STATS_TTL = 300  # 5 minutes pour les statistiques
    ALERTS_TTL = 60  # 1 minute pour les alertes
    CHARTS_TTL = 300  # 5 minutes pour les graphiques
    
    # Préfixes de clés
    PREFIX_STATS = "dashboard_stats"
    PREFIX_REVENUE_CHART = "dashboard_revenue"
    PREFIX_HOURLY_TRAFFIC = "dashboard_traffic"
    PREFIX_LOW_STOCK = "dashboard_lowstock"
    PREFIX_EXPIRING_LOTS = "dashboard_expiring"
    PREFIX_PROMIS = "dashboard_promis"
    PREFIX_MANAGER_STATS = "dashboard_manager"
    PREFIX_ALERTS = "dashboard_alerts"
    
    @classmethod
    def _generate_key(cls, prefix: str, user_id: int = 0, date_str: str = None, **params) -> str:
        """Génère une clé de cache unique."""
        if date_str is None:
            date_str = datetime.now().strftime('%Y-%m-%d')
        
        sorted_params = json.dumps(params, sort_keys=True)
        param_hash = hashlib.md5(sorted_params.encode()).hexdigest()[:8]
        return f"{prefix}:{user_id}:{date_str}:{param_hash}"
    
    # === STATS PRINCIPALES ===
    @classmethod
    def get_stats(cls, user_id: int, role: str) -> Optional[Dict]:
        """Récupère les stats principales du dashboard."""
        key = cls._generate_key(cls.PREFIX_STATS, user_id, role=role)
        return cache.get(key)
    
    @classmethod
    def set_stats(cls, user_id: int, role: str, data: Dict, ttl: int = None) -> None:
        """Stocke les stats principales."""
        key = cls._generate_key(cls.PREFIX_STATS, user_id, role=role)
        cache.set(key, data, ttl or cls.STATS_TTL)
    
    # === GRAPHIQUES ===
    @classmethod
    def get_revenue_chart(cls, user_id: int, period: str = '7d') -> Optional[Dict]:
        """Récupère les données du graphique de CA."""
        key = cls._generate_key(cls.PREFIX_REVENUE_CHART, user_id, period=period)
        return cache.get(key)
    
    @classmethod
    def set_revenue_chart(cls, user_id: int, period: str, data: Dict, ttl: int = None) -> None:
        """Stocke les données du graphique de CA."""
        key = cls._generate_key(cls.PREFIX_REVENUE_CHART, user_id, period=period)
        cache.set(key, data, ttl or cls.CHARTS_TTL)
    
    @classmethod
    def get_hourly_traffic(cls, user_id: int) -> Optional[List]:
        """Récupère les données de trafic horaire."""
        key = cls._generate_key(cls.PREFIX_HOURLY_TRAFFIC, user_id)
        return cache.get(key)
    
    @classmethod
    def set_hourly_traffic(cls, user_id: int, data: List, ttl: int = None) -> None:
        """Stocke les données de trafic horaire."""
        key = cls._generate_key(cls.PREFIX_HOURLY_TRAFFIC, user_id)
        cache.set(key, data, ttl or cls.CHARTS_TTL)
    
    # === STOCK & ALERTES ===
    @classmethod
    def get_low_stock(cls, user_id: int, threshold: int = 10) -> Optional[List]:
        """Récupère la liste des produits en stock bas."""
        key = cls._generate_key(cls.PREFIX_LOW_STOCK, user_id, threshold=threshold)
        return cache.get(key)
    
    @classmethod
    def set_low_stock(cls, user_id: int, threshold: int, data: List, ttl: int = None) -> None:
        """Stocke la liste des produits en stock bas."""
        key = cls._generate_key(cls.PREFIX_LOW_STOCK, user_id, threshold=threshold)
        cache.set(key, data, ttl or cls.ALERTS_TTL)
    
    @classmethod
    def get_expiring_lots(cls, user_id: int, days: int = 30) -> Optional[List]:
        """Récupère les lots proches de l'expiration."""
        key = cls._generate_key(cls.PREFIX_EXPIRING_LOTS, user_id, days=days)
        return cache.get(key)
    
    @classmethod
    def set_expiring_lots(cls, user_id: int, days: int, data: List, ttl: int = None) -> None:
        """Stocke les lots proches de l'expiration."""
        key = cls._generate_key(cls.PREFIX_EXPIRING_LOTS, user_id, days=days)
        cache.set(key, data, ttl or cls.ALERTS_TTL)
    
    @classmethod
    def get_promis(cls, user_id: int) -> Optional[List]:
        """Récupère les promis disponibles."""
        key = cls._generate_key(cls.PREFIX_PROMIS, user_id)
        return cache.get(key)
    
    @classmethod
    def set_promis(cls, user_id: int, data: List, ttl: int = None) -> None:
        """Stocke les promis disponibles."""
        key = cls._generate_key(cls.PREFIX_PROMIS, user_id)
        cache.set(key, data, ttl or cls.ALERTS_TTL)
    
    # === STATS MANAGER ===
    @classmethod
    def get_manager_stats(cls, user_id: int) -> Optional[Dict]:
        """Récupère les stats manager (objectifs, performances)."""
        key = cls._generate_key(cls.PREFIX_MANAGER_STATS, user_id)
        return cache.get(key)
    
    @classmethod
    def set_manager_stats(cls, user_id: int, data: Dict, ttl: int = None) -> None:
        """Stocke les stats manager."""
        key = cls._generate_key(cls.PREFIX_MANAGER_STATS, user_id)
        cache.set(key, data, ttl or cls.STATS_TTL)
    
    @classmethod
    def get_alerts(cls, user_id: int) -> Optional[List]:
        """Récupère les alertes du manager."""
        key = cls._generate_key(cls.PREFIX_ALERTS, user_id)
        return cache.get(key)
    
    @classmethod
    def set_alerts(cls, user_id: int, data: List, ttl: int = None) -> None:
        """Stocke les alertes du manager."""
        key = cls._generate_key(cls.PREFIX_ALERTS, user_id)
        cache.set(key, data, ttl or cls.ALERTS_TTL)
    
    # === INVALIDATION ===
    @classmethod
    def invalidate_user(cls, user_id: int) -> None:
        """Invalide tout le cache pour un utilisateur."""
        try:
            cache.delete_pattern(f"dashboard_*:{user_id}:*")  # type: ignore[attr-defined]
        except AttributeError:
            # LocMemCache: pas de delete_pattern, on invalide tout
            cache.clear()
    
    @classmethod
    def invalidate_all(cls) -> None:
        """Invalide tout le cache du dashboard."""
        try:
            cache.delete_pattern("dashboard_*")  # type: ignore[attr-defined]
        except AttributeError:
            cache.clear()
    
    @classmethod
    def invalidate_on_sale(cls) -> None:
        """
        Invalide les caches impactés par une vente.
        À appeler après chaque vente pour rafraîchir les stats temps réel.
        """
        try:
            # Invalider seulement les stats et graphiques (pas les stocks qui changent moins vite)
            cache.delete_pattern(f"{cls.PREFIX_STATS}:*")
            cache.delete_pattern(f"{cls.PREFIX_REVENUE_CHART}:*")
            cache.delete_pattern(f"{cls.PREFIX_HOURLY_TRAFFIC}:*")
            cache.delete_pattern(f"{cls.PREFIX_PROMIS}:*")
        except AttributeError:
            pass
    
    @classmethod
    def invalidate_on_stock_change(cls) -> None:
        """
        Invalide les caches liés au stock.
        À appeler après réception de commande, ajustement stock, etc.
        """
        try:
            cache.delete_pattern(f"{cls.PREFIX_LOW_STOCK}:*")
            cache.delete_pattern(f"{cls.PREFIX_EXPIRING_LOTS}:*")
        except AttributeError:
            pass


# === DECORATEUR POUR VUES ===
def cache_dashboard_stats(ttl: int = DashboardCache.STATS_TTL):
    """
    Décorateur pour mettre en cache les réponses des vues dashboard.
    Usage: @cache_dashboard_stats(300)
    """
    def decorator(func):
        def wrapper(self, request, *args, **kwargs):
            user_id = request.user.id if request.user.is_authenticated else 0
            role = getattr(request.user, 'role', 'VENDEUR')
            
            # Essayer de récupérer du cache
            cached = DashboardCache.get_stats(user_id, role)
            if cached is not None:
                return Response(cached)
            
            # Exécuter la vue et mettre en cache
            response = func(self, request, *args, **kwargs)
            if response.status_code == 200:
                DashboardCache.set_stats(user_id, role, response.data, ttl)
            
            return response
        return wrapper
    return decorator
