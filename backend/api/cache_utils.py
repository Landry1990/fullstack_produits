"""
Utilitaires de cache pour optimiser les performances des recherches fréquentes.
"""
from django.core.cache import cache
from django.db.models import QuerySet
from typing import Optional, Any
import hashlib
import json


class SearchCache:
    """
    Gestionnaire de cache pour les recherches de produits.
    Utilise Redis (ou LocMemCache en dev) avec un TTL configurable.
    """
    
    # TTL par défaut: 5 minutes pour les recherches
    DEFAULT_TTL = 300  # secondes
    
    # Préfixes pour différents types de cache
    PREFIX_PRODUCT_SEARCH = "prod_search"
    PREFIX_PRODUCT_LIST = "prod_list"
    PREFIX_PRODUCT_DETAIL = "prod_detail"
    
    @staticmethod
    def _generate_cache_key(prefix: str, **params) -> str:
        """
        Génère une clé de cache unique basée sur les paramètres de recherche.
        
        Args:
            prefix: Préfixe pour identifier le type de cache
            **params: Paramètres de recherche (search, filters, etc.)
        
        Returns:
            Clé de cache unique
        """
        # Trier les paramètres pour garantir la cohérence
        sorted_params = json.dumps(params, sort_keys=True)
        # Créer un hash pour éviter les clés trop longues
        param_hash = hashlib.md5(sorted_params.encode()).hexdigest()
        return f"{prefix}:{param_hash}"
    
    @classmethod
    def get_search_results(cls, search_query: str, filters: Optional[dict] = None) -> Optional[list]:
        """
        Récupère les résultats de recherche depuis le cache.
        
        Args:
            search_query: Terme de recherche
            filters: Filtres additionnels (rayon, fournisseur, etc.)
        
        Returns:
            Liste des résultats ou None si pas en cache
        """
        filters = filters or {}
        cache_key = cls._generate_cache_key(
            cls.PREFIX_PRODUCT_SEARCH,
            query=search_query,
            filters=filters
        )
        return cache.get(cache_key)
    
    @classmethod
    def set_search_results(cls, search_query: str, results: list,
                          filters: Optional[dict] = None, ttl: Optional[int] = None) -> None:
        """
        Stocke les résultats de recherche dans le cache.
        
        Args:
            search_query: Terme de recherche
            results: Résultats à mettre en cache
            filters: Filtres additionnels
            ttl: Durée de vie du cache en secondes (défaut: 5 min)
        """
        filters = filters or {}
        ttl = ttl or cls.DEFAULT_TTL
        cache_key = cls._generate_cache_key(
            cls.PREFIX_PRODUCT_SEARCH,
            query=search_query,
            filters=filters
        )
        cache.set(cache_key, results, ttl)
    
    @classmethod
    def get_product_list(cls, page: int = 1, page_size: int = 50, 
                        ordering: str = '-created_at') -> Optional[dict]:
        """
        Récupère la liste paginée de produits depuis le cache.
        
        Args:
            page: Numéro de page
            page_size: Taille de la page
            ordering: Champ de tri
        
        Returns:
            Dictionnaire avec les résultats paginés ou None
        """
        cache_key = cls._generate_cache_key(
            cls.PREFIX_PRODUCT_LIST,
            page=page,
            page_size=page_size,
            ordering=ordering
        )
        return cache.get(cache_key)
    
    @classmethod
    def set_product_list(cls, results: dict, page: int = 1,
                        page_size: int = 50, ordering: str = '-created_at',
                        ttl: Optional[int] = None) -> None:
        """
        Stocke la liste paginée de produits dans le cache.
        
        Args:
            results: Résultats paginés à mettre en cache
            page: Numéro de page
            page_size: Taille de la page
            ordering: Champ de tri
            ttl: Durée de vie du cache (défaut: 5 min)
        """
        ttl = ttl or cls.DEFAULT_TTL
        cache_key = cls._generate_cache_key(
            cls.PREFIX_PRODUCT_LIST,
            page=page,
            page_size=page_size,
            ordering=ordering
        )
        cache.set(cache_key, results, ttl)
    
    @classmethod
    def get_product_detail(cls, product_id: int) -> Optional[dict]:
        """
        Récupère les détails d'un produit depuis le cache.
        
        Args:
            product_id: ID du produit
        
        Returns:
            Détails du produit ou None
        """
        cache_key = f"{cls.PREFIX_PRODUCT_DETAIL}:{product_id}"
        return cache.get(cache_key)
    
    @classmethod
    def set_product_detail(cls, product_id: int, product_data: dict, 
                          ttl: Optional[int] = None) -> None:
        """
        Stocke les détails d'un produit dans le cache.
        
        Args:
            product_id: ID du produit
            product_data: Données du produit
            ttl: Durée de vie du cache (défaut: 5 min)
        """
        ttl = ttl or cls.DEFAULT_TTL
        cache_key = f"{cls.PREFIX_PRODUCT_DETAIL}:{product_id}"
        cache.set(cache_key, product_data, ttl)
    
    @classmethod
    def invalidate_product(cls, product_id: int) -> None:
        """
        Invalide le cache pour un produit spécifique.
        Utilisé après une mise à jour du produit.
        
        Args:
            product_id: ID du produit à invalider
        """
        cache_key = f"{cls.PREFIX_PRODUCT_DETAIL}:{product_id}"
        cache.delete(cache_key)
    
    @classmethod
    def invalidate_all_products(cls) -> None:
        """
        Invalide tout le cache des produits (recherches, listes, détails).
        """
        try:
            # Essayer d'utiliser la méthode delete_pattern de django-redis
            # Type: ignore[attr-defined] - delete_pattern n'existe que sur RedisCache
            cache.delete_pattern(f"{cls.PREFIX_PRODUCT_SEARCH}:*")  # type: ignore[attr-defined]
            cache.delete_pattern(f"{cls.PREFIX_PRODUCT_LIST}:*")  # type: ignore[attr-defined]
            cache.delete_pattern(f"{cls.PREFIX_PRODUCT_DETAIL}:*")  # type: ignore[attr-defined]
            # Clear old styles if they exist
            cache.delete_pattern("produit_search_*")  # type: ignore[attr-defined]
            cache.delete('produit_list')
        except AttributeError:
            # Si delete_pattern n'existe pas (LocMemCache), vider tout le cache
            # C'est radical mais c'est le seul moyen sûr sur LocMemCache sans lister les clés
            cache.clear()
    
    @classmethod
    def get_cache_stats(cls) -> dict:
        """
        Retourne des statistiques sur l'utilisation du cache (si disponible).
        
        Returns:
            Dictionnaire avec les statistiques
        """
        try:
            # Essayer d'obtenir des stats de Redis
            from django_redis import get_redis_connection
            conn = get_redis_connection("default")
            info = conn.info()
            return {
                'backend': 'redis',
                'used_memory': info.get('used_memory_human', 'N/A'),
                'connected_clients': info.get('connected_clients', 0),
                'total_commands_processed': info.get('total_commands_processed', 0),
            }
        except (ImportError, Exception):
            # LocMemCache ou autre backend
            return {
                'backend': 'locmem',
                'message': 'Statistiques limitées pour ce backend'
            }


class CacheInvalidator:
    """
    Gestionnaire d'invalidation de cache basé sur les signaux Django.
    """
    
    @staticmethod
    def invalidate_on_product_change(sender, instance, **kwargs):
        """
        Signal handler pour invalider le cache quand un produit change.
        
        Usage:
            from django.db.models.signals import post_save, post_delete
            post_save.connect(CacheInvalidator.invalidate_on_product_change, sender=Produit)
            post_delete.connect(CacheInvalidator.invalidate_on_product_change, sender=Produit)
        """
        SearchCache.invalidate_product(instance.id)
        # Invalider aussi les listes de recherche qui pourraient contenir ce produit
        # Note: On pourrait être plus sélectif ici
        try:
            cache.delete_pattern(f"{SearchCache.PREFIX_PRODUCT_SEARCH}:*")  # type: ignore[attr-defined]
            cache.delete_pattern(f"{SearchCache.PREFIX_PRODUCT_LIST}:*")  # type: ignore[attr-defined]
        except AttributeError:
            # LocMemCache: pas de delete_pattern
            pass
    
    @staticmethod
    def invalidate_on_stock_change(sender, instance, **kwargs):
        """
        Signal handler pour invalider le cache quand un lot de stock change.
        
        Usage:
            from django.db.models.signals import post_save, post_delete
            post_save.connect(CacheInvalidator.invalidate_on_stock_change, sender=StockLot)
        """
        # Invalider le produit associé
        if hasattr(instance, 'produit'):
            SearchCache.invalidate_product(instance.produit.id)


class ClientDebtCache:
    """
    Gestionnaire de cache pour les calculs de dette client.
    Optimise les performances des requêtes fréquentes sur les factures impayées.
    TTL court (30-60s) pour garantir la cohérence des données financières.
    """
    
    # TTL: 60 secondes pour la dette (données financières = fraîcheur importante)
    DEBT_TTL = 60
    # TTL: 30 secondes pour les listes de factures
    INVOICE_LIST_TTL = 30
    
    PREFIX_CLIENT_DEBT = "client_debt"
    PREFIX_CLIENT_UNPAID_COUNT = "client_unpaid_count"
    PREFIX_CLIENT_INVOICES = "client_invoices"
    
    @classmethod
    def get_client_debt(cls, client_id: int) -> Optional[dict]:
        """
        Récupère la dette calculée d'un client depuis le cache.
        
        Returns:
            Dict avec 'total_debt', 'unpaid_count', 'invoices' ou None
        """
        cache_key = f"{cls.PREFIX_CLIENT_DEBT}:{client_id}"
        return cache.get(cache_key)
    
    @classmethod
    def set_client_debt(cls, client_id: int, debt_data: dict, ttl: Optional[int] = None) -> None:
        """
        Stocke la dette calculée d'un client dans le cache.
        """
        ttl = ttl or cls.DEBT_TTL
        cache_key = f"{cls.PREFIX_CLIENT_DEBT}:{client_id}"
        cache.set(cache_key, debt_data, ttl)
    
    @classmethod
    def get_unpaid_invoices_count(cls, client_id: int) -> Optional[int]:
        """
        Récupère le nombre de factures impayées depuis le cache.
        """
        cache_key = f"{cls.PREFIX_CLIENT_UNPAID_COUNT}:{client_id}"
        return cache.get(cache_key)
    
    @classmethod
    def set_unpaid_invoices_count(cls, client_id: int, count: int, ttl: Optional[int] = None) -> None:
        """
        Stocke le nombre de factures impayées dans le cache.
        """
        ttl = ttl or cls.DEBT_TTL
        cache_key = f"{cls.PREFIX_CLIENT_UNPAID_COUNT}:{client_id}"
        cache.set(cache_key, count, ttl)
    
    @classmethod
    def invalidate_client(cls, client_id: int) -> None:
        """
        Invalide tout le cache pour un client spécifique.
        À appeler après ajout de paiement, création de facture, etc.
        """
        cache.delete(f"{cls.PREFIX_CLIENT_DEBT}:{client_id}")
        cache.delete(f"{cls.PREFIX_CLIENT_UNPAID_COUNT}:{client_id}")
        cache.delete(f"{cls.PREFIX_CLIENT_INVOICES}:{client_id}")
    
    @classmethod
    def invalidate_all_clients(cls) -> None:
        """
        Invalide tout le cache des dettes clients.
        """
        try:
            cache.delete_pattern(f"{cls.PREFIX_CLIENT_DEBT}:*")  # type: ignore[attr-defined]
            cache.delete_pattern(f"{cls.PREFIX_CLIENT_UNPAID_COUNT}:*")  # type: ignore[attr-defined]
            cache.delete_pattern(f"{cls.PREFIX_CLIENT_INVOICES}:*")  # type: ignore[attr-defined]
        except AttributeError:
            # LocMemCache: pas de delete_pattern
            cache.clear()
    
    @classmethod
    def get_cached_debt_or_compute(cls, client_id: int, compute_func) -> dict:
        """
        Pattern: Cache-Aside. Récupère du cache ou calcule et stocke.
        
        Args:
            client_id: ID du client
            compute_func: Fonction à appeler si pas en cache (doit retourner un dict)
        
        Returns:
            Données de dette (depuis cache ou calculées)
        """
        cached = cls.get_client_debt(client_id)
        if cached is not None:
            return cached
        
        # Cache miss: calculer
        result = compute_func()
        cls.set_client_debt(client_id, result)
        return result
