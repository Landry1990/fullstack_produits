from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework.routers import DefaultRouter
from api.views import (
    ProduitViewSet, CategorieViewSet, FournisseurViewSet, 
    ClientViewSet, CommandeViewSet, CommandeProduitViewSet,
    FactureViewSet, FactureProduitViewSet, DashboardViewSet,
    UserViewSet, CustomAuthToken, CaisseViewSet, AyantDroitViewSet,
    CreanceViewSet, InventaireViewSet, LigneInventaireViewSet,
    AvoirViewSet, LigneAvoirViewSet, StatistiquesViewSet,
    RelationTransformationViewSet, HistoriqueTransformationViewSet,
    StatsUGViewSet, StockLotViewSet, InvoiceConfigurationView,
    CategoriesListView, CategoriesDetailView, AuditLogViewSet,
    generer_suggestions_commande, PromisViewSet, MouvementCaisseViewSet,
    StockAnalysisUnsoldView, StockAnalysisOverstockView, LoyaltySettingViewSet,
    StockAdjustmentViewSet, ClotureCaisseViewSet, HistoriqueVentesViewSet,
    HistoriqueAchatsViewSet, RapportViewSet, OrdonnancierViewSet,
    verify_password, PharmacySettingsView, ProductImportView,
    FormeViewSet, CouponMonnaieViewSet, GroupeViewSet
)

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'produits', ProduitViewSet)
router.register(r'fournisseurs', FournisseurViewSet)
router.register(r'clients', ClientViewSet)
router.register(r'ayants-droit', AyantDroitViewSet, basename='ayantdroit')
router.register(r'commandes', CommandeViewSet)
router.register(r'commande-produits', CommandeProduitViewSet)
router.register(r'factures', FactureViewSet)
router.register(r'facture-produits', FactureProduitViewSet)
router.register(r'caisse', CaisseViewSet)
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'categories', CategorieViewSet, basename='categorie')
router.register(r'rayons', CategorieViewSet, basename='rayon')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')
router.register(r'promis', PromisViewSet, basename='promis')
router.register(r'creances', CreanceViewSet, basename='creance')
router.register(r'inventaires', InventaireViewSet)
router.register(r'ligne-inventaires', LigneInventaireViewSet)
router.register(r'avoirs', AvoirViewSet)
router.register(r'ligne-avoirs', LigneAvoirViewSet)
router.register(r'statistiques', StatistiquesViewSet, basename='statistiques')
router.register(r'rapports', RapportViewSet, basename='rapports')

router.register(r'relations-transformation', RelationTransformationViewSet, basename='relationtransformation')
router.register(r'historique-transformation', HistoriqueTransformationViewSet, basename='historiquetransformation')
router.register(r'stats-ug', StatsUGViewSet, basename='statsug')
router.register(r'stock-lots', StockLotViewSet, basename='stocklot')
router.register(r'mouvements-caisse', MouvementCaisseViewSet, basename='mouvementcaisse')
router.register(r'loyalty-settings', LoyaltySettingViewSet, basename='loyaltysetting')
router.register(r'stock-adjustments', StockAdjustmentViewSet, basename='stockadjustment')
router.register(r'clotures-caisse', ClotureCaisseViewSet, basename='cloturecaisse')
router.register(r'historique-ventes', HistoriqueVentesViewSet, basename='historiqueventes')
router.register(r'historique-achats', HistoriqueAchatsViewSet, basename='historiqueachats')
router.register(r'ordonnancier', OrdonnancierViewSet, basename='ordonnancier')
router.register(r'formes', FormeViewSet, basename='forme')
router.register(r'coupons', CouponMonnaieViewSet, basename='coupon')
router.register(r'groupes', GroupeViewSet, basename='groupe')


urlpatterns = [
    # Manual paths MUST be before 'api/' router include to avoid being masked
    path('api/categories/', CategoriesListView.as_view()),
    path('api/categories/<int:pk>/', CategoriesDetailView.as_view()),
    path('api/categories/<int:pk>/', CategoriesDetailView.as_view()),
    path('api/invoice-settings/', InvoiceConfigurationView.as_view()),
    path('api/pharmacy-settings/', PharmacySettingsView.as_view()),
    path('api/generer-suggestions/', generer_suggestions_commande),
    path('api/verify-password/', verify_password, name='verify-password'),
    path('api/import/products/', ProductImportView.as_view(), name='import-products'),
    path('api/test-auth/', lambda request: JsonResponse({"message": "OK - Pas d'auth requise!"})),
    path('api-token-auth/', CustomAuthToken.as_view()),
    
    # Stock Analysis Explicit Paths
    path('api/stock-analysis/unsold/', StockAnalysisUnsoldView.as_view()),
    path('api/stock-analysis/overstock/', StockAnalysisOverstockView.as_view()),
    
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
]
