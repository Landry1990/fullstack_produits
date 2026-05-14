# -*- coding: utf-8 -*-
"""
Configuration centralisée pour l'API backend
Regroupe toutes les constantes, settings et patterns réutilisables
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.db.models import Value, DecimalField, Q, Case, When, Sum
from django.db.models.functions import Coalesce
from decimal import Decimal


# ============================================================================
# CONFIGURATIONS DE VIEWSET - Patterns réutilisables
# ============================================================================

class BaseViewSetConfig:
    """Configuration de base pour tous les ViewSets"""
    permission_classes = [IsAuthenticated]
    pagination_class = None  # Sera défini après la classe StandardResultsSetPagination
    
    # Configuration standard des filtres
    default_filter_backends = [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter'
    ]


class StandardResultsSetPagination(PageNumberPagination):
    """
    Classe de pagination standard pour tout le projet.
    Force le respect du paramètre 'page_size' envoyé par le frontend.
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 1000


# Note: BaseViewSetConfig.pagination_class sera défini par héritage dans les ViewSets concrets


# ============================================================================
# CONSTANTES MÉTIERS - Valeurs par défaut et limites
# ============================================================================

class PaginationDefaults:
    """Constantes de pagination utilisées partout dans le projet"""
    DEFAULT_PAGE_SIZE = 20
    DEFAULT_LIST_PAGE_SIZE = 50
    DEFAULT_REPORT_PAGE_SIZE = 31
    DEFAULT_ANALYSIS_PAGE_SIZE = 50
    MAX_PAGE_SIZE = 1000
    MIN_PAGE_SIZE = 1


class StockDefaults:
    """Constantes pour la gestion des stocks"""
    DEFAULT_STOCK = 0
    DEFAULT_STOCK_ALERT = 0
    DEFAULT_STOCK_MINIMUM = 0
    DEFAULT_STOCK_MAXIMUM = 0
    DEFAULT_CAPACITY_RAYON = 0
    DEFAULT_MIN_RAYON = 0
    DEFAULT_STOCK_RESERVE = 0
    DEFAULT_TREATMENT_DAYS = 30


class PriceDefaults:
    """Constantes pour les prix et marges"""
    DEFAULT_COST_PRICE = Decimal('0.00')
    DEFAULT_SELLING_PRICE = Decimal('0.00')
    DEFAULT_TVA = Decimal('0.00')
    DEFAULT_ROTATION_MOYENNE = Decimal('0.00')
    DEFAULT_TAUX_MARGE = Decimal('0.00')
    DEFAULT_POURCENTAGE_MARGE = Decimal('0.00')
    DEFAULT_PMP = Decimal('0.00')
    DEFAULT_DISCOUNT = Decimal('0.00')
    DEFAULT_MARGIN_THRESHOLD_LOW = 5  # %
    DEFAULT_MARGIN_THRESHOLD_HIGH = 80  # %


class QuantityDefaults:
    """Constantes pour les quantités"""
    DEFAULT_QUANTITY = 1
    MIN_QUANTITY = 1
    DEFAULT_DAYS_THRESHOLD = 30  # Pour analyse stocks


# ============================================================================
# UTILITAIRES SQL - Patterns d'annotations réutilisables
# ============================================================================

class SQLAnnotations:
    """Patterns d'annotations SQL réutilisables"""
    
    @staticmethod
    def coalesce_decimal(default_value=Decimal('0')):
        """Retourne une valeur Coalesce pour les champs décimaux"""
        from django.db.models import Value
        return Value(default_value, output_field=DecimalField())
    
    @staticmethod
    def safe_decimal_expression(expression, default=Decimal('0')):
        """Expression décimale sécurisée avec valeur par défaut"""
        from django.db.models import Case, When, Value, DecimalField
        return Case(
            When(expression__isnull=True, then=Value(default, output_field=DecimalField())),
            default=expression,
            output_field=DecimalField()
        )
    
    @staticmethod
    def conditional_sum(condition_field, condition_value, sum_field, default=Decimal('0')):
        """Sum conditionnel réutilisable"""
        from django.db.models import Sum, Case, When, Q, Value, DecimalField
        return Coalesce(
            Sum(Case(
                When(Q(**{condition_field: condition_value}), then=sum_field),
                default=Value(default, output_field=DecimalField())
            )),
            Value(default, output_field=DecimalField())
        )


# ============================================================================
# CONFIGURATIONS DE FILTRES - Patterns réutilisables
# ============================================================================

class CommonFilterFields:
    """Champs de filtres communs réutilisables"""
    
    @staticmethod
    def status_filters():
        """Filtres de statut standards"""
        return {
            'status': ['exact', 'in'],
        }
    
    @staticmethod
    def date_filters():
        """Filtres de date standards"""
        return {
            'created_at': ['gte', 'lte', 'exact'],
            'updated_at': ['gte', 'lte', 'exact'],
        }
    
    @staticmethod
    def user_filters():
        """Filtres utilisateur standards"""
        return {
            'user': ['exact'],
            'created_by': ['exact'],
        }


class CommonSearchFields:
    """Champs de recherche communs"""
    
    @staticmethod
    def name_fields():
        """Champs de nom standards"""
        return ['name', 'description']
    
    @staticmethod
    def contact_fields():
        """Champs de contact standards"""
        return ['email', 'phone', 'address']
    
    @staticmethod
    def product_fields():
        """Champs de recherche pour produits"""
        return ['^name', '^cip1', '^cip2', '^cip3', 'description']


class CommonOrderingFields:
    """Champs de tri communs"""
    
    @staticmethod
    def default_ordering():
        """Tri par défaut"""
        return ['-created_at']
    
    @staticmethod
    def name_ordering():
        """Tri par nom"""
        return ['name', '-created_at']
    
    @staticmethod
    def date_ordering():
        """Tri par date"""
        return ['-created_at', '-updated_at']
    
    @staticmethod
    def product_ordering():
        """Tri pour produits"""
        return ['name', 'stock', 'selling_price', 'updated_at']


# ============================================================================
# VALIDATEURS RÉUTILISABLES
# ============================================================================

class BusinessValidators:
    """Validateurs métier réutilisables"""
    
    @staticmethod
    def validate_positive_decimal(value, field_name="valeur"):
        """Validation pour les décimaux positifs"""
        if value is not None and value < 0:
            raise ValueError(f"{field_name} doit être positif")
        return value
    
    @staticmethod
    def validate_positive_integer(value, field_name="quantité"):
        """Validation pour les entiers positifs"""
        if value is not None and value < 0:
            raise ValueError(f"{field_name} doit être positif")
        return value
    
    @staticmethod
    def validate_percentage(value, field_name="pourcentage"):
        """Validation pour les pourcentages (0-100)"""
        if value is not None and (value < 0 or value > 100):
            raise ValueError(f"{field_name} doit être entre 0 et 100")
        return value


# ============================================================================
# MESSAGES D'ERREUR CENTRALISÉS
# ============================================================================

class ErrorMessages:
    """Messages d'erreur standardisés"""
    
    # Messages généraux
    INVALID_PERMISSION = "Vous n'avez pas la permission d'effectuer cette action"
    NOT_FOUND = "Ressource introuvable"
    INVALID_DATA = "Données invalides"
    
    # Messages métier
    INSUFFICIENT_STOCK = "Stock insuffisant pour cette opération"
    INVALID_PRICE = "Prix invalide"
    INVALID_QUANTITY = "Quantité invalide"
    EXPIRED_PRODUCT = "Produit expiré"
    BLOCKED_ALERT = "Ce produit est bloqué par une alerte"
    
    # Messages de validation
    REQUIRED_FIELD = "Le champ {} est obligatoire"
    INVALID_FORMAT = "Format invalide pour le champ {}"
    DUPLICATE_VALUE = "La valeur {} existe déjà"


# ============================================================================
# UTILITAIRES DE PAGINATION PERSONALISÉE
# ============================================================================

class PaginationHelper:
    """Utilitaires pour la pagination personnalisée"""
    
    @staticmethod
    def get_page_size(request, default=PaginationDefaults.DEFAULT_PAGE_SIZE):
        """Récupère le page_size depuis la requête avec validation"""
        try:
            page_size = int(request.query_params.get('page_size', default))
            return max(PaginationDefaults.MIN_PAGE_SIZE, 
                      min(page_size, PaginationDefaults.MAX_PAGE_SIZE))
        except (ValueError, TypeError):
            return default
    
    @staticmethod
    def get_page_number(request, default=1):
        """Récupère le numéro de page depuis la requête avec validation"""
        try:
            page = int(request.query_params.get('page', default))
            return max(1, page)
        except (ValueError, TypeError):
            return default
    
    @staticmethod
    def paginate_list(data_list, page=1, page_size=20):
        """Pagine une liste simple (hors queryset)"""
        start = (page - 1) * page_size
        end = start + page_size
        total_items = len(data_list)
        total_pages = (total_items + page_size - 1) // page_size if total_items > 0 else 1
        
        return {
            'results': data_list[start:end],
            'count': total_items,
            'current_page': page,
            'total_pages': total_pages,
            'page_size': page_size,
            'next': page + 1 if page < total_pages else None,
            'previous': page - 1 if page > 1 else None
        }


# ============================================================================
# CONFIGURATIONS DE CACHE - Patterns réutilisables
# ============================================================================

class CacheConfig:
    """Configurations de cache centralisées"""
    
    # TTL par défaut (en secondes)
    DEFAULT_TTL = 300  # 5 minutes
    SHORT_TTL = 60     # 1 minute
    MEDIUM_TTL = 900   # 15 minutes
    LONG_TTL = 3600    # 1 heure
    
    # Préfixes de clés
    PRODUCT_PREFIX = 'product'
    LIST_PREFIX = 'list'
    SEARCH_PREFIX = 'search'
    STATS_PREFIX = 'stats'
    REPORT_PREFIX = 'report'


# ============================================================================
# MIXINS DE CONFIGURATION - Pour héritage multiple
# ============================================================================

class StandardViewSetMixin:
    """Mixin à ajouter aux ViewSets pour configuration standard"""
    
    def get_pagination_class(self):
        return StandardResultsSetPagination
    
    def get_default_filter_backends(self):
        return [
            'django_filters.rest_framework.DjangoFilterBackend',
            'rest_framework.filters.SearchFilter',
            'rest_framework.filters.OrderingFilter'
        ]


class BusinessLogicMixin:
    """Mixin pour la logique métier commune"""
    
    def validate_business_rules(self, instance, **kwargs):
        """Point d'entrée pour les validations métier"""
        pass
    
    def perform_business_actions(self, instance, **kwargs):
        """Point d'entrée pour les actions métier post-crud"""
        pass
