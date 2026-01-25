from django.db.models import Q

def apply_multiterm_search(queryset, search_query, search_fields):
    """
    Applique une recherche multi-termes sur un queryset.
    
    Comportement:
    - Recherche simple (un mot, ex: "DOLI"): cherche les produits qui COMMENCENT par ce mot
    - Recherche multi-termes (ex: "DOLI 500"): cherche les produits qui CONTIENNENT tous les termes
    
    Args:
        queryset: Le queryset Django à filtrer
        search_query: La chaîne de recherche (ex: "doli 500")
        search_fields: Liste des champs sur lesquels chercher
        
    Returns:
        QuerySet: Le queryset filtré
    """
    if not search_query or not search_fields:
        return queryset
        
    terms = search_query.split()
    is_single_term = len(terms) == 1
    
    for term in terms:
        # Chaque terme doit matcher au moins un des champs (OR entre champs)
        # Mais tous les termes doivent être satisfaits (AND entre termes)
        term_query = Q()
        for field in search_fields:
            # Nettoyer les préfixes DRF (^=start, =exact, @search, $regex)
            clean_field = field.lstrip('^=@$')
            
            # Support pour les lookups personnalisés (ex: __startswith)
            if '__' in clean_field:
                 parts = clean_field.split('__')
                 known_lookups = ['exact', 'iexact', 'contains', 'icontains', 'startswith', 'istartswith', 'endswith', 'iendswith']
                 if parts[-1] in known_lookups:
                     lookup = clean_field
                 else:
                     # Recherche simple = préfixe, recherche multi = contient
                     if is_single_term:
                         lookup = f"{clean_field}__istartswith"
                     else:
                         lookup = f"{clean_field}__icontains"
            else:
                # Recherche simple = préfixe, recherche multi = contient
                if is_single_term:
                    lookup = f"{clean_field}__istartswith"
                else:
                    lookup = f"{clean_field}__icontains"
                
            term_query |= Q(**{lookup: term})
        
        queryset = queryset.filter(term_query)
        
    return queryset

class MultiTermSearchMixin:
    """
    Mixin pour implémenter une recherche multi-termes (ET logique).
    Chaque terme séparé par un espace doit être présent dans au moins
    un des champs définis dans `multi_term_search_fields` ou `search_fields`.
    
    Exemple: "doli 500" trouvera les produits contenant "doli" ET "500"
    (dans n'importe quel ordre).
    
    Supporte les préfixes DRF standards (^, =, @, $) en les retirant automatiquement.
    """
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Récupérer le terme de recherche
        search = self.request.query_params.get('search', '').strip()
        
        # Déterminer les champs de recherche
        # Priorité à multi_term_search_fields pour compatibilité, sinon search_fields
        search_fields = getattr(self, 'multi_term_search_fields', None)
        if not search_fields:
            search_fields = getattr(self, 'search_fields', [])
            
        return apply_multiterm_search(queryset, search, search_fields)
