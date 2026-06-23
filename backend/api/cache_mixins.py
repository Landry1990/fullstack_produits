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
    
    cache_ttl = SearchCache.DEFAULT_TTL  # 5 minutes par défaut
    
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
            # Désactiver le cache quand il y a des filtres (ex: only_in_stock)
            # car les filtres changent souvent et le cache devient rapidement invalide
            response = super().list(request, *args, **kwargs)
            response['X-Cache-Hit'] = 'false'
            response['X-Cache-Disabled'] = 'filters-present'
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
        Override de la méthode retrieve pour ajouter le cache aux détails.
        """
        product_id = kwargs.get('pk')
        
        if product_id:
            try:
                product_id_int = int(product_id)
                cached_product = SearchCache.get_product_detail(product_id_int)
                
                if cached_product is not None:
                    response = Response(cached_product)
                    response['X-Cache-Hit'] = 'true'
                    return response
            except (ValueError, TypeError):
                pass
        
        # Pas en cache, exécuter la requête normale
        response = super().retrieve(request, *args, **kwargs)
        
        # Mettre en cache
        if product_id:
            try:
                product_id_int = int(product_id)
                SearchCache.set_product_detail(
                    product_id_int,
                    response.data,
                    ttl=self.cache_ttl
                )
            except (ValueError, TypeError):
                pass
        
        response['X-Cache-Hit'] = 'false'
        return response
    
    def perform_create(self, serializer):
        """
        Override pour invalider le cache après création.
        """
        super().perform_create(serializer)
        instance = serializer.instance
        # Invalider les caches de liste
        SearchCache.invalidate_all_products()
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
