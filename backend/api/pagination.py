from rest_framework.pagination import PageNumberPagination

class StandardResultsSetPagination(PageNumberPagination):
    """
    Classe de pagination standard pour tout le projet.
    Force le respect du paramètre 'page_size' envoyé par le frontend.
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 1000
