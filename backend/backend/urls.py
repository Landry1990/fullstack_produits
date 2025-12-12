from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from api.views import (
    ProduitViewSet, RayonViewSet, FournisseurViewSet, 
    ClientViewSet, CommandeViewSet, CommandeProduitViewSet,
    FactureViewSet, FactureProduitViewSet, DashboardViewSet,
    UserViewSet, CustomAuthToken, CaisseViewSet, AyantDroitViewSet,
    CreanceViewSet
)

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'produits', ProduitViewSet)
router.register(r'rayons', RayonViewSet)
router.register(r'fournisseurs', FournisseurViewSet)
router.register(r'clients', ClientViewSet)
router.register(r'ayants-droit', AyantDroitViewSet, basename='ayantdroit')
router.register(r'commandes', CommandeViewSet)
router.register(r'commande-produits', CommandeProduitViewSet)
router.register(r'factures', FactureViewSet)
router.register(r'facture-produits', FactureProduitViewSet)
router.register(r'caisse', CaisseViewSet)
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'creances', CreanceViewSet, basename='creance')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api-token-auth/', CustomAuthToken.as_view()),
]
