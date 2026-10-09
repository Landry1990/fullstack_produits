"""
Mixins pour ajouter automatiquement le cache aux ViewSets DRF.
"""
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers
from rest_framework.response import Response

from .cache_utils import SearchCache, cache_get_or_compute


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
        Override de la méthode list pour ajouter le cache (avec verrou
        anti-stampede : un seul worker calcule sur miss concurrent).
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

        try:
            page_num = int(page)
            page_size_num = int(page_size)
        except (ValueError, TypeError):
            page_num = 1
            page_size_num = 50

        if search_query:
            # La pagination fait partie de la clé : sans elle, la page 2 d'une
            # recherche renvoyait les résultats cachés de la page 1.
            cache_key = SearchCache._generate_cache_key(
                SearchCache.PREFIX_PRODUCT_SEARCH,
                query=search_query,
                filters=filters,
                page=page_num,
                page_size=page_size_num,
                ordering=ordering,
            )
        elif filters:
            # Clé déterministe (md5) : hash() Python est randomisé par processus.
            cache_key = SearchCache._generate_cache_key(
                'product_filters',
                filters=filters,
                page=page_num,
                page_size=page_size_num,
                ordering=ordering,
            )
        else:
            cache_key = SearchCache._generate_cache_key(
                SearchCache.PREFIX_PRODUCT_LIST,
                page=page_num,
                page_size=page_size_num,
                ordering=ordering,
            )

        # super() doit être résolu ici (le 0-arg super ne marche pas dans une closure)
        parent_list = super().list

        def compute():
            return parent_list(request, *args, **kwargs).data

        data, hit = cache_get_or_compute(cache_key, compute, self.cache_ttl)
        response = Response(data)
        response['X-Cache-Hit'] = 'true' if hit else 'false'
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
        """Génère une clé de cache basée sur l'URL + query params (ordre normalisé)."""
        import hashlib
        import json
        # Tri des params : ?a=1&b=2 et ?b=2&a=1 partagent la même entrée.
        # Hash stable pour borner la longueur des clés.
        params = sorted(
            (key, value) for key, values in request.GET.lists() for value in values
        )
        params_hash = hashlib.md5(
            json.dumps(params).encode(), usedforsecurity=False
        ).hexdigest()
        return f"{self.cache_prefix}_list:{request.path}:{params_hash}"
    
    def list(self, request, *args, **kwargs):
        cache_key = self._build_cache_key(request)
        # super() doit être résolu ici (le 0-arg super ne marche pas dans une closure)
        parent_list = super().list

        def compute():
            return parent_list(request, *args, **kwargs).data

        data, hit = cache_get_or_compute(cache_key, compute, self.cache_ttl)
        response = Response(data)
        response['X-Cache-Hit'] = 'true' if hit else 'false'
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
