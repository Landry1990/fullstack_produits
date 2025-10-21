from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProduitViewSet, RayonViewSet, FournisseurViewSet, ClientViewSet,
    CommandeViewSet, CommandeProduitViewSet, FactureViewSet, FactureProduitViewSet
)

# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'produits', ProduitViewSet, basename='produit')
router.register(r'rayons', RayonViewSet, basename='rayon')
router.register(r'fournisseurs', FournisseurViewSet, basename='fournisseur')
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'commandes', CommandeViewSet, basename='commande')
router.register(r'commande-produits', CommandeProduitViewSet, basename='commandeproduit')
router.register(r'factures', FactureViewSet, basename='facture')
router.register(r'facture-produits', FactureProduitViewSet, basename='factureproduit')

# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('', include(router.urls)),
]