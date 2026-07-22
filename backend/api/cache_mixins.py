"""
Mixins pour ajouter automatiquement le cache aux ViewSets DRF.
"""
from rest_framework.response import Response
from .cache_utils import SearchCache
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers


class CachedSearchMixin:
    """
    Mixin pour ajouter le cache automatique aux recherches de produits.
    
    Usage:
        class ProduitViewSet(CachedSearchMixin, viewsets.ModelViewSet):
            ...
    """
    
    cache_ttl = 60  # 60 secondes — stock doit rester frais pour la facturation
    
    def list(self, request, *args, **kwargs):
        """
        Override de la méthode list pour ajouter le cache.
        """
        # Extraire les paramètres de recherche
        search_query = request.query_params.get('search', '')
        page = request.query_params.get('page', '1')
        page_size = request.query_params.get('page_size', '50')
        ordering = request.query_params.get('ordering', '-created_at')
        
        # Extraire les filtres
        filters = {}
        for key, value in request.query_params.items():
            if key not in ['search', 'page', 'page_size', 'ordering']:
                filters[key] = value
        
        # Si c'est une recherche ou s'il y a des filtres, utiliser le cache de recherche
        if search_query or filters:
            cached_results = SearchCache.get_search_results(search_query, filters)
            if cached_results is not None:
                # Ajouter un header pour indiquer que c'est du cache
                response = Response(cached_results)
                response['X-Cache-Hit'] = 'true'
                return response
            
            # Pas en cache, exécuter la requête normale
            response = super().list(request, *args, **kwargs)
            
            # Mettre en cache les résultats
            SearchCache.set_search_results(
                search_query, 
                response.data, 
                filters,
                ttl=self.cache_ttl
            )
            response['X-Cache-Hit'] = 'false'
            return response
        
        # Pour les listes sans recherche, utiliser le cache de liste
        # MAIS si des filtres sont présents, utiliser le cache de recherche (qui prend en compte les filtres)
        try:
            page_num = int(page)
            page_size_num = int(page_size)
        except (ValueError, TypeError):
            page_num = 1
            page_size_num = 50
        
        if filters:
            # Cache des requêtes filtrées avec TTL court (60s)
            filter_cache_key = f"product_filters:{hash(frozenset(filters.items()))}:{page}:{page_size}:{ordering}"
            from django.core.cache import cache
            cached_filtered = cache.get(filter_cache_key)
            if cached_filtered is not None:
                response = Response(cached_filtered)
                response['X-Cache-Hit'] = 'true'
                return response
            
            response = super().list(request, *args, **kwargs)
            cache.set(filter_cache_key, response.data, 60)  # 60s pour les filtres
            response['X-Cache-Hit'] = 'false'
            return response
        else:
            # Pas de filtres, utiliser le cache de liste standard
            cached_list = SearchCache.get_product_list(page_num, page_size_num, ordering)
            if cached_list is not None:
                response = Response(cached_list)
                response['X-Cache-Hit'] = 'true'
                return response
            
            response = super().list(request, *args, **kwargs)
            SearchCache.set_product_list(
                response.data,
                page_num,
                page_size_num,
                ordering,
                ttl=self.cache_ttl
            )
            response['X-Cache-Hit'] = 'false'
            return response
    
    def retrieve(self, request, *args, **kwargs):
        """
        Pas de cache sur retrieve : le stock doit être en temps réel
        pour la facturation (ajout au panier, vérification disponibilité).
        """
        return super().retrieve(request, *args, **kwargs)
    
    def perform_create(self, serializer):
        """
        Override pour invalider le cache après création.
        """
        super().perform_create(serializer)
        instance = serializer.instance
        # Invalider les caches de liste
        SearchCache.invalidate_all_products()
        self._invalidate_filter_cache()
        return instance
    
    def perform_update(self, serializer):
        """
        Override pour invalider le cache après mise à jour.
        """
        super().perform_update(serializer)
        instance = serializer.instance
        
        # Invalider le cache de ce produit spécifique
        if hasattr(instance, 'id'):
            SearchCache.invalidate_product(instance.id)
        # Invalider les caches de liste (utilise invalidate_all_products pour gérer le fallback LocMemCache)
        SearchCache.invalidate_all_products()
        self._invalidate_filter_cache()
        return instance
    
    def perform_destroy(self, instance):
        """
        Override pour invalider le cache après suppression.
        """
        product_id = instance.id if hasattr(instance, 'id') else None
        super().perform_destroy(instance)
        
        # Invalider le cache
        if product_id:
            SearchCache.invalidate_product(product_id)
        SearchCache.invalidate_all_products()
        self._invalidate_filter_cache()
    
    @staticmethod
    def _invalidate_filter_cache():
        """Invalide le cache des requêtes filtrées."""
        from django.core.cache import cache
        try:
            cache.delete_pattern('product_filters:*')
        except AttributeError:
            pass


class LowLevelCacheMixin:
    """
    Mixin alternatif utilisant le cache de bas niveau de Django.
    Plus simple mais moins flexible.
    
    Usage:
        class MyViewSet(LowLevelCacheMixin, viewsets.ModelViewSet):
            cache_timeout = 300  # 5 minutes
    """
    
    cache_timeout = 300  # 5 minutes par défaut
    
    @method_decorator(cache_page(cache_timeout))
    @method_decorator(vary_on_headers('Authorization'))
    def list(self, request, *args, **kwargs):
        """
        Liste avec cache automatique de Django.
        """
        return super().list(request, *args, **kwargs)
    
    @method_decorator(cache_page(cache_timeout))
    @method_decorator(vary_on_headers('Authorization'))
    def retrieve(self, request, *args, **kwargs):
        """
        Détails avec cache automatique de Django.
        """
        return super().retrieve(request, *args, **kwargs)


class SimpleListCacheMixin:
    """
    Mixin générique pour cacher les réponses de liste avec un TTL configurable.
    Invalide automatiquement le cache lors des opérations create/update/destroy.
    
    Usage:
        class MyViewSet(SimpleListCacheMixin, viewsets.ModelViewSet):
            cache_prefix = 'my_model'
            cache_ttl = 120  # 2 minutes
    """
    
    cache_prefix = 'default'
    cache_ttl = 120  # 2 minutes par défaut
    
    def _build_cache_key(self, request):
        """Génère une clé de cache basée sur l'URL + query params."""
        query_string = request.GET.urlencode()
        return f"{self.cache_prefix}_list:{request.path}:{query_string}"
    
    def list(self, request, *args, **kwargs):
        from django.core.cache import cache
        
        cache_key = self._build_cache_key(request)
        cached = cache.get(cache_key)
        
        if cached is not None:
            response = Response(cached)
            response['X-Cache-Hit'] = 'true'
            return response
        
        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, response.data, self.cache_ttl)
        response['X-Cache-Hit'] = 'false'
        return response
    
    def _invalidate_cache(self):
        """Invalide toutes les entrées de cache pour ce prefix."""
        from django.core.cache import cache
        try:
            cache.delete_pattern(f"{self.cache_prefix}_list:*")
        except AttributeError:
            pass
    
    def perform_create(self, serializer):
        super().perform_create(serializer)
        self._invalidate_cache()
    
    def perform_update(self, serializer):
        super().perform_update(serializer)
        self._invalidate_cache()
    
    def perform_destroy(self, instance):
        super().perform_destroy(instance)
        self._invalidate_cache()
